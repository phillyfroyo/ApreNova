// src/lib/story-processing/text-processing.ts
// Shared text processing utilities for stories
// Used by both admin and user story pipelines

// Re-export the admin text preprocessing utilities
// These are already well-tested and used in production
export {
  preprocessText,
  quickClean,
  normalizeLineBreaks,
  detectLineBreakStyle,
  // Poem/script parsing utilities
  detectStanzas,
  parseScriptLine,
  extractSpeakerNames,
  type StanzaMarkedLine,
  type ParsedScriptLine,
} from "@/lib/admin/text-preprocessor";

export { cleanText, parseChaptersFromText } from "@/lib/admin/text-utils";

// ============================================================================
// CONTENT STRUCTURE TYPES
// Matches existing story content.ts file format
// ============================================================================

export interface StoryLine {
  es: string;
  en: string;
  // Poem support
  stanzaNumber?: number;        // Which stanza this line belongs to (1-based)
  isStanzaBreak?: boolean;      // True for empty lines between stanzas (renders as visual break)
  // Script support
  speaker?: string;             // Speaker name e.g. "WALTER" - NOT translated
  speakerAnnotation?: string;   // e.g. "(V.O.)", "(O.S.)", "(CONT'D)" - NOT translated
  stageDirection?: string;      // e.g. "sighs", "He exits" - original language (for TTS)
  stageDirectionEs?: string;    // Translated stage direction for Spanish display
  stageDirectionEn?: string;    // Translated stage direction for English display
  isStageDirectionOnly?: boolean; // True if line is ONLY a stage direction (no dialogue)
}

export interface PageContent {
  lines: StoryLine[];
}

// ============================================================================
// CHAPTER METADATA TYPES
// ============================================================================

export interface ChapterMetadata {
  number: number;
  title: string;
  subtitle?: string;
}

export interface ParsedChapter {
  text: string;
  metadata: ChapterMetadata;
}

export interface ChapterContent {
  pages: Record<number, PageContent>;
  metadata?: ChapterMetadata; // Optional for backward compatibility with existing stories
}

export interface LevelContent {
  storySlug: string;
  level: number;
  hasChapters: boolean;
  chapters: Record<number, ChapterContent>;
}

// ============================================================================
// PAGE MARKERS
// ============================================================================

/**
 * Check if a line is a PAGE marker for manual pagination
 */
export function isPageMarker(line: string): boolean {
  const trimmed = line.trim().toUpperCase();
  return (
    trimmed === "PAGE" ||
    trimmed === "---PAGE---" ||
    trimmed === "[PAGE]" ||
    trimmed === "PAGE BREAK"
  );
}

// ============================================================================
// PAGINATION
// ============================================================================

/**
 * Paginate lines into pages.
 * Supports manual PAGE markers for explicit page breaks.
 * If no PAGE markers found, falls back to automatic pagination based on linesPerPage.
 *
 * @param lines - Array of text lines to paginate
 * @param linesPerPage - Target lines per page (default: 10)
 * @returns Array of pages, each page being an array of lines
 */
export function paginateLines(
  lines: string[],
  linesPerPage: number = 10
): string[][] {
  // Handle undefined/null/empty lines
  if (!lines || !Array.isArray(lines) || lines.length === 0) {
    return [[]];
  }

  // Check if there are any PAGE markers in the content
  const hasPageMarkers = lines.some(isPageMarker);

  if (hasPageMarkers) {
    // Manual pagination using PAGE markers
    const pages: string[][] = [];
    let currentPage: string[] = [];

    for (const line of lines) {
      if (isPageMarker(line)) {
        // PAGE marker found - end current page and start new one
        if (currentPage.length > 0) {
          pages.push([...currentPage]);
          currentPage = [];
        }
      } else {
        currentPage.push(line);
      }
    }

    // Don't forget remaining lines
    if (currentPage.length > 0) {
      pages.push(currentPage);
    }

    return pages.length > 0 ? pages : [[]];
  }

  // Automatic pagination based on linesPerPage
  const pages: string[][] = [];
  let currentPage: string[] = [];

  for (const line of lines) {
    currentPage.push(line);

    // Check if we should end the page
    if (currentPage.length >= linesPerPage) {
      // Try to find a good breaking point (sentence ending)
      const lastLineEndsSentence =
        line.endsWith(".") ||
        line.endsWith("!") ||
        line.endsWith("?") ||
        line.endsWith('"');

      if (lastLineEndsSentence || currentPage.length >= linesPerPage + 2) {
        pages.push([...currentPage]);
        currentPage = [];
      }
    }
  }

  // Don't forget remaining lines
  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages.length > 0 ? pages : [[]];
}

// ============================================================================
// CONTENT STRUCTURE BUILDING
// ============================================================================

/**
 * Input type for buildContentStructure - each chapter with content and optional metadata
 */
