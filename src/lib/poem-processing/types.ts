// src/lib/poem-processing/types.ts
// Canonical type definitions for poem/stanza processing
// All poem-related code should use these types

/**
 * A single line with stanza metadata attached.
 * This is the canonical representation after stanza detection.
 */
export interface AnnotatedPoemLine {
  /** The line text (empty string for stanza breaks) */
  text: string;
  /** 1-based stanza number this line belongs to */
  stanzaNumber: number;
  /** True if this is a blank line marking stanza boundary */
  isStanzaBreak: boolean;
  /** Original line index in source (for debugging/tracing) */
  sourceIndex: number;
}

/**
 * Result of stanza detection.
 * Contains both flat list and grouped representation.
 */
export interface StanzaDetectionResult {
  /** All lines with stanza annotations (includes stanza break markers) */
  annotatedLines: AnnotatedPoemLine[];

  /** Lines grouped by stanza (excludes stanza break markers, only content) */
  stanzas: AnnotatedPoemLine[][];

  /** Number of stanzas detected */
  stanzaCount: number;

  /** Detection metadata for debugging */
  detection: {
    /** Total lines in input (including blanks) */
    totalLines: number;
    /** Number of blank lines in input */
    blankLines: number;
    /** Number of content lines in input */
    contentLines: number;
    /** Which detection method was used */
    method: 'single-blank' | 'double-blank' | 'adaptive';
    /** Blank line threshold used for stanza breaks */
    blankThreshold: number;
    /** Ratio of content lines followed by single blank (for adaptive) */
    visualSpacingRatio: number;
  };
}

/**
 * Configuration for stanza detection.
 */
export interface StanzaDetectorConfig {
  /**
   * How to detect stanza breaks.
   * - 'single-blank': Any single blank line starts new stanza (traditional poetry)
   * - 'double-blank': Require 2+ blanks (Gutenberg visual spacing pattern)
   * - 'adaptive': Auto-detect based on blank line patterns (recommended)
   */
  method: 'single-blank' | 'double-blank' | 'adaptive';
}

/**
 * A poem within an anthology collection.
 */
export interface DetectedPoem {
  /** 1-based poem number within the collection */
  number: number;
  /** Poem title (extracted from ALL CAPS header or Roman numeral) */
  title: string;
  /** Start line index in the chapter (inclusive) */
  startLine: number;
  /** End line index in the chapter (exclusive) */
  endLine: number;
  /** Raw lines belonging to this poem (before stanza detection) */
  rawLines: string[];
}

/**
 * Result of poem boundary detection for anthologies.
 */
export interface PoemBoundaryResult {
  /** Detected poems in order */
  poems: DetectedPoem[];
  /** Detection metadata */
  detection: {
    /** How poems were identified */
    method: 'roman-numeral' | 'all-caps-title' | 'numbered' | 'double-blank' | 'single-poem';
    /** Total lines processed */
    totalLines: number;
  };
}

/**
 * Final bilingual poem line for storage and rendering.
 * This matches the existing StoryLine interface for compatibility.
 */
export interface BilingualPoemLine {
  en: string;
  es: string;
  stanzaNumber?: number;
  isStanzaBreak?: boolean;
}

/**
 * Page content specifically for poems.
 * INVARIANT: Always has stanzas array, never just flat lines.
 */
export interface PoemPageContent {
  /** Nested stanzas - each inner array is one stanza's lines */
  stanzas: BilingualPoemLine[][];

  /** For anthologies: which poem this page belongs to */
  poemNumber?: number;
  poemTitle?: string;
  isFirstPageOfPoem?: boolean;
  isContinuation?: boolean;
}

/**
 * Line metadata carried through the processing pipeline.
 * This is the contract between stanza detection and content building.
 */
export interface PoemLineMetadata {
  stanzaNumber: number;
  isStanzaBreak: boolean;
}

/**
 * Map of line index to metadata.
 * Used to carry stanza information through translation.
 */
export type PoemLineMetadataMap = Map<number, PoemLineMetadata>;
