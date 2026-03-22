// src/app/api/admin/costs/route.ts
// API endpoint for fetching cost data for admin dashboard

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Helper to count words in text
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Parse date range (default to last 30 days)
    const daysParam = searchParams.get("days") || "30";
    const days = parseInt(daysParam, 10);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get summary by operation
    const byOperation = await prisma.apiCost.groupBy({
      by: ["operation"],
      where: {
        createdAt: { gte: startDate },
      },
      _sum: { costCents: true, inputTokens: true, outputTokens: true },
      _count: true,
    });

    // Get summary by provider
    const byProvider = await prisma.apiCost.groupBy({
      by: ["provider"],
      where: {
        createdAt: { gte: startDate },
      },
      _sum: { costCents: true },
      _count: true,
    });

    // Get summary by model
    const byModel = await prisma.apiCost.groupBy({
      by: ["model"],
      where: {
        createdAt: { gte: startDate },
      },
      _sum: { costCents: true, inputTokens: true, outputTokens: true },
      _count: true,
    });

    // Get daily totals for chart
    const dailyRaw = await prisma.$queryRaw<
      { date: Date; total_cents: bigint; call_count: bigint }[]
    >`
      SELECT
        DATE("createdAt") as date,
        SUM("costCents") as total_cents,
        COUNT(*) as call_count
      FROM "ApiCost"
      WHERE "createdAt" >= ${startDate}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    const daily = dailyRaw.map((row) => ({
      date: row.date.toISOString().split("T")[0],
      totalCents: Number(row.total_cents),
      callCount: Number(row.call_count),
    }));

    // Get recent entries (last 100)
    const recentEntries = await prisma.apiCost.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        operation: true,
        provider: true,
        model: true,
        inputTokens: true,
        outputTokens: true,
        imageCount: true,
        costCents: true,
        userId: true,
        userStoryId: true,
        createdAt: true,
      },
    });

    // Calculate totals
    const totalCents = byOperation.reduce(
      (sum, op) => sum + (op._sum.costCents || 0),
      0
    );
    const totalCalls = byOperation.reduce((sum, op) => sum + op._count, 0);

    // Get costs grouped by userStoryId (for story-level analysis)
    const costsByStory = await prisma.apiCost.groupBy({
      by: ["userStoryId"],
      where: {
        createdAt: { gte: startDate },
        userStoryId: { not: null },
      },
      _sum: { costCents: true },
    });

    // Get user stories with their details to calculate averages by story type
    const storyIds = costsByStory
      .map((c) => c.userStoryId)
      .filter((id): id is string => id !== null);

    const stories = await prisma.userStory.findMany({
      where: { id: { in: storyIds } },
      select: {
        id: true,
        storyType: true,
        rawContent: true,
      },
    });

    // Build story cost map with word counts
    const storyDataMap = new Map(
      stories.map((s) => [
        s.id,
        {
          storyType: s.storyType || "unknown",
          wordCount: countWords(s.rawContent),
        },
      ])
    );

    // Include deleted stories in story type analysis
    const deletedStories = await prisma.deletedUserStory.findMany({
      where: {
        deletedAt: { gte: startDate },
        storyType: { not: null },
        wordCount: { not: null },
      },
      select: {
        costCents: true,
        storyType: true,
        wordCount: true,
      },
    });

    // Calculate average cost by story type
    const storyTypeCosts: Record<
      string,
      { totalCents: number; count: number; totalWords: number }
    > = {};

    for (const cost of costsByStory) {
      if (!cost.userStoryId) continue;
      const storyData = storyDataMap.get(cost.userStoryId);
      if (!storyData) continue;

      const { storyType, wordCount } = storyData;
      if (!storyTypeCosts[storyType]) {
        storyTypeCosts[storyType] = { totalCents: 0, count: 0, totalWords: 0 };
      }
      storyTypeCosts[storyType].totalCents += cost._sum.costCents || 0;
      storyTypeCosts[storyType].count += 1;
      storyTypeCosts[storyType].totalWords += wordCount;
    }

    // Add deleted stories to the story type breakdown
    for (const ds of deletedStories) {
      const storyType = ds.storyType!;
      const wordCount = ds.wordCount!;
      if (!storyTypeCosts[storyType]) {
        storyTypeCosts[storyType] = { totalCents: 0, count: 0, totalWords: 0 };
      }
      storyTypeCosts[storyType].totalCents += ds.costCents;
      storyTypeCosts[storyType].count += 1;
      storyTypeCosts[storyType].totalWords += wordCount;
    }

    const byStoryType = Object.entries(storyTypeCosts).map(([type, data]) => ({
      storyType: type,
      avgCostCents: Math.round(data.totalCents / data.count),
      avgWords: Math.round(data.totalWords / data.count),
      costPerThousandWords:
        data.totalWords > 0
          ? Math.round((data.totalCents / data.totalWords) * 1000)
          : 0,
      storyCount: data.count,
      totalCents: data.totalCents,
    }));

    return NextResponse.json({
      summary: {
        totalCents,
        totalCalls,
        days,
        startDate: startDate.toISOString(),
      },
      byOperation: byOperation.map((op) => ({
        operation: op.operation,
        costCents: op._sum.costCents || 0,
        inputTokens: op._sum.inputTokens || 0,
        outputTokens: op._sum.outputTokens || 0,
        count: op._count,
      })),
      byProvider: byProvider.map((p) => ({
        provider: p.provider,
        costCents: p._sum.costCents || 0,
        count: p._count,
      })),
      byModel: byModel.map((m) => ({
        model: m.model,
        costCents: m._sum.costCents || 0,
        inputTokens: m._sum.inputTokens || 0,
        outputTokens: m._sum.outputTokens || 0,
        count: m._count,
      })),
      daily,
      byStoryType,
      recentEntries: recentEntries.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Failed to fetch cost data:", error);
    return NextResponse.json(
      { error: "Failed to fetch cost data" },
      { status: 500 }
    );
  }
}
