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
 */
export function validateContentLength(
  content: string,
  isPremium: boolean
): AccessCheckResult {
  const maxLength = isPremium
    ? USER_STORY_LIMITS.PREMIUM_MAX_STORY_LENGTH
    : USER_STORY_LIMITS.FREE_MAX_STORY_LENGTH;

  const currentLength = content.length;

  if (currentLength > maxLength) {
    return {
      allowed: false,
      reason: isPremium
        ? `Story exceeds maximum length of ${maxLength.toLocaleString()} characters.`
        : `Free users can upload stories up to ${maxLength.toLocaleString()} characters. Upgrade to Premium for longer stories.`,
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
 * Get user's story usage statistics
 */
export async function getUserStoryStats(userId: string, isPremium: boolean) {
  const [totalStories, storiesProcessedToday] = await Promise.all([
    prisma.userStory.count({ where: { userId } }),
    prisma.userStory.count({
      where: {
        userId,
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
  ]);

  return {
    totalStories,
    maxStories: isPremium
      ? USER_STORY_LIMITS.PREMIUM_MAX_STORIES
      : USER_STORY_LIMITS.FREE_MAX_STORIES,
    storiesProcessedToday,
    dailyLimit: isPremium
      ? USER_STORY_LIMITS.DAILY_PROCESSING_LIMIT_PREMIUM
      : USER_STORY_LIMITS.DAILY_PROCESSING_LIMIT_FREE,
    maxStoryLength: isPremium
      ? USER_STORY_LIMITS.PREMIUM_MAX_STORY_LENGTH
      : USER_STORY_LIMITS.FREE_MAX_STORY_LENGTH,
    isPremium,
  };
}
