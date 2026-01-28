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
  // Editorial note support (for poetry anthologies)
  isEditorialNote?: boolean;    // True for editorial notes - render in italics, not rewritten
}

export interface PageContent {
  lines?: StoryLine[];           // For prose: flat array of lines
  stanzas?: StoryLine[][];       // For poems: nested array where each inner array is a stanza
  // Anthology poem tracking (which poem this page belongs to)
  poemNumber?: number;           // 1-based poem number within the collection
  poemTitle?: string;            // Poem title (e.g., "SUCCESS.", "I.")
  isFirstPageOfPoem?: boolean;   // True if this is the first page of a poem
  isContinuation?: boolean;      // True if poem continues from previous page
}

/**
 * Poem metadata for anthology navigation
 */
export interface PoemInfo {
  number: number;                // 1-based poem number within collection
  title: string;                 // Poem title or Roman numeral
  startPage: number;             // First page of this poem (1-based)
  endPage: number;               // Last page of this poem (1-based)
  pageCount: number;             // Total pages this poem spans
}

// Type guard to check if content has stanzas (poem) or lines (prose)
export function hasStanzas(content: PageContent): content is PageContent & { stanzas: StoryLine[][] } {
  return Array.isArray(content.stanzas) && content.stanzas.length > 0;
}

// Flatten stanzas to lines for backward compatibility
export function flattenStanzas(stanzas: StoryLine[][]): StoryLine[] {
  const lines: StoryLine[] = [];
  stanzas.forEach((stanza, stanzaIdx) => {
    stanza.forEach(line => lines.push(line));
    // Add stanza break marker after each stanza except the last
    if (stanzaIdx < stanzas.length - 1) {
      lines.push({ es: '', en: '', isStanzaBreak: true });
    }
  });
  return lines;
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
  // Anthology-specific: list of poems in this collection for navigation
  poems?: PoemInfo[];
}

