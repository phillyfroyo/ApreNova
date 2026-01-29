// src/lib/poem-processing/format-parsers.ts
// Format-specific stanza parsers for robust stanza detection
//
// The key insight: HTML from sources like Project Gutenberg uses empty <p> tags
// as semantic stanza markers. Parsing HTML BEFORE flattening to text lets us
// detect stanzas accurately without ratio-based guessing.
//
// Architecture:
// - HtmlStanzaParser: Semantic detection using empty <p> tags
// - TextStanzaParser: Direct blank-line trust (single-blank = stanza break)
// - getStanzaParser(): Router to select appropriate parser

import {
  AnnotatedPoemLine,
  StanzaDetectionResult,
  StanzaDetectorConfig,
} from './types';
import { detectStanzas } from './stanza-detector';

/**
 * Source format types for uploaded files
 */
export type SourceFormat = 'html' | 'txt' | 'rtf' | 'md';

/**
 * Options for format-specific stanza detection
 */
export interface FormatParserOptions {
  /** Source file format */
  sourceFormat: SourceFormat | null | undefined;
  /** Raw HTML content (only available for HTML uploads) */
  rawHtml: string | null | undefined;
}

/**
 * Result from getStanzaParser router
 */
export interface StanzaParserSelection {
  /** The content to parse (original HTML or plain text) */
  content: string;
  /** Function to parse stanzas from the content */
  parse: (text: string) => StanzaDetectionResult;
  /** Which parser was selected */
  parserType: 'html' | 'text';
}

// ============================================================================
// HTML STANZA PARSER
// ============================================================================

/**
 * Parse HTML to detect stanzas using semantic structure.
 *
 * In Gutenberg HTML (and similar sources):
 * - Content <p> tags = lines within a stanza
 * - Empty <p> tags (or <p><br/></p>) = stanza breaks
 *
 * This is MUCH more reliable than ratio-based heuristics because:
 * 1. We preserve the author's/editor's intent (empty paragraphs = breaks)
 * 2. No guessing based on visual spacing patterns
 * 3. Works correctly for short-stanza poetry that would fail ratio tests
 */
export function parseHtmlForStanzas(html: string): StanzaDetectionResult {
  // Parse HTML using DOMParser (browser) or regex fallback (server)
  const lines = extractLinesFromHtml(html);

  // Build annotated lines and group into stanzas
  const annotatedLines: AnnotatedPoemLine[] = [];
  const stanzas: AnnotatedPoemLine[][] = [];
  let currentStanza = 1;
  let currentStanzaLines: AnnotatedPoemLine[] = [];
  let sourceIndex = 0;
  let contentLines = 0;
  let blankLines = 0;

  for (const line of lines) {
    const isBlank = line.trim() === '';

    if (isBlank) {
      blankLines++;
      // Empty line = stanza break
      // Add break marker
      annotatedLines.push({
        text: '',
        stanzaNumber: currentStanza,
        isStanzaBreak: true,
        sourceIndex: sourceIndex++,
      });

      // Save current stanza if it has content
      if (currentStanzaLines.length > 0) {
        stanzas.push([...currentStanzaLines]);
        currentStanzaLines = [];
        currentStanza++;
      }
    } else {
      contentLines++;
      // Content line = part of current stanza
      const annotatedLine: AnnotatedPoemLine = {
        text: line,
        stanzaNumber: currentStanza,
        isStanzaBreak: false,
        sourceIndex: sourceIndex++,
      };
      annotatedLines.push(annotatedLine);
      currentStanzaLines.push(annotatedLine);
    }
  }

  // Don't forget the last stanza
  if (currentStanzaLines.length > 0) {
    stanzas.push(currentStanzaLines);
  }

  console.log(
    `[HtmlStanzaParser] Parsed ${lines.length} lines: ` +
    `${contentLines} content, ${blankLines} blank -> ${stanzas.length} stanzas`
  );

  return {
    annotatedLines,
    stanzas,
    stanzaCount: stanzas.length,
    detection: {
      totalLines: lines.length,
      blankLines,
      contentLines,
      method: 'single-blank', // HTML semantic parsing effectively uses single-blank
      blankThreshold: 1,
      visualSpacingRatio: 0, // Not applicable for HTML parsing
    },
  };
}

/**
 * Extract lines from HTML using semantic paragraph structure.
 * Empty <p> tags become empty strings (stanza breaks).
 * Content <p> tags become trimmed text lines.
 */
