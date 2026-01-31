// src/lib/text-processing/content-processors/prose-processor.ts
// Standard prose processing (novels, short stories)

import type {
  ContentType,
  PreprocessedText,
  LineBreakStyle,
} from '../types';

import { runAllCleanup } from '../shared/cleanup';
import {
  detectLineBreakStyle,
  normalizeLineBreaks,
  normalizeWhitespace,
} from '../shared/whitespace';
import {
  removeGutenbergFrontMatter,
  extractBackMatter,
} from '../shared/gutenberg';
import {
  detectChapterMarkers,
  filterOutTOCMarkers,
  splitIntoChapters,
  extractFrontMatter,
} from '../shared/chapter-detection';

// ============================================================================
// PROSE PREPROCESSING
// ============================================================================

/**
 * Preprocess prose text (novels, short stories)
 *
 * Unlike poetry, prose processing:
 * - Joins text-wrapped lines into paragraphs
 * - Does NOT preserve leading whitespace
 * - Collapses multiple blank lines
 * - Removes chapter markers from content
 */
export function preprocessProse(
  rawText: string,
  forceStructureType?: ContentType
): PreprocessedText {
  const originalLength = rawText.length;

  // Step 0: Remove Gutenberg front matter markers
  const noGutenbergHeader = removeGutenbergFrontMatter(rawText);

  // Step 1: Run cleanup (remove line numbers, page markers, footnotes, asterisks)
  const { text: cleanedText, stats: cleanupStats } = runAllCleanup(noGutenbergHeader);

  // Step 2: Normalize whitespace (for prose, this can strip indentation)
  const normalized = normalizeWhitespace(cleanedText);

  // Step 3: Split into lines for analysis
  let lines = normalized.split('\n');

  // Step 4: Detect and remove back matter
  const { contentLines, backMatter, removed: backMatterRemoved } = extractBackMatter(lines);
  lines = contentLines;

  // Step 5: Structure type is prose
  const structureType: ContentType = forceStructureType || 'prose';

  // Step 6: Detect chapter markers
  const rawMarkers = detectChapterMarkers(lines, { structureType });
  const markers = filterOutTOCMarkers(rawMarkers, lines);

  // Step 7: Extract front matter
  const firstChapterLine = markers.length > 0 ? markers[0].lineIndex : lines.length;
  const frontMatter = extractFrontMatter(lines, firstChapterLine);

  // Step 8: Split into chapters (NOT preserving markers - cleaner for prose)
  let chapters = splitIntoChapters(lines, markers, { preserveMarkers: false });

  // Step 9: Filter out empty/boilerplate chapters
  chapters = chapters.filter(chapter => {
    const text = chapter.rawText.trim();
    if (text.length < 50) return false;
    if (/Project Gutenberg/i.test(text) && text.length < 500) return false;
    return true;
  });

  // Renumber chapters
  chapters = chapters.map((ch, idx) => ({
    ...ch,
    number: idx + 1,
  }));

  // Step 10: Detect line break style and normalize each chapter
  const lineBreakStyle: LineBreakStyle = detectLineBreakStyle(
    chapters.map(ch => ch.rawText).join('\n\n')
  );

  chapters = chapters.map(ch => ({
    ...ch,
    rawText: normalizeLineBreaks(ch.rawText, lineBreakStyle),
  }));

  // Step 11: Build full cleaned text
  const cleanedFullText = chapters
    .map((ch) => {
      const divider = ch.title
        ? `--- Chapter ${ch.number}: ${ch.title} ---`
        : `--- Chapter ${ch.number} ---`;
      return `${divider}\n\n${ch.rawText}`;
    })
    .join('\n\n');

  return {
    frontMatter,
    backMatter,
    chapters,
    stats: {
      originalLength,
      cleanedLength: cleanedFullText.length,
      lineNumbersRemoved: cleanupStats.lineNumbersRemoved,
      pageMarkersRemoved: cleanupStats.pageMarkersRemoved,
      footnoteIndicatorsRemoved: cleanupStats.footnoteIndicatorsRemoved,
      asteriskDividersRemoved: cleanupStats.asteriskDividersRemoved,
      chaptersDetected: chapters.length,
      backMatterRemoved,
      lineBreakStyle,
      structureType,
    },
    cleanedFullText,
  };
}
