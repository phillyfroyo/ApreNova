// src/lib/user-stories/pipeline.ts
// User story processing pipeline - orchestrates all processing steps
//
// Architecture:
// - metadata.ts: Title and description generation
// - level-processor.ts: Single level processing (rewrite + translate)
// - progress-tracker.ts: Progress tracking utilities
// - This file: Orchestration and coordination

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
} from "./metadata";
import { processLevel } from "./level-processor";
import { updateStoryStatus, determineFinalStatus, updateStoryProgress } from "./progress-tracker";

// Shared library imports
import { detectLanguage, detectCEFRLevel } from "@/lib/story-processing";
import { toCEFR } from "@/lib/cefr";

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
 */
async function detectAndSaveLanguage(
  ctx: CostContext,
  rawContent: string
): Promise<"en" | "es"> {
  const sourceLanguage = await detectLanguage(rawContent, ctx);
  await prisma.userStory.update({
    where: { id: ctx.storyId },
    data: { sourceLanguage },
  });
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
 * Step 4: Detect and save CEFR level
 */
async function detectAndSaveLevel(
  ctx: CostContext,
  rawContent: string,
  sourceLanguage: "en" | "es"
): Promise<string> {
  const detectionResult = await detectCEFRLevel(rawContent, sourceLanguage, ctx);
  const detectedLevel = detectionResult.levelString;

  console.log(
    `[Pipeline] Detected: ${sourceLanguage.toUpperCase()}, ${detectionResult.cefr}`
  );

  await prisma.userStory.update({
    where: { id: ctx.storyId },
    data: { detectedLevel },
  });
  await apiDelay();

  return detectedLevel;
}

/**
 * Step 5: Determine which levels need processing
 * Returns: Set of level strings in CEFR format (e.g., "A2", "B1")
 */
async function determineLevelsToProcess(
  userId: string,
  detectedLevel: string
): Promise<Set<string>> {
  // Supported levels for user stories (A1-C1)
  const SUPPORTED_LEVELS = ["A1", "A2", "B1", "B2", "C1"];

  // Map detected level to supported level (C2 -> C1, anything outside range -> B1)
  let effectiveLevel = detectedLevel;
  if (!SUPPORTED_LEVELS.includes(detectedLevel)) {
    effectiveLevel = detectedLevel === "C2" ? "C1" : "B1";
    console.log(`[Pipeline] Mapping unsupported level ${detectedLevel} to ${effectiveLevel}`);
  }

  const levelsToProcess = new Set<string>([effectiveLevel]);

  const userLevel = await getUserLevel(userId);
  if (userLevel && userLevel !== effectiveLevel) {
    // Also ensure user level is supported
    if (SUPPORTED_LEVELS.includes(userLevel)) {
      levelsToProcess.add(userLevel);
    }
  }

  return levelsToProcess;
}

/**
 * Step 6: Process all required levels
 */
async function processAllLevels(
  story: {
    id: string;
    slug: string;
    rawContent: string;
    userId: string;
    levels: { id: string; level: string }[];
  },
  levelsToProcess: Set<string>,
  sourceLanguage: "en" | "es",
  detectedLevel: string
): Promise<{ allSucceeded: boolean; anySucceeded: boolean }> {
  console.log(
    `[Pipeline] Processing levels: ${Array.from(levelsToProcess).join(", ")}`
  );

  let allSucceeded = true;
  let anySucceeded = false;

  for (const level of levelsToProcess) {
    const levelRecord = story.levels.find((l) => l.level === level);
    if (!levelRecord) continue;

    const result = await processLevel({
      storyId: story.id,
      userId: story.userId,
      levelId: levelRecord.id,
      level,
      rawContent: story.rawContent,
      sourceLanguage,
      detectedLevel,
      storySlug: story.slug,
    });

    if (result.success) {
      anySucceeded = true;
    } else {
      allSucceeded = false;
      console.error(`[Pipeline] Level ${level} error:`, result.error);
    }
  }

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
 * 6. Process each level (rewrite + translate + paginate)
 * 7. Update final status
 */
export async function processUserStory(storyId: string): Promise<void> {
  console.log(`[Pipeline] Processing story: ${storyId}`);

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
    // Step 1: Detect language
    await updateStoryProgress(storyId, "detecting_language");
    const sourceLanguage = await detectAndSaveLanguage(ctx, story.rawContent);

    // Step 2: Generate title if needed
    await updateStoryProgress(storyId, "generating_title");
    await generateTitleIfNeeded(
      ctx,
      story.title,
      story.rawContent,
      sourceLanguage
    );

    // Step 3: Generate description if needed
    await updateStoryProgress(storyId, "generating_description");
    await generateDescriptionIfNeeded(
      ctx,
      story.description,
      story.rawContent,
      sourceLanguage
    );

    // Step 3.5: Generate hook/teaser
    await updateStoryProgress(storyId, "generating_hook");
    await generateAndSaveHook(ctx, story.rawContent, sourceLanguage);

    // Step 3.6: Detect story type
    await updateStoryProgress(storyId, "detecting_story_type");
    await detectAndSaveStoryType(ctx, story.rawContent, sourceLanguage);

    // Step 3.7: Detect target audience
    await updateStoryProgress(storyId, "detecting_audience");
    await detectAndSaveTargetAudience(ctx, story.rawContent, sourceLanguage);

    // Step 3.8: Extract tags
    await updateStoryProgress(storyId, "extracting_tags");
    await extractAndSaveTags(ctx, story.rawContent, sourceLanguage);

    // Step 4: Detect CEFR level
    await updateStoryProgress(storyId, "detecting_level");
    const detectedLevel = await detectAndSaveLevel(
      ctx,
      story.rawContent,
      sourceLanguage
    );

    // Step 5: Determine which levels to process
    const levelsToProcess = await determineLevelsToProcess(
      story.userId,
      detectedLevel
    );

    // Step 6: Process all levels (progress updates happen inside processAllLevels)
    const { allSucceeded, anySucceeded } = await processAllLevels(
      storyWithLevels,
      levelsToProcess,
      sourceLanguage,
      detectedLevel
    );

    // Step 7: Update final status
    await updateStoryProgress(storyId, "complete");
    const finalStatus = determineFinalStatus(allSucceeded, anySucceeded);
    await updateStoryStatus(storyId, finalStatus);
    console.log(`[Pipeline] Complete: ${finalStatus}`);
  } catch (error: any) {
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
