// src/lib/user-stories/limits.ts

export const USER_STORY_LIMITS = {
  // Story count limits
  FREE_MAX_STORIES: 3,
  PREMIUM_MAX_STORIES: -1, // -1 means unlimited (Infinity doesn't serialize to JSON)

  // Character limits per story
  FREE_MAX_STORY_LENGTH: 5000,
  PREMIUM_MAX_STORY_LENGTH: 2000000,

  // Daily processing limits
  DAILY_PROCESSING_LIMIT_FREE: 1,
  DAILY_PROCESSING_LIMIT_PREMIUM: 10,

  // Rate limits for AI calls (milliseconds)
  MIN_DELAY_BETWEEN_AI_CALLS_MS: 2000,

  // Pagination settings
  LINES_PER_PAGE: 10,
  MIN_LINES_PER_PAGE: 5,
  MAX_LINES_PER_PAGE: 15,
} as const;

export type UserStoryLimits = typeof USER_STORY_LIMITS;
