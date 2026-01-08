// src/lib/user-stories/progress-tracker.ts
// Centralized progress tracking for user story processing

import { prisma } from "@/lib/prisma";

// ============================================================================
// TYPES
// ============================================================================

export interface ChapterTranslationData {
  sourceLines: string[];
  translatedLines: string[];
}

export interface ChapterRewriteData {
  originalLines: string[];
  rewrittenLines: string[];
}

// Level-specific progress (for rewriting/translating chapters)
// Supports both sequential and streaming (parallel) pipelines
export interface ProcessingProgress {
  stage: "rewriting" | "translating" | "complete";
  currentChapter: number;
  totalChapters: number;
  chaptersCompleted: number[];
  completedData?: ChapterTranslationData[];
  rewriteData?: ChapterRewriteData[];
  // Extended fields for detailed UI
  stepLabel?: string;
  // Streaming pipeline: track rewrite progress separately from stage
  // (since stage bounces between rewriting/translating in parallel)
  rewriteProgress?: {
    currentChapter: number;
    chaptersCompleted: number;
  };
  translateProgress?: {
    currentChapter: number;
    chaptersCompleted: number;
  };
}

// Story-level progress phases
export type StoryPhase = "detecting" | "adapting" | "translating" | "finalizing";

// Story-level progress steps
export type StoryStep =
  | "creating_record"
  | "creating_levels"
  | "detecting_language"
  | "generating_metadata"  // NEW: batched metadata generation (replaces individual steps)
  | "generating_title"     // @deprecated - use generating_metadata
  | "generating_description" // @deprecated - use generating_metadata
  | "generating_hook"      // @deprecated - use generating_metadata
  | "detecting_story_type" // @deprecated - use generating_metadata
  | "detecting_audience"   // @deprecated - use generating_metadata
  | "extracting_tags"      // @deprecated - use generating_metadata
  | "detecting_level"
  | "cleaning_text"
  | "parsing_chapters"
  | "rewriting_levels"    // New: starting rewrite phase for all levels
  | "rewriting_chapter"
  | "translating_levels"  // New: starting translate phase for all levels
  | "translating_chapter"
  | "building_levels"     // New: starting build phase for all levels
  | "building_structure"
  | "saving_content"
  | "complete";

// Story-level progress (stored on UserStory.processingProgress)
export interface StoryProcessingProgress {
  phase: StoryPhase;
  step: StoryStep;
  stepLabel: string;
  // For chapter-based steps
  chapterCurrent?: number;
  chapterTotal?: number;
  // Current level being processed
  currentLevel?: string;
  timestamp: string;
}

// Step definitions with labels
export const STEP_LABELS: Record<StoryStep, string> = {
  creating_record: "Creating story record",
  creating_levels: "Preparing reading levels",
  detecting_language: "Detecting language",
  generating_metadata: "Analyzing story metadata",  // NEW: batched
  generating_title: "Generating title",             // @deprecated
  generating_description: "Generating description", // @deprecated
  generating_hook: "Generating hook",               // @deprecated
  detecting_story_type: "Detecting story type",     // @deprecated
  detecting_audience: "Detecting target audience",  // @deprecated
  extracting_tags: "Extracting tags",               // @deprecated
  detecting_level: "Detecting CEFR level",
  cleaning_text: "Cleaning text",
  parsing_chapters: "Parsing chapters",
  rewriting_levels: "Adapting to reading levels",
  rewriting_chapter: "Rewriting chapter",
  translating_levels: "Translating all levels",
  translating_chapter: "Translating chapter",
  building_levels: "Building all levels",
  building_structure: "Building content structure",
  saving_content: "Saving level content",
  complete: "Complete",
};

