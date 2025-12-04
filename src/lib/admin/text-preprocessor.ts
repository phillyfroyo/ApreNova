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

  // Detected chapters
  chapters: DetectedChapter[];

  // Statistics
  stats: {
    originalLength: number;
    cleanedLength: number;
    lineNumbersRemoved: number;
    pageMarkersRemoved: number;
    chaptersDetected: number;
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
  type: 'roman' | 'arabic' | 'word' | 'divider';
  number: number;
  title: string;
  subtitle?: string;
  fullMatch: string;
}

function detectChapterMarkers(lines: string[]): ChapterMarker[] {
  const markers: ChapterMarker[] = [];

  // Roman numeral mapping
  const romanToArabic: Record<string, number> = {
    'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
    'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10,
    'XI': 11, 'XII': 12, 'XIII': 13, 'XIV': 14, 'XV': 15,
    'XVI': 16, 'XVII': 17, 'XVIII': 18, 'XIX': 19, 'XX': 20,
    'XXI': 21, 'XXII': 22, 'XXIII': 23, 'XXIV': 24, 'XXV': 25,
    'XXVI': 26, 'XXVII': 27, 'XXVIII': 28, 'XXIX': 29, 'XXX': 30,
    'XXXI': 31, 'XXXII': 32, 'XXXIII': 33, 'XXXIV': 34, 'XXXV': 35,
    'XXXVI': 36, 'XXXVII': 37, 'XXXVIII': 38, 'XXXIX': 39, 'XL': 40,
    'XLI': 41, 'XLII': 42, 'XLIII': 43,
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const nextLine = lines[i + 1]?.trim() || '';

    // Skip empty lines
    if (!line) continue;

    // Pattern 1: "CHAPTER X" or "Chapter 1" with optional title
    const chapterMatch = line.match(/^CHAPTER\s+(\d+|[IVXLC]+)\.?(?:\s*[:\-—–]\s*(.+))?$/i);
    if (chapterMatch) {
      const numStr = chapterMatch[1].toUpperCase();
      const num = romanToArabic[numStr] || parseInt(numStr) || markers.length + 1;
      markers.push({
        lineIndex: i,
        type: romanToArabic[numStr] ? 'roman' : 'arabic',
        number: num,
        title: chapterMatch[2]?.trim() || `Chapter ${num}`,
        subtitle: nextLine && !nextLine.match(/^(CHAPTER|BOOK|PART|\d|[IVXLC]+\.?\s*$)/i) ? nextLine : undefined,
        fullMatch: line,
      });
      continue;
    }

    // Pattern 2: Roman numeral alone on line (I., II., III., etc.)
    const romanMatch = line.match(/^([IVXLC]+)\.?$/);
    if (romanMatch && romanToArabic[romanMatch[1]]) {
      const num = romanToArabic[romanMatch[1]];
      // Check if next line looks like a title (not another marker or regular text)
      const hasTitle = nextLine &&
        nextLine.length < 100 &&
        /^[A-Z]/.test(nextLine) &&
        !nextLine.match(/^(CHAPTER|BOOK|PART|\d|[IVXLC]+\.?\s*$)/i);

      markers.push({
        lineIndex: i,
        type: 'roman',
        number: num,
        title: hasTitle ? nextLine : `Section ${num}`,
        fullMatch: line,
      });
      continue;
    }

    // Pattern 3: "BOOK ONE", "PART I", etc.
    const bookMatch = line.match(/^(BOOK|PART|CANTO|ACT|SCENE)\s+(\d+|[IVXLC]+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)\.?(?:\s*[:\-—–]\s*(.+))?$/i);
    if (bookMatch) {
      const wordToNum: Record<string, number> = {
        'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5,
        'SIX': 6, 'SEVEN': 7, 'EIGHT': 8, 'NINE': 9, 'TEN': 10,
      };
      const numStr = bookMatch[2].toUpperCase();
      const num = wordToNum[numStr] || romanToArabic[numStr] || parseInt(numStr) || markers.length + 1;
      markers.push({
        lineIndex: i,
        type: 'word',
        number: num,
        title: `${bookMatch[1]} ${bookMatch[2]}${bookMatch[3] ? ': ' + bookMatch[3] : ''}`,
        fullMatch: line,
      });
      continue;
    }

    // Pattern 4: ALL CAPS title line (potential section header)
    // Only if it's short and followed by regular text
    if (line.length < 80 && line === line.toUpperCase() && /^[A-Z]/.test(line) && !/^\d/.test(line)) {
      // Check it's not just a random caps word
      const wordCount = line.split(/\s+/).length;
      if (wordCount >= 2 && wordCount <= 10) {
        // Check next line is regular text
        if (nextLine && nextLine !== nextLine.toUpperCase() && nextLine.length > 20) {
          markers.push({
            lineIndex: i,
            type: 'word',
            number: markers.length + 1,
            title: line.split(/\s+/).map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' '),
            fullMatch: line,
          });
          continue;
        }
      }
    }

    // Pattern 5: Divider lines (---, ***, ===) - only if substantial
    if (/^[-*=_]{3,}\s*$/.test(line) || /^[-*=_\s]{5,}$/.test(line)) {
      // Only count as chapter break if there's significant text before and after
      const prevNonEmpty = lines.slice(Math.max(0, i - 5), i).find(l => l.trim());
      const nextNonEmpty = lines.slice(i + 1, i + 6).find(l => l.trim());
      if (prevNonEmpty && nextNonEmpty) {
        markers.push({
          lineIndex: i,
          type: 'divider',
          number: markers.length + 1,
          title: `Section ${markers.length + 1}`,
          fullMatch: line,
        });
      }
    }
  }

  return markers;
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
 * Main preprocessing function
 * Takes raw text and returns structured, cleaned output
 */
export function preprocessText(rawText: string): PreprocessedText {
  const originalLength = rawText.length;

  // Step 1: Remove line numbers
  const { text: noLineNumbers, count: lineNumbersRemoved } = removeLineNumbers(rawText);

  // Step 2: Remove page markers
  const { text: noPageMarkers, count: pageMarkersRemoved } = removePageMarkers(noLineNumbers);

  // Step 3: Normalize whitespace
  const normalized = normalizeWhitespace(noPageMarkers);

  // Step 4: Split into lines for chapter detection
  const lines = normalized.split('\n');

  // Step 5: Detect chapter markers
  const markers = detectChapterMarkers(lines);

  // Step 6: Extract front matter
  const firstChapterLine = markers.length > 0 ? markers[0].lineIndex : lines.length;
  const frontMatter = extractFrontMatter(lines, firstChapterLine);

  // Step 7: Split into chapters
  const chapters = splitIntoChapters(lines, markers);

  // Step 8: Build full cleaned text
  const cleanedFullText = chapters.map(ch => ch.rawText).join('\n\n---\n\n');

  return {
    frontMatter,
    chapters,
    stats: {
      originalLength,
      cleanedLength: cleanedFullText.length,
      lineNumbersRemoved,
      pageMarkersRemoved,
      chaptersDetected: chapters.length,
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
  return normalizeWhitespace(noPageMarkers);
}
