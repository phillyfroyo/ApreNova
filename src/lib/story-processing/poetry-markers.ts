// src/lib/story-processing/poetry-markers.ts
// Poetry marker utilities for chapter-level poem processing
//
// This module provides utilities to:
// 1. Add explicit poem/stanza boundary markers to chapter text
// 2. Parse AI responses and validate marker preservation
// 3. Split large chapters at poem boundaries
//
// Marker format:
// [POEM: "Title"]      - Start of poem with title
// [STANZA]             - Stanza break within poem
// [/POEM]              - End of poem
// [N]                  - Line number (for translation only)

import { detectPoemBoundaries, type DetectedPoem } from "@/lib/text-processing";
import { detectStanzas, type StanzaDetectionResult } from "@/lib/poem-processing";
import { MAX_CHAPTER_TOKENS, CHARS_PER_TOKEN_ESTIMATE } from "./processing-config";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of adding poem and stanza markers to chapter text
 */
export interface MarkedPoetryResult {
  /** Text with markers added */
  markedText: string;
  /** Number of poems detected */
  poemCount: number;
  /** Total content lines (excluding markers) */
  totalLines: number;
  /** Poem metadata for validation */
  poems: {
    title: string;
    startLine: number;
    endLine: number;
    stanzaBreaks: number[];  // Line indices where [STANZA] markers appear
  }[];
}

/**
 * Parsed poem structure from AI response
 */
export interface ParsedPoem {
  title: string;
  stanzas: string[][];  // Each stanza is array of lines
  originalLineNumbers?: number[];  // For translation validation
}

/**
 * Result of parsing AI response with markers
 */
export interface ParsedChapterResult {
  poems: ParsedPoem[];
  errors: string[];
  allMarkersPreserved: boolean;
}

/**
 * Result of chapter-level poetry rewriting
 */
export interface ChapterRewriteResult {
  rewrittenText: string;
  poemCount: number;
  wasRewritten: boolean;
  usedFallback?: "poem" | "stanza";  // Which fallback was used, if any
}

// ============================================================================
// TOKEN ESTIMATION
// ============================================================================

/**
 * Estimate token count for text.
 * Uses simple character-based estimation (4 chars ~= 1 token for English).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE);
}

// ============================================================================
// MARKER ADDITION
// ============================================================================

/**
 * Add poem and stanza markers to chapter text.
 *
 * Marker format:
 * - [POEM: "Title"] at start of each poem
 * - [STANZA] between stanzas (not at start/end of poem)
 * - [/POEM] at end of each poem
 * - [N] line numbers (optional, for translation)
 *
 * @param chapterText - The chapter text to mark
 * @param options - Options for marker addition
 * @returns MarkedPoetryResult with marked text and metadata
 */
export function addPoemAndStanzaMarkers(
  chapterText: string,
  options: { includeLineNumbers: boolean } = { includeLineNumbers: false }
): MarkedPoetryResult {
  const lines = chapterText.split('\n');

  // Detect poem boundaries
  const detectedPoems = detectPoemBoundaries(lines);

  if (detectedPoems.length === 0) {
    // No poems detected - return original text
    return {
      markedText: chapterText,
      poemCount: 0,
      totalLines: lines.filter(l => l.trim()).length,
      poems: [],
    };
  }

  const markedLines: string[] = [];
  const poemMetadata: MarkedPoetryResult['poems'] = [];
  let globalLineNumber = 1;

  for (const poem of detectedPoems) {
    const poemTitle = poem.title || `Poem ${poemMetadata.length + 1}`;
    const stanzaBreaks: number[] = [];

    // Add poem start marker
    markedLines.push(`[POEM: "${poemTitle}"]`);

    // Detect stanzas within this poem
    const poemText = poem.lines.join('\n');
    const stanzaResult = detectStanzas(poemText, { method: 'adaptive' });

    // Track the start line for this poem in the output
    const poemStartLine = globalLineNumber;

    // Process each stanza
    let currentStanzaNum = -1;
    for (const annotatedLine of stanzaResult.annotatedLines) {
      if (annotatedLine.isStanzaBreak) {
        // Record stanza break position but don't add blank line yet
        // We'll add [STANZA] marker when we see the next stanza number
        continue;
      }

      // New stanza? Add [STANZA] marker (except for first stanza)
      if (annotatedLine.stanzaNumber !== currentStanzaNum) {
        if (currentStanzaNum !== -1) {
          // Not the first stanza - add break marker
          stanzaBreaks.push(globalLineNumber);
          markedLines.push('[STANZA]');
        }
        currentStanzaNum = annotatedLine.stanzaNumber;
      }

      // Add the line (with or without line number)
      const lineText = annotatedLine.text;
      if (options.includeLineNumbers) {
        markedLines.push(`[${globalLineNumber}] ${lineText}`);
      } else {
        markedLines.push(lineText);
      }
      globalLineNumber++;
    }

    // Add poem end marker
    markedLines.push('[/POEM]');
    markedLines.push('');  // Blank line between poems

    poemMetadata.push({
      title: poemTitle,
      startLine: poemStartLine,
      endLine: globalLineNumber - 1,
      stanzaBreaks,
    });
  }

  return {
    markedText: markedLines.join('\n').trimEnd(),
    poemCount: detectedPoems.length,
    totalLines: globalLineNumber - 1,
    poems: poemMetadata,
  };
}

