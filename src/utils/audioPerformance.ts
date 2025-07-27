// src/utils/audioPerformance.ts
import type { 
  AudioPerformanceMetrics, 
  StoryAudioSession, 
  SentenceAudioData,
  TTSSpeed,
  BatchAudioRequest,
  BatchAudioResponse 
} from '@/types/azure-tts';

export class AudioPerformanceOptimizer {
  private performanceData: Map<string, AudioPerformanceMetrics> = new Map();
  private sessionData: StoryAudioSession | null = null;
  private preloadQueue: Set<string> = new Set();
  private retryDelays = [1000, 2000, 4000, 8000]; // Exponential backoff

  /**
   * Initialize a new audio session
   */
  initSession(
    storySlug: string, 
    level: string, 
    chapter: number, 
    page: number,
    sentences: string[]
  ): void {
    this.sessionData = {
      storySlug,
      level,
      chapter,
      page,
      startTime: Date.now(),
      sentences: sentences.map((text, index) => ({
        sentenceIndex: index,
        text,
        language: level.includes('en') ? 'en-US' : 'es-ES',
        speed: 'normal',
        isLoading: false,
        hasError: false
      })),
      metrics: {
        ttsGenerationTime: 0,
        audioLoadTime: 0,
        firstWordTime: 0,
        totalPlaybackTime: 0,
        cacheHitRate: 0,
        errorRate: 0,
        retryCount: 0
      },
      userPreferences: {
        preferredSpeed: 'normal',
        highlightStyle: 'subtle',
        autoplay: false
      }
    };
  }

  /**
   * Create optimized batch request for multiple sentences
   */
  createBatchRequest(
    sentences: Array<{ text: string; index: number }>,
    language: 'es-ES' | 'en-US',
    speeds: TTSSpeed[] = ['normal', 'slow'],
    storyContext: { storySlug: string; level: string; chapter: number; page: number }
  ): BatchAudioRequest {
    // Prioritize sentences based on likelihood of being played
    const prioritizedSentences = sentences.map((sentence, index) => ({
      ...sentence,
      priority: index < 3 ? 'high' : index < 6 ? 'normal' : 'low'
    })) as Array<{ text: string; index: number; priority: 'high' | 'normal' | 'low' }>;

    return {
      sentences: prioritizedSentences,
      language,
      speeds,
      storyContext,
      options: {
        parallel: true,
        maxConcurrent: 3, // Prevent overwhelming the service
        timeout: 30000 // 30 second timeout
      }
    };
  }

  /**
   * Intelligent preloading strategy
   */
  async preloadAudio(
    currentIndex: number,
    totalSentences: number,
    generateTTSFn: (text: string, language: 'es-ES' | 'en-US', speed: TTSSpeed) => Promise<any>
  ): Promise<void> {
    if (!this.sessionData) return;

    const strategy = this.getPreloadStrategy(currentIndex, totalSentences);
    const promises: Promise<any>[] = [];

    for (const sentenceIndex of strategy.indicesToPreload) {
      const sentence = this.sessionData.sentences[sentenceIndex];
      if (!sentence || this.preloadQueue.has(`${sentenceIndex}-normal`)) continue;

      // Mark as queued
      this.preloadQueue.add(`${sentenceIndex}-normal`);
      this.preloadQueue.add(`${sentenceIndex}-slow`);

      // Preload both speeds
      promises.push(
        generateTTSFn(sentence.text, sentence.language, 'normal')
          .catch(error => console.warn(`Preload failed for sentence ${sentenceIndex}:`, error)),
        generateTTSFn(sentence.text, sentence.language, 'slow')
          .catch(error => console.warn(`Preload slow failed for sentence ${sentenceIndex}:`, error))
      );
    }

    try {
      await Promise.all(promises);
      console.log(`Preloaded ${strategy.indicesToPreload.length} sentences`);
    } catch (error) {
      console.warn('Batch preload failed:', error);
    }
  }

  /**
   * Determine which sentences to preload based on current position
   */
  private getPreloadStrategy(currentIndex: number, totalSentences: number) {
    const indicesToPreload: number[] = [];

    // Always preload next 2 sentences
    for (let i = currentIndex + 1; i <= Math.min(currentIndex + 2, totalSentences - 1); i++) {
      indicesToPreload.push(i);
    }

    // If near the beginning, preload more ahead
    if (currentIndex < 3) {
      for (let i = currentIndex + 3; i <= Math.min(currentIndex + 4, totalSentences - 1); i++) {
        indicesToPreload.push(i);
      }
    }

    // Also preload previous sentence for easy replay
    if (currentIndex > 0) {
      indicesToPreload.push(currentIndex - 1);
    }

    return { indicesToPreload };
  }

  /**
   * Retry logic with exponential backoff
   */
  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    context: string,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        
        if (attempt > 0) {
          this.recordRetry(context, attempt);
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          this.recordError(context, lastError);
          throw lastError;
        }