export interface LevelContent {
  storySlug: string;
  level: number;
  hasChapters: boolean;
  chapters: Record<number, ChapterContent>;
  // Content structure type - determines navigation labels and processing behavior
  structureType?: "prose" | "anthology" | "epic" | "script";
  // Custom navigation labels (optional, falls back to defaults based on structureType)
  navigationLabels?: {
    chapter: { en: string; es: string };
    page: { en: string; es: string };
  };
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
// POEM STANZA PAGINATION
// ============================================================================

/**
 * Detect if line metadata indicates this is poem content.
 * Checks for stanzaNumber values in the metadata.
 */
function isPoemContent(lineMetadata?: Map<number, LineMetadata>): boolean {
  if (!lineMetadata || lineMetadata.size === 0) return false;
  for (const meta of lineMetadata.values()) {
    if (meta.stanzaNumber !== undefined) return true;
  }
  return false;
}

// ============================================================================
// POEM-AWARE PAGINATION (for anthologies)
// ============================================================================

/**
 * Pattern for poem titles within an anthology section.
 * Matches ALL CAPS text that's 3-60 chars, may end with period.
 * Examples: "SUCCESS.", "THE SOUL SELECTS", "I. HOPE"
 */
const POEM_TITLE_PATTERN = /^[A-Z][A-Z\s,.'"-]{2,58}\.?\s*$/;

/**
 * Pattern for numbered poem markers (I., II., III., 1., 2., etc.)
 * These are standalone markers that indicate poem boundaries.
 */
const NUMBERED_POEM_PATTERN = /^([IVXLC]+\.|\d+\.)\s*$/;

/**
 * Pattern for SECTION headers in anthologies.
 * Matches "I. LIFE.", "II. LOVE.", "III. NATURE.", etc.
 * Format: Roman numeral + period + space + ALL CAPS title
 */
const SECTION_HEADER_PATTERN = /^([IVXLC]+)\.\s+([A-Z][A-Z\s,.'"-]+)\.?\s*$/;

/**
 * Check if a line looks like a poem title or marker.
 *
 * Detection methods:
 * 1. Numbered markers: "I.", "II.", "1.", "2." (standalone)
 * 2. ALL CAPS titles: "SUCCESS.", "THE SOUL SELECTS"
 * 3. Roman numeral with title: "I. HOPE" (handled by ALL CAPS pattern)
 *
 * Excludes SECTION headers like "I. LIFE." which have their own detection.
 */
function isPoemTitleLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 60) return false;

  // EXCLUDE section headers (like "I. LIFE.", "II. LOVE.") - these are chapter markers, not poems
  if (SECTION_HEADER_PATTERN.test(trimmed)) return false;

  // Check for numbered poems (standalone "I.", "II.", "1.", etc.)
  // Min length is 2 chars (e.g., "I.")
  if (trimmed.length >= 2 && NUMBERED_POEM_PATTERN.test(trimmed)) return true;

  // Check for ALL CAPS titles (need at least 3 chars for meaningful title)
  if (trimmed.length >= 3 && POEM_TITLE_PATTERN.test(trimmed)) {
    // Exclude lines that are clearly not titles:
    // - Lines with lowercase letters
    // - Lines that are purely punctuation
    if (/[a-z]/.test(trimmed)) return false;
    if (trimmed.replace(/[^A-Z]/g, '').length < 2) return false;
    return true;
  }

  return false;
}

/**
 * Check if a line is a section header (like "I. LIFE.", "II. LOVE.")
 */
function isSectionHeader(line: string): boolean {
  const trimmed = line.trim();
  return SECTION_HEADER_PATTERN.test(trimmed);
}

/**
 * Represents a section/collection within an anthology.
 */
export interface DetectedSection {
  /** Section number (from Roman numeral) */
  number: string;
  /** Section title (e.g., "LIFE", "LOVE") */
  title: string;
  /** Full header line (e.g., "I. LIFE.") */
  header: string;
  /** Line index where section starts (including header) */
  startLine: number;
  /** Line index where section ends (exclusive) */
  endLine: number;
  /** Content lines (including header) */
  lines: string[];
}

/**
 * Detect section/collection boundaries in an anthology.
 * Sections are marked by headers like "I. LIFE.", "II. LOVE.", "III. NATURE."
 *
 * @param lines - Array of text lines
 * @returns Array of detected sections
 */
export function detectSectionBoundaries(lines: string[]): DetectedSection[] {
  const sections: DetectedSection[] = [];
  let currentSectionStart = -1;
  let currentHeader = "";
  let currentNumber = "";
  let currentTitle = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (isSectionHeader(trimmed)) {
      // Found a new section header
      if (currentSectionStart >= 0) {
        // Close previous section
        sections.push({
          number: currentNumber,
          title: currentTitle,
          header: currentHeader,
          startLine: currentSectionStart,
          endLine: i,
          lines: lines.slice(currentSectionStart, i),
        });
      }

      // Parse the header
      const match = trimmed.match(SECTION_HEADER_PATTERN);
      currentNumber = match?.[1] || "";
      currentTitle = match?.[2]?.replace(/\.$/, "").trim() || "";
      currentHeader = trimmed;
      currentSectionStart = i;
    }
  }

  // Don't forget the last section
  if (currentSectionStart >= 0) {
    sections.push({
      number: currentNumber,
      title: currentTitle,
      header: currentHeader,
      startLine: currentSectionStart,
      endLine: lines.length,
      lines: lines.slice(currentSectionStart),
    });
  }

  // If no sections detected, treat entire content as one section
  if (sections.length === 0 && lines.length > 0) {
    sections.push({
      number: "1",
      title: "Poems",
      header: "",
      startLine: 0,
      endLine: lines.length,
      lines: lines,
    });
  }

  console.log(`[detectSectionBoundaries] Found ${sections.length} sections:`,
    sections.map(s => `"${s.number}. ${s.title}"`).join(', '));

  return sections;
}

/**
 * Represents a single poem within an anthology section.
 */
export interface DetectedPoem {
  /** Title line of the poem */
  title: string;
  /** Line index where poem starts (including title) */
  startLine: number;
  /** Line index where poem ends (exclusive) */
  endLine: number;
  /** Content lines (including title) */
  lines: string[];
}

/**
 * Detect poem boundaries within a chapter/section text.
 * Returns an array of poems, each with title and content.
 *
 * Detection strategy:
 * 1. First, try to find explicit poem markers (Roman numerals, ALL CAPS titles)
 * 2. If no markers found, fall back to double blank lines as separators
 * 3. If still no boundaries, treat entire chapter as one poem
 */
export function detectPoemBoundaries(lines: string[]): DetectedPoem[] {
  const poems: DetectedPoem[] = [];
  let currentPoemStart = -1;
  let currentTitle = "";
  let firstPoemMarkerIndex = -1;

  // First pass: detect explicit poem markers
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (isPoemTitleLine(trimmed)) {
      // Track the first poem marker index for preamble handling
      if (firstPoemMarkerIndex < 0) {
        firstPoemMarkerIndex = i;
      }
      // Found a new poem title/marker
      if (currentPoemStart >= 0) {
        // Close previous poem
        poems.push({
          title: currentTitle,
          startLine: currentPoemStart,
          endLine: i,
          lines: lines.slice(currentPoemStart, i),
        });
      }
      currentPoemStart = i;
      currentTitle = trimmed;
    }
  }

