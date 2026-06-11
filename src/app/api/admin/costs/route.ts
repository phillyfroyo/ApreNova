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

    // Date range: prefer explicit startDate/endDate (ISO) from the shared
    // admin date control; fall back to the legacy relative `days` param.
    // `startDate` may be omitted ("all time") -> no lower bound.
    const startParam = searchParams.get("startDate");
    const endParam = searchParams.get("endDate");

    let startDate: Date | null;
    let endDate: Date | null = null;
    let days: number;

    if (startParam || endParam) {
      startDate = startParam ? new Date(startParam) : null;
      endDate = endParam ? new Date(endParam) : null;
      days = startDate
        ? Math.max(1, Math.round((Date.now() - startDate.getTime()) / 86_400_000))
        : 0; // 0 = all-time, for display only
    } else {
      const daysParam = searchParams.get("days") || "30";
      days = parseInt(daysParam, 10);
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
    }

    // Reusable createdAt filter (gte/lte as available). Spread into where clauses.
    const createdAtFilter: { gte?: Date; lte?: Date } = {};
    if (startDate) createdAtFilter.gte = startDate;
    if (endDate) createdAtFilter.lte = endDate;
    const hasCreatedAtFilter = Object.keys(createdAtFilter).length > 0;
    const createdAtWhere = hasCreatedAtFilter ? { createdAt: createdAtFilter } : {};

    // Get summary by operation
    const byOperation = await prisma.apiCost.groupBy({
      by: ["operation"],
      where: createdAtWhere,
      _sum: { costCents: true, inputTokens: true, outputTokens: true },
      _count: true,
    });

    // Get summary by provider
    const byProvider = await prisma.apiCost.groupBy({
      by: ["provider"],
      where: createdAtWhere,
      _sum: { costCents: true },
      _count: true,
    });

    // Get summary by model
    const byModel = await prisma.apiCost.groupBy({
      by: ["model"],
      where: createdAtWhere,
      _sum: { costCents: true, inputTokens: true, outputTokens: true },
      _count: true,
    });

    // Get daily totals for chart. Bound by start/end when present; with no
    // bounds ("all time") select everything. Build the WHERE conditionally so a
    // null startDate doesn't produce `>= NULL` (which matches no rows).
    const lowerBound = startDate ?? new Date(0);
    const upperBound = endDate ?? new Date();
    const dailyRaw = await prisma.$queryRaw<
      { date: Date; total_cents: bigint; call_count: bigint }[]
    >`
      SELECT
        DATE("createdAt") as date,
        SUM("costCents") as total_cents,
        COUNT(*) as call_count
      FROM "ApiCost"
      WHERE "createdAt" >= ${lowerBound} AND "createdAt" <= ${upperBound}
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
      where: createdAtWhere,
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
        ...createdAtWhere,
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
        ...(hasCreatedAtFilter ? { deletedAt: createdAtFilter } : {}),
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
        startDate: startDate ? startDate.toISOString() : null,
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
