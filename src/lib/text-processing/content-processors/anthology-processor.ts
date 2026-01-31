// src/lib/text-processing/content-processors/anthology-processor.ts
// The Emily Dickinson Algorithm - Poetry anthology processing
//
// This processor handles poetry collections with:
// - Thematic sections (I. LIFE., II. LOVE AND SORROW.)
// - Individual poems within sections
// - Stanza detection within poems
// - Editorial notes preservation

import type {
  ContentType,
  PreprocessedText,
  DetectedChapter,
  LineBreakStyle,
  StructureAnalysis,
  EditorialNote,
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
  extractFrontMatter,
} from '../shared/chapter-detection';

// ============================================================================
// STRUCTURE ANALYSIS (The Emily Dickinson Algorithm - Part 1)
// ============================================================================

/**
 * Analyze text structure to determine if it's an anthology or narrative poetry.
 *
 * Algorithm:
 * 1. Detect thematic section headers (I. LIFE., II. LOVE., etc.)
 * 2. Detect individual poem titles (ALL CAPS, short, standalone)
 * 3. Count distinct "poems" based on markers and blank line patterns
 * 4. Calculate average poem length
 *
 * Decision logic:
 * - Anthology: thematic sections (>=2) AND many short poems (>=10, avg <50 lines)
 * - Epic: numbered sections but continuous narrative (avg >30 lines per section)
 * - Script: detected by dialog patterns (handled elsewhere)
 * - Prose: default for no poetry markers
 */
