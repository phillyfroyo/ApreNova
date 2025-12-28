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

export interface ProcessingProgress {
  stage: "rewriting" | "translating" | "complete";
  currentChapter: number;
  totalChapters: number;
  chaptersCompleted: number[];
  completedData?: ChapterTranslationData[];
  rewriteData?: ChapterRewriteData[];
}

export type LevelStatus = "PENDING" | "PROCESSING" | "READY" | "FAILED";
export type StoryStatus = "PROCESSING" | "READY" | "PARTIAL" | "FAILED";

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
