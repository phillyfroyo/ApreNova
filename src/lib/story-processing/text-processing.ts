// src/lib/story-processing/text-processing.ts
// Shared text processing utilities for stories
// Used by both admin and user story pipelines
//
// NOTE: This file is now a THIN WRAPPER that re-exports from the unified
// text-processing module. All algorithms live in src/lib/text-processing/.

// ============================================================================
// IMPORTS FOR LOCAL USE
// These are imported for use within this file's remaining functions
// ============================================================================
import {
  type PoemInfo,
  type LineMetadata,
  paginateAnthologyPoems,
} from "@/lib/text-processing";

// ============================================================================
// RE-EXPORTS FROM UNIFIED TEXT-PROCESSING MODULE
// All algorithms now live in @/lib/text-processing/ - this file is a thin wrapper
// This is now the SINGLE SOURCE OF TRUTH for text processing
// ============================================================================
export {
  // Main processing function
  processText,
  processFile, // Deprecated alias for backward compatibility
  // Types
  type FileType,
  type ContentType,
  type ProcessingOptions,
  type ProcessingResult,
  type PreprocessedText,
  type ExtractionResult,
  type ExtractedAnnotation,
  type DetectedChapter,
  type LineBreakStyle,
  type StructureAnalysis,
  // File extractors
  extractText,
  extractTextFromHTML,
  extractTextFromHTMLServer,
  extractTextFromRTF,
  stripRTF,
  extractTextFromTxt,
  extractTextFromMd,
  detectFileType,
  detectFileTypeFromName,
  detectFileTypeFromMime,
  isAcceptedFile,
  SUPPORTED_FILE_TYPES,
  // Content processors
  processContent,
  preprocessAnthology,
  preprocessProse,
  preprocessEpic,
  preprocessScript,
  detectContentType,
  getStructureAnalysis,
  analyzeContentStructure,
  parseScriptLine,
  extractSpeakerNames,
  detectEditorialNotes,
  getContentTypeLabel,
  CONTENT_TYPES,
  // Shared utilities
  detectLineBreakStyle,
  normalizeLineBreaks,
  normalizeWhitespace,
  normalizeWhitespacePreserveIndent,
  getLineBreakStyleDescription,
  removeLineNumbers,
  removePageMarkers,
  removeFootnoteIndicators,
  removeAsteriskDividers,
  runAllCleanup,
  removeGutenbergFrontMatter,
  detectBackMatterStart,
  extractBackMatter,
  detectThematicSectionMarkers,
  detectChapterMarkers,
  filterOutTOCMarkers,
  splitIntoChapters,
  extractPreChapterText,
  extractFrontMatter,  // Gutenberg front matter extraction
  getFileTypeLabel,
  FILE_TYPES,
  STORY_TYPES,
  type StoryType,
  type ParsedScriptLine,
  type ChapterMarker,
  type EditorialNote,
  type ExtractionOptions,
  // Poem detection (SINGLE SOURCE OF TRUTH)
  detectPoemBoundaries,
  isPoemTitleLine,
  isSectionHeader,
  countPoems,
  type DetectedPoem,
  POEM_TITLE_PATTERN,
  NUMBERED_POEM_PATTERN,
  SECTION_HEADER_PATTERN,
  // Section detection
  detectSectionBoundaries,
  type DetectedSection,
  // Anthology pagination
  paginateAnthologyPoems,
  type AnthologyPaginationResult,
  ANTHOLOGY_MAX_LINES_PER_PAGE,
  // Types
  type PoemInfo,
  type LineMetadata,
} from "@/lib/text-processing";

// ============================================================================
// LEGACY: Re-exports from admin modules for backward compatibility
// These are now deprecated - use the unified text-processing module instead
// ============================================================================
export {
  preprocessText,
  quickClean,
} from "@/lib/admin/text-preprocessor";

export { cleanText, parseChaptersFromText, collapseConsecutiveBlanks } from "@/lib/admin/text-utils";

// NEW: Stanza detection from the canonical poem-processing module
// This is THE single source of truth for all stanza detection
export {
  detectStanzas,
  toMetadataMap,
  toTextLines,
  groupLinesIntoStanzas,
  type StanzaDetectionResult,
  type AnnotatedPoemLine,
  type StanzaDetectorConfig,
  type PoemLineMetadata,
  type PoemLineMetadataMap,
} from "@/lib/poem-processing";

// Legacy type alias for backward compatibility
// New code should use AnnotatedPoemLine from poem-processing
export type { AnnotatedPoemLine as StanzaMarkedLine } from "@/lib/poem-processing";

// ============================================================================
// CONTENT STRUCTURE TYPES
// Matches existing story content.ts file format
// ============================================================================

