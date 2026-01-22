// src/lib/admin/text-preprocessor.ts
// Algorithmic text preprocessing - no AI needed

// ============================================
// LINE BREAK NORMALIZATION
// ============================================

export type LineBreakStyle = "prose-wrapped" | "intentional";

/**
 * Detect if text has prose-style text wrapping (e.g., Gutenberg ~70 char lines)
 * or intentional line breaks (e.g., poetry, formatted text)
 *
 * Heuristics:
 * - High ratio of lines ending mid-sentence + consistent line lengths = text wrapping
 * - Variable line lengths + lines ending with punctuation = intentional breaks
 */
export function detectLineBreakStyle(text: string): LineBreakStyle {
  const lines = text.split('\n').filter(l => l.trim().length > 0);

  // Too few lines to reliably detect
  if (lines.length < 5) return "intentional";

  // Count lines that end mid-sentence (no terminal punctuation, next line starts lowercase)
  let midSentenceCount = 0;
  let totalCheckable = 0;

  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    const nextLine = lines[i + 1]?.trim() || '';

    // Skip very short lines (likely intentional formatting)
    if (line.length < 20) continue;

    totalCheckable++;

    // Check if line ends with terminal punctuation
    const endsWithPunctuation = /[.!?;:"'»)\]]$/.test(line);

    // Check if next line starts with lowercase (sentence continuation)
    const nextStartsLower = /^[a-z]/.test(nextLine);

    // Check if next line starts with common sentence-continuation words
    const nextIsContinuation = /^(and|or|but|that|which|who|whom|whose|where|when|while|because|although|if|the|a|an|to|in|on|at|for|with|by|from|as|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|must|shall|can)\s/i.test(nextLine);

    if (!endsWithPunctuation && (nextStartsLower || nextIsContinuation)) {
      midSentenceCount++;
    }
  }

  // Calculate metrics
  const midSentenceRatio = totalCheckable > 0 ? midSentenceCount / totalCheckable : 0;
  const avgLength = lines.reduce((sum, l) => sum + l.length, 0) / lines.length;

  // Calculate line length variance (coefficient of variation)
  const variance = lines.reduce((sum, l) => sum + Math.pow(l.length - avgLength, 2), 0) / lines.length;
  const stdDev = Math.sqrt(variance);
  const coeffOfVariation = avgLength > 0 ? stdDev / avgLength : 0;

  // Decision logic:
  // - High mid-sentence ratio (>25%) suggests text wrapping
  // - Consistent line lengths (low variance) suggests text wrapping
  // - Longer average lines (>50 chars) suggests prose
  //
  // Text wrapping: midSentenceRatio > 0.25 AND avgLength > 50 AND coeffOfVariation < 0.5
  if (midSentenceRatio > 0.25 && avgLength > 50 && coeffOfVariation < 0.5) {
    return "prose-wrapped";
  }

  return "intentional";
}

/**
 * Normalize text by joining text-wrapped lines into paragraphs.
 *
 * For prose-wrapped text (e.g., Gutenberg):
 * - Join lines within paragraphs (single newlines become spaces)
 * - Preserve paragraph breaks (double newlines)
 * - Result: one "line" per paragraph
 *
 * For intentional breaks (e.g., poetry):
 * - Keep all line breaks as-is
 */
export function normalizeLineBreaks(text: string, forceStyle?: LineBreakStyle): string {
  const style = forceStyle || detectLineBreakStyle(text);

  if (style === "intentional") {
    // Keep line breaks as-is, just clean up extra whitespace
    return text
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n'); // Collapse multiple blank lines to max 2
  }

  // Prose-wrapped: join lines within paragraphs
  // Split by blank lines (paragraph boundaries)
  const paragraphs = text.split(/\n\s*\n/);

  const normalized = paragraphs.map(para => {
    // Join lines within paragraph with spaces
    return para
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join(' ')
      // Clean up any double spaces that might result
      .replace(/\s+/g, ' ')
      .trim();
  }).filter(para => para.length > 0);

  // Join paragraphs with double newlines
  return normalized.join('\n\n');
}

/**
 * Get a human-readable description of the detected line break style
 */
export function getLineBreakStyleDescription(style: LineBreakStyle): string {
  if (style === "prose-wrapped") {
    return "Text-wrapped prose detected. Lines will be joined into paragraphs.";
  }
  return "Intentional line breaks detected. Original formatting will be preserved.";
}

