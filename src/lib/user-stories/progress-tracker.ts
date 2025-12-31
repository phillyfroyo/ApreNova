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
export interface ProcessingProgress {
  stage: "rewriting" | "translating" | "complete";
  currentChapter: number;
  totalChapters: number;
  chaptersCompleted: number[];
  completedData?: ChapterTranslationData[];
  rewriteData?: ChapterRewriteData[];
  // Extended fields for detailed UI
  stepLabel?: string;
}

// Story-level progress phases
export type StoryPhase = "detecting" | "adapting" | "translating" | "finalizing";

// Story-level progress steps
export type StoryStep =
  | "creating_record"
  | "creating_levels"
  | "detecting_language"
  | "generating_title"
  | "generating_description"
  | "generating_hook"
  | "detecting_story_type"
  | "detecting_audience"
  | "extracting_tags"
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
  generating_title: "Generating title",
  generating_description: "Generating description",
  generating_hook: "Generating hook",
  detecting_story_type: "Detecting story type",
  detecting_audience: "Detecting target audience",
  extracting_tags: "Extracting tags",
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
  generating_title: "detecting",
  generating_description: "detecting",
  generating_hook: "detecting",
  detecting_story_type: "detecting",
  detecting_audience: "detecting",
  extracting_tags: "detecting",
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
    await this.updateProgress({
      stage: "rewriting",
      currentChapter: 0,
      totalChapters: this.totalChapters,
      chaptersCompleted: [],
      rewriteData: [],
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

    await this.updateProgress({
      stage: "rewriting",
      currentChapter,
      totalChapters: this.totalChapters,
      chaptersCompleted: this.rewriteData.map((_, idx) => idx),
      rewriteData: this.rewriteData,
    });
  }

  /**
   * Initialize translation stage
   */
  async startTranslating(): Promise<void> {
    this.translationData = [];
    await this.updateProgress({
      stage: "translating",
      currentChapter: 0,
      totalChapters: this.totalChapters,
      chaptersCompleted: [],
      completedData: [],
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

    await this.updateProgress({
      stage: "translating",
      currentChapter,
      totalChapters: this.totalChapters,
      chaptersCompleted: this.translationData.map((_, idx) => idx),
      completedData: this.translationData,
    });
  }

  /**
   * Mark level as complete with final content
   */
  async markComplete(content: unknown): Promise<void> {
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
   * Internal helper to update progress JSON field
   */
  private async updateProgress(progress: ProcessingProgress): Promise<void> {
    await prisma.userStoryLevel.update({
      where: { id: this.levelId },
      data: { processingProgress: progress as any },
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
