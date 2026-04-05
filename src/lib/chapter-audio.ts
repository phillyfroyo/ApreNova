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

function toSSMLSegments(entries: SpeechPlanEntry[]): ChapterSSMLSegment[] {
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

  // 2. Load content
  const pages = await loadChapterContent(request.storySlug, request.level, request.chapter);

  // 3. Build speech plan
  const plan = buildSpeechPlan(pages, request.mode, request.speed);
  if (plan.length === 0) {
    throw new Error(`No speakable content found for ${request.storySlug}/${request.level} chapter ${request.chapter}`);
  }
  const totalSentences = plan.length;
  const totalCharacters = plan.reduce((sum, entry) => sum + entry.text.length, 0);
  const generationStartTime = Date.now();

  onProgress?.({ status: "generating", sentencesComplete: 0, sentencesTotal: totalSentences });

  // 4. Split plan into chunks (respecting character count and voice element limits)
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
      // Check voice element limit
      if (entry.voice !== lastVoice) {
        if (voiceCount >= MAX_VOICE_ELEMENTS) break;
        voiceCount++;
        lastVoice = entry.voice;
      }
      // Check character limit (always include at least one segment per chunk)
      if (chunkChars + entry.text.length > maxChunkChars && chunkEnd > chunkStart) break;
      chunkChars += entry.text.length;
      chunkEnd++;
    }

    const chunk = plan.slice(chunkStart, chunkEnd);
    // First entry of a continuation chunk shouldn't have a break (start of new synthesis)
    if (chunkStart > 0 && chunk.length > 0) {
      chunk[0] = { ...chunk[0], breakBeforeMs: 0 };
    }
    chunks.push(chunk);
    chunkStart = chunkEnd;
  }

  // 5. Synthesize each chunk (MP3 for storage + WAV for alignment), run forced alignment
  const speech = getAzureSpeechService();
  const isBilingual = request.mode === "bilingual-en" || request.mode === "bilingual-es";
  const audioBuffers: Buffer[] = [];
  const allSentenceTimings: SentenceTiming[] = [];
  const pageBoundaryMap = new Map<number, { startTime: number; endTime: number; sentenceCount: number }>();
  let timeOffset = 0;

  for (let c = 0; c < chunks.length; c++) {
    const chunk = chunks[c];
    const ssmlSegments = toSSMLSegments(chunk);

    // Synthesize MP3 (for storage) — includes bookmark timings
    const result = await speech.generateChapterBuffer(ssmlSegments);
    audioBuffers.push(Buffer.from(result.buffer));

    // Build bookmark-based sentence timings (fallback if alignment fails)
    const bookmarkTimings: SentenceTiming[] = [];
    for (let i = 0; i < chunk.length; i++) {
      const entry = chunk[i];
      const timing = result.sentenceTimings[i];
      bookmarkTimings.push({
        pageNumber: entry.pageNumber,
        lineIndex: entry.lineIndex,
        language: entry.langKey,
        startTime: timing.startTime + timeOffset,
        endTime: timing.endTime + timeOffset,
        text: entry.text,
        wordTimings: timing.wordTimings.map(wt => ({
          ...wt,
          startTime: wt.startTime + timeOffset,
          endTime: wt.endTime + timeOffset,
        })),
      });
    }

    console.log(`[chapter-audio] chunk ${c+1}/${chunks.length}: duration=${result.totalDuration.toFixed(3)}s timeOffset=${timeOffset.toFixed(3)}s`);

    // Synthesize WAV (for forced alignment) and run Azure Pronunciation Assessment
    onProgress?.({ status: "aligning", sentencesComplete: Math.round(totalSentences * (c / chunks.length)), sentencesTotal: totalSentences });
    try {
      console.log(`[chapter-audio] chunk ${c+1}: synthesizing WAV for alignment...`);
      const wavResult = await speech.generateChapterBufferWav(ssmlSegments);
      console.log(`[chapter-audio] chunk ${c+1}: WAV ${(wavResult.buffer.byteLength / 1024 / 1024).toFixed(1)}MB, running PA...`);

      const chunkSentenceInfo = chunk.map(entry => ({
        text: entry.text,
        language: entry.langKey as "en" | "es",
        pageNumber: entry.pageNumber,
        lineIndex: entry.lineIndex,
      }));

      // Use WAV-native bookmark timings for slicing (not MP3 bookmarks)
      // so clip boundaries match the actual WAV audio exactly.
      const wavBookmarkTimings = wavResult.sentenceTimings.map(wt => ({
        startTime: wt.startTime + timeOffset,
        endTime: wt.endTime + timeOffset,
      }));

      const alignedResults = await alignChunkSentences(
        wavResult.buffer, chunkSentenceInfo, timeOffset, isBilingual, wavBookmarkTimings
      );

      // Merge: use PA timestamps where available, bookmark as fallback
      for (let i = 0; i < chunk.length; i++) {
        const aligned = alignedResults[i];
        const bookmark = bookmarkTimings[i];

        if (aligned.wordTimings.length > 0) {
          allSentenceTimings.push({
            ...bookmark,
            startTime: aligned.startTime,
            endTime: aligned.endTime,
            wordTimings: aligned.wordTimings,
          });
        } else {
          allSentenceTimings.push(bookmark);
        }
      }

      const alignedCount = alignedResults.filter(r => r.wordTimings.length > 0).length;
      console.log(`[chapter-audio] chunk ${c+1}: ${alignedCount}/${chunk.length} sentences aligned via PA`);
    } catch (err) {
      console.error(`[chapter-audio] Alignment failed for chunk ${c+1}, using bookmarks:`, err);
      allSentenceTimings.push(...bookmarkTimings);
    }

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

    timeOffset += result.totalDuration;
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