export function analyzeContentStructure(text: string): StructureAnalysis {
  const lines = text.split('\n');

  // Pattern for thematic section headers: "I. LIFE." or "II. LOVE AND SORROW"
  const thematicSectionPattern = /^([IVXLC]+)\.\s+([A-Z][A-Z\s,'".-]+)\.?\s*$/;

  // Pattern for poem titles (ALL CAPS, short, standalone)
  const poemTitlePattern = /^[A-Z][A-Z\s,.'"-]{2,50}\.?\s*$/;

  // Detected markers
  const thematicSections: string[] = [];
  const poemBoundaries: number[] = [];
  let editorialNoteCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) continue;

    // Check for thematic section headers
    const thematicMatch = line.match(thematicSectionPattern);
    if (thematicMatch) {
      thematicSections.push(line);
      poemBoundaries.push(i);
      continue;
    }

    // Check for poem titles (ALL CAPS, standalone, not too long)
    if (poemTitlePattern.test(line) && line.length < 60) {
      // Verify next line is not another title (to avoid false positives)
      const nextLine = lines[i + 1]?.trim() || '';
      if (!poemTitlePattern.test(nextLine) && nextLine !== '') {
        poemBoundaries.push(i);
      }
      continue;
    }

    // Check for editorial notes
    if (/^\s*\[.{10,}\]\s*$/.test(line)) {
      editorialNoteCount++;
    }
  }

  // Calculate average content length between poem boundaries
  const poemLengths: number[] = [];
  for (let i = 0; i < poemBoundaries.length; i++) {
    const start = poemBoundaries[i];
    const end = poemBoundaries[i + 1] ?? lines.length;
    const contentLines = lines.slice(start, end).filter(l => l.trim().length > 0);
    poemLengths.push(contentLines.length);
  }

  const avgPoemLength = poemLengths.length > 0
    ? poemLengths.reduce((a, b) => a + b, 0) / poemLengths.length
    : 0;

  const poemCount = poemBoundaries.length;
  const hasThematicSections = thematicSections.length >= 2;
  const isManyShortPoems = poemCount >= 10 && avgPoemLength < 50;
  const isFewerLongerSections = poemCount > 0 && poemCount < 20 && avgPoemLength > 30;

  // Decision logic
  if (hasThematicSections && isManyShortPoems) {
    return {
      structureType: 'anthology',
      confidence: 0.9,
      thematicSections,
      poemCount,
      avgPoemLength,
      hasEditorialNotes: editorialNoteCount > 2,
    };
  }

  if (hasThematicSections || (poemCount >= 5 && isManyShortPoems)) {
    return {
      structureType: 'anthology',
      confidence: 0.7,
      thematicSections,
      poemCount,
      avgPoemLength,
      hasEditorialNotes: editorialNoteCount > 2,
    };
  }

  if (isFewerLongerSections && poemCount > 0) {
    return {
      structureType: 'epic',
      confidence: 0.7,
      thematicSections,
      poemCount,
      avgPoemLength,
      hasEditorialNotes: editorialNoteCount > 0,
    };
  }

  // Default to prose
  return {
    structureType: 'prose',
    confidence: 0.5,
    thematicSections: [],
    poemCount: 0,
    avgPoemLength: 0,
    hasEditorialNotes: editorialNoteCount > 0,
  };
}

// ============================================================================
// EDITORIAL NOTE DETECTION
// ============================================================================

/**
 * Detect editorial notes in text.
 *
 * Editorial notes are typically:
 * - Bracketed: [Published in "A Masque of Poets," 1878.]
 * - Contains publication/biographical information
 *
 * These should be preserved but not rewritten, and rendered in italics.
 */
export function detectEditorialNotes(lines: string[]): EditorialNote[] {
  const notes: EditorialNote[] = [];

  const patterns = [
    // [Published in "Magazine Name", year]
    { regex: /^\s*\[.*(Published|First appeared|First printed|Written|Composed).+\]\s*$/i, type: 'publication' as const },
    // [Born 1830, died 1886] or similar biographical
    { regex: /^\s*\[.*(Born|Died|lived|b\.\s*\d|d\.\s*\d).+\]\s*$/i, type: 'biographical' as const },
    // [This poem refers to...] or [The following...]
    { regex: /^\s*\[.*(poem|refers|alludes|written for|dedicated|The following).+\]\s*$/i, type: 'annotation' as const },
    // Generic bracketed text with 20+ chars that looks like a note
    { regex: /^\s*\[.{20,}\]\s*$/, type: 'annotation' as const },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const pattern of patterns) {
      if (pattern.regex.test(line)) {
        // Extract the text without brackets
        const text = line.trim().replace(/^\[|\]$/g, '').trim();
        notes.push({
          lineIndex: i,
          text,
          type: pattern.type,
        });
        break; // Only match first pattern
      }
    }
  }

  return notes;
}

// ============================================================================
// ANTHOLOGY PREPROCESSING (The Emily Dickinson Algorithm - Full Pipeline)
// ============================================================================

/**
 * Preprocess anthology/poetry text
 *
 * The Emily Dickinson Algorithm:
 * 1. Structure Detection - analyzeContentStructure() detects thematic sections
 * 2. Chapter Detection - detectChapterMarkers() with anthology-aware mode finds "I. LIFE.", "II. LOVE."
 * 3. Whitespace Preservation - normalizeLineBreaks("intentional") preserves indentation and blank lines
 * 4. The stanza detection happens downstream in poem-processing module
 */
export function preprocessAnthology(
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

  // Step 5: Determine structure type
  const structureType: ContentType = forceStructureType || 'anthology';

  // Step 6: Detect chapter markers with anthology-aware mode
  // This finds "I. LIFE.", "II. LOVE." thematic sections as chapters
  const rawMarkers = detectChapterMarkers(lines, { structureType });
  const markers = filterOutTOCMarkers(rawMarkers, lines);

  // Step 7: Extract front matter
  const firstChapterLine = markers.length > 0 ? markers[0].lineIndex : lines.length;
  const frontMatter = extractFrontMatter(lines, firstChapterLine);

  // Step 8: Split into chapters, PRESERVING markers in content (for anthology display)
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

  // Step 10: Normalize line breaks for each chapter (PRESERVE INTENTIONAL breaks for poetry)
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
