// src/lib/user-stories/progress-tracker.ts
// Centralized progress tracking for user story processing

import { prisma } from "@/lib/prisma";
import type { ChapterAlignmentResult } from "./alignment-check";

// ============================================================================
// TYPES
// ============================================================================

/** Poem info for anthology navigation */
export interface PoemInfo {
  number: number;
  title: string;
  startPage: number;
  endPage: number;
  pageCount: number;
}

/** Story line with translations and metadata */
export interface BuiltStoryLine {
  es: string;
  en: string;
  stanzaNumber?: number;
  isStanzaBreak?: boolean;
  // Anthology poem tracking
  poemNumber?: number;
  poemTitle?: string;
  isFirstPageOfPoem?: boolean;
  isContinuation?: boolean;
}

/** Pre-built page content (same structure as final content) */
export interface BuiltPageContent {
  lines?: BuiltStoryLine[];
  stanzas?: BuiltStoryLine[][];
  // Anthology poem tracking
  poemNumber?: number;
  poemTitle?: string;
  isFirstPageOfPoem?: boolean;
  isContinuation?: boolean;
}

export interface ChapterTranslationData {
  sourceLines: string[];
  translatedLines: string[];
  // Pre-built paginated content (for streaming to match final output)
  builtPages?: Record<number, BuiltPageContent>;
  // Poem info for anthology navigation
  poems?: PoemInfo[];
  // Chapter metadata
  metadata?: {
    number: number;
    title: string;
    subtitle?: string;
  };
  // Alignment check results
  alignmentIssues?: ChapterAlignmentResult;
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
  // Alignment issue tracking
  hasAlignmentIssues?: boolean;
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
  // Total word count for time estimation (set once after parsing)
  totalWords?: number;
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
 * Silently fails if story was deleted (to allow pipeline to exit gracefully)
 */
export async function updateStoryProgress(
  storyId: string,
  step: StoryStep,
  options?: {
    chapterCurrent?: number;
    chapterTotal?: number;
    currentLevel?: string;
    totalWords?: number;
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
    totalWords: options?.totalWords,
    timestamp: new Date().toISOString(),
  };

  try {
    // Preserve totalWords from previous progress if not provided in this update
    if (!progress.totalWords) {
      const existing = await prisma.userStory.findUnique({
        where: { id: storyId },
        select: { processingProgress: true },
      });
      const prev = existing?.processingProgress as StoryProcessingProgress | null;
      if (prev?.totalWords) {
        progress.totalWords = prev.totalWords;
      }
    }

    await prisma.userStory.update({
      where: { id: storyId },
      data: { processingProgress: progress as any },
    });
  } catch (error: any) {
    // If story was deleted, just log and continue - pipeline will exit on next cancellation check
    if (error?.code === "P2025") {
      console.log(`[updateStoryProgress] Story ${storyId} was deleted, skipping update`);
      return;
    }
    throw error;
  }
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
   * Silently fails if level/story was deleted
   */
  async startProcessing(): Promise<void> {
    try {
      await prisma.userStoryLevel.update({
        where: { id: this.levelId },
        data: { status: "PROCESSING" },
      });
    } catch (error: any) {
      if (error?.code === "P2025") {
        console.log(`[LevelProgressTracker] Level ${this.levelId} was deleted, skipping startProcessing`);
        return;
      }
      throw error;
    }
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
   * Update progress during translation.
   * Content is also written to content field via updateChapterContent() for reading.
   * This method stores raw source/translated lines in completedData for the
   * ComparisonModal (preserving blank lines for display), matching how
   * updateRewriteProgress stores rewriteData.
   */
  async updateTranslationProgress(
    currentChapter: number,
    chapterData?: ChapterTranslationData
  ): Promise<void> {
    if (chapterData) {
      this.translationData.push(chapterData);
    }

    // For progress tracking, use currentChapter as the count of completed chapters
    // (since we call this after each chapter completes)
    const chaptersCompleted = currentChapter;

    // Merge to preserve rewrite data in streaming mode
    await this.mergeProgress({
      stage: "translating",
      currentChapter,
      completedData: this.translationData.length > 0 ? this.translationData : undefined,
      chaptersCompleted: Array.from({ length: chaptersCompleted }, (_, i) => i),
      translateProgress: {
        currentChapter,
        chaptersCompleted,
      },
    });
  }

  /**
   * Write a completed chapter directly to the content field.
   * This provides a single source of truth - the same content is used for
   * both "read while uploading" and after processing completes.
   *
   * @param chapterNumber - 1-based chapter number
   * @param chapterContent - The built chapter content (pages, metadata, poems)
   * @param contentMetadata - Level-wide metadata (storySlug, level, hasChapters, structureType)
   */
  async updateChapterContent(
    chapterNumber: number,
    chapterContent: {
      pages: Record<number, BuiltPageContent>;
      metadata?: { number: number; title: string; subtitle?: string };
      poems?: PoemInfo[];
      alignmentIssues?: ChapterAlignmentResult;
    },
    contentMetadata: {
      storySlug: string;
      level: number;
      hasChapters: boolean;
      structureType?: "prose" | "anthology" | "epic" | "script";
    }
  ): Promise<void> {
    try {
      // Read existing content to merge with new chapter
      const level = await prisma.userStoryLevel.findUnique({
        where: { id: this.levelId },
        select: { content: true },
      });

      if (!level) {
        console.log(`[LevelProgressTracker] Level ${this.levelId} was deleted, skipping updateChapterContent`);
        return;
      }

      // Get existing content or initialize new structure
      const existingContent = (level.content as any) || {
        storySlug: contentMetadata.storySlug,
        level: contentMetadata.level,
        hasChapters: contentMetadata.hasChapters,
        structureType: contentMetadata.structureType,
        chapters: {},
      };

      // Merge the new chapter into existing content
      const updatedContent = {
        ...existingContent,
        // Ensure metadata is set (in case this is the first chapter)
        storySlug: contentMetadata.storySlug,
        level: contentMetadata.level,
        hasChapters: contentMetadata.hasChapters,
        structureType: contentMetadata.structureType,
        chapters: {
          ...existingContent.chapters,
          [chapterNumber]: chapterContent,
        },
      };

      await prisma.userStoryLevel.update({
        where: { id: this.levelId },
        data: {
          content: updatedContent as any,
        },
      });

      console.log(`[LevelProgressTracker] Updated content with chapter ${chapterNumber} (${Object.keys(chapterContent.pages).length} pages)`);
    } catch (error: any) {
      if (error?.code === "P2025") {
        console.log(`[LevelProgressTracker] Level ${this.levelId} was deleted, skipping updateChapterContent`);
        return;
      }
      throw error;
    }
  }

  /**
   * Mark level as complete with final content
   * Preserves rewriteData and completedData for preview functionality
   * Silently fails if level/story was deleted
   */
  async markComplete(content: unknown): Promise<void> {
    try {
      // Read existing progress to preserve rewriteData and completedData for preview
      const level = await prisma.userStoryLevel.findUnique({
        where: { id: this.levelId },
        select: { processingProgress: true },
      });

      // Level was deleted, exit gracefully
      if (!level) {
        console.log(`[LevelProgressTracker] Level ${this.levelId} was deleted, skipping markComplete`);
        return;
      }

      const existing = (level.processingProgress as unknown as ProcessingProgress) || {};

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
    } catch (error: any) {
      if (error?.code === "P2025") {
        console.log(`[LevelProgressTracker] Level ${this.levelId} was deleted, skipping markComplete`);
        return;
      }
      throw error;
    }
  }

  /**
   * Mark level as failed
   * Silently fails if level/story was deleted
   */
  async markFailed(): Promise<void> {
    try {
      await prisma.userStoryLevel.update({
        where: { id: this.levelId },
        data: { status: "FAILED" },
      });
    } catch (error: any) {
      if (error?.code === "P2025") {
        console.log(`[LevelProgressTracker] Level ${this.levelId} was deleted, skipping markFailed`);
        return;
      }
      throw error;
    }
  }

  /**
   * Merge progress update with existing progress.
   * This is critical for streaming pipeline where rewrite and translate
   * run in parallel and must not overwrite each other's data.
   * Silently fails if level/story was deleted
   */
  private async mergeProgress(updates: Partial<ProcessingProgress>): Promise<void> {
    try {
      // Read current progress
      const level = await prisma.userStoryLevel.findUnique({
        where: { id: this.levelId },
        select: { processingProgress: true },
      });

      // Level was deleted, exit gracefully
      if (!level) {
        console.log(`[LevelProgressTracker] Level ${this.levelId} was deleted, skipping mergeProgress`);
        return;
      }

      const existing = (level.processingProgress as unknown as ProcessingProgress) || {};

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
    } catch (error: any) {
      if (error?.code === "P2025") {
        console.log(`[LevelProgressTracker] Level ${this.levelId} was deleted, skipping mergeProgress`);
        return;
      }
      throw error;
    }
  }
}

// ============================================================================
// CANCELLATION CHECK
// ============================================================================

/**
 * Check if a story has been cancelled or deleted.
 * Call this before processing each chapter to stop early if user cancelled.
 * @returns true if the story has been cancelled OR deleted, false otherwise
 */
export async function isStoryCancelled(storyId: string): Promise<boolean> {
  const story = await prisma.userStory.findUnique({
    where: { id: storyId },
    select: { cancelledAt: true },
  });
  // Treat deleted stories (story === null) as cancelled
  // This allows the pipeline to exit gracefully if user deletes during processing
  if (!story) return true;
  return story.cancelledAt !== null && story.cancelledAt !== undefined;
}

/**
 * Custom error class for cancelled stories
 */
export class StoryCancelledError extends Error {
  constructor(storyId: string) {
    super(`Story ${storyId} was cancelled by user`);
    this.name = "StoryCancelledError";
  }
}

/**
 * Throttled cancellation checker - checks DB at most once every N seconds.
 * Use this inside long-running loops (like stanza-by-stanza processing) to
 * avoid excessive DB queries while still catching cancellations reasonably quickly.
 *
 * Usage:
 *   const checker = createThrottledCancellationChecker(storyId, 10000); // 10 seconds
 *   for (const item of items) {
 *     await checker.checkIfCancelled(); // Throws StoryCancelledError if cancelled
 *     // ... process item
 *   }
 */
export function createThrottledCancellationChecker(
  storyId: string,
  intervalMs: number = 10000 // Default: check every 10 seconds
) {
  let lastCheckTime = 0;
  let cachedResult = false;

  return {
    /**
     * Check if the story has been cancelled.
     * Only queries DB if intervalMs has passed since last check.
     * @throws StoryCancelledError if the story was cancelled
     */
    async checkIfCancelled(): Promise<void> {
      const now = Date.now();

      // Only check DB if enough time has passed
      if (now - lastCheckTime >= intervalMs) {
        lastCheckTime = now;
        cachedResult = await isStoryCancelled(storyId);
      }

      if (cachedResult) {
        throw new StoryCancelledError(storyId);
      }
    },

    /**
     * Force an immediate check, ignoring the throttle.
     * Use this at major boundaries (like end of chapter).
     * @throws StoryCancelledError if the story was cancelled
     */
    async forceCheck(): Promise<void> {
      lastCheckTime = Date.now();
      cachedResult = await isStoryCancelled(storyId);
      if (cachedResult) {
        throw new StoryCancelledError(storyId);
      }
    },
  };
}

// ============================================================================
// STORY-LEVEL STATUS UPDATES
// ============================================================================

/**
 * Update the overall story status based on level processing results
 * Silently fails if story was deleted (to allow pipeline to exit gracefully)
 */
export async function updateStoryStatus(
  storyId: string,
  status: StoryStatus
): Promise<void> {
  try {
    await prisma.userStory.update({
      where: { id: storyId },
      data: { status },
    });
  } catch (error: any) {
    // If story was deleted, just log and continue
    if (error?.code === "P2025") {
      console.log(`[updateStoryStatus] Story ${storyId} was deleted, skipping update`);
      return;
    }
    throw error;
  }
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