function extractLinesFromHtml(html: string): string[] {
  const lines: string[] = [];

  // Use regex-based extraction that works both client and server side
  // This preserves the semantic structure better than DOMParser for our use case

  // Remove script and style blocks first
  let cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');

  // Process <p> tags - the primary paragraph structure
  // Match both self-closing and regular p tags
  const pTagRegex = /<p[^>]*>([\s\S]*?)<\/p>|<p[^>]*\s*\/>/gi;
  let match;

  while ((match = pTagRegex.exec(cleanHtml)) !== null) {
    const content = match[1] || ''; // match[1] is content inside tags, empty for self-closing

    // Extract text, handling <br> tags as line breaks within the paragraph
    const textContent = content
      .replace(/<br\s*\/?>/gi, '\n') // Convert <br> to newlines
      .replace(/<[^>]+>/g, '') // Strip remaining HTML tags
      .replace(/&nbsp;/gi, ' ') // Convert &nbsp; to space
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#\d+;/g, (m) => String.fromCharCode(parseInt(m.slice(2, -1))))
      .replace(/[ \t]+/g, ' '); // Normalize horizontal whitespace

    const trimmed = textContent.trim();

    if (trimmed === '') {
      // Empty paragraph = stanza break
      lines.push('');
    } else if (trimmed.includes('\n')) {
      // Paragraph with <br> tags - split into multiple lines
      // but they're all part of the same stanza (no blank between them)
      const subLines = trimmed.split('\n').map(l => l.trim()).filter(l => l);
      lines.push(...subLines);
    } else {
      // Single line of content
      lines.push(trimmed);
    }
  }

  // If no <p> tags found, fall back to line-based extraction
  if (lines.length === 0) {
    console.log('[HtmlStanzaParser] No <p> tags found, falling back to line extraction');
    return extractLinesFromHtmlFallback(cleanHtml);
  }

  return lines;
}

/**
 * Fallback line extraction when HTML doesn't use <p> tags.
 * Uses <br> tags and newlines as line separators.
 */
function extractLinesFromHtmlFallback(html: string): string[] {
  // Convert <br> to newlines
  let text = html.replace(/<br\s*\/?>/gi, '\n');

  // Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#\d+;/g, (m) => String.fromCharCode(parseInt(m.slice(2, -1))));

  // Split into lines
  return text.split('\n').map(l => l.trim());
}

// ============================================================================
// TEXT STANZA PARSER
// ============================================================================

/**
 * Parse plain text for stanzas using direct blank-line trust.
 * Single blank line = stanza break, always.
 *
 * This is appropriate for:
 * - Plain text files (.txt)
 * - Markdown files (.md)
 * - RTF files (after stripping)
 * - Any non-HTML source
 *
 * We trust the user's formatting - if they put a blank line, it's a stanza break.
 * No adaptive analysis or ratio guessing.
 */
export function parseTextForStanzas(text: string): StanzaDetectionResult {
  // Use the canonical stanza detector with single-blank method
  // This bypasses the adaptive logic and trusts blank lines directly
  return detectStanzas(text, { method: 'single-blank' });
}

// ============================================================================
// PARSER ROUTER
// ============================================================================

/**
 * Get the appropriate stanza parser based on source format.
 *
 * IMPORTANT: The HTML parser can only be used at the DOCUMENT level, not per-chapter.
 * By the time we're processing individual chapters, the content has already been
 * converted to plain text. For per-chapter processing, we use text-based detection
 * but with `single-blank` method for HTML sources (since extractTextFromHTML
 * already converted empty <p> tags to blank lines).
 *
 * @param text - Plain text content (the chapter text to parse)
 * @param options - Source format info (rawHtml is only used for full-document parsing)
 * @returns Parser selection with content and parse function
 *
 * @example
 * ```typescript
 * // Per-chapter processing (most common case)
 * const { content, parse, parserType } = getStanzaParser(chapterText, {
 *   sourceFormat: story.sourceFormat,
 *   rawHtml: null, // Don't pass rawHtml for per-chapter - it's the full doc
 * });
 * const stanzaResult = parse(content);
 * ```
 */
export function getStanzaParser(
  text: string,
  options: FormatParserOptions
): StanzaParserSelection {
  const { sourceFormat, rawHtml } = options;

  // IMPORTANT: Only use HTML parser for FULL DOCUMENT parsing
  // For per-chapter processing, rawHtml should be null/undefined
  // because rawHtml is the ENTIRE document, not chapter-specific HTML
  if (sourceFormat === 'html' && rawHtml && !isChapterText(text, rawHtml)) {
    console.log('[FormatParser] Using HtmlStanzaParser (semantic <p> tag detection) for full document');
    return {
      content: rawHtml,
      parse: parseHtmlForStanzas,
      parserType: 'html',
    };
  }

  // For HTML sources processed per-chapter, use ADAPTIVE method
  // Gutenberg HTML uses empty <p> tags for visual spacing between EVERY line,
  // not just stanza breaks. The adaptive method detects this pattern (>70% ratio)
  // and uses threshold=2 (double-blank = real stanza break).
  if (sourceFormat === 'html') {
    console.log('[FormatParser] Using TextStanzaParser (adaptive) for HTML-sourced chapter');
    return {
      content: text,
      parse: (text: string) => detectStanzas(text, { method: 'adaptive' }),
      parserType: 'text',
    };
  }

  // Everything else uses text parser with direct blank-line trust
  console.log(`[FormatParser] Using TextStanzaParser (single-blank method) for format: ${sourceFormat || 'unknown'}`);
  return {
    content: text,
    parse: parseTextForStanzas,
    parserType: 'text',
  };
}

/**
 * Heuristic to detect if we're processing a chapter (subset) vs full document.
 * If the text length is much smaller than rawHtml, it's likely a chapter.
 */
function isChapterText(text: string, rawHtml: string): boolean {
  // If text is less than 50% of rawHtml length, it's probably a chapter
  // (HTML has tags so it's always longer, but a chapter should be much smaller)
  return text.length < rawHtml.length * 0.5;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  parseHtmlForStanzas as HtmlStanzaParser,
  parseTextForStanzas as TextStanzaParser,
};
