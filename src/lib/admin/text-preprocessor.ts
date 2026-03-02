// src/lib/admin/text-preprocessor.ts
// Algorithmic text preprocessing - no AI needed
//
// NOTE: This module uses the shared text-processing module as the single source
// of truth for text processing algorithms. The shared module is also used by:
// - User story uploads (UploadStoryModal)
// - Dev Tools algorithm testing system

import {
  // Gutenberg handling
  removeGutenbergFrontMatter,
  extractPreChapterText,
  detectBackMatterStart,
  extractBackMatter,
  // Whitespace handling
  detectLineBreakStyle,
  normalizeLineBreaks,
  normalizeWhitespace,
  normalizeWhitespacePreserveIndent,
  getLineBreakStyleDescription,
  // Cleanup
  removeLineNumbers,
  removePageMarkers,
  removeFootnoteIndicators,
  removeAsteriskDividers,
  // Chapter detection
  detectThematicSectionMarkers,
  detectChapterMarkers,
  filterOutTOCMarkers,
  splitIntoChapters,
  // Types
  type LineBreakStyle,
  type ChapterMarker,
} from '@/lib/text-processing';

// Re-export LineBreakStyle for backward compatibility
export type { LineBreakStyle };

// Re-export whitespace functions for backward compatibility
export { detectLineBreakStyle, normalizeLineBreaks, getLineBreakStyleDescription };

// ============================================
// CHAPTER DETECTION TYPES
// ============================================

export interface DetectedChapter {
  number: number;
  title: string;
  subtitle?: string;
  rawText: string;
  startLine: number;
  endLine: number;
}

export interface PreprocessedText {
  // The front matter (before first chapter) - for metadata extraction
  frontMatter: string;

  // The back matter (after story ends) - license, legal text, etc.
  backMatter: string;

  // Detected chapters
  chapters: DetectedChapter[];

  // Statistics
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
    /** Detected content structure type (prose, anthology, epic, script) */
    structureType: "prose" | "anthology" | "epic" | "script";
  };

  // The full cleaned text (all chapters joined)
  cleanedFullText: string;
}

/**
 * Options for text preprocessing
 */
export interface PreprocessOptions {
  /**
   * Content structure type. When "auto" or undefined, will analyze text to detect.
   * - "prose": Standard novels/short stories - chapter markers removed from content
   * - "anthology": Poetry collections - thematic markers preserved in content (e.g., "I. LIFE.")
   * - "epic": Narrative poetry - markers preserved
   * - "script": Screenplays/transcripts
   */
  structureType?: "auto" | "prose" | "anthology" | "epic" | "script";
}

/**
 * Main preprocessing function
 * Takes raw text and returns structured, cleaned output
 */