// ============================================
// CHAPTER DETECTION TYPES
// ============================================

export interface DetectedChapter {
  number: number;
  title: string;
  subtitle?: string;
  rawText: string;
  startLine: number;
  endLine: number;
}

export interface PreprocessedText {
  // The front matter (before first chapter) - for metadata extraction
  frontMatter: string;

  // The back matter (after story ends) - license, legal text, etc.
  backMatter: string;

  // Detected chapters
  chapters: DetectedChapter[];

  // Statistics
  stats: {
    originalLength: number;
    cleanedLength: number;
    lineNumbersRemoved: number;
    pageMarkersRemoved: number;
    footnoteIndicatorsRemoved: number;
    asteriskDividersRemoved: number;
    chaptersDetected: number;
    backMatterRemoved: boolean;
    lineBreakStyle: LineBreakStyle;
  };

  // The full cleaned text (all chapters joined)
  cleanedFullText: string;
}

/**
 * Remove line numbers from text
 * Handles various formats:
 * - "5 " at start of line
 * - " 10" at end of line
 * - "15" standalone
 * - "[5]" bracketed numbers
 */
function removeLineNumbers(text: string): { text: string; count: number } {
  let count = 0;

  const lines = text.split('\n');
  const cleanedLines = lines.map(line => {
    const original = line;

    // Remove line numbers at start of line (e.g., "5 ", "10  ", "125 ")
    // But be careful not to remove years or other meaningful numbers
    line = line.replace(/^(\s*)\d{1,4}(\s{2,}|\t)/, (match) => {
      count++;
      return '';
    });

    // Remove standalone line numbers (just a number on its own line)
    if (/^\s*\d{1,4}\s*$/.test(line)) {
      count++;
      return '';
    }

    // Remove line numbers at end of line after significant whitespace
    line = line.replace(/(\s{2,}|\t)\d{1,4}\s*$/, (match) => {
      count++;
      return '';
    });

    return line;
  });

  return {
    text: cleanedLines.join('\n'),
    count
  };
}

/**
 * Remove footnote indicators from text
 * Footnotes are 1-3 digit numbers attached to text without spaces.
 * They can appear after words/punctuation or at the start of lines.
 */