// ============================================================================
// MARKER PARSING
// ============================================================================

/**
 * Parse AI response with poem/stanza markers and validate preservation.
 *
 * @param aiResponse - The AI's response text with markers
 * @param expectedPoemCount - Expected number of poems for validation
 * @param options - Validation options
 * @returns ParsedChapterResult with parsed poems and validation info
 */
export function parsePoemAndStanzaMarkers(
  aiResponse: string,
  expectedPoemCount: number,
  options: { validateLineNumbers: boolean } = { validateLineNumbers: false }
): ParsedChapterResult {
  const errors: string[] = [];
  const poems: ParsedPoem[] = [];

  // Regex patterns for markers
  const poemStartPattern = /^\[POEM:\s*"([^"]+)"\]\s*$/;
  const poemEndPattern = /^\[\/POEM\]\s*$/;
  const stanzaPattern = /^\[STANZA\]\s*$/;
  const lineNumberPattern = /^\[(\d+)\]\s*(.*)$/;

  const lines = aiResponse.split('\n');
  let currentPoem: ParsedPoem | null = null;
  let currentStanza: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for poem start
    const startMatch = trimmed.match(poemStartPattern);
    if (startMatch) {
      // Start new poem
      if (currentPoem) {
        // Close previous poem (shouldn't happen if markers are correct)
        if (currentStanza.length > 0) {
          currentPoem.stanzas.push(currentStanza);
        }
        poems.push(currentPoem);
        errors.push(`Poem "${currentPoem.title}" was not closed with [/POEM]`);
      }
      currentPoem = {
        title: startMatch[1],
        stanzas: [],
        originalLineNumbers: options.validateLineNumbers ? [] : undefined,
      };
      currentStanza = [];
      continue;
    }

    // Check for poem end
    if (poemEndPattern.test(trimmed)) {
      if (currentPoem) {
        // Close current stanza and poem
        if (currentStanza.length > 0) {
          currentPoem.stanzas.push(currentStanza);
        }
        poems.push(currentPoem);
        currentPoem = null;
        currentStanza = [];
      } else {
        errors.push(`Found [/POEM] without matching [POEM:] at line ${i + 1}`);
      }
      continue;
    }

    // Check for stanza break
    if (stanzaPattern.test(trimmed)) {
      if (currentPoem && currentStanza.length > 0) {
        currentPoem.stanzas.push(currentStanza);
        currentStanza = [];
      }
      continue;
    }

    // Skip blank lines between poems
    if (!trimmed && !currentPoem) {
      continue;
    }

    // Regular content line
    if (currentPoem) {
      // Extract line number if present and validation is enabled
      if (options.validateLineNumbers) {
        const lineNumMatch = trimmed.match(lineNumberPattern);
        if (lineNumMatch) {
          currentPoem.originalLineNumbers?.push(parseInt(lineNumMatch[1], 10));
          currentStanza.push(lineNumMatch[2]);
        } else {
          // Line without number when we expect numbers
          currentStanza.push(trimmed);
        }
      } else {
        // For rewriting, don't strip line numbers (there shouldn't be any)
        currentStanza.push(line);  // Preserve original whitespace
      }
    }
  }

  // Handle unclosed poem at end
  if (currentPoem) {
    if (currentStanza.length > 0) {
      currentPoem.stanzas.push(currentStanza);
    }
    poems.push(currentPoem);
    errors.push(`Poem "${currentPoem.title}" was not closed with [/POEM]`);
  }

  // Validate poem count
  if (poems.length !== expectedPoemCount) {
    errors.push(`Expected ${expectedPoemCount} poems, found ${poems.length}`);
  }

  return {
    poems,
    errors,
    allMarkersPreserved: errors.length === 0 && poems.length === expectedPoemCount,
  };
}

// ============================================================================
// CHAPTER RECONSTRUCTION
// ============================================================================

