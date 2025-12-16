// src/lib/admin/text-utils.ts
// Consolidated text processing utilities for the admin upload pipeline

import { MAX_CHUNK_CHARS } from "@/app/admin/upload-story/config/constants";

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
  const parts = text.split(chapterRegex);
  const chapters: string[] = [];

  // First part might be front matter or first chapter
  if (parts[0]?.trim()) {
    chapters.push(parts[0].trim());
  }

  // Add remaining chapters with their headers
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
 */
export function splitIntoSubChunks(text: string, maxChars: number = MAX_CHUNK_CHARS): string[] {
  if (text.length <= maxChars) return [text];

  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    if (currentChunk.length + para.length + 2 > maxChars) {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = para;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + para;
    }
  }

  if (currentChunk) chunks.push(currentChunk.trim());

  // If any chunk is still too large, split by sentences
  const result: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= maxChars) {
      result.push(chunk);
    } else {
      // Split by sentence
      const sentences = chunk.split(/(?<=[.!?])\s+/);
      let sentenceChunk = "";
      for (const sentence of sentences) {
        if (sentenceChunk.length + sentence.length + 1 > maxChars) {
          if (sentenceChunk) result.push(sentenceChunk.trim());
          sentenceChunk = sentence;
        } else {
          sentenceChunk += (sentenceChunk ? " " : "") + sentence;
        }
      }
      if (sentenceChunk) result.push(sentenceChunk.trim());
    }
  }

  return result;
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
  const processNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || "";
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tagName = el.tagName.toLowerCase();

      // Block elements that should have line breaks
      const blockElements = ["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "br", "tr", "blockquote", "pre"];
      const isBlock = blockElements.includes(tagName);

      let content = "";
      el.childNodes.forEach(child => {
        content += processNode(child);
      });

      if (tagName === "br") {
        return "\n";
      }

      if (isBlock && content.trim()) {
        return "\n" + content.trim() + "\n";
      }

      return content;
    }

    return "";
  };

  let text = processNode(doc.body);

  // Clean up excessive whitespace while preserving paragraph breaks
  text = text
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n /g, "\n")
    .replace(/ \n/g, "\n")
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
// ============================================

/** Supported file types for story upload */
export const SUPPORTED_FILE_TYPES = [
  { ext: ".txt", mime: "text/plain", label: "Plain Text" },
  { ext: ".html", mime: "text/html", label: "HTML" },
  { ext: ".htm", mime: "text/html", label: "HTML" },
  { ext: ".md", mime: "text/markdown", label: "Markdown" },
  { ext: ".rtf", mime: "application/rtf", label: "Rich Text" },
] as const;

/**
 * Check if a file is an accepted type for story upload.
 */
export function isAcceptedFile(file: File): boolean {
  const fileName = file.name.toLowerCase();
  return SUPPORTED_FILE_TYPES.some(
    type => fileName.endsWith(type.ext) || file.type === type.mime
  );
}

/**
 * Detect file type from filename or MIME type.
 */
export function detectFileType(file: File): "text" | "html" | "rtf" | "markdown" | "unknown" {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".html") || fileName.endsWith(".htm") || file.type === "text/html") {
    return "html";
  }
  if (fileName.endsWith(".rtf") || file.type === "application/rtf") {
    return "rtf";
  }
  if (fileName.endsWith(".md") || file.type === "text/markdown") {
    return "markdown";
  }
  if (fileName.endsWith(".txt") || file.type === "text/plain") {
    return "text";
  }

  return "unknown";
}
