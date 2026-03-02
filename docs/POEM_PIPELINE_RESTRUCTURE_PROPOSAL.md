# Poem/Stanza Pipeline Restructuring Proposal

## Executive Summary

The current story processing pipeline has grown organically to ~14,500 lines across 33 files. While the overall architecture is reasonable, the **poem/stanza handling** is fragmented across multiple files with unclear data contracts at each stage. This makes it extremely difficult to debug issues like "blank lines disappearing" because the same data passes through 5+ transformation stages.

**Recommendation**: A targeted restructure of the poem/stanza pipeline (not a full rewrite) to create a single source of truth for stanza detection with clear data contracts.

---

## Current Problem Analysis

### The Debugging Loop We're Stuck In

```
Upload poem → [??? blank lines disappear ???] → All lines treated as one stanza
```

We've been adding debug logs throughout the pipeline trying to find WHERE blank lines disappear. This symptom indicates:

1. **No clear data contract** - We don't know what the data SHOULD look like at each stage
2. **Multiple transformation points** - Blank lines could be stripped at any of 5+ stages
3. **Duplicate logic** - `detectStanzas()` exists but is potentially bypassed or receiving pre-filtered input

### Current Data Flow (Poem Path)

```
Stage 1: HTML Extraction (text-utils.ts)
         Input: Raw HTML file
         Output: Text with \n for line breaks
         Risk: Empty <p> tags may or may not become blank lines

Stage 2: Preprocessing (text-preprocessor.ts)
         Input: Raw text
         Output: ParsedChapters[] with rawText per chapter
         Risk: normalizeLineBreaks() may collapse blanks for "prose-wrapped" detection

Stage 3: Chapter Parsing (text-processing.ts → parseChapters)
         Input: Preprocessed text
         Output: chapters[].text
         Risk: May trim/clean chapter text

Stage 4: Story Type Preprocessing (level-processor.ts → preprocessChapterForStoryType)
         Input: chapter.text
         Output: processedLines[] + lineMetadata Map
         Risk: detectStanzas() is called HERE, but what is input?

Stage 5: Translation (translation.ts)
         Input: processedLines.join('\n')
         Output: translatedLines[]
         Risk: addLineNumbers() filters blank lines to blankLinePositions array

Stage 6: Content Building (text-processing.ts → buildContentStructureWithMetadata)
         Input: sourceLines, translatedLines, lineMetadata
         Output: PageContent with lines[] or stanzas[][]
         Risk: Stanza grouping logic may not receive correct stanzaNumber metadata
```

**The Problem**: We have 6 stages, each with its own assumptions about blank line handling. There's no single authoritative source that says "this is how poem data should look at this stage."

---

## Proposed Architecture

### Design Principles

1. **Single Source of Truth**: One module handles ALL stanza/poem logic
2. **Immutable Data Contracts**: Define TypeScript interfaces for data at each stage
3. **Early Detection, Late Application**: Detect stanzas ONCE at the beginning, carry metadata through
4. **No Silent Transformations**: Every blank line removal must be explicit and logged

### New Module Structure

```
src/lib/poem-processing/
├── index.ts                    # Barrel export
├── types.ts                    # All poem-related types
├── stanza-detector.ts          # THE single stanza detection implementation
├── poem-boundary-detector.ts   # Anthology poem separation
├── poem-paginator.ts           # Poem-aware pagination
└── __tests__/
    ├── stanza-detector.test.ts
    └── poem-paginator.test.ts
```

### Data Contracts (types.ts)

