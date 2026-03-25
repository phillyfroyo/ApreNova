// src/lib/chapter-audio.ts
// Server-side chapter audio generation: loads content, generates per-sentence
// audio (leveraging R2 cache), concatenates into a single MP3, and stores
// the chapter file + timing metadata in R2.

import { getAzureSpeechService, VOICE_CONFIG, SPEED_RATES } from "./azure-speech";
import { getTTSCacheService } from "./tts-cache";
import type { TTSRequest, WordTiming } from "@/types/azure-tts";
import type { StoryLine } from "@/lib/story-processing/text-processing";
import type {
  ChapterAudioRequest,
  ChapterAudioResponse,
  ChapterAudioMetadata,
  SentenceTiming,
  PageBoundary,
  TTSSegment,
  TTSSpeechSegment,
  TTSSilenceSegment,
  ChapterGenerationProgress,
} from "@/types/chapter-audio";

// ============================================================================
// Silence buffer generation
// ============================================================================

// Pre-compute minimal MP3 silence frames.
// A valid MP3 frame at 128kbps, 44100Hz, mono is 417 bytes.
// For simplicity we generate silence via Azure once and cache the buffer.
let silenceBuffers: Map<number, Buffer> | null = null;

async function getSilenceBuffer(durationMs: number): Promise<Buffer> {
  if (!silenceBuffers) silenceBuffers = new Map();
  if (silenceBuffers.has(durationMs)) return silenceBuffers.get(durationMs)!;

  // Generate silence using Azure TTS with a break element
  const speech = getAzureSpeechService();
  const result = await speech.generateSpeechBuffer({
    text: ".",
    language: "en-US",
    speed: "normal",
    voice: VOICE_CONFIG["en-US"].normal,
  });

  // The shortest utterance ("." ) is ~200-400ms. For longer silences we can
  // use this as-is. For shorter ones we take a fraction of the buffer.
  // In practice we only need 200ms and 300ms silences, so this single
  // generation covers both use cases well enough.
  const buf = Buffer.from(result.buffer);
  silenceBuffers.set(durationMs, buf);
  return buf;
}

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
  // Dynamic import of the story content module
  let levelContent: any;
  try {
    const mod = await import(`@/content/${storySlug}/${level}/index.ts`);
    levelContent = mod.default || mod.levelContent;
  } catch {
    const mod = await import(`@/content/${storySlug}/${level}/content.ts`);
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
// Segment planning
// ============================================================================

/**
 * Build the ordered list of TTS segments (speech + silence) for concatenation.
 */
export function buildSegmentPlan(
  pages: PageLines[],
  mode: ChapterAudioRequest["mode"],
  speed: ChapterAudioRequest["speed"]
): TTSSegment[] {
  const segments: TTSSegment[] = [];

  // Determine voices and language mapping
  const isMonolingual = mode === "en" || mode === "es";
  const isBilingual = !isMonolingual;

  // For bilingual modes: first language is target, second is native
  // bilingual-en: user is en/, target=es, native=en → ES(Ava) then EN(Brian)
  // bilingual-es: user is es/, target=en, native=es → EN(Brian) then ES(Ava)
  const getLanguageConfig = () => {
    switch (mode) {
      case "en":
        return { primary: { lang: "en-US" as const, voice: VOICE_CONFIG["en-US"].normal, langKey: "en" as const } };
      case "es":
        return { primary: { lang: "es-ES" as const, voice: VOICE_CONFIG["es-ES"].normal, langKey: "es" as const } };
      case "bilingual-en":
        return {
          primary: { lang: "es-ES" as const, voice: VOICE_CONFIG["es-ES"].normal, langKey: "es" as const },   // target
          secondary: { lang: "en-US" as const, voice: VOICE_CONFIG["en-US"].normal, langKey: "en" as const },  // native
        };
      case "bilingual-es":
        return {
          primary: { lang: "en-US" as const, voice: VOICE_CONFIG["en-US"].normal, langKey: "en" as const },   // target
          secondary: { lang: "es-ES" as const, voice: VOICE_CONFIG["es-ES"].normal, langKey: "es" as const },  // native
        };
    }
  };

  const config = getLanguageConfig();
  let isFirstSentence = true;

  for (const page of pages) {
    for (let lineIdx = 0; lineIdx < page.lines.length; lineIdx++) {
      const line = page.lines[lineIdx];

      // Skip non-audio content
      if (line.isStanzaBreak || line.isEditorialNote) continue;
      const hasContent = (line.es && line.es.trim()) || (line.en && line.en.trim());
      if (!hasContent) continue;
      if (line.isStageDirectionOnly) continue;

      // Inter-sentence silence (not before the first sentence)
      if (!isFirstSentence) {
        segments.push({ type: "silence", durationMs: 200 } as TTSSilenceSegment);
      }
      isFirstSentence = false;

      // Primary language segment (target for bilingual, only for monolingual)
      const primaryText = (config.primary.langKey === "es" ? line.es : line.en)?.trim();
      if (primaryText) {
        // For bilingual slow mode, slow rate only on target language
        const rate = speed === "slow" ? SPEED_RATES.slow : SPEED_RATES.normal;

        const speechSeg: TTSSpeechSegment = {
          type: "speech",
          text: primaryText,
          language: config.primary.lang,
          voice: config.primary.voice,
          rate,
          speed,
          pageNumber: page.pageNumber,
          lineIndex: lineIdx,
          langKey: config.primary.langKey,
          speakerName: line.speaker,
          stageDirection: line.stageDirection,
        };
        segments.push(speechSeg);
      }

      // Secondary language segment (bilingual only — native language at normal speed)
      if (isBilingual && "secondary" in config) {
        const secondaryText = (config.secondary!.langKey === "es" ? line.es : line.en)?.trim();
        if (secondaryText) {
          // Bilingual pause between target and native
          segments.push({ type: "silence", durationMs: 300 } as TTSSilenceSegment);

          const speechSeg: TTSSpeechSegment = {
            type: "speech",
            text: secondaryText,
            language: config.secondary!.lang,
            voice: config.secondary!.voice,
            rate: SPEED_RATES.normal, // native always normal speed
            speed: "normal",
            pageNumber: page.pageNumber,
            lineIndex: lineIdx,
            langKey: config.secondary!.langKey,
          };
          segments.push(speechSeg);
        }
      }
    }
  }

  return segments;
}

// ============================================================================
// Audio generation + concatenation
// ============================================================================

interface GeneratedSegment {
  segment: TTSSegment;
  buffer: Buffer;
  wordTimings: WordTiming[];
  duration: number;
  cacheKey?: string; // for speech segments, the per-sentence R2 cache key
}

/**
 * Generate or fetch audio for a single speech segment.
 * Leverages existing per-sentence R2 cache.
 */
async function generateSpeechSegment(seg: TTSSpeechSegment): Promise<GeneratedSegment> {
  const cache = getTTSCacheService();
  const speech = getAzureSpeechService();

  const ttsRequest: TTSRequest = {
    text: seg.text,
    language: seg.language,
    speed: seg.speed,
    voice: seg.voice,
    rate: seg.rate,
    speakerName: seg.speakerName,
    stageDirection: seg.stageDirection,
  };

  const cacheKey = cache.generateCacheKey(ttsRequest);

  // Try to get the audio buffer from R2 cache
  const cachedBuffer = await cache.getSentenceAudioBuffer(cacheKey);
  if (cachedBuffer) {
    // Also need the metadata for word timings
    const cachedResponse = await cache.getCached(ttsRequest);
    return {
      segment: seg,
      buffer: cachedBuffer,
      wordTimings: cachedResponse?.wordTimings || [],
      duration: cachedResponse?.duration || 0,
      cacheKey,
    };
  }

  // Generate fresh audio
  const result = await speech.generateSpeechBuffer(ttsRequest);

  // Save to per-sentence cache for future reuse
  await cache.saveToCache(ttsRequest, result.buffer, result.wordTimings, result.duration);

  return {
    segment: seg,
    buffer: Buffer.from(result.buffer),
    wordTimings: result.wordTimings,
    duration: result.duration,
    cacheKey,
  };
}

/**
 * Generate a silence segment buffer.
 */
async function generateSilenceSegment(seg: TTSSilenceSegment): Promise<GeneratedSegment> {
  const buf = await getSilenceBuffer(seg.durationMs);
  // Estimate duration from the actual buffer (silence is a short "." utterance)
  const duration = buf.byteLength * 8 / 128000; // rough estimate for 128kbps MP3
  return {
    segment: seg,
    buffer: buf,
    wordTimings: [],
    duration,
  };
}

/**
 * Concatenate generated segments into a single chapter MP3 with accumulated timing metadata.
 */
function concatenateSegments(
  generated: GeneratedSegment[],
  request: ChapterAudioRequest
): { buffer: Buffer; metadata: ChapterAudioMetadata } {
  const buffers: Buffer[] = [];
  const sentenceTimings: SentenceTiming[] = [];
  const sentenceHashes: string[] = [];
  let timeOffset = 0;

  // Track page boundaries
  const pageBoundaryMap = new Map<number, { startTime: number; endTime: number; sentenceCount: number }>();

  for (const gen of generated) {
    buffers.push(gen.buffer);

    if (gen.segment.type === "speech") {
      const seg = gen.segment as TTSSpeechSegment;

      // Adjust word timings to chapter-level offsets
      const adjustedTimings: WordTiming[] = gen.wordTimings.map(wt => ({
        ...wt,
        startTime: wt.startTime + timeOffset,
        endTime: wt.endTime + timeOffset,
      }));

      const sentenceTiming: SentenceTiming = {
        pageNumber: seg.pageNumber,
        lineIndex: seg.lineIndex,
        language: seg.langKey,
        startTime: timeOffset,
        endTime: timeOffset + gen.duration,
        text: seg.text,
        wordTimings: adjustedTimings,
      };
      sentenceTimings.push(sentenceTiming);

      if (gen.cacheKey) {
        sentenceHashes.push(gen.cacheKey);
      }

      // Update page boundary tracking
      const existing = pageBoundaryMap.get(seg.pageNumber);
      if (existing) {
        existing.endTime = timeOffset + gen.duration;
        existing.sentenceCount++;
      } else {
        pageBoundaryMap.set(seg.pageNumber, {
          startTime: timeOffset,
          endTime: timeOffset + gen.duration,
          sentenceCount: 1,
        });
      }
    }

    timeOffset += gen.duration;
  }

  // Build page boundaries array
  const pageBoundaries: PageBoundary[] = Array.from(pageBoundaryMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([pageNumber, data]) => ({
      pageNumber,
      startTime: data.startTime,
      endTime: data.endTime,
      sentenceCount: data.sentenceCount,
    }));

  const metadata: ChapterAudioMetadata = {
    variant: request,
    totalDuration: timeOffset,
    totalSentences: sentenceTimings.length,
    sentenceTimings,
    pageBoundaries,
    generatedAt: Date.now(),
    sentenceHashes,
    version: 1,
  };

  return { buffer: Buffer.concat(buffers), metadata };
}

// ============================================================================
// Main entry point
// ============================================================================

/**
 * Generate chapter-level audio. Checks cache first, then generates all
 * per-sentence audio (with R2 cache reuse), concatenates, and stores.
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

  // 2. Load all content for the chapter
  const pages = await loadChapterContent(request.storySlug, request.level, request.chapter);

  // 3. Build segment plan
  const segments = buildSegmentPlan(pages, request.mode, request.speed);
  const speechSegments = segments.filter(s => s.type === "speech") as TTSSpeechSegment[];
  const totalSpeech = speechSegments.length;

  onProgress?.({ status: "generating", sentencesComplete: 0, sentencesTotal: totalSpeech });

  // 4. Generate all segments (speech segments with 3-way concurrency, silence inline)
  const generated: GeneratedSegment[] = [];
  let speechComplete = 0;

  // Process segments in order, but batch speech generation with concurrency
  const CONCURRENCY = 3;
  let i = 0;

  while (i < segments.length) {
    const seg = segments[i];

    if (seg.type === "silence") {
      generated.push(await generateSilenceSegment(seg));
      i++;
      continue;
    }

    // Collect a batch of consecutive speech segments (up to CONCURRENCY)
    const speechBatch: { index: number; segment: TTSSpeechSegment }[] = [];
    let j = i;
    while (j < segments.length && speechBatch.length < CONCURRENCY) {
      if (segments[j].type === "speech") {
        speechBatch.push({ index: j, segment: segments[j] as TTSSpeechSegment });
      } else {
        // Hit a silence segment — process speech batch first, then handle silence next iteration
        break;
      }
      j++;
    }

    // Generate speech batch concurrently
    const batchResults = await Promise.all(
      speechBatch.map(({ segment }) => generateSpeechSegment(segment))
    );

    // Insert results in order, interleaving any silence segments between them
    for (let k = i; k < j; k++) {
      if (segments[k].type === "silence") {
        generated.push(await generateSilenceSegment(segments[k] as TTSSilenceSegment));
      } else {
        const batchIdx = speechBatch.findIndex(b => b.index === k);
        if (batchIdx !== -1) {
          generated.push(batchResults[batchIdx]);
          speechComplete++;
          onProgress?.({ status: "generating", sentencesComplete: speechComplete, sentencesTotal: totalSpeech });
        }
      }
    }

    i = j;
  }

  // 5. Concatenate
  onProgress?.({ status: "concatenating", sentencesComplete: totalSpeech, sentencesTotal: totalSpeech });
  const { buffer, metadata } = concatenateSegments(generated, request);

  // 6. Upload to R2
  onProgress?.({ status: "uploading", sentencesComplete: totalSpeech, sentencesTotal: totalSpeech });
  const audioUrl = await cache.saveChapterAudio(request, buffer, metadata);

  onProgress?.({ status: "complete", sentencesComplete: totalSpeech, sentencesTotal: totalSpeech });

  return { audioUrl, metadata, cached: false };
}
