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
} from "@/lib/admin/text-preprocessor";

export { cleanText, parseChaptersFromText } from "@/lib/admin/text-utils";

// ============================================================================
// CONTENT STRUCTURE TYPES
// Matches existing story content.ts file format
// ============================================================================

export interface StoryLine {
  es: string;
  en: string;
}

export interface PageContent {
  lines: StoryLine[];
}

export interface ChapterContent {
  pages: Record<number, PageContent>;
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
 * Build the content structure matching existing content.ts format.
 * Creates a LevelContent object ready for database storage.
 *
 * @param storySlug - The story's slug identifier
 * @param levelNum - The CEFR level number (1-6)
 * @param hasChapters - Whether the story has multiple chapters
 * @param chaptersData - Array of chapter data with source and translated lines
 * @param sourceLanguage - The source language ("en" or "es")
 * @returns LevelContent object matching the story content format
 */
export function buildContentStructure(
  storySlug: string,
  levelNum: number,
  hasChapters: boolean,
  chaptersData: { sourceLines: string[]; translatedLines: string[] }[],
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

    chapters[chapterIndex + 1] = { pages };
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
 * Provides a simpler interface for common use cases.
 *
 * @param text - Raw text to parse
 * @returns Object with hasChapters flag and array of chapter texts
 */
export function parseChapters(text: string): {
  hasChapters: boolean;
  chapters: string[];
} {
  // Use the full admin preprocessing pipeline for robust text cleaning and chapter detection
  const preprocessed = preprocessText(text);

  // If preprocessing found chapters, use those
  if (preprocessed.chapters.length > 1) {
    return {
      hasChapters: true,
      chapters: preprocessed.chapters.map((ch) => ch.rawText),
    };
  }

  // For single-chapter or no-chapter content, use the cleaned full text
  // Also try the simpler parseChaptersFromText for common chapter markers
  const cleanedText = adminCleanText(preprocessed.cleanedFullText || text);
  const parsedChapters = parseChaptersFromText(cleanedText);

  if (parsedChapters.length > 1) {
    return {
      hasChapters: true,
      chapters: parsedChapters,
    };
  }

  // No chapters detected - return as single chapter
  return {
    hasChapters: false,
    chapters: [cleanedText],
  };
}
