// src/lib/text-processing/file-extractors/rtf-extractor.ts
// RTF to plain text extraction
// SINGLE SOURCE OF TRUTH for RTF stripping - no duplicates

import type { ExtractionResult, ExtractionOptions } from '../types';

/**
 * Basic RTF to plain text conversion.
 * Strips RTF control codes for simplified text extraction.
 *
 * This is the SINGLE implementation - previously duplicated in:
 * - src/lib/admin/text-utils.ts (line 561-568)
 * - src/lib/story-processing/text-processors.ts (line 161-168)
 */
export function stripRTF(text: string): string {
  return text
    .replace(/\{\\[^{}]+\}/g, "")     // Remove control groups
    .replace(/\\[a-z]+\d*\s?/gi, "")  // Remove control words
    .replace(/[{}]/g, "")              // Remove remaining braces
    .replace(/\\'[0-9a-f]{2}/gi, "")  // Remove hex characters
    .trim();
}

/**
 * Extract text from RTF content
 */
export function extractTextFromRTF(
  rtfContent: string,
  options: ExtractionOptions = {}
): ExtractionResult {
  const originalLength = rtfContent.length;

  // Strip RTF codes
  const text = stripRTF(rtfContent);

  return {
    text,
    annotations: [], // RTF doesn't have our annotation types
    stats: {
      originalLength,
      extractedLength: text.length,
      annotationsExtracted: 0,
    },
  };
}
