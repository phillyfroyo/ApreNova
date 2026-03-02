// src/lib/text-processing/file-extractors/md-extractor.ts
// Markdown to plain text extraction

import type { ExtractionResult, ExtractionOptions } from '../types';

/**
 * Extract text from Markdown content
 * Strips Markdown formatting while preserving text content
 */
export function extractTextFromMd(
  mdContent: string,
  options: ExtractionOptions = {}
): ExtractionResult {
  const originalLength = mdContent.length;

  let text = mdContent
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove code fences
    .replace(/^```[\w]*\n?/gm, '')
    .replace(/\n?```$/gm, '')
    .replace(/```/g, '')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove markdown bold/italic
    .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')  // Bold+italic
    .replace(/\*\*([^*]+)\*\*/g, '$1')       // Bold
    .replace(/\*([^*]+)\*/g, '$1')           // Italic
    .replace(/___([^_]+)___/g, '$1')         // Bold+italic
    .replace(/__([^_]+)__/g, '$1')           // Bold
    .replace(/_([^_]+)_/g, '$1')             // Italic
    // Remove markdown headers (but keep the text)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // Remove blockquote markers
    .replace(/^>\s?/gm, '')
    // Remove link formatting but keep text and URL
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove image syntax
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    // Remove strikethrough
    .replace(/~~([^~]+)~~/g, '$1')
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Remove HTML tags
    .replace(/<[^>]+>/g, '');

  // Whitespace handling
  if (!options.preserveWhitespace) {
    text = text
      .replace(/[ \t]+$/gm, '')          // Remove trailing whitespace
      .replace(/\n{6,}/g, '\n\n\n\n\n')  // Collapse excessive blank lines
      .trim();
  } else {
    text = text
      .replace(/[ \t]+$/gm, '')  // Only remove trailing whitespace
      .trim();
  }

  return {
    text,
    annotations: [], // Markdown doesn't have our annotation types (though footnotes could be extracted)
    stats: {
      originalLength,
      extractedLength: text.length,
      annotationsExtracted: 0,
    },
  };
}