function removeFootnoteIndicators(text: string): { text: string; count: number } {
  let count = 0;

  // Pattern 1: Number attached AFTER letter or punctuation
  // Preceding: letters, or common punctuation (. , ; : ! ? ' " ) ] — – -)
  // Following: whitespace, end of line, or any punctuation including brackets
  // Examples: "night-time5 " "of.4" "wax7)" "treasure,6."
  text = text.replace(/([a-zA-Z.,;:!?'")\]—–-])(\d{1,3})(?=\s|$|[.,;:!?'"()\[\]—–-])/g, (match, before) => {
    count++;
    return before;
  });

  // Pattern 2: Number at START of line followed by letter or bracket
  // Examples: "6Leaders..." "6(He is..." "5[The king..."
  text = text.replace(/^(\d{1,3})(?=[a-zA-Z(\[])/gm, () => {
    count++;
    return '';
  });

  // Pattern 3: Number between closing and opening brackets
  // Examples: ")6(" → ")(", "]5[" → "]["
  text = text.replace(/([\)\]])(\d{1,3})([\(\[])/g, (match, close, num, open) => {
    count++;
    return close + open;
  });

  // Pattern 4: Bracketed footnote references inline: [5] [12]
  // These appear mid-sentence like "the king[5] said"
  text = text.replace(/(\S)\[(\d{1,3})\](?=\s|[.,;:!?]|$)/g, (match, before) => {
    count++;
    return before;
  });

  // Pattern 5: Superscript Unicode indicators
  text = text.replace(/([a-zA-Z])([¹²³⁴⁵⁶⁷⁸⁹⁰]+)/g, (match, letter) => {
    count++;
    return letter;
  });

  return { text, count };
}

/**
 * Remove decorative asterisk dividers from text
 * Handles patterns like: "* * *", "*   *   *", isolated asterisk lines
 */
function removeAsteriskDividers(text: string): { text: string; count: number } {
  let count = 0;

  const lines = text.split('\n');
  const cleanedLines = lines.filter(line => {
    const trimmed = line.trim();

    // Remove lines that are ONLY asterisks and whitespace
    // Matches: "*", "* *", "*   *   *", "* * * * *", etc.
    if (/^[\s*]+$/.test(trimmed) && trimmed.includes('*')) {
      count++;
      return false;
    }

    // Remove lines that are mostly asterisks with possible decorative chars
    // Matches: "* * * * * * * *", "  *     *     *  ", etc.
    if (/^\s*(\*\s*){2,}\s*$/.test(trimmed)) {
      count++;
      return false;
    }

    return true;
  });

  return {
    text: cleanedLines.join('\n'),
    count
  };
}

/**
 * Remove page markers from text
 * Handles: [Page 5], - 12 -, Page 5, [5], {5}, etc.
 */
function removePageMarkers(text: string): { text: string; count: number } {
  let count = 0;

  // [Page X] or [page X]
  text = text.replace(/\[page\s*\d+\]/gi, () => { count++; return ''; });

  // - X - or -- X -- (page numbers between dashes)
  text = text.replace(/^[\s]*[-—–]+\s*\d+\s*[-—–]+[\s]*$/gm, () => { count++; return ''; });

  // {X} standalone on line
  text = text.replace(/^\s*\{\d+\}\s*$/gm, () => { count++; return ''; });

  // [X] standalone on line (but not footnote references in context)
  text = text.replace(/^\s*\[\d+\]\s*$/gm, () => { count++; return ''; });

  // "Page X" or "PAGE X" standalone
  text = text.replace(/^\s*page\s+\d+\s*$/gim, () => { count++; return ''; });

  return { text, count };
}

/**
 * Normalize whitespace while preserving paragraph structure
 */
function normalizeWhitespace(text: string): string {
  return text
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove trailing whitespace from lines
    .replace(/[ \t]+$/gm, '')
    // Remove leading whitespace from lines (but preserve indentation structure)
    .replace(/^[ \t]+/gm, (match) => match.length > 4 ? '    ' : '')
    // Collapse multiple blank lines to max 2
    .replace(/\n{4,}/g, '\n\n\n')
    // Remove spaces before punctuation
    .replace(/\s+([.,;:!?])/g, '$1')
    // Ensure space after punctuation
    .replace(/([.,;:!?])([A-Za-z])/g, '$1 $2')
    .trim();
}

/**
 * Detect chapter boundaries in text
 * Returns array of chapter markers with their line positions
 */
interface ChapterMarker {
  lineIndex: number;
  type: 'roman' | 'arabic' | 'word';
  number: number;
  title: string;
  subtitle?: string;
  fullMatch: string;
}

function detectChapterMarkers(lines: string[]): ChapterMarker[] {
  // Roman numeral mapping (extended for longer works - up to 100)
  const romanToArabic: Record<string, number> = {
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

  // First pass: look for EXPLICIT chapter markers only
  // These are definitive: "CHAPTER X", Roman numerals alone, "BOOK/PART X"
  const explicitMarkers: ChapterMarker[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const nextLine = lines[i + 1]?.trim() || '';

    // Skip empty lines
    if (!line) continue;

    // Pattern 1: "CHAPTER X" or "Chapter 1" (explicit chapter marker)
    // Handles various formats:
    // - "CHAPTER I" (no title)
    // - "CHAPTER I." (no title, with period)
    // - "CHAPTER I: Title" (colon separator)
    // - "CHAPTER I - Title" (dash separator)
    // - "CHAPTER I. Title" (period + space + title - Gutenberg format)
    // - "CHAPTER I Title" (just space before title)
    const chapterMatch = line.match(/^CHAPTER\s+(\d+|[IVXLC]+)\.?\s*(?:[:\-—–]\s*)?(.*)$/i);
    if (chapterMatch) {
      const numStr = chapterMatch[1].toUpperCase();
      const num = romanToArabic[numStr] || parseInt(numStr) || explicitMarkers.length + 1;
      explicitMarkers.push({
        lineIndex: i,
        type: romanToArabic[numStr] ? 'roman' : 'arabic',
        number: num,
        title: chapterMatch[2]?.trim() || `Chapter ${num}`,
        subtitle: nextLine && !nextLine.match(/^(CHAPTER|BOOK|PART|\d|[IVXLC]+\.?\s*$)/i) ? nextLine : undefined,
        fullMatch: line,
      });
      continue;
    }

    // Pattern 2: Roman numeral alone on line (I., II., XLIII., etc.)
    // Must be on its own line, optionally with a period
    const romanMatch = line.match(/^([IVXLC]+)\.?$/);
    if (romanMatch && romanToArabic[romanMatch[1]]) {
      const num = romanToArabic[romanMatch[1]];
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
    const bookMatch = line.match(/^(BOOK|PART|CANTO|ACT|SCENE)\s+(\d+|[IVXLC]+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)\.?(?:\s*[:\-—–]\s*(.+))?$/i);
    if (bookMatch) {
      const wordToNum: Record<string, number> = {
        'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5,
        'SIX': 6, 'SEVEN': 7, 'EIGHT': 8, 'NINE': 9, 'TEN': 10,
      };
      const numStr = bookMatch[2].toUpperCase();
      const num = wordToNum[numStr] || romanToArabic[numStr] || parseInt(numStr) || explicitMarkers.length + 1;
      explicitMarkers.push({
        lineIndex: i,
        type: 'word',
        number: num,
        title: `${bookMatch[1]} ${bookMatch[2]}${bookMatch[3] ? ': ' + bookMatch[3] : ''}`,
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
  // This is for texts that use titles instead of chapter numbers
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

  // NOTE: We intentionally do NOT detect divider lines (---, ***, ===) as chapter markers.
  // These are decorative breaks within chapters, not chapter boundaries.

  return fallbackMarkers;
}

/**
 * Filter out Table of Contents markers
 *
 * Improved strategy: Instead of relying on line gaps alone (which can be unreliable),
 * we check if there's SUBSTANTIAL CONTENT between markers.
 *
 * TOC entries have minimal content between them (0-50 chars of text).
 * Real chapter markers have substantial content (1000+ chars) between them.
 *
 * Algorithm:
 * 1. Find the first "cluster" where consecutive markers have minimal content between them
 * 2. The first marker AFTER this cluster (with substantial content following it) is the first real chapter
 */
function filterOutTOCMarkers(markers: ChapterMarker[], lines: string[]): ChapterMarker[] {
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
  // Real chapters have 1000+ chars between them
  const TOC_CONTENT_THRESHOLD = 100;
  const CHAPTER_CONTENT_THRESHOLD = 500;

  // Find the first marker with substantial content after it
  // This is likely the first real chapter (not a TOC entry)
  let firstRealChapterIndex = -1;
  let inTocCluster = false;
  let tocClusterStarted = false;

  for (let i = 0; i < markers.length; i++) {
    const contentAfter = contentBetween[i];

    if (contentAfter < TOC_CONTENT_THRESHOLD) {
      // This looks like a TOC entry (minimal content after it)
      if (!tocClusterStarted) {
        tocClusterStarted = true;
      }
      inTocCluster = true;
    } else if (contentAfter >= CHAPTER_CONTENT_THRESHOLD && tocClusterStarted) {
      // Substantial content after this marker, and we've seen TOC entries before
      // This is the first real chapter
      firstRealChapterIndex = i;
      break;
    } else {
      // Medium content - could be either. If we haven't started a TOC cluster,
      // this might just be a book without a TOC.
      if (!tocClusterStarted) {
        // No TOC detected - return all markers
        return markers;
      }
    }
  }

  // If no clear transition found, check if we have a classic TOC pattern:
  // First N markers clustered together, then a gap
  if (firstRealChapterIndex === -1) {
    // Look for where the line gaps get large
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
    console.warn(`[preprocessText] WARNING: All markers filtered as TOC, keeping all markers`);
    return markers;
  }

  return filtered;
}

/**
 * Split text into chapters based on detected markers
 */
function splitIntoChapters(lines: string[], markers: ChapterMarker[]): DetectedChapter[] {
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

    // Get chapter content (excluding the marker line itself for cleaner text)
    const chapterLines = lines.slice(startLine + 1, endLine + 1);

    // Also skip subtitle line if present
    const skipLines = marker.subtitle ? 1 : 0;
    const contentLines = chapterLines.slice(skipLines);

    chapters.push({
      number: marker.number,
      title: marker.title,
      subtitle: marker.subtitle,
      rawText: contentLines.join('\n').trim(),
      startLine,
      endLine,
    });
  }

  return chapters;
}

/**
 * Extract front matter (text before first chapter)
 */
function extractFrontMatter(lines: string[], firstChapterLine: number): string {
  if (firstChapterLine <= 0) return '';

  const frontMatterLines = lines.slice(0, firstChapterLine);
  return frontMatterLines.join('\n').trim();
}

/**
 * Detect and remove back matter (Project Gutenberg boilerplate, license text, etc.)
 * Returns the line index where back matter starts, or -1 if not found
 */
function detectBackMatterStart(lines: string[]): number {
  // DEFINITIVE back matter patterns - these are very unlikely to appear in story content
  // More conservative approach to avoid cutting off chapters prematurely
  const definitiveBackMatterPatterns = [
    /^\*{3}\s*END OF (THE |THIS )?PROJECT GUTENBERG/i,
    /^End of (the )?Project Gutenberg/i,
    /^END OF (THE |THIS )?PROJECT GUTENBERG/i,
    /^\*{3}\s*END OF THE EBOOK/i,
    /^\*{3}\s*START:?\s*FULL LICENSE/i,
    // Publisher advertisements (common in old scanned books)
    /^GROSSET\s*&\s*DUNLAP/i,
    /^There's More to Follow/i,
    /^There is More to Follow/i,
    /^Ask for .+ list/i,
    /^May be had wherever books are sold/i,
    /^In case the wrapper is lost/i,
    // Other common publishers
    /^PENGUIN BOOKS/i,
    /^BANTAM BOOKS/i,
    /^RANDOM HOUSE/i,
    /^HARPER\s*&\s*(BROTHERS|ROW|COLLINS)/i,
    /^SIMON\s*&\s*SCHUSTER/i,
    /^DOUBLEDAY/i,
  ];

  // POSSIBLE back matter patterns - these need confirmation from surrounding context
  // They could appear in story content (letters, journals, etc.)
  const possibleBackMatterPatterns = [
    /^\s*ADDENDA\s*$/i,     // Only if exactly "ADDENDA" on line
    /^\s*APPENDIX\s*$/i,    // Only if exactly "APPENDIX" on line
    /^\s*FOOTNOTES\s*$/i,   // Footnotes section header
    /^\s*ENDNOTES\s*$/i,    // Endnotes section header
    /^THE END\.?\s*$/i,     // Could be end of story OR end of a letter
    /^FINIS\.?\s*$/i,       // Latin for "the end"
    /^FIN\.?\s*$/i,         // French/Spanish for "the end"
  ];

  // Patterns that strongly indicate Gutenberg boilerplate or publisher ads (not story content)
  const boilerplatePatterns = [
    /Project Gutenberg Literary Archive Foundation/i,
    /This eBook is for the use of anyone anywhere/i,
    /SMALL PRINT!/i,
    /^Section \d+\.\s+General Terms of Use/i,
    /trademark\/copyright agreement/i,
    /gutenberg\.org/i,
    /public domain in the United States/i,
    /copyright laws of most countries/i,
    /^Produced by .+ from/i,
    /^Updated editions will replace the previous one/i,
    // Publisher advertisement patterns
    /Authors' Alphabetical List/i,
    /Popular Copyrighted Fiction/i,
    /books? (here )?you are sure to want/i,
    /greatest Index of Good Fiction/i,
    /Look on the Other Side/i,
    /write to the publishers/i,
    /complete (free )?list/i,
    /DETECTIVE STORIES BY/i,
    /STORIES BY [A-Z]\. [A-Z]\. [A-Z]/i,  // "STORIES BY J. S. FLETCHER" pattern
  ];

  // Search from the LAST 30% of the document for definitive markers
  // This ensures we catch publisher ads that appear after the story ends
  const scanStart = Math.floor(lines.length * 0.7);

  // First pass: look for DEFINITIVE markers (these are 100% reliable)
  for (let i = scanStart; i < lines.length; i++) {
    const line = lines[i].trim();

    for (const pattern of definitiveBackMatterPatterns) {
      if (pattern.test(line)) {
        return i;
      }
    }
  }

  // Second pass: look for boilerplate content (3+ consecutive lines)
  let consecutiveBoilerplate = 0;
  let firstBoilerplateLine = -1;

  for (let i = scanStart; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) continue;

    let isBoilerplate = false;
    for (const pattern of boilerplatePatterns) {
      if (pattern.test(line)) {
        isBoilerplate = true;
        break;
      }
    }

    if (isBoilerplate) {
      if (firstBoilerplateLine === -1) {
        firstBoilerplateLine = i;
      }
      consecutiveBoilerplate++;
      // If we find 3+ lines of boilerplate, consider it back matter
      if (consecutiveBoilerplate >= 3) {
        return firstBoilerplateLine;
      }
    } else {
      // Reset if we find non-boilerplate content
      consecutiveBoilerplate = 0;
      firstBoilerplateLine = -1;
    }
  }

  // Third pass: look for POSSIBLE markers in the LAST 10% (very end of document)
  // These are less reliable so we only trust them near the very end
  const veryEndStart = Math.floor(lines.length * 0.90);
  for (let i = veryEndStart; i < lines.length; i++) {
    const line = lines[i].trim();

    for (const pattern of possibleBackMatterPatterns) {
      if (pattern.test(line)) {
        return i;
      }
    }
  }

  return -1; // No back matter detected
}

/**
 * Remove Gutenberg front matter markers from the beginning
 * These often appear before the actual story front matter
 */
function removeGutenbergFrontMatter(text: string): string {
  // Split by double newlines and check if first sections are Gutenberg boilerplate
  const sections = text.split(/\n\n+/);
  let startIndex = 0;

  for (let i = 0; i < Math.min(5, sections.length); i++) {
    const section = sections[i].trim();
    if (
      /^The Project Gutenberg EBook of/i.test(section) ||
      /^\*{3}\s*START OF (THE |THIS )?PROJECT GUTENBERG/i.test(section) ||
      /^Produced by .+ from/i.test(section) ||
      /^Release Date:/i.test(section) ||
      /^\[?Most recently updated:/i.test(section)
    ) {
      startIndex = i + 1;
    } else {
      break;
    }
  }

  if (startIndex > 0) {
    return sections.slice(startIndex).join('\n\n').trim();
  }

  return text.trim();
}

/**
 * Main preprocessing function
 * Takes raw text and returns structured, cleaned output
 */
export function preprocessText(rawText: string): PreprocessedText {
  const originalLength = rawText.length;

  // Step 0: Remove Gutenberg front matter markers
  const noGutenbergHeader = removeGutenbergFrontMatter(rawText);

  // Step 1: Remove line numbers
  const { text: noLineNumbers, count: lineNumbersRemoved } = removeLineNumbers(noGutenbergHeader);

  // Step 2: Remove page markers
  const { text: noPageMarkers, count: pageMarkersRemoved } = removePageMarkers(noLineNumbers);

  // Step 3: Remove footnote indicators (numbers attached to words like "night-time5")
  const { text: noFootnotes, count: footnoteIndicatorsRemoved } = removeFootnoteIndicators(noPageMarkers);

  // Step 4: Remove decorative asterisk dividers
  const { text: noAsterisks, count: asteriskDividersRemoved } = removeAsteriskDividers(noFootnotes);

  // Step 5: Normalize whitespace
  const normalized = normalizeWhitespace(noAsterisks);

  // Step 6: Split into lines for chapter detection
  let lines = normalized.split('\n');

  // Step 7: Detect and remove back matter
  const backMatterStart = detectBackMatterStart(lines);
  let backMatter = '';
  let backMatterRemoved = false;

  if (backMatterStart > 0) {
    backMatter = lines.slice(backMatterStart).join('\n');
    lines = lines.slice(0, backMatterStart);
    backMatterRemoved = true;
  }

  // Step 8: Detect chapter markers
  const rawMarkers = detectChapterMarkers(lines);

  // Step 8b: Filter out Table of Contents markers (clusters of markers close together)
  const markers = filterOutTOCMarkers(rawMarkers, lines);

  // Step 9: Extract front matter
  const firstChapterLine = markers.length > 0 ? markers[0].lineIndex : lines.length;
  const frontMatter = extractFrontMatter(lines, firstChapterLine);

  // Step 10: Split into chapters
  let chapters = splitIntoChapters(lines, markers);

  // Step 11: Filter out chapters that are mostly empty or look like boilerplate
  chapters = chapters.filter(chapter => {
    const text = chapter.rawText.trim();
    // Keep if has substantial content (more than 50 characters of actual text)
    if (text.length < 50) return false;
    // Filter out chapters that are clearly boilerplate
    if (/Project Gutenberg/i.test(text) && text.length < 500) return false;
    return true;
  });

  // Renumber chapters if needed
  chapters = chapters.map((ch, idx) => ({
    ...ch,
    number: idx + 1,
  }));

  // Step 12: Detect line break style and normalize each chapter's text
  // Detect from the full text (before normalization) to get accurate metrics
  const fullTextForDetection = chapters.map(ch => ch.rawText).join('\n\n');
  const detectedLineBreakStyle = detectLineBreakStyle(fullTextForDetection);

  // Normalize each chapter's rawText based on detected style
  chapters = chapters.map(ch => ({
    ...ch,
    rawText: normalizeLineBreaks(ch.rawText, detectedLineBreakStyle),
  }));

  // Step 13: Build full cleaned text with proper chapter labels
  const cleanedFullText = chapters
    .map((ch, idx) => {
      if (idx === 0) return ch.rawText;
      // Format: "--- Chapter X: Title ---" or just "--- Chapter X ---"
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
      lineNumbersRemoved,
      pageMarkersRemoved,
      footnoteIndicatorsRemoved,
      asteriskDividersRemoved,
      chaptersDetected: chapters.length,
      backMatterRemoved,
      lineBreakStyle: detectedLineBreakStyle,
    },
    cleanedFullText,
  };
}

/**
 * Quick clean for simple texts (no chapter detection)
 * Useful for short stories or when user just wants basic cleanup
 */
export function quickClean(rawText: string): string {
  let text = rawText;

  // Remove markdown formatting (bold, italic, headers)
  text = text
    .replace(/\*\*(.*?)\*\*/g, "$1")  // **bold**
    .replace(/\*(.*?)\*/g, "$1")       // *italic*
    .replace(/__(.*?)__/g, "$1")       // __bold__
    .replace(/_(.*?)_/g, "$1")         // _italic_
    .replace(/^#{1,6}\s+/gm, "");      // # headers

  // Remove code fences that AI sometimes adds
  text = text
    .replace(/^```[\w]*\n?/gm, "")
    .replace(/\n?```$/gm, "")
    .replace(/```/g, "");

  const { text: noLineNumbers } = removeLineNumbers(text);
  const { text: noPageMarkers } = removePageMarkers(noLineNumbers);
  const { text: noFootnotes } = removeFootnoteIndicators(noPageMarkers);
  const { text: noAsterisks } = removeAsteriskDividers(noFootnotes);
  return normalizeWhitespace(noAsterisks);
}

// ============================================
// POEM STANZA DETECTION
// ============================================

export interface StanzaMarkedLine {
  text: string;
  stanzaNumber: number;
  isStanzaBreak: boolean;
}

/**
 * Detect stanza breaks in poetry.
 * A stanza break is defined as one or more empty lines between text lines.
 * Returns lines with stanza numbers assigned.
 *
 * @param lines - Array of text lines (can include empty lines)
 * @returns Array of StanzaMarkedLine with stanza numbers and break markers
 */
export function detectStanzas(lines: string[]): StanzaMarkedLine[] {
  const result: StanzaMarkedLine[] = [];
  let currentStanza = 1;
  let lastWasContent = false;
  let pendingBreak = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      // Empty line - potential stanza break
      if (lastWasContent) {
        pendingBreak = true;
      }
      // Don't add empty lines to result - we'll add a break marker instead
    } else {
      // Content line
      if (pendingBreak) {
        // Insert stanza break marker before this line
        // The break marker indicates the END of the previous stanza
        result.push({
          text: '',
          stanzaNumber: currentStanza,
          isStanzaBreak: true
        });
        currentStanza++;
        pendingBreak = false;
      }
      result.push({
        text: trimmed,
        stanzaNumber: currentStanza,
        isStanzaBreak: false
      });
      lastWasContent = true;
    }
  }

  return result;
}

// ============================================
// SCRIPT LINE PARSING
// ============================================

export interface ParsedScriptLine {
  speaker?: string;           // "WALTER", "JESSE" - NOT translated
  speakerAnnotation?: string; // "(V.O.)", "(O.S.)", "(CONT'D)" - NOT translated
  stageDirection?: string;    // "sighs", "He exits" - will be read by TTS
  dialogue: string;           // The actual dialogue text
  isStageDirectionOnly: boolean; // True if line is ONLY a stage direction
}

/**
 * Pattern for speaker names with optional annotation.
 * Matches:
 * - WALTER: dialogue
 * - WALTER WHITE: dialogue
 * - WALTER (V.O.): dialogue
 * - WALTER (O.S.): dialogue
 * - WALTER (CONT'D): dialogue
 * - COP #2: dialogue
 *
 * Speaker names are typically ALL CAPS (with possible numbers, hyphens, apostrophes)
 * followed by optional parenthetical annotation, then a colon.
 */
const SPEAKER_PATTERN = /^([A-Z][A-Z0-9\s\-'#\.]+?)(\s*\([^)]+\))?\s*:\s*(.*)$/;

/**
 * Pattern for bracketed speaker names: [WALTER]: dialogue
 */
const BRACKETED_SPEAKER_PATTERN = /^\[([A-Z][A-Z0-9\s\-'#\.]+?)\]\s*:\s*(.*)$/;

/**
 * Pattern for stage directions in parentheses or brackets.
 * Captures content WITHOUT the surrounding brackets.
 */
const STAGE_DIRECTION_PATTERN = /\(([^)]+)\)|\[([^\]]+)\]/g;

/**
 * Pattern for a line that is ONLY a stage direction (standalone).
 * e.g., "(He walks to the door)" or "[FADE TO BLACK]"
 */
const STANDALONE_STAGE_DIRECTION = /^\s*(?:\(([^)]+)\)|\[([^\]]+)\])\s*$/;

/**
 * Parse a script line to extract speaker name, annotation, stage directions, and dialogue.
 *
 * @param line - A single line of script text
 * @returns ParsedScriptLine with extracted components
 */
export function parseScriptLine(line: string): ParsedScriptLine {
  const trimmed = line.trim();

  // Check if entire line is a standalone stage direction
  const standaloneMatch = trimmed.match(STANDALONE_STAGE_DIRECTION);
  if (standaloneMatch) {
    const direction = standaloneMatch[1] || standaloneMatch[2];
    return {
      dialogue: '',
      stageDirection: direction,
      isStageDirectionOnly: true
    };
  }

  // Try standard speaker pattern: SPEAKER (annotation): dialogue
  const speakerMatch = trimmed.match(SPEAKER_PATTERN);
  if (speakerMatch) {
    const speaker = speakerMatch[1].trim();
    const annotation = speakerMatch[2]?.trim() || undefined;
    let dialogue = speakerMatch[3] || '';

    // Extract inline stage directions from dialogue
    const directions: string[] = [];
    dialogue = dialogue.replace(STAGE_DIRECTION_PATTERN, (_, p1, p2) => {
      directions.push(p1 || p2);
      return '';
    }).trim();

    return {
      speaker,
      speakerAnnotation: annotation,
      stageDirection: directions.length > 0 ? directions.join('; ') : undefined,
      dialogue,
      isStageDirectionOnly: false
    };
  }

  // Try bracketed speaker pattern: [SPEAKER]: dialogue
  const bracketedMatch = trimmed.match(BRACKETED_SPEAKER_PATTERN);
  if (bracketedMatch) {
    const speaker = bracketedMatch[1].trim();
    let dialogue = bracketedMatch[2] || '';

    // Extract inline stage directions from dialogue
    const directions: string[] = [];
    dialogue = dialogue.replace(STAGE_DIRECTION_PATTERN, (_, p1, p2) => {
      directions.push(p1 || p2);
      return '';
    }).trim();

    return {
      speaker,
      stageDirection: directions.length > 0 ? directions.join('; ') : undefined,
      dialogue,
      isStageDirectionOnly: false
    };
  }

  // No speaker found - check for inline stage directions in regular text
  const directions: string[] = [];
  let dialogue = trimmed.replace(STAGE_DIRECTION_PATTERN, (_, p1, p2) => {
    directions.push(p1 || p2);
    return '';
  }).trim();

  // If we extracted directions but have no remaining dialogue, it's direction-only
  if (dialogue === '' && directions.length > 0) {
    return {
      dialogue: '',
      stageDirection: directions.join('; '),
      isStageDirectionOnly: true
    };
  }

  return {
    dialogue: dialogue || trimmed, // Fall back to original if no processing occurred
    stageDirection: directions.length > 0 ? directions.join('; ') : undefined,
    isStageDirectionOnly: false
  };
}

/**
 * Extract all unique speaker names from a script text.
 * Useful for translation prompts to ensure speaker names aren't translated.
 *
 * @param text - Full script text
 * @returns Array of unique speaker names
 */
export function extractSpeakerNames(text: string): string[] {
  const speakers = new Set<string>();
  const lines = text.split('\n');

  for (const line of lines) {
    const parsed = parseScriptLine(line);
    if (parsed.speaker) {
      speakers.add(parsed.speaker);
    }
  }

  return Array.from(speakers);
}