/**
 * Reconstruct chapter text from parsed poems.
 * Used after validating AI response to get clean output.
 *
 * IMPORTANT: We do NOT add the title separately because:
 * 1. The AI response preserves the original structure
 * 2. The title is typically the first line of the first stanza
 * 3. Adding it again would cause duplication
 *
 * @param poems - Array of parsed poems
 * @returns Reconstructed chapter text with proper spacing
 */
export function reconstructChapterFromPoems(poems: ParsedPoem[]): string {
  const sections: string[] = [];

  for (const poem of poems) {
    const poemLines: string[] = [];

    // Add stanzas with proper spacing
    // Note: We do NOT add the title separately - it's preserved in the stanza content
    // The AI's response maintains the original structure including any title lines
    for (let i = 0; i < poem.stanzas.length; i++) {
      const stanza = poem.stanzas[i];

      // Add stanza lines
      poemLines.push(...stanza);

      // Add blank line between stanzas (not after last)
      if (i < poem.stanzas.length - 1) {
        poemLines.push('');
      }
    }

    sections.push(poemLines.join('\n'));
  }

  // Join poems with double blank lines
  return sections.join('\n\n\n');
}

// ============================================================================
// CHAPTER SPLITTING
// ============================================================================

/**
 * Split a large chapter at poem boundaries to stay within token limits.
 * Never splits in the middle of a poem.
 *
 * @param chapterText - The chapter text to split
 * @param maxTokens - Maximum tokens per chunk (defaults to MAX_CHAPTER_TOKENS)
 * @returns Array of text chunks, each containing complete poems
 */
export function splitChapterAtPoemBoundaries(
  chapterText: string,
  maxTokens: number = MAX_CHAPTER_TOKENS
): string[] {
  const lines = chapterText.split('\n');
  const poems = detectPoemBoundaries(lines);

  if (poems.length === 0) {
    // No poems detected - return as single chunk
    return [chapterText];
  }

  const chunks: string[] = [];
  let currentChunkPoems: DetectedPoem[] = [];
  let currentTokens = 0;

  for (const poem of poems) {
    const poemText = poem.lines.join('\n');
    const poemTokens = estimateTokens(poemText);

    // If single poem exceeds limit, it still goes as its own chunk
    // (will fall back to stanza-level processing later)
    if (poemTokens > maxTokens) {
      // Finalize current chunk if it has content
      if (currentChunkPoems.length > 0) {
        chunks.push(joinPoemsToText(currentChunkPoems));
        currentChunkPoems = [];
        currentTokens = 0;
      }
      // Add the large poem as its own chunk
      chunks.push(poemText);
      continue;
    }

    // Would adding this poem exceed the limit?
    if (currentTokens + poemTokens > maxTokens && currentChunkPoems.length > 0) {
      // Finalize current chunk
      chunks.push(joinPoemsToText(currentChunkPoems));
      currentChunkPoems = [];
      currentTokens = 0;
    }

    // Add poem to current chunk
    currentChunkPoems.push(poem);
    currentTokens += poemTokens;
  }

  // Don't forget the last chunk
  if (currentChunkPoems.length > 0) {
    chunks.push(joinPoemsToText(currentChunkPoems));
  }

  return chunks.length > 0 ? chunks : [chapterText];
}

/**
 * Join detected poems back into text with proper spacing
 */
function joinPoemsToText(poems: DetectedPoem[]): string {
  return poems
    .map(poem => poem.lines.join('\n'))
    .join('\n\n\n');  // Triple newline between poems
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate that stanza counts match between original and rewritten poems.
 *
 * @param originalPoems - Original poem metadata from addPoemAndStanzaMarkers
 * @param parsedPoems - Parsed poems from AI response
 * @returns Object with validation result and any mismatches
 */
export function validateStanzaCounts(
  originalPoems: MarkedPoetryResult['poems'],
  parsedPoems: ParsedPoem[]
): { valid: boolean; mismatches: string[] } {
  const mismatches: string[] = [];

  if (originalPoems.length !== parsedPoems.length) {
    return {
      valid: false,
      mismatches: [`Poem count mismatch: expected ${originalPoems.length}, got ${parsedPoems.length}`],
    };
  }

  for (let i = 0; i < originalPoems.length; i++) {
    const original = originalPoems[i];
    const parsed = parsedPoems[i];

    // Original stanza count = stanzaBreaks.length + 1 (first stanza has no break)
    const expectedStanzas = original.stanzaBreaks.length + 1;
    const actualStanzas = parsed.stanzas.length;

    if (expectedStanzas !== actualStanzas) {
      mismatches.push(
        `Poem "${original.title}": expected ${expectedStanzas} stanzas, got ${actualStanzas}`
      );
    }
  }

  return {
    valid: mismatches.length === 0,
    mismatches,
  };
}
