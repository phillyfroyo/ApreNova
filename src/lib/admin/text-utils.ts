// src/lib/admin/text-utils.ts
// Consolidated text processing utilities for the admin upload pipeline
//
// NOTE: Core utilities (splitIntoSubChunks, file validation) are now in
// the shared library at @/lib/story-processing/processing-config.ts
// We re-export them here for backward compatibility.

// Import directly from processing-config to avoid circular dependency with client.ts
// (client.ts → text-processing.ts → text-utils.ts → client.ts)
import {
  MAX_CHUNK_CHARS,
  splitIntoSubChunks as sharedSplitIntoSubChunks,
  isAcceptedFile as sharedIsAcceptedFile,
  detectFileType as sharedDetectFileType,
  SUPPORTED_FILE_TYPES as SHARED_SUPPORTED_FILE_TYPES,
} from "@/lib/story-processing/processing-config";

// ============================================
// Types
// ============================================

export interface ExtractedAnnotation {
  id: string;
  type: "sidenote" | "footnote" | "marginal";
  text: string;
  nearbyText: string;
}

export interface HTMLExtractionResult {
  text: string;
  annotations: ExtractedAnnotation[];
}

// ============================================
// Text Cleaning
// ============================================

export interface CleanTextOptions {
  /** Preserve whitespace typology for poetry (don't collapse newlines or strip indentation) */
  preserveWhitespace?: boolean;
}

/**
 * Clean text by removing AI artifacts, markdown formatting, and normalizing.
 * This is the single source of truth for text cleaning across the pipeline.
 *
 * @param text The text to clean
 * @param options.preserveWhitespace If true, preserve all whitespace (for poetry)
 */
