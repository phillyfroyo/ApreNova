// src/lib/user-stories/chapter-queue.ts
// Producer-consumer queue for streaming rewrite→translate pipeline
//
// Architecture:
// - Producer (GPT): Rewrites chapters and enqueues them
// - Consumer (Claude): Dequeues and translates chapters
// - Queue buffers the difference in processing speeds
//
// This enables parallel processing: GPT rewrite chapter N while Claude
// translates chapter N-1, cutting total processing time by ~50%.

import { ProcessedChapter } from "./level-processor";

// ============================================================================
// TYPES
// ============================================================================

export interface QueuedChapter {
  chapterIndex: number;
  content: string;
  queuedAt: number; // timestamp for debugging
}

export interface QueueProgress {
  rewriteCompleted: number;
  translateCompleted: number;
  totalChapters: number;
}

type ChapterReadyCallback = (chapter: QueuedChapter) => void;
type ProgressCallback = (progress: QueueProgress) => void;
type CompleteCallback = () => void;

// ============================================================================
// STREAMING CHAPTER QUEUE
// ============================================================================

/**
 * Thread-safe queue for streaming chapter processing.
 * Coordinates producer (GPT rewriter) and consumer (Claude translator).
 *
 * Features:
 * - Blocking dequeue: Consumer waits if queue is empty but producer not done
 * - Progress tracking: Reports both rewrite and translate progress
 * - Backpressure: Can signal producer to slow down if queue grows too large
 * - Error tracking: Records failures for potential retry
 */
export class StreamingChapterQueue {
  // Queue state
  private queue: QueuedChapter[] = [];
  private completed: Map<number, ProcessedChapter> = new Map();
  private errors: Map<number, { error: Error; phase: "rewrite" | "translate" }> = new Map();

  // Producer state
  private producerComplete = false;
  private rewriteCount = 0;

  // Consumer waiting state (for blocking dequeue)
  private pendingResolve: ((chapter: QueuedChapter | null) => void) | null = null;

  // Configuration
  private totalChapters: number;

  // Callbacks
  private onChapterReady?: ChapterReadyCallback;
  private onProgress?: ProgressCallback;
  private onAllComplete?: CompleteCallback;

  constructor(totalChapters: number) {
    this.totalChapters = totalChapters;
  }

  // ==========================================================================
  // PRODUCER API (called by GPT rewriter)
  // ==========================================================================

  /**
   * Add a rewritten chapter to the queue.
   * Called by producer after GPT completes rewriting a chapter.
   */
  enqueue(chapter: QueuedChapter): void {
    this.queue.push(chapter);
    this.rewriteCount++;

    // Notify progress
    this.notifyProgress();

    // If consumer is waiting, wake it up
    if (this.pendingResolve) {
      const resolve = this.pendingResolve;
      this.pendingResolve = null;
      resolve(this.queue.shift()!);
    }

    // Notify listeners
    this.onChapterReady?.(chapter);
  }

  /**
   * Signal that producer has finished all rewrites.
   * Consumer will stop waiting after processing remaining queue items.
   */
  markProducerComplete(): void {
    this.producerComplete = true;

    // If consumer is waiting and queue is empty, signal completion
    if (this.pendingResolve && this.queue.length === 0) {
      const resolve = this.pendingResolve;
      this.pendingResolve = null;
      resolve(null);
    }

    this.checkAllComplete();
  }

  /**
   * Record a rewrite error for a chapter.
   * The chapter can still be enqueued with original content for graceful degradation.
   */
  markRewriteError(chapterIndex: number, error: Error): void {
    this.errors.set(chapterIndex, { error, phase: "rewrite" });
  }

  // ==========================================================================
  // CONSUMER API (called by Claude translator)
  // ==========================================================================

  /**
   * Get the next chapter to translate.
   * Blocks if queue is empty but producer hasn't finished yet.
   * Returns null when producer is done and queue is empty.
   */
  async dequeue(): Promise<QueuedChapter | null> {
    // If queue has items, return immediately
    if (this.queue.length > 0) {
      return this.queue.shift()!;
    }

    // If producer is done and queue is empty, signal end
    if (this.producerComplete) {
      return null;
    }

    // Wait for producer to add items
    return new Promise((resolve) => {
      this.pendingResolve = resolve;
    });
  }

  /**
   * Mark a chapter as successfully translated.
   */
  markTranslateComplete(chapterIndex: number, result: ProcessedChapter): void {
    this.completed.set(chapterIndex, result);
    this.notifyProgress();
    this.checkAllComplete();
  }

  /**
   * Record a translation error for a chapter.
   */
  markTranslateError(chapterIndex: number, error: Error): void {
    this.errors.set(chapterIndex, { error, phase: "translate" });
  }

  // ==========================================================================
  // BACKPRESSURE API (for rate limiting)
  // ==========================================================================

  /**
   * Check if producer should slow down (queue getting too large).
   */
  shouldApplyBackpressure(threshold: number): boolean {
    return this.queue.length >= threshold;
  }

  /**
   * Get current queue size.
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  // ==========================================================================
  // PROGRESS & STATE
  // ==========================================================================

  /**
   * Get current progress for both streams.
   */
  getProgress(): QueueProgress {
    return {
      rewriteCompleted: this.rewriteCount,
      translateCompleted: this.completed.size,
      totalChapters: this.totalChapters,
    };
  }

  /**
   * Get all completed translations in order.
   */
  getCompletedChapters(): ProcessedChapter[] {
    const result: ProcessedChapter[] = [];
    for (let i = 0; i < this.totalChapters; i++) {
      const chapter = this.completed.get(i);
      if (chapter) {
        result.push(chapter);
      }
    }
    return result;
  }

  /**
   * Get all errors that occurred.
   */
  getErrors(): Array<{ chapterIndex: number; error: Error; phase: "rewrite" | "translate" }> {
    return Array.from(this.errors.entries()).map(([chapterIndex, data]) => ({
      chapterIndex,
      ...data,
    }));
  }

  /**
   * Check if all chapters completed successfully.
   */
  allSucceeded(): boolean {
    return this.completed.size === this.totalChapters && this.errors.size === 0;
  }

  /**
   * Check if any chapters completed successfully.
   */
  anySucceeded(): boolean {
    return this.completed.size > 0;
  }

  // ==========================================================================
  // CALLBACKS
  // ==========================================================================

  setProgressCallback(callback: ProgressCallback): void {
    this.onProgress = callback;
  }

  setCompleteCallback(callback: CompleteCallback): void {
    this.onAllComplete = callback;
  }

  setChapterReadyCallback(callback: ChapterReadyCallback): void {
    this.onChapterReady = callback;
  }

  // ==========================================================================
  // INTERNAL
  // ==========================================================================

  private notifyProgress(): void {
    this.onProgress?.(this.getProgress());
  }

  private checkAllComplete(): void {
    // All complete when producer is done and all chapters are translated
    if (this.producerComplete && this.completed.size === this.totalChapters) {
      this.onAllComplete?.();
    }
  }
}
