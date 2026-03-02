// src/lib/admin/cost-estimator.ts
// Cost estimation for admin pipeline API calls
//
// NOTE: Core cost estimation functionality is now in the shared library at
// @/lib/story-processing/cost-estimation.ts
// This file re-exports everything for backward compatibility with existing admin code.

export {
  // Pricing constants
  GPT4O_PRICING,
  GPT4O_MINI_PRICING,
  CLAUDE_HAIKU_PRICING,
  DALLE3_PRICING,
  PRICING,
  // Token estimation
  estimateTokens,
  estimateTokensWithOverhead,
  // Cost estimation
  estimateCosts,
  estimateUserStoryCost,
  // Formatting
  formatCost,
  formatTokens,
  getCostSummary,
  // Types
  type LevelCostEstimate,
  type ImageCostEstimate,
  type CostEstimate,
  type CostEstimateOptions,
  type SimpleCostEstimateOptions,
} from "@/lib/story-processing/cost-estimation";
