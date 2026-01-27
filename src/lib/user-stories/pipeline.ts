// src/lib/user-stories/pipeline.ts
// User story processing pipeline - orchestrates all processing steps
//
// Architecture (v2):
// - metadata.ts: Title and description generation
// - level-processor.ts: Separate functions for rewrite, translate, build
// - progress-tracker.ts: Progress tracking utilities
// - This file: Orchestration and coordination
//
// New processing order:
// 1. Parse chapters (once, shared)
// 2. Rewrite ALL levels that need it
// 3. Translate ALL levels
// 4. Build and save ALL levels

import { prisma } from "@/lib/prisma";
import { USER_STORY_LIMITS } from "./limits";

// Modular imports
import {
  extractOrGenerateTitle,
  generateDescription,
  generateHook,
  detectStoryType,
  detectTargetAudience,
  extractTags,
  generateAllMetadata,
  type BatchedMetadataResult,
} from "./metadata";
import {
  parseStoryContent,
  rewriteLevelChapters,
  translateLevelChapters,
  buildAndSaveLevel,
  processLevel, // Keep for retryLevel backward compatibility
  processLevelStreaming, // NEW: Streaming rewrite→translate pipeline
  type ProcessedChapter,
  type ProcessedChapterDataWithMetadata,
} from "./level-processor";
import { updateStoryStatus, determineFinalStatus, updateStoryProgress, isStoryCancelled, StoryCancelledError } from "./progress-tracker";

// Shared library imports
import { detectLanguage, detectCEFRLevel } from "@/lib/story-processing";
import { toCEFR } from "@/lib/cefr";
import type { StoryType } from "@/types/story";

// Re-export types for consumers
export type { ProcessingProgress } from "./progress-tracker";
export type { TitleResult, DescriptionResult } from "./metadata";
export type { LevelProcessingResult } from "./level-processor";

// ============================================================================
// DATABASE HELPERS
// ============================================================================

/**
 * Get the user's current CEFR level from their profile
 */
async function getUserLevel(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { quizLevel: true },
  });

  if (!user?.quizLevel) return null;

  // Convert any format (l1-l6, 1-6, A1-C2) to CEFR code
  return toCEFR(user.quizLevel);
}

/**
 * Helper for rate limiting between API calls
 */
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const apiDelay = () => delay(USER_STORY_LIMITS.MIN_DELAY_BETWEEN_AI_CALLS_MS);

// ============================================================================
// PIPELINE STEPS
// ============================================================================

/** Context for cost tracking */
interface CostContext {
  storyId: string;
  userId: string;
}

/**
 * Step 1: Detect the source language (English or Spanish)
 * Handles story deletion gracefully
 */
async function detectAndSaveLanguage(
  ctx: CostContext,
  rawContent: string
): Promise<"en" | "es"> {
  const sourceLanguage = await detectLanguage(rawContent, ctx);
  try {
    await prisma.userStory.update({
      where: { id: ctx.storyId },
      data: { sourceLanguage },
    });
  } catch (error: any) {
    if (error?.code === "P2025") {
      console.log(`[Pipeline] Story ${ctx.storyId} deleted, skipping language save`);
      throw new StoryCancelledError(ctx.storyId);
    }
    throw error;
  }
  await apiDelay();
  return sourceLanguage;
}

/**
 * Step 2: Generate title if not provided
 */
async function generateTitleIfNeeded(
  ctx: CostContext,
  currentTitle: string,
  rawContent: string,
  sourceLanguage: "en" | "es"
): Promise<void> {
  const isDefaultTitle =
    currentTitle === "Untitled Story" || currentTitle === "Historia sin título";

  if (!isDefaultTitle) return;

  const titles = await extractOrGenerateTitle(rawContent, sourceLanguage, ctx);
  await prisma.userStory.update({
    where: { id: ctx.storyId },
    data: {
      title: titles.title,
      titleEs: titles.titleEs,
      titleEn: titles.titleEn,
    },
  });
  await apiDelay();
}

