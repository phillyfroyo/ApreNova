// src/lib/cost-tracker.ts
// Tracks actual API costs to the database for monitoring and optimization

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// ============================================================================
// PRICING CONSTANTS (as of January 2025)
// Prices are per 1M tokens for LLMs, per image for DALL-E
// ============================================================================

export const PRICING = {
  // OpenAI Models
  "gpt-4o": {
    input: 2.50,    // $2.50 per 1M input tokens
    output: 10.00,  // $10.00 per 1M output tokens
  },
  "gpt-4o-mini": {
    input: 0.15,    // $0.15 per 1M input tokens
    output: 0.60,   // $0.60 per 1M output tokens
  },
  "dall-e-3": {
    "1024x1024": 0.040,
    "1024x1792": 0.080,  // Portrait - used for thumbnails
    "1792x1024": 0.080,  // Landscape - used for backgrounds
  },

  // Anthropic Models
  "claude-haiku-4-5-20251001": {
    input: 1.00,    // $1.00 per 1M input tokens
    output: 5.00,   // $5.00 per 1M output tokens
  },
  // Alias for shorter reference
  "claude-haiku": {
    input: 1.00,
    output: 5.00,
  },

  // Azure TTS (per 1M characters)
  "azure-tts-neural": {
    characters: 15.00,  // $15 per 1M characters
  },
} as const;

// ============================================================================
// TYPES
// ============================================================================

export type OperationType =
  | "detection"           // Language/level detection
  | "rewriting"           // CEFR level rewriting
  | "translation"         // Story translation
  | "metadata"            // Title/description/tags extraction
  | "thumbnail"           // DALL-E thumbnail generation
  | "tutor"               // General tutor chat
  | "story-tutor"         // Story-specific tutor
  | "translate-word"      // Single word translation
  | "translate-phrase"    // Phrase translation
  | "example-sentence"    // Example sentence generation
  | "tts"                 // Text-to-speech
  | "other";

export type Provider = "openai" | "anthropic" | "azure";

export interface CostLogEntry {
  operation: OperationType;
  provider: Provider;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  imageCount?: number;
  imageSize?: string;
  characters?: number;  // For TTS
  userId?: string | null;
  userStoryId?: string | null;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// COST CALCULATION
// ============================================================================

/**
 * Calculate cost in cents for LLM tokens
 */
function calculateLLMCostCents(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = PRICING[model as keyof typeof PRICING];
  if (!pricing || !("input" in pricing)) {
    console.warn(`[CostTracker] Unknown model pricing: ${model}`);
    return 0;
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  const totalDollars = inputCost + outputCost;

  // Convert to cents and round up to nearest cent
  return Math.ceil(totalDollars * 100);
}

/**
 * Calculate cost in cents for DALL-E images
 */
function calculateImageCostCents(
  imageCount: number,
  imageSize: string = "1024x1792"
): number {
  const pricing = PRICING["dall-e-3"];
  const pricePerImage = pricing[imageSize as keyof typeof pricing] || pricing["1024x1792"];
  const totalDollars = imageCount * pricePerImage;
  return Math.ceil(totalDollars * 100);
}

/**
 * Calculate cost in cents for TTS characters
 */
function calculateTTSCostCents(characters: number): number {
  const pricing = PRICING["azure-tts-neural"];
  const totalDollars = (characters / 1_000_000) * pricing.characters;
  return Math.ceil(totalDollars * 100);
}

// ============================================================================
// MAIN LOGGING FUNCTION
// ============================================================================

/**
 * Log an API cost to the database
 * This is fire-and-forget - errors are logged but don't throw
 */
export async function logApiCost(entry: CostLogEntry): Promise<void> {
  try {
    let costCents = 0;

    // Calculate cost based on what data we have
    if (entry.inputTokens !== undefined || entry.outputTokens !== undefined) {
      costCents = calculateLLMCostCents(
        entry.model,
        entry.inputTokens || 0,
        entry.outputTokens || 0
      );
    } else if (entry.imageCount !== undefined) {
      costCents = calculateImageCostCents(entry.imageCount, entry.imageSize);
    } else if (entry.characters !== undefined) {
      costCents = calculateTTSCostCents(entry.characters);
    }

    await prisma.apiCost.create({
      data: {
        operation: entry.operation,
        provider: entry.provider,
        model: entry.model,
        inputTokens: entry.inputTokens || 0,
        outputTokens: entry.outputTokens || 0,
        imageCount: entry.imageCount || 0,
        costCents,
        userId: entry.userId || null,
        userStoryId: entry.userStoryId || null,
        metadata: (entry.metadata as Prisma.InputJsonValue) || undefined,
      },
    });

    // Log for debugging (can be removed in production)
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[CostTracker] ${entry.operation} | ${entry.model} | ` +
        `$${(costCents / 100).toFixed(4)} | ` +
        `in:${entry.inputTokens || 0} out:${entry.outputTokens || 0} | ` +
        `story:${entry.userStoryId?.slice(0, 8) || "NULL"} user:${entry.userId?.slice(0, 8) || "NULL"}`
      );
    }
  } catch (error) {
    // Log error but don't throw - cost tracking shouldn't break the app
    console.error("[CostTracker] Failed to log cost:", error);
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS FOR EACH PROVIDER
// ============================================================================

/**
 * Log OpenAI chat completion cost
 */
export async function logOpenAICost(
  operation: OperationType,
  model: string,
  usage: { prompt_tokens?: number; completion_tokens?: number } | undefined,
  context?: { userId?: string | null; userStoryId?: string | null; metadata?: Record<string, unknown> }
): Promise<void> {
  if (!usage) return;

  await logApiCost({
    operation,
    provider: "openai",
    model,
    inputTokens: usage.prompt_tokens || 0,
    outputTokens: usage.completion_tokens || 0,
    userId: context?.userId,
    userStoryId: context?.userStoryId,
    metadata: context?.metadata,
  });
}

/**
 * Log Anthropic message cost
 */
export async function logAnthropicCost(
  operation: OperationType,
  model: string,
  usage: { input_tokens?: number; output_tokens?: number } | undefined,
  context?: { userId?: string | null; userStoryId?: string | null; metadata?: Record<string, unknown> }
): Promise<void> {
  if (!usage) return;

  await logApiCost({
    operation,
    provider: "anthropic",
    model: model.includes("haiku") ? "claude-haiku" : model,
    inputTokens: usage.input_tokens || 0,
    outputTokens: usage.output_tokens || 0,
    userId: context?.userId,
    userStoryId: context?.userStoryId,
    metadata: context?.metadata,
  });
}

/**
 * Log DALL-E image generation cost
 */
export async function logDalleCost(
  operation: OperationType,
  imageCount: number,
  imageSize: string = "1024x1792",
  context?: { userId?: string | null; userStoryId?: string | null; metadata?: Record<string, unknown> }
): Promise<void> {
  await logApiCost({
    operation,
    provider: "openai",
    model: "dall-e-3",
    imageCount,
    imageSize,
    userId: context?.userId,
    userStoryId: context?.userStoryId,
    metadata: context?.metadata,
  });
}

/**
 * Log Azure TTS cost
 */
export async function logTTSCost(
  characters: number,
  context?: { userId?: string | null; metadata?: Record<string, unknown> }
): Promise<void> {
  await logApiCost({
    operation: "tts",
    provider: "azure",
    model: "azure-tts-neural",
    characters,
    userId: context?.userId,
    metadata: context?.metadata,
  });
}

// ============================================================================
// QUERY HELPERS (for admin dashboard)
// ============================================================================

/**
 * Get total costs for a user
 */
export async function getUserTotalCosts(userId: string): Promise<{
  totalCents: number;
  byOperation: Record<string, number>;
}> {
  const costs = await prisma.apiCost.groupBy({
    by: ["operation"],
    where: { userId },
    _sum: { costCents: true },
  });

  const byOperation: Record<string, number> = {};
  let totalCents = 0;

  for (const cost of costs) {
    const cents = cost._sum.costCents || 0;
    byOperation[cost.operation] = cents;
    totalCents += cents;
  }

  return { totalCents, byOperation };
}

/**
 * Get total costs for a user story
 */
export async function getStoryTotalCosts(userStoryId: string): Promise<{
  totalCents: number;
  byOperation: Record<string, number>;
}> {
  const costs = await prisma.apiCost.groupBy({
    by: ["operation"],
    where: { userStoryId },
    _sum: { costCents: true },
  });

  const byOperation: Record<string, number> = {};
  let totalCents = 0;

  for (const cost of costs) {
    const cents = cost._sum.costCents || 0;
    byOperation[cost.operation] = cents;
    totalCents += cents;
  }

  return { totalCents, byOperation };
}

/**
 * Get costs summary for a date range
 */
export async function getCostsSummary(
  startDate: Date,
  endDate: Date
): Promise<{
  totalCents: number;
  byProvider: Record<string, number>;
  byOperation: Record<string, number>;
  byModel: Record<string, number>;
}> {
  const costs = await prisma.apiCost.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      operation: true,
      provider: true,
      model: true,
      costCents: true,
    },
  });

  const byProvider: Record<string, number> = {};
  const byOperation: Record<string, number> = {};
  const byModel: Record<string, number> = {};
  let totalCents = 0;

  for (const cost of costs) {
    totalCents += cost.costCents;
    byProvider[cost.provider] = (byProvider[cost.provider] || 0) + cost.costCents;
    byOperation[cost.operation] = (byOperation[cost.operation] || 0) + cost.costCents;
    byModel[cost.model] = (byModel[cost.model] || 0) + cost.costCents;
  }

  return { totalCents, byProvider, byOperation, byModel };
}

/**
 * Format cents as dollar string
 */
export function formatCents(cents: number): string {
  const dollars = cents / 100;
  if (dollars < 0.01) return "<$0.01";
  return `$${dollars.toFixed(2)}`;
}
