// src/lib/tts-cache.ts
import { promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import type { 
  TTSRequest, 
  TTSResponse, 
  TTSCacheEntry, 
  CacheStats, 
  CacheCleanupOptions,
  WordTiming 
} from '@/types/azure-tts';

export class TTSCacheService {
  private cacheDir: string;
  private metadataDir: string;
  private maxAge: number = 30 * 24 * 60 * 60 * 1000; // 30 days
  private maxFiles: number = 10000;
  private maxSize: number = 5 * 1024 * 1024 * 1024; // 5GB

  constructor(baseCacheDir?: string) {
    // Use public directory for serving cached audio files
    this.cacheDir = baseCacheDir || path.join(process.cwd(), 'public', 'cache', 'tts-audio');
    this.metadataDir = path.join(process.cwd(), 'cache', 'tts-metadata');
    this.ensureCacheDirectories();
  }

  /**
   * Ensure cache directories exist
   */
  private async ensureCacheDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      await fs.mkdir(this.metadataDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create cache directories:', error);
    }
  }

  /**
   * Generate cache key from request
   */
  public generateCacheKey(request: TTSRequest): string {
    const voicePart = request.voice || 'default';
    const ratePart = request.rate ?? 'default';
    const content = `${request.text}-${request.language}-${request.speed}-${voicePart}-${ratePart}`;
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Generate file paths for cached content
   */
  private getCachePaths(cacheKey: string) {
    const audioFile = path.join(this.cacheDir, `${cacheKey}.mp3`);
    const metadataFile = path.join(this.metadataDir, `${cacheKey}.json`);
    const publicUrl = `/cache/tts-audio/${cacheKey}.mp3`;
    
    return { audioFile, metadataFile, publicUrl };
  }

  /**
   * Check if cached entry exists and is valid
   */
  public async isCached(request: TTSRequest): Promise<boolean> {
    try {
      const cacheKey = this.generateCacheKey(request);
      const { audioFile, metadataFile } = this.getCachePaths(cacheKey);

      // Check if both audio and metadata files exist
      const [audioExists, metadataExists] = await Promise.all([
        fs.access(audioFile).then(() => true).catch(() => false),
        fs.access(metadataFile).then(() => true).catch(() => false)
      ]);

      if (!audioExists || !metadataExists) {
        return false;
      }

      // Check if cache entry is still valid (not expired)
      const metadata = await this.getMetadata(cacheKey);
      if (!metadata) {
        return false;
      }

      const now = Date.now();
      const isExpired = (now - metadata.createdAt) > this.maxAge;
      
      if (isExpired) {
        // Clean up expired entry
        await this.deleteCacheEntry(cacheKey);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking cache:', error);
      return false;
    }
  }

  /**
   * Get cached TTS response
   */
  public async getCached(request: TTSRequest): Promise<TTSResponse | null> {
    try {
      const cacheKey = this.generateCacheKey(request);
      const { publicUrl } = this.getCachePaths(cacheKey);

      const metadata = await this.getMetadata(cacheKey);
      if (!metadata) {
        return null;
      }

      // Update access time
      metadata.accessedAt = Date.now();
      await this.saveMetadata(cacheKey, metadata);

      return {
        audioUrl: publicUrl,
        wordTimings: metadata.wordTimings,
        duration: metadata.duration,
        cached: true
      };
    } catch (error) {
      console.error('Error retrieving cached content:', error);
      return null;
    }
  }

  /**
   * Save TTS response to cache
   */
  public async saveToCache(
    request: TTSRequest, 
    audioBuffer: ArrayBuffer, 
    wordTimings: WordTiming[], 
    duration: number
  ): Promise<string> {
    try {
      await this.ensureCacheDirectories();
      
      const cacheKey = this.generateCacheKey(request);
      const { audioFile, publicUrl } = this.getCachePaths(cacheKey);

      // Save audio file
      const buffer = Buffer.from(audioBuffer);
      await fs.writeFile(audioFile, buffer);

      // Save metadata
      const metadata: TTSCacheEntry = {
        audioUrl: publicUrl,
        wordTimings,
        duration,
        createdAt: Date.now(),
        accessedAt: Date.now(),
        language: request.language,
        speed: request.speed,
        textHash: createHash('md5').update(request.text).digest('hex')
      };

      await this.saveMetadata(cacheKey, metadata);

      // Trigger cleanup if needed
      this.cleanupIfNeeded();

      return publicUrl;
    } catch (error) {
      console.error('Error saving to cache:', error);
      throw new Error('Failed to save to cache');
    }
  }

  /**
   * Get metadata for cache entry
   */
  private async getMetadata(cacheKey: string): Promise<TTSCacheEntry | null> {
    try {
      const { metadataFile } = this.getCachePaths(cacheKey);
      const content = await fs.readFile(metadataFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  /**
   * Save metadata for cache entry
   */
  private async saveMetadata(cacheKey: string, metadata: TTSCacheEntry): Promise<void> {
    try {
      const { metadataFile } = this.getCachePaths(cacheKey);
      await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2));
    } catch (error) {
      console.error('Error saving metadata:', error);
    }
  }

  /**
   * Delete cache entry
   */
  private async deleteCacheEntry(cacheKey: string): Promise<void> {
    try {
      const { audioFile, metadataFile } = this.getCachePaths(cacheKey);
      
      await Promise.all([
        fs.unlink(audioFile).catch(() => {}), // Ignore errors if file doesn't exist
        fs.unlink(metadataFile).catch(() => {})
      ]);
    } catch (error) {
      console.error('Error deleting cache entry:', error);
    }
  }

  /**
   * Get cache statistics
   */
  public async getCacheStats(): Promise<CacheStats> {
    try {
      const [audioFiles, metadataFiles] = await Promise.all([
        fs.readdir(this.cacheDir).catch(() => []),
        fs.readdir(this.metadataDir).catch(() => [])
      ]);

      let totalSize = 0;
      let oldestFile = Date.now();
      let newestFile = 0;
      let totalRequests = 0;
      let cacheHits = 0;

      // Calculate total size and file timestamps
      for (const file of audioFiles) {
        try {
          const filePath = path.join(this.cacheDir, file);
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
          
          const fileTime = stats.mtime.getTime();
          oldestFile = Math.min(oldestFile, fileTime);
          newestFile = Math.max(newestFile, fileTime);
        } catch (error) {
          // Skip files that can't be accessed
        }
      }

      // Count cache hits from metadata
      for (const file of metadataFiles) {
        try {
          const metadataPath = path.join(this.metadataDir, file);
          const content = await fs.readFile(metadataPath, 'utf-8');
          const metadata: TTSCacheEntry = JSON.parse(content);
          
          totalRequests++;
          if (metadata.accessedAt > metadata.createdAt) {
            cacheHits++;
          }
        } catch (error) {
          // Skip invalid metadata files
        }
      }

      const hitRate = totalRequests > 0 ? cacheHits / totalRequests : 0;

      return {
        totalFiles: audioFiles.length,
        totalSize,
        oldestFile: oldestFile === Date.now() ? 0 : oldestFile,
        newestFile,
        hitRate
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        totalFiles: 0,
        totalSize: 0,
        oldestFile: 0,
        newestFile: 0,
        hitRate: 0
      };
    }
  }

  /**
   * Clean up cache if needed
   */
  private async cleanupIfNeeded(): Promise<void> {
    try {
      const stats = await this.getCacheStats();
      
      if (stats.totalFiles > this.maxFiles || stats.totalSize > this.maxSize) {
        await this.cleanup({
          maxAge: this.maxAge,
          maxSize: this.maxSize,
          maxFiles: this.maxFiles
        });
      }
    } catch (error) {
      console.error('Error during cache cleanup check:', error);
    }
  }

  /**
   * Clean up old cache entries
   */
  public async cleanup(options: CacheCleanupOptions): Promise<number> {
    try {
      const metadataFiles = await fs.readdir(this.metadataDir);
      const now = Date.now();
      let deletedCount = 0;

      // Get all cache entries with their metadata
      const entries: Array<{ key: string; metadata: TTSCacheEntry }> = [];
      
      for (const file of metadataFiles) {
        try {
          const key = path.basename(file, '.json');
          const metadata = await this.getMetadata(key);
          if (metadata) {
            entries.push({ key, metadata });
          }
        } catch (error) {
          // Skip invalid entries
        }
      }

      // Sort by last accessed time (oldest first)
      entries.sort((a, b) => a.metadata.accessedAt - b.metadata.accessedAt);

      // Delete expired entries
      for (const entry of entries) {
        const age = now - entry.metadata.createdAt;
        if (age > options.maxAge) {
          await this.deleteCacheEntry(entry.key);
          deletedCount++;
        }
      }

      // Delete oldest entries if we still exceed limits
      const stats = await this.getCacheStats();
      let remainingEntries = entries.slice(deletedCount);

      if (stats.totalFiles > options.maxFiles) {
        const excess = stats.totalFiles - options.maxFiles;
        for (let i = 0; i < excess && i < remainingEntries.length; i++) {
          await this.deleteCacheEntry(remainingEntries[i].key);
          deletedCount++;
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('Error during cache cleanup:', error);
      return 0;
    }
  }

  /**
   * Clear all cache entries
   */
  public async clearAll(): Promise<void> {
    try {
      const [audioFiles, metadataFiles] = await Promise.all([
        fs.readdir(this.cacheDir).catch(() => []),
        fs.readdir(this.metadataDir).catch(() => [])
      ]);

      // Delete all audio files
      await Promise.all(
        audioFiles.map(file => 
          fs.unlink(path.join(this.cacheDir, file)).catch(() => {})
        )
      );

      // Delete all metadata files
      await Promise.all(
        metadataFiles.map(file => 
          fs.unlink(path.join(this.metadataDir, file)).catch(() => {})
        )
      );
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Batch save multiple TTS responses
   */
  public async batchSave(
    requests: TTSRequest[],
    responses: Array<{ audioBuffer: ArrayBuffer; wordTimings: WordTiming[]; duration: number }>
  ): Promise<string[]> {
    const urls: string[] = [];
    
    for (let i = 0; i < requests.length; i++) {
      try {
        const url = await this.saveToCache(
          requests[i],
          responses[i].audioBuffer,
          responses[i].wordTimings,
          responses[i].duration
        );
        urls.push(url);
      } catch (error) {
        console.error(`Error saving batch item ${i}:`, error);
        urls.push(''); // Empty URL for failed saves
      }
    }
    
    return urls;
  }

  /**
   * Preload cache for a story
   */
  public async preloadStoryCache(
    storySlug: string,
    level: string,
    chapter: string,
    page: string,
    sentences: Array<{ es: string; en: string }>
  ): Promise<{ cached: number; generated: number }> {
    let cached = 0;
    let generated = 0;

    const requests: TTSRequest[] = [];
    
    // Generate requests for both languages and speeds
    for (const sentence of sentences) {
      for (const language of ['es-ES', 'en-US'] as const) {
        for (const speed of ['normal', 'slow'] as const) {
          const text = language === 'es-ES' ? sentence.es : sentence.en;
          requests.push({
            text,
            language,
            speed,
            storySlug,
            chapterPage: `${chapter}-${page}`
          });
        }
      }
    }

    // Check what's already cached
    for (const request of requests) {
      if (await this.isCached(request)) {
        cached++;
      } else {
        generated++;
      }
    }

    return { cached, generated };
  }
}

// Singleton instance
let cacheServiceInstance: TTSCacheService | null = null;

export function getTTSCacheService(): TTSCacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new TTSCacheService();
  }
  return cacheServiceInstance;
}