// src/lib/tts-cache.ts
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'crypto';
import { VOICE_CONFIG, SPEED_RATES } from '@/lib/azure-speech';
import type {
  TTSRequest,
  TTSResponse,
  TTSCacheEntry,
  CacheStats,
  WordTiming
} from '@/types/azure-tts';
import type { ChapterAudioRequest, ChapterAudioMetadata, ChapterAudioResponse } from '@/types/chapter-audio';

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';
const BUCKET = process.env.R2_BUCKET_NAME || '';

function createR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
  });
}

export class TTSCacheService {
  private client: S3Client;

  constructor() {
    this.client = createR2Client();
  }

  /**
   * Generate cache key from request.
   * Resolves voice and rate to actual values so that requests with explicit
   * and default parameters produce the same key when the audio would be identical.
   * Includes speakerName/stageDirection since they affect SSML output.
   */
  public generateCacheKey(request: TTSRequest): string {
    const voice = request.voice || VOICE_CONFIG[request.language][request.speed];
    const rate = request.rate ?? SPEED_RATES[request.speed];
    const speakerPart = request.speakerName || '';
    const stagePart = request.stageDirection || '';
    const content = `${request.text}-${request.language}-${request.speed}-${voice}-${rate}-${speakerPart}-${stagePart}`;
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get R2 object keys and public URL for a cache entry
   */
  private getR2Keys(cacheKey: string) {
    return {
      audioKey: `tts/${cacheKey}.mp3`,
      metadataKey: `tts/${cacheKey}.meta.json`,
      publicUrl: `${R2_PUBLIC_URL}/tts/${cacheKey}.mp3`,
    };
  }

  /**
   * Check if cached entry exists in R2
   */
  public async isCached(request: TTSRequest): Promise<boolean> {
    try {
      const cacheKey = this.generateCacheKey(request);
      const { audioKey } = this.getR2Keys(cacheKey);
      await this.client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: audioKey }));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get cached TTS response from R2
   */
  public async getCached(request: TTSRequest): Promise<TTSResponse | null> {
    try {
      const cacheKey = this.generateCacheKey(request);
      const { metadataKey, publicUrl } = this.getR2Keys(cacheKey);

      const metaResponse = await this.client.send(
        new GetObjectCommand({ Bucket: BUCKET, Key: metadataKey })
      );
      const metaBody = await metaResponse.Body?.transformToString();
      if (!metaBody) return null;

      const metadata: TTSCacheEntry = JSON.parse(metaBody);
      return {
        audioUrl: publicUrl,
        wordTimings: metadata.wordTimings,
        duration: metadata.duration,
        cached: true,
      };
    } catch {
      return null;
    }
  }

