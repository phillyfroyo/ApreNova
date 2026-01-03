// src/lib/story-processing/translation-utils.ts
// Client-safe translation utilities (no AI SDK dependencies)
// These functions handle line numbering and alignment for bilingual text

// ============================================================================
// LINE NUMBER ALIGNMENT UTILITIES
// These functions handle the [N] prefix system for maintaining line alignment
// ============================================================================

/**
 * Add line numbers to NON-BLANK lines only for translation alignment.
 * Tracks which lines are blank so we can reconstruct later.
 *
 * Input: "line1\n\nline3"
 * Output: {
 *   numberedText: "[1] line1\n[2] line3",
 *   lineCount: 2,
 *   blankLinePositions: [1] // 0-indexed positions of blank lines
 * }
 */
export function addLineNumbers(text: string): {
  numberedText: string;
  lineCount: number;
  totalLines: number;
  blankLinePositions: number[];
} {
  const lines = text.split("\n");
  const blankLinePositions: number[] = [];
  const contentLines: string[] = [];

  lines.forEach((line, idx) => {
    if (line.trim() === "") {
      blankLinePositions.push(idx);
    } else {
      contentLines.push(`[${contentLines.length + 1}] ${line}`);
    }
  });

  return {
    numberedText: contentLines.join("\n"),
    lineCount: contentLines.length,
    totalLines: lines.length,
    blankLinePositions,
  };
}

/**
 * Parse numbered lines from translation response.
 * Extracts content by line number, stripping the [N] prefix.
 */
export function parseNumberedLines(
  text: string,
  expectedCount: number
): string[] {
  const result: string[] = new Array(expectedCount).fill("");

  // Match patterns like [1] text, [2] text, etc.
  const linePattern = /\[(\d+)\]\s*([^\n]*)/g;

  let match;
  while ((match = linePattern.exec(text + "\n")) !== null) {
    const lineNum = parseInt(match[1], 10);
    let lineText = match[2].trim();

    // Double-check: strip any remaining [N] prefix that might be nested
    lineText = lineText.replace(/^\[\d+\]\s*/, "");

    if (lineNum >= 1 && lineNum <= expectedCount) {
      result[lineNum - 1] = lineText;
    }
  }

  return result;
}

/**
 * Reconstruct full text by re-inserting blank lines at their original positions
 */
export function reconstructWithBlankLines(
  translatedLines: string[],
  blankLinePositions: number[],
  totalLines: number
): string[] {
  const result: string[] = [];
  let translatedIdx = 0;

  for (let i = 0; i < totalLines; i++) {
    if (blankLinePositions.includes(i)) {
      result.push(""); // Re-insert blank line
    } else {
      result.push(translatedLines[translatedIdx] || "");
      translatedIdx++;
    }
  }

  return result;
}

/**
 * Final cleanup: strip any [N] prefixes that might have leaked through
 */
export function stripLineNumberPrefixes(lines: string[]): string[] {
  return lines.map((line) => line.replace(/^\[\d+\]\s*/, "").trim());
}

// ============================================================================
// TRUNCATION DETECTION
// Borrowed from admin pipeline - detects when translations are incomplete
// ============================================================================

export interface TruncationResult {
  isTruncated: boolean;
  reasons: string[];
  translatedNonEmpty: number;
  punctuationMismatches: number;
  mismatchedLines: number[];
}

/**
 * Check for truncation issues in translation response
 */
export function detectTruncation(
  sourceLines: string[],
  translatedLines: string[],
  lineCount: number,
  stopReason: string | null | undefined
): TruncationResult {
  const reasons: string[] = [];
  let isTruncated = false;
  let punctuationMismatches = 0;
  const mismatchedLines: number[] = [];

  const translatedNonEmpty = translatedLines.filter((l) => l.length > 0).length;

  // Check 1: API hit max_tokens limit (definitive truncation)
  if (stopReason === "max_tokens") {
    isTruncated = true;
    reasons.push("API response hit max_tokens limit");
  }

  // Check 2: Line count mismatch - MUST be exact match for bilingual alignment
  if (translatedNonEmpty !== lineCount) {
    isTruncated = true;
    reasons.push(`Line count mismatch: ${translatedNonEmpty}/${lineCount} (must be exact)`);
  }

  // Check 3: Compare last source line length vs last translated line length
  const nonEmptySourceLines = sourceLines.filter((l) => l.trim());
  const lastSourceLine = nonEmptySourceLines[nonEmptySourceLines.length - 1] || "";
  const lastTranslatedLine = translatedLines.filter((l) => l.length > 0).pop() || "";

  if (lastSourceLine.length > 50 && lastTranslatedLine.length < lastSourceLine.length * 0.3) {
    isTruncated = true;
    reasons.push(
      `Final line too short: ${lastTranslatedLine.length} chars vs ${lastSourceLine.length} source chars`
    );
  }

  // Check 4: Punctuation mismatch at line endings
  const sentenceEndPunctuation = /[.!?。？！"']$/;

  for (let i = 0; i < Math.min(sourceLines.length, translatedLines.length); i++) {
    const sourceLine = sourceLines[i]?.trim() || "";
    const transLine = translatedLines[i]?.trim() || "";

    if (
      sourceLine.length > 10 &&
      sentenceEndPunctuation.test(sourceLine) &&
      !sentenceEndPunctuation.test(transLine) &&
      transLine.length > 0
    ) {
      punctuationMismatches++;
      if (mismatchedLines.length < 5) {
        mismatchedLines.push(i + 1);
      }
    }
  }

  if (punctuationMismatches > 3) {
    isTruncated = true;
    reasons.push(
      `Punctuation mismatch: ${punctuationMismatches} lines end differently`
    );
  }

  return {
    isTruncated,
    reasons,
    translatedNonEmpty,
    punctuationMismatches,
    mismatchedLines,
  };
}
