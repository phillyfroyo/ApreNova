// src/lib/text-processing/shared/whitespace.ts
// Line break detection and normalization utilities
// Critical for poetry (preserve breaks) vs prose (join wrapped lines)

import type { LineBreakStyle } from '../types';

// ============================================================================
// LINE BREAK STYLE DETECTION
// ============================================================================

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

// ============================================================================
// LINE BREAK NORMALIZATION
// ============================================================================

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
 * - Preserve leading whitespace (indentation)
 */
export function normalizeLineBreaks(text: string, forceStyle?: LineBreakStyle): string {
  const style = forceStyle || detectLineBreakStyle(text);

  if (style === "intentional") {
    // Keep line breaks as-is, preserve leading whitespace (indentation)
    // Only remove trailing whitespace from each line
    // Preserve meaningful spacing for poetry:
    // - 1 blank line = stanza break
    // - 2 blank lines = poem separation
    // - 3+ blank lines = section/collection separation (preserve up to 8)
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map(line => line.replace(/\s+$/, ''))  // Only trim trailing whitespace, keep leading!
      .join('\n')
      .replace(/\n{10,}/g, '\n\n\n\n\n\n\n\n\n'); // Collapse 9+ blank lines to 8 (more lenient for poetry)
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

// ============================================================================
// WHITESPACE NORMALIZATION (PROSE)
// ============================================================================

/**
 * Normalize whitespace while preserving paragraph structure
 */
export function normalizeWhitespace(text: string): string {
  return text
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove trailing whitespace from lines
    .replace(/[ \t]+$/gm, '')
    // Remove leading whitespace from lines (but preserve indentation structure)
    .replace(/^[ \t]+/gm, (match) => match.length > 4 ? '    ' : '')
    // Preserve meaningful spacing for poetry (up to 4 blank lines)
    // Collapse excessive blank lines (5+ → 4)
    .replace(/\n{6,}/g, '\n\n\n\n\n')
    // Remove spaces before punctuation
    .replace(/\s+([.,;:!?])/g, '$1')
    // Ensure space after punctuation
    .replace(/([.,;:!?])([A-Za-z])/g, '$1 $2')
    .trim();
}

// ============================================================================
// WHITESPACE NORMALIZATION (POETRY - PRESERVE INDENTATION)
// ============================================================================

/**
 * Normalize whitespace for poetry - preserves leading whitespace (indentation)
 * but still normalizes line endings and removes trailing whitespace
 */
export function normalizeWhitespacePreserveIndent(text: string): string {
  return text
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove trailing whitespace from lines (but keep leading!)
    .replace(/[ \t]+$/gm, '')
    // Collapse excessive blank lines (10+ → 8) - more lenient for poetry
    .replace(/\n{11,}/g, '\n\n\n\n\n\n\n\n\n\n')
    .trim();
}

// ============================================================================
// HUMAN-READABLE DESCRIPTION
// ============================================================================

/**
 * Get a human-readable description of the detected line break style
 */
export function getLineBreakStyleDescription(style: LineBreakStyle): string {
  if (style === "prose-wrapped") {
    return "Text-wrapped prose detected. Lines will be joined into paragraphs.";
  }
  return "Intentional line breaks detected. Original formatting will be preserved.";
}
