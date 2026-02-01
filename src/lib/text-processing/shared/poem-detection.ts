// src/lib/text-processing/shared/poem-detection.ts
// Production poem detection algorithms - SINGLE SOURCE OF TRUTH
//
// These algorithms are used by:
// 1. Production upload pipeline (admin and user story uploads)
// 2. Dev Tools SU TP Algorithms testing system
// 3. Anthology pagination and navigation
//
// CRITICAL: Never duplicate this logic. Always import from this module.

/**
 * Detected poem structure
 */
export interface DetectedPoem {
  title: string;
  startLine: number;
  endLine: number;
  lines: string[];
}

/**
 * Pattern for poem titles within an anthology section.
 * Matches ALL CAPS text that's 3-60 chars, may end with period.
 * Examples: "SUCCESS.", "THE SOUL SELECTS", "I. HOPE", "NURSE'S SONG"
 * Note: Includes both straight apostrophe (') and curly apostrophes (' ')
 */
const POEM_TITLE_PATTERN = /^[A-Z][A-Z\s,.'\u2018\u2019""\-]{2,58}\.?\s*$/;

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
 * Pattern for [POEM] markers injected by HTML extractor.
 * These mark Title Case poem titles detected from HTML structure.
 */
const POEM_MARKER_PATTERN = /^\[POEM\]\s*(.+)$/i;

/**
 * Check if a line looks like a poem title or marker.
 *
 * Detection methods:
 * 1. [POEM] markers: Injected by HTML extractor for Title Case titles
 * 2. Numbered markers: "I.", "II.", "1.", "2." (standalone)
 * 3. ALL CAPS titles: "SUCCESS.", "THE SOUL SELECTS"
 *
 * Excludes SECTION headers like "I. LIFE." which have their own detection.
 */
export function isPoemTitleLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 100) return false;

  // Check for [POEM] markers first (injected by HTML extractor)
  // These are reliable because they're based on HTML structure
  if (POEM_MARKER_PATTERN.test(trimmed)) return true;

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
 * Check if a line is a section header (I. LIFE., II. LOVE., etc.)
 */
export function isSectionHeader(line: string): boolean {
  return SECTION_HEADER_PATTERN.test(line.trim());
}

/**
 * Detect poem boundaries within anthology text.
 *
 * This is the PRODUCTION algorithm for poem detection.
 * Used by:
 * - Anthology pagination for navigation
 * - Poem counting in preprocessing stats
 * - Dev Tools algorithm testing
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
      // Extract clean title from [POEM] markers, otherwise use as-is
      const poemMarkerMatch = trimmed.match(POEM_MARKER_PATTERN);
      currentTitle = poemMarkerMatch ? poemMarkerMatch[1].trim() : trimmed;
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
      const isSectionHeaderLine = /^[IVXLC]+\.\s+[A-Z]/.test(poem.title); // "I. LIFE."
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

      } else if (isSectionHeaderLine && isHeaderOnly) {
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
      const hasActualContent = allLines.some((line) => {
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
      }
    }

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
 * Count poems in text using the production detection algorithm.
 *
 * This function is a convenience wrapper around detectPoemBoundaries().
 * It ensures the same algorithm is used everywhere.
 *
 * @param text - Text to count poems in (can be full chapter text)
 * @returns Number of poems detected
 */
export function countPoems(text: string): number {
  const lines = text.split('\n');

  // Skip [COLLECTION] markers - these are section headers, not poems
  const filteredLines = lines.filter(line => !/^\[COLLECTION\]/i.test(line.trim()));

  const poems = detectPoemBoundaries(filteredLines);
  return poems.length;
}

// Export patterns for use in other modules
export { POEM_TITLE_PATTERN, NUMBERED_POEM_PATTERN, SECTION_HEADER_PATTERN };