export interface StoryLine {
  es: string;
  en: string;
  // Poem support
  stanzaNumber?: number;        // Which stanza this line belongs to (1-based)
  isStanzaBreak?: boolean;      // True for empty lines between stanzas (renders as visual break)
  // Script support
  speaker?: string;             // Speaker name e.g. "WALTER" - NOT translated
  speakerAnnotation?: string;   // e.g. "(V.O.)", "(O.S.)", "(CONT'D)" - NOT translated
  stageDirection?: string;      // e.g. "sighs", "He exits" - original language (for TTS)
  stageDirectionEs?: string;    // Translated stage direction for Spanish display
  stageDirectionEn?: string;    // Translated stage direction for English display
  isStageDirectionOnly?: boolean; // True if line is ONLY a stage direction (no dialogue)
  // Editorial note support (for poetry anthologies)
  isEditorialNote?: boolean;    // True for editorial notes - render in italics, not rewritten
}

export interface PageContent {
  lines?: StoryLine[];           // For prose: flat array of lines
  stanzas?: StoryLine[][];       // For poems: nested array where each inner array is a stanza
  // Anthology poem tracking (which poem this page belongs to)
  poemNumber?: number;           // 1-based poem number within the collection
  poemTitle?: string;            // Poem title (e.g., "SUCCESS.", "I.")
  isFirstPageOfPoem?: boolean;   // True if this is the first page of a poem
  isContinuation?: boolean;      // True if poem continues from previous page
}

// NOTE: PoemInfo is now imported and re-exported from @/lib/text-processing

// Type guard to check if content has stanzas (poem) or lines (prose)
export function hasStanzas(content: PageContent): content is PageContent & { stanzas: StoryLine[][] } {
  return Array.isArray(content.stanzas) && content.stanzas.length > 0;
}

// Flatten stanzas to lines for backward compatibility
export function flattenStanzas(stanzas: StoryLine[][]): StoryLine[] {
  const lines: StoryLine[] = [];
  stanzas.forEach((stanza, stanzaIdx) => {
    stanza.forEach(line => lines.push(line));
    // Add stanza break marker after each stanza except the last
    if (stanzaIdx < stanzas.length - 1) {
      lines.push({ es: '', en: '', isStanzaBreak: true });
    }
  });
  return lines;
}

// ============================================================================
// CHAPTER METADATA TYPES
// ============================================================================

export interface ChapterMetadata {
  number: number;
  title: string;
  subtitle?: string;
}

export interface ParsedChapter {
  text: string;
  metadata: ChapterMetadata;
}

export interface ChapterContent {
  pages: Record<number, PageContent>;
  metadata?: ChapterMetadata; // Optional for backward compatibility with existing stories
  // Anthology-specific: list of poems in this collection for navigation
  poems?: PoemInfo[];
  // Alignment check results (persisted in content JSON)
  alignmentIssues?: import("@/lib/user-stories/alignment-check").ChapterAlignmentResult;
}

export interface LevelContent {
  storySlug: string;
  level: number;
  hasChapters: boolean;
  chapters: Record<number, ChapterContent>;
  // Content structure type - determines navigation labels and processing behavior
  structureType?: "prose" | "anthology" | "epic" | "script";
  // Custom navigation labels (optional, falls back to defaults based on structureType)
  navigationLabels?: {
    chapter: { en: string; es: string };
    page: { en: string; es: string };
  };
  // True if any chapter has alignment issues
  hasAlignmentIssues?: boolean;
}

// ============================================================================
// PAGE MARKERS
// ============================================================================

/**
 * Check if a line is a PAGE marker for manual pagination
 */
export function isPageMarker(line: string): boolean {
  const trimmed = line.trim().toUpperCase();
  return (
    trimmed === "PAGE" ||
    trimmed === "---PAGE---" ||
    trimmed === "[PAGE]" ||
    trimmed === "PAGE BREAK"
  );
}

// ============================================================================
// PAGINATION
// ============================================================================

/**
 * Paginate lines into pages.
 * Supports manual PAGE markers for explicit page breaks.
 * If no PAGE markers found, falls back to automatic pagination based on linesPerPage.
 *
 * @param lines - Array of text lines to paginate
 * @param linesPerPage - Target lines per page (default: 10)
 * @returns Array of pages, each page being an array of lines
 */
