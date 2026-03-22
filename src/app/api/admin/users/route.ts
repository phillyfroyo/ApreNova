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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    // If userId is provided, return detailed user info with stories
    if (userId) {
      return getUserDetails(userId);
    }

    // Otherwise, return summary of all users with costs
    return getUsersSummary();
  } catch (error) {
    console.error("Failed to fetch user data:", error);
    return NextResponse.json(
      { error: "Failed to fetch user data" },
      { status: 500 }
    );
  }
}

async function getUsersSummary() {
  // Get reading time per user
  const readingTimeByUser = await prisma.sessionLog.groupBy({
    by: ["userId"],
    where: { type: "reading" },
    _sum: { ms: true },
  });

  const readingMsMap = new Map(
    readingTimeByUser.map((r) => [r.userId, r._sum.ms || 0])
  );

  // Get all users
  const usersWithCosts = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      nativeLanguage: true,
      quizLevel: true,
      isPremium: true,
      createdAt: true,
      deletedAt: true,
      UserStory: {
        select: { id: true },
      },
      ApiCost: {
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
    return {
      id: user.id,
      userNumber: index + 1,
      name: user.name,
      email: user.email,
      nativeLanguage: user.nativeLanguage,
      quizLevel: user.quizLevel,
      isPremium: user.isPremium,
      createdAt: user.createdAt.toISOString(),
      deletedAt: user.deletedAt?.toISOString() || null,
      readingMs: readingMsMap.get(user.id) || 0,
      storyCount: user.UserStory.length,
      totalCostCents,
      avgCostPerStory:
        user.UserStory.length > 0
          ? Math.round(totalCostCents / user.UserStory.length)
          : 0,
    };
  });

  // Exclude admin/test account and deleted users from summary averages
  const EXCLUDED_USER_ID = "cmcwccvsd0000ja6065zucooe";
  const nonExcludedUsers = users.filter((u) => u.id !== EXCLUDED_USER_ID && !u.deletedAt);
  const activeUsers = users.filter((u) => !u.deletedAt);

  // Calculate totals (excluding test account for cost/usage stats; deleted users excluded from count)
  const totalUsers = activeUsers.length;
  const totalStories = nonExcludedUsers.reduce((sum, u) => sum + u.storyCount, 0);
  const totalCostCents = nonExcludedUsers.reduce((sum, u) => sum + u.totalCostCents, 0);
  const avgCostPerUser =
    totalUsers > 0 ? Math.round(totalCostCents / totalUsers) : 0;
  // Avg per story uses ALL users (including test account) since per-story cost is still useful
  const allStories = users.reduce((sum, u) => sum + u.storyCount, 0);
  const allCostCents = users.reduce((sum, u) => sum + u.totalCostCents, 0);
  const avgCostPerStory =
    allStories > 0 ? Math.round(allCostCents / allStories) : 0;

  // Current month's costs (resets each month)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthCosts = await prisma.apiCost.aggregate({
    where: {
      createdAt: { gte: monthStart },
      userId: { not: EXCLUDED_USER_ID },
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

async function getUserDetails(userId: string) {
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
    where: { userId },
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
