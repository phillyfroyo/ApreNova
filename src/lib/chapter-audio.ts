// src/lib/chapter-audio.ts
// Server-side chapter audio generation: loads content, builds a single SSML
// document with bookmark markers, synthesizes once via Azure TTS, and stores
// the chapter file + timing metadata in R2.

import { getAzureSpeechService, VOICE_CONFIG, SPEED_RATES } from "./azure-speech";
import type { ChapterSSMLSegment } from "./azure-speech";
import { getTTSCacheService } from "./tts-cache";
import { toFolderName } from "@/lib/cefr";
import type { WordTiming } from "@/types/azure-tts";
import type { StoryLine } from "@/lib/story-processing/text-processing";
import type {
  ChapterAudioRequest,
  ChapterAudioResponse,
  ChapterAudioMetadata,
  SentenceTiming,
  PageBoundary,
  TTSSpeechSegment,
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
  breakAfterMs?: number;
  speakerName?: string;
  stageDirection?: string;
  isPageTurn?: boolean; // whispered page turn announcement
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
          secondary: { lang: "en-US" as const, voice: VOICE_CONFIG["en-US"].normal, langKey: "en" as const },
        };
      case "bilingual-es":
        return {
          primary: { lang: "en-US" as const, voice: VOICE_CONFIG["en-US"].normal, langKey: "en" as const },
          secondary: { lang: "es-ES" as const, voice: VOICE_CONFIG["es-ES"].normal, langKey: "es" as const },
        };
    }
  };

  const config = getLanguageConfig();
  let isFirst = true;
  let lastPageNumber = -1;

  // Determine native language for page turn whisper
  // mode "es" or "bilingual-en" = en/ user (native English, learning Spanish)
  // mode "en" or "bilingual-es" = es/ user (native Spanish, learning English)
  const nativeLang = (mode === "es" || mode === "bilingual-en")
    ? { lang: "en-US" as const, voice: VOICE_CONFIG["en-US"].normal, langKey: "en" as const, text: "Turning page" }
    : { lang: "es-ES" as const, voice: VOICE_CONFIG["es-ES"].normal, langKey: "es" as const, text: "Pasando página" };

  for (const page of pages) {
    // Insert page turn whisper at page boundaries (not before the first page)
    if (lastPageNumber !== -1 && page.pageNumber !== lastPageNumber) {
      entries.push({
        text: nativeLang.text,
        language: nativeLang.lang,
        voice: nativeLang.voice,
        rate: 1.0,
        langKey: nativeLang.langKey,
        pageNumber: page.pageNumber,
        lineIndex: -1, // not a real line
        breakBeforeMs: 1600, // pause after last word of previous page
        breakAfterMs: 1200,  // pause after "turning page" before next page starts
        isPageTurn: true,
      });
    }

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
    lastPageNumber = page.pageNumber;
  }

  return entries;
}

// ============================================================================
// Main entry point
// ============================================================================

/**
 * Generate chapter-level audio as a single SSML synthesis with bookmark timing.
 * Checks chapter cache first. On miss, generates the full chapter in one Azure
 * TTS call with <bookmark> markers for exact sentence timing.
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
  const totalSentences = plan.filter(e => !e.isPageTurn).length;

  onProgress?.({ status: "generating", sentencesComplete: 0, sentencesTotal: totalSentences });

  // 4. Convert plan to SSML segments
  const LOCALE_MAP: Record<string, string> = { "es-ES": "es-MX" };
  const ssmlSegments: ChapterSSMLSegment[] = plan.map((entry) => ({
    text: entry.text,
    language: entry.language,
    voice: entry.voice,
    rate: entry.rate,
    ssmlLang: LOCALE_MAP[entry.language] || entry.language,
    contentLang: entry.langKey,
    breakBeforeMs: entry.breakBeforeMs,
    breakAfterMs: entry.breakAfterMs,
    speakerName: entry.speakerName,
    stageDirection: entry.stageDirection,
    isPageTurn: entry.isPageTurn,
  }));

  // 5. Single Azure TTS call with bookmarks
  const speech = getAzureSpeechService();
  const result = await speech.generateChapterBuffer(ssmlSegments);

  onProgress?.({ status: "concatenating", sentencesComplete: totalSentences, sentencesTotal: totalSentences });

  // 6. Build metadata from bookmark-based timings
  const sentenceTimings: SentenceTiming[] = [];
  const pageBoundaryMap = new Map<number, { startTime: number; endTime: number; sentenceCount: number }>();

  for (let i = 0; i < plan.length; i++) {
    const entry = plan[i];
    const timing = result.sentenceTimings[i];

    // Skip page turn announcements from sentence timings (not highlightable)
    if (!entry.isPageTurn) {
      sentenceTimings.push({
        pageNumber: entry.pageNumber,
        lineIndex: entry.lineIndex,
        language: entry.langKey,
        startTime: timing.startTime,
        endTime: timing.endTime,
        text: entry.text,
        wordTimings: timing.wordTimings,
      });

      // Page boundaries (only from real content, not page turn announcements)
      const existing = pageBoundaryMap.get(entry.pageNumber);
      if (existing) {
        existing.endTime = timing.endTime;
        existing.sentenceCount++;
      } else {
        pageBoundaryMap.set(entry.pageNumber, {
          startTime: timing.startTime,
          endTime: timing.endTime,
          sentenceCount: 1,
        });
      }
    }
  }

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
    totalDuration: result.totalDuration,
    totalSentences: sentenceTimings.length,
    sentenceTimings,
    pageBoundaries,
    generatedAt: Date.now(),
    sentenceHashes: [], // no per-sentence caching with single-SSML approach
    version: 2,
  };

  // 7. Upload to R2
  onProgress?.({ status: "uploading", sentencesComplete: totalSentences, sentencesTotal: totalSentences });
  const audioUrl = await cache.saveChapterAudio(request, Buffer.from(result.buffer), metadata);

  onProgress?.({ status: "complete", sentencesComplete: totalSentences, sentencesTotal: totalSentences });

  return { audioUrl, metadata, cached: false };
}