```typescript
// src/lib/poem-processing/types.ts

/**
 * Raw poem text as extracted from source.
 * This is the FIRST representation after HTML extraction.
 * INVARIANT: Blank lines MUST be preserved as empty strings.
 */
export interface RawPoemText {
  /** Original text with \n separators. Blank lines = empty strings when split. */
  text: string;
  /** Source of the text (for debugging) */
  source: 'html' | 'txt' | 'md' | 'rtf';
}

/**
 * A single line with stanza metadata attached.
 * This is produced by stanza detection.
 */
export interface AnnotatedPoemLine {
  /** The line text (empty string for stanza breaks) */
  text: string;
  /** 1-based stanza number this line belongs to */
  stanzaNumber: number;
  /** True if this is a blank line marking stanza boundary */
  isStanzaBreak: boolean;
  /** Original line index in source (for debugging) */
  sourceIndex: number;
}

/**
 * Result of stanza detection.
 * Contains both flat list and grouped representation.
 */
export interface StanzaDetectionResult {
  /** All lines with stanza annotations */
  lines: AnnotatedPoemLine[];
  /** Lines grouped by stanza (excludes stanza break markers) */
  stanzas: AnnotatedPoemLine[][];
  /** Number of stanzas detected */
  stanzaCount: number;
  /** Detection metadata for debugging */
  detection: {
    totalLines: number;
    blankLines: number;
    contentLines: number;
    /** Which detection method was used */
    method: 'single-blank' | 'double-blank' | 'adaptive';
    /** Threshold used for stanza breaks */
    blankThreshold: number;
  };
}

/**
 * A poem within an anthology.
 */
export interface DetectedPoem {
  /** 1-based poem number */
  number: number;
  /** Poem title (extracted from ALL CAPS header or Roman numeral) */
  title: string;
  /** Start line index (inclusive) */
  startLine: number;
  /** End line index (exclusive) */
  endLine: number;
  /** Lines belonging to this poem (with stanza annotations) */
  lines: AnnotatedPoemLine[];
  /** Stanzas within this poem */
  stanzas: AnnotatedPoemLine[][];
}

/**
 * Final bilingual poem line for storage/rendering.
 */
export interface BilingualPoemLine {
  en: string;
  es: string;
  stanzaNumber: number;
  isStanzaBreak: boolean;
}

/**
 * Page content for a poem page.
 * INVARIANT: Always has stanzas array for poems, never just lines.
 */
export interface PoemPageContent {
  /** Nested stanzas - each inner array is one stanza */
  stanzas: BilingualPoemLine[][];
  /** For anthologies: which poem this belongs to */
  poemNumber?: number;
  poemTitle?: string;
  isFirstPageOfPoem?: boolean;
  isContinuation?: boolean;
}
```

### Stanza Detector (stanza-detector.ts)

```typescript
// src/lib/poem-processing/stanza-detector.ts

import {
  RawPoemText,
  AnnotatedPoemLine,
  StanzaDetectionResult
} from './types';

/**
 * Configuration for stanza detection.
 */
export interface StanzaDetectorConfig {
  /**
   * How to detect stanza breaks.
   * - 'single-blank': Any single blank line starts new stanza (traditional)
   * - 'double-blank': Require 2+ blanks (Gutenberg visual spacing)
   * - 'adaptive': Auto-detect based on blank line patterns
   */
  method: 'single-blank' | 'double-blank' | 'adaptive';
}

const DEFAULT_CONFIG: StanzaDetectorConfig = {
  method: 'adaptive',
};

/**
 * THE single source of truth for stanza detection.
 * All other code should use this, never implement their own.
 *
 * @param input - Raw poem text (blank lines preserved)
 * @param config - Detection configuration
 * @returns Annotated lines with stanza information
 */
export function detectStanzas(
  input: RawPoemText | string,
  config: StanzaDetectorConfig = DEFAULT_CONFIG
): StanzaDetectionResult {
  const text = typeof input === 'string' ? input : input.text;
  const lines = text.split('\n');

  // Log input for debugging
  const blankCount = lines.filter(l => l.trim() === '').length;
  const contentCount = lines.length - blankCount;
  console.log(`[StanzaDetector] Input: ${lines.length} lines (${contentCount} content, ${blankCount} blank)`);

  // Determine blank threshold
  const threshold = determineBlankThreshold(lines, config.method);
  console.log(`[StanzaDetector] Using method=${config.method}, threshold=${threshold}`);

  // Build annotated lines
  const annotatedLines: AnnotatedPoemLine[] = [];
  const stanzas: AnnotatedPoemLine[][] = [];
  let currentStanza = 1;
  let currentStanzaLines: AnnotatedPoemLine[] = [];
  let consecutiveBlanks = 0;
  let lastWasContent = false;

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const isBlank = trimmed === '';

    if (isBlank) {
      if (lastWasContent) {
        consecutiveBlanks++;
      }
      // Don't add blank lines to annotatedLines yet - wait to see if it's a stanza break
    } else {
      // Content line
      if (consecutiveBlanks >= threshold && lastWasContent) {
        // Stanza break detected
        // Add break markers for visual spacing
        for (let i = 0; i < consecutiveBlanks; i++) {
          annotatedLines.push({
            text: '',
            stanzaNumber: currentStanza,
            isStanzaBreak: true,
            sourceIndex: index - consecutiveBlanks + i,
          });
        }
        // Save current stanza and start new one
        if (currentStanzaLines.length > 0) {
          stanzas.push([...currentStanzaLines]);
          currentStanzaLines = [];
        }
        currentStanza++;
      }
      consecutiveBlanks = 0;

      const annotatedLine: AnnotatedPoemLine = {
        text: line, // Preserve original whitespace (indentation)
        stanzaNumber: currentStanza,
        isStanzaBreak: false,
        sourceIndex: index,
      };
      annotatedLines.push(annotatedLine);
      currentStanzaLines.push(annotatedLine);
      lastWasContent = true;
    }
  });

  // Don't forget last stanza
  if (currentStanzaLines.length > 0) {
    stanzas.push(currentStanzaLines);
  }

  console.log(`[StanzaDetector] Result: ${stanzas.length} stanzas, ${annotatedLines.length} annotated lines`);

  return {
    lines: annotatedLines,
    stanzas,
    stanzaCount: stanzas.length,
    detection: {
      totalLines: lines.length,
      blankLines: blankCount,
      contentLines: contentCount,
      method: config.method,
      blankThreshold: threshold,
    },
  };
}

/**
 * Determine blank line threshold based on method and content analysis.
 */
function determineBlankThreshold(
  lines: string[],
  method: StanzaDetectorConfig['method']
): number {
  if (method === 'single-blank') return 1;
  if (method === 'double-blank') return 2;

  // Adaptive: analyze the content
  let contentLines = 0;
  let contentFollowedBySingleBlank = 0;
  let lastWasContent = false;
  let consecutiveBlanks = 0;

  for (const line of lines) {
    if (line.trim() === '') {
      consecutiveBlanks++;
    } else {
      if (lastWasContent && consecutiveBlanks === 1) {
        contentFollowedBySingleBlank++;
      }
      contentLines++;
      consecutiveBlanks = 0;
      lastWasContent = true;
    }
  }

  // If >70% of content lines followed by single blank, it's visual spacing pattern
  const ratio = contentLines > 0 ? contentFollowedBySingleBlank / contentLines : 0;
  const threshold = ratio > 0.7 ? 2 : 1;

  console.log(`[StanzaDetector] Adaptive analysis: ${(ratio * 100).toFixed(1)}% followed by single blank → threshold=${threshold}`);

  return threshold;
}
```