export function preprocessText(rawText: string, options: PreprocessOptions = {}): PreprocessedText {
  const originalLength = rawText.length;

  // Step 0: Remove Gutenberg front matter markers
  const noGutenbergHeader = removeGutenbergFrontMatter(rawText);

  // Step 1: Remove line numbers
  const { text: noLineNumbers, count: lineNumbersRemoved } = removeLineNumbers(noGutenbergHeader);

  // Step 2: Remove page markers
  const { text: noPageMarkers, count: pageMarkersRemoved } = removePageMarkers(noLineNumbers);

  // Step 3: Remove footnote indicators (numbers attached to words like "night-time5")
  const { text: noFootnotes, count: footnoteIndicatorsRemoved } = removeFootnoteIndicators(noPageMarkers);

  // Step 4: Remove decorative asterisk dividers
  const { text: noAsterisks, count: asteriskDividersRemoved } = removeAsteriskDividers(noFootnotes);

  // Step 5: Normalize whitespace
  // For anthologies/poetry, preserve leading whitespace (indentation) and more blank lines
  // IMPORTANT: When structureType is "auto", we must preserve whitespace until we detect structure
  // Otherwise blank lines get collapsed BEFORE we know it's poetry
  const isKnownPoetry = options.structureType === "anthology" || options.structureType === "epic";
  const isAutoDetect = !options.structureType || options.structureType === "auto";

  // Use lenient whitespace handling for auto-detect OR known poetry
  // This preserves vertical spacing for poetry even when structure is auto-detected
  const preserveWhitespace = isKnownPoetry || isAutoDetect;
  const normalized = preserveWhitespace ? normalizeWhitespacePreserveIndent(noAsterisks) : normalizeWhitespace(noAsterisks);

  // DEBUG: Log consecutive blank line runs after normalization
  const debugLines = normalized.split('\n').slice(0, 50);
  const consecutiveBlankRuns: number[] = [];
  let currentRun = 0;
  for (const line of debugLines) {
    if (line.trim() === '') {
      currentRun++;
    } else {
      if (currentRun > 0) consecutiveBlankRuns.push(currentRun);
      currentRun = 0;
    }
  }
  if (currentRun > 0) consecutiveBlankRuns.push(currentRun);
  console.log(`[preprocessText] DEBUG - After normalization, consecutive blank runs: [${consecutiveBlankRuns.join(', ')}]`);

  // Step 6: Split into lines for chapter detection
  let lines = normalized.split('\n');

  // Step 7: Detect and remove back matter
  const backMatterStart = detectBackMatterStart(lines);
  let backMatter = '';
  let backMatterRemoved = false;

  if (backMatterStart > 0) {
    backMatter = lines.slice(backMatterStart).join('\n');
    lines = lines.slice(0, backMatterStart);
    backMatterRemoved = true;
  }

  // Step 7b: Determine content structure type FIRST
  // This needs to happen before chapter detection because anthologies use different chapter markers
  let detectedStructureType: "prose" | "anthology" | "epic" | "script" = "prose";

  if (options.structureType && options.structureType !== "auto") {
    detectedStructureType = options.structureType;
  } else {
    // Auto-detect structure type from content
    const structureAnalysis = analyzeContentStructure(lines.join('\n'));
    detectedStructureType = structureAnalysis.structureType;
  }

  // Step 8: Detect chapter markers (passing structure type for anthology-aware detection)
  const rawMarkers = detectChapterMarkers(lines, { structureType: detectedStructureType });

  // Step 8b: Filter out Table of Contents markers (clusters of markers close together)
  const markers = filterOutTOCMarkers(rawMarkers, lines);

  // Step 9: Extract front matter
  const firstChapterLine = markers.length > 0 ? markers[0].lineIndex : lines.length;
  const frontMatter = extractPreChapterText(lines, firstChapterLine);

  // Step 10: Split into chapters
  // For anthologies and epics, preserve markers (e.g., "I. LIFE.") in the content
  const preserveMarkers = detectedStructureType === "anthology" || detectedStructureType === "epic";
  let chapters = splitIntoChapters(lines, markers, { preserveMarkers });

  // Step 11: Filter out chapters that are mostly empty or look like boilerplate
  chapters = chapters.filter(chapter => {
    const text = chapter.rawText.trim();
    // Keep if has substantial content (more than 50 characters of actual text)
    if (text.length < 50) return false;
    // Filter out chapters that are clearly boilerplate
    if (/Project Gutenberg/i.test(text) && text.length < 500) return false;
    return true;
  });

  // Renumber chapters if needed
  chapters = chapters.map((ch, idx) => ({
    ...ch,
    number: idx + 1,
  }));

  // Step 12: Detect line break style and normalize each chapter's text
  // For anthology/epic (poetry), ALWAYS use "intentional" to preserve vertical spacing
  // For prose, detect from the full text to get accurate metrics
  const isPoetryStructure = detectedStructureType === "anthology" || detectedStructureType === "epic";
  const lineBreakStyleForNormalization: LineBreakStyle = isPoetryStructure
    ? "intentional"
    : detectLineBreakStyle(chapters.map(ch => ch.rawText).join('\n\n'));

  // Normalize each chapter's rawText based on determined style
  chapters = chapters.map(ch => ({
    ...ch,
    rawText: normalizeLineBreaks(ch.rawText, lineBreakStyleForNormalization),
  }));

  // Step 13: Build full cleaned text with proper chapter labels
  // Add markers to ALL chapters including Chapter 1 for consistency with rewrite pipeline
  const cleanedFullText = chapters
    .map((ch) => {
      // Format: "--- Chapter X: Title ---" or just "--- Chapter X ---"
      const divider = ch.title
        ? `--- Chapter ${ch.number}: ${ch.title} ---`
        : `--- Chapter ${ch.number} ---`;
      return `${divider}\n\n${ch.rawText}`;
    })
    .join('\n\n');

  return {
    frontMatter,
    backMatter,
    chapters,
    stats: {
      originalLength,
      cleanedLength: cleanedFullText.length,
      lineNumbersRemoved,
      pageMarkersRemoved,
      footnoteIndicatorsRemoved,
      asteriskDividersRemoved,
      chaptersDetected: chapters.length,
      backMatterRemoved,
      lineBreakStyle: lineBreakStyleForNormalization,
      structureType: detectedStructureType,
    },
    cleanedFullText,
  };
}

