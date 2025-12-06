// src/lib/admin/text-preprocessor.ts
// Algorithmic text preprocessing - no AI needed

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
  // Roman numeral mapping (extended for longer works)
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
    const chapterMatch = line.match(/^CHAPTER\s+(\d+|[IVXLC]+)\.?(?:\s*[:\-—–]\s*(.+))?$/i);
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
  // Patterns that indicate the start of back matter (case-insensitive)
  // These are ordered roughly by priority - supplementary material first, then end markers
  const backMatterPatterns = [
    /^\s*ADDENDA\b/i,     // Addenda section (supplementary material)
    /^\s*APPENDIX\b/i,    // Appendix
    /^\s*FOOTNOTES\b/i,   // Footnotes section
    /^\s*ENDNOTES\b/i,    // Endnotes section
    /^\s*GLOSSARY\b/i,    // Glossary
    /^\s*INDEX\b/i,       // Index
    /^\s*NOTES\s*$/i,     // Notes section (when standalone on line)
    /^\*{3}\s*END OF (THE |THIS )?PROJECT GUTENBERG/i,
    /^End of (the )?Project Gutenberg/i,
    /^END OF (THE |THIS )?PROJECT GUTENBERG/i,
    /^\*{3}\s*END OF THE EBOOK/i,
    /^THE END\.?\s*$/i,   // "THE END" on its own line (common story ending marker)
    /^FINIS\.?\s*$/i,     // Latin for "the end"
  ];

  // Patterns that strongly indicate Gutenberg boilerplate (not story content)
  const boilerplatePatterns = [
    /Project Gutenberg Literary Archive Foundation/i,
    /This eBook is for the use of anyone anywhere/i,
    /SMALL PRINT!/i,
    /^\*{3}\s*START:?\s*FULL LICENSE/i,
    /^Section \d+\.\s+General Terms of Use/i,
    /trademark\/copyright agreement/i,
    /gutenberg\.org/i,
    /public domain in the United States/i,
    /copyright laws of most countries/i,
    /^Produced by .+ from/i,
    /^Updated editions will replace the previous one/i,
  ];

  // Search from the LAST 50% of the document FORWARD to find the EARLIEST back matter marker
  // This ensures we catch supplementary material like ADDENDA that appears before license text
  const scanStart = Math.floor(lines.length * 0.5);

  for (let i = scanStart; i < lines.length; i++) {
    const line = lines[i].trim();

    for (const pattern of backMatterPatterns) {
      if (pattern.test(line)) {
        return i;
      }
    }
  }

  // If no explicit marker, scan looking for boilerplate content
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
  const markers = detectChapterMarkers(lines);

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

  // Step 12: Build full cleaned text with proper chapter labels
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
    },
    cleanedFullText,
  };
}

/**
 * Quick clean for simple texts (no chapter detection)
 * Useful for short stories or when user just wants basic cleanup
 */
export function quickClean(rawText: string): string {
  const { text: noLineNumbers } = removeLineNumbers(rawText);
  const { text: noPageMarkers } = removePageMarkers(noLineNumbers);
  const { text: noFootnotes } = removeFootnoteIndicators(noPageMarkers);
  const { text: noAsterisks } = removeAsteriskDividers(noFootnotes);
  return normalizeWhitespace(noAsterisks);
}