### Integration Points

The new module would be integrated at these points:

```typescript
// In level-processor.ts → preprocessChapterForStoryType

import { detectStanzas, StanzaDetectionResult } from '@/lib/poem-processing';

// Replace current implementation with:
if (storyType === 'poem' || storyType === 'song-lyrics' || storyType === 'epic') {
  const result: StanzaDetectionResult = detectStanzas(chapterText, {
    method: 'adaptive',
  });

  // Convert to existing format for compatibility
  const processedLines: string[] = [];
  result.lines.forEach((annotatedLine, idx) => {
    lineMetadata.set(idx, {
      stanzaNumber: annotatedLine.stanzaNumber,
      isStanzaBreak: annotatedLine.isStanzaBreak,
    });
    processedLines.push(annotatedLine.text);
  });

  return { processedLines, lineMetadata, speakerNames };
}
```

---

## Implementation Plan

### Phase 1: Create New Module (Day 1)

1. Create `src/lib/poem-processing/` directory
2. Implement `types.ts` with all contracts
3. Implement `stanza-detector.ts` with comprehensive logging
4. Write unit tests for stanza detection

### Phase 2: Integration (Day 1-2)

1. Update `level-processor.ts` to use new stanza detector
2. Update `text-processing.ts` to use types from new module
3. Remove duplicate `detectStanzas` from `text-preprocessor.ts`
4. Add integration tests

### Phase 3: Validation (Day 2)

1. Upload Emily Dickinson anthology
2. Verify stanza detection logs show correct behavior
3. Verify UI renders stanzas correctly
4. Verify emoji interactions work at stanza level

### Phase 4: Cleanup (Day 3)

1. Remove debug logging (keep structured logging)
2. Document the new module
3. Update existing tests

---

## Benefits of This Approach

1. **Single Source of Truth**: All stanza logic in one place
2. **Clear Contracts**: TypeScript interfaces define data shape at each stage
3. **Debuggability**: Structured logging shows exactly what's happening
4. **Testability**: Small, focused module is easy to unit test
5. **Gradual Migration**: Can integrate incrementally without breaking existing code

---

## Alternative: Quick Fix vs Restructure

If you need a quick fix NOW:

1. Add comprehensive logging at every transformation stage
2. Run one more test with Emily Dickinson
3. Identify exact stage where blank lines disappear
4. Fix that specific stage

However, this is treating symptoms, not the disease. The underlying architecture issue will cause similar debugging loops for future features.

**Recommendation**: Invest the 2-3 days in restructuring. It will pay off quickly.

---

## Decision Required

1. **Full restructure** (2-3 days) - Implement new poem-processing module
2. **Quick fix** (1-2 hours) - One more debug cycle to find the exact issue
3. **Hybrid** - Quick fix now, restructure next sprint

Please let me know your preference.
