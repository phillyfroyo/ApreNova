// src/lib/text-processing/shared/chapter-detection.ts
// Chapter and section boundary detection utilities
// Handles various chapter markers, TOC filtering, and chapter splitting

import type { ChapterMarker, DetectedChapter, ContentType } from '../types';

// ============================================================================
// ROMAN NUMERAL MAPPING
// ============================================================================

const ROMAN_TO_ARABIC: Record<string, number> = {
  'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
  'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10,
  'XI': 11, 'XII': 12, 'XIII': 13, 'XIV': 14, 'XV': 15,
  'XVI': 16, 'XVII': 17, 'XVIII': 18, 'XIX': 19, 'XX': 20,
  'XXI': 21, 'XXII': 22, 'XXIII': 23, 'XXIV': 24, 'XXV': 25,
  'XXVI': 26, 'XXVII': 27, 'XXVIII': 28, 'XXIX': 29, 'XXX': 30,
  'XXXI': 31, 'XXXII': 32, 'XXXIII': 33, 'XXXIV': 34, 'XXXV': 35,
  'XXXVI': 36, 'XXXVII': 37, 'XXXVIII': 38, 'XXXIX': 39, 'XL': 40,
  'XLI': 41, 'XLII': 42, 'XLIII': 43, 'XLIV': 44, 'XLV': 45,
  'XLVI': 46, 'XLVII': 47, 'XLVIII': 48, 'XLIX': 49, 'L': 50,
  'LI': 51, 'LII': 52, 'LIII': 53, 'LIV': 54, 'LV': 55,
  'LVI': 56, 'LVII': 57, 'LVIII': 58, 'LIX': 59, 'LX': 60,
  'LXI': 61, 'LXII': 62, 'LXIII': 63, 'LXIV': 64, 'LXV': 65,
  'LXVI': 66, 'LXVII': 67, 'LXVIII': 68, 'LXIX': 69, 'LXX': 70,
  'LXXI': 71, 'LXXII': 72, 'LXXIII': 73, 'LXXIV': 74, 'LXXV': 75,
  'LXXVI': 76, 'LXXVII': 77, 'LXXVIII': 78, 'LXXIX': 79, 'LXXX': 80,
  'LXXXI': 81, 'LXXXII': 82, 'LXXXIII': 83, 'LXXXIV': 84, 'LXXXV': 85,
  'LXXXVI': 86, 'LXXXVII': 87, 'LXXXVIII': 88, 'LXXXIX': 89, 'XC': 90,
  'XCI': 91, 'XCII': 92, 'XCIII': 93, 'XCIV': 94, 'XCV': 95,
  'XCVI': 96, 'XCVII': 97, 'XCVIII': 98, 'XCIX': 99, 'C': 100,
};

const WORD_TO_NUMBER: Record<string, number> = {
  'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5,
  'SIX': 6, 'SEVEN': 7, 'EIGHT': 8, 'NINE': 9, 'TEN': 10,
};

// ============================================================================
// THEMATIC SECTION DETECTION (for anthologies)
// ============================================================================

/**
 * Detect thematic section markers for anthologies.
 * These are patterns like:
 * - "I. LIFE." or "II. LOVE AND SORROW." (Dickinson style)
 * - "BOOK I. INSCRIPTIONS" or "BOOK XVI. YOUTH, DAY, OLD AGE AND NIGHT" (Whitman style)
 * Used to group poems into themed collections rather than treating each poem as a chapter.
 */
