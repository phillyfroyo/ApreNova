// src/lib/text-processing/types.ts
// Unified types for the text processing pipeline
// This module is used by Admin uploads, User uploads, and Dev Tools

// ============================================================================
// FILE TYPES
// ============================================================================

export type FileType = "html" | "txt" | "rtf" | "md";

// ============================================================================
// CONTENT/STORY TYPES
// ============================================================================

export type ContentType = "anthology" | "prose" | "epic" | "script";

// ============================================================================
// EXTRACTED ANNOTATIONS
// ============================================================================

export interface ExtractedAnnotation {
  id: string;
  type: "sidenote" | "footnote" | "marginal";
  text: string;
  nearbyText: string;
}

// ============================================================================
// EXTRACTION RESULT (Step 1: File → Text)
// ============================================================================

export interface ExtractionResult {
  /** Extracted plain text */
  text: string;
  /** Annotations found and extracted (sidenotes, footnotes, etc.) */
  annotations: ExtractedAnnotation[];
  /** Stats about the extraction */
  stats: {
    originalLength: number;
    extractedLength: number;
    annotationsExtracted: number;
  };
}

// ============================================================================
// EXTRACTION OPTIONS
// ============================================================================

export interface ExtractionOptions {
  /** Preserve whitespace for poetry (don't collapse newlines) */
  preserveWhitespace?: boolean;
}

// ============================================================================
// CHAPTER TYPES
// ============================================================================

export interface DetectedChapter {
  number: number;
  title: string;
  subtitle?: string;
  rawText: string;
  startLine: number;
  endLine: number;
}

// ============================================================================
// PREPROCESSING RESULT (Step 2: Text → Structured Content)
// ============================================================================

export interface PreprocessedText {
  /** Front matter (before first chapter) - for metadata extraction */
  frontMatter: string;

  /** Back matter (after story ends) - license, legal text, etc. */
  backMatter: string;

  /** Detected chapters */
  chapters: DetectedChapter[];

  /** Statistics about the preprocessing */
  stats: {
    originalLength: number;
    cleanedLength: number;
    lineNumbersRemoved: number;
    pageMarkersRemoved: number;
    footnoteIndicatorsRemoved: number;
    asteriskDividersRemoved: number;
    chaptersDetected: number;
    backMatterRemoved: boolean;
    lineBreakStyle: LineBreakStyle;
    structureType: ContentType;
  };

  /** Full cleaned text (all chapters joined) */
  cleanedFullText: string;
}

// ============================================================================
// LINE BREAK STYLE
// ============================================================================

export type LineBreakStyle = "prose-wrapped" | "intentional";

// ============================================================================
// PROCESSING OPTIONS
// ============================================================================

export interface ProcessingOptions {
  /** File type (html, txt, rtf, md) - auto-detected if not specified */
  fileType?: FileType;

  /**
   * Content structure type. When "auto", will analyze text to detect.
   * - "anthology": Poetry collections - preserves "I. LIFE." markers
   * - "epic": Narrative poetry - preserves markers
   * - "prose": Standard novels/stories
   * - "script": Screenplays/transcripts
   */
  contentType?: "auto" | ContentType;

  /** Preserve whitespace for poetry - auto-detected based on contentType if not specified */
  preserveWhitespace?: boolean;
}

// ============================================================================
// FULL PROCESSING RESULT
// ============================================================================

export interface ProcessingResult {
  /** Step 1: File-type specific extraction result */
  extractedText: string;
  extractionStats: {
    originalLength: number;
    extractedLength: number;
    annotationsExtracted?: number;
  };

  /** Step 2: Preprocessing result (chapters, structure detection, cleanup) */
  preprocessed: PreprocessedText;

  /** Detected content type */
  detectedContentType: ContentType;

  /** Extracted annotations (if any) */
  annotations: ExtractedAnnotation[];

  /** Any errors encountered */
  errors: string[];

  /** Processing metadata */
  processedAt: string; // ISO timestamp
}

// ============================================================================
// STRUCTURE ANALYSIS (for content type detection)
// ============================================================================

export interface StructureAnalysis {
  structureType: ContentType;
  confidence: number; // 0-1
  thematicSections: string[]; // e.g., ["I. LIFE.", "II. LOVE."]
  poemCount: number;
  avgPoemLength: number;
  hasEditorialNotes: boolean;
}

// ============================================================================
// CHAPTER MARKER TYPES
// ============================================================================

export interface ChapterMarker {
  lineIndex: number;
  type: 'roman' | 'arabic' | 'word' | 'thematic';
  number: number;
  title: string;
  subtitle?: string;
  fullMatch: string;
}

// ============================================================================
// SCRIPT PARSING TYPES
// ============================================================================

export interface ParsedScriptLine {
  speaker?: string;           // "WALTER", "JESSE" - NOT translated
  speakerAnnotation?: string; // "(V.O.)", "(O.S.)", "(CONT'D)" - NOT translated
  stageDirection?: string;    // "sighs", "He exits" - will be read by TTS
  dialogue: string;           // The actual dialogue text
  isStageDirectionOnly: boolean; // True if line is ONLY a stage direction
}

// ============================================================================
// EDITORIAL NOTE TYPES
// ============================================================================

export interface EditorialNote {
  lineIndex: number;
  text: string;
  type: "publication" | "biographical" | "annotation";
}