export function paginateLines(
  lines: string[],
  linesPerPage: number = 10
): string[][] {
  // Handle undefined/null/empty lines
  if (!lines || !Array.isArray(lines) || lines.length === 0) {
    return [[]];
  }

  // Check if there are any PAGE markers in the content
  const hasPageMarkers = lines.some(isPageMarker);

  if (hasPageMarkers) {
    // Manual pagination using PAGE markers
    const pages: string[][] = [];
    let currentPage: string[] = [];

    for (const line of lines) {
      if (isPageMarker(line)) {
        // PAGE marker found - end current page and start new one
        if (currentPage.length > 0) {
          pages.push([...currentPage]);
          currentPage = [];
        }
      } else {
        currentPage.push(line);
      }
    }

    // Don't forget remaining lines
    if (currentPage.length > 0) {
      pages.push(currentPage);
    }

    return pages.length > 0 ? pages : [[]];
  }

  // Automatic pagination based on linesPerPage
  const pages: string[][] = [];
  let currentPage: string[] = [];

  for (const line of lines) {
    currentPage.push(line);

    // Check if we should end the page
    if (currentPage.length >= linesPerPage) {
      // Try to find a good breaking point (sentence ending)
      const lastLineEndsSentence =
        line.endsWith(".") ||
        line.endsWith("!") ||
        line.endsWith("?") ||
        line.endsWith('"');

      if (lastLineEndsSentence || currentPage.length >= linesPerPage + 2) {
        pages.push([...currentPage]);
        currentPage = [];
      }
    }
  }

  // Don't forget remaining lines
  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages.length > 0 ? pages : [[]];
}

// ============================================================================
// POEM STANZA PAGINATION
// ============================================================================

/**
 * Detect if line metadata indicates this is poem content.
 * Checks for stanzaNumber values in the metadata.
 */
function isPoemContent(lineMetadata?: Map<number, LineMetadata>): boolean {
  if (!lineMetadata || lineMetadata.size === 0) return false;
  for (const meta of lineMetadata.values()) {
    if (meta.stanzaNumber !== undefined) return true;
  }
  return false;
}

// ============================================================================
// POEM-AWARE PAGINATION (for anthologies)
// NOTE: All poem detection and pagination functions are now imported from
// @/lib/text-processing - this is the SINGLE SOURCE OF TRUTH.
// The following imports are re-exported for backward compatibility:
// - detectPoemBoundaries, isPoemTitleLine, isSectionHeader, countPoems
// - detectSectionBoundaries, DetectedSection
// - paginateAnthologyPoems, AnthologyPaginationResult, ANTHOLOGY_MAX_LINES_PER_PAGE
// - POEM_TITLE_PATTERN, NUMBERED_POEM_PATTERN, SECTION_HEADER_PATTERN
// ============================================================================

// ============================================================================
// SINGLE CHAPTER BUILD (for incremental building during streaming)
// ============================================================================

/**
 * Result of building a single chapter's content
 */
export interface BuiltChapterResult {
  pages: Record<number, PageContent>;
  poems?: PoemInfo[];  // Only for anthologies
}

/**
 * Build a single chapter's paginated content.
 * Called immediately after translation to ensure streaming matches final output.
 *
 * @param sourceLines - Source language lines
 * @param translatedLines - Translated lines
 * @param sourceLanguage - Source language ("en" or "es")
 * @param structureType - Content structure type for pagination strategy
 * @param lineMetadata - Optional line metadata (for stanza detection)
 * @returns Built pages with poem info (for anthologies)
 */
