// src/lib/chapter-audio.ts
// Server-side chapter audio generation: loads content, builds a single SSML
// document with bookmark markers, synthesizes once via Azure TTS, and stores
// the chapter file + timing metadata in R2.

import { getAzureSpeechService, VOICE_CONFIG, NATIVE_VOICE, SPEED_RATES } from "./azure-speech";
import type { ChapterSSMLSegment } from "./azure-speech";
import { getTTSCacheService } from "./tts-cache";
import { alignChunkSentences } from "./forced-alignment";
import { prisma } from "@/lib/prisma";
import { toFolderName } from "@/lib/cefr";
import type { StoryLine } from "@/lib/story-processing/text-processing";
import type {
  ChapterAudioRequest,
  ChapterAudioResponse,
  ChapterAudioMetadata,
  SentenceTiming,
  PageBoundary,
  ChapterGenerationProgress,
} from "@/types/chapter-audio";

// ============================================================================
// Content loading
// ============================================================================

interface PageLines {
  pageNumber: number;
  lines: StoryLine[];
}

/**
 * Load all pages for a given chapter, returning them in order.
 */
export async function loadChapterContent(
  storySlug: string,
  level: string,
  chapter: number
): Promise<PageLines[]> {
  const folderLevel = toFolderName(level);

  let levelContent: any;
  try {
    const mod = await import(`@/content/${storySlug}/${folderLevel}/index.ts`);
    levelContent = mod.default || mod.levelContent;
  } catch {
    const mod = await import(`@/content/${storySlug}/${folderLevel}/content.ts`);
    levelContent = mod.default || mod.levelContent;
  }

  const chapterData = levelContent.chapters?.[chapter];
  if (!chapterData?.pages) {
    throw new Error(`Chapter ${chapter} not found for ${storySlug}/${level}`);
  }

  const pages: PageLines[] = [];
  const pageNumbers = Object.keys(chapterData.pages)
    .map(Number)
    .sort((a, b) => a - b);

  for (const pageNum of pageNumbers) {
    const pageData = chapterData.pages[pageNum];
    let lines: StoryLine[] = pageData.lines || [];

    // For poetry with stanzas, flatten into a single line array
    if (pageData.stanzas && !pageData.lines) {
      lines = pageData.stanzas.flat();
    }

    pages.push({ pageNumber: pageNum, lines });
  }

  return pages;
}

// ============================================================================
// Segment planning (produces speech segment metadata for SSML building)
// ============================================================================

interface SpeechPlanEntry {
  text: string;
  language: "es-ES" | "en-US";
  voice: string;
  rate: number;
  langKey: "en" | "es";
  pageNumber: number;
  lineIndex: number;
  breakBeforeMs: number;
  speakerName?: string;
  stageDirection?: string;
}

/**
 * Build the ordered list of speech entries for chapter SSML generation.
 * Silence is handled via SSML <break> elements, not separate segments.
 */
export function buildSpeechPlan(
  pages: PageLines[],
  mode: ChapterAudioRequest["mode"],
  speed: ChapterAudioRequest["speed"]
): SpeechPlanEntry[] {
  const entries: SpeechPlanEntry[] = [];

  const isMonolingual = mode === "en" || mode === "es";
  const isBilingual = !isMonolingual;

  const getLanguageConfig = () => {
    switch (mode) {
      case "en":
        return { primary: { lang: "en-US" as const, voice: VOICE_CONFIG["en-US"].normal, langKey: "en" as const } };
      case "es":
        return { primary: { lang: "es-ES" as const, voice: VOICE_CONFIG["es-ES"].normal, langKey: "es" as const } };
      case "bilingual-en":
        return {
          primary: { lang: "es-ES" as const, voice: VOICE_CONFIG["es-ES"].normal, langKey: "es" as const },
          secondary: { lang: "en-US" as const, voice: NATIVE_VOICE, langKey: "en" as const },
        };
      case "bilingual-es":
        return {
          primary: { lang: "en-US" as const, voice: VOICE_CONFIG["en-US"].normal, langKey: "en" as const },
          secondary: { lang: "es-ES" as const, voice: NATIVE_VOICE, langKey: "es" as const },
        };
    }
  };

  const config = getLanguageConfig();
  let isFirst = true;

  for (const page of pages) {
    for (let lineIdx = 0; lineIdx < page.lines.length; lineIdx++) {
      const line = page.lines[lineIdx];

      if (line.isStanzaBreak || line.isEditorialNote) continue;
      const hasContent = (line.es && line.es.trim()) || (line.en && line.en.trim());
      if (!hasContent) continue;
      if (line.isStageDirectionOnly) continue;

      // Primary language
      const primaryText = (config.primary.langKey === "es" ? line.es : line.en)?.trim();
      if (primaryText) {
        const rate = speed === "slow" ? SPEED_RATES.slow : SPEED_RATES.normal;
        entries.push({
          text: primaryText,
          language: config.primary.lang,
          voice: config.primary.voice,
          rate,
          langKey: config.primary.langKey,
          pageNumber: page.pageNumber,
          lineIndex: lineIdx,
          breakBeforeMs: isFirst ? 0 : 200,
          speakerName: line.speaker,
          stageDirection: line.stageDirection,
        });
        isFirst = false;
      }

      // Secondary language (bilingual only)
      if (isBilingual && "secondary" in config) {
        const secondaryText = (config.secondary!.langKey === "es" ? line.es : line.en)?.trim();
        if (secondaryText) {
          entries.push({
            text: secondaryText,
            language: config.secondary!.lang,
            voice: config.secondary!.voice,
            rate: SPEED_RATES.normal,
            langKey: config.secondary!.langKey,
            pageNumber: page.pageNumber,
            lineIndex: lineIdx,
            breakBeforeMs: 300, // bilingual pause between target/native
          });
        }
      }
    }
  }

  return entries;
}

