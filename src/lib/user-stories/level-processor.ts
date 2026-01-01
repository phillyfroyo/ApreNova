// src/lib/user-stories/level-processor.ts
// Handles processing of a single CEFR level for a user story
//
// New architecture (v2):
// - Separate functions for rewriting, translating, and building
// - Pipeline calls rewrite for ALL levels first, then translate for ALL levels
// - This is more logical and allows for potential parallelization

import { USER_STORY_LIMITS, STREAMING_LIMITS } from "./limits";
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
import { StreamingChapterQueue, QueuedChapter } from "./chapter-queue";

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

export interface ParsedChapters {
  hasChapters: boolean;
  chapters: string[];
  cleanedContent: string;
}

export interface ProcessedChapter {
  sourceLines: string[];
  translatedLines: string[];
}

/** Context for cost tracking */
interface CostContext {
  storyId: string;
  userId: string;
}

// ============================================================================
// DELAY HELPER
// ============================================================================

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ============================================================================
// PHASE 1: PARSING (shared across all levels)
// ============================================================================

/**
 * Parse story content into chapters
 * This is done once and shared across all levels
 */
export function parseStoryContent(rawContent: string): ParsedChapters {
  const cleanedContent = cleanText(quickClean(rawContent));
  const { hasChapters, chapters } = parseChapters(cleanedContent);
  return { hasChapters, chapters, cleanedContent };
}

// ============================================================================
// PHASE 2: REWRITING (all levels that need it)
// ============================================================================

export interface RewriteParams {
  storyId: string;
  userId: string;
  levelId: string;
  level: string;
  chapters: string[];
  sourceLanguage: "en" | "es";
  detectedLevel: string;
}

export interface RewriteResult {
  success: boolean;
  chapters: string[];
  error?: string;
}

/**
 * Rewrite chapters to target level if different from detected level
 * Returns the rewritten chapters (or original if no rewrite needed)
 */
export async function rewriteLevelChapters(
  params: RewriteParams
): Promise<RewriteResult> {
  const {
    storyId,
    userId,
    levelId,
    level,
    chapters,
    sourceLanguage,
    detectedLevel,
  } = params;

  const ctx: CostContext = { storyId, userId };
  const needsRewrite = level !== detectedLevel;

  // Initialize progress tracker
  const tracker = new LevelProgressTracker(levelId, chapters.length);

  try {
    await tracker.startProcessing();

    if (!needsRewrite) {
      // No rewrite needed, return original chapters
      console.log(`[LevelProcessor] Level ${level} = detected level, skipping rewrite`);
      return { success: true, chapters };
    }

    console.log(`[LevelProcessor] Rewriting ${chapters.length} chapters: ${detectedLevel} → ${level}`);
    await tracker.startRewriting();
    const rewrittenChapters: string[] = [];

    for (let i = 0; i < chapters.length; i++) {
      const chapterText = chapters[i];

      // Update story-level progress with chapter info
      await updateStoryProgress(storyId, "rewriting_chapter", {
        chapterCurrent: i + 1,
        chapterTotal: chapters.length,
        currentLevel: level,
      });

      // Update level-specific progress
      await tracker.updateRewriteProgress(i + 1);

      // Rewrite this chapter
      const result = await rewriteToLevel(
        chapterText,
        detectedLevel,
        level,
        sourceLanguage,
        ctx
      );
      rewrittenChapters.push(result.rewrittenText);

      // Update progress with completed chapter data
      await tracker.updateRewriteProgress(i + 1, {
        originalLines: chapterText.split("\n").filter((l) => l.trim()),
        rewrittenLines: result.rewrittenText.split("\n").filter((l) => l.trim()),
      });

      await delay(USER_STORY_LIMITS.MIN_DELAY_BETWEEN_AI_CALLS_MS);
    }

    return { success: true, chapters: rewrittenChapters };
  } catch (error: any) {
    console.error(`[LevelProcessor] Rewrite failed for level ${level}:`, error.message);
    await tracker.markFailed();
    return { success: false, chapters: [], error: error.message };
  }
}

// ============================================================================
// PHASE 3: TRANSLATION (all levels)
// ============================================================================

export interface TranslateParams {
  storyId: string;
  userId: string;
  levelId: string;
  level: string;
  chapters: string[];
  sourceLanguage: "en" | "es";
}

export interface TranslateResult {
  success: boolean;
  processedChapters: ProcessedChapter[];
  error?: string;
}

