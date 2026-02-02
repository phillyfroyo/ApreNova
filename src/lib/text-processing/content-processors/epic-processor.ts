// src/lib/text-processing/content-processors/epic-processor.ts
// Epic/narrative poetry processing
// Similar to anthology but for longer narrative poems (e.g., Iliad, Beowulf)

import type {
  ContentType,
  PreprocessedText,
  LineBreakStyle,
} from '../types';

import { runAllCleanup } from '../shared/cleanup';
import {
  normalizeLineBreaks,
  normalizeWhitespacePreserveIndent,
} from '../shared/whitespace';
import {
  removeGutenbergFrontMatter,
  extractBackMatter,
} from '../shared/gutenberg';
import {
  detectChapterMarkers,
  filterOutTOCMarkers,
  splitIntoChapters,
  extractPreChapterText,
} from '../shared/chapter-detection';

// ============================================================================
// EPIC PREPROCESSING
// ============================================================================

/**
 * Preprocess epic/narrative poetry
 *
 * Epic poetry processing is similar to anthology:
 * - Preserves intentional line breaks (verse structure)
 * - Preserves indentation
 * - Preserves markers in content (e.g., "Book I")
 * - Uses BOOK/CANTO/PART markers as chapters
 */
export function preprocessEpic(
  rawText: string,
  forceStructureType?: ContentType
): PreprocessedText {
  const originalLength = rawText.length;

  // Step 0: Remove Gutenberg front matter markers
  const noGutenbergHeader = removeGutenbergFrontMatter(rawText);

  // Step 1: Run cleanup (remove line numbers, page markers, footnotes, asterisks)
  const { text: cleanedText, stats: cleanupStats } = runAllCleanup(noGutenbergHeader);

  // Step 2: Normalize whitespace PRESERVING INDENTATION (critical for poetry)
  const normalized = normalizeWhitespacePreserveIndent(cleanedText);

  // Step 3: Split into lines for analysis
  let lines = normalized.split('\n');

  // Step 4: Detect and remove back matter
  const { contentLines, backMatter, removed: backMatterRemoved } = extractBackMatter(lines);
  lines = contentLines;

  // Step 5: Structure type is epic
  const structureType: ContentType = forceStructureType || 'epic';

  // Step 6: Detect chapter markers (will find BOOK, CANTO, PART markers)
  const rawMarkers = detectChapterMarkers(lines, { structureType });
  const markers = filterOutTOCMarkers(rawMarkers, lines);

  // Step 7: Extract front matter
  const firstChapterLine = markers.length > 0 ? markers[0].lineIndex : lines.length;
  const frontMatter = extractPreChapterText(lines, firstChapterLine);

  // Step 8: Split into chapters, preserving markers (for epic display)
  let chapters = splitIntoChapters(lines, markers, { preserveMarkers: true });

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

  // Step 10: Normalize line breaks (PRESERVE INTENTIONAL breaks for poetry)
  const lineBreakStyle: LineBreakStyle = 'intentional';
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