// ============================================================================
// Chunking — split speech plan to stay under Azure's 10-minute limit
// ============================================================================

// Azure TTS rejects SSML that produces >600s of audio. We cap each chunk by
// estimated character count rather than segment count, since line/paragraph
// length varies hugely across story types (short story lines vs novel paragraphs).
// At ~15 chars/sec audio (normal speed) and a 500s target (safety margin under 600s):
//   Normal: ~7,500 chars per chunk
//   Slow (0.7x rate → ~10.5 chars/sec): ~5,250 chars per chunk
// Azure also limits SSML to 50 <voice> elements — in bilingual mode every
// segment alternates voices, so we must also cap voice switches per chunk.
const MAX_CHUNK_CHARS_NORMAL = 7500;
const MAX_CHUNK_CHARS_SLOW = 5250;
const MAX_VOICE_ELEMENTS = 49; // Azure allows max 50; keep 1 headroom

export function toSSMLSegments(entries: SpeechPlanEntry[]): ChapterSSMLSegment[] {
  const LOCALE_MAP: Record<string, string> = { "es-ES": "es-MX" };
  return entries.map((entry) => ({
    text: entry.text,
    language: entry.language,
    voice: entry.voice,
    rate: entry.rate,
    ssmlLang: LOCALE_MAP[entry.language] || entry.language,
    contentLang: entry.langKey,
    breakBeforeMs: entry.breakBeforeMs,
    speakerName: entry.speakerName,
    stageDirection: entry.stageDirection,
  }));
}

// ============================================================================
// Inngest-pipeline helpers: extracted from generateChapterAudio so each
// chunk can run in its own Inngest step. The synchronous in-process
// generateChapterAudio (below) calls these in a loop.
// ============================================================================

export interface PlannedChapter {
  chunks: SpeechPlanEntry[][];
  totalSentences: number;
  totalCharacters: number;
}

/**
 * Load chapter content, build the speech plan, and split it into chunks
 * respecting Azure's per-synthesis character + voice-element limits. Pure;
 * does no Azure or R2 work.
 */
export async function planAndChunkChapter(
  request: ChapterAudioRequest,
): Promise<PlannedChapter> {
  const pages = await loadChapterContent(request.storySlug, request.level, request.chapter);
  const plan = buildSpeechPlan(pages, request.mode, request.speed);
  if (plan.length === 0) {
    throw new Error(
      `No speakable content found for ${request.storySlug}/${request.level} chapter ${request.chapter}`,
    );
  }
  const totalSentences = plan.length;
  const totalCharacters = plan.reduce((sum, entry) => sum + entry.text.length, 0);

  const maxChunkChars = request.speed === "slow" ? MAX_CHUNK_CHARS_SLOW : MAX_CHUNK_CHARS_NORMAL;
  const chunks: SpeechPlanEntry[][] = [];
  let chunkStart = 0;
  while (chunkStart < plan.length) {
    let voiceCount = 0;
    let lastVoice: string | null = null;
    let chunkEnd = chunkStart;
    let chunkChars = 0;
    while (chunkEnd < plan.length) {
      const entry = plan[chunkEnd];
      if (entry.voice !== lastVoice) {
        if (voiceCount >= MAX_VOICE_ELEMENTS) break;
        voiceCount++;
        lastVoice = entry.voice;
      }
      if (chunkChars + entry.text.length > maxChunkChars && chunkEnd > chunkStart) break;
      chunkChars += entry.text.length;
      chunkEnd++;
    }
    const chunk = plan.slice(chunkStart, chunkEnd);
    if (chunkStart > 0 && chunk.length > 0) {
      chunk[0] = { ...chunk[0], breakBeforeMs: 0 };
    }
    chunks.push(chunk);
    chunkStart = chunkEnd;
  }

  return { chunks, totalSentences, totalCharacters };
}