// Map steps to phases
export const STEP_PHASES: Record<StoryStep, StoryPhase> = {
  creating_record: "detecting",
  creating_levels: "detecting",
  detecting_language: "detecting",
  generating_metadata: "detecting",  // NEW: batched
  generating_title: "detecting",     // @deprecated
  generating_description: "detecting", // @deprecated
  generating_hook: "detecting",      // @deprecated
  detecting_story_type: "detecting", // @deprecated
  detecting_audience: "detecting",   // @deprecated
  extracting_tags: "detecting",      // @deprecated
  detecting_level: "detecting",
  cleaning_text: "adapting",
  parsing_chapters: "adapting",
  rewriting_levels: "adapting",
  rewriting_chapter: "adapting",
  translating_levels: "translating",
  translating_chapter: "translating",
  building_levels: "finalizing",
  building_structure: "finalizing",
  saving_content: "finalizing",
  complete: "finalizing",
};

export type LevelStatus = "PENDING" | "PROCESSING" | "READY" | "FAILED";
export type StoryStatus = "PROCESSING" | "READY" | "PARTIAL" | "FAILED";

// ============================================================================
// STORY PROGRESS HELPER
// ============================================================================

/**
 * Update story-level processing progress
 */
export async function updateStoryProgress(
  storyId: string,
  step: StoryStep,
  options?: {
    chapterCurrent?: number;
    chapterTotal?: number;
    currentLevel?: string;
  }
): Promise<void> {
  const phase = STEP_PHASES[step];
  let stepLabel = STEP_LABELS[step];

  // Add chapter info to label if applicable
  if (options?.chapterCurrent !== undefined && options?.chapterTotal !== undefined) {
    stepLabel = `${stepLabel} ${options.chapterCurrent} of ${options.chapterTotal}`;
  }

  const progress: StoryProcessingProgress = {
    phase,
    step,
    stepLabel,
    chapterCurrent: options?.chapterCurrent,
    chapterTotal: options?.chapterTotal,
    currentLevel: options?.currentLevel,
    timestamp: new Date().toISOString(),
  };

  await prisma.userStory.update({
    where: { id: storyId },
    data: { processingProgress: progress as any },
  });
}

// ============================================================================
// PROGRESS TRACKER CLASS
// ============================================================================

/**
 * Encapsulates all progress tracking logic for a single level
 * Reduces boilerplate and ensures consistent progress updates
 *
 * Supports both sequential and streaming (parallel) pipelines.
 * In streaming mode, rewrite and translate progress are tracked separately
 * and merged to avoid race conditions.
 */
export class LevelProgressTracker {
  private levelId: string;
  private totalChapters: number;
  private rewriteData: ChapterRewriteData[] = [];
  private translationData: ChapterTranslationData[] = [];

  constructor(levelId: string, totalChapters: number) {
    this.levelId = levelId;
    this.totalChapters = totalChapters;
  }

  /**
   * Mark level as processing
   */
  async startProcessing(): Promise<void> {
    await prisma.userStoryLevel.update({
      where: { id: this.levelId },
      data: { status: "PROCESSING" },
    });
  }

  /**
   * Initialize rewriting stage
   */
  async startRewriting(): Promise<void> {
    // Merge with existing progress to support streaming pipeline
    await this.mergeProgress({
      stage: "rewriting",
      currentChapter: 0,
      rewriteData: [],
      rewriteProgress: { currentChapter: 0, chaptersCompleted: 0 },
    });
  }

  /**
   * Update progress during rewriting
   */
  async updateRewriteProgress(
    currentChapter: number,
    chapterData?: ChapterRewriteData
  ): Promise<void> {
    if (chapterData) {
      this.rewriteData.push(chapterData);
    }

    // Merge to preserve translation progress in streaming mode
    await this.mergeProgress({
      stage: "rewriting",
      currentChapter,
      rewriteData: this.rewriteData,
      rewriteProgress: {
        currentChapter,
        chaptersCompleted: this.rewriteData.length,
      },
    });
  }

  /**
   * Initialize translation stage
   */
  async startTranslating(): Promise<void> {
    this.translationData = [];
    // Merge with existing progress to preserve rewrite data in streaming mode
    await this.mergeProgress({
      stage: "translating",
      currentChapter: 0,
      completedData: [],
      translateProgress: { currentChapter: 0, chaptersCompleted: 0 },
    });
  }

