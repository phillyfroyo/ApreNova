// src/lib/text-processing/file-extractors/html-extractor.ts
// Universal HTML to plain text extraction
// Works in BOTH browser and Node.js (regex-based, no DOM dependency)
//
// This is the SINGLE SOURCE OF TRUTH for HTML extraction.
// Replaces both:
// - extractTextFromHTML() in text-utils.ts (DOM-based, browser-only)
// - extractTextFromHTMLServer() in text-processors.ts (regex-based, server-only)

import type { ExtractionResult, ExtractedAnnotation, ExtractionOptions } from '../types';

// ============================================================================
// HTML ENTITY DECODING
// ============================================================================

/**
 * Decode HTML entities to their text equivalents
 */
function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&rdquo;/gi, '"')
    .replace(/&ldquo;/gi, '"')
    .replace(/&hellip;/gi, "…")
    .replace(/&copy;/gi, "©")
    .replace(/&reg;/gi, "®")
    .replace(/&trade;/gi, "™")
    .replace(/&#(\d+);/g, (match, code) => {
      const num = parseInt(code, 10);
      return String.fromCharCode(num);
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (match, code) => {
      const num = parseInt(code, 16);
      return String.fromCharCode(num);
    });
}

// ============================================================================
// ANNOTATION EXTRACTION
// ============================================================================

/**
 * Extract annotations (sidenotes, footnotes, marginal notes) from HTML
 * and return both the annotations and the HTML with annotations removed
 */
function extractAnnotations(html: string): { html: string; annotations: ExtractedAnnotation[] } {
  const annotations: ExtractedAnnotation[] = [];
  let annotationIndex = 0;
  let cleanedHtml = html;

  // Pattern 1: <span class="sidenote">...</span>
  const sidenotePattern = /<span[^>]*class="[^"]*sidenote[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
  cleanedHtml = cleanedHtml.replace(sidenotePattern, (match, content) => {
    const text = content.replace(/<[^>]+>/g, '').trim();
    if (text) {
      annotations.push({
        id: `sidenote-${annotationIndex++}`,
        type: 'sidenote',
        text,
        nearbyText: '',
      });
    }
    return '';
  });

  // Pattern 2: <aside>...</aside> (not footnotes)
  const asidePattern = /<aside(?![^>]*class="[^"]*footnote)[^>]*>([\s\S]*?)<\/aside>/gi;
  cleanedHtml = cleanedHtml.replace(asidePattern, (match, content) => {
    const text = content.replace(/<[^>]+>/g, '').trim();
    if (text) {
      annotations.push({
        id: `aside-${annotationIndex++}`,
        type: 'sidenote',
        text,
        nearbyText: '',
      });
    }
    return '';
  });

  // Pattern 3: <span class="note">, <span class="margin-note">, etc.
  const notePattern = /<span[^>]*class="[^"]*(?:note|margin-note|marginal|marginnote)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
  cleanedHtml = cleanedHtml.replace(notePattern, (match, content) => {
    const text = content.replace(/<[^>]+>/g, '').trim();
    if (text) {
      annotations.push({
        id: `marginal-${annotationIndex++}`,
        type: 'marginal',
        text,
        nearbyText: '',
      });
    }
    return '';
  });

  // Pattern 4: <div class="footnote">...</div>
  const footnotePattern = /<div[^>]*class="[^"]*footnote[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  cleanedHtml = cleanedHtml.replace(footnotePattern, (match, content) => {
    const text = content.replace(/<[^>]+>/g, '').trim();
    if (text) {
      annotations.push({
        id: `footnote-${annotationIndex++}`,
        type: 'footnote',
        text,
        nearbyText: '',
      });
    }
    return '';
  });

  // Pattern 5: <aside class="footnote">...</aside>
  const footnoteAsidePattern = /<aside[^>]*class="[^"]*footnote[^"]*"[^>]*>([\s\S]*?)<\/aside>/gi;
  cleanedHtml = cleanedHtml.replace(footnoteAsidePattern, (match, content) => {
    const text = content.replace(/<[^>]+>/g, '').trim();
    if (text) {
      annotations.push({
        id: `footnote-${annotationIndex++}`,
        type: 'footnote',
        text,
        nearbyText: '',
      });
    }
    return '';
  });

  return { html: cleanedHtml, annotations };
}

// ============================================================================
// TOC REMOVAL
// ============================================================================

/**
 * Remove Table of Contents sections from HTML
 */