/**
 * Step 3: Generate description if not provided
 */
async function generateDescriptionIfNeeded(
  ctx: CostContext,
  currentDescription: string | null,
  rawContent: string,
  sourceLanguage: "en" | "es"
): Promise<void> {
  if (currentDescription) return;

  const descriptions = await generateDescription(rawContent, sourceLanguage, ctx);
  await prisma.userStory.update({
    where: { id: ctx.storyId },
    data: {
      description: descriptions.description,
      descriptionEs: descriptions.descriptionEs,
      descriptionEn: descriptions.descriptionEn,
    },
  });
  await apiDelay();
}

/**
 * Step 3.5: Generate hook/teaser
 */
async function generateAndSaveHook(
  ctx: CostContext,
  rawContent: string,
  sourceLanguage: "en" | "es"
): Promise<void> {
  const hookResult = await generateHook(rawContent, sourceLanguage, ctx);
  await prisma.userStory.update({
    where: { id: ctx.storyId },
    data: {
      hook: hookResult.hook,
      hookEs: hookResult.hookEs,
      hookEn: hookResult.hookEn,
    },
  });
  await apiDelay();
}

/**
 * Step 3.6: Detect story type
 */
async function detectAndSaveStoryType(
  ctx: CostContext,
  rawContent: string,
  sourceLanguage: "en" | "es"
): Promise<void> {
  const storyType = await detectStoryType(rawContent, sourceLanguage, ctx);
  await prisma.userStory.update({
    where: { id: ctx.storyId },
    data: { storyType },
  });
  await apiDelay();
}

/**
 * Step 3.7: Detect target audience
 */
async function detectAndSaveTargetAudience(
  ctx: CostContext,
  rawContent: string,
  sourceLanguage: "en" | "es"
): Promise<void> {
  const targetAudience = await detectTargetAudience(rawContent, sourceLanguage, ctx);
  await prisma.userStory.update({
    where: { id: ctx.storyId },
    data: { targetAudience },
  });
  await apiDelay();
}

/**
 * Step 3.8: Extract tags
 * @deprecated Use generateAndSaveAllMetadata for batched API calls
 */
async function extractAndSaveTags(
  ctx: CostContext,
  rawContent: string,
  sourceLanguage: "en" | "es"
): Promise<void> {
  const tags = await extractTags(rawContent, sourceLanguage, ctx);
  await prisma.userStory.update({
    where: { id: ctx.storyId },
    data: { tags },
  });
  await apiDelay();
}

/**
 * Step 2-3 BATCHED: Generate essential metadata in a single API call
 *
 * For user stories, we only auto-generate:
 * - Title (found in text or generated)
 * - Description (found in text or generated)
 *
 * Advanced options (hook, story type, audience, tags) are left empty
 * for the user to optionally fill in manually.
 *
 * Cost savings: ~6 API calls → 1 minimal API call
 */
async function generateAndSaveAllMetadata(
  ctx: CostContext,
  story: { title: string; description: string | null; rawContent: string },
  sourceLanguage: "en" | "es"
): Promise<void> {
  const isDefaultTitle =
    story.title === "Untitled Story" || story.title === "Historia sin título";
  const needsDescription = !story.description;

  const metadata = await generateAllMetadata(
    story.rawContent,
    sourceLanguage,
    ctx,
    {
      existingTitle: isDefaultTitle ? undefined : story.title,
      existingDescription: needsDescription ? undefined : (story.description ?? undefined),
      essentialOnly: true, // Only generate title + description for user stories
    }
  );

  // Build update data - only title and description
  const updateData: Record<string, unknown> = {};

  // Only update title if it was generated
  if (isDefaultTitle) {
    updateData.title = metadata.title.title;
    updateData.titleEs = metadata.title.titleEs;
    updateData.titleEn = metadata.title.titleEn;
  }

  // Only update description if it was generated
  if (needsDescription) {
    updateData.description = metadata.description.description;
    updateData.descriptionEs = metadata.description.descriptionEs;
    updateData.descriptionEn = metadata.description.descriptionEn;
  }

  // Only update if we have something to update
  if (Object.keys(updateData).length > 0) {
    try {
      await prisma.userStory.update({
        where: { id: ctx.storyId },
        data: updateData,
      });
    } catch (error: any) {
      if (error?.code === "P2025") {
        console.log(`[Pipeline] Story ${ctx.storyId} deleted, skipping metadata save`);
        throw new StoryCancelledError(ctx.storyId);
      }
      throw error;
    }
  }

}

