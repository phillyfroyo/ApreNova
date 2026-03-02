// src/lib/text-processing/index.ts
// UNIFIED TEXT PROCESSING MODULE
//
// This module is the SINGLE SOURCE OF TRUTH for text processing.
// It is used by:
// 1. Admin uploads (upload-story pipeline)
// 2. User uploads (UploadStoryModal)
// 3. Dev Tools (algorithm testing system)
//
// Processing Flow:
// 1. File Extraction: Raw file → Plain text (file-extractors/)
// 2. Content Processing: Plain text → Structured chapters (content-processors/)

import type {
  FileType,
  ContentType,
  ProcessingOptions,
  ProcessingResult,
  PreprocessedText,
  ExtractionResult,
  ExtractedAnnotation,
} from './types';

import {
  extractText,
  detectFileType,
  detectFileTypeFromName,
  detectFileTypeFromMime,
  isAcceptedFile,
  SUPPORTED_FILE_TYPES,
} from './file-extractors';

import {
  processContent,
  detectContentType,
  getStructureAnalysis,
  getContentTypeLabel,
  CONTENT_TYPES,
} from './content-processors';

// ============================================================================
// RE-EXPORTS - Types
// ============================================================================

export type {
  FileType,
  ContentType,
  ProcessingOptions,
  ProcessingResult,
  PreprocessedText,
  ExtractionResult,
  ExtractedAnnotation,
  DetectedChapter,
  LineBreakStyle,
  StructureAnalysis,
  ChapterMarker,
  ParsedScriptLine,
  EditorialNote,
  ExtractionOptions,
} from './types';

// ============================================================================
// RE-EXPORTS - File Extractors
// ============================================================================

export {
  // Main router
  extractText,
  // Individual extractors
  extractTextFromHTML,
  extractTextFromHTMLServer,
  extractTextFromRTF,
  stripRTF,
  extractTextFromTxt,
  extractTextFromMd,
  // File type detection
  detectFileType,
  detectFileTypeFromName,
  detectFileTypeFromMime,
  // Validation
  isAcceptedFile,
  SUPPORTED_FILE_TYPES,
} from './file-extractors';

// ============================================================================
// RE-EXPORTS - Content Processors
// ============================================================================

export {
  // Main router
  processContent,
  // Individual processors
  preprocessAnthology,
  preprocessProse,
  preprocessEpic,
  preprocessScript,
  // Content type detection
  detectContentType,
  getStructureAnalysis,
  analyzeContentStructure,
  // Script parsing
  parseScriptLine,
  extractSpeakerNames,
  // Editorial notes
  detectEditorialNotes,
  // Poem detection (SINGLE SOURCE OF TRUTH - used by pagination and Dev Tools)
  countPoems,
  detectPoemBoundaries,
  isPoemTitleLine,
  type DetectedPoem,
  // Labels
  getContentTypeLabel,
  CONTENT_TYPES,
} from './content-processors';

// ============================================================================
// RE-EXPORTS - Shared Utilities
// ============================================================================

export {
  // Whitespace
  detectLineBreakStyle,
  normalizeLineBreaks,
  normalizeWhitespace,
  normalizeWhitespacePreserveIndent,
  getLineBreakStyleDescription,
} from './shared/whitespace';

export {
  // Cleanup
  removeLineNumbers,
  removePageMarkers,
  removeFootnoteIndicators,
  removeAsteriskDividers,
  runAllCleanup,
} from './shared/cleanup';

export {
  // Gutenberg
  extractFrontMatter,
  removeGutenbergFrontMatter,
  detectBackMatterStart,
  extractBackMatter,
} from './shared/gutenberg';

export type { FrontMatterResult } from './shared/gutenberg';

export {
  // Chapter detection
  detectThematicSectionMarkers,
  detectChapterMarkers,
  filterOutTOCMarkers,
  splitIntoChapters,
  extractPreChapterText,
} from './shared/chapter-detection';

export {
  // Section detection (anthology thematic sections like "I. LIFE.")
  detectSectionBoundaries,
  type DetectedSection,
} from './shared/section-detection';

export {
  // Anthology pagination (poem-aware pagination with poem tracking)
  paginateAnthologyPoems,
  ANTHOLOGY_MAX_LINES_PER_PAGE,
  type AnthologyPaginationResult,
} from './shared/anthology-pagination';

// Re-export poem detection patterns for consumers that need them directly
export {
  POEM_TITLE_PATTERN,
  NUMBERED_POEM_PATTERN,
  SECTION_HEADER_PATTERN,
  isSectionHeader,
} from './shared/poem-detection';