  /**
   * Save TTS response to R2 (audio + metadata)
   */
  public async saveToCache(
    request: TTSRequest,
    audioBuffer: ArrayBuffer,
    wordTimings: WordTiming[],
    duration: number
  ): Promise<string> {
    const cacheKey = this.generateCacheKey(request);
    const { audioKey, metadataKey, publicUrl } = this.getR2Keys(cacheKey);

    const metadata: TTSCacheEntry = {
      audioUrl: publicUrl,
      wordTimings,
      duration,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      language: request.language,
      speed: request.speed,
      textHash: createHash('md5').update(request.text).digest('hex'),
    };

    // Upload audio and metadata in parallel
    await Promise.all([
      this.client.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: audioKey,
        Body: Buffer.from(audioBuffer),
        ContentType: 'audio/mpeg',
        CacheControl: 'public, max-age=31536000, immutable',
      })),
      this.client.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: metadataKey,
        Body: JSON.stringify(metadata),
        ContentType: 'application/json',
        CacheControl: 'public, max-age=31536000, immutable',
      })),
    ]);

    return publicUrl;
  }

  /**
   * Get cache statistics from R2
   */
  public async getCacheStats(): Promise<CacheStats> {
    try {
      let totalFiles = 0;
      let totalSize = 0;
      let oldestFile = Date.now();
      let newestFile = 0;
      let continuationToken: string | undefined;

      do {
        const response = await this.client.send(new ListObjectsV2Command({
          Bucket: BUCKET,
          Prefix: 'tts/',
          ContinuationToken: continuationToken,
        }));

        for (const obj of response.Contents || []) {
          if (obj.Key?.endsWith('.mp3')) {
            totalFiles++;
            totalSize += obj.Size || 0;
            const lastModified = obj.LastModified?.getTime() || 0;
            if (lastModified < oldestFile) oldestFile = lastModified;
            if (lastModified > newestFile) newestFile = lastModified;
          }
        }

        continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
      } while (continuationToken);

      return {
        totalFiles,
        totalSize,
        oldestFile: totalFiles === 0 ? 0 : oldestFile,
        newestFile,
        hitRate: 0, // Not tracked in R2 — would require separate analytics
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return { totalFiles: 0, totalSize: 0, oldestFile: 0, newestFile: 0, hitRate: 0 };
    }
  }

  /**
   * Delete a single cache entry from R2
   */
  private async deleteCacheEntry(cacheKey: string): Promise<void> {
    const { audioKey, metadataKey } = this.getR2Keys(cacheKey);
    await Promise.all([
      this.client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: audioKey })).catch(() => {}),
      this.client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: metadataKey })).catch(() => {}),
    ]);
  }

  /**
   * Clear all cache entries from R2
   */
  public async clearAll(): Promise<void> {
    try {
      let continuationToken: string | undefined;
      do {
        const response = await this.client.send(new ListObjectsV2Command({
          Bucket: BUCKET,
          Prefix: 'tts/',
          ContinuationToken: continuationToken,
        }));

        const deletePromises = (response.Contents || []).map(obj =>
          this.client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: obj.Key! })).catch(() => {})
        );
        await Promise.all(deletePromises);

        continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
      } while (continuationToken);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /** Clear all chapter-level audio from R2 */
  public async clearChapterAudio(): Promise<number> {
    let count = 0;
    try {
      let continuationToken: string | undefined;
      do {
        const response = await this.client.send(new ListObjectsV2Command({
          Bucket: BUCKET,
          Prefix: 'chapter-audio/',
          ContinuationToken: continuationToken,
        }));

        const deletePromises = (response.Contents || []).map(obj => {
          count++;
          return this.client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: obj.Key! })).catch(() => {});
        });
        await Promise.all(deletePromises);

        continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
      } while (continuationToken);
    } catch (error) {
      console.error('Error clearing chapter audio cache:', error);
    }
    return count;
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
        urls.push('');
      }
    }

    return urls;
  }

  /**
   * Check how many sentences are already cached for a story page
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

    for (const request of requests) {
      if (await this.isCached(request)) {
        cached++;
      } else {
        generated++;
      }
    }

    return { cached, generated };
  }
  // ===========================================================================
  // Chapter-Level Audio Cache
  // ===========================================================================

  /**
   * Human-readable R2 key for a chapter audio variant.
   * Format: chapter-audio/{slug}/{level}/ch{chapter}/{mode}-{speed}
   */
  public getChapterCacheKey(request: ChapterAudioRequest): string {
    return `chapter-audio/${request.storySlug}/${request.level}/ch${request.chapter}/${request.mode}-${request.speed}`;
  }

  private getChapterR2Keys(cacheKey: string) {
    return {
      audioKey: `${cacheKey}.mp3`,
      metadataKey: `${cacheKey}.meta.json`,
      publicUrl: `${R2_PUBLIC_URL}/${cacheKey}.mp3?v=${Date.now()}`,
    };
  }

  /** Check if chapter audio exists in R2 */
  public async isChapterCached(request: ChapterAudioRequest): Promise<boolean> {
    try {
      const cacheKey = this.getChapterCacheKey(request);
      const { audioKey } = this.getChapterR2Keys(cacheKey);
      await this.client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: audioKey }));
      return true;
    } catch {
      return false;
    }
  }

  /** Get cached chapter audio URL + metadata from R2 */
  public async getChapterCached(request: ChapterAudioRequest): Promise<ChapterAudioResponse | null> {
    try {
      const cacheKey = this.getChapterCacheKey(request);
      const { metadataKey, publicUrl } = this.getChapterR2Keys(cacheKey);

      const metaResponse = await this.client.send(
        new GetObjectCommand({ Bucket: BUCKET, Key: metadataKey })
      );
      const metaBody = await metaResponse.Body?.transformToString();
      if (!metaBody) return null;

      const metadata: ChapterAudioMetadata = JSON.parse(metaBody);
      return { audioUrl: publicUrl, metadata, cached: true };
    } catch {
      return null;
    }
  }

  /** Save concatenated chapter audio + metadata to R2 */
  public async saveChapterAudio(
    request: ChapterAudioRequest,
    audioBuffer: Buffer,
    metadata: ChapterAudioMetadata
  ): Promise<string> {
    const cacheKey = this.getChapterCacheKey(request);
    const { audioKey, metadataKey, publicUrl } = this.getChapterR2Keys(cacheKey);

    await Promise.all([
      this.client.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: audioKey,
        Body: audioBuffer,
        ContentType: 'audio/mpeg',
        CacheControl: 'public, max-age=31536000, immutable',
      })),
      this.client.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: metadataKey,
        Body: JSON.stringify(metadata),
        ContentType: 'application/json',
        CacheControl: 'public, max-age=31536000, immutable',
      })),
    ]);

    return publicUrl;
  }

  /**
   * Download raw MP3 bytes for a per-sentence cache entry.
   * Used during chapter concatenation to fetch individual sentence audio.
   */
  public async getSentenceAudioBuffer(sentenceCacheKey: string): Promise<Buffer | null> {
    try {
      const { audioKey } = this.getR2Keys(sentenceCacheKey);
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: BUCKET, Key: audioKey })
      );
      const bytes = await response.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : null;
    } catch {
      return null;
    }
  }

  // ==========================================================================
  // Chunk-part files for Inngest-driven chapter audio generation.
  // Each chunk's MP3 buffer is written here by a chunk step. The assemble
  // step downloads them, concatenates, uploads the final canonical chapter
  // audio, then deletes the parts. Keys live next to the canonical chapter
  // audio so they're easy to spot when debugging.
  // ==========================================================================
  private getChapterPartKey(request: ChapterAudioRequest, chunkIndex: number): string {
    const base = this.getChapterCacheKey(request);
    return `${base}.part-${chunkIndex}.mp3`;
  }

  public async saveChapterAudioPart(
    request: ChapterAudioRequest,
    chunkIndex: number,
    audioBuffer: Buffer,
  ): Promise<string> {
    const key = this.getChapterPartKey(request, chunkIndex);
    await this.client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: audioBuffer,
      ContentType: 'audio/mpeg',
      // Short cache; these parts get deleted by the assemble step.
      CacheControl: 'private, max-age=3600',
    }));
    return `${R2_PUBLIC_URL}/${key}`;
  }

  public async getChapterAudioPart(
    request: ChapterAudioRequest,
    chunkIndex: number,
  ): Promise<Buffer | null> {
    try {
      const key = this.getChapterPartKey(request, chunkIndex);
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: BUCKET, Key: key }),
      );
      const bytes = await response.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : null;
    } catch {
      return null;
    }
  }

  public async deleteChapterAudioParts(
    request: ChapterAudioRequest,
    totalChunks: number,
  ): Promise<void> {
    await Promise.all(
      Array.from({ length: totalChunks }, (_, i) =>
        this.client
          .send(new DeleteObjectCommand({
            Bucket: BUCKET,
            Key: this.getChapterPartKey(request, i),
          }))
          .catch(() => {}),
      ),
    );
  }

  public async saveDraftAudio(draftId: string, audioBuffer: Buffer): Promise<string> {
    const key = `draft-audio/${draftId}.mp3`;
    await this.client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: audioBuffer,
      ContentType: 'audio/mpeg',
      CacheControl: 'public, max-age=31536000, immutable',
    }));
    return `${R2_PUBLIC_URL}/${key}`;
  }

  public async deleteDraftAudio(draftId: string): Promise<void> {
    const key = `draft-audio/${draftId}.mp3`;
    await this.client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })).catch(() => {});
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
