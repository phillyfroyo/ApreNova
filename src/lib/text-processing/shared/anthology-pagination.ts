// src/lib/text-processing/shared/anthology-pagination.ts
// Anthology pagination - SINGLE SOURCE OF TRUTH
//
// Handles poem-aware pagination for anthology collections.
// Each poem gets its own page(s), with long poems split at stanza breaks.
//
// This module is used by:
// 1. Production upload pipeline (admin and user story uploads)
// 2. Dev Tools SU TP Algorithms testing system
// 3. buildSingleChapterContent() for streaming
// 4. buildContentStructureWithMetadata() for final content building
//
// CRITICAL: Never duplicate this logic. Always import from this module.

import { detectPoemBoundaries } from './poem-detection';
import type { PoemInfo, LineMetadata } from '../types';

// Re-export types for convenience
export type { PoemInfo, LineMetadata } from '../types';

/**
 * Maximum lines per page for anthology poems.
 * Set high enough that most poems fit on a single page.
 * Each poem starts on its own page; only very long poems span multiple pages.
 */
export const ANTHOLOGY_MAX_LINES_PER_PAGE = 50;

/**
 * Result of anthology pagination - includes poem tracking for navigation
 */
export interface AnthologyPaginationResult {
  pages: Array<{
    sourceLines: string[];
    translatedLines: string[];
    lineMetadata: Map<number, LineMetadata>;
    poemNumber: number;           // 1-based poem number
    poemTitle: string;            // Poem title
    isFirstPageOfPoem: boolean;   // True if first page of this poem
    isContinuation: boolean;      // True if continues from previous page
  }>;
  poems: PoemInfo[];  // Poem metadata for navigation
}

/**
 * Paginate poems for anthology structure with poem tracking.
 * - Poems can span multiple pages (max 50 lines per page)
 * - Long poems split at stanza breaks (blank lines)
 * - Each page tracks which poem it belongs to
 * - Returns poem metadata for navigation dropdowns
 *
 * @param sourceLines - Source language lines
 * @param translatedLines - Translated lines (parallel array)
 * @param lineMetadata - Optional metadata for each line
 * @returns Pages with poem tracking and poem info for navigation
 */
export function paginateAnthologyPoems(
  sourceLines: string[],
  translatedLines: string[],
  lineMetadata?: Map<number, LineMetadata>
): AnthologyPaginationResult {
  // Detect poem boundaries from source lines
  const detectedPoems = detectPoemBoundaries(sourceLines);

  const pages: AnthologyPaginationResult["pages"] = [];
  const poemInfoList: PoemInfo[] = [];

  for (let poemIdx = 0; poemIdx < detectedPoems.length; poemIdx++) {
    const poem = detectedPoems[poemIdx];
    const poemNumber = poemIdx + 1;
    const poemSourceLines = poem.lines;
    const poemTranslatedLines = translatedLines.slice(poem.startLine, poem.endLine);

    // Get metadata for this poem's lines (adjust indices)
    const poemMetadata = new Map<number, LineMetadata>();
    if (lineMetadata) {
      for (let i = poem.startLine; i < poem.endLine; i++) {
        const meta = lineMetadata.get(i);
        if (meta) {
          poemMetadata.set(i - poem.startLine, meta);
        }
      }
    }

    // Track pages for this poem
    const poemStartPage = pages.length + 1;
    let poemPageCount = 0;

    // Helper to add a page for this poem
    // Skips pages that have no actual content (only blank lines)
    const addPage = (
      srcLines: string[],
      transLines: string[],
      pageMeta: Map<number, LineMetadata>,
      isFirst: boolean
    ) => {
      // Check if page has any actual content (non-blank lines)
      const hasContent = srcLines.some(line => line.trim() !== '');
      if (!hasContent) {
        // Skip empty pages - don't add them
        return;
      }

      pages.push({
        sourceLines: srcLines,
        translatedLines: transLines,
        lineMetadata: pageMeta,
        poemNumber,
        poemTitle: poem.title,
        isFirstPageOfPoem: isFirst,
        isContinuation: !isFirst,
      });
      poemPageCount++;
    };

    // If poem fits on one page, add it as-is
    if (poemSourceLines.length <= ANTHOLOGY_MAX_LINES_PER_PAGE) {
      addPage(poemSourceLines, poemTranslatedLines, poemMetadata, true);
    } else {
      // Poem is too long - split at stanza breaks (blank lines)
      const blankLineIndices: number[] = [];
      for (let i = 0; i < poemSourceLines.length; i++) {
        if (poemSourceLines[i].trim() === '') {
          blankLineIndices.push(i);
        }
      }

      let pageStart = 0;
      let isFirstPage = true;

      // If no blank lines, just split at max lines
      if (blankLineIndices.length === 0) {
        while (pageStart < poemSourceLines.length) {
          const end = Math.min(pageStart + ANTHOLOGY_MAX_LINES_PER_PAGE, poemSourceLines.length);
          const pageMetadata = new Map<number, LineMetadata>();
          for (let i = pageStart; i < end; i++) {
            const meta = poemMetadata.get(i);
            if (meta) {
              pageMetadata.set(i - pageStart, meta);
            }
          }
          addPage(
            poemSourceLines.slice(pageStart, end),
            poemTranslatedLines.slice(pageStart, end),
            pageMetadata,
            isFirstPage
          );
          isFirstPage = false;
          pageStart = end;
        }
      } else {
        // Split at stanza breaks, respecting max lines
        let lastBreakInPage = -1;

        for (let i = 0; i < poemSourceLines.length; i++) {
          const linesInPage = i - pageStart;

          // Track blank lines as potential break points
          if (poemSourceLines[i].trim() === '') {
            lastBreakInPage = i;
          }

          // Check if we've exceeded max lines or reached end
          if (linesInPage >= ANTHOLOGY_MAX_LINES_PER_PAGE || i === poemSourceLines.length - 1) {
            let pageEnd: number;

            if (i === poemSourceLines.length - 1) {
              pageEnd = poemSourceLines.length;
            } else if (lastBreakInPage > pageStart) {
              pageEnd = lastBreakInPage + 1;
            } else {
              pageEnd = pageStart + ANTHOLOGY_MAX_LINES_PER_PAGE;
            }

            const pageMetadata = new Map<number, LineMetadata>();
            for (let j = pageStart; j < pageEnd; j++) {
              const meta = poemMetadata.get(j);
              if (meta) {
                pageMetadata.set(j - pageStart, meta);
              }
            }

            addPage(
              poemSourceLines.slice(pageStart, pageEnd),
              poemTranslatedLines.slice(pageStart, pageEnd),
              pageMetadata,
              isFirstPage
            );
            isFirstPage = false;
            pageStart = pageEnd;
            lastBreakInPage = -1;
            i = pageStart - 1;
          }
        }

        // Handle any remaining lines
        if (pageStart < poemSourceLines.length) {
          const pageMetadata = new Map<number, LineMetadata>();
          for (let j = pageStart; j < poemSourceLines.length; j++) {
            const meta = poemMetadata.get(j);
            if (meta) {
              pageMetadata.set(j - pageStart, meta);
            }
          }
          addPage(
            poemSourceLines.slice(pageStart),
            poemTranslatedLines.slice(pageStart),
            pageMetadata,
            isFirstPage
          );
        }
      }
    }

    // Record poem info for navigation
    poemInfoList.push({
      number: poemNumber,
      title: poem.title || `Poem ${poemNumber}`,
      startPage: poemStartPage,
      endPage: poemStartPage + poemPageCount - 1,
      pageCount: poemPageCount,
    });
  }

  return { pages, poems: poemInfoList };
}