  // Don't forget the last poem
  if (currentPoemStart >= 0) {
    poems.push({
      title: currentTitle,
      startLine: currentPoemStart,
      endLine: lines.length,
      lines: lines.slice(currentPoemStart),
    });
  }

  // Handle preamble: if there's content before the first poem marker, include it
  // This captures section headers like "I. LIFE." that precede the first poem
  if (firstPoemMarkerIndex > 0 && poems.length > 0) {
    const preambleLines = lines.slice(0, firstPoemMarkerIndex);
    // Check if preamble has actual content (not just blank lines)
    const hasContent = preambleLines.some(line => line.trim().length > 0);
    if (hasContent) {
      console.log(`[detectPoemBoundaries] Including ${firstPoemMarkerIndex} preamble lines before first poem`);
      // Prepend preamble to the first poem
      poems[0] = {
        ...poems[0],
        startLine: 0,
        lines: [...preambleLines, ...poems[0].lines],
      };
    }
  }

  // If explicit markers found, post-process to merge header-only entries
  if (poems.length > 0) {
    // Merge strategy:
    // - Section headers (like "I. LIFE.") attach to following poem
    // - Roman numerals (like "I.", "II.") START a new poem - they don't cascade
    // - Poem titles with content finalize the current poem
    const mergedPoems: DetectedPoem[] = [];
    let pendingHeaders: DetectedPoem[] = [];

    for (let i = 0; i < poems.length; i++) {
      const poem = poems[i];
      // Count non-blank content lines (excluding the title line itself)
      const contentLines = poem.lines.filter((line, idx) => {
        if (idx === 0) return false; // Skip title line
        return line.trim() !== '';
      });

      const isRomanMarker = /^[IVXLC]+\.?\s*$/.test(poem.title);
      const isSectionHeader = /^[IVXLC]+\.\s+[A-Z]/.test(poem.title); // "I. LIFE."
      // Only treat as header-only if it has very few content lines AND is not a substantial entry
      const isHeaderOnly = contentLines.length <= 1;

      if (isRomanMarker) {
        // Roman numeral starts a NEW poem sequence
        // First, check if pending already has a Roman numeral - if so, finalize pending
        const pendingHasRoman = pendingHeaders.some(h => /^[IVXLC]+\.?\s*$/.test(h.title));
        if (pendingHasRoman && pendingHeaders.length > 0) {
          // Finalize pending as a standalone poem (has Roman but no content title)
          const allLines = pendingHeaders.flatMap(h => h.lines);
          mergedPoems.push({
            title: pendingHeaders[pendingHeaders.length - 1].title,
            startLine: pendingHeaders[0].startLine,
            endLine: pendingHeaders[pendingHeaders.length - 1].endLine,
            lines: allLines,
          });
          pendingHeaders = [];
        }
        // Add this Roman numeral to pending
        pendingHeaders.push(poem);

      } else if (isSectionHeader && isHeaderOnly) {
        // Section header like "I. LIFE." - can prefix following poems
        // If we have pending with Roman numeral, finalize first
        if (pendingHeaders.length > 0) {
          const allLines = pendingHeaders.flatMap(h => h.lines);
          mergedPoems.push({
            title: pendingHeaders[pendingHeaders.length - 1].title,
            startLine: pendingHeaders[0].startLine,
            endLine: pendingHeaders[pendingHeaders.length - 1].endLine,
            lines: allLines,
          });
          pendingHeaders = [];
        }
        pendingHeaders.push(poem);

      } else if (isHeaderOnly && !isRomanMarker) {
        // Non-Roman header with few content lines - add to pending
        pendingHeaders.push(poem);

      } else {
        // This is an actual poem with content - finalize with pending headers
        if (pendingHeaders.length > 0) {
          const allLines = pendingHeaders.flatMap(h => h.lines);
          mergedPoems.push({
            title: poem.title, // Use the content poem's title
            startLine: pendingHeaders[0].startLine,
            endLine: poem.endLine,
            lines: [...allLines, ...poem.lines],
          });
          pendingHeaders = [];
        } else {
          mergedPoems.push(poem);
        }
      }
    }

    // Finalize any leftover pending headers
    // BUT: Don't create standalone poems for Roman numerals with no content
    // These are headers for poems in the next section and should be skipped
    if (pendingHeaders.length > 0) {
      // Check if pending has any actual content (not just numerals and blanks)
      const allLines = pendingHeaders.flatMap(h => h.lines);
      const hasActualContent = allLines.some((line, idx) => {
        const trimmed = line.trim();
        // Skip first line of each header (it's the title)
        // Check for actual content lines (not blank, not just Roman numerals)
        if (!trimmed) return false;
        if (NUMBERED_POEM_PATTERN.test(trimmed)) return false;
        if (POEM_TITLE_PATTERN.test(trimmed) && trimmed.length < 10) return false;
        return true;
      });

      // Only create a poem if there's actual content, not just dangling headers
      if (hasActualContent) {
        mergedPoems.push({
          title: pendingHeaders[pendingHeaders.length - 1].title,
          startLine: pendingHeaders[0].startLine,
          endLine: pendingHeaders[pendingHeaders.length - 1].endLine,
          lines: allLines,
        });
      } else {
        console.log(`[detectPoemBoundaries] Skipping dangling headers with no content: ${pendingHeaders.map(h => h.title).join(', ')}`);
      }
    }

    console.log(`[detectPoemBoundaries] Found ${poems.length} markers, merged to ${mergedPoems.length} poems:`,
      mergedPoems.slice(0, 5).map(p => `"${p.title.slice(0, 25)}"`).join(', ') +
      (mergedPoems.length > 5 ? '...' : ''));
    return mergedPoems;
  }

