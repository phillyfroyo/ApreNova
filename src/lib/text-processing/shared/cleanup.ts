// src/lib/text-processing/shared/cleanup.ts
// Shared cleanup utilities for removing artifacts from text
// Used by all content processors

// ============================================================================
// LINE NUMBER REMOVAL
// ============================================================================

/**
 * Remove line numbers from text
 * Handles various formats:
 * - "5 " at start of line
 * - " 10" at end of line
 * - "15" standalone
 * - "[5]" bracketed numbers
 */
export function removeLineNumbers(text: string): { text: string; count: number } {
  let count = 0;

  const lines = text.split('\n');
  const cleanedLines = lines.map(line => {
    // Remove line numbers at start of line (e.g., "5 ", "10  ", "125 ")
    // But be careful not to remove years or other meaningful numbers
    line = line.replace(/^(\s*)\d{1,4}(\s{2,}|\t)/, () => {
      count++;
      return '';
    });

    // Remove standalone line numbers (just a number on its own line)
    if (/^\s*\d{1,4}\s*$/.test(line)) {
      count++;
      return '';
    }

    // Remove line numbers at end of line after significant whitespace
    line = line.replace(/(\s{2,}|\t)\d{1,4}\s*$/, () => {
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

// ============================================================================
// PAGE MARKER REMOVAL
// ============================================================================

/**
 * Remove page markers from text
 * Handles: [Page 5], - 12 -, Page 5, [5], {5}, etc.
 */
export function removePageMarkers(text: string): { text: string; count: number } {
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

// ============================================================================
// FOOTNOTE INDICATOR REMOVAL
// ============================================================================

/**
 * Remove footnote indicators from text
 * Footnotes are 1-3 digit numbers attached to text without spaces.
 * They can appear after words/punctuation or at the start of lines.
 */
export function removeFootnoteIndicators(text: string): { text: string; count: number } {
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

// ============================================================================
// ASTERISK DIVIDER REMOVAL
// ============================================================================

/**
 * Remove decorative asterisk dividers from text
 * Handles patterns like: "* * *", "*   *   *", isolated asterisk lines
 */
export function removeAsteriskDividers(text: string): { text: string; count: number } {
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

// ============================================================================
// COMBINED CLEANUP
// ============================================================================

export interface CleanupResult {
  text: string;
  stats: {
    lineNumbersRemoved: number;
    pageMarkersRemoved: number;
    footnoteIndicatorsRemoved: number;
    asteriskDividersRemoved: number;
  };
}

/**
 * Run all cleanup operations in sequence
 */
export function runAllCleanup(text: string): CleanupResult {
  const { text: noLineNumbers, count: lineNumbersRemoved } = removeLineNumbers(text);
  const { text: noPageMarkers, count: pageMarkersRemoved } = removePageMarkers(noLineNumbers);
  const { text: noFootnotes, count: footnoteIndicatorsRemoved } = removeFootnoteIndicators(noPageMarkers);
  const { text: noAsterisks, count: asteriskDividersRemoved } = removeAsteriskDividers(noFootnotes);

  return {
    text: noAsterisks,
    stats: {
      lineNumbersRemoved,
      pageMarkersRemoved,
      footnoteIndicatorsRemoved,
      asteriskDividersRemoved,
    },
  };
}