export interface ChunkAudioResult {
  /** MP3 bytes for this chunk. */
  audioBuffer: Buffer;
  /** Sentence timings already offset by `timeOffset`. */
  sentenceTimings: SentenceTiming[];
  /** Wall-clock audio duration of this chunk (seconds). */
  duration: number;
}

/**
 * Synthesize one chunk (MP3 + WAV in parallel) and run forced alignment
 * on the WAV. Returns the MP3 buffer and offset-adjusted sentence timings.
 * Falls back to bookmark timings if alignment fails.
 */
export async function generateChunkAudio(
  chunk: SpeechPlanEntry[],
  isBilingual: boolean,
  timeOffset: number,
  chunkLabel: string = "",
): Promise<ChunkAudioResult> {
  const speech = getAzureSpeechService();
  const ssmlSegments = toSSMLSegments(chunk);

  const [result, wavBuffer] = await Promise.all([
    speech.generateChapterBuffer(ssmlSegments),
    speech.generateChapterBufferWav(ssmlSegments),
  ]);
  const audioBuffer = Buffer.from(result.buffer);

  // Bookmark-based fallback timings
  const bookmarkTimings: SentenceTiming[] = chunk.map((entry, i) => {
    const timing = result.sentenceTimings[i];
    return {
      pageNumber: entry.pageNumber,
      lineIndex: entry.lineIndex,
      language: entry.langKey,
      startTime: timing.startTime + timeOffset,
      endTime: timing.endTime + timeOffset,
      text: entry.text,
      wordTimings: timing.wordTimings.map((wt) => ({
        ...wt,
        startTime: wt.startTime + timeOffset,
        endTime: wt.endTime + timeOffset,
      })),
    };
  });

  let sentenceTimings: SentenceTiming[];
  try {
    const chunkSentenceInfo = chunk.map((entry) => ({
      text: entry.text,
      language: entry.langKey as "en" | "es",
      pageNumber: entry.pageNumber,
      lineIndex: entry.lineIndex,
    }));
    const chunkBookmarkTimings = bookmarkTimings.map((bt) => ({
      startTime: bt.startTime,
      endTime: bt.endTime,
    }));
    const aligned = await alignChunkSentences(
      wavBuffer,
      chunkSentenceInfo,
      timeOffset,
      isBilingual,
      chunkBookmarkTimings,
    );
    sentenceTimings = chunk.map((_, i) => {
      const a = aligned[i];
      const b = bookmarkTimings[i];
      if (a.wordTimings.length > 0) {
        return { ...b, startTime: a.startTime, endTime: a.endTime, wordTimings: a.wordTimings };
      }
      return b;
    });
    const alignedCount = aligned.filter((r) => r.wordTimings.length > 0).length;
    console.log(`[chapter-audio]${chunkLabel ? ` ${chunkLabel}:` : ""} ${alignedCount}/${chunk.length} sentences aligned via PA`);
  } catch (err) {
    console.error(`[chapter-audio]${chunkLabel ? ` ${chunkLabel}:` : ""} alignment failed, using bookmarks:`, err);
    sentenceTimings = bookmarkTimings;
  }

  return { audioBuffer, sentenceTimings, duration: result.totalDuration };
}

// ============================================================================
// Main entry point
// ============================================================================

/**
 * Generate chapter-level audio with bookmark timing. Splits long chapters into
 * chunks to stay under Azure's 10-minute-per-synthesis limit, then concatenates
 * the resulting audio buffers and merges timing metadata.
 */