export function buildSingleChapterContent(
  sourceLines: string[],
  translatedLines: string[],
  sourceLanguage: "en" | "es",
  structureType: "prose" | "anthology" | "epic" | "script" = "prose",
  lineMetadata?: Map<number, LineMetadata>
): BuiltChapterResult {
  const pages: Record<number, PageContent> = {};

  // Helper to trim lines - preserve leading whitespace for poetry
  const trimLine = (line: string | undefined, preserveIndent: boolean): string => {
    if (!line) return "";
    // For poetry: preserve leading whitespace (indentation) but remove trailing
    return preserveIndent ? line.trimEnd() : line.trim();
  };

  // ANTHOLOGY PATH: Poem-aware pagination with poem tracking
  if (structureType === "anthology") {
    const { pages: paginatedPages, poems: poemInfoList } = paginateAnthologyPoems(
      sourceLines,
      translatedLines,
      lineMetadata
    );

    for (let pIdx = 0; pIdx < paginatedPages.length; pIdx++) {
      const pageData = paginatedPages[pIdx];
      const lines: StoryLine[] = [];

      for (let lIdx = 0; lIdx < pageData.sourceLines.length; lIdx++) {
        // Preserve indentation for anthology poetry
        const sourceLine = trimLine(pageData.sourceLines[lIdx], true);
        const translatedLine = trimLine(pageData.translatedLines[lIdx], true);
        const lineMeta = pageData.lineMetadata.get(lIdx);

        const storyLine: StoryLine = sourceLanguage === "es"
          ? { es: sourceLine, en: translatedLine }
          : { en: sourceLine, es: translatedLine };

        if (lineMeta?.stanzaNumber !== undefined) {
          storyLine.stanzaNumber = lineMeta.stanzaNumber;
        }
        if (lineMeta?.isStanzaBreak) {
          storyLine.isStanzaBreak = true;
        }

        lines.push(storyLine);
      }

      // Build stanzas array from lines with stanzaNumber metadata
      // This provides the nested structure for stanza-level poem rendering
      let stanzas: StoryLine[][] | undefined = undefined;

      if (lines.length > 0) {
        const stanzaGroups: StoryLine[][] = [];
        let currentStanza: StoryLine[] = [];
        let currentStanzaNum = lines[0].stanzaNumber ?? 1;

        for (const line of lines) {
          const lineStanzaNum = line.stanzaNumber ?? currentStanzaNum;
          if (lineStanzaNum !== currentStanzaNum && currentStanza.length > 0) {
            // New stanza - push current and start new
            stanzaGroups.push(currentStanza);
            currentStanza = [];
            currentStanzaNum = lineStanzaNum;
          }
          currentStanza.push(line);
        }
        // Push final stanza
        if (currentStanza.length > 0) {
          stanzaGroups.push(currentStanza);
        }

        // Only set stanzas if we have multiple stanzas or stanza metadata exists
        if (stanzaGroups.length > 0) {
          stanzas = stanzaGroups;
        }
      }

      pages[pIdx + 1] = {
        lines,
        stanzas,
        poemNumber: pageData.poemNumber,
        poemTitle: pageData.poemTitle,
        isFirstPageOfPoem: pageData.isFirstPageOfPoem,
        isContinuation: pageData.isContinuation,
      };
    }

    return { pages, poems: poemInfoList };
  }

  // PROSE/DEFAULT PATH: Simple line-based pagination
  // For epic poetry, preserve indentation
  const preserveIndent = structureType === "epic";

  // Paginate source lines to determine page boundaries, then slice
  // translation at the same boundaries so both sides stay aligned.
  const sourcePages = paginateLines(sourceLines);
  const maxLineCount = Math.max(sourceLines.length, translatedLines.length);

  let translatedOffset = 0;
  for (let pIdx = 0; pIdx < sourcePages.length; pIdx++) {
    const sourcePageLines = sourcePages[pIdx];
    const pageSize = sourcePageLines.length;
    const translatedPageLines = translatedLines.slice(translatedOffset, translatedOffset + pageSize);
    translatedOffset += pageSize;

    const lines: StoryLine[] = [];
    for (let lIdx = 0; lIdx < pageSize; lIdx++) {
      const sourceLine = trimLine(sourcePageLines[lIdx], preserveIndent);
      const translatedLine = trimLine(translatedPageLines[lIdx], preserveIndent);

      const storyLine: StoryLine = sourceLanguage === "es"
        ? { es: sourceLine, en: translatedLine }
        : { en: sourceLine, es: translatedLine };

      lines.push(storyLine);
    }

    pages[pIdx + 1] = { lines };
  }

  // If translation has more lines than source (rare), add remaining as extra page
  if (translatedOffset < translatedLines.length) {
    const remaining = translatedLines.slice(translatedOffset);
    const lines: StoryLine[] = remaining.map(tl => {
      const storyLine: StoryLine = sourceLanguage === "es"
        ? { es: "", en: trimLine(tl, preserveIndent) }
        : { en: "", es: trimLine(tl, preserveIndent) };
      return storyLine;
    });
    pages[sourcePages.length + 1] = { lines };
  }

  return { pages };
}

/**
 * Group source and translated lines by stanza number.
 * Returns an array of stanzas, where each stanza is an array of {source, translated, meta}.
 */
interface StanzaGroupEntry {
  source: string;
  translated: string;
  meta?: LineMetadata;
}

function groupLinesByStanza(
  sourceLines: string[],
  translatedLines: string[],
  lineMetadata: Map<number, LineMetadata>
): StanzaGroupEntry[][] {
  const stanzasMap = new Map<number, StanzaGroupEntry[]>();

  for (let i = 0; i < sourceLines.length; i++) {
    const meta = lineMetadata.get(i);
    const stanzaNum = meta?.stanzaNumber ?? 1;

    // Skip stanza breaks (empty placeholder lines)
    if (meta?.isStanzaBreak) continue;

    if (!stanzasMap.has(stanzaNum)) {
      stanzasMap.set(stanzaNum, []);
    }

    stanzasMap.get(stanzaNum)!.push({
      source: sourceLines[i] || '',
      translated: translatedLines[i] || '',
      meta,
    });
  }

  // Return stanzas in order
  const stanzaNumbers = Array.from(stanzasMap.keys()).sort((a, b) => a - b);
  return stanzaNumbers.map(num => stanzasMap.get(num)!);
}

/**
 * Paginate stanzas for poems, keeping stanzas together when possible.
 * Returns pages where each page contains complete stanzas.
 *
 * @param stanzas - Array of stanzas (each stanza is array of line entries)
 * @param linesPerPage - Target lines per page (default: 15 for poems)
 * @returns Array of pages, each page containing stanzas
 */
