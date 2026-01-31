// src/lib/text-processing/content-processors/script-processor.ts
// Script processing (screenplays, transcripts)

import type {
  ContentType,
  PreprocessedText,
  LineBreakStyle,
  ParsedScriptLine,
} from '../types';

import { runAllCleanup } from '../shared/cleanup';
import {
  normalizeLineBreaks,
  normalizeWhitespace,
} from '../shared/whitespace';
import {
  removeGutenbergFrontMatter,
  extractBackMatter,
} from '../shared/gutenberg';
import {
  detectChapterMarkers,
  filterOutTOCMarkers,
  splitIntoChapters,
  extractFrontMatter,
} from '../shared/chapter-detection';

// ============================================================================
// SCRIPT LINE PARSING
// ============================================================================

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
    dialogue: dialogue || trimmed,
    stageDirection: directions.length > 0 ? directions.join('; ') : undefined,
    isStageDirectionOnly: false
  };
}

/**
 * Extract all unique speaker names from a script text.
 * Useful for translation prompts to ensure speaker names aren't translated.
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

// ============================================================================
// SCRIPT PREPROCESSING
// ============================================================================

/**
 * Preprocess script text (screenplays, transcripts)
 *
 * Script processing:
 * - Preserves intentional line breaks (dialogue structure)
 * - Uses ACT/SCENE markers as chapters if present
 * - Does NOT join lines into paragraphs
 */
export function preprocessScript(
  rawText: string,
  forceStructureType?: ContentType
): PreprocessedText {
  const originalLength = rawText.length;

  // Step 0: Remove Gutenberg front matter markers
  const noGutenbergHeader = removeGutenbergFrontMatter(rawText);

  // Step 1: Run cleanup (remove line numbers, page markers, footnotes, asterisks)
  const { text: cleanedText, stats: cleanupStats } = runAllCleanup(noGutenbergHeader);

  // Step 2: Normalize whitespace (scripts need moderate normalization)
  const normalized = normalizeWhitespace(cleanedText);

  // Step 3: Split into lines for analysis
  let lines = normalized.split('\n');

  // Step 4: Detect and remove back matter
  const { contentLines, backMatter, removed: backMatterRemoved } = extractBackMatter(lines);
  lines = contentLines;

  // Step 5: Structure type is script
  const structureType: ContentType = forceStructureType || 'script';

  // Step 6: Detect chapter markers (will find ACT/SCENE markers)
  const rawMarkers = detectChapterMarkers(lines, { structureType });
  const markers = filterOutTOCMarkers(rawMarkers, lines);

  // Step 7: Extract front matter
  const firstChapterLine = markers.length > 0 ? markers[0].lineIndex : lines.length;
  const frontMatter = extractFrontMatter(lines, firstChapterLine);

  // Step 8: Split into chapters, preserving markers
  let chapters = splitIntoChapters(lines, markers, { preserveMarkers: true });

  // Step 9: Filter out empty/boilerplate chapters
  chapters = chapters.filter(chapter => {
    const text = chapter.rawText.trim();
    if (text.length < 50) return false;
    if (/Project Gutenberg/i.test(text) && text.length < 500) return false;
    return true;
  });

  // Renumber chapters
  chapters = chapters.map((ch, idx) => ({
    ...ch,
    number: idx + 1,
  }));

  // Step 10: Normalize line breaks (preserve intentional for scripts)
  const lineBreakStyle: LineBreakStyle = 'intentional';
  chapters = chapters.map(ch => ({
    ...ch,
    rawText: normalizeLineBreaks(ch.rawText, lineBreakStyle),
  }));

  // Step 11: Build full cleaned text
  const cleanedFullText = chapters
    .map((ch) => {
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
      lineNumbersRemoved: cleanupStats.lineNumbersRemoved,
      pageMarkersRemoved: cleanupStats.pageMarkersRemoved,
      footnoteIndicatorsRemoved: cleanupStats.footnoteIndicatorsRemoved,
      asteriskDividersRemoved: cleanupStats.asteriskDividersRemoved,
      chaptersDetected: chapters.length,
      backMatterRemoved,
      lineBreakStyle,
      structureType,
    },
    cleanedFullText,
  };
}
