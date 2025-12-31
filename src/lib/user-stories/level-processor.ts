// src/lib/user-stories/level-processor.ts
// Handles processing of a single CEFR level for a user story

import { USER_STORY_LIMITS } from "./limits";
import { LevelProgressTracker, updateStoryProgress } from "./progress-tracker";
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
  userId: string;
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
    storyId,
    userId,
    levelId,
    level,
    rawContent,
    sourceLanguage,
    detectedLevel,
    storySlug,
  } = params;

  // Clean the text using shared utilities
  await updateStoryProgress(storyId, "cleaning_text", { currentLevel: level });
  const cleanedContent = cleanText(quickClean(rawContent));

  // Parse chapters FIRST (before rewriting, to enable chunked processing)
  await updateStoryProgress(storyId, "parsing_chapters", { currentLevel: level });
  const { hasChapters, chapters: rawChapters } = parseChapters(cleanedContent);

  // Initialize progress tracker
  const tracker = new LevelProgressTracker(levelId, rawChapters.length);

  try {
    await tracker.startProcessing();

    // Step 1: Rewrite if needed
    const chapters = await rewriteChaptersIfNeeded(
      { storyId, userId },
      rawChapters,
      level,
      detectedLevel,
      sourceLanguage,
      tracker
    );

    // Step 2: Translate all chapters
    const processedChapters = await translateChapters(
      { storyId, userId },
      chapters,
      sourceLanguage,
      level,
      tracker
    );

    // Step 3: Build content structure
    await updateStoryProgress(storyId, "building_structure", { currentLevel: level });
    const levelNum = levelStringToNumber(level);
    const content = buildContentStructure(
      storySlug,
      levelNum,
      hasChapters,
      processedChapters,
      sourceLanguage
    );

    // Step 4: Mark complete
    await updateStoryProgress(storyId, "saving_content", { currentLevel: level });
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

/** Context for cost tracking */
interface CostContext {
  storyId: string;
  userId: string;
}

/**
 * Rewrite chapters to target level if different from detected level
 */
async function rewriteChaptersIfNeeded(
  ctx: CostContext,
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

    // Update story-level progress with chapter info
    await updateStoryProgress(ctx.storyId, "rewriting_chapter", {
      chapterCurrent: i + 1,
      chapterTotal: rawChapters.length,
      currentLevel: targetLevel,
    });

    // Update level-specific progress
    await tracker.updateRewriteProgress(i + 1);

    // Rewrite this chapter
    const result = await rewriteToLevel(
      chapterText,
      detectedLevel,
      targetLevel,
      sourceLanguage,
      { storyId: ctx.storyId, userId: ctx.userId }
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
  ctx: CostContext,
  chapters: string[],
  sourceLanguage: "en" | "es",
  level: string,
  tracker: LevelProgressTracker
): Promise<ProcessedChapter[]> {
  await tracker.startTranslating();
  const processedChapters: ProcessedChapter[] = [];

  for (let i = 0; i < chapters.length; i++) {
    const chapterText = chapters[i];

    // Update story-level progress with chapter info
    await updateStoryProgress(ctx.storyId, "translating_chapter", {
      chapterCurrent: i + 1,
      chapterTotal: chapters.length,
      currentLevel: level,
    });

    // Update level-specific progress
    await tracker.updateTranslationProgress(i + 1);

    // Translate chapter
    const result = await translateText(chapterText, sourceLanguage, level, { storyId: ctx.storyId, userId: ctx.userId });

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
