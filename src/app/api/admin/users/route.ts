// src/app/api/admin/users/route.ts
// API endpoint for fetching user data with cost breakdowns

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Helper to count words in text
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Operation category mappings
const IN_STORY_OPERATIONS = [
  "translate-word",
  "translate-phrase",
  "example-sentence",
  "tts",
  "story-tutor",
];

const TUTOR_OPERATIONS = ["tutor"];

// Human-readable labels for operations
const OPERATION_LABELS: Record<string, string> = {
  "translate-word": "Word Translations",
  "translate-phrase": "Phrase Translations",
  "example-sentence": "Example Sentences",
  "tts": "Text-to-Speech",
  "story-tutor": "Story Tutor",
  "tutor": "AI Tutor",
};

// Build a reusable createdAt filter from optional ISO start/end params, so the
// shared admin date control applies to per-user cost numbers too. Empty object
// when neither is set ("all time").
function parseCreatedAtFilter(searchParams: URLSearchParams): { gte?: Date; lte?: Date } {
  const start = searchParams.get("startDate");
  const end = searchParams.get("endDate");
  const filter: { gte?: Date; lte?: Date } = {};
  if (start) filter.gte = new Date(start);
  if (end) filter.lte = new Date(end);
  return filter;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const createdAtFilter = parseCreatedAtFilter(searchParams);

    // If userId is provided, return detailed user info with stories
    if (userId) {
      return getUserDetails(userId, createdAtFilter);
    }

    // Otherwise, return summary of all users with costs
    return getUsersSummary(createdAtFilter);
  } catch (error) {
    console.error("Failed to fetch user data:", error);
    return NextResponse.json(
      { error: "Failed to fetch user data" },
      { status: 500 }
    );
  }
}

async function getUsersSummary(createdAtFilter: { gte?: Date; lte?: Date }) {
  const hasDateFilter = Object.keys(createdAtFilter).length > 0;
  const apiCostWhere = hasDateFilter ? { createdAt: createdAtFilter } : undefined;
  // Get reading time per user
  const readingTimeByUser = await prisma.sessionLog.groupBy({
    by: ["userId"],
    where: { type: "reading" },
    _sum: { ms: true },
  });

  const readingMsMap = new Map(
    readingTimeByUser.map((r) => [r.userId, r._sum.ms || 0])
  );

  // Per-user engagement: count of distinct calendar days the user had a session
  // (any type) PLUS last-active timestamp. Computed server-side via raw SQL
  // because Prisma's groupBy can't COUNT(DISTINCT DATE(...)). We get the raw
  // active-day count here and subtract the signup day per-user below to derive
  // "return days" (days they came back).
  const engagementByUser = await prisma.$queryRaw<
    { userId: string; distinctActiveDays: bigint; lastActiveAt: Date | null }[]
  >`
    SELECT
      "userId",
      COUNT(DISTINCT DATE("createdAt")) AS "distinctActiveDays",
      MAX("createdAt") AS "lastActiveAt"
    FROM "SessionLog"
    GROUP BY "userId"
  `;
  const engagementMap = new Map(
    engagementByUser.map((r) => [
      r.userId,
      { distinctActiveDays: Number(r.distinctActiveDays), lastActiveAt: r.lastActiveAt },
    ])
  );

  // Get all users
  const usersWithCosts = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      nativeLanguage: true,
      quizLevel: true,
      isPremium: true,
      createdAt: true,
      deletedAt: true,
      UserStory: {
        select: { id: true },
      },
      ApiCost: {
        where: apiCostWhere,
        select: { costCents: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const users = usersWithCosts.map((user, index) => {
    const totalCostCents = user.ApiCost.reduce(
      (sum, cost) => sum + cost.costCents,
      0
    );
    const engagement = engagementMap.get(user.id);
    const lastActiveAt = engagement?.lastActiveAt ?? null;
    // Return days = distinct active days MINUS the signup day. So a user who only
    // ever used the app on signup day has 0 return days; a user who came back on
    // 3 other days has 3 return days. "isReturning" is just returnDays > 0.
    const rawActiveDays = engagement?.distinctActiveDays ?? 0;
    const distinctReturnDays = Math.max(0, rawActiveDays - 1);
    const isReturning = distinctReturnDays > 0;
    return {
      id: user.id,
      userNumber: index + 1,
      name: user.name,
      email: user.email,
      phone: user.phone,
      nativeLanguage: user.nativeLanguage,
      quizLevel: user.quizLevel,
      isPremium: user.isPremium,
      createdAt: user.createdAt.toISOString(),
      deletedAt: user.deletedAt?.toISOString() || null,
      readingMs: readingMsMap.get(user.id) || 0,
      distinctReturnDays,
      lastActiveAt: lastActiveAt ? lastActiveAt.toISOString() : null,
      isReturning,
      storyCount: user.UserStory.length,
      totalCostCents,
      avgCostPerStory:
        user.UserStory.length > 0
          ? Math.round(totalCostCents / user.UserStory.length)
          : 0,
    };
  });

  // Exclude admin/test accounts and deleted users from summary averages.
  // - cmcwccvsd0000ja6065zucooe = philipwooleryprice@gmail.com (founder/admin)
  // - cmoyrzj8n0000kt0478katy1u = test_inngest1@email.com (Inngest pipeline test account)
  const EXCLUDED_USER_IDS = [
    "cmcwccvsd0000ja6065zucooe",
    "cmoyrzj8n0000kt0478katy1u",
  ];
  const nonExcludedUsers = users.filter(
    (u) => !EXCLUDED_USER_IDS.includes(u.id) && !u.deletedAt
  );
  const activeUsers = users.filter((u) => !u.deletedAt);

  // Calculate totals (excluding test accounts for cost/usage stats; deleted users excluded from count)
  const totalUsers = activeUsers.length;
  const totalStories = nonExcludedUsers.reduce((sum, u) => sum + u.storyCount, 0);
  const totalCostCents = nonExcludedUsers.reduce((sum, u) => sum + u.totalCostCents, 0);
  const avgCostPerUser =
    totalUsers > 0 ? Math.round(totalCostCents / totalUsers) : 0;
  // Avg per story also excludes test accounts so the per-story figure isn't
  // skewed by the founder/test-account uploads (which often have unusual cost
  // profiles from re-running pipelines during development).
  const avgCostPerStory =
    totalStories > 0 ? Math.round(totalCostCents / totalStories) : 0;

  // Current month's costs (resets each month)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthCosts = await prisma.apiCost.aggregate({
    where: {
      createdAt: { gte: monthStart },
      userId: { notIn: EXCLUDED_USER_IDS },
    },
    _sum: { costCents: true },
  });
  const monthCostCents = monthCosts._sum.costCents || 0;

  return NextResponse.json({
    summary: {
      totalUsers,
      totalStories,
      totalCostCents,
      avgCostPerUser,
      avgCostPerStory,
      monthCostCents,
    },
    users,
  });
}