  // Fallback: detect poem boundaries using double blank lines
  // (two or more consecutive blank lines = poem separator)

  let poemStart = 0;
  let consecutiveBlanks = 0;
  let poemNumber = 0;

  // Skip leading blank lines
  while (poemStart < lines.length && lines[poemStart].trim() === '') {
    poemStart++;
  }

  for (let i = poemStart; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (trimmed === '') {
      consecutiveBlanks++;
    } else {
      // If we had 2+ blank lines, this is a new poem
      if (consecutiveBlanks >= 2 && i > poemStart) {
        // Find where content actually ended (skip trailing blanks)
        let endLine = i - consecutiveBlanks;
        if (endLine > poemStart) {
          poemNumber++;
          poems.push({
            title: `Poem ${poemNumber}`,
            startLine: poemStart,
            endLine: endLine,
            lines: lines.slice(poemStart, endLine),
          });
          poemStart = i;
        }
      }
      consecutiveBlanks = 0;
    }
  }

  // Add the last poem
  if (poemStart < lines.length) {
    // Find actual end (skip trailing blanks)
    let endLine = lines.length;
    while (endLine > poemStart && lines[endLine - 1].trim() === '') {
      endLine--;
    }
    if (endLine > poemStart) {
      poemNumber++;
      poems.push({
        title: poemNumber > 0 ? `Poem ${poemNumber}` : "",
        startLine: poemStart,
        endLine: endLine,
        lines: lines.slice(poemStart, endLine),
      });
    }
  }

  // If double-blank detection found poems, return them
  if (poems.length > 1) {
    return poems;
  }

  // Final fallback: treat entire chapter as one poem
  if (lines.length > 0) {
    poems.push({
      title: "",
      startLine: 0,
      endLine: lines.length,
      lines: lines,
    });
  }

  return poems;
}

/**
 * Maximum lines per page for anthology poems.
 * Set high enough that most poems fit on a single page.
 * Each poem starts on its own page; only very long poems span multiple pages.
 */
const ANTHOLOGY_MAX_LINES_PER_PAGE = 50;

/**
 * Result of anthology pagination - includes poem tracking for navigation
 */