export interface ProcessedChapterData {
  sourceLines: string[];
  translatedLines: string[];
  metadata?: ChapterMetadata;
}

/**
 * Build the content structure matching existing content.ts format.
 * Creates a LevelContent object ready for database storage.
 * Now includes chapter metadata (title, subtitle) for UI display.
 *
 * @param storySlug - The story's slug identifier
 * @param levelNum - The CEFR level number (1-6)
 * @param hasChapters - Whether the story has multiple chapters
 * @param chaptersData - Array of chapter data with source and translated lines, plus optional metadata
 * @param sourceLanguage - The source language ("en" or "es")
 * @returns LevelContent object matching the story content format
 */
export function buildContentStructure(
  storySlug: string,
  levelNum: number,
  hasChapters: boolean,
  chaptersData: ProcessedChapterData[],
  sourceLanguage: "en" | "es"
): LevelContent {
  const chapters: Record<number, ChapterContent> = {};

  chaptersData.forEach((chapter, chapterIndex) => {
    const sourcePages = paginateLines(chapter.sourceLines);
    const translatedPages = paginateLines(chapter.translatedLines);
    const pages: Record<number, PageContent> = {};

    const maxPages = Math.max(sourcePages.length, translatedPages.length);

    for (let pIdx = 0; pIdx < maxPages; pIdx++) {
      const sourcePageLines = sourcePages[pIdx] || [];
      const translatedPageLines = translatedPages[pIdx] || [];
      const maxLines = Math.max(sourcePageLines.length, translatedPageLines.length);

      const lines: StoryLine[] = [];
      for (let lIdx = 0; lIdx < maxLines; lIdx++) {
        const sourceLine = sourcePageLines[lIdx]?.trim() || "";
        const translatedLine = translatedPageLines[lIdx]?.trim() || "";

        // IMPORTANT: es always gets Spanish, en always gets English
        // If source is Spanish, source goes to es, translated goes to en
        // If source is English, source goes to en, translated goes to es
        if (sourceLanguage === "es") {
          lines.push({ es: sourceLine, en: translatedLine });
        } else {
          lines.push({ en: sourceLine, es: translatedLine });
        }
      }

      pages[pIdx + 1] = { lines };
    }

    // Store chapter with pages and metadata (if available)
    const chapterContent: ChapterContent = { pages };
    if (chapter.metadata) {
      chapterContent.metadata = chapter.metadata;
    }
    chapters[chapterIndex + 1] = chapterContent;
  });

  return {
    storySlug,
    level: levelNum,
    hasChapters,
    chapters,
  };
}

// ============================================================================
// EXTENDED CONTENT STRUCTURE BUILDING (with line metadata for poems/scripts)
// ============================================================================

/**
 * Line metadata for poems and scripts.
 * Stored separately during processing, then merged into StoryLine.
 */
export interface LineMetadata {
  // Poem support
  stanzaNumber?: number;
  isStanzaBreak?: boolean;
  // Script support
  speaker?: string;
  speakerAnnotation?: string;
  stageDirection?: string;
  isStageDirectionOnly?: boolean;
}

/**
 * Extended chapter data that includes line-level metadata.
 */
export interface ProcessedChapterDataWithMetadata {
  sourceLines: string[];
  translatedLines: string[];
  metadata?: ChapterMetadata;
  /** Line metadata indexed by line number (0-based) */
  lineMetadata?: Map<number, LineMetadata>;
  /** Translated stage directions indexed by line number */
  translatedStageDirections?: Map<number, string>;
}

/**
 * Build content structure with line metadata support for poems and scripts.
 * This is an enhanced version that preserves stanza numbers, speaker names, etc.
 *
 * @param storySlug - The story's slug identifier
 * @param levelNum - The CEFR level number (1-6)
 * @param hasChapters - Whether the story has multiple chapters
 * @param chaptersData - Array of chapter data with source/translated lines and optional line metadata
 * @param sourceLanguage - The source language ("en" or "es")
 * @returns LevelContent object with enhanced StoryLine objects
 */
