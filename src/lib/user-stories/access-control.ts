// src/lib/user-stories/access-control.ts

import { prisma } from "@/lib/prisma";
import { USER_STORY_LIMITS } from "./limits";

export interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
  currentCount?: number;
  maxCount?: number;
}

/**
 * Check if user can create a new story based on their tier limits
 */
export async function canCreateStory(
  userId: string,
  isPremium: boolean
): Promise<AccessCheckResult> {
  const storyCount = await prisma.userStory.count({
    where: { userId },
  });

  const maxStories = isPremium
    ? USER_STORY_LIMITS.PREMIUM_MAX_STORIES
    : USER_STORY_LIMITS.FREE_MAX_STORIES;

  // -1 means unlimited
  if (maxStories !== -1 && storyCount >= maxStories) {
    return {
      allowed: false,
      reason: isPremium
        ? "You have reached the maximum number of stories."
        : "Free tier limit reached. Upgrade to Premium for unlimited stories.",
      currentCount: storyCount,
      maxCount: maxStories,
    };
  }

  return {
    allowed: true,
    currentCount: storyCount,
    maxCount: maxStories,
  };
}

/**
 * Check if user can process a story today based on daily limits
 */
export async function canProcessToday(
  userId: string,
  isPremium: boolean
): Promise<AccessCheckResult> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const processedToday = await prisma.userStory.count({
    where: {
      userId,
      createdAt: { gte: today },
    },
  });

  const limit = isPremium
    ? USER_STORY_LIMITS.DAILY_PROCESSING_LIMIT_PREMIUM
    : USER_STORY_LIMITS.DAILY_PROCESSING_LIMIT_FREE;

  if (processedToday >= limit) {
    return {
      allowed: false,
      reason: isPremium
        ? `You've reached your daily limit of ${limit} stories. Try again tomorrow.`
        : "Free users can process 1 story per day. Upgrade to Premium for more.",
      currentCount: processedToday,
      maxCount: limit,
    };
  }

  return {
    allowed: true,
    currentCount: processedToday,
    maxCount: limit,
  };
}

/**
 * Check if content length is within limits
 *
 * Free tier logic:
 * - First story of the month: up to 2M characters (one free large upload)
 * - Subsequent stories: up to 5K characters
 *
 * @param content - The story content
 * @param isPremium - Whether user has premium subscription
 * @param isFirstStoryThisMonth - Whether this is the user's first story this calendar month
 */
export function validateContentLength(
  content: string,
  isPremium: boolean,
  isFirstStoryThisMonth: boolean = false
): AccessCheckResult {
  let maxLength: number;

  if (isPremium) {
    maxLength = USER_STORY_LIMITS.PREMIUM_MAX_STORY_LENGTH;
  } else if (isFirstStoryThisMonth) {
    // Free tier: first story of the month gets large upload allowance
    maxLength = USER_STORY_LIMITS.FREE_FIRST_MONTHLY_STORY_LENGTH;
  } else {
    maxLength = USER_STORY_LIMITS.FREE_MAX_STORY_LENGTH;
  }

  const currentLength = content.length;

  if (currentLength > maxLength) {
    let reason: string;
    if (isPremium) {
      reason = `Story exceeds maximum length of ${maxLength.toLocaleString()} characters.`;
    } else if (isFirstStoryThisMonth) {
      reason = `Story exceeds the maximum length of ${maxLength.toLocaleString()} characters.`;
    } else {
      reason = `Free users can upload one large story per month. Additional stories are limited to ${maxLength.toLocaleString()} characters. Upgrade to Premium for unlimited large uploads.`;
    }

    return {
      allowed: false,
      reason,
      currentCount: currentLength,
      maxCount: maxLength,
    };
  }

  if (currentLength < 100) {
    return {
      allowed: false,
      reason: "Story is too short. Please provide at least 100 characters.",
      currentCount: currentLength,
      maxCount: maxLength,
    };
  }

  return {
    allowed: true,
    currentCount: currentLength,
    maxCount: maxLength,
  };
}

/**
 * Check if this is the user's first story this calendar month
 */
export async function isFirstStoryThisMonth(userId: string): Promise<boolean> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const storiesThisMonth = await prisma.userStory.count({
    where: {
      userId,
      createdAt: { gte: startOfMonth },
    },
  });

  return storiesThisMonth === 0;
}

/**
 * Get user's story usage statistics
 */
export async function getUserStoryStats(userId: string, isPremium: boolean) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfDay = new Date(now.setHours(0, 0, 0, 0));

  const [totalStories, storiesProcessedToday, storiesThisMonth] = await Promise.all([
    prisma.userStory.count({ where: { userId } }),
    prisma.userStory.count({
      where: {
        userId,
        createdAt: { gte: startOfDay },
      },
    }),
    prisma.userStory.count({
      where: {
        userId,
        createdAt: { gte: startOfMonth },
      },
    }),
  ]);

  const firstStoryThisMonth = storiesThisMonth === 0;

  // Determine max story length based on tier and monthly usage
  let maxStoryLength: number;
  if (isPremium) {
    maxStoryLength = USER_STORY_LIMITS.PREMIUM_MAX_STORY_LENGTH;
  } else if (firstStoryThisMonth) {
    maxStoryLength = USER_STORY_LIMITS.FREE_FIRST_MONTHLY_STORY_LENGTH;
  } else {
    maxStoryLength = USER_STORY_LIMITS.FREE_MAX_STORY_LENGTH;
  }

  return {
    totalStories,
    maxStories: isPremium
      ? USER_STORY_LIMITS.PREMIUM_MAX_STORIES
      : USER_STORY_LIMITS.FREE_MAX_STORIES,
    storiesProcessedToday,
    dailyLimit: isPremium
      ? USER_STORY_LIMITS.DAILY_PROCESSING_LIMIT_PREMIUM
      : USER_STORY_LIMITS.DAILY_PROCESSING_LIMIT_FREE,
    maxStoryLength,
    isFirstStoryThisMonth: firstStoryThisMonth,
    isPremium,
  };
}