function paginateStanzas(
  stanzas: StanzaGroupEntry[][],
  linesPerPage: number = 15
): StanzaGroupEntry[][][] {
  const pages: StanzaGroupEntry[][][] = [];
  let currentPage: StanzaGroupEntry[][] = [];
  let currentPageLines = 0;

  for (const stanza of stanzas) {
    const stanzaLineCount = stanza.length;

    // If this stanza alone exceeds page limit, put it on its own page
    if (stanzaLineCount > linesPerPage) {
      // Finish current page if it has content
      if (currentPage.length > 0) {
        pages.push(currentPage);
        currentPage = [];
        currentPageLines = 0;
      }
      // Put large stanza on its own page
      pages.push([stanza]);
      continue;
    }

    // Check if adding this stanza would exceed page limit
    if (currentPageLines + stanzaLineCount > linesPerPage && currentPage.length > 0) {
      // Start a new page
      pages.push(currentPage);
      currentPage = [];
      currentPageLines = 0;
    }

    // Add stanza to current page
    currentPage.push(stanza);
    currentPageLines += stanzaLineCount;
  }

  // Don't forget the last page
  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages.length > 0 ? pages : [[[]]];
}

// ============================================================================
// CONTENT STRUCTURE BUILDING
// ============================================================================

/**
 * Input type for buildContentStructure - each chapter with content and optional metadata
 */
export interface ProcessedChapterData {
  sourceLines: string[];
  translatedLines: string[];
  metadata?: ChapterMetadata;
}

/**
 * Build the content structure matching existing content.ts format.
 * Creates a LevelContent object ready for database storage.
 * Now includes chapter metadata (title, subtitle) for UI display.
 *
 * @param storySlug - The story's slug identifier
 * @param levelNum - The CEFR level number (1-6)
 * @param hasChapters - Whether the story has multiple chapters
 * @param chaptersData - Array of chapter data with source and translated lines, plus optional metadata
 * @param sourceLanguage - The source language ("en" or "es")
 * @returns LevelContent object matching the story content format
 */
export function buildContentStructure(
  storySlug: string,
  levelNum: number,
  hasChapters: boolean,
  chaptersData: ProcessedChapterData[],
  sourceLanguage: "en" | "es"
): LevelContent {
  const chapters: Record<number, ChapterContent> = {};

  chaptersData.forEach((chapter, chapterIndex) => {
    // Paginate source lines, then slice translation at the same page boundaries
    // so both sides stay aligned (avoids misalignment from independent pagination).
    const sourcePages = paginateLines(chapter.sourceLines);
    const pages: Record<number, PageContent> = {};

    let translatedOffset = 0;
    for (let pIdx = 0; pIdx < sourcePages.length; pIdx++) {
      const sourcePageLines = sourcePages[pIdx];
      const pageSize = sourcePageLines.length;
      const translatedPageLines = chapter.translatedLines.slice(translatedOffset, translatedOffset + pageSize);
      translatedOffset += pageSize;

      const lines: StoryLine[] = [];
      for (let lIdx = 0; lIdx < pageSize; lIdx++) {
        const sourceLine = sourcePageLines[lIdx]?.trim() || "";
        const translatedLine = translatedPageLines[lIdx]?.trim() || "";

        // IMPORTANT: es always gets Spanish, en always gets English
        // If source is Spanish, source goes to es, translated goes to en
        // If source is English, source goes to en, translated goes to es
        if (sourceLanguage === "es") {
          lines.push({ es: sourceLine, en: translatedLine });
        } else {
          lines.push({ en: sourceLine, es: translatedLine });
        }
      }

      pages[pIdx + 1] = { lines };
    }

    // If translation has more lines than source, add remaining as extra page
    if (translatedOffset < chapter.translatedLines.length) {
      const remaining = chapter.translatedLines.slice(translatedOffset);
      const lines: StoryLine[] = remaining.map(tl => {
        if (sourceLanguage === "es") {
          return { es: "", en: tl?.trim() || "" };
        } else {
          return { en: "", es: tl?.trim() || "" };
        }
      });
      pages[sourcePages.length + 1] = { lines };
    }

    // Store chapter with pages and metadata (if available)
    const chapterContent: ChapterContent = { pages };
    if (chapter.metadata) {
      chapterContent.metadata = chapter.metadata;
    }
    chapters[chapterIndex + 1] = chapterContent;
  });

  return {
    storySlug,
    level: levelNum,
    hasChapters,
    chapters,
  };
}

// ============================================================================
// EXTENDED CONTENT STRUCTURE BUILDING (with line metadata for poems/scripts)
// ============================================================================

// NOTE: LineMetadata is now imported and re-exported from @/lib/text-processing

/**
 * Extended chapter data that includes line-level metadata.
 */
