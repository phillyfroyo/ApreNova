// src/lib/story-processing/index.ts
// Shared story processing library
// Used by both admin and user story pipelines

// CEFR prompts and level utilities
export {
  CEFR_LEVELS,
  type CEFRLevel,
  levelStringToNumber,
  levelNumberToString,
  generateRewritePrompt,
  generateTranslationPrompt,
  generateDetectionPrompt,
} from "./cefr-prompts";

// Translation utilities (uses Claude Haiku)
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

// Rewriting utilities (uses GPT-4)
export {
  isErrorResponse,
  stripPreamble,
  rewriteToLevel,
  type RewriteResult,
} from "./rewriting";

// Detection utilities
export {
  detectLanguage,
  detectCEFRLevel,
  type CEFRDetectionResult,
} from "./detection";

// Text processing utilities
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