  /**
   * Update progress during translation
   */
  async updateTranslationProgress(
    currentChapter: number,
    chapterData?: ChapterTranslationData
  ): Promise<void> {
    if (chapterData) {
      this.translationData.push(chapterData);
    }

    // Merge to preserve rewrite data in streaming mode
    await this.mergeProgress({
      stage: "translating",
      currentChapter,
      completedData: this.translationData,
      chaptersCompleted: this.translationData.map((_, idx) => idx),
      translateProgress: {
        currentChapter,
        chaptersCompleted: this.translationData.length,
      },
    });
  }

  /**
   * Mark level as complete with final content
   * Preserves rewriteData and completedData for preview functionality
   */
  async markComplete(content: unknown): Promise<void> {
    // Read existing progress to preserve rewriteData and completedData for preview
    const level = await prisma.userStoryLevel.findUnique({
      where: { id: this.levelId },
      select: { processingProgress: true },
    });

    const existing = (level?.processingProgress as unknown as ProcessingProgress) || {};

    await prisma.userStoryLevel.update({
      where: { id: this.levelId },
      data: {
        content: content as any,
        status: "READY",
        processingProgress: {
          stage: "complete",
          currentChapter: this.totalChapters,
          totalChapters: this.totalChapters,
          chaptersCompleted: Array.from({ length: this.totalChapters }, (_, i) => i),
          // Preserve chapter data for preview modal
          rewriteData: existing.rewriteData,
          completedData: existing.completedData,
          rewriteProgress: existing.rewriteProgress,
          translateProgress: existing.translateProgress,
        } as any,
      },
    });
  }

  /**
   * Mark level as failed
   */
  async markFailed(): Promise<void> {
    await prisma.userStoryLevel.update({
      where: { id: this.levelId },
      data: { status: "FAILED" },
    });
  }

  /**
   * Merge progress update with existing progress.
   * This is critical for streaming pipeline where rewrite and translate
   * run in parallel and must not overwrite each other's data.
   */
  private async mergeProgress(updates: Partial<ProcessingProgress>): Promise<void> {
    // Read current progress
    const level = await prisma.userStoryLevel.findUnique({
      where: { id: this.levelId },
      select: { processingProgress: true },
    });

    const existing = (level?.processingProgress as unknown as ProcessingProgress) || {};

    // Merge: new values override, but preserve fields not in updates
    const merged: ProcessingProgress = {
      stage: updates.stage || existing.stage || "rewriting",
      currentChapter: updates.currentChapter ?? existing.currentChapter ?? 0,
      totalChapters: this.totalChapters,
      chaptersCompleted: updates.chaptersCompleted || existing.chaptersCompleted || [],
      // Preserve rewrite data if not being updated
      rewriteData: updates.rewriteData ?? existing.rewriteData,
      rewriteProgress: updates.rewriteProgress ?? existing.rewriteProgress,
      // Preserve translation data if not being updated
      completedData: updates.completedData ?? existing.completedData,
      translateProgress: updates.translateProgress ?? existing.translateProgress,
    };

    await prisma.userStoryLevel.update({
      where: { id: this.levelId },
      data: { processingProgress: merged as any },
    });
  }
}

// ============================================================================
// STORY-LEVEL STATUS UPDATES
// ============================================================================

/**
 * Update the overall story status based on level processing results
 */
export async function updateStoryStatus(
  storyId: string,
  status: StoryStatus
): Promise<void> {
  await prisma.userStory.update({
    where: { id: storyId },
    data: { status },
  });
}

/**
 * Determine final story status based on level results
 */
export function determineFinalStatus(
  allSucceeded: boolean,
  anySucceeded: boolean
): StoryStatus {
  if (allSucceeded && anySucceeded) return "READY";
  if (anySucceeded) return "PARTIAL";
  return "FAILED";
}