        const delay = this.retryDelays[Math.min(attempt, this.retryDelays.length - 1)];
        console.warn(`${context} failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * Record performance metrics
   */
  recordTiming(operation: string, startTime: number, endTime: number): void {
    const duration = endTime - startTime;
    
    if (!this.sessionData) return;

    switch (operation) {
      case 'tts-generation':
        this.sessionData.metrics.ttsGenerationTime += duration;
        break;
      case 'audio-load':
        this.sessionData.metrics.audioLoadTime += duration;
        break;
      case 'first-word':
        this.sessionData.metrics.firstWordTime = duration;
        break;
      case 'playback':
        this.sessionData.metrics.totalPlaybackTime += duration;
        break;
    }
  }

  /**
   * Record cache hit/miss
   */
  recordCacheEvent(hit: boolean): void {
    if (!this.sessionData) return;
    
    // Simple running average
    const current = this.sessionData.metrics.cacheHitRate;
    this.sessionData.metrics.cacheHitRate = hit ? 
      (current + 1) / 2 : 
      current / 2;
  }

  /**
   * Record retry attempt
   */
  private recordRetry(context: string, attemptNumber: number): void {
    if (this.sessionData) {
      this.sessionData.metrics.retryCount += 1;
    }
    console.log(`Retry successful for ${context} on attempt ${attemptNumber + 1}`);
  }

  /**
   * Record error
   */
  private recordError(context: string, error: Error): void {
    if (!this.sessionData) return;
    
    this.sessionData.metrics.errorRate += 1;
    console.error(`Final failure for ${context}:`, error);
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): AudioPerformanceMetrics | null {
    return this.sessionData?.metrics || null;
  }

  /**
   * Optimize memory usage by cleaning up old preload data
   */
  cleanupPreloadQueue(currentIndex: number): void {
    // Remove preload entries for sentences far behind current position
    const toRemove: string[] = [];
    
    for (const key of this.preloadQueue) {
      const [indexStr] = key.split('-');
      const index = parseInt(indexStr);
      
      // Keep items within 5 sentences of current position
      if (Math.abs(index - currentIndex) > 5) {
        toRemove.push(key);
      }
    }
    
    toRemove.forEach(key => this.preloadQueue.delete(key));
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    if (!this.sessionData) return 'No session data available';

    const metrics = this.sessionData.metrics;
    const duration = Date.now() - this.sessionData.startTime;

    return `
Audio Performance Report:
========================
Session Duration: ${(duration / 1000).toFixed(1)}s
TTS Generation: ${metrics.ttsGenerationTime.toFixed(0)}ms avg
Audio Load Time: ${metrics.audioLoadTime.toFixed(0)}ms avg
Cache Hit Rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%
Error Rate: ${metrics.errorRate} errors
Retry Count: ${metrics.retryCount} retries
Total Playback: ${(metrics.totalPlaybackTime / 1000).toFixed(1)}s

Sentences Processed: ${this.sessionData.sentences.length}
Story: ${this.sessionData.storySlug}
Level: ${this.sessionData.level}
Page: ${this.sessionData.chapter}/${this.sessionData.page}
    `.trim();
  }

  /**
   * Reset session data
   */
  endSession(): void {
    if (this.sessionData) {
      this.sessionData.endTime = Date.now();
      
      // Log final report in development
      if (process.env.NODE_ENV === 'development') {
        console.log(this.generateReport());
      }
    }
    
    this.sessionData = null;
    this.preloadQueue.clear();
  }

  /**
   * Check if audio system is performing well
   */
  isPerformingWell(): boolean {
    const metrics = this.getMetrics();
    if (!metrics) return true;

    return (
      metrics.errorRate < 0.1 && // Less than 10% error rate
      metrics.cacheHitRate > 0.5 && // More than 50% cache hits
      metrics.ttsGenerationTime < 5000 // Less than 5s generation time
    );
  }

  /**
   * Get performance recommendations
   */
  getRecommendations(): string[] {
    const metrics = this.getMetrics();
    const recommendations: string[] = [];

    if (!metrics) return recommendations;

    if (metrics.errorRate > 0.2) {
      recommendations.push('High error rate detected - check network connection');
    }

    if (metrics.cacheHitRate < 0.3) {
      recommendations.push('Low cache hit rate - consider preloading more content');
    }

    if (metrics.ttsGenerationTime > 8000) {
      recommendations.push('Slow TTS generation - may need to reduce concurrent requests');
    }

    if (metrics.retryCount > 10) {
      recommendations.push('Frequent retries - check Azure TTS service status');
    }

    return recommendations;
  }
}

// Global instance for easy access
export const audioPerformanceOptimizer = new AudioPerformanceOptimizer();

// Utility functions
export function createPerformanceTimer() {
  const startTime = performance.now();
  
  return {
    stop: (operation: string) => {
      const endTime = performance.now();
      audioPerformanceOptimizer.recordTiming(operation, startTime, endTime);
      return endTime - startTime;
    }
  };
}

export function withPerformanceTracking<T>(
  operation: () => Promise<T>,
  operationType: string
): Promise<T> {
  const timer = createPerformanceTimer();
  
  return operation().finally(() => {
    timer.stop(operationType);
  });
}