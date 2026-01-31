// src/lib/text-processing/file-extractors/txt-extractor.ts
// Plain text extraction (pass-through with basic normalization)

import type { ExtractionResult, ExtractionOptions } from '../types';

/**
 * Extract text from plain text content
 * This is mostly a pass-through with basic line ending normalization
 */
export function extractTextFromTxt(
  txtContent: string,
  options: ExtractionOptions = {}
): ExtractionResult {
  const originalLength = txtContent.length;

  // Basic normalization: standardize line endings
  let text = txtContent
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // If not preserving whitespace, do basic cleanup
  if (!options.preserveWhitespace) {
    text = text
      .replace(/[ \t]+$/gm, '')  // Remove trailing whitespace from lines
      .trim();
  } else {
    // For poetry: only trim trailing whitespace, preserve everything else
    text = text
      .replace(/[ \t]+$/gm, '')  // Remove trailing whitespace from lines
      .trim();
  }

  return {
    text,
    annotations: [], // Plain text doesn't have annotations
    stats: {
      originalLength,
      extractedLength: text.length,
      annotationsExtracted: 0,
    },
  };
}