export interface ProcessedChapterDataWithMetadata {
  sourceLines: string[];
  translatedLines: string[];
  metadata?: ChapterMetadata;
  /** Line metadata indexed by line number (0-based) */
  lineMetadata?: Map<number, LineMetadata>;
  /** Translated stage directions indexed by line number */
  translatedStageDirections?: Map<number, string>;
}

/**
 * Options for building content structure with metadata.
 */
export interface BuildContentOptions {
  /**
   * Content structure type. Affects pagination behavior.
   * - "anthology": Use poem-aware pagination (one poem per page, max 30 lines)
   * - "epic": Use stanza-based pagination
   * - "prose" | "script": Use standard line-based pagination
   */
  structureType?: "prose" | "anthology" | "epic" | "script";
}

/**
 * Build content structure with line metadata support for poems and scripts.
 * This is an enhanced version that preserves stanza numbers, speaker names, etc.
 *
 * For anthologies: Each poem within a section becomes a page (poem-aware pagination).
 * For poems/epic: Builds nested `stanzas: StoryLine[][]` to guarantee stanza structure.
 * For scripts/prose: Builds flat `lines: StoryLine[]` with metadata.
 *
 * @param storySlug - The story's slug identifier
 * @param levelNum - The CEFR level number (1-6)
 * @param hasChapters - Whether the story has multiple chapters
 * @param chaptersData - Array of chapter data with source/translated lines and optional line metadata
 * @param sourceLanguage - The source language ("en" or "es")
 * @param options - Build options including structureType for anthology handling
 * @returns LevelContent object with enhanced StoryLine objects
 */
