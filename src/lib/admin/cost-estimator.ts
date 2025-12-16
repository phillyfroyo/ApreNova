// src/lib/admin/cost-estimator.ts
// Cost estimation for admin pipeline API calls

// ============================================================================
// Pricing Constants (as of 2025)
// ============================================================================

/**
 * GPT-4o pricing per 1M tokens
 * Used for: Level rewriting, metadata generation
 */
const GPT4O_PRICING = {
  input: 2.50, // $2.50 per 1M input tokens
  output: 10.00, // $10.00 per 1M output tokens
};

/**
 * GPT-4o-mini pricing per 1M tokens
 * Used for: Level detection
 */
const GPT4O_MINI_PRICING = {
  input: 0.15, // $0.15 per 1M input tokens
  output: 0.60, // $0.60 per 1M output tokens
};

/**
 * Claude Haiku 4.5 pricing per 1M tokens
 * Used for: Translation
 */
const CLAUDE_HAIKU_PRICING = {
  input: 1.00, // $1.00 per 1M input tokens
  output: 5.00, // $5.00 per 1M output tokens
};

/**
 * DALL-E 3 pricing per image
 * Used for: Thumbnail and background generation
 */
const DALLE3_PRICING = {
  standard_1024x1024: 0.040, // $0.040 per image
  standard_1024x1792: 0.080, // $0.080 per image (portrait - thumbnails)
  standard_1792x1024: 0.080, // $0.080 per image (landscape - backgrounds)
  hd_1024x1024: 0.080,
  hd_1024x1792: 0.120,
  hd_1792x1024: 0.120,
};

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Rough token estimation based on character count
 * English text: ~4 characters per token
 * Spanish text: ~4.5 characters per token (slightly more due to diacritics)
 */
export function estimateTokens(text: string, language: "en" | "es" = "en"): number {
  const charsPerToken = language === "es" ? 4.5 : 4;
  return Math.ceil(text.length / charsPerToken);
}

/**
 * Estimate tokens for a text with prompt overhead
 * System prompts and instructions add ~500-1000 tokens typically
 */
export function estimateTokensWithOverhead(
  text: string,
  language: "en" | "es" = "en",
  promptOverhead: number = 500
): number {
  return estimateTokens(text, language) + promptOverhead;
}

// ============================================================================
// Types
// ============================================================================

export interface LevelCostEstimate {
  level: number;
  mode: "generate" | "use-original" | "omit";
  rewriteTokens: { input: number; output: number };
  translateTokens: { input: number; output: number };
  rewriteCost: number;
  translateCost: number;
  totalCost: number;
}

export interface ImageCostEstimate {
  type: "thumbnail" | "background";
  count: number;
  costPerImage: number;
  totalCost: number;
}

export interface CostEstimate {
  levels: LevelCostEstimate[];
  images: ImageCostEstimate[];
  detection: {
    tokens: { input: number; output: number };
    cost: number;
  };
  metadata: {
    tokens: { input: number; output: number };
    cost: number;
  };
  totals: {
    rewriteCost: number;
    translateCost: number;
    imageCost: number;
    otherCost: number;
    totalCost: number;
    totalInputTokens: number;
    totalOutputTokens: number;
  };
  warnings: string[];
}

export interface CostEstimateOptions {
  /** Raw text content */
  rawText: string;
  /** Source language */
  sourceLanguage: "en" | "es";
  /** Detected source level (1-5) */
  sourceLevel: number;
  /** Levels to generate with their modes */
  levelModes: Record<number, "generate" | "use-original" | "omit">;
  /** Whether to generate thumbnail */
  generateThumbnail: boolean;
  /** Whether to generate background */
  generateBackground: boolean;
  /** Whether to generate metadata (title, description) */
  generateMetadata: boolean;
  /** Number of chapters (affects chunking) */
  chapterCount?: number;
}

// ============================================================================
// Cost Calculation Functions
// ============================================================================

/**
 * Calculate cost for a given number of tokens
 */
