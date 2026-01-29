// src/lib/poem-processing/stanza-detector.ts
// THE single source of truth for stanza detection
// All other code should use this module, never implement their own stanza logic

import {
  AnnotatedPoemLine,
  StanzaDetectionResult,
  StanzaDetectorConfig,
  PoemLineMetadata,
  PoemLineMetadataMap,
} from './types';

const DEFAULT_CONFIG: StanzaDetectorConfig = {
  method: 'adaptive',
};

// Patterns for detecting poem/stanza boundaries in anthology collections
// These are used as fallback when blank-line detection fails (e.g., Gutenberg visual spacing)
const PATTERNS = {
  // Roman numeral only (I., II., III., etc.) - poem number within section
  ROMAN_NUMERAL: /^([IVXLC]+)\.\s*$/,
  // Section header (I. LIFE., II. LOVE.) - thematic sections
  SECTION_HEADER: /^([IVXLC]+)\.\s+([A-Z][A-Z\s,'".\-—–]+)\.?\s*$/,
  // ALL CAPS title (SUCCESS., BEQUEST.) - poem titles
  CAPS_TITLE: /^[A-Z][A-Z\s,'".\-—–]{2,}\.?\s*$/,
  // Editorial note in brackets [Published in...]
  EDITORIAL_NOTE: /^\s*\[.*\]\s*$/,
};

/**
 * Detect if a line is a structural poem/stanza marker.
 * Returns the type of marker or null if not a marker.
 */
function detectStructuralMarker(line: string): 'section' | 'poem' | 'title' | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Section headers take priority (I. LIFE.)
  if (PATTERNS.SECTION_HEADER.test(trimmed)) {
    return 'section';
  }

  // Roman numeral alone (I., II.) - poem number
  if (PATTERNS.ROMAN_NUMERAL.test(trimmed)) {
    return 'poem';
  }

  // ALL CAPS title (SUCCESS., BEQUEST.)
  // Only if it's relatively short (under 50 chars) to avoid matching long content lines
  if (trimmed.length < 50 && PATTERNS.CAPS_TITLE.test(trimmed)) {
    return 'title';
  }

  return null;
}

/**
 * Analyze blank line patterns to determine if content uses visual spacing.
 * Visual spacing pattern: >70% of content lines followed by exactly 1 blank.
 * This is common in Gutenberg HTML where empty <p> tags provide line spacing.
 *
 * @param lines - Array of text lines
 * @returns Analysis result with ratio and recommended threshold
 */
function analyzeBlankLinePattern(lines: string[]): {
  contentLines: number;
  blankLines: number;
  contentFollowedBySingleBlank: number;
  visualSpacingRatio: number;
  isVisualSpacingPattern: boolean;
} {
  let contentLines = 0;
  let blankLines = 0;
  let contentFollowedBySingleBlank = 0;
  let lastWasContent = false;
  let consecutiveBlanks = 0;

  for (const line of lines) {
    const isBlank = line.trim() === '';

    if (isBlank) {
      blankLines++;
      consecutiveBlanks++;
    } else {
      if (lastWasContent && consecutiveBlanks === 1) {
        contentFollowedBySingleBlank++;
      }
      contentLines++;
      consecutiveBlanks = 0;
      lastWasContent = true;
    }
  }

  const visualSpacingRatio = contentLines > 0
    ? contentFollowedBySingleBlank / contentLines
    : 0;

  return {
    contentLines,
    blankLines,
    contentFollowedBySingleBlank,
    visualSpacingRatio,
    isVisualSpacingPattern: visualSpacingRatio > 0.7,
  };
}

/**
 * Determine the blank line threshold for stanza breaks.
 *
 * @param lines - Array of text lines
 * @param method - Detection method to use
 * @returns Threshold (number of consecutive blanks needed for stanza break)
 */
function determineBlankThreshold(
  lines: string[],
  method: StanzaDetectorConfig['method']
): { threshold: number; analysis: ReturnType<typeof analyzeBlankLinePattern> } {
  const analysis = analyzeBlankLinePattern(lines);

  let threshold: number;
  switch (method) {
    case 'single-blank':
      threshold = 1;
      break;
    case 'double-blank':
      threshold = 2;
      break;
    case 'adaptive':
    default:
      // If visual spacing pattern detected, require 2+ blanks
      // Otherwise, single blank = stanza break
      threshold = analysis.isVisualSpacingPattern ? 2 : 1;
      break;
  }

  return { threshold, analysis };
}

/**
 * THE single source of truth for stanza detection.
 *
 * This function analyzes poem text and identifies stanza boundaries.
 * It produces annotated lines with stanza numbers and a grouped stanzas array.
 *
 * CRITICAL: This is the ONLY place stanza detection should happen.
 * All other code should import and use this function.
 *
 * @param text - Raw poem text with newline separators
 * @param config - Detection configuration (default: adaptive)
 * @returns StanzaDetectionResult with annotated lines and grouped stanzas
 *
 * @example
 * ```typescript
 * const result = detectStanzas(poemText);
 * console.log(`Found ${result.stanzaCount} stanzas`);
 * result.stanzas.forEach((stanza, i) => {
 *   console.log(`Stanza ${i + 1}: ${stanza.length} lines`);
 * });
 * ```
 */
export function detectStanzas(
  text: string,
  config: StanzaDetectorConfig = DEFAULT_CONFIG
): StanzaDetectionResult {
  const lines = text.split('\n');

  // Analyze blank line patterns and determine threshold
  const { threshold, analysis } = determineBlankThreshold(lines, config.method);

  // Log detection parameters (structured logging)
  console.log(
    `[StanzaDetector] Input: ${lines.length} lines ` +
    `(${analysis.contentLines} content, ${analysis.blankLines} blank)`
  );
  console.log(
    `[StanzaDetector] Method: ${config.method}, ` +
    `visualSpacingRatio: ${(analysis.visualSpacingRatio * 100).toFixed(1)}%, ` +
    `threshold: ${threshold}`
  );

  // For visual spacing patterns (Gutenberg-style), check if we have structural markers
  // that can help identify stanza/poem boundaries
  const useStructuralMarkers = analysis.isVisualSpacingPattern;
  let structuralMarkersFound = 0;

  // Build annotated lines and group into stanzas
  const annotatedLines: AnnotatedPoemLine[] = [];
  const stanzas: AnnotatedPoemLine[][] = [];
  let currentStanza = 1;
  let currentStanzaLines: AnnotatedPoemLine[] = [];
  let consecutiveBlanks = 0;
  let lastWasContent = false;
  let pendingBlanks: { sourceIndex: number }[] = [];

  lines.forEach((line, sourceIndex) => {
    const isBlank = line.trim() === '';

    if (isBlank) {
      if (lastWasContent) {
        consecutiveBlanks++;
        pendingBlanks.push({ sourceIndex });
      }
      // Don't add blank lines yet - wait to see if it's a stanza break
    } else {
      // Content line encountered
      const structuralMarker = useStructuralMarkers ? detectStructuralMarker(line) : null;

      // Determine if this is a stanza break:
      // 1. Consecutive blanks >= threshold (traditional method), OR
      // 2. Structural marker detected (section header, poem number, title)
      //    - But only if we have SOME blanks before it (to avoid breaking mid-stanza)
      const isBlankBasedBreak = consecutiveBlanks >= threshold && lastWasContent;
      const isStructuralBreak = structuralMarker && consecutiveBlanks > 0 && lastWasContent;

      if (isBlankBasedBreak || isStructuralBreak) {
        if (isStructuralBreak && !isBlankBasedBreak) {
          structuralMarkersFound++;
        }

        // This is a stanza break - add break markers for visual spacing
        for (const pending of pendingBlanks) {
          annotatedLines.push({
            text: '',
            stanzaNumber: currentStanza,
            isStanzaBreak: true,
            sourceIndex: pending.sourceIndex,
          });
        }

        // Save current stanza and start new one
        if (currentStanzaLines.length > 0) {
          stanzas.push([...currentStanzaLines]);
          currentStanzaLines = [];
        }
        currentStanza++;
      } else if (consecutiveBlanks > 0 && consecutiveBlanks < threshold) {
        // Blanks below threshold - these are visual spacing, not stanza breaks
        // Still add them as break markers but DON'T increment stanza
        for (const pending of pendingBlanks) {
          annotatedLines.push({
            text: '',
            stanzaNumber: currentStanza,
            isStanzaBreak: true,
            sourceIndex: pending.sourceIndex,
          });
        }
      }

      consecutiveBlanks = 0;
      pendingBlanks = [];

      // Add the content line
      const annotatedLine: AnnotatedPoemLine = {
        text: line, // Preserve original whitespace (indentation)
        stanzaNumber: currentStanza,
        isStanzaBreak: false,
        sourceIndex,
      };
      annotatedLines.push(annotatedLine);
      currentStanzaLines.push(annotatedLine);
      lastWasContent = true;
    }
  });

  // Don't forget the last stanza
  if (currentStanzaLines.length > 0) {
    stanzas.push(currentStanzaLines);
  }

  // Log results
  const detectionMethod = structuralMarkersFound > 0
    ? `${config.method}+structural(${structuralMarkersFound})`
    : config.method;
  console.log(
    `[StanzaDetector] Result: ${stanzas.length} stanzas, ` +
    `${annotatedLines.length} annotated lines (method: ${detectionMethod})`
  );

  // Log stanza sizes for debugging
  const stanzaSizes = stanzas.map(s => s.length);
  console.log(
    `[StanzaDetector] Stanza sizes: [${stanzaSizes.slice(0, 10).join(', ')}` +
    `${stanzaSizes.length > 10 ? '...' : ''}]`
  );

  return {
    annotatedLines,
    stanzas,
    stanzaCount: stanzas.length,
    detection: {
      totalLines: lines.length,
      blankLines: analysis.blankLines,
      contentLines: analysis.contentLines,
      method: config.method,
      blankThreshold: threshold,
      visualSpacingRatio: analysis.visualSpacingRatio,
    },
  };
}

/**
 * Convert StanzaDetectionResult to a metadata map.
 * This is used to carry stanza information through the translation pipeline.
 *
 * @param result - Result from detectStanzas
 * @returns Map of line index to metadata
 */
export function toMetadataMap(result: StanzaDetectionResult): PoemLineMetadataMap {
  const map: PoemLineMetadataMap = new Map();

  result.annotatedLines.forEach((line, idx) => {
    map.set(idx, {
      stanzaNumber: line.stanzaNumber,
      isStanzaBreak: line.isStanzaBreak,
    });
  });

  return map;
}

/**
 * Extract just the text lines from a StanzaDetectionResult.
 * This is used when sending to translation (which doesn't need metadata).
 *
 * @param result - Result from detectStanzas
 * @returns Array of text lines (including empty strings for breaks)
 */
export function toTextLines(result: StanzaDetectionResult): string[] {
  return result.annotatedLines.map(line => line.text);
}

/**
 * Group flat lines into stanzas using a metadata map.
 * This is used after translation to reconstruct the stanza structure.
 *
 * @param lines - Flat array of lines (source or translated)
 * @param metadata - Metadata map from toMetadataMap
 * @returns Array of stanzas, where each stanza is an array of lines
 */
export function groupLinesIntoStanzas<T>(
  lines: T[],
  metadata: PoemLineMetadataMap
): T[][] {
  const stanzaGroups = new Map<number, T[]>();

  lines.forEach((line, idx) => {
    const meta = metadata.get(idx);
    if (!meta || meta.isStanzaBreak) {
      // Skip stanza break markers when grouping
      return;
    }

    const stanzaNum = meta.stanzaNumber;
    if (!stanzaGroups.has(stanzaNum)) {
      stanzaGroups.set(stanzaNum, []);
    }
    stanzaGroups.get(stanzaNum)!.push(line);
  });

  // Convert to array, sorted by stanza number
  const stanzaNumbers = Array.from(stanzaGroups.keys()).sort((a, b) => a - b);
  return stanzaNumbers.map(num => stanzaGroups.get(num)!);
}