function removeTOC(html: string): string {
  let cleanedHtml = html;

  // Remove TOC tables (tables with many internal links)
  cleanedHtml = cleanedHtml.replace(/<table[^>]*class="[^"]*toc[^"]*"[^>]*>[\s\S]*?<\/table>/gi, '');
  cleanedHtml = cleanedHtml.replace(/<table[^>]*id="[^"]*toc[^"]*"[^>]*>[\s\S]*?<\/table>/gi, '');

  // Remove TOC divs
  cleanedHtml = cleanedHtml.replace(/<div[^>]*class="[^"]*toc[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  cleanedHtml = cleanedHtml.replace(/<div[^>]*id="[^"]*(?:contents|toc)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');

  return cleanedHtml;
}

// ============================================================================
// MAIN EXTRACTION
// ============================================================================

// Spacing markers used during processing
const MARKERS = {
  PRE_NEWLINE: '\x00PRENL\x00',
  PRE_START: '\x00PRESTART\x00',
  HEADER_BREAK: '\x00HEADBRK\x00',
  SECTION_BREAK: '\x00SECTION\x00',
  POEM_BREAK: '\x00POEM\x00',
  STANZA_BREAK: '\x00STANZA\x00',
};

/**
 * Extract text from HTML content
 * Universal implementation that works in both browser and Node.js
 *
 * This function:
 * 1. Extracts and removes annotations (sidenotes, footnotes)
 * 2. Removes TOC sections
 * 3. Removes script/style elements
 * 4. Converts HTML structure to text with appropriate spacing
 * 5. Preserves whitespace for poetry when requested
 */
export function extractTextFromHTML(
  html: string,
  options: ExtractionOptions = {}
): ExtractionResult {
  const { preserveWhitespace = false } = options;
  const originalLength = html.length;

  let text = html;

  // Step 1: Remove script and style elements
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  // Step 2: Remove TOC sections
  text = removeTOC(text);

  // Step 3: Remove "Contents" headings (orphaned after TOC removal)
  text = text.replace(/<h[1-6][^>]*>\s*(?:Contents|Table of Contents)\s*<\/h[1-6]>/gi, '');

  // Step 4: Extract annotations (removes them from content)
  const { html: annotationFreeHtml, annotations } = extractAnnotations(text);
  text = annotationFreeHtml;

  // Step 5: Handle PRE tags - preserve their content with newlines
  text = text.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, content) => {
    // Strip any nested tags but preserve whitespace
    const stripped = content.replace(/<[^>]+>/g, '');
    // Mark PRE content to preserve newlines
    const protectedContent = stripped.trim().replace(/\n/g, MARKERS.PRE_NEWLINE);
    return MARKERS.PRE_START + protectedContent + '\n\n';
  });

  // Step 6: Convert headers to have blank lines before/after
  text = text.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_, content) => {
    const stripped = content.replace(/<[^>]+>/g, '').trim();
    if (!stripped) return '';
    return MARKERS.HEADER_BREAK + stripped + MARKERS.HEADER_BREAK;
  });

  // Step 7: Convert paragraph tags
  text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, content) => {
    const stripped = content.replace(/<[^>]+>/g, '').trim();
    // Empty paragraph = visual spacing (potential stanza break in poetry)
    return stripped ? stripped + '\n' : '\n';
  });

  // Step 8: Convert br tags to newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Step 9: Convert list items
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, content) => {
    const stripped = content.replace(/<[^>]+>/g, '').trim();
    return '\n' + stripped + '\n';
  });

  // Step 10: Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Step 11: Decode HTML entities
  text = decodeHTMLEntities(text);

  // Step 12: Normalize whitespace based on preserveWhitespace option
  if (preserveWhitespace) {
    // For poetry: preserve ALL whitespace exactly
    // Only do minimal cleanup (remove trailing spaces, excessive blank lines 10+)
    text = text
      .replace(/[ \t]+$/gm, '')          // Remove trailing horizontal whitespace
      .replace(/\n{11,}/g, '\n\n\n\n\n\n\n\n\n\n')  // Only collapse 10+ blank lines
      // Restore markers
      .replace(new RegExp(MARKERS.HEADER_BREAK.replace(/\x00/g, '\\x00'), 'g'), '\n\n')
      .replace(new RegExp(MARKERS.PRE_START.replace(/\x00/g, '\\x00'), 'g'), '\n\n')
      .replace(new RegExp(MARKERS.PRE_NEWLINE.replace(/\x00/g, '\\x00'), 'g'), '\n')
      .trim();
  } else {
    // For prose: normalize whitespace while preserving meaningful spacing
    // Preserve hierarchical spacing:
    // - 1 blank line (\n\n) = stanza break
    // - 2 blank lines (\n\n\n) = poem separation
    // - 3+ blank lines (\n\n\n\n+) = section/collection separation
    text = text
      .replace(/[ \t]+/g, ' ')             // Collapse horizontal whitespace
      .replace(/\n /g, '\n')               // Remove space after newline
      .replace(/ \n/g, '\n')               // Remove space before newline
      .replace(/\n{5,}/g, MARKERS.SECTION_BREAK)  // 5+ newlines = section break
      .replace(/\n{4}/g, MARKERS.POEM_BREAK)      // 4 newlines = poem break
      .replace(/\n{3}/g, MARKERS.STANZA_BREAK)    // 3 newlines = stanza break
      .replace(/\n+/g, '\n')               // Collapse remaining newlines to 1
      .replace(new RegExp(MARKERS.SECTION_BREAK.replace(/\x00/g, '\\x00'), 'g'), '\n\n\n\n')
      .replace(new RegExp(MARKERS.POEM_BREAK.replace(/\x00/g, '\\x00'), 'g'), '\n\n\n')
      .replace(new RegExp(MARKERS.STANZA_BREAK.replace(/\x00/g, '\\x00'), 'g'), '\n\n')
      .replace(new RegExp(MARKERS.HEADER_BREAK.replace(/\x00/g, '\\x00'), 'g'), '\n\n')
      .replace(new RegExp(MARKERS.PRE_START.replace(/\x00/g, '\\x00'), 'g'), '\n\n')
      .replace(new RegExp(MARKERS.PRE_NEWLINE.replace(/\x00/g, '\\x00'), 'g'), '\n')
      .trim();
  }

  return {
    text,
    annotations,
    stats: {
      originalLength,
      extractedLength: text.length,
      annotationsExtracted: annotations.length,
    },
  };
}

/**
 * Alias for backward compatibility with server-side code
 * @deprecated Use extractTextFromHTML instead
 */
export function extractTextFromHTMLServer(
  html: string,
  preserveWhitespace: boolean = false
): { text: string; annotationsCount: number } {
  const result = extractTextFromHTML(html, { preserveWhitespace });
  return {
    text: result.text,
    annotationsCount: result.annotations.length,
  };
}
