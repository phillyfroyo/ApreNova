// src/lib/story-processing/text-processors.ts
// Shared processing registry for file processing algorithms
// Used by BOTH the upload pipeline AND the Dev Tools SU TP Algorithms testing system
//
// This is the SINGLE SOURCE OF TRUTH for file processing.
// Any changes here affect both the production upload flow and the testing system.

import { preprocessText, type PreprocessedText } from "@/lib/admin/text-preprocessor";

// ============================================================================
// Types
// ============================================================================

export type FileType = "html" | "txt" | "rtf" | "md";
export type StoryType = "anthology" | "prose" | "epic" | "script";

export interface ExtractionStats {
  originalLength: number;
  extractedLength: number;
  annotationsExtracted?: number;
}

export interface ProcessingResult {
  // Step 1: File-type specific extraction
  extractedText: string;
  extractionStats: ExtractionStats;

  // Step 2: Preprocessing result (chapters, structure detection, cleanup)
  preprocessed: PreprocessedText;

  // Any errors encountered
  errors: string[];

  // Processing metadata
  processedAt: string; // ISO timestamp
}

// ============================================================================
// HTML Processing (Server-side compatible)
// ============================================================================

/**
 * Extract text from HTML using a DOM parser.
 * This is a server-compatible version that works in Node.js.
 *
 * @param html - Raw HTML content
 * @param preserveWhitespace - If true, preserve whitespace for poetry
 */
function extractTextFromHTMLServer(
  html: string,
  preserveWhitespace: boolean = false
): { text: string; annotationsCount: number } {
  // Use JSDOM-like parsing approach with regex for server-side
  // This mirrors the logic from text-utils.ts extractTextFromHTML

  let text = html;
  let annotationsCount = 0;

  // Remove script and style elements
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

  // Remove TOC tables (tables with many internal links)
  // This is a simplified version - full implementation would parse DOM
  text = text.replace(/<table[^>]*class="[^"]*toc[^"]*"[^>]*>[\s\S]*?<\/table>/gi, "");
  text = text.replace(/<table[^>]*id="[^"]*toc[^"]*"[^>]*>[\s\S]*?<\/table>/gi, "");
  text = text.replace(/<div[^>]*class="[^"]*toc[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");
  text = text.replace(/<div[^>]*id="[^"]*contents[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");

  // Extract and count sidenotes/annotations (then remove them)
  const sidenoteMatches = text.match(/<span[^>]*class="[^"]*sidenote[^"]*"[^>]*>[\s\S]*?<\/span>/gi) || [];
  const asideMatches = text.match(/<aside[^>]*>[\s\S]*?<\/aside>/gi) || [];
  const footnoteMatches = text.match(/<div[^>]*class="[^"]*footnote[^"]*"[^>]*>[\s\S]*?<\/div>/gi) || [];
  annotationsCount = sidenoteMatches.length + asideMatches.length + footnoteMatches.length;

  // Remove annotations
  text = text.replace(/<span[^>]*class="[^"]*sidenote[^"]*"[^>]*>[\s\S]*?<\/span>/gi, "");
  text = text.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "");
  text = text.replace(/<div[^>]*class="[^"]*footnote[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");

  // Handle PRE tags - preserve their content with newlines
  text = text.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, content) => {
    // Strip any nested tags but preserve whitespace
    const stripped = content.replace(/<[^>]+>/g, "");
    return "\n\n" + stripped + "\n\n";
  });

  // Convert headers to have blank lines before/after
  text = text.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_, content) => {
    const stripped = content.replace(/<[^>]+>/g, "").trim();
    return "\n\n" + stripped + "\n\n";
  });

  // Convert paragraph tags
  text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, content) => {
    const stripped = content.replace(/<[^>]+>/g, "").trim();
    return stripped ? stripped + "\n" : "\n";
  });

  // Convert br tags to newlines
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // Convert list items
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, content) => {
    const stripped = content.replace(/<[^>]+>/g, "").trim();
    return "\n" + stripped + "\n";
  });

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&rdquo;/gi, '"')
    .replace(/&ldquo;/gi, '"')
    .replace(/&#\d+;/g, (match) => {
      const code = parseInt(match.slice(2, -1));
      return String.fromCharCode(code);
    });

  // Normalize whitespace
  if (preserveWhitespace) {
    // For poetry: preserve vertical spacing, only remove trailing whitespace
    text = text
      .replace(/[ \t]+$/gm, "")
      .replace(/\n{11,}/g, "\n\n\n\n\n\n\n\n\n\n")
      .trim();
  } else {
    // For prose: normalize whitespace
    text = text
      .replace(/[ \t]+/g, " ")
      .replace(/\n /g, "\n")
      .replace(/ \n/g, "\n")
      .replace(/\n{5,}/g, "\n\n\n\n")
      .replace(/\n{3,4}/g, "\n\n")
      .trim();
  }

  return { text, annotationsCount };
}