/**
 * Translate all chapters to the opposite language
 */
export async function translateLevelChapters(
  params: TranslateParams
): Promise<TranslateResult> {
  const { storyId, userId, levelId, level, chapters, sourceLanguage } = params;

  const ctx: CostContext = { storyId, userId };
  const tracker = new LevelProgressTracker(levelId, chapters.length);

  try {
    console.log(`[LevelProcessor] Translating ${chapters.length} chapters for level ${level}`);
    await tracker.startTranslating();
    const processedChapters: ProcessedChapter[] = [];

    for (let i = 0; i < chapters.length; i++) {
      const chapterText = chapters[i];

      // Update story-level progress with chapter info
      await updateStoryProgress(storyId, "translating_chapter", {
        chapterCurrent: i + 1,
        chapterTotal: chapters.length,
        currentLevel: level,
      });

      // Update level-specific progress
      await tracker.updateTranslationProgress(i + 1);

      // Translate chapter
      const result = await translateText(chapterText, sourceLanguage, level, ctx);

      // Split into lines
      const sourceLines = chapterText.split("\n").filter((l) => l.trim());
      const translatedLines = result.translatedLines.filter((l) => l.trim());

      const chapterData = { sourceLines, translatedLines };
      processedChapters.push(chapterData);

      // Update progress with completed chapter data
      await tracker.updateTranslationProgress(i + 1, chapterData);

      await delay(USER_STORY_LIMITS.MIN_DELAY_BETWEEN_AI_CALLS_MS);
    }

    return { success: true, processedChapters };
  } catch (error: any) {
    console.error(`[LevelProcessor] Translation failed for level ${level}:`, error.message);
    await tracker.markFailed();
    return { success: false, processedChapters: [], error: error.message };
  }
}

// ============================================================================
// PHASE 4: BUILD AND SAVE (all levels)
// ============================================================================

export interface BuildAndSaveParams {
  storyId: string;
  levelId: string;
  level: string;
  storySlug: string;
  hasChapters: boolean;
  processedChapters: ProcessedChapter[];
  sourceLanguage: "en" | "es";
}

export interface BuildAndSaveResult {
  success: boolean;
  error?: string;
}

/**
 * Build content structure and save to database
 */
export async function buildAndSaveLevel(
  params: BuildAndSaveParams
): Promise<BuildAndSaveResult> {
  const {
    storyId,
    levelId,
    level,
    storySlug,
    hasChapters,
    processedChapters,
    sourceLanguage,
  } = params;

  const tracker = new LevelProgressTracker(levelId, processedChapters.length);

  try {
    // Build content structure
    await updateStoryProgress(storyId, "building_structure", { currentLevel: level });
    const levelNum = levelStringToNumber(level);
    const content = buildContentStructure(
      storySlug,
      levelNum,
      hasChapters,
      processedChapters,
      sourceLanguage
    );

    // Save and mark complete
    await updateStoryProgress(storyId, "saving_content", { currentLevel: level });
    await tracker.markComplete(content);

    console.log(`[LevelProcessor] Level ${level} saved successfully`);
    return { success: true };
  } catch (error: any) {
    console.error(`[LevelProcessor] Build/save failed for level ${level}:`, error.message);
    await tracker.markFailed();
    return { success: false, error: error.message };
  }
}

// ============================================================================
// STREAMING PIPELINE: Producer-Consumer for parallel rewrite→translate
// ============================================================================

export interface StreamingLevelParams {
  storyId: string;
  userId: string;
  levelId: string;
  level: string;
  chapters: string[];
  sourceLanguage: "en" | "es";
  detectedLevel: string;
}

export interface StreamingLevelResult {
  success: boolean;
  processedChapters: ProcessedChapter[];
  error?: string;
}

/**
 * PRODUCER: Rewrite chapters using GPT and enqueue for translation.
 * Runs as an async generator, yielding after each chapter completes.
 */
