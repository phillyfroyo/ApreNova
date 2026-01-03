// src/lib/story-processing/index.ts
// Shared story processing library
// Used by both admin and user story pipelines

// ============================================================================
// PROCESSING CONFIGURATION (shared constants, chunking, error handling)
// ============================================================================

export {
  // Chunking
  MAX_CHUNK_CHARS,
  DEFAULT_LINES_PER_PAGE,
  splitIntoSubChunks,
  reassembleChunks,
  // Retry configuration
  RETRY_CONFIG,
  BATCH_CONFIG,
  // Error handling
  type ProcessingErrorType,
  type ChunkError,
  categorizeError,
  isRetryableError,
  getRetryDelay,
  // File validation
  SUPPORTED_FILE_TYPES,
  ACCEPTED_EXTENSIONS,
  isAcceptedFile,
  detectFileType,
  type SupportedFileType,
  type DetectedFileType,
} from "./processing-config";

// ============================================================================
// COST ESTIMATION
// ============================================================================

export {
  // Pricing constants
  PRICING,
  GPT4O_PRICING,
  GPT4O_MINI_PRICING,
  CLAUDE_HAIKU_PRICING,
  DALLE3_PRICING,
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
} from "./cost-estimation";

// ============================================================================
// CEFR PROMPTS AND LEVEL UTILITIES
// ============================================================================

export {
  CEFR_LEVELS,
  type CEFRLevel,
  levelStringToNumber,
  levelNumberToString,
  generateRewritePrompt,
  generateTranslationPrompt,
  generateDetectionPrompt,
} from "./cefr-prompts";

// ============================================================================
// TRANSLATION (uses Claude Haiku)
// ============================================================================

export {
  addLineNumbers,
  parseNumberedLines,
  reconstructWithBlankLines,
  stripLineNumberPrefixes,
  detectTruncation,
  translateText,
  type TruncationResult,
  type TranslationResult,
} from "./translation";

// ============================================================================
// REWRITING (uses GPT-4)
// ============================================================================

export {
  isErrorResponse,
  stripPreamble,
  rewriteToLevel,
  type RewriteResult,
} from "./rewriting";

// ============================================================================
// DETECTION (language and CEFR level)
// ============================================================================

export {
  detectLanguage,
  detectCEFRLevel,
  type CEFRDetectionResult,
} from "./detection";

// ============================================================================
// TEXT PROCESSING
// ============================================================================

export {
  // Types
  type StoryLine,
  type PageContent,
  type ChapterContent,
  type LevelContent,
  type ChapterMetadata,
  type ParsedChapter,
  type ProcessedChapterData,
  // Functions
  isPageMarker,
  paginateLines,
  buildContentStructure,
  parseChapters,
  // Re-exports from admin
  preprocessText,
  quickClean,
  normalizeLineBreaks,
  detectLineBreakStyle,
  cleanText,
  parseChaptersFromText,
} from "./text-processing";