// Re-export types from types.ts that are used by pagination
export type { PoemInfo, LineMetadata } from './types';

// ============================================================================
// MAIN PROCESSING FUNCTION
// ============================================================================

/**
 * Process a file through the full text processing pipeline.
 *
 * This function is the SINGLE SOURCE OF TRUTH for file processing.
 * It is used by:
 * 1. The production upload pipeline (admin and user story uploads)
 * 2. The Dev Tools SU TP Algorithms testing system
 *
 * Processing Flow:
 * 1. File type detection (if not specified)
 * 2. File extraction (HTML, RTF, TXT, MD → plain text)
 * 3. Content type detection (if not specified)
 * 4. Content processing (cleaning, chapter detection, etc.)
 *
 * @param rawContent - Raw file content (string)
 * @param options - Processing options
 * @returns ProcessingResult with extracted text, preprocessed content, and stats
 */
export function processText(
  rawContent: string,
  options: ProcessingOptions = {}
): ProcessingResult {
  const errors: string[] = [];
  const originalLength = rawContent.length;

  // Step 1: Determine file type
  const fileType: FileType = options.fileType || 'txt';

  // Step 2: Determine if we should preserve whitespace
  // For poetry types, we need to preserve whitespace during extraction
  const contentTypeHint = options.contentType;
  const preserveWhitespace = options.preserveWhitespace ??
    (contentTypeHint === 'anthology' || contentTypeHint === 'epic');

  // Step 3: Extract text from file
  let extractionResult: ExtractionResult;
  try {
    extractionResult = extractText(rawContent, fileType, { preserveWhitespace });
  } catch (err) {
    errors.push(`Extraction error: ${err instanceof Error ? err.message : String(err)}`);
    extractionResult = {
      text: rawContent,
      annotations: [],
      stats: {
        originalLength,
        extractedLength: rawContent.length,
        annotationsExtracted: 0,
      },
    };
  }

  // Step 4: Detect or use specified content type
  let detectedContentType: ContentType;
  if (contentTypeHint && contentTypeHint !== 'auto') {
    detectedContentType = contentTypeHint;
  } else {
    detectedContentType = detectContentType(extractionResult.text);
  }

  // Step 5: Process content
  let preprocessed: PreprocessedText;
  try {
    preprocessed = processContent(extractionResult.text, detectedContentType);
  } catch (err) {
    errors.push(`Preprocessing error: ${err instanceof Error ? err.message : String(err)}`);
    // Return minimal preprocessed result on error
    preprocessed = {
      frontMatter: '',
      backMatter: '',
      chapters: [{
        number: 1,
        title: 'Full Text',
        rawText: extractionResult.text,
        startLine: 0,
        endLine: extractionResult.text.split('\n').length - 1,
      }],
      stats: {
        originalLength,
        cleanedLength: extractionResult.text.length,
        lineNumbersRemoved: 0,
        pageMarkersRemoved: 0,
        footnoteIndicatorsRemoved: 0,
        asteriskDividersRemoved: 0,
        chaptersDetected: 1,
        backMatterRemoved: false,
        lineBreakStyle: 'intentional',
        structureType: detectedContentType,
      },
      cleanedFullText: extractionResult.text,
    };
  }

  return {
    extractedText: extractionResult.text,
    extractionStats: {
      originalLength: extractionResult.stats.originalLength,
      extractedLength: extractionResult.stats.extractedLength,
      annotationsExtracted: extractionResult.stats.annotationsExtracted > 0
        ? extractionResult.stats.annotationsExtracted
        : undefined,
    },
    preprocessed,
    detectedContentType,
    annotations: extractionResult.annotations,
    errors,
    processedAt: new Date().toISOString(),
  };
}

/**
 * Alias for backward compatibility with existing code
 * @deprecated Use processText instead
 */
export function processFile(
  rawContent: string,
  fileType: FileType,
  storyType: ContentType
): ProcessingResult {
  return processText(rawContent, {
    fileType,
    contentType: storyType,
  });
}

// ============================================================================
// FILE TYPE LABELS
// ============================================================================

/**
 * Get human-readable label for file type
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
 * All valid file types
 */
export const FILE_TYPES: FileType[] = ["html", "txt", "rtf", "md"];

/**
 * All valid story/content types (alias for CONTENT_TYPES)
 */
export const STORY_TYPES = CONTENT_TYPES;

/**
 * Alias for backward compatibility
 */
export type StoryType = ContentType;