async function* rewriteChaptersProducer(
  params: StreamingLevelParams,
  queue: StreamingChapterQueue
): AsyncGenerator<{ chapterIndex: number; content: string }, void, unknown> {
  const {
    storyId,
    userId,
    levelId,
    level,
    chapters,
    sourceLanguage,
    detectedLevel,
  } = params;

  const ctx: CostContext = { storyId, userId };
  const needsRewrite = level !== detectedLevel;
  const tracker = new LevelProgressTracker(levelId, chapters.length);

  await tracker.startRewriting();

  for (let i = 0; i < chapters.length; i++) {
    const chapterText = chapters[i];

    // Update story-level progress
    await updateStoryProgress(storyId, "rewriting_chapter", {
      chapterCurrent: i + 1,
      chapterTotal: chapters.length,
      currentLevel: level,
    });

    // Update level-specific progress
    await tracker.updateRewriteProgress(i + 1);

    let rewrittenContent: string;

    if (needsRewrite) {
      try {
        // Call GPT to rewrite
        const result = await rewriteToLevel(
          chapterText,
          detectedLevel,
          level,
          sourceLanguage,
          ctx
        );
        rewrittenContent = result.rewrittenText;

        // Update progress with chapter data
        await tracker.updateRewriteProgress(i + 1, {
          originalLines: chapterText.split("\n").filter((l) => l.trim()),
          rewrittenLines: rewrittenContent.split("\n").filter((l) => l.trim()),
        });
      } catch (error: any) {
        console.error(`[StreamingProducer] Rewrite failed for chapter ${i + 1}:`, error.message);
        // Graceful degradation: use original content
        queue.markRewriteError(i, error);
        rewrittenContent = chapterText;
      }
    } else {
      // No rewrite needed, use original
      rewrittenContent = chapterText;
    }

    // Enqueue for translation immediately
    const queuedChapter: QueuedChapter = {
      chapterIndex: i,
      content: rewrittenContent,
      queuedAt: Date.now(),
    };
    queue.enqueue(queuedChapter);

    // Yield for progress tracking
    yield { chapterIndex: i, content: rewrittenContent };

    // Apply backpressure if queue is getting too large
    if (queue.shouldApplyBackpressure(STREAMING_LIMITS.QUEUE_BACKPRESSURE_THRESHOLD)) {
      console.log(`[StreamingProducer] Backpressure: queue at ${queue.getQueueSize()}, waiting...`);
      await delay(STREAMING_LIMITS.QUEUE_FULL_WAIT_MS);
    }

    // Rate limit between GPT calls (only if we actually made a call)
    if (needsRewrite && i < chapters.length - 1) {
      await delay(USER_STORY_LIMITS.MIN_DELAY_BETWEEN_AI_CALLS_MS);
    }
  }

  // Signal producer is done
  queue.markProducerComplete();
  console.log(`[StreamingProducer] All ${chapters.length} chapters enqueued`);
}

/**
 * CONSUMER: Translate chapters from queue using Claude.
 * Runs concurrently with producer, processing chapters as they arrive.
 */
async function translateChaptersConsumer(
  params: StreamingLevelParams,
  queue: StreamingChapterQueue
): Promise<TranslateResult> {
  const { storyId, userId, levelId, level, chapters, sourceLanguage } = params;

  const ctx: CostContext = { storyId, userId };
  const totalChapters = chapters.length;
  const tracker = new LevelProgressTracker(levelId, totalChapters);
  const processedChapters: (ProcessedChapter | null)[] = new Array(totalChapters).fill(null);

  await tracker.startTranslating();

  let chaptersProcessed = 0;

  while (chaptersProcessed < totalChapters) {
    // Wait for next chapter from queue (blocks if producer is behind)
    const queuedChapter = await queue.dequeue();

    if (!queuedChapter) {
      // Producer finished but we haven't processed all chapters
      // This means some chapters failed in producer
      console.warn(`[StreamingConsumer] Queue empty before all chapters processed`);
      break;
    }

    const { chapterIndex, content } = queuedChapter;

    // Update story-level progress
    await updateStoryProgress(storyId, "translating_chapter", {
      chapterCurrent: chaptersProcessed + 1,
      chapterTotal: totalChapters,
      currentLevel: level,
    });

    // Update level-specific progress
    await tracker.updateTranslationProgress(chaptersProcessed + 1);

    try {
      // Call Claude to translate
      const result = await translateText(content, sourceLanguage, level, ctx);

      const sourceLines = content.split("\n").filter((l) => l.trim());
      const translatedLines = result.translatedLines.filter((l) => l.trim());

      const processedChapter: ProcessedChapter = {
        sourceLines,
        translatedLines,
      };

      // Store in correct order (by original chapter index)
      processedChapters[chapterIndex] = processedChapter;
      queue.markTranslateComplete(chapterIndex, processedChapter);

      // Update progress with completed data
      await tracker.updateTranslationProgress(chaptersProcessed + 1, processedChapter);

    } catch (error: any) {
      console.error(`[StreamingConsumer] Translation failed for chapter ${chapterIndex + 1}:`, error.message);
      queue.markTranslateError(chapterIndex, error);
      // Continue processing other chapters
    }

    chaptersProcessed++;

    // Rate limit between Claude calls
    if (chaptersProcessed < totalChapters) {
      await delay(USER_STORY_LIMITS.MIN_DELAY_BETWEEN_AI_CALLS_MS);
    }
  }

  // Filter out any nulls (failed chapters)
  const validChapters = processedChapters.filter((ch): ch is ProcessedChapter => ch !== null);

  console.log(`[StreamingConsumer] Translated ${validChapters.length}/${totalChapters} chapters`);

  return {
    success: validChapters.length > 0,
    processedChapters: validChapters,
    error: validChapters.length === 0 ? "All chapters failed to translate" : undefined,
  };
}