interface AnthologyPaginationResult {
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
 * - Poems can span multiple pages (max 30 lines per page)
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
    const addPage = (
      srcLines: string[],
      transLines: string[],
      pageMeta: Map<number, LineMetadata>,
      isFirst: boolean
    ) => {
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

// ============================================================================
// SINGLE CHAPTER BUILD (for incremental building during streaming)
// ============================================================================

/**
 * Result of building a single chapter's content
 */
export interface BuiltChapterResult {
  pages: Record<number, PageContent>;
  poems?: PoemInfo[];  // Only for anthologies
}

/**
 * Build a single chapter's paginated content.
 * Called immediately after translation to ensure streaming matches final output.
 *
 * @param sourceLines - Source language lines
 * @param translatedLines - Translated lines
 * @param sourceLanguage - Source language ("en" or "es")
 * @param structureType - Content structure type for pagination strategy
 * @param lineMetadata - Optional line metadata (for stanza detection)
 * @returns Built pages with poem info (for anthologies)
 */
export function buildSingleChapterContent(
  sourceLines: string[],
  translatedLines: string[],
  sourceLanguage: "en" | "es",
  structureType: "prose" | "anthology" | "epic" | "script" = "prose",
  lineMetadata?: Map<number, LineMetadata>
): BuiltChapterResult {
  const pages: Record<number, PageContent> = {};

  // Helper to trim lines - preserve leading whitespace for poetry
  const trimLine = (line: string | undefined, preserveIndent: boolean): string => {
    if (!line) return "";
    // For poetry: preserve leading whitespace (indentation) but remove trailing
    return preserveIndent ? line.trimEnd() : line.trim();
  };

  // ANTHOLOGY PATH: Poem-aware pagination with poem tracking
  if (structureType === "anthology") {
    const { pages: paginatedPages, poems: poemInfoList } = paginateAnthologyPoems(
      sourceLines,
      translatedLines,
      lineMetadata
    );

    for (let pIdx = 0; pIdx < paginatedPages.length; pIdx++) {
      const pageData = paginatedPages[pIdx];
      const lines: StoryLine[] = [];

      for (let lIdx = 0; lIdx < pageData.sourceLines.length; lIdx++) {
        // Preserve indentation for anthology poetry
        const sourceLine = trimLine(pageData.sourceLines[lIdx], true);
        const translatedLine = trimLine(pageData.translatedLines[lIdx], true);
        const lineMeta = pageData.lineMetadata.get(lIdx);

        const storyLine: StoryLine = sourceLanguage === "es"
          ? { es: sourceLine, en: translatedLine }
          : { en: sourceLine, es: translatedLine };

        if (lineMeta?.stanzaNumber !== undefined) {
          storyLine.stanzaNumber = lineMeta.stanzaNumber;
        }
        if (lineMeta?.isStanzaBreak) {
          storyLine.isStanzaBreak = true;
        }

        lines.push(storyLine);
      }

      // Build stanzas array from lines with stanzaNumber metadata
      // This provides the nested structure for stanza-level poem rendering
      let stanzas: StoryLine[][] | undefined = undefined;

      if (lines.length > 0) {
        const stanzaGroups: StoryLine[][] = [];
        let currentStanza: StoryLine[] = [];
        let currentStanzaNum = lines[0].stanzaNumber ?? 1;

        for (const line of lines) {
          const lineStanzaNum = line.stanzaNumber ?? currentStanzaNum;
          if (lineStanzaNum !== currentStanzaNum && currentStanza.length > 0) {
            // New stanza - push current and start new
            stanzaGroups.push(currentStanza);
            currentStanza = [];
            currentStanzaNum = lineStanzaNum;
          }
          currentStanza.push(line);
        }
        // Push final stanza
        if (currentStanza.length > 0) {
          stanzaGroups.push(currentStanza);
        }

        // Only set stanzas if we have multiple stanzas or stanza metadata exists
        if (stanzaGroups.length > 0) {
          stanzas = stanzaGroups;
        }
      }

      pages[pIdx + 1] = {
        lines,
        stanzas,
        poemNumber: pageData.poemNumber,
        poemTitle: pageData.poemTitle,
        isFirstPageOfPoem: pageData.isFirstPageOfPoem,
        isContinuation: pageData.isContinuation,
      };
    }

    return { pages, poems: poemInfoList };
  }

  // PROSE/DEFAULT PATH: Simple line-based pagination
  // For epic poetry, preserve indentation
  const preserveIndent = structureType === "epic";
  const sourcePages = paginateLines(sourceLines);
  const translatedPages = paginateLines(translatedLines);
  const maxPages = Math.max(sourcePages.length, translatedPages.length);

  for (let pIdx = 0; pIdx < maxPages; pIdx++) {
    const sourcePageLines = sourcePages[pIdx] || [];
    const translatedPageLines = translatedPages[pIdx] || [];
    const maxLines = Math.max(sourcePageLines.length, translatedPageLines.length);

    const lines: StoryLine[] = [];
    for (let lIdx = 0; lIdx < maxLines; lIdx++) {
      const sourceLine = trimLine(sourcePageLines[lIdx], preserveIndent);
      const translatedLine = trimLine(translatedPageLines[lIdx], preserveIndent);

      const storyLine: StoryLine = sourceLanguage === "es"
        ? { es: sourceLine, en: translatedLine }
        : { en: sourceLine, es: translatedLine };

      lines.push(storyLine);
    }

    pages[pIdx + 1] = { lines };
  }

  return { pages };
}

/**
 * Group source and translated lines by stanza number.
 * Returns an array of stanzas, where each stanza is an array of {source, translated, meta}.
 */
interface StanzaGroupEntry {
  source: string;
  translated: string;
  meta?: LineMetadata;
}

function groupLinesByStanza(
  sourceLines: string[],
  translatedLines: string[],
  lineMetadata: Map<number, LineMetadata>
): StanzaGroupEntry[][] {
  const stanzasMap = new Map<number, StanzaGroupEntry[]>();

  for (let i = 0; i < sourceLines.length; i++) {
    const meta = lineMetadata.get(i);
    const stanzaNum = meta?.stanzaNumber ?? 1;

    // Skip stanza breaks (empty placeholder lines)
    if (meta?.isStanzaBreak) continue;

    if (!stanzasMap.has(stanzaNum)) {
      stanzasMap.set(stanzaNum, []);
    }

    stanzasMap.get(stanzaNum)!.push({
      source: sourceLines[i] || '',
      translated: translatedLines[i] || '',
      meta,
    });
  }

  // Return stanzas in order
  const stanzaNumbers = Array.from(stanzasMap.keys()).sort((a, b) => a - b);
  return stanzaNumbers.map(num => stanzasMap.get(num)!);
}

/**
 * Paginate stanzas for poems, keeping stanzas together when possible.
 * Returns pages where each page contains complete stanzas.
 *
 * @param stanzas - Array of stanzas (each stanza is array of line entries)
 * @param linesPerPage - Target lines per page (default: 15 for poems)
 * @returns Array of pages, each page containing stanzas
 */
function paginateStanzas(
  stanzas: StanzaGroupEntry[][],
  linesPerPage: number = 15
): StanzaGroupEntry[][][] {
  const pages: StanzaGroupEntry[][][] = [];
  let currentPage: StanzaGroupEntry[][] = [];
  let currentPageLines = 0;

  for (const stanza of stanzas) {
    const stanzaLineCount = stanza.length;

    // If this stanza alone exceeds page limit, put it on its own page
    if (stanzaLineCount > linesPerPage) {
      // Finish current page if it has content
      if (currentPage.length > 0) {
        pages.push(currentPage);
        currentPage = [];
        currentPageLines = 0;
      }
      // Put large stanza on its own page
      pages.push([stanza]);
      continue;
    }

    // Check if adding this stanza would exceed page limit
    if (currentPageLines + stanzaLineCount > linesPerPage && currentPage.length > 0) {
      // Start a new page
      pages.push(currentPage);
      currentPage = [];
      currentPageLines = 0;
    }

    // Add stanza to current page
    currentPage.push(stanza);
    currentPageLines += stanzaLineCount;
  }

  // Don't forget the last page
  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages.length > 0 ? pages : [[[]]];
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
 * Options for building content structure with metadata.
 */
export interface BuildContentOptions {
  /**
   * Content structure type. Affects pagination behavior.
   * - "anthology": Use poem-aware pagination (one poem per page, max 30 lines)
   * - "epic": Use stanza-based pagination
   * - "prose" | "script": Use standard line-based pagination
   */
  structureType?: "prose" | "anthology" | "epic" | "script";
}

/**
 * Build content structure with line metadata support for poems and scripts.
 * This is an enhanced version that preserves stanza numbers, speaker names, etc.
 *
 * For anthologies: Each poem within a section becomes a page (poem-aware pagination).
 * For poems/epic: Builds nested `stanzas: StoryLine[][]` to guarantee stanza structure.
 * For scripts/prose: Builds flat `lines: StoryLine[]` with metadata.
 *
 * @param storySlug - The story's slug identifier
 * @param levelNum - The CEFR level number (1-6)
 * @param hasChapters - Whether the story has multiple chapters
 * @param chaptersData - Array of chapter data with source/translated lines and optional line metadata
 * @param sourceLanguage - The source language ("en" or "es")
 * @param options - Build options including structureType for anthology handling
 * @returns LevelContent object with enhanced StoryLine objects
 */
export function buildContentStructureWithMetadata(
  storySlug: string,
  levelNum: number,
  hasChapters: boolean,
  chaptersData: ProcessedChapterDataWithMetadata[],
  sourceLanguage: "en" | "es",
  options: BuildContentOptions = {}
): LevelContent {
  const { structureType = "prose" } = options;
  const chapters: Record<number, ChapterContent> = {};

  // Helper to trim lines - preserve leading whitespace for poetry
  const trimLine = (line: string | undefined, preserveIndent: boolean): string => {
    if (!line) return "";
    return preserveIndent ? line.trimEnd() : line.trim();
  };

  console.log(`[BuildContent] Building structure with type: ${structureType}, ${chaptersData.length} chapters`);

  chaptersData.forEach((chapter, chapterIndex) => {
    const pages: Record<number, PageContent> = {};

    // Check if this is poem content (has stanza numbers in metadata)
    const isPoem = isPoemContent(chapter.lineMetadata);

    // ANTHOLOGY PATH: Poem-aware pagination with poem tracking
    if (structureType === "anthology") {
      // Use poem-aware pagination - returns pages with poem info and poem list for navigation
      const { pages: paginatedPages, poems: poemInfoList } = paginateAnthologyPoems(
        chapter.sourceLines,
        chapter.translatedLines,
        chapter.lineMetadata
      );

      // Build pages from paginated poems with poem tracking
      for (let pIdx = 0; pIdx < paginatedPages.length; pIdx++) {
        const pageData = paginatedPages[pIdx];
        const lines: StoryLine[] = [];

        for (let lIdx = 0; lIdx < pageData.sourceLines.length; lIdx++) {
          // Preserve indentation for anthology poetry
          const sourceLine = trimLine(pageData.sourceLines[lIdx], true);
          const translatedLine = trimLine(pageData.translatedLines[lIdx], true);
          const lineMeta = pageData.lineMetadata.get(lIdx);

          const storyLine: StoryLine = sourceLanguage === "es"
            ? { es: sourceLine, en: translatedLine }
            : { en: sourceLine, es: translatedLine };

          // Add stanza number if present
          if (lineMeta?.stanzaNumber !== undefined) {
            storyLine.stanzaNumber = lineMeta.stanzaNumber;
          }
          if (lineMeta?.isStanzaBreak) {
            storyLine.isStanzaBreak = true;
          }

          lines.push(storyLine);
        }

        // Store page with poem tracking metadata
        pages[pIdx + 1] = {
          lines,
          poemNumber: pageData.poemNumber,
          poemTitle: pageData.poemTitle,
          isFirstPageOfPoem: pageData.isFirstPageOfPoem,
          isContinuation: pageData.isContinuation,
        };
      }

      // Store chapter with pages and poem list for navigation
      const chapterContent: ChapterContent = {
        pages,
        poems: poemInfoList,  // For anthology navigation dropdown
      };
      if (chapter.metadata) {
        chapterContent.metadata = chapter.metadata;
      }
      chapters[chapterIndex + 1] = chapterContent;

      return; // Skip the default chapter storage below
    } else if (isPoem && chapter.lineMetadata) {
      // POEM PATH: Build nested stanzas structure (for epic, single poems)

      // Group lines by stanza
      const groupedStanzas = groupLinesByStanza(
        chapter.sourceLines,
        chapter.translatedLines,
        chapter.lineMetadata
      );

      // Paginate stanzas (keeping stanzas together)
      const paginatedStanzas = paginateStanzas(groupedStanzas, 15);

      // Build pages with nested stanzas
      for (let pIdx = 0; pIdx < paginatedStanzas.length; pIdx++) {
        const pageStanzas = paginatedStanzas[pIdx];
        const stanzas: StoryLine[][] = [];

        for (const stanza of pageStanzas) {
          const stanzaLines: StoryLine[] = [];

          for (const entry of stanza) {
            // Preserve indentation for epic poetry
            const preserveIndent = structureType === "epic";
            const storyLine: StoryLine = sourceLanguage === "es"
              ? { es: trimLine(entry.source, preserveIndent), en: trimLine(entry.translated, preserveIndent) }
              : { en: trimLine(entry.source, preserveIndent), es: trimLine(entry.translated, preserveIndent) };

            // Add stanza number for reference
            if (entry.meta?.stanzaNumber !== undefined) {
              storyLine.stanzaNumber = entry.meta.stanzaNumber;
            }

            stanzaLines.push(storyLine);
          }

          if (stanzaLines.length > 0) {
            stanzas.push(stanzaLines);
          }
        }

        pages[pIdx + 1] = { stanzas };
      }
    } else {
      // NON-POEM PATH: Build flat lines structure (scripts, prose, etc.)
      const sourcePages = paginateLines(chapter.sourceLines);
      const translatedPages = paginateLines(chapter.translatedLines);

      const maxPages = Math.max(sourcePages.length, translatedPages.length);

      // Track which source line index we're at for metadata lookup
      let sourceLineIndex = 0;

      for (let pIdx = 0; pIdx < maxPages; pIdx++) {
        const sourcePageLines = sourcePages[pIdx] || [];
        const translatedPageLines = translatedPages[pIdx] || [];
        const maxLines = Math.max(sourcePageLines.length, translatedPageLines.length);

        const lines: StoryLine[] = [];
        // Preserve indentation for epic poetry
        const preserveIndent = structureType === "epic";
        for (let lIdx = 0; lIdx < maxLines; lIdx++) {
          const sourceLine = trimLine(sourcePageLines[lIdx], preserveIndent);
          const translatedLine = trimLine(translatedPageLines[lIdx], preserveIndent);

          // Get line metadata if available
          const lineMeta = chapter.lineMetadata?.get(sourceLineIndex);
          const translatedDirection = chapter.translatedStageDirections?.get(sourceLineIndex);

          // Build the StoryLine with metadata
          const storyLine: StoryLine = sourceLanguage === "es"
            ? { es: sourceLine, en: translatedLine }
            : { en: sourceLine, es: translatedLine };

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
    // Include structure type for UI rendering (navigation labels, etc.)
    structureType: structureType !== "prose" ? structureType : undefined,
  };
}

// ============================================================================
// CHAPTER PARSING (uses admin utilities but provides a simpler interface)
// ============================================================================

import { preprocessText, type PreprocessOptions } from "@/lib/admin/text-preprocessor";
import { cleanText as adminCleanText, parseChaptersFromText } from "@/lib/admin/text-utils";

/**
 * Options for chapter parsing
 */
export interface ParseChaptersOptions {
  /**
   * Content structure type for proper marker handling.
   * - "auto": Auto-detect (default)
   * - "anthology": Poetry collections - preserves "I. LIFE." style markers in content
   * - "epic": Narrative poetry - preserves markers in content
   * - "prose": Standard novels/stories - markers stripped from content
   * - "script": Screenplays/transcripts
   */
  structureType?: "auto" | "prose" | "anthology" | "epic" | "script";
}

/**
 * Result of chapter parsing
 */
export interface ParseChaptersResult {
  hasChapters: boolean;
  chapters: ParsedChapter[];
  /** The detected or specified structure type */
  structureType: "prose" | "anthology" | "epic" | "script";
}

/**
 * Parse text into chapters using the admin pipeline's robust preprocessing.
 * Preserves chapter metadata (title, subtitle, number) for display in UI.
 *
 * @param text - Raw text to parse
 * @param options - Optional settings including structureType for anthology handling
 * @returns Object with hasChapters flag, chapters array, and detected structure type
 */
export function parseChapters(
  text: string,
  options: ParseChaptersOptions = {}
): ParseChaptersResult {
  // Use the full admin preprocessing pipeline for robust text cleaning and chapter detection
  // Pass structure type to control marker preservation (anthologies keep "I. LIFE." etc.)
  const preprocessed = preprocessText(text, {
    structureType: options.structureType || "auto"
  });

  const detectedStructureType = preprocessed.stats.structureType;

  console.log(`[parseChapters] Preprocessing found ${preprocessed.chapters.length} chapters, structureType=${detectedStructureType}`);

  // If preprocessing found chapters (1 or more), use those with full metadata
  // IMPORTANT: Use rawText from chapters, NOT cleanedFullText (which has --- Chapter X --- markers)
  if (preprocessed.chapters.length >= 1) {
    const hasMultiple = preprocessed.chapters.length > 1;
    console.log(`[parseChapters] Using ${preprocessed.chapters.length} preprocessed chapter(s), hasChapters=${hasMultiple}`);

    // Log first chapter preview for debugging
    const firstChapter = preprocessed.chapters[0];
    const preview = firstChapter.rawText.substring(0, 200).replace(/\n/g, '\\n');
    console.log(`[parseChapters] First chapter preview: "${preview}..."`);

    return {
      hasChapters: hasMultiple,
      chapters: preprocessed.chapters.map((ch) => ({
        text: ch.rawText,
        metadata: {
          number: ch.number,
          title: ch.title || `Chapter ${ch.number}`,
          subtitle: ch.subtitle,
        },
      })),
      structureType: detectedStructureType,
    };
  }

  // Fallback: preprocessing found 0 chapters (shouldn't happen normally)
  // Try the simpler parseChaptersFromText for common chapter markers
  console.log(`[parseChapters] FALLBACK: No chapters from preprocessing, trying parseChaptersFromText`);
  const preserveWhitespace = detectedStructureType === "anthology" || detectedStructureType === "epic";
  const cleanedText = adminCleanText(text, { preserveWhitespace });
  const parsedChapters = parseChaptersFromText(cleanedText);

  if (parsedChapters.length > 1) {
    // Fallback parser found chapters
    console.log(`[parseChapters] FALLBACK: Found ${parsedChapters.length} chapters via parseChaptersFromText`);
    return {
      hasChapters: true,
      chapters: parsedChapters.map((chText, idx) => ({
        text: chText,
        metadata: {
          number: idx + 1,
          title: `Chapter ${idx + 1}`,
        },
      })),
      structureType: detectedStructureType,
    };
  }

  // No chapters detected - return as single chapter
  console.log(`[parseChapters] FALLBACK: Single chapter, no markers found`);
  return {
    hasChapters: false,
    chapters: [{
      text: cleanedText,
      metadata: {
        number: 1,
        title: "Full Text",
      },
    }],
    structureType: detectedStructureType,
  };
}