export function buildContentStructureWithMetadata(
  storySlug: string,
  levelNum: number,
  hasChapters: boolean,
  chaptersData: ProcessedChapterDataWithMetadata[],
  sourceLanguage: "en" | "es",
  options: BuildContentOptions = {}
): LevelContent {
  const { structureType = "prose" } = options;
  const chapters: Record<number, ChapterContent> = {};

  // Helper to trim lines - preserve leading whitespace for poetry
  const trimLine = (line: string | undefined, preserveIndent: boolean): string => {
    if (!line) return "";
    return preserveIndent ? line.trimEnd() : line.trim();
  };

  chaptersData.forEach((chapter, chapterIndex) => {
    const pages: Record<number, PageContent> = {};

    // Check if this is poem content (has stanza numbers in metadata)
    const isPoem = isPoemContent(chapter.lineMetadata);

    // ANTHOLOGY PATH: Poem-aware pagination with poem tracking
    if (structureType === "anthology") {
      // Use poem-aware pagination - returns pages with poem info and poem list for navigation
      const { pages: paginatedPages, poems: poemInfoList } = paginateAnthologyPoems(
        chapter.sourceLines,
        chapter.translatedLines,
        chapter.lineMetadata
      );

      // Build pages from paginated poems with poem tracking
      for (let pIdx = 0; pIdx < paginatedPages.length; pIdx++) {
        const pageData = paginatedPages[pIdx];
        const lines: StoryLine[] = [];

        for (let lIdx = 0; lIdx < pageData.sourceLines.length; lIdx++) {
          // Preserve indentation for anthology poetry
          const sourceLine = trimLine(pageData.sourceLines[lIdx], true);
          const translatedLine = trimLine(pageData.translatedLines[lIdx], true);
          const lineMeta = pageData.lineMetadata.get(lIdx);

          const storyLine: StoryLine = sourceLanguage === "es"
            ? { es: sourceLine, en: translatedLine }
            : { en: sourceLine, es: translatedLine };

          // Add stanza number if present
          if (lineMeta?.stanzaNumber !== undefined) {
            storyLine.stanzaNumber = lineMeta.stanzaNumber;
          }
          if (lineMeta?.isStanzaBreak) {
            storyLine.isStanzaBreak = true;
          }

          lines.push(storyLine);
        }

        // Group lines by stanzaNumber to build nested stanzas array
        // This enables stanza-level emoji interactions for anthology poems
        const stanzaGroups = new Map<number, StoryLine[]>();
        let linesWithStanzaNum = 0;
        let linesWithoutStanzaNum = 0;
        for (const line of lines) {
          const stanzaNum = line.stanzaNumber ?? 0;
          if (line.stanzaNumber !== undefined) {
            linesWithStanzaNum++;
          } else {
            linesWithoutStanzaNum++;
          }
          if (!stanzaGroups.has(stanzaNum)) {
            stanzaGroups.set(stanzaNum, []);
          }
          stanzaGroups.get(stanzaNum)!.push(line);
        }
        console.log(`[BuildContent] DEBUG - Page ${pIdx + 1}: ${lines.length} lines, ${linesWithStanzaNum} with stanzaNumber, ${linesWithoutStanzaNum} without, ${stanzaGroups.size} stanza groups`);

        // Convert to nested array, sorted by stanza number
        const stanzaNumbers = Array.from(stanzaGroups.keys()).sort((a, b) => a - b);
        const stanzas: StoryLine[][] = stanzaNumbers.map(num => stanzaGroups.get(num)!);

        // Store page with poem tracking metadata AND nested stanzas
        pages[pIdx + 1] = {
          lines,  // Keep for backward compatibility
          stanzas: stanzas.length > 0 ? stanzas : undefined,  // Include stanzas if any exist
          poemNumber: pageData.poemNumber,
          poemTitle: pageData.poemTitle,
          isFirstPageOfPoem: pageData.isFirstPageOfPoem,
          isContinuation: pageData.isContinuation,
        };
      }

      // Store chapter with pages and poem list for navigation
      const chapterContent: ChapterContent = {
        pages,
        poems: poemInfoList,  // For anthology navigation dropdown
      };
      if (chapter.metadata) {
        chapterContent.metadata = chapter.metadata;
      }
      chapters[chapterIndex + 1] = chapterContent;

      return; // Skip the default chapter storage below
    } else if (isPoem && chapter.lineMetadata) {
      // POEM PATH: Build nested stanzas structure (for epic, single poems)

      // Group lines by stanza
      const groupedStanzas = groupLinesByStanza(
        chapter.sourceLines,
        chapter.translatedLines,
        chapter.lineMetadata
      );

      // Paginate stanzas (keeping stanzas together)
      const paginatedStanzas = paginateStanzas(groupedStanzas, 15);

      // Build pages with nested stanzas
      for (let pIdx = 0; pIdx < paginatedStanzas.length; pIdx++) {
        const pageStanzas = paginatedStanzas[pIdx];
        const stanzas: StoryLine[][] = [];

        for (const stanza of pageStanzas) {
          const stanzaLines: StoryLine[] = [];

          for (const entry of stanza) {
            // Preserve indentation for epic poetry
            const preserveIndent = structureType === "epic";
            const storyLine: StoryLine = sourceLanguage === "es"
              ? { es: trimLine(entry.source, preserveIndent), en: trimLine(entry.translated, preserveIndent) }
              : { en: trimLine(entry.source, preserveIndent), es: trimLine(entry.translated, preserveIndent) };

            // Add stanza number for reference
            if (entry.meta?.stanzaNumber !== undefined) {
              storyLine.stanzaNumber = entry.meta.stanzaNumber;
            }

            stanzaLines.push(storyLine);
          }

          if (stanzaLines.length > 0) {
            stanzas.push(stanzaLines);
          }
        }

        pages[pIdx + 1] = { stanzas };
      }
    } else {
      // NON-POEM PATH: Build flat lines structure (scripts, prose, etc.)
      // Paginate source lines, then slice translation at the same page boundaries
      // so both sides stay aligned (avoids misalignment from independent pagination).
      const sourcePages = paginateLines(chapter.sourceLines);

      // Track which source line index we're at for metadata lookup
      let sourceLineIndex = 0;
      let translatedOffset = 0;

      for (let pIdx = 0; pIdx < sourcePages.length; pIdx++) {
        const sourcePageLines = sourcePages[pIdx];
        const pageSize = sourcePageLines.length;
        const translatedPageLines = chapter.translatedLines.slice(translatedOffset, translatedOffset + pageSize);
        translatedOffset += pageSize;

        const lines: StoryLine[] = [];
        // Preserve indentation for epic poetry
        const preserveIndent = structureType === "epic";
        for (let lIdx = 0; lIdx < pageSize; lIdx++) {
          const sourceLine = trimLine(sourcePageLines[lIdx], preserveIndent);
          const translatedLine = trimLine(translatedPageLines[lIdx], preserveIndent);

          // Get line metadata if available
          const lineMeta = chapter.lineMetadata?.get(sourceLineIndex);
          const translatedDirection = chapter.translatedStageDirections?.get(sourceLineIndex);

          // Build the StoryLine with metadata
          const storyLine: StoryLine = sourceLanguage === "es"
            ? { es: sourceLine, en: translatedLine }
            : { en: sourceLine, es: translatedLine };

          // Add script metadata
          if (lineMeta?.speaker) {
            storyLine.speaker = lineMeta.speaker;
          }
          if (lineMeta?.speakerAnnotation) {
            storyLine.speakerAnnotation = lineMeta.speakerAnnotation;
          }
          if (lineMeta?.stageDirection) {
            storyLine.stageDirection = lineMeta.stageDirection;
            // Store translated stage direction in the appropriate field
            if (translatedDirection) {
              if (sourceLanguage === "es") {
                storyLine.stageDirectionEs = lineMeta.stageDirection;
                storyLine.stageDirectionEn = translatedDirection;
              } else {
                storyLine.stageDirectionEn = lineMeta.stageDirection;
                storyLine.stageDirectionEs = translatedDirection;
              }
            }
          }
          if (lineMeta?.isStageDirectionOnly) {
            storyLine.isStageDirectionOnly = true;
          }

          lines.push(storyLine);
          sourceLineIndex++;
        }

        pages[pIdx + 1] = { lines };
      }

      // If translation has more lines than source, add remaining as extra page
      if (translatedOffset < chapter.translatedLines.length) {
        const remaining = chapter.translatedLines.slice(translatedOffset);
        const preserveIndent = structureType === "epic";
        const lines: StoryLine[] = remaining.map(tl => {
          const storyLine: StoryLine = sourceLanguage === "es"
            ? { es: "", en: trimLine(tl, preserveIndent) }
            : { en: "", es: trimLine(tl, preserveIndent) };
          return storyLine;
        });
        pages[sourcePages.length + 1] = { lines };
      }
    }

    // Store chapter with pages and metadata (if available)
    const chapterContent: ChapterContent = { pages };
    if (chapter.metadata) {
      chapterContent.metadata = chapter.metadata;
    }
    chapters[chapterIndex + 1] = chapterContent;
  });

  return {
    storySlug,
    level: levelNum,
    hasChapters,
    chapters,
    // Include structure type for UI rendering (navigation labels, etc.)
    structureType: structureType !== "prose" ? structureType : undefined,
  };
}