/**
 * Process a level with streaming pipeline:
 * GPT rewriting → Queue → Claude translation (running in parallel)
 *
 * This cuts processing time by ~50% compared to sequential processing.
 */
export async function processLevelStreaming(
  params: StreamingLevelParams
): Promise<StreamingLevelResult> {
  const { level, chapters, detectedLevel } = params;

  console.log(`[StreamingPipeline] Starting streaming pipeline for level ${level}`);
  console.log(`[StreamingPipeline] ${chapters.length} chapters, needsRewrite: ${level !== detectedLevel}`);

  // Create the queue
  const queue = new StreamingChapterQueue(chapters.length);

  // Set up progress logging
  queue.setProgressCallback((progress) => {
    console.log(
      `[StreamingPipeline] Progress: rewrite ${progress.rewriteCompleted}/${progress.totalChapters}, ` +
      `translate ${progress.translateCompleted}/${progress.totalChapters}`
    );
  });

  // Start producer (GPT rewriting) - runs independently
  const producerPromise = (async () => {
    const generator = rewriteChaptersProducer(params, queue);
    // Consume the generator to drive the rewriting
    for await (const _chapter of generator) {
      // Each yielded chapter has already been enqueued
    }
  })();

  // Start consumer (Claude translation) - runs in parallel
  const consumerPromise = translateChaptersConsumer(params, queue);

  // Wait for both to complete
  const [, translateResult] = await Promise.all([
    producerPromise,
    consumerPromise,
  ]);

  // Log any errors
  const errors = queue.getErrors();
  if (errors.length > 0) {
    console.warn(`[StreamingPipeline] ${errors.length} chapters had errors:`,
      errors.map(e => `ch${e.chapterIndex + 1}(${e.phase})`).join(", ")
    );
  }

  console.log(`[StreamingPipeline] Complete: ${translateResult.processedChapters.length}/${chapters.length} chapters`);

  return {
    success: translateResult.success,
    processedChapters: translateResult.processedChapters,
    error: translateResult.error,
  };
}

// ============================================================================
// LEGACY: Single-level processor (kept for backward compatibility)
// ============================================================================

/**
 * @deprecated Use the new phased approach: rewriteLevelChapters → translateLevelChapters → buildAndSaveLevel
 *
 * Process a single level (rewrite if needed + translate + paginate)
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

  // Parse chapters
  await updateStoryProgress(storyId, "parsing_chapters", { currentLevel: level });
  const { hasChapters, chapters } = parseStoryContent(rawContent);

  // Rewrite if needed
  const rewriteResult = await rewriteLevelChapters({
    storyId,
    userId,
    levelId,
    level,
    chapters,
    sourceLanguage,
    detectedLevel,
  });

  if (!rewriteResult.success) {
    return { success: false, error: rewriteResult.error };
  }

  // Translate
  const translateResult = await translateLevelChapters({
    storyId,
    userId,
    levelId,
    level,
    chapters: rewriteResult.chapters,
    sourceLanguage,
  });

  if (!translateResult.success) {
    return { success: false, error: translateResult.error };
  }

  // Build and save
  const buildResult = await buildAndSaveLevel({
    storyId,
    levelId,
    level,
    storySlug,
    hasChapters,
    processedChapters: translateResult.processedChapters,
    sourceLanguage,
  });

  return buildResult;
}