async function getUserDetails(userId: string, createdAtFilter: { gte?: Date; lte?: Date }) {
  // Apply the shared date range to this user's cost queries so the per-student
  // breakdown matches whatever window the admin selected. Spread into where.
  const hasDateFilter = Object.keys(createdAtFilter).length > 0;
  const dateWhere = hasDateFilter ? { createdAt: createdAtFilter } : {};

  // Get user info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Get user's existing stories with word counts
  const stories = await prisma.userStory.findMany({
    where: { userId },
    select: {
      id: true,
      title: true,
      storyType: true,
      status: true,
      rawContent: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const storyIdArray = stories.map((s) => s.id);

  // Get costs for existing stories
  const existingStoryCosts = storyIdArray.length > 0
    ? await prisma.apiCost.groupBy({
        by: ["userStoryId"],
        where: {
          ...dateWhere,
          userStoryId: { in: storyIdArray },
        },
        _sum: { costCents: true },
      })
    : [];

  // Build cost map for existing stories
  const storyCostMap = new Map(
    existingStoryCosts.map((c) => [c.userStoryId, c._sum.costCents || 0])
  );

  // Get total costs for this user (includes deleted stories, tutor, etc.)
  const totalUserCosts = await prisma.apiCost.aggregate({
    where: { userId, ...dateWhere },
    _sum: { costCents: true },
  });

  // Get deleted stories data
  const deletedStoriesData = await prisma.deletedUserStory.aggregate({
    where: { userId },
    _sum: { costCents: true },
    _count: true,
  });
  const deletedStoryCount = deletedStoriesData._count;
  const deletedStoryCostCents = deletedStoriesData._sum.costCents || 0;

  // Get in-story usage costs grouped by operation
  const inStoryCosts = await prisma.apiCost.groupBy({
    by: ["operation"],
    where: {
      userId,
      ...dateWhere,
      operation: { in: IN_STORY_OPERATIONS },
    },
    _sum: { costCents: true },
    _count: true,
  });

  const inStoryBreakdown = inStoryCosts.map((c) => ({
    operation: c.operation,
    label: OPERATION_LABELS[c.operation] || c.operation,
    costCents: c._sum.costCents || 0,
    count: c._count,
  }));
  const inStoryTotalCostCents = inStoryBreakdown.reduce(
    (sum, b) => sum + b.costCents,
    0
  );

  // Get tutor costs grouped by operation
  const tutorCosts = await prisma.apiCost.groupBy({
    by: ["operation"],
    where: {
      userId,
      ...dateWhere,
      operation: { in: TUTOR_OPERATIONS },
    },
    _sum: { costCents: true },
    _count: true,
  });

  const tutorBreakdown = tutorCosts.map((c) => ({
    operation: c.operation,
    label: OPERATION_LABELS[c.operation] || c.operation,
    costCents: c._sum.costCents || 0,
    count: c._count,
  }));
  const tutorTotalCostCents = tutorBreakdown.reduce(
    (sum, b) => sum + b.costCents,
    0
  );

  // Get tutor message count
  const tutorMessageCount = await prisma.tutorMessage.count({
    where: { userId },
  });

  // Get per-story reading time
  const readingTimeByStory = await prisma.sessionLog.groupBy({
    by: ["storySlug"],
    where: {
      userId,
      type: "reading",
      storySlug: { not: null },
    },
    _sum: { ms: true },
  });

  // Get total reading time (including sessions without storySlug)
  const totalReadingTime = await prisma.sessionLog.aggregate({
    where: { userId, type: "reading" },
    _sum: { ms: true },
  });

  // Build story data for existing stories
  const storyData = stories.map((story) => {
    const wordCount = countWords(story.rawContent);
    const costCents = storyCostMap.get(story.id) || 0;
    return {
      id: story.id,
      title: story.title,
      storyType: story.storyType,
      status: story.status,
      wordCount,
      costCents,
      costPerThousandWords:
        wordCount > 0 ? Math.round((costCents / wordCount) * 1000) : 0,
      createdAt: story.createdAt.toISOString(),
    };
  });

  // Calculate totals
  const totalExistingStories = storyData.length;
  const totalWords = storyData.reduce((sum, s) => sum + s.wordCount, 0);
  const existingStoryCostTotal = storyData.reduce((sum, s) => sum + s.costCents, 0);
  // ApiCost records are deleted when a story is deleted, so add back deleted story costs
  const totalCostCents = (totalUserCosts._sum.costCents || 0) + deletedStoryCostCents;

  // Total story cost = existing + deleted
  const allStoryCostCents = existingStoryCostTotal + deletedStoryCostCents;
  // Total story count = existing + deleted (for accurate averages)
  const allStoryCount = totalExistingStories + deletedStoryCount;

  // Other costs = total - story uploads - in-story - tutor (avoids double-counting)
  const otherCostCents = totalCostCents - allStoryCostCents - inStoryTotalCostCents - tutorTotalCostCents;

  return NextResponse.json({
    user: {
      ...user,
      createdAt: user.createdAt.toISOString(),
    },
    summary: {
      totalStories: totalExistingStories,
      deletedStoryCount,
      deletedStoryCostCents,
      totalWords,
      totalCostCents,
      storyCostCents: existingStoryCostTotal,
      otherCostCents,
      avgWordsPerStory:
        totalExistingStories > 0 ? Math.round(totalWords / totalExistingStories) : 0,
      // Use all story count (existing + deleted) for accurate average
      avgCostPerStory:
        allStoryCount > 0
          ? Math.round(allStoryCostCents / allStoryCount)
          : 0,
      avgCostPerThousandWords:
        totalWords > 0 ? Math.round((existingStoryCostTotal / totalWords) * 1000) : 0,
    },
    stories: storyData,
    inStoryUsage: {
      totalCostCents: inStoryTotalCostCents,
      breakdown: inStoryBreakdown,
    },
    tutorUsage: {
      totalCostCents: tutorTotalCostCents,
      messageCount: tutorMessageCount,
      breakdown: tutorBreakdown,
    },
    readingTime: {
      totalMs: totalReadingTime._sum.ms || 0,
      byStory: readingTimeByStory
        .map((r) => ({
          storySlug: r.storySlug as string,
          ms: r._sum.ms || 0,
        }))
        .sort((a, b) => b.ms - a.ms),
    },
  });
}