// ============================================================================
// RTF Processing
// ============================================================================

/**
 * Basic RTF to plain text conversion.
 * Strips RTF control codes for simplified text extraction.
 */
function stripRTF(text: string): string {
  return text
    .replace(/\{\\[^{}]+\}/g, "") // Remove control groups
    .replace(/\\[a-z]+\d*\s?/gi, "") // Remove control words
    .replace(/[{}]/g, "") // Remove remaining braces
    .replace(/\\'[0-9a-f]{2}/gi, "") // Remove hex characters
    .trim();
}

// ============================================================================
// Main Processing Function
// ============================================================================

/**
 * Process a file through the full text processing pipeline.
 *
 * This function is the SINGLE SOURCE OF TRUTH for file processing.
 * It is used by:
 * 1. The production upload pipeline (story uploads)
 * 2. The Dev Tools SU TP Algorithms testing system
 *
 * @param rawContent - Raw file content (string)
 * @param fileType - File type (html, txt, rtf, md)
 * @param storyType - Story type (anthology, prose, epic, script)
 * @returns ProcessingResult with extracted text, preprocessed content, and stats
 */
export function processFile(
  rawContent: string,
  fileType: FileType,
  storyType: StoryType
): ProcessingResult {
  const errors: string[] = [];
  const originalLength = rawContent.length;

  // Step 1: File-type specific extraction
  let extractedText = rawContent;
  let annotationsExtracted = 0;

  try {
    if (fileType === "html") {
      const preserveWhitespace = storyType === "anthology" || storyType === "epic";
      const result = extractTextFromHTMLServer(rawContent, preserveWhitespace);
      extractedText = result.text;
      annotationsExtracted = result.annotationsCount;
    } else if (fileType === "rtf") {
      extractedText = stripRTF(rawContent);
    }
    // For txt and md, rawContent is already the extracted text
  } catch (err) {
    errors.push(`Extraction error: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Step 2: Preprocessing (chapters, structure detection, cleanup)
  let preprocessed: PreprocessedText;
  try {
    preprocessed = preprocessText(extractedText, { structureType: storyType });
  } catch (err) {
    errors.push(`Preprocessing error: ${err instanceof Error ? err.message : String(err)}`);
    // Return a minimal preprocessed result on error
    preprocessed = {
      frontMatter: "",
      backMatter: "",
      chapters: [{
        number: 1,
        title: "Full Text",
        rawText: extractedText,
        startLine: 0,
        endLine: extractedText.split("\n").length - 1,
      }],
      stats: {
        originalLength,
        cleanedLength: extractedText.length,
        lineNumbersRemoved: 0,
        pageMarkersRemoved: 0,
        footnoteIndicatorsRemoved: 0,
        asteriskDividersRemoved: 0,
        chaptersDetected: 1,
        backMatterRemoved: false,
        lineBreakStyle: "intentional",
        structureType: storyType,
      },
      cleanedFullText: extractedText,
    };
  }

  return {
    extractedText,
    extractionStats: {
      originalLength,
      extractedLength: extractedText.length,
      annotationsExtracted: annotationsExtracted > 0 ? annotationsExtracted : undefined,
    },
    preprocessed,
    errors,
    processedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Utility Exports
// ============================================================================

/**
 * Get a human-readable label for a file type
 */
export function getFileTypeLabel(fileType: FileType): string {
  const labels: Record<FileType, string> = {
    html: "HTML",
    txt: "Plain Text",
    rtf: "Rich Text",
    md: "Markdown",
  };
  return labels[fileType] || fileType.toUpperCase();
}

/**
 * Get a human-readable label for a story type
 */
export function getStoryTypeLabel(storyType: StoryType): string {
  const labels: Record<StoryType, string> = {
    anthology: "Anthology (Poetry)",
    prose: "Prose (Novel/Short Story)",
    epic: "Epic (Narrative Poetry)",
    script: "Script (Screenplay/Transcript)",
  };
  return labels[storyType] || storyType.charAt(0).toUpperCase() + storyType.slice(1);
}

/**
 * All valid file types
 */
export const FILE_TYPES: FileType[] = ["html", "txt", "rtf", "md"];

/**
 * All valid story types
 */
export const STORY_TYPES: StoryType[] = ["anthology", "prose", "epic", "script"];