/**
 * Step 4: Detect and save CEFR level
 * Handles story deletion gracefully
 */
async function detectAndSaveLevel(
  ctx: CostContext,
  rawContent: string,
  sourceLanguage: "en" | "es"
): Promise<string> {
  const detectionResult = await detectCEFRLevel(rawContent, sourceLanguage, ctx);
  const detectedLevel = detectionResult.levelString;

  try {
    await prisma.userStory.update({
      where: { id: ctx.storyId },
      data: { detectedLevel },
    });
  } catch (error: any) {
    if (error?.code === "P2025") {
      console.log(`[Pipeline] Story ${ctx.storyId} deleted, skipping level save`);
      throw new StoryCancelledError(ctx.storyId);
    }
    throw error;
  }
  await apiDelay();

  return detectedLevel;
}

/**
 * Step 5: Determine which levels need processing
 * Returns: Set of level strings in CEFR format (e.g., "A2", "B1")
 *
 * Processing strategy:
 * - Always process the detected level (preserves original text)
 * - Also process user's level if different (creates adapted version)
 * - C2 is valid as detected level (for complex texts) but not as user level
 */
async function determineLevelsToProcess(
  userId: string,
  detectedLevel: string,
  processingMode?: string | null
): Promise<Set<string>> {
  const mode = processingMode || "both";

  // Valid detected levels (includes C2 for complex texts)
  const VALID_DETECTED_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
  // User-selectable levels (excludes C2 - too advanced for target audience)
  const SUPPORTED_USER_LEVELS = ["A1", "A2", "B1", "B2", "C1"];

  // Fall back to B1 only if detection returned something unexpected
  let effectiveDetectedLevel = detectedLevel;
  if (!VALID_DETECTED_LEVELS.includes(detectedLevel)) {
    effectiveDetectedLevel = "B1";
    console.log(`[Pipeline] Unknown detected level ${detectedLevel}, falling back to B1`);
  }

  const levelsToProcess = new Set<string>();

  // Include original (detected) level
  if (mode === "original_only" || mode === "both") {
    levelsToProcess.add(effectiveDetectedLevel);
  }

  // Include user's level (rewritten version)
  if (mode === "rewritten_only" || mode === "both") {
    const userLevel = await getUserLevel(userId);
    if (userLevel && SUPPORTED_USER_LEVELS.includes(userLevel)) {
      levelsToProcess.add(userLevel);
    }
  }

  // Safety fallback: always have at least one level
  if (levelsToProcess.size === 0) {
    levelsToProcess.add(effectiveDetectedLevel);
  }

  console.log(`[Pipeline] Processing mode: ${mode}, levels to process: ${[...levelsToProcess].join(", ")}`);

  return levelsToProcess;
}

/**
 * Step 6: Process all required levels (STREAMING APPROACH)
 *
 * Optimized order using streaming producer-consumer pattern:
 * - Rewrite uses GPT (OpenAI) as producer
 * - Translate uses Claude (Anthropic) as consumer
 *
 * Timeline:
 * 1. Parse chapters once (shared)
 * 2. PARALLEL STREAMING:
 *    - Stream A: Translate detected level (Claude only, no rewrite needed)
 *    - Stream B: For levels needing rewrite - GPT rewrites chapter N while
 *                Claude translates chapter N-1 (true parallel streaming)
 * 3. Build and save ALL levels
 *
 * This cuts processing time by ~50% compared to sequential processing.
 * For a 100-chapter book: ~8 minutes instead of ~16 minutes.
 */