export function cleanText(text: string, options: CleanTextOptions = {}): string {
  const { preserveWhitespace = false } = options;
  let cleaned = text
    // Remove code fences (```language or just ```)
    .replace(/^```[\w]*\n?/gm, "")
    .replace(/\n?```$/gm, "")
    .replace(/```/g, "")
    // Remove triple quotes that AI sometimes adds
    .replace(/^"""\n?/gm, "")
    .replace(/\n?"""$/gm, "")
    .replace(/"""/g, "")
    .replace(/^'''\n?/gm, "")
    .replace(/\n?'''$/gm, "")
    .replace(/'''/g, "")
    // Remove markdown bold/italic
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    // Remove markdown headers
    .replace(/^#{1,6}\s+/gm, "")
    // Normalize line endings
    .replace(/\r\n/g, "\n");

  // Whitespace handling depends on preserveWhitespace option
  if (preserveWhitespace) {
    // For poetry: preserve all whitespace (vertical and horizontal)
    // Only remove truly excessive blank lines (10+)
    cleaned = cleaned.replace(/\n{11,}/g, "\n\n\n\n\n\n\n\n\n\n");
  } else {
    // For prose: normalize whitespace
    // Preserve meaningful spacing for structured content (up to 4 blank lines)
    cleaned = cleaned.replace(/\n{6,}/g, "\n\n\n\n\n");
  }

  // Process line by line to remove quote wrapping
  cleaned = cleaned
    .split("\n")
    .map(line => {
      // For poetry, preserve leading whitespace (indentation)
      const trimmedLine = preserveWhitespace ? line.trimEnd() : line.trim();
      let l = trimmedLine;

      // Remove surrounding double quotes (straight and curly) from the trimmed content
      const contentToCheck = l.trim();
      if ((contentToCheck.startsWith('"') && contentToCheck.endsWith('"')) ||
          (contentToCheck.startsWith('"') && contentToCheck.endsWith('"')) ||
          (contentToCheck.startsWith("'") && contentToCheck.endsWith("'")) ||
          (contentToCheck.startsWith("'") && contentToCheck.endsWith("'"))) {
        // Only unwrap if it's the whole line content
        if (contentToCheck === l.trim()) {
          const leadingSpace = preserveWhitespace ? l.match(/^\s*/)?.[0] || '' : '';
          l = leadingSpace + contentToCheck.slice(1, -1);
        }
      }
      // Handle lines that are just quotes
      if (l.trim() === '""' || l.trim() === "''" || l.trim() === '""' || l.trim() === "''") {
        return preserveWhitespace ? "" : "";
      }
      return l;
    })
    .filter(line => line.length > 0 || line === "")
    .join("\n");

  // Final cleanup - remove any remaining quote-only lines
  return cleaned
    .split("\n")
    .filter(line => !/^["'"'""'']+$/.test(line.trim()))
    .join("\n")
    .trim();
}

/**
 * Trim leading blank lines from text so first line is content.
 * Preserves all other whitespace (for poetry).
 * Used to ensure each poem starts with actual content, not whitespace gaps.
 */
export function trimLeadingBlankLines(text: string): string {
  const lines = text.split('\n');
  let firstContentIndex = 0;

  // Find first non-empty line
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().length > 0) {
      firstContentIndex = i;
      break;
    }
  }

  return lines.slice(firstContentIndex).join('\n');
}

// ============================================
// Chapter Parsing
// ============================================

/**
 * Parse text into chapters based on common chapter markers.
 * Handles both English and Spanish chapter formats.
 *
 * IMPORTANT: This is a fallback parser. The primary parser is in text-preprocessor.ts.
 * This function discards front matter (text before first chapter marker) unless
 * it looks like substantial content (e.g., a prologue without a marker).
 */
export function parseChaptersFromText(text: string): string[] {
  // Split on common chapter patterns
  const chapterRegex = /(?:^|\n)(?:---\s*)?(?:Chapter|CHAPTER|Capítulo|CAPÍTULO)\s+\d+[^\n]*(?:\s*---)?(?:\n|$)/gi;
  const matches = text.match(chapterRegex);

  if (!matches || matches.length <= 1) {
    // No chapter markers or only one - treat as single chapter
    return [text.trim()];
  }

  // Split by chapter markers
  // parts[0] = text BEFORE first chapter marker (front matter)
  // parts[1] = content after first marker, before second marker
  // parts[2] = content after second marker, etc.
  const parts = text.split(chapterRegex);
  const chapters: string[] = [];

  // FIX: Don't automatically include parts[0] as a chapter
  // parts[0] is typically front matter (title, author, copyright, table of contents)
  // Only include it if it looks like substantial prose content (rare case: prologue without marker)
  const frontMatter = parts[0]?.trim() || '';
  if (frontMatter) {
    // Heuristic: front matter that looks like actual chapter content
    // - Has substantial length (>500 chars)
    // - Has multiple lines of prose (>5 lines with >50 chars each)
    const proseLines = frontMatter.split('\n').filter(l => l.trim().length > 50);
    const looksLikeChapterContent = frontMatter.length > 500 && proseLines.length > 5;

    if (looksLikeChapterContent) {
      // Rare case: content exists before first chapter marker (e.g., unmarked prologue)
      chapters.push(frontMatter);
    }
    // Otherwise: discard front matter (typical case - title, TOC, etc.)
  }

  // Add chapters WITHOUT their headers
  // The chapter markers are used for splitting but should not be in content
  // (headers are metadata, not content - they would get translated incorrectly)
  for (let i = 1; i < parts.length; i++) {
    if (parts[i]?.trim()) {
      chapters.push(parts[i].trim());
    }
  }

  return chapters.length > 0 ? chapters : [text.trim()];
}

/**
 * Split text into sub-chunks for API calls, respecting paragraph and sentence boundaries.
 * @param text The text to split
 * @param maxChars Maximum characters per chunk (defaults to MAX_CHUNK_CHARS)
 * @deprecated Use the shared version from @/lib/story-processing directly
 */
export function splitIntoSubChunks(text: string, maxChars: number = MAX_CHUNK_CHARS): string[] {
  return sharedSplitIntoSubChunks(text, maxChars);
}

// ============================================
// HTML Processing (Client-side only)
// ============================================

export interface HTMLExtractionOptions {
  /** Preserve whitespace typology for poetry (don't collapse newlines) */
  preserveWhitespace?: boolean;
}

/**
 * Extract text from HTML, also extracting sidenotes and footnotes.
 * NOTE: This function uses DOM APIs and only works in browser context.
 *
 * @param html The HTML to extract text from
 * @param options.preserveWhitespace If true, preserve all whitespace (for poetry)
 */
export function extractTextFromHTML(html: string, options: HTMLExtractionOptions = {}): HTMLExtractionResult {
  const { preserveWhitespace = false } = options;
  // Create a temporary DOM parser
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Remove script and style elements
  doc.querySelectorAll("script, style, noscript").forEach(el => el.remove());

  const annotations: ExtractedAnnotation[] = [];
  let annotationIndex = 0;

  // Extract sidenotes (common patterns)
  // Pattern 1: <span class="sidenote">...</span> (Project Gutenberg style)
  doc.querySelectorAll("span.sidenote, .sidenote").forEach(el => {
    const text = el.textContent?.trim() || "";
    if (text) {
      const parent = el.parentElement;
      const nearbyText = parent?.textContent?.slice(0, 100)?.trim() || "";

      annotations.push({
        id: `sidenote-${annotationIndex++}`,
        type: "sidenote",
        text,
        nearbyText,
      });
    }
    el.remove();
  });

  // Pattern 2: <aside>...</aside>
  doc.querySelectorAll("aside").forEach(el => {
    const text = el.textContent?.trim() || "";
    if (text) {
      const parent = el.parentElement;
      const nearbyText = parent?.textContent?.slice(0, 100)?.trim() || "";

      annotations.push({
        id: `aside-${annotationIndex++}`,
        type: "sidenote",
        text,
        nearbyText,
      });
    }
    el.remove();
  });

  // Pattern 3: <span class="note">...</span> or <span class="margin-note">...</span>
  doc.querySelectorAll("span.note, span.margin-note, span.marginal, .marginnote").forEach(el => {
    const text = el.textContent?.trim() || "";
    if (text) {
      const parent = el.parentElement;
      const nearbyText = parent?.textContent?.slice(0, 100)?.trim() || "";

      annotations.push({
        id: `marginal-${annotationIndex++}`,
        type: "marginal",
        text,
        nearbyText,
      });
    }
    el.remove();
  });

  // Extract footnotes
  // Pattern 1: <div class="footnote">...</div> inside <div class="footnotes">
  doc.querySelectorAll(".footnotes .footnote, div.footnote").forEach(el => {
    const text = el.textContent?.trim() || "";
    if (text) {
      annotations.push({
        id: `footnote-${annotationIndex++}`,
        type: "footnote",
        text,
        nearbyText: "",
      });
    }
    el.remove();
  });

  // Pattern 2: <aside class="footnote">...</aside>
  doc.querySelectorAll("aside.footnote").forEach(el => {
    const text = el.textContent?.trim() || "";
    if (text) {
      annotations.push({
        id: `footnote-${annotationIndex++}`,
        type: "footnote",
        text,
        nearbyText: "",
      });
    }
    el.remove();
  });

  // Process nodes to extract text while preserving structure
  // IMPORTANT: For poems, stanza breaks are detected by EMPTY lines (double newlines).
  // In HTML poetry, each verse line is often in its own <p> tag, but they're part of
  // the same stanza. A stanza break is indicated by:
  // - Empty <p> tags
  // - <p> tags containing only whitespace/&nbsp;
  // - Multiple consecutive <br> tags
  //
  // Strategy:
  // - Content <p> tags → single newline (line within stanza)
  // - Empty <p> tags → double newline (stanza break marker)
  // - <br> → single newline
  // - Multiple <br> in sequence → detected later as stanza break
  const processNode = (node: Node, parentIsBlock: boolean = false): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      // CRITICAL: Ignore whitespace-only text nodes between block elements
      // HTML like "</p>\n\n<p>" has text nodes with just newlines between the tags
      // These should NOT be preserved as they create unwanted blank lines
      if (parentIsBlock && /^\s*$/.test(text)) {
        return "";
      }
      return text;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tagName = el.tagName.toLowerCase();

      // Block elements that should have line breaks
      const lineBreakElements = ["h1", "h2", "h3", "h4", "h5", "h6", "li", "tr"];
      const isLineBreak = lineBreakElements.includes(tagName);

      // Paragraph-like elements need special handling
      const paragraphElements = ["p", "div", "blockquote", "pre"];
      const isParagraph = paragraphElements.includes(tagName);

      // Block elements where whitespace text nodes should be ignored
      const blockElements = ["body", "div", "section", "article", "main", "header", "footer", ...paragraphElements, ...lineBreakElements];
      const isBlock = blockElements.includes(tagName);

      let content = "";
      el.childNodes.forEach(child => {
        content += processNode(child, isBlock);
      });

      if (tagName === "br") {
        return "\n";
      }

      // For paragraph elements, check if they have actual content
      // Note: content might just be "\n" from <br> tags - that's not real content
      const trimmedContent = content.replace(/\n/g, '').trim();

      if (isParagraph) {
        if (!trimmedContent) {
          // Empty paragraph (or paragraph with only <br> tags)
          // In Gutenberg HTML, single empty <p><br/></p> is used for visual spacing between lines
          // A real stanza break has TWO or more consecutive empty paragraphs
          // So: single empty = \n, multiple consecutive empties = \n\n (stanza break after collapse)
          return "\n";
        }
        // Content paragraph = single line (NOT stanza break)
        // This preserves poetry where each line is in its own <p>
        return trimmedContent + "\n";
      }

      // Headers and list items get single newlines
      if (isLineBreak && trimmedContent) {
        return "\n" + trimmedContent + "\n";
      }

      return content;
    }

    return "";
  };

  let text = processNode(doc.body, true);  // body is a block element

  // DEBUG: Log consecutive blank line runs in extracted text
  if (preserveWhitespace) {
    const lines = text.split('\n').slice(0, 50);
    const consecutiveBlankRuns: number[] = [];
    let currentRun = 0;
    for (const line of lines) {
      if (line.trim() === '') {
        currentRun++;
      } else {
        if (currentRun > 0) consecutiveBlankRuns.push(currentRun);
        currentRun = 0;
      }
    }
    if (currentRun > 0) consecutiveBlankRuns.push(currentRun);
    console.log(`[extractTextFromHTML] DEBUG - Consecutive blank runs in first 50 lines: [${consecutiveBlankRuns.join(', ')}]`);
    console.log(`[extractTextFromHTML] First 20 lines sample:`);
    lines.slice(0, 20).forEach((l, i) => {
      const display = l.trim() === '' ? '(blank)' : l.slice(0, 50);
      console.log(`  ${i}: ${display}`);
    });
  }

  // Clean up whitespace - behavior depends on preserveWhitespace option
  if (preserveWhitespace) {
    // For poetry: preserve ALL whitespace exactly
    // Only do minimal cleanup (remove trailing spaces, excessive blank lines 10+)
    text = text
      .replace(/[ \t]+$/gm, "")          // Remove trailing horizontal whitespace from lines
      .replace(/\n{11,}/g, "\n\n\n\n\n\n\n\n\n\n")  // Only collapse 10+ blank lines
      .trim();
  } else {
    // For prose: normalize whitespace while preserving meaningful spacing
    //
    // After processNode:
    // - Content paragraph: "text\n"
    // - Empty paragraph: "\n"
    //
    // Preserve hierarchical spacing:
    // - 1 blank line (\n\n) = stanza break
    // - 2 blank lines (\n\n\n) = poem separation
    // - 3+ blank lines (\n\n\n\n+) = section/collection separation
    //
    // Strategy: Use placeholders to preserve different spacing levels during collapsing
    const SECTION_BREAK_MARKER = "\x00SECTION\x00";  // 4+ blank lines → section break
    const POEM_BREAK_MARKER = "\x00POEM\x00";        // 3 blank lines → poem break
    const STANZA_BREAK_MARKER = "\x00STANZA\x00";    // 2 blank lines → stanza break
    text = text
      .replace(/[ \t]+/g, " ")             // Collapse horizontal whitespace
      .replace(/\n /g, "\n")               // Remove space after newline
      .replace(/ \n/g, "\n")               // Remove space before newline
      .replace(/\n{5,}/g, SECTION_BREAK_MARKER)  // 5+ newlines (4+ blank lines) = section break
      .replace(/\n{4}/g, POEM_BREAK_MARKER)      // 4 newlines (3 blank lines) = poem break
      .replace(/\n{3}/g, STANZA_BREAK_MARKER)    // 3 newlines (2 blank lines) = stanza break
      .replace(/\n+/g, "\n")               // Collapse remaining newlines to 1
      .replace(new RegExp(SECTION_BREAK_MARKER, 'g'), "\n\n\n\n")  // Restore section breaks (3 blank lines)
      .replace(new RegExp(POEM_BREAK_MARKER, 'g'), "\n\n\n")       // Restore poem breaks (2 blank lines)
      .replace(new RegExp(STANZA_BREAK_MARKER, 'g'), "\n\n")       // Restore stanza breaks (1 blank line)
      .trim();
  }

  return { text, annotations };
}

/**
 * Basic RTF to plain text conversion.
 * Strips RTF control codes for a simplified text extraction.
 */
export function stripRTF(text: string): string {
  return text
    .replace(/\{\\[^{}]+\}/g, "")     // Remove control groups
    .replace(/\\[a-z]+\d*\s?/gi, "")  // Remove control words
    .replace(/[{}]/g, "")              // Remove remaining braces
    .replace(/\\'[0-9a-f]{2}/gi, "")  // Remove hex characters
    .trim();
}

// ============================================
// File Validation
// Re-exports from shared library for backward compatibility
// ============================================

/** Supported file types for story upload */
export const SUPPORTED_FILE_TYPES = SHARED_SUPPORTED_FILE_TYPES;

/**
 * Check if a file is an accepted type for story upload.
 * @deprecated Use the shared version from @/lib/story-processing directly
 */
export function isAcceptedFile(file: File): boolean {
  return sharedIsAcceptedFile(file);
}

/**
 * Detect file type from filename or MIME type.
 * @deprecated Use the shared version from @/lib/story-processing directly
 */
export function detectFileType(file: File): "text" | "html" | "rtf" | "markdown" | "unknown" {
  return sharedDetectFileType(file);
}
