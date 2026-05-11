// Inngest orchestrator for chapter audio generation.
//
// Replaces the synchronous /api/azure-tts/chapter NDJSON-streaming flow,
// which hits Vercel's 5-minute Fluid Compute cap on long bilingual
// chapters (12+ minute generations are common for Gatsby-length chapters
// with EN + ES alignment).
//
// Each chunk's TTS+alignment runs in its own Inngest step (~30-90s each),
// well under the 5-min cap. Chunks run sequentially per chapter to avoid
// hitting Azure rate limits. Intermediate state lives in the
// AudioGenerationJob row (progress, chunk metadata) and R2 part files
// (the per-chunk MP3 buffers).
//
// State machine: QUEUED → PROCESSING → COMPLETE | FAILED.

import { inngest } from '../client';
import { prisma } from '@/lib/prisma';
import {
  planAndChunkChapter,
  generateChunkAudio,
} from '@/lib/chapter-audio';
import { getTTSCacheService } from '@/lib/tts-cache';
import type {
  ChapterAudioRequest,
  ChapterAudioMetadata,
  SentenceTiming,
  PageBoundary,
} from '@/types/chapter-audio';

interface ChunkData {
  /** Sentence timings for each chunk (already time-offset). Index = chunk index. */
  partTimings: SentenceTiming[][];
  /** Wall-clock audio duration of each chunk (seconds). */
  partDurations: number[];
  /** Total characters across all entries (used for stats and metadata). */
  totalCharacters: number;
  /** Wall-clock start time for the whole job. */
  generationStartMs: number;
}