async function processAllLevels(
  story: {
    id: string;
    slug: string;
    rawContent: string;
    userId: string;
    levels: { id: string; level: string }[];
    storyType?: string | null;
  },
  levelsToProcess: Set<string>,
  sourceLanguage: "en" | "es",
  detectedLevel: string
): Promise<{ allSucceeded: boolean; anySucceeded: boolean }> {
  const levelsArray = Array.from(levelsToProcess);

  // =========================================================================
  // PHASE 1: Parse chapters (once, shared across all levels)
  // =========================================================================
  await updateStoryProgress(story.id, "parsing_chapters");
  // Pass storyType to help infer structure type for poetry
  const { hasChapters, chapters: originalChapters, structureType } = parseStoryContent(story.rawContent, {
    storyType: story.storyType
  });

  console.log(`[Pipeline] Parsed content: hasChapters=${hasChapters}, chapters=${originalChapters.length}, structureType=${structureType}, storyType=${story.storyType}`);

  // Track processed chapters for each level (after translation)
  const levelProcessedChapters: Map<string, ProcessedChapter[]> = new Map();
  // Track extended chapter data with metadata (for poems/scripts)
  const levelProcessedChaptersWithMetadata: Map<string, ProcessedChapterDataWithMetadata[]> = new Map();
  // Track which levels succeeded
  const levelSuccess: Map<string, boolean> = new Map();

  // Separate levels into detected (no rewrite) and others (need rewrite)
  const detectedLevelRecord = story.levels.find((l) => l.level === detectedLevel);
  const levelsNeedingRewrite = levelsArray.filter((l) => l !== detectedLevel);
  const hasDetectedLevel = levelsArray.includes(detectedLevel);

  // =========================================================================
  // PHASE 2: PARALLEL PROCESSING
  // - Stream A: Translate detected level (Claude only, no rewrite)
  // - Stream B: Streaming rewrite→translate for other levels (GPT + Claude in parallel)
  // =========================================================================
  await updateStoryProgress(story.id, "rewriting_levels");

  // Create parallel tasks
  const parallelTasks: Promise<void>[] = [];

  // Task A: Translate detected level (uses Claude only, no rewrite needed)
  if (hasDetectedLevel && detectedLevelRecord) {
    const translateDetectedTask = (async () => {
      const translateResult = await translateLevelChapters({
        storyId: story.id,
        userId: story.userId,
        levelId: detectedLevelRecord.id,
        level: detectedLevel,
        chapters: originalChapters,
        sourceLanguage,
        storyType: story.storyType as StoryType | null, // For poem/script preprocessing
        structureType, // Pass for anthology-aware incremental build
      });

      if (translateResult.success) {
        levelProcessedChapters.set(detectedLevel, translateResult.processedChapters);
        // Store extended metadata if available (for poems/scripts)
        if (translateResult.processedChaptersWithMetadata) {
          levelProcessedChaptersWithMetadata.set(detectedLevel, translateResult.processedChaptersWithMetadata);
        }
        levelSuccess.set(detectedLevel, true);
      } else {
        console.error(`[Pipeline] Translation failed for ${detectedLevel}:`, translateResult.error);
        levelSuccess.set(detectedLevel, false);
      }
    })();

    parallelTasks.push(translateDetectedTask);
  }

  // Task B: Streaming rewrite→translate for levels that need rewriting
  // Uses the new streaming pipeline: GPT rewrites and Claude translates in parallel
  if (levelsNeedingRewrite.length > 0) {
    const streamingTask = (async () => {
      for (const level of levelsNeedingRewrite) {
        // Check for cancellation before starting each level
        if (await isStoryCancelled(story.id)) {
          console.log(`[Pipeline] Story ${story.id} cancelled, skipping level ${level}`);
          levelSuccess.set(level, false);
          break; // Stop processing remaining levels
        }

        const levelRecord = story.levels.find((l) => l.level === level);
        if (!levelRecord) {
          console.warn(`[Pipeline] Level record not found for ${level}, skipping`);
          levelSuccess.set(level, false);
          continue;
        }

        // Use the new streaming pipeline - GPT and Claude run in parallel!
        const streamingResult = await processLevelStreaming({
          storyId: story.id,
          userId: story.userId,
          levelId: levelRecord.id,
          level,
          chapters: originalChapters,
          sourceLanguage,
          detectedLevel,
          storyType: story.storyType as StoryType | null, // For poetry-specific rewrite handling
          structureType, // Pass for anthology-aware incremental build
        });

        if (streamingResult.success) {
          levelProcessedChapters.set(level, streamingResult.processedChapters);
          // Store extended metadata if available (for poems/scripts)
          if (streamingResult.processedChaptersWithMetadata) {
            levelProcessedChaptersWithMetadata.set(level, streamingResult.processedChaptersWithMetadata);
          }
          levelSuccess.set(level, true);
        } else {
          console.error(`[Pipeline] Streaming failed for ${level}:`, streamingResult.error);
          levelSuccess.set(level, false);
        }
      }
    })();

    parallelTasks.push(streamingTask);
  }

  // Wait for all parallel tasks to complete
  await Promise.all(parallelTasks);

  // =========================================================================
  // PHASE 3: Build and save ALL levels
  // =========================================================================
  await updateStoryProgress(story.id, "building_levels");

  for (const level of levelsArray) {
    // Skip if earlier phase failed
    if (levelSuccess.get(level) === false) {
      continue;
    }

    const levelRecord = story.levels.find((l) => l.level === level);
    if (!levelRecord) continue;

    const processedChapters = levelProcessedChapters.get(level);
    if (!processedChapters) {
      console.warn(`[Pipeline] No processed chapters for level ${level}, skipping build`);
      levelSuccess.set(level, false);
      continue;
    }

    // Get extended metadata if available (for poems/scripts)
    const processedChaptersWithMetadata = levelProcessedChaptersWithMetadata.get(level);

    const buildResult = await buildAndSaveLevel({
      storyId: story.id,
      levelId: levelRecord.id,
      level,
      storySlug: story.slug,
      hasChapters,
      processedChapters,
      sourceLanguage,
      processedChaptersWithMetadata,
      structureType, // Pass for anthology-aware pagination
    });

    levelSuccess.set(level, buildResult.success);
    if (!buildResult.success) {
      console.error(`[Pipeline] Build failed for level ${level}:`, buildResult.error);
    }
  }

  // =========================================================================
  // Calculate final results
  // =========================================================================
  const successCount = Array.from(levelSuccess.values()).filter(Boolean).length;
  const allSucceeded = successCount === levelsArray.length;
  const anySucceeded = successCount > 0;

  return { allSucceeded, anySucceeded };
}