export function detectThematicSectionMarkers(lines: string[]): ChapterMarker[] {
  // Pattern 1: Roman numeral + period + ALL CAPS title: "I. LIFE."
  const thematicPattern = /^([IVXLC]+)\.\s+([A-Z][A-Z\s,'".\-—–]+)\.?\s*$/;

  // Pattern 2: BOOK X. TITLE format (Whitman style): "BOOK I. INSCRIPTIONS"
  // Note: \s* instead of \s+ to handle typos like "BOOKXXXV" (no space)
  const bookThematicPattern = /^BOOK\s*([IVXLC]+)\.?\s*(?:\.?\s*(.+))?$/i;

  // Pattern 3: [COLLECTION] marker injected by HTML extractor (Blake style)
  // This handles cases where collection headers look identical to poem titles
  // but are identified by HTML structure (no poem content following the header)
  const collectionMarkerPattern = /^\[COLLECTION\]\s*(.+)$/i;

  const markers: ChapterMarker[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Try [COLLECTION] marker first (injected by HTML extractor)
    const collectionMatch = line.match(collectionMarkerPattern);
    if (collectionMatch) {
      const title = collectionMatch[1].trim();
      markers.push({
        lineIndex: i,
        type: 'thematic',
        number: markers.length + 1,
        title,
        fullMatch: line,
      });
      continue;
    }

    // Try Dickinson-style thematic pattern
    const thematicMatch = line.match(thematicPattern);
    if (thematicMatch) {
      const romanNumeral = thematicMatch[1];
      const sectionTitle = thematicMatch[2].trim();
      const num = ROMAN_TO_ARABIC[romanNumeral] || markers.length + 1;

      // Verify this looks like a thematic section (not just "I. SUCCESS.")
      // Thematic sections are typically short (1-4 words) and general concepts
      const wordCount = sectionTitle.split(/\s+/).length;
      if (wordCount <= 4 && sectionTitle.length <= 30) {
        markers.push({
          lineIndex: i,
          type: 'thematic',
          number: num,
          title: sectionTitle,
          fullMatch: line,
        });
      }
      continue;
    }

    // Try Whitman-style BOOK thematic pattern
    const bookMatch = line.match(bookThematicPattern);
    if (bookMatch) {
      const romanNumeral = bookMatch[1];
      const num = ROMAN_TO_ARABIC[romanNumeral] || markers.length + 1;
      const title = bookMatch[2]?.trim() || `Book ${romanNumeral}`;

      markers.push({
        lineIndex: i,
        type: 'thematic',
        number: num,
        title: `BOOK ${romanNumeral}${title ? ': ' + title : ''}`,
        fullMatch: line,
      });
    }
  }

  return markers;
}

// ============================================================================
// CHAPTER MARKER DETECTION
// ============================================================================

export interface DetectChapterOptions {
  /**
   * When "anthology", prioritize thematic section headers (e.g., "I. LIFE.")
   * over individual poem markers (e.g., "I.", "II.").
   */
  structureType?: ContentType;
}

/**
 * Detect chapter boundaries in text
 * Returns array of chapter markers with their line positions
 */
export function detectChapterMarkers(lines: string[], options: DetectChapterOptions = {}): ChapterMarker[] {
  const { structureType } = options;

  // For anthologies, prioritize thematic section markers (e.g., "I. LIFE.")
  // This groups poems by theme instead of treating each poem as a separate chapter
  if (structureType === "anthology") {
    const thematicMarkers = detectThematicSectionMarkers(lines);
    // When structureType is explicitly anthology, use thematic markers even if there's only 1
    // (user explicitly selected poetry type, so we trust their judgment)
    if (thematicMarkers.length >= 1) {
      return thematicMarkers;
    }
    // No thematic sections found - for anthologies, return empty to treat as single collection
    // Don't fall through to standard detection which would incorrectly detect
    // standalone Roman numerals (I, II) within poems as chapter markers
    console.log('[detectChapterMarkers] Anthology with no thematic sections - treating as single collection');
    return [];
  }

  // First pass: look for EXPLICIT chapter markers only
  // These are definitive: "CHAPTER X", Roman numerals alone, "BOOK/PART X"
  const explicitMarkers: ChapterMarker[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const nextLine = lines[i + 1]?.trim() || '';

    // Skip empty lines
    if (!line) continue;

    // Pattern 1: "CHAPTER X" or "Chapter 1" (explicit chapter marker)
    const chapterMatch = line.match(/^CHAPTER\s+(\d+|[IVXLC]+)\.?\s*(?:[:\-—–]\s*)?(.*)$/i);
    if (chapterMatch) {
      const numStr = chapterMatch[1].toUpperCase();
      const num = ROMAN_TO_ARABIC[numStr] || parseInt(numStr) || explicitMarkers.length + 1;
      explicitMarkers.push({
        lineIndex: i,
        type: ROMAN_TO_ARABIC[numStr] ? 'roman' : 'arabic',
        number: num,
        title: chapterMatch[2]?.trim() || `Chapter ${num}`,
        subtitle: nextLine && !nextLine.match(/^(CHAPTER|BOOK|PART|\d|[IVXLC]+\.?\s*$)/i) ? nextLine : undefined,
        fullMatch: line,
      });
      continue;
    }

    // Pattern 2: Roman numeral alone on line (I., II., XLIII., etc.)
    const romanMatch = line.match(/^([IVXLC]+)\.?$/);
    if (romanMatch && ROMAN_TO_ARABIC[romanMatch[1]]) {
      const num = ROMAN_TO_ARABIC[romanMatch[1]];
      // Check if next line looks like a title (not another marker)
      const hasTitle = nextLine &&
        nextLine.length < 100 &&
        nextLine.length > 3 &&
        /^[A-Z]/.test(nextLine) &&
        !nextLine.match(/^(CHAPTER|BOOK|PART|\d+\s*$|[IVXLC]+\.?\s*$)/i);

      explicitMarkers.push({
        lineIndex: i,
        type: 'roman',
        number: num,
        title: hasTitle ? nextLine : `Section ${num}`,
        fullMatch: line,
      });
      continue;
    }

    // Pattern 3: "BOOK ONE", "PART I", "CANTO III", etc. (structural markers)
    // Also handles "BOOK I. INSCRIPTIONS" format (period + space + title)
    // Note: \s* to handle typos like "BOOKXXXV" (no space between BOOK and numeral)
    const bookMatch = line.match(/^(BOOK|PART|CANTO|ACT|SCENE)\s*(\d+|[IVXLC]+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)\.?(?:\s*[:\-—–.\s]\s*(.+))?$/i);
    if (bookMatch) {
      const numStr = bookMatch[2].toUpperCase();
      const num = WORD_TO_NUMBER[numStr] || ROMAN_TO_ARABIC[numStr] || parseInt(numStr) || explicitMarkers.length + 1;
      // Clean up title - if it starts with a period (from "BOOK I. TITLE"), strip it
      let title = bookMatch[3]?.trim() || '';
      if (title.startsWith('.')) title = title.slice(1).trim();
      explicitMarkers.push({
        lineIndex: i,
        type: 'word',
        number: num,
        title: title ? `${bookMatch[1]} ${bookMatch[2]}: ${title}` : `${bookMatch[1]} ${bookMatch[2]}`,
        fullMatch: line,
      });
      continue;
    }
  }

  // If we found explicit markers, use those and ignore fallback patterns
  if (explicitMarkers.length > 0) {
    return explicitMarkers;
  }

  // Fallback: If NO explicit markers found, try ALL CAPS section headers
  const fallbackMarkers: ChapterMarker[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const nextLine = lines[i + 1]?.trim() || '';

    if (!line) continue;

    // ALL CAPS title line that looks like a section header
    if (line.length < 80 && line.length > 5 && line === line.toUpperCase() && /^[A-Z]/.test(line) && !/^\d/.test(line)) {
      const wordCount = line.split(/\s+/).length;
      // Must have 2-10 words, followed by regular text
      if (wordCount >= 2 && wordCount <= 10) {
        if (nextLine && nextLine !== nextLine.toUpperCase() && nextLine.length > 20) {
          fallbackMarkers.push({
            lineIndex: i,
            type: 'word',
            number: fallbackMarkers.length + 1,
            title: line.split(/\s+/).map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' '),
            fullMatch: line,
          });
        }
      }
    }
  }

  return fallbackMarkers;
}

// ============================================================================
// TOC MARKER FILTERING
// ============================================================================

/**
 * Filter out Table of Contents markers
 *
 * Improved strategy: Instead of relying on line gaps alone (which can be unreliable),
 * we check if there's SUBSTANTIAL CONTENT between markers.
 *
 * TOC entries have minimal content between them (0-50 chars of text).
 * Real chapter markers have substantial content (1000+ chars) between them.
 *
 * IMPORTANT: For anthologies with BOOK markers (like Whitman), the TOC
 * appears as a separate section at the beginning. We detect a TOC cluster
 * by looking for markers with minimal content between them, followed by
 * a REPEATED marker (same BOOK number) with substantial content.
 */
export function filterOutTOCMarkers(markers: ChapterMarker[], lines: string[]): ChapterMarker[] {
  if (markers.length < 3) return markers;

  // Calculate content between each marker and the next
  const contentBetween: number[] = [];
  for (let i = 0; i < markers.length - 1; i++) {
    const startLine = markers[i].lineIndex + 1;
    const endLine = markers[i + 1].lineIndex;
    let charCount = 0;
    for (let j = startLine; j < endLine && j < lines.length; j++) {
      charCount += lines[j].trim().length;
    }
    contentBetween.push(charCount);
  }
  // Last marker - count to end of file (or next 500 lines)
  const lastMarkerLine = markers[markers.length - 1].lineIndex;
  let lastContent = 0;
  for (let j = lastMarkerLine + 1; j < Math.min(lastMarkerLine + 500, lines.length); j++) {
    lastContent += lines[j].trim().length;
  }
  contentBetween.push(lastContent);

  // Threshold: TOC entries have < 100 chars between them
  // Real chapters have 500+ chars between them
  const TOC_CONTENT_THRESHOLD = 100;
  const CHAPTER_CONTENT_THRESHOLD = 500;

  // Strategy 1: Look for a repeated marker number
  // If we see BOOK I in the TOC and BOOK I again in the content,
  // the second occurrence is the real one.
  // BUT: If markers before the duplicate all have substantial content,
  // they're not TOC entries - they're legitimately repeated section names
  // (e.g., Dickinson has "I. LIFE." three times, each with different poems)
  const markerNumbers = markers.map(m => m.number);
  const firstDuplicate = markerNumbers.findIndex((num, idx) =>
    markerNumbers.indexOf(num) !== idx
  );

  if (firstDuplicate > 0) {
    // Check if markers BEFORE the duplicate have substantial content
    // If so, they're real chapters, not TOC entries
    const markersBeforeDuplicate = contentBetween.slice(0, firstDuplicate);
    const allHaveSubstantialContent = markersBeforeDuplicate.every(
      content => content >= CHAPTER_CONTENT_THRESHOLD
    );

    if (allHaveSubstantialContent) {
      // These are real chapters with repeated names (like Dickinson's 3 books)
      // Don't filter anything
      console.log(`[filterOutTOCMarkers] Duplicate markers found but all have substantial content - keeping all ${markers.length} markers`);
      return markers;
    }

    // We have duplicates with minimal content before them - likely a TOC
    // Find where the duplicate chapter numbers start
    const firstNum = markers[firstDuplicate].number;
    const firstRealIndex = markers.findIndex((m, idx) =>
      idx >= firstDuplicate && m.number === markerNumbers[0] && contentBetween[idx] >= CHAPTER_CONTENT_THRESHOLD
    );

    if (firstRealIndex >= 0) {
      console.log(`[filterOutTOCMarkers] Found duplicate markers, filtering TOC (first ${firstRealIndex} markers)`);
      return markers.slice(firstRealIndex);
    }
  }

  // Strategy 2: Look for the transition from minimal to substantial content
  let firstRealChapterIndex = -1;
  let tocClusterStarted = false;

  for (let i = 0; i < markers.length; i++) {
    const contentAfter = contentBetween[i];

    if (contentAfter < TOC_CONTENT_THRESHOLD) {
      // This looks like a TOC entry (minimal content after it)
      if (!tocClusterStarted) {
        tocClusterStarted = true;
      }
    } else if (contentAfter >= CHAPTER_CONTENT_THRESHOLD && tocClusterStarted) {
      // Substantial content after this marker, and we've seen TOC entries before
      firstRealChapterIndex = i;
      break;
    } else {
      // Medium content - could be either. If we haven't started a TOC cluster,
      // this might just be a book without a TOC.
      if (!tocClusterStarted) {
        return markers;
      }
    }
  }

  // Strategy 3: Check for a big line gap pattern
  if (firstRealChapterIndex === -1) {
    for (let i = 1; i < markers.length; i++) {
      const lineGap = markers[i].lineIndex - markers[i - 1].lineIndex;
      const contentAfter = contentBetween[i];

      // If there's a big line gap AND substantial content after this marker
      if (lineGap > 50 && contentAfter >= CHAPTER_CONTENT_THRESHOLD) {
        firstRealChapterIndex = i;
        break;
      }
    }
  }

  // If still no clear break found, assume no TOC
  if (firstRealChapterIndex === -1) {
    return markers;
  }

  // Filter out TOC markers (indices 0 through firstRealChapterIndex - 1)
  const filtered = markers.slice(firstRealChapterIndex);

  // Safety check: if we filtered everything, that's wrong
  if (filtered.length === 0) {
    console.warn(`[filterOutTOCMarkers] WARNING: All markers filtered as TOC, keeping all markers`);
    return markers;
  }

  console.log(`[filterOutTOCMarkers] Filtered ${firstRealChapterIndex} TOC markers, keeping ${filtered.length} chapters`);
  return filtered;
}

// ============================================================================
// CHAPTER SPLITTING
// ============================================================================

export interface SplitChaptersOptions {
  /**
   * When true, include the chapter marker line (e.g., "I. LIFE.") in the chapter content.
   * Useful for anthologies where the thematic section header should be visible to readers.
   * Default: false (existing behavior - exclude markers)
   */
  preserveMarkers?: boolean;
}

/**
 * Split text into chapters based on detected markers
 */
export function splitIntoChapters(
  lines: string[],
  markers: ChapterMarker[],
  options: SplitChaptersOptions = {}
): DetectedChapter[] {
  const { preserveMarkers = false } = options;

  if (markers.length === 0) {
    // No chapters detected - treat entire text as one chapter
    return [{
      number: 1,
      title: 'Full Text',
      rawText: lines.join('\n'),
      startLine: 0,
      endLine: lines.length - 1,
    }];
  }

  const chapters: DetectedChapter[] = [];

  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];
    const nextMarker = markers[i + 1];

    const startLine = marker.lineIndex;
    const endLine = nextMarker ? nextMarker.lineIndex - 1 : lines.length - 1;

    // Get chapter content
    // When preserveMarkers is true, include the marker line in content (for anthologies)
    // When false (default), exclude the marker line for cleaner text
    const contentStartLine = preserveMarkers ? startLine : startLine + 1;
    const chapterLines = lines.slice(contentStartLine, endLine + 1);

    // Skip subtitle line if present (and we're not preserving markers)
    const skipLines = (!preserveMarkers && marker.subtitle) ? 1 : 0;
    const contentLines = chapterLines.slice(skipLines);

    const rawText = contentLines.join('\n').trim();

    chapters.push({
      number: marker.number,
      title: marker.title,
      subtitle: marker.subtitle,
      rawText,
      startLine,
      endLine,
    });
  }

  return chapters;
}

// ============================================================================
// PRE-CHAPTER TEXT EXTRACTION
// ============================================================================

/**
 * Extract text that appears before the first chapter marker.
 * This is different from Gutenberg front matter - this extracts any content
 * (like dedications, epigraphs, etc.) that appears between where Gutenberg
 * boilerplate ends and where the first chapter begins.
 */
export function extractPreChapterText(lines: string[], firstChapterLine: number): string {
  if (firstChapterLine <= 0) return '';

  const preChapterLines = lines.slice(0, firstChapterLine);
  return preChapterLines.join('\n').trim();
}
