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

/**
 * Clean text by removing AI artifacts, markdown formatting, and normalizing.
 * This is the single source of truth for text cleaning across the pipeline.
 */
export function cleanText(text: string): string {
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
    // Normalize whitespace
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");

  // Process line by line to remove quote wrapping
  cleaned = cleaned
    .split("\n")
    .map(line => {
      let l = line.trim();
      // Remove surrounding double quotes (straight and curly)
      if ((l.startsWith('"') && l.endsWith('"')) ||
          (l.startsWith('"') && l.endsWith('"')) ||
          (l.startsWith("'") && l.endsWith("'")) ||
          (l.startsWith("'") && l.endsWith("'"))) {
        l = l.slice(1, -1);
      }
      // Handle lines that are just quotes
      if (l === '""' || l === "''" || l === '""' || l === "''") {
        return "";
      }
      return l;
    })
    .filter(line => line.length > 0 || line === "")
    .join("\n");

  // Final trim and remove any remaining quote-only lines
  return cleaned
    .split("\n")
    .filter(line => !/^["'"'""'']+$/.test(line.trim()))
    .join("\n")
    .trim();
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

  // Add chapters with their headers
  // matches[i-1] is the header for parts[i]
  for (let i = 1; i < parts.length; i++) {
    if (parts[i]?.trim()) {
      const header = matches[i - 1]?.trim() || '';
      chapters.push((header + '\n\n' + parts[i]).trim());
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

/**
 * Extract text from HTML, also extracting sidenotes and footnotes.
 * NOTE: This function uses DOM APIs and only works in browser context.
 */
export function extractTextFromHTML(html: string): HTMLExtractionResult {
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
  // IMPORTANT: For poems and other formatted text, we need DOUBLE newlines between
  // block elements (paragraphs) to preserve stanza breaks. The stanza detection
  // algorithm in text-preprocessor.ts looks for empty lines (double newlines) to
  // identify stanza boundaries.
  const processNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || "";
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tagName = el.tagName.toLowerCase();

      // Block elements that should have paragraph breaks (double newline)
      // These represent semantic paragraph boundaries in HTML
      const paragraphElements = ["p", "div", "blockquote", "pre"];
      const isParagraph = paragraphElements.includes(tagName);

      // Other block elements that should have single line breaks
      const lineBreakElements = ["h1", "h2", "h3", "h4", "h5", "h6", "li", "tr"];
      const isLineBreak = lineBreakElements.includes(tagName);

      let content = "";
      el.childNodes.forEach(child => {
        content += processNode(child);
      });

      if (tagName === "br") {
        return "\n";
      }

      // Paragraph elements get double newlines to preserve stanza/paragraph structure
      if (isParagraph && content.trim()) {
        return "\n\n" + content.trim() + "\n\n";
      }

      // Headers and list items get single newlines
      if (isLineBreak && content.trim()) {
        return "\n" + content.trim() + "\n";
      }

      return content;
    }

    return "";
  };

  let text = processNode(doc.body);

  // Clean up excessive whitespace while preserving paragraph/stanza breaks
  // IMPORTANT: We keep double newlines (\n\n) intact - these represent stanza
  // boundaries in poems. Only collapse 3+ newlines down to 2.
  text = text
    .replace(/\n{3,}/g, "\n\n")  // Collapse 3+ newlines to exactly 2 (preserve stanza breaks)
    .replace(/[ \t]+/g, " ")     // Collapse horizontal whitespace
    .replace(/\n /g, "\n")       // Remove space after newline
    .replace(/ \n/g, "\n")       // Remove space before newline
    .trim();

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