// ============================================================================
// MAIN PIPELINE
// ============================================================================

/**
 * Main pipeline: Process entire story
 *
 * Pipeline steps:
 * 1. Detect source language (English or Spanish)
 * 2. Generate title if using default
 * 3. Generate description if not provided
 * 3.5. Generate hook/teaser
 * 3.6. Detect story type
 * 3.7. Detect target audience
 * 3.8. Extract tags
 * 4. Detect CEFR level
 * 5. Determine which levels to process (detected + user's level)
 * 6. Process all levels:
 *    - Parse chapters (once)
 *    - Rewrite ALL levels that need it
 *    - Translate ALL levels
 *    - Build and save ALL levels
 * 7. Update final status
 */
export async function processUserStory(storyId: string): Promise<void> {
  // Use select to avoid fetching large content fields from levels
  const story = await prisma.userStory.findUnique({
    where: { id: storyId },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      rawContent: true,
      userId: true,
      sourceLanguage: true,
      storyType: true, // Needed for poetry-specific rewrite handling
      processingMode: true,
      UserStoryLevel: {
        select: {
          id: true,
          level: true,
        },
      },
    },
  });

  if (!story) {
    throw new Error("Story not found");
  }

  // Create cost tracking context
  const ctx: CostContext = { storyId: story.id, userId: story.userId };

  // Map UserStoryLevel to levels for internal use
  const storyWithLevels = {
    ...story,
    levels: story.UserStoryLevel,
  };

  try {
    // Step 1: Detect language (now mostly algorithmic, AI fallback for edge cases)
    await updateStoryProgress(storyId, "detecting_language");
    const sourceLanguage = await detectAndSaveLanguage(ctx, story.rawContent);

    // Early cancellation check - bail if story was cancelled or deleted
    if (await isStoryCancelled(storyId)) {
      console.log(`[Pipeline] Story ${storyId} cancelled during language detection, exiting`);
      return;
    }

    // Step 2-3: Generate all metadata in a single batched API call
    // This replaces 6 separate API calls with 1, saving ~80% on metadata costs
    await updateStoryProgress(storyId, "generating_metadata");
    await generateAndSaveAllMetadata(
      ctx,
      { title: story.title, description: story.description, rawContent: story.rawContent },
      sourceLanguage
    );

    // Early cancellation check - bail if story was cancelled or deleted
    if (await isStoryCancelled(storyId)) {
      console.log(`[Pipeline] Story ${storyId} cancelled during metadata generation, exiting`);
      return;
    }

    // Step 4: Detect CEFR level (still separate - needs dedicated analysis)
    await updateStoryProgress(storyId, "detecting_level");
    const detectedLevel = await detectAndSaveLevel(
      ctx,
      story.rawContent,
      sourceLanguage
    );

    // Early cancellation check - bail if story was cancelled or deleted
    if (await isStoryCancelled(storyId)) {
      console.log(`[Pipeline] Story ${storyId} cancelled during level detection, exiting`);
      return;
    }

    // Step 5: Determine which levels to process
    const levelsToProcess = await determineLevelsToProcess(
      story.userId,
      detectedLevel,
      story.processingMode
    );

    // Step 5.1: Ensure level records exist for all levels to process
    // (handles case where story was created before C2 support was added)
    const existingLevels = new Set(storyWithLevels.levels.map(l => l.level));
    const missingLevels = Array.from(levelsToProcess).filter(l => !existingLevels.has(l));

    if (missingLevels.length > 0) {
      const { randomUUID } = await import("crypto");

      try {
        await prisma.userStoryLevel.createMany({
          data: missingLevels.map((level) => ({
            id: randomUUID(),
            userStoryId: story.id,
            level,
            content: {},
            status: "PENDING",
            updatedAt: new Date(),
          })),
        });

        // Refresh the levels list
        const newLevels = await prisma.userStoryLevel.findMany({
          where: { userStoryId: story.id },
          select: { id: true, level: true },
        });
        storyWithLevels.levels = newLevels;
      } catch (error: any) {
        // Foreign key constraint fails if story was deleted
        if (error?.code === "P2025" || error?.code === "P2003") {
          console.log(`[Pipeline] Story ${story.id} deleted, skipping level creation`);
          throw new StoryCancelledError(story.id);
        }
        throw error;
      }
    }

    // Step 5.5: Detect story type if not already set (needed for poetry-specific rewriting)
    let storyType = story.storyType;
    if (!storyType) {
      storyType = await detectStoryType(story.rawContent, sourceLanguage, ctx);
      try {
        await prisma.userStory.update({
          where: { id: story.id },
          data: { storyType },
        });
        console.log(`[Pipeline] Detected story type: ${storyType}`);
      } catch (error: any) {
        if (error?.code === "P2025") {
          console.log(`[Pipeline] Story ${story.id} deleted, skipping story type save`);
          throw new StoryCancelledError(story.id);
        }
        throw error;
      }
    }

    // Step 6: Process all levels (NEW PHASED APPROACH)
    const { allSucceeded, anySucceeded } = await processAllLevels(
      { ...storyWithLevels, storyType },
      levelsToProcess,
      sourceLanguage,
      detectedLevel
    );

    // Step 7: Update final status
    await updateStoryProgress(storyId, "complete");
    const finalStatus = determineFinalStatus(allSucceeded, anySucceeded);
    await updateStoryStatus(storyId, finalStatus);
  } catch (error: any) {
    // Handle cancellation specially - don't mark as FAILED
    if (error instanceof StoryCancelledError || error.name === "StoryCancelledError") {
      console.log(`[Pipeline] Story ${storyId} was cancelled by user`);
      // The cancel API already handles status update and cleanup
      return;
    }

    console.error(`[Pipeline] Failed:`, error.message);
    await updateStoryStatus(storyId, "FAILED");
    throw error;
  }
}

