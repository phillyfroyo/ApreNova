// src/lib/tts-service.ts
import { getAzureSpeechService } from './azure-speech';
import { getTTSCacheService } from './tts-cache';
import type { TTSRequest, TTSResponse, TTSBatchRequest, TTSBatchResponse } from '@/types/azure-tts';

export class TTSService {
  private speechService = getAzureSpeechService();
  private cacheService = getTTSCacheService();

  /**
   * Generate single TTS audio with intelligent caching
   */
  async generateTTS(request: TTSRequest): Promise<TTSResponse> {
    // Check cache first
    const cached = await this.cacheService.getCached(request);
    if (cached) {
      return cached;
    }

    // Validate request
    this.speechService.validateRequest(request);

    // Generate new audio
    const result = await this.speechService.generateSpeechBuffer(request);
    
    // Save to cache
    const audioUrl = await this.cacheService.saveToCache(
      request,
      result.buffer,
      result.wordTimings,
      result.duration
    );

    return {
      audioUrl,
      wordTimings: result.wordTimings,
      duration: result.duration,
      cached: false
    };
  }

  /**
   * Generate batch TTS audio with parallel processing
   */
  async generateBatchTTS(request: TTSBatchRequest): Promise<TTSBatchResponse> {
    const results: TTSResponse[] = [];
    let totalDuration = 0;
    let cacheHits = 0;

    // Process items with controlled concurrency to avoid overwhelming Azure API
    const concurrency = 3; // Process 3 items at a time
    const chunks = this.chunkArray(request.items, concurrency);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (item) => {
        try {
          const result = await this.generateTTS(item);
          if (result.cached) {
            cacheHits++;
          }
          totalDuration += result.duration;
          return result;
        } catch (error) {
          console.error('Error processing TTS item:', error);
          // Return empty result for failed items
          return {
            audioUrl: '',
            wordTimings: [],
            duration: 0,
            cached: false
          };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    const cacheHitRate = request.items.length > 0 ? cacheHits / request.items.length : 0;

    return {
      results,
      totalDuration,
      cacheHitRate
    };
  }

  /**
   * Pre-generate TTS for a story page
   */
  async preGenerateStoryPage(
    storySlug: string,
    level: string,
    chapter: string,
    page: string,
    sentences: Array<{ es: string; en: string }>
  ): Promise<{ success: boolean; generated: number; cached: number; errors: number }> {
    const requests: TTSRequest[] = [];
    
    // Generate requests for both languages and speeds
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      for (const language of ['es-ES', 'en-US'] as const) {
        for (const speed of ['normal', 'slow'] as const) {
          const text = language === 'es-ES' ? sentence.es : sentence.en;
          if (text && text.trim()) {
            requests.push({
              text: text.trim(),
              language,
              speed,
              storySlug,
              chapterPage: `${chapter}-${page}`
            });
          }
        }
      }
    }

    const batchRequest: TTSBatchRequest = {
      items: requests,
      storySlug,
      chapterPage: `${chapter}-${page}`
    };

    try {
      const result = await this.generateBatchTTS(batchRequest);
      
      const generated = result.results.filter(r => !r.cached && r.audioUrl).length;
      const cached = result.results.filter(r => r.cached).length;
      const errors = result.results.filter(r => !r.audioUrl).length;

      return {
        success: errors === 0,
        generated,
        cached,
        errors
      };
    } catch (error) {
      console.error('Error pre-generating story page:', error);
      return {
        success: false,
        generated: 0,
        cached: 0,
        errors: requests.length
      };
    }
  }

  /**
   * Get TTS for specific story line with fallback
   */
  async getStoryLineTTS(
    storySlug: string,
    level: string,
    chapter: string,
    page: string,
    lineIndex: number,
    text: string,
    language: 'es-ES' | 'en-US',
    speed: 'normal' | 'slow'
  ): Promise<TTSResponse | null> {
    try {
      const request: TTSRequest = {
        text: text.trim(),
        language,
        speed,
        storySlug,
        chapterPage: `${chapter}-${page}-line${lineIndex + 1}`
      };

      return await this.generateTTS(request);
    } catch (error) {
      console.error(`Error getting TTS for story line ${lineIndex + 1}:`, error);
      return null;
    }
  }

  /**
   * Test the TTS service
   */
  async testService(): Promise<{ 
    speechService: boolean; 
    cacheService: boolean; 
    endToEnd: boolean 
  }> {
    const results = {
      speechService: false,
      cacheService: false,
      endToEnd: false
    };

    try {
      // Test speech service
      results.speechService = await this.speechService.testConnection();
    } catch (error) {
      console.error('Speech service test failed:', error);
    }

    try {
      // Test cache service
      const stats = await this.cacheService.getCacheStats();
      results.cacheService = typeof stats.totalFiles === 'number';
    } catch (error) {
      console.error('Cache service test failed:', error);
    }

    try {
      // Test end-to-end
      if (results.speechService && results.cacheService) {
        const testRequest: TTSRequest = {
          text: 'Hello world',
          language: 'en-US',
          speed: 'normal'
        };
        
        const response = await this.generateTTS(testRequest);
        results.endToEnd = !!response.audioUrl;
      }
    } catch (error) {
      console.error('End-to-end test failed:', error);
    }

    return results;
  }

  /**
   * Get service statistics
   */
  async getStats(): Promise<{
    cache: any;
    service: {
      supportedLanguages: string[];
      supportedSpeeds: string[];
      maxTextLength: number;
    };
  }> {
    const cacheStats = await this.cacheService.getCacheStats();
    
    return {
      cache: cacheStats,
      service: {
        supportedLanguages: ['es-ES', 'en-US'],
        supportedSpeeds: ['normal', 'slow'],
        maxTextLength: 3000
      }
    };
  }

  /**
   * Utility method to chunk array for batch processing
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.speechService.dispose();
  }
}

// Singleton instance
let ttsServiceInstance: TTSService | null = null;

export function getTTSService(): TTSService {
  if (!ttsServiceInstance) {
    ttsServiceInstance = new TTSService();
  }
  return ttsServiceInstance;
}