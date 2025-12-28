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
import { extractOrGenerateTitle, generateDescription } from "./metadata";
import { processLevel } from "./level-processor";
import { updateStoryStatus, determineFinalStatus } from "./progress-tracker";

// Shared library imports
import { detectLanguage, detectCEFRLevel } from "@/lib/story-processing";

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

  const level = user.quizLevel;
  if (typeof level === "number") {
    return `l${level}`;
  }
  if (typeof level === "string") {
    return level.startsWith("l") ? level : `l${level}`;
  }
  return null;
}

/**
 * Helper for rate limiting between API calls
 */
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const apiDelay = () => delay(USER_STORY_LIMITS.MIN_DELAY_BETWEEN_AI_CALLS_MS);

// ============================================================================
// PIPELINE STEPS
// ============================================================================

/**
 * Step 1: Detect the source language (English or Spanish)
 */
async function detectAndSaveLanguage(
  storyId: string,
  rawContent: string
): Promise<"en" | "es"> {
  const sourceLanguage = await detectLanguage(rawContent);
  await prisma.userStory.update({
    where: { id: storyId },
    data: { sourceLanguage },
  });
  await apiDelay();
  return sourceLanguage;
}

/**
 * Step 2: Generate title if not provided
 */
async function generateTitleIfNeeded(
  storyId: string,
  currentTitle: string,
  rawContent: string,
  sourceLanguage: "en" | "es"
): Promise<void> {
  const isDefaultTitle =
    currentTitle === "Untitled Story" || currentTitle === "Historia sin título";

  if (!isDefaultTitle) return;

  const titles = await extractOrGenerateTitle(rawContent, sourceLanguage);
  await prisma.userStory.update({
    where: { id: storyId },
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
  storyId: string,
  currentDescription: string | null,
  rawContent: string,
  sourceLanguage: "en" | "es"
): Promise<void> {
  if (currentDescription) return;

  const descriptions = await generateDescription(rawContent, sourceLanguage);
  await prisma.userStory.update({
    where: { id: storyId },
    data: {
      description: descriptions.description,
      descriptionEs: descriptions.descriptionEs,
      descriptionEn: descriptions.descriptionEn,
    },
  });
  await apiDelay();
}

/**
 * Step 4: Detect and save CEFR level
 */
async function detectAndSaveLevel(
  storyId: string,
  rawContent: string,
  sourceLanguage: "en" | "es"
): Promise<string> {
  const detectionResult = await detectCEFRLevel(rawContent, sourceLanguage);
  const detectedLevel = detectionResult.levelString;

  console.log(
    `[Pipeline] Detected: ${sourceLanguage.toUpperCase()}, ${detectionResult.cefr}`
  );

  await prisma.userStory.update({
    where: { id: storyId },
    data: { detectedLevel },
  });
  await apiDelay();

  return detectedLevel;
}

/**
 * Step 5: Determine which levels need processing
 * Returns: Set of level strings (e.g., "l2", "l3")
 */
async function determineLevelsToProcess(
  userId: string,
  detectedLevel: string
): Promise<Set<string>> {
  const levelsToProcess = new Set<string>([detectedLevel]);

  const userLevel = await getUserLevel(userId);
  if (userLevel && userLevel !== detectedLevel) {
    levelsToProcess.add(userLevel);
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
 * 4. Detect CEFR level
 * 5. Determine which levels to process (detected + user's level)
 * 6. Process each level (rewrite + translate + paginate)
 * 7. Update final status
 */
export async function processUserStory(storyId: string): Promise<void> {
  console.log(`[Pipeline] Processing story: ${storyId}`);

  const story = await prisma.userStory.findUnique({
    where: { id: storyId },
    include: { levels: true },
  });

  if (!story) {
    throw new Error("Story not found");
  }

  try {
    // Step 1: Detect language
    const sourceLanguage = await detectAndSaveLanguage(storyId, story.rawContent);

    // Step 2: Generate title if needed
    await generateTitleIfNeeded(
      storyId,
      story.title,
      story.rawContent,
      sourceLanguage
    );

    // Step 3: Generate description if needed
    await generateDescriptionIfNeeded(
      storyId,
      story.description,
      story.rawContent,
      sourceLanguage
    );

    // Step 4: Detect CEFR level
    const detectedLevel = await detectAndSaveLevel(
      storyId,
      story.rawContent,
      sourceLanguage
    );

    // Step 5: Determine which levels to process
    const levelsToProcess = await determineLevelsToProcess(
      story.userId,
      detectedLevel
    );

    // Step 6: Process all levels
    const { allSucceeded, anySucceeded } = await processAllLevels(
      story,
      levelsToProcess,
      sourceLanguage,
      detectedLevel
    );

    // Step 7: Update final status
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
  const story = await prisma.userStory.findUnique({
    where: { id: storyId },
    include: { levels: true },
  });

  if (!story) {
    return { success: false, error: "Story not found" };
  }

  const levelRecord = story.levels.find((l) => l.level === level);
  if (!levelRecord) {
    return { success: false, error: `Level ${level} not found` };
  }

  const result = await processLevel({
    storyId: story.id,
    levelId: levelRecord.id,
    level,
    rawContent: story.rawContent,
    sourceLanguage: story.sourceLanguage as "en" | "es",
    detectedLevel: story.detectedLevel || level,
    storySlug: story.slug,
  });

  if (result.success) {
    // Check if all levels are now ready
    const updatedStory = await prisma.userStory.findUnique({
      where: { id: storyId },
      include: { levels: true },
    });

    if (updatedStory) {
      const allReady = updatedStory.levels.every((l) => l.status === "READY");
      const anyReady = updatedStory.levels.some((l) => l.status === "READY");
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
  const story = await prisma.userStory.findUnique({
    where: { id: storyId },
    include: { levels: true },
  });

  if (!story) return null;

  return {
    storyStatus: story.status,
    levels: story.levels.map((l) => ({
      level: l.level,
      status: l.status,
    })),
  };
}