/**
 * Quick clean for simple texts (no chapter detection)
 * Useful for short stories or when user just wants basic cleanup
 */
export function quickClean(rawText: string): string {
  let text = rawText;

  // Remove markdown formatting (bold, italic, headers)
  text = text
    .replace(/\*\*(.*?)\*\*/g, "$1")  // **bold**
    .replace(/\*(.*?)\*/g, "$1")       // *italic*
    .replace(/__(.*?)__/g, "$1")       // __bold__
    .replace(/_(.*?)_/g, "$1")         // _italic_
    .replace(/^#{1,6}\s+/gm, "");      // # headers

  // Remove code fences that AI sometimes adds
  text = text
    .replace(/^```[\w]*\n?/gm, "")
    .replace(/\n?```$/gm, "")
    .replace(/```/g, "");

  const { text: noLineNumbers } = removeLineNumbers(text);
  const { text: noPageMarkers } = removePageMarkers(noLineNumbers);
  const { text: noFootnotes } = removeFootnoteIndicators(noPageMarkers);
  const { text: noAsterisks } = removeAsteriskDividers(noFootnotes);
  return normalizeWhitespace(noAsterisks);
}

// ============================================
// POEM STANZA DETECTION
// ============================================
// NOTE: The canonical implementation is now in @/lib/poem-processing
// This file provides backward compatibility for existing imports

import {
  detectStanzas as detectStanzasNew,
  type AnnotatedPoemLine,
} from "@/lib/poem-processing";

/**
 * Legacy type for backward compatibility.
 * New code should use AnnotatedPoemLine from @/lib/poem-processing
 */
export interface StanzaMarkedLine {
  text: string;
  stanzaNumber: number;
  isStanzaBreak: boolean;
}

/**
 * Detect stanza breaks in poetry.
 *
 * @deprecated Use detectStanzas from @/lib/poem-processing instead.
 * This function now delegates to the canonical implementation.
 *
 * @param lines - Array of text lines (can include empty lines)
 * @returns Array of StanzaMarkedLine with stanza numbers and break markers
 */
export function detectStanzas(lines: string[]): StanzaMarkedLine[] {
  // Delegate to the canonical implementation in poem-processing
  const text = lines.join('\n');
  const result = detectStanzasNew(text, { method: 'adaptive' });

  // Convert to legacy format
  return result.annotatedLines.map((line: AnnotatedPoemLine) => ({
    text: line.text,
    stanzaNumber: line.stanzaNumber,
    isStanzaBreak: line.isStanzaBreak,
  }));
}

// ============================================
// SCRIPT LINE PARSING
// ============================================

export interface ParsedScriptLine {
  speaker?: string;           // "WALTER", "JESSE" - NOT translated
  speakerAnnotation?: string; // "(V.O.)", "(O.S.)", "(CONT'D)" - NOT translated
  stageDirection?: string;    // "sighs", "He exits" - will be read by TTS
  dialogue: string;           // The actual dialogue text
  isStageDirectionOnly: boolean; // True if line is ONLY a stage direction
}

/**
 * Pattern for speaker names with optional annotation.
 * Matches:
 * - WALTER: dialogue
 * - WALTER WHITE: dialogue
 * - WALTER (V.O.): dialogue
 * - WALTER (O.S.): dialogue
 * - WALTER (CONT'D): dialogue
 * - COP #2: dialogue
 *
 * Speaker names are typically ALL CAPS (with possible numbers, hyphens, apostrophes)
 * followed by optional parenthetical annotation, then a colon.
 */
const SPEAKER_PATTERN = /^([A-Z][A-Z0-9\s\-'#\.]+?)(\s*\([^)]+\))?\s*:\s*(.*)$/;

/**
 * Pattern for bracketed speaker names: [WALTER]: dialogue
 */
const BRACKETED_SPEAKER_PATTERN = /^\[([A-Z][A-Z0-9\s\-'#\.]+?)\]\s*:\s*(.*)$/;

/**
 * Pattern for stage directions in parentheses or brackets.
 * Captures content WITHOUT the surrounding brackets.
 */
const STAGE_DIRECTION_PATTERN = /\(([^)]+)\)|\[([^\]]+)\]/g;

/**
 * Pattern for a line that is ONLY a stage direction (standalone).
 * e.g., "(He walks to the door)" or "[FADE TO BLACK]"
 */
const STANDALONE_STAGE_DIRECTION = /^\s*(?:\(([^)]+)\)|\[([^\]]+)\])\s*$/;

/**
 * Parse a script line to extract speaker name, annotation, stage directions, and dialogue.
 *
 * @param line - A single line of script text
 * @returns ParsedScriptLine with extracted components
 */
export function parseScriptLine(line: string): ParsedScriptLine {
  const trimmed = line.trim();

  // Check if entire line is a standalone stage direction
  const standaloneMatch = trimmed.match(STANDALONE_STAGE_DIRECTION);
  if (standaloneMatch) {
    const direction = standaloneMatch[1] || standaloneMatch[2];
    return {
      dialogue: '',
      stageDirection: direction,
      isStageDirectionOnly: true
    };
  }

  // Try standard speaker pattern: SPEAKER (annotation): dialogue
  const speakerMatch = trimmed.match(SPEAKER_PATTERN);
  if (speakerMatch) {
    const speaker = speakerMatch[1].trim();
    const annotation = speakerMatch[2]?.trim() || undefined;
    let dialogue = speakerMatch[3] || '';

    // Extract inline stage directions from dialogue
    const directions: string[] = [];
    dialogue = dialogue.replace(STAGE_DIRECTION_PATTERN, (_, p1, p2) => {
      directions.push(p1 || p2);
      return '';
    }).trim();

    return {
      speaker,
      speakerAnnotation: annotation,
      stageDirection: directions.length > 0 ? directions.join('; ') : undefined,
      dialogue,
      isStageDirectionOnly: false
    };
  }

  // Try bracketed speaker pattern: [SPEAKER]: dialogue
  const bracketedMatch = trimmed.match(BRACKETED_SPEAKER_PATTERN);
  if (bracketedMatch) {
    const speaker = bracketedMatch[1].trim();
    let dialogue = bracketedMatch[2] || '';

    // Extract inline stage directions from dialogue
    const directions: string[] = [];
    dialogue = dialogue.replace(STAGE_DIRECTION_PATTERN, (_, p1, p2) => {
      directions.push(p1 || p2);
      return '';
    }).trim();

    return {
      speaker,
      stageDirection: directions.length > 0 ? directions.join('; ') : undefined,
      dialogue,
      isStageDirectionOnly: false
    };
  }

  // No speaker found - check for inline stage directions in regular text
  const directions: string[] = [];
  let dialogue = trimmed.replace(STAGE_DIRECTION_PATTERN, (_, p1, p2) => {
    directions.push(p1 || p2);
    return '';
  }).trim();

  // If we extracted directions but have no remaining dialogue, it's direction-only
  if (dialogue === '' && directions.length > 0) {
    return {
      dialogue: '',
      stageDirection: directions.join('; '),
      isStageDirectionOnly: true
    };
  }

  return {
    dialogue: dialogue || trimmed, // Fall back to original if no processing occurred
    stageDirection: directions.length > 0 ? directions.join('; ') : undefined,
    isStageDirectionOnly: false
  };
}

/**
 * Extract all unique speaker names from a script text.
 * Useful for translation prompts to ensure speaker names aren't translated.
 *
 * @param text - Full script text
 * @returns Array of unique speaker names
 */
export function extractSpeakerNames(text: string): string[] {
  const speakers = new Set<string>();
  const lines = text.split('\n');

  for (const line of lines) {
    const parsed = parseScriptLine(line);
    if (parsed.speaker) {
      speakers.add(parsed.speaker);
    }
  }

  return Array.from(speakers);
}

// ============================================
// CONTENT STRUCTURE ANALYSIS
// Detects anthology vs narrative structure for poetry
// ============================================

export interface StructureAnalysis {
  structureType: "prose" | "anthology" | "epic" | "script";
  confidence: number; // 0-1
  thematicSections: string[]; // e.g., ["I. LIFE.", "II. LOVE."]
  poemCount: number;
  avgPoemLength: number;
  hasEditorialNotes: boolean;
}

export interface EditorialNote {
  lineIndex: number;
  text: string;
  type: "publication" | "biographical" | "annotation";
}

/**
 * Analyze text structure to determine if it's an anthology or narrative poetry.
 *
 * Algorithm:
 * 1. Detect thematic section headers (I. LIFE., II. LOVE., etc.)
 * 2. Detect individual poem titles (ALL CAPS, short, standalone)
 * 3. Count distinct "poems" based on markers and blank line patterns
 * 4. Calculate average poem length
 *
 * Decision logic:
 * - Anthology: thematic sections (>=2) AND many short poems (>=10, avg <50 lines)
 * - Epic: numbered sections but continuous narrative (avg >30 lines per section)
 * - Script: detected by dialog patterns (handled elsewhere)
 * - Prose: default for no poetry markers
 *
 * @param text - Full text to analyze
 * @returns Structure analysis with detected type and markers
 */
export function analyzeContentStructure(text: string): StructureAnalysis {
  const lines = text.split('\n');

  // Pattern for thematic section headers: "I. LIFE." or "II. LOVE AND SORROW"
  // Roman numeral + period + ALL CAPS words + optional period
  const thematicSectionPattern = /^([IVXLC]+)\.\s+([A-Z][A-Z\s,'".-]+)\.?\s*$/;

  // Pattern for poem titles (ALL CAPS, short, standalone)
  const poemTitlePattern = /^[A-Z][A-Z\s,.'"-]{2,50}\.?\s*$/;

  // Detected markers
  const thematicSections: string[] = [];
  const poemBoundaries: number[] = [];
  let editorialNoteCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) continue;

    // Check for thematic section headers
    const thematicMatch = line.match(thematicSectionPattern);
    if (thematicMatch) {
      thematicSections.push(line);
      poemBoundaries.push(i);
      continue;
    }

    // Check for poem titles (ALL CAPS, standalone, not too long)
    if (poemTitlePattern.test(line) && line.length < 60) {
      // Verify next line is not another title (to avoid false positives)
      const nextLine = lines[i + 1]?.trim() || '';
      if (!poemTitlePattern.test(nextLine) && nextLine !== '') {
        poemBoundaries.push(i);
      }
      continue;
    }

    // Check for editorial notes
    if (/^\s*\[.{10,}\]\s*$/.test(line)) {
      editorialNoteCount++;
    }
  }

  // Calculate average content length between poem boundaries
  const poemLengths: number[] = [];
  for (let i = 0; i < poemBoundaries.length; i++) {
    const start = poemBoundaries[i];
    const end = poemBoundaries[i + 1] ?? lines.length;
    const contentLines = lines.slice(start, end).filter(l => l.trim().length > 0);
    poemLengths.push(contentLines.length);
  }

  const avgPoemLength = poemLengths.length > 0
    ? poemLengths.reduce((a, b) => a + b, 0) / poemLengths.length
    : 0;

  const poemCount = poemBoundaries.length;
  const hasThematicSections = thematicSections.length >= 2;
  const isManyShortPoems = poemCount >= 10 && avgPoemLength < 50;
  const isFewerLongerSections = poemCount > 0 && poemCount < 20 && avgPoemLength > 30;

  // Decision logic
  if (hasThematicSections && isManyShortPoems) {
    return {
      structureType: "anthology",
      confidence: 0.9,
      thematicSections,
      poemCount,
      avgPoemLength,
      hasEditorialNotes: editorialNoteCount > 2,
    };
  }

  if (hasThematicSections || (poemCount >= 5 && isManyShortPoems)) {
    return {
      structureType: "anthology",
      confidence: 0.7,
      thematicSections,
      poemCount,
      avgPoemLength,
      hasEditorialNotes: editorialNoteCount > 2,
    };
  }

  if (isFewerLongerSections && poemCount > 0) {
    return {
      structureType: "epic",
      confidence: 0.7,
      thematicSections,
      poemCount,
      avgPoemLength,
      hasEditorialNotes: editorialNoteCount > 0,
    };
  }

  // Default to prose
  return {
    structureType: "prose",
    confidence: 0.5,
    thematicSections: [],
    poemCount: 0,
    avgPoemLength: 0,
    hasEditorialNotes: editorialNoteCount > 0,
  };
}

/**
 * Detect editorial notes in text.
 *
 * Editorial notes are typically:
 * - Bracketed: [Published in "A Masque of Poets," 1878.]
 * - Contains publication/biographical information
 *
 * These should be preserved but not rewritten, and rendered in italics.
 *
 * @param lines - Array of text lines
 * @returns Array of detected editorial notes with line indices
 */
export function detectEditorialNotes(lines: string[]): EditorialNote[] {
  const notes: EditorialNote[] = [];

  const patterns = [
    // [Published in "Magazine Name", year]
    { regex: /^\s*\[.*(Published|First appeared|First printed|Written|Composed).+\]\s*$/i, type: "publication" as const },
    // [Born 1830, died 1886] or similar biographical
    { regex: /^\s*\[.*(Born|Died|lived|b\.\s*\d|d\.\s*\d).+\]\s*$/i, type: "biographical" as const },
    // [This poem refers to...] or [The following...]
    { regex: /^\s*\[.*(poem|refers|alludes|written for|dedicated|The following).+\]\s*$/i, type: "annotation" as const },
    // Generic bracketed text with 20+ chars that looks like a note
    { regex: /^\s*\[.{20,}\]\s*$/, type: "annotation" as const },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const pattern of patterns) {
      if (pattern.regex.test(line)) {
        // Extract the text without brackets
        const text = line.trim().replace(/^\[|\]$/g, '').trim();
        notes.push({
          lineIndex: i,
          text,
          type: pattern.type,
        });
        break; // Only match first pattern
      }
    }
  }

  return notes;
}