export async function generateChapterAudio(
  request: ChapterAudioRequest,
  onProgress?: (progress: ChapterGenerationProgress) => void
): Promise<ChapterAudioResponse> {
  const cache = getTTSCacheService();

  // 1. Check if chapter audio is already cached
  const cached = await cache.getChapterCached(request);
  if (cached) {
    onProgress?.({ status: "complete", sentencesComplete: 0, sentencesTotal: 0 });
    return cached;
  }

  // 2-4. Plan + chunk (shared with the Inngest pipeline)
  const { chunks, totalSentences, totalCharacters } = await planAndChunkChapter(request);
  const generationStartTime = Date.now();

  onProgress?.({ status: "generating", sentencesComplete: 0, sentencesTotal: totalSentences });

  // 5. Synthesize each chunk + run forced alignment (one chunk at a time)
  const isBilingual = request.mode === "bilingual-en" || request.mode === "bilingual-es";
  const audioBuffers: Buffer[] = [];
  const allSentenceTimings: SentenceTiming[] = [];
  const pageBoundaryMap = new Map<number, { startTime: number; endTime: number; sentenceCount: number }>();
  let timeOffset = 0;

  for (let c = 0; c < chunks.length; c++) {
    const chunk = chunks[c];
    onProgress?.({
      status: "aligning",
      sentencesComplete: Math.round(totalSentences * (c / chunks.length)),
      sentencesTotal: totalSentences,
    });
    const chunkResult = await generateChunkAudio(chunk, isBilingual, timeOffset, `chunk ${c + 1}/${chunks.length}`);
    audioBuffers.push(chunkResult.audioBuffer);
    allSentenceTimings.push(...chunkResult.sentenceTimings);

    // Build page boundaries
    for (const st of allSentenceTimings.slice(-chunk.length)) {
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

    timeOffset += chunkResult.duration;
  }

  // Enforce non-overlapping, monotonic sentence timings.
  // PA alignment for bilingual can produce overlapping ranges when one
  // language's PA pass finds phonemes in the other language's audio.
  // Clamp each sentence's endTime to the next sentence's startTime.
  for (let i = 0; i < allSentenceTimings.length - 1; i++) {
    const curr = allSentenceTimings[i];
    const next = allSentenceTimings[i + 1];

    // Ensure startTime is monotonic
    if (next.startTime < curr.startTime) {
      next.startTime = curr.endTime;
    }

    // Ensure no overlap: curr.endTime <= next.startTime
    if (curr.endTime > next.startTime) {
      // Split the overlap at the midpoint
      const mid = (curr.endTime + next.startTime) / 2;
      curr.endTime = mid;
      next.startTime = mid;

      // Also trim word timings that extend past the clamped endTime
      curr.wordTimings = curr.wordTimings.filter(w => w.startTime < curr.endTime);
      next.wordTimings = next.wordTimings.filter(w => w.startTime >= next.startTime);
    }
  }

  // Rebuild page boundaries from corrected timings
  pageBoundaryMap.clear();
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

  onProgress?.({ status: "concatenating", sentencesComplete: totalSentences, sentencesTotal: totalSentences });

  const concatenatedBuffer = Buffer.concat(audioBuffers);

  // 6. Build final metadata (using PA-aligned timings where available)
  const pageBoundaries: PageBoundary[] = Array.from(pageBoundaryMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([pageNumber, data]) => ({
      pageNumber,
      startTime: data.startTime,
      endTime: data.endTime,
      sentenceCount: data.sentenceCount,
    }));

  const generationDurationMs = Date.now() - generationStartTime;

  // Use the last sentence's endTime for total duration (more accurate if Whisper-aligned)
  const alignedDuration = allSentenceTimings.length > 0
    ? allSentenceTimings[allSentenceTimings.length - 1].endTime
    : timeOffset;

  const metadata: ChapterAudioMetadata = {
    variant: request,
    totalDuration: alignedDuration,
    totalSentences: allSentenceTimings.length,
    totalCharacters,
    generationDurationMs,
    sentenceTimings: allSentenceTimings,
    pageBoundaries,
    generatedAt: Date.now(),
    sentenceHashes: [],
    version: 3,
  };

  // 8. Record generation stats in database (non-blocking)
  prisma.ttsGenerationStat.create({
    data: {
      storySlug: request.storySlug,
      level: request.level,
      chapter: request.chapter,
      mode: request.mode,
      speed: request.speed,
      totalCharacters,
      totalSentences,
      generationDurationMs,
      audioDurationMs: Math.round(timeOffset * 1000),
    },
  }).catch((err) => console.error("[chapter-audio] Failed to record generation stats:", err));

  // 9. Upload concatenated audio to R2
  onProgress?.({ status: "uploading", sentencesComplete: totalSentences, sentencesTotal: totalSentences });
  const audioUrl = await cache.saveChapterAudio(request, concatenatedBuffer, metadata);

  onProgress?.({ status: "complete", sentencesComplete: totalSentences, sentencesTotal: totalSentences });

  return { audioUrl, metadata, cached: false };
}