export function buildContentStructureWithMetadata(
  storySlug: string,
  levelNum: number,
  hasChapters: boolean,
  chaptersData: ProcessedChapterDataWithMetadata[],
  sourceLanguage: "en" | "es"
): LevelContent {
  const chapters: Record<number, ChapterContent> = {};

  chaptersData.forEach((chapter, chapterIndex) => {
    const sourcePages = paginateLines(chapter.sourceLines);
    const translatedPages = paginateLines(chapter.translatedLines);
    const pages: Record<number, PageContent> = {};

    const maxPages = Math.max(sourcePages.length, translatedPages.length);

    // Track which source line index we're at for metadata lookup
    let sourceLineIndex = 0;

    for (let pIdx = 0; pIdx < maxPages; pIdx++) {
      const sourcePageLines = sourcePages[pIdx] || [];
      const translatedPageLines = translatedPages[pIdx] || [];
      const maxLines = Math.max(sourcePageLines.length, translatedPageLines.length);

      const lines: StoryLine[] = [];
      for (let lIdx = 0; lIdx < maxLines; lIdx++) {
        const sourceLine = sourcePageLines[lIdx]?.trim() || "";
        const translatedLine = translatedPageLines[lIdx]?.trim() || "";

        // Get line metadata if available
        const lineMeta = chapter.lineMetadata?.get(sourceLineIndex);
        const translatedDirection = chapter.translatedStageDirections?.get(sourceLineIndex);

        // Build the StoryLine with metadata
        const storyLine: StoryLine = sourceLanguage === "es"
          ? { es: sourceLine, en: translatedLine }
          : { en: sourceLine, es: translatedLine };

        // Add poem metadata
        if (lineMeta?.stanzaNumber !== undefined) {
          storyLine.stanzaNumber = lineMeta.stanzaNumber;
        }
        if (lineMeta?.isStanzaBreak) {
          storyLine.isStanzaBreak = true;
        }

        // Add script metadata
        if (lineMeta?.speaker) {
          storyLine.speaker = lineMeta.speaker;
        }
        if (lineMeta?.speakerAnnotation) {
          storyLine.speakerAnnotation = lineMeta.speakerAnnotation;
        }
        if (lineMeta?.stageDirection) {
          storyLine.stageDirection = lineMeta.stageDirection;
          // Store translated stage direction in the appropriate field
          if (translatedDirection) {
            if (sourceLanguage === "es") {
              storyLine.stageDirectionEs = lineMeta.stageDirection;
              storyLine.stageDirectionEn = translatedDirection;
            } else {
              storyLine.stageDirectionEn = lineMeta.stageDirection;
              storyLine.stageDirectionEs = translatedDirection;
            }
          }
        }
        if (lineMeta?.isStageDirectionOnly) {
          storyLine.isStageDirectionOnly = true;
        }

        lines.push(storyLine);
        sourceLineIndex++;
      }

      pages[pIdx + 1] = { lines };
    }

    // Store chapter with pages and metadata (if available)
    const chapterContent: ChapterContent = { pages };
    if (chapter.metadata) {
      chapterContent.metadata = chapter.metadata;
    }
    chapters[chapterIndex + 1] = chapterContent;
  });

  return {
    storySlug,
    level: levelNum,
    hasChapters,
    chapters,
  };
}

// ============================================================================
// CHAPTER PARSING (uses admin utilities but provides a simpler interface)
// ============================================================================

import { preprocessText } from "@/lib/admin/text-preprocessor";
import { cleanText as adminCleanText, parseChaptersFromText } from "@/lib/admin/text-utils";

/**
 * Parse text into chapters using the admin pipeline's robust preprocessing.
 * Preserves chapter metadata (title, subtitle, number) for display in UI.
 *
 * @param text - Raw text to parse
 * @returns Object with hasChapters flag and array of ParsedChapter objects with metadata
 */
export function parseChapters(text: string): {
  hasChapters: boolean;
  chapters: ParsedChapter[];
} {
  // Use the full admin preprocessing pipeline for robust text cleaning and chapter detection
  const preprocessed = preprocessText(text);

  // DEBUG: Log chapter detection results
  console.log(`[parseChapters] preprocessText found ${preprocessed.chapters.length} chapters:`);
  preprocessed.chapters.forEach((ch, idx) => {
    console.log(`  [${idx}] number=${ch.number}, title="${ch.title}", rawText length=${ch.rawText.length}`);
  });

  // If preprocessing found chapters, use those with full metadata
  if (preprocessed.chapters.length > 1) {
    return {
      hasChapters: true,
      chapters: preprocessed.chapters.map((ch) => ({
        text: ch.rawText,
        metadata: {
          number: ch.number,
          title: ch.title || `Chapter ${ch.number}`,
          subtitle: ch.subtitle,
        },
      })),
    };
  }

  // For single-chapter or no-chapter content, use the cleaned full text
  // Also try the simpler parseChaptersFromText for common chapter markers
  const cleanedText = adminCleanText(preprocessed.cleanedFullText || text);
  const parsedChapters = parseChaptersFromText(cleanedText);

  if (parsedChapters.length > 1) {
    // Fallback parser doesn't extract titles, use default
    return {
      hasChapters: true,
      chapters: parsedChapters.map((chText, idx) => ({
        text: chText,
        metadata: {
          number: idx + 1,
          title: `Chapter ${idx + 1}`,
        },
      })),
    };
  }

  // No chapters detected - return as single chapter
  return {
    hasChapters: false,
    chapters: [{
      text: cleanedText,
      metadata: {
        number: 1,
        title: "Full Text",
      },
    }],
  };
}