export const processChapterAudioFn = inngest.createFunction(
  {
    id: 'process-chapter-audio',
    triggers: [{ event: 'audio/chapter.generate' }],
    // One chapter at a time per user. Audio generation is heavy and stacking
    // requests would burn the Azure quota.
    concurrency: [
      { key: 'event.data.userId', limit: 1 },
      // Cap total in-flight chunks across all jobs. Azure Speech rate limits
      // are easy to hit; conservative cap mirrors the user-story pipeline.
      { scope: 'fn', limit: 5 },
    ],
    // If all retries are exhausted, mark the job FAILED so the polling
    // status endpoint can surface an error to the user instead of hanging
    // forever in PROCESSING.
    onFailure: async ({ event, error }) => {
      const jobId = (event.data?.event?.data as { jobId?: string })?.jobId;
      if (!jobId) return;
      await prisma.audioGenerationJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          errorMessage: error?.message?.slice(0, 1000) || 'Audio generation failed',
        },
      }).catch(() => {});
    },
  },
  async ({ event, step, logger }) => {
    const { jobId } = event.data as { jobId: string; userId?: string };
    if (!jobId) throw new Error('Missing jobId in event payload');

    // Step 1: prepare — load content, build plan, chunk, write totals to job
    const prep = await step.run('prepare', async () => {
      const job = await prisma.audioGenerationJob.findUnique({ where: { id: jobId } });
      if (!job) throw new Error(`Job ${jobId} not found`);

      const request: ChapterAudioRequest = {
        storySlug: job.storySlug,
        level: job.level,
        chapter: job.chapter,
        mode: job.mode as ChapterAudioRequest['mode'],
        speed: job.speed as ChapterAudioRequest['speed'],
      };

      const planned = await planAndChunkChapter(request);

      await prisma.audioGenerationJob.update({
        where: { id: jobId },
        data: {
          status: 'PROCESSING',
          totalSentences: planned.totalSentences,
          totalChunks: planned.chunks.length,
          sentencesComplete: 0,
          chunksComplete: 0,
          currentStep: 'preparing',
          chunkData: {
            partTimings: [],
            partDurations: [],
            totalCharacters: planned.totalCharacters,
            generationStartMs: Date.now(),
          } satisfies ChunkData as any,
        },
      });

      return {
        request,
        chunkCount: planned.chunks.length,
        totalSentences: planned.totalSentences,
      };
    });

    const isBilingual = prep.request.mode === 'bilingual-en' || prep.request.mode === 'bilingual-es';
    const cache = getTTSCacheService();

    // Steps 2..N+1: process each chunk sequentially. Each step:
    //  - re-derives the chunk from the request (cheap; loadChapter + chunk
    //    is ~10ms and avoids stashing the SpeechPlanEntry[] in the job row)
    //  - synthesizes MP3 + WAV in parallel
    //  - runs forced alignment
    //  - uploads MP3 part to R2
    //  - appends sentence timings + duration to job.chunkData
    for (let chunkIndex = 0; chunkIndex < prep.chunkCount; chunkIndex++) {
      await step.run(`chunk-${chunkIndex}`, async () => {
        // Recompute time offset by summing previous chunks' durations.
        const job = await prisma.audioGenerationJob.findUnique({
          where: { id: jobId },
          select: { chunkData: true },
        });
        const data = (job?.chunkData ?? {}) as Partial<ChunkData>;
        const partDurations = data.partDurations ?? [];
        const partTimings = data.partTimings ?? [];
        const timeOffset = partDurations.reduce((sum, d) => sum + d, 0);

        // Re-chunk (idempotent — same plan + same chunking algorithm).
        const planned = await planAndChunkChapter(prep.request);
        const chunk = planned.chunks[chunkIndex];
        if (!chunk) {
          throw new Error(`Chunk ${chunkIndex} missing from re-derived plan (expected ${prep.chunkCount} chunks)`);
        }

        // Synthesize + align this chunk
        const chunkResult = await generateChunkAudio(
          chunk,
          isBilingual,
          timeOffset,
          `chunk ${chunkIndex + 1}/${prep.chunkCount}`,
        );

        // Upload MP3 part to R2
        await cache.saveChapterAudioPart(prep.request, chunkIndex, chunkResult.audioBuffer);

        // Append to job state
        const newPartTimings = [...partTimings];
        newPartTimings[chunkIndex] = chunkResult.sentenceTimings;
        const newPartDurations = [...partDurations];
        newPartDurations[chunkIndex] = chunkResult.duration;

        const sentencesComplete = newPartTimings.reduce(
          (sum, t) => sum + (t?.length || 0),
          0,
        );

        await prisma.audioGenerationJob.update({
          where: { id: jobId },
          data: {
            chunksComplete: chunkIndex + 1,
            sentencesComplete,
            currentStep: `chunk-${chunkIndex + 1}`,
            chunkData: {
              ...data,
              partTimings: newPartTimings,
              partDurations: newPartDurations,
            } as any,
          },
        });

        logger?.info(`[ChapterAudio] chunk ${chunkIndex + 1}/${prep.chunkCount} done for job ${jobId}`);
      });
    }

    // Final step: assemble — download all part MP3s, concatenate, build the
    // final ChapterAudioMetadata, upload to the canonical R2 URL, mark
    // job COMPLETE, delete part files.
    await step.run('assemble', async () => {
      await prisma.audioGenerationJob.update({
        where: { id: jobId },
        data: { currentStep: 'assembling' },
      });

      const job = await prisma.audioGenerationJob.findUnique({
        where: { id: jobId },
        select: { chunkData: true },
      });
      const data = (job?.chunkData ?? {}) as Partial<ChunkData>;
      const partTimings = data.partTimings ?? [];
      const partDurations = data.partDurations ?? [];
      const totalCharacters = data.totalCharacters ?? 0;
      const generationStartMs = data.generationStartMs ?? Date.now();

      // Download all part MP3s from R2 in order
      const partBuffers: Buffer[] = [];
      for (let i = 0; i < prep.chunkCount; i++) {
        const buf = await cache.getChapterAudioPart(prep.request, i);
        if (!buf) {
          throw new Error(`Part ${i} missing from R2 during assemble for job ${jobId}`);
        }
        partBuffers.push(buf);
      }
      const concatenated = Buffer.concat(partBuffers);

      // Flatten + adjust sentence timings (they're already offset per-chunk)
      const allSentenceTimings: SentenceTiming[] = partTimings.flatMap((t) => t ?? []);

      // Enforce non-overlapping, monotonic timings (same logic as
      // generateChapterAudio). PA alignment for bilingual can produce
      // overlapping ranges across language boundaries.
      for (let i = 0; i < allSentenceTimings.length - 1; i++) {
        const curr = allSentenceTimings[i];
        const next = allSentenceTimings[i + 1];
        if (next.startTime < curr.startTime) {
          next.startTime = curr.endTime;
        }
        if (curr.endTime > next.startTime) {
          const mid = (curr.endTime + next.startTime) / 2;
          curr.endTime = mid;
          next.startTime = mid;
          curr.wordTimings = curr.wordTimings.filter((w) => w.startTime < curr.endTime);
          next.wordTimings = next.wordTimings.filter((w) => w.startTime >= next.startTime);
        }
      }

      // Build page boundaries from corrected timings
      const pageBoundaryMap = new Map<number, { startTime: number; endTime: number; sentenceCount: number }>();
      for (const st of allSentenceTimings) {
        const existing = pageBoundaryMap.get(st.pageNumber);
        if (existing) {
          existing.endTime = st.endTime;
          existing.sentenceCount++;
        } else {
          pageBoundaryMap.set(st.pageNumber, {
            startTime: st.startTime,
            endTime: st.endTime,
            sentenceCount: 1,
          });
        }
      }
      const pageBoundaries: PageBoundary[] = Array.from(pageBoundaryMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([pageNumber, d]) => ({
          pageNumber,
          startTime: d.startTime,
          endTime: d.endTime,
          sentenceCount: d.sentenceCount,
        }));

      const generationDurationMs = Date.now() - generationStartMs;
      const totalDuration = allSentenceTimings.length > 0
        ? allSentenceTimings[allSentenceTimings.length - 1].endTime
        : partDurations.reduce((sum, d) => sum + d, 0);

      const metadata: ChapterAudioMetadata = {
        variant: prep.request,
        totalDuration,
        totalSentences: allSentenceTimings.length,
        totalCharacters,
        generationDurationMs,
        sentenceTimings: allSentenceTimings,
        pageBoundaries,
        generatedAt: Date.now(),
        sentenceHashes: [],
        version: 3,
      };

      // Save canonical audio + metadata to R2
      const audioUrl = await cache.saveChapterAudio(prep.request, concatenated, metadata);

      // Record stats (non-blocking on failure)
      await prisma.ttsGenerationStat.create({
        data: {
          storySlug: prep.request.storySlug,
          level: prep.request.level,
          chapter: prep.request.chapter,
          mode: prep.request.mode,
          speed: prep.request.speed,
          totalCharacters,
          totalSentences: prep.totalSentences,
          generationDurationMs,
          audioDurationMs: Math.round(partDurations.reduce((s, d) => s + d, 0) * 1000),
        },
      }).catch((err: unknown) => {
        console.error('[ChapterAudio] Failed to record TtsGenerationStat:', err);
      });

      // Mark job complete
      await prisma.audioGenerationJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETE',
          audioUrl,
          currentStep: 'complete',
        },
      });

      // Delete part files (fire and forget — orphan parts are cheap)
      cache.deleteChapterAudioParts(prep.request, prep.chunkCount).catch((err: unknown) => {
        console.error('[ChapterAudio] Failed to delete part files for', jobId, ':', err);
      });

      logger?.info(`[ChapterAudio] job ${jobId} complete: ${audioUrl}`);
    });

    return { ok: true, jobId };
  },
);