// ============================================================================
// RETRY/RECOVERY API (for future error recovery UI)
// ============================================================================

/**
 * Retry processing a single failed level
 * Useful for error recovery without re-processing entire story
 * Note: Uses legacy processLevel function for simplicity
 */
export async function retryLevel(
  storyId: string,
  level: string
): Promise<{ success: boolean; error?: string }> {
  // Use select to avoid fetching large content fields
  const story = await prisma.userStory.findUnique({
    where: { id: storyId },
    select: {
      id: true,
      slug: true,
      rawContent: true,
      userId: true,
      sourceLanguage: true,
      detectedLevel: true,
      UserStoryLevel: {
        select: {
          id: true,
          level: true,
        },
      },
    },
  });

  if (!story) {
    return { success: false, error: "Story not found" };
  }

  const levelRecord = story.UserStoryLevel.find((l) => l.level === level);
  if (!levelRecord) {
    return { success: false, error: `Level ${level} not found` };
  }

  const result = await processLevel({
    storyId: story.id,
    userId: story.userId,
    levelId: levelRecord.id,
    level,
    rawContent: story.rawContent,
    sourceLanguage: story.sourceLanguage as "en" | "es",
    detectedLevel: story.detectedLevel || level,
    storySlug: story.slug,
  });

  if (result.success) {
    // Check if all levels are now ready (only need status, not content)
    const updatedStory = await prisma.userStory.findUnique({
      where: { id: storyId },
      select: {
        UserStoryLevel: {
          select: {
            status: true,
          },
        },
      },
    });

    if (updatedStory) {
      const allReady = updatedStory.UserStoryLevel.every((l) => l.status === "READY");
      const anyReady = updatedStory.UserStoryLevel.some((l) => l.status === "READY");
      const status = determineFinalStatus(allReady, anyReady);
      await updateStoryStatus(storyId, status);
    }
  }

  return result;
}

/**
 * Get processing status for a story and all its levels
 * Useful for recovery UI to show what failed
 */
export async function getProcessingStatus(storyId: string): Promise<{
  storyStatus: string;
  levels: { level: string; status: string; error?: string }[];
} | null> {
  // Only fetch status fields, not content
  const story = await prisma.userStory.findUnique({
    where: { id: storyId },
    select: {
      status: true,
      UserStoryLevel: {
        select: {
          level: true,
          status: true,
        },
      },
    },
  });

  if (!story) return null;

  return {
    storyStatus: story.status,
    levels: story.UserStoryLevel.map((l) => ({
      level: l.level,
      status: l.status,
    })),
  };
}
