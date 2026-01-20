// src/lib/user-stories/limits.ts

export const USER_STORY_LIMITS = {
  // Story count limits
  FREE_MAX_STORIES: -1, // -1 means unlimited
  PREMIUM_MAX_STORIES: -1, // -1 means unlimited (Infinity doesn't serialize to JSON)

  // Character limits per story
  // Free tier: One large upload (2M chars) per month, then 5K limit
  FREE_FIRST_MONTHLY_STORY_LENGTH: 2000000,
  FREE_MAX_STORY_LENGTH: 2000000, // Was: 5000 - TODO: REVERT FOR PRODUCTION
  PREMIUM_MAX_STORY_LENGTH: 2000000,

  // Daily processing limits
  // Note: Free tier has unlimited small uploads (< 5K chars), so this only applies to large uploads
  // which are already limited to 1/month. Setting to -1 (unlimited) for free tier.
  DAILY_PROCESSING_LIMIT_FREE: -1, // -1 means unlimited (free tier has monthly large story limit instead)
  DAILY_PROCESSING_LIMIT_PREMIUM: -1, // -1 means unlimited

  // Rate limits for AI calls (milliseconds)
  MIN_DELAY_BETWEEN_AI_CALLS_MS: 2000,

  // Pagination settings
  LINES_PER_PAGE: 10,
  MIN_LINES_PER_PAGE: 5,
  MAX_LINES_PER_PAGE: 15,
} as const;

export type UserStoryLimits = typeof USER_STORY_LIMITS;

/**
 * Streaming pipeline limits for producer-consumer pattern.
 * Used when GPT rewrites and Claude translations run in parallel.
 */
export const STREAMING_LIMITS = {
  // Maximum chapters that can be queued awaiting translation.
  // Prevents unbounded memory growth with huge books.
  MAX_QUEUE_SIZE: 20,

  // If queue reaches this size, producer (GPT) slows down.
  // Gives Claude time to catch up.
  QUEUE_BACKPRESSURE_THRESHOLD: 15,

  // Producer waits this long (ms) when queue is full.
  QUEUE_FULL_WAIT_MS: 5000,
} as const;

export type StreamingLimits = typeof STREAMING_LIMITS;