function calculateCost(
  inputTokens: number,
  outputTokens: number,
  pricing: { input: number; output: number }
): number {
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * Estimate rewrite cost for a level
 * Rewriting typically produces similar-length output
 */
function estimateRewriteCost(
  text: string,
  sourceLevel: number,
  targetLevel: number,
  language: "en" | "es"
): { input: number; output: number; cost: number } {
  // If target equals source, no rewriting needed
  if (targetLevel === sourceLevel) {
    return { input: 0, output: 0, cost: 0 };
  }

  const textTokens = estimateTokens(text, language);
  const promptOverhead = 800; // System prompt + instructions

  const inputTokens = textTokens + promptOverhead;
  // Output is typically similar length to input text, maybe slightly shorter for lower levels
  const outputTokens = Math.ceil(textTokens * (targetLevel <= 2 ? 0.85 : 0.95));

  return {
    input: inputTokens,
    output: outputTokens,
    cost: calculateCost(inputTokens, outputTokens, GPT4O_PRICING),
  };
}

/**
 * Estimate translation cost for a level
 * Translation typically produces similar-length output
 */
function estimateTranslateCost(
  text: string,
  sourceLanguage: "en" | "es"
): { input: number; output: number; cost: number } {
  const textTokens = estimateTokens(text, sourceLanguage);
  const promptOverhead = 600; // System prompt + line numbering

  const inputTokens = textTokens + promptOverhead;
  // Spanish is typically 10-15% longer than English
  const outputMultiplier = sourceLanguage === "en" ? 1.12 : 0.90;
  const outputTokens = Math.ceil(textTokens * outputMultiplier);

  return {
    input: inputTokens,
    output: outputTokens,
    cost: calculateCost(inputTokens, outputTokens, CLAUDE_HAIKU_PRICING),
  };
}

// ============================================================================
// Main Estimation Function
// ============================================================================

/**
 * Generate a complete cost estimate for the pipeline
 */
export function estimateCosts(options: CostEstimateOptions): CostEstimate {
  const {
    rawText,
    sourceLanguage,
    sourceLevel,
    levelModes,
    generateThumbnail,
    generateBackground,
    generateMetadata,
    chapterCount = 1,
  } = options;

  const warnings: string[] = [];
  const levels: LevelCostEstimate[] = [];

  // Calculate per-level costs
  for (let level = 1; level <= 5; level++) {
    const mode = levelModes[level] || "omit";

    if (mode === "omit") {
      levels.push({
        level,
        mode,
        rewriteTokens: { input: 0, output: 0 },
        translateTokens: { input: 0, output: 0 },
        rewriteCost: 0,
        translateCost: 0,
        totalCost: 0,
      });
      continue;
    }

    // For "use-original", no rewriting but still need translation
    const rewrite = mode === "generate"
      ? estimateRewriteCost(rawText, sourceLevel, level, sourceLanguage)
      : { input: 0, output: 0, cost: 0 };

    // Translation is needed for all non-omitted levels
    const translate = estimateTranslateCost(rawText, sourceLanguage);

    // Multiply by chapter count for chunked processing
    const chapterMultiplier = Math.max(1, chapterCount);

    levels.push({
      level,
      mode,
      rewriteTokens: {
        input: rewrite.input * chapterMultiplier,
        output: rewrite.output * chapterMultiplier,
      },
      translateTokens: {
        input: translate.input * chapterMultiplier,
        output: translate.output * chapterMultiplier,
      },
      rewriteCost: rewrite.cost * chapterMultiplier,
      translateCost: translate.cost * chapterMultiplier,
      totalCost: (rewrite.cost + translate.cost) * chapterMultiplier,
    });
  }

  // Image costs
  const images: ImageCostEstimate[] = [];

  if (generateThumbnail) {
    // 2 thumbnail options generated
    images.push({
      type: "thumbnail",
      count: 2,
      costPerImage: DALLE3_PRICING.standard_1024x1792,
      totalCost: 2 * DALLE3_PRICING.standard_1024x1792,
    });
  }

  if (generateBackground) {
    // 2 background options generated
    images.push({
      type: "background",
      count: 2,
      costPerImage: DALLE3_PRICING.standard_1792x1024,
      totalCost: 2 * DALLE3_PRICING.standard_1792x1024,
    });
  }

  // Detection cost (GPT-4o-mini, very cheap)
  const detectionTokens = {
    input: estimateTokensWithOverhead(rawText.slice(0, 1500), sourceLanguage, 300),
    output: 100,
  };
  const detectionCost = calculateCost(
    detectionTokens.input,
    detectionTokens.output,
    GPT4O_MINI_PRICING
  );

  // Metadata generation cost (title + description, 3 options each)
  let metadataTokens = { input: 0, output: 0 };
  let metadataCost = 0;

  if (generateMetadata) {
    // Title generation
    const titleInput = estimateTokensWithOverhead(rawText.slice(0, 2000), sourceLanguage, 400);
    const titleOutput = 300; // 3 bilingual title options

    // Description generation
    const descInput = estimateTokensWithOverhead(rawText.slice(0, 2000), sourceLanguage, 400);
    const descOutput = 600; // 3 bilingual description options

    metadataTokens = {
      input: titleInput + descInput,
      output: titleOutput + descOutput,
    };
    metadataCost = calculateCost(metadataTokens.input, metadataTokens.output, GPT4O_PRICING);
  }

  // Calculate totals
  const rewriteCost = levels.reduce((sum, l) => sum + l.rewriteCost, 0);
  const translateCost = levels.reduce((sum, l) => sum + l.translateCost, 0);
  const imageCost = images.reduce((sum, i) => sum + i.totalCost, 0);
  const otherCost = detectionCost + metadataCost;
  const totalCost = rewriteCost + translateCost + imageCost + otherCost;

  const totalInputTokens =
    levels.reduce((sum, l) => sum + l.rewriteTokens.input + l.translateTokens.input, 0) +
    detectionTokens.input +
    metadataTokens.input;

  const totalOutputTokens =
    levels.reduce((sum, l) => sum + l.rewriteTokens.output + l.translateTokens.output, 0) +
    detectionTokens.output +
    metadataTokens.output;

  // Add warnings for high costs
  if (totalCost > 5) {
    warnings.push(`Estimated cost exceeds $5.00. Consider reducing levels or using "use-original" for some.`);
  }

  if (totalCost > 10) {
    warnings.push(`High cost warning: Estimated cost exceeds $10.00.`);
  }

  const activeLevelCount = levels.filter(l => l.mode !== "omit").length;
  if (activeLevelCount > 3 && rawText.length > 50000) {
    warnings.push(`Large text with many levels. Consider processing in batches.`);
  }

  return {
    levels,
    images,
    detection: {
      tokens: detectionTokens,
      cost: detectionCost,
    },
    metadata: {
      tokens: metadataTokens,
      cost: metadataCost,
    },
    totals: {
      rewriteCost,
      translateCost,
      imageCost,
      otherCost,
      totalCost,
      totalInputTokens,
      totalOutputTokens,
    },
    warnings,
  };
}

// ============================================================================
// Formatting Helpers
// ============================================================================

/**
 * Format cost as currency string
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `<$0.01`;
  }
  return `$${cost.toFixed(2)}`;
}

/**
 * Format token count with K/M suffix
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}

/**
 * Get a brief summary of costs
 */
export function getCostSummary(estimate: CostEstimate): string {
  const { totals } = estimate;
  const parts: string[] = [];

  if (totals.rewriteCost > 0) {
    parts.push(`Rewrite: ${formatCost(totals.rewriteCost)}`);
  }
  if (totals.translateCost > 0) {
    parts.push(`Translate: ${formatCost(totals.translateCost)}`);
  }
  if (totals.imageCost > 0) {
    parts.push(`Images: ${formatCost(totals.imageCost)}`);
  }
  if (totals.otherCost > 0.01) {
    parts.push(`Other: ${formatCost(totals.otherCost)}`);
  }

  return parts.length > 0
    ? `${parts.join(" | ")} = ${formatCost(totals.totalCost)}`
    : "No costs estimated";
}

// Export pricing constants for reference
export const PRICING = {
  GPT4O: GPT4O_PRICING,
  GPT4O_MINI: GPT4O_MINI_PRICING,
  CLAUDE_HAIKU: CLAUDE_HAIKU_PRICING,
  DALLE3: DALLE3_PRICING,
};
