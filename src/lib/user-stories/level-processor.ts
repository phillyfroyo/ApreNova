// src/lib/user-stories/level-processor.ts
// Handles processing of a single CEFR level for a user story

import { USER_STORY_LIMITS } from "./limits";
import { LevelProgressTracker } from "./progress-tracker";
import {
  rewriteToLevel,
  translateText,
  parseChapters,
  buildContentStructure,
  quickClean,
  cleanText,
  levelStringToNumber,
} from "@/lib/story-processing";

// ============================================================================
// TYPES
// ============================================================================

export interface LevelProcessingParams {
  storyId: string;
  levelId: string;
  level: string;
  rawContent: string;
  sourceLanguage: "en" | "es";
  detectedLevel: string;
  storySlug: string;
}

export interface LevelProcessingResult {
  success: boolean;
  error?: string;
}

// ============================================================================
// DELAY HELPER
// ============================================================================

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ============================================================================
// LEVEL PROCESSOR
// ============================================================================

/**
 * Process a single level (rewrite if needed + translate + paginate)
 *
 * This function is the workhorse of the pipeline. For each level:
 * 1. Parse the text into chapters
 * 2. Rewrite each chapter to target level (if needed)
 * 3. Translate each chapter to the opposite language
 * 4. Build the final content structure with pagination
 */
export async function processLevel(
  params: LevelProcessingParams
): Promise<LevelProcessingResult> {
  const {
    levelId,
    level,
    rawContent,
    sourceLanguage,
    detectedLevel,
    storySlug,
  } = params;

  // Clean the text using shared utilities
  const cleanedContent = cleanText(quickClean(rawContent));

  // Parse chapters FIRST (before rewriting, to enable chunked processing)
  const { hasChapters, chapters: rawChapters } = parseChapters(cleanedContent);

  // Initialize progress tracker
  const tracker = new LevelProgressTracker(levelId, rawChapters.length);

  try {
    await tracker.startProcessing();

    // Step 1: Rewrite if needed
    const chapters = await rewriteChaptersIfNeeded(
      rawChapters,
      level,
      detectedLevel,
      sourceLanguage,
      tracker
    );

    // Step 2: Translate all chapters
    const processedChapters = await translateChapters(
      chapters,
      sourceLanguage,
      level,
      tracker
    );

    // Step 3: Build content structure
    const levelNum = levelStringToNumber(level);
    const content = buildContentStructure(
      storySlug,
      levelNum,
      hasChapters,
      processedChapters,
      sourceLanguage
    );

    // Step 4: Mark complete
    await tracker.markComplete(content);

    return { success: true };
  } catch (error: any) {
    console.error(`[LevelProcessor] Level ${level} failed:`, error.message);
    await tracker.markFailed();
    return { success: false, error: error.message };
  }
}

// ============================================================================
// REWRITING STAGE
// ============================================================================

/**
 * Rewrite chapters to target level if different from detected level
 */
async function rewriteChaptersIfNeeded(
  rawChapters: string[],
  targetLevel: string,
  detectedLevel: string,
  sourceLanguage: "en" | "es",
  tracker: LevelProgressTracker
): Promise<string[]> {
  const needsRewrite = targetLevel !== detectedLevel;

  if (!needsRewrite) {
    return rawChapters;
  }

  await tracker.startRewriting();
  const rewrittenChapters: string[] = [];

  for (let i = 0; i < rawChapters.length; i++) {
    const chapterText = rawChapters[i];

    // Update progress - starting this chapter
    await tracker.updateRewriteProgress(i + 1);

    // Rewrite this chapter
    const result = await rewriteToLevel(
      chapterText,
      detectedLevel,
      targetLevel,
      sourceLanguage
    );
    rewrittenChapters.push(result.rewrittenText);

    // Update progress with completed chapter data
    await tracker.updateRewriteProgress(i + 1, {
      originalLines: chapterText.split("\n").filter((l) => l.trim()),
      rewrittenLines: result.rewrittenText.split("\n").filter((l) => l.trim()),
    });

    await delay(USER_STORY_LIMITS.MIN_DELAY_BETWEEN_AI_CALLS_MS);
  }

  return rewrittenChapters;
}

// ============================================================================
// TRANSLATION STAGE
// ============================================================================

interface ProcessedChapter {
  sourceLines: string[];
  translatedLines: string[];
}

/**
 * Translate all chapters to the opposite language
 */
async function translateChapters(
  chapters: string[],
  sourceLanguage: "en" | "es",
  level: string,
  tracker: LevelProgressTracker
): Promise<ProcessedChapter[]> {
  await tracker.startTranslating();
  const processedChapters: ProcessedChapter[] = [];

  for (let i = 0; i < chapters.length; i++) {
    const chapterText = chapters[i];

    // Update progress - starting this chapter
    await tracker.updateTranslationProgress(i + 1);

    // Translate chapter
    const result = await translateText(chapterText, sourceLanguage, level);

    // Split into lines
    const sourceLines = chapterText.split("\n").filter((l) => l.trim());
    const translatedLines = result.translatedLines.filter((l) => l.trim());

    const chapterData = { sourceLines, translatedLines };
    processedChapters.push(chapterData);

    // Update progress with completed chapter data
    await tracker.updateTranslationProgress(i + 1, chapterData);

    await delay(USER_STORY_LIMITS.MIN_DELAY_BETWEEN_AI_CALLS_MS);
  }

  return processedChapters;
}