// ============================================================================
// CHAPTER PARSING (uses admin utilities but provides a simpler interface)
// ============================================================================

import { preprocessText, type PreprocessOptions } from "@/lib/admin/text-preprocessor";
import { cleanText as adminCleanText, parseChaptersFromText } from "@/lib/admin/text-utils";

/**
 * Options for chapter parsing
 */
export interface ParseChaptersOptions {
  /**
   * Content structure type for proper marker handling.
   * - "auto": Auto-detect (default)
   * - "anthology": Poetry collections - preserves "I. LIFE." style markers in content
   * - "epic": Narrative poetry - preserves markers in content
   * - "prose": Standard novels/stories - markers stripped from content
   * - "script": Screenplays/transcripts
   */
  structureType?: "auto" | "prose" | "anthology" | "epic" | "script";
}

/**
 * Result of chapter parsing
 */
export interface ParseChaptersResult {
  hasChapters: boolean;
  chapters: ParsedChapter[];
  /** The detected or specified structure type */
  structureType: "prose" | "anthology" | "epic" | "script";
}

/**
 * Parse text into chapters using the admin pipeline's robust preprocessing.
 * Preserves chapter metadata (title, subtitle, number) for display in UI.
 *
 * @param text - Raw text to parse
 * @param options - Optional settings including structureType for anthology handling
 * @returns Object with hasChapters flag, chapters array, and detected structure type
 */
export function parseChapters(
  text: string,
  options: ParseChaptersOptions = {}
): ParseChaptersResult {
  // Use the full admin preprocessing pipeline for robust text cleaning and chapter detection
  // Pass structure type to control marker preservation (anthologies keep "I. LIFE." etc.)
  const preprocessed = preprocessText(text, {
    structureType: options.structureType || "auto"
  });

  const detectedStructureType = preprocessed.stats.structureType;

  // If preprocessing found chapters (1 or more), use those with full metadata
  // IMPORTANT: Use rawText from chapters, NOT cleanedFullText (which has --- Chapter X --- markers)
  if (preprocessed.chapters.length >= 1) {
    const hasMultiple = preprocessed.chapters.length > 1;

    return {
      hasChapters: hasMultiple,
      chapters: preprocessed.chapters.map((ch) => ({
        text: ch.rawText,
        metadata: {
          number: ch.number,
          title: ch.title || `Chapter ${ch.number}`,
          subtitle: ch.subtitle,
        },
      })),
      structureType: detectedStructureType,
    };
  }

  // Fallback: preprocessing found 0 chapters (shouldn't happen normally)
  // Try the simpler parseChaptersFromText for common chapter markers
  const preserveWhitespace = detectedStructureType === "anthology" || detectedStructureType === "epic";
  const cleanedText = adminCleanText(text, { preserveWhitespace });
  const parsedChapters = parseChaptersFromText(cleanedText);

  if (parsedChapters.length > 1) {
    return {
      hasChapters: true,
      chapters: parsedChapters.map((chText, idx) => ({
        text: chText,
        metadata: {
          number: idx + 1,
          title: `Chapter ${idx + 1}`,
        },
      })),
      structureType: detectedStructureType,
    };
  }

  // No chapters detected - return as single chapter
  return {
    hasChapters: false,
    chapters: [{
      text: cleanedText,
      metadata: {
        number: 1,
        title: "Full Text",
      },
    }],
    structureType: detectedStructureType,
  };
}
