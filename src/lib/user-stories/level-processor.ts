// src/lib/user-stories/level-processor.ts
// Handles processing of a single CEFR level for a user story
//
// New architecture (v2):
// - Separate functions for rewriting, translating, and building
// - Pipeline calls rewrite for ALL levels first, then translate for ALL levels
// - This is more logical and allows for potential parallelization

import { USER_STORY_LIMITS, STREAMING_LIMITS } from "./limits";
import { LevelProgressTracker, updateStoryProgress, isStoryCancelled, StoryCancelledError, ChapterTranslationData } from "./progress-tracker";
import { prisma } from "@/lib/prisma";
import {
  rewriteToLevel,
  rewritePoemByStanza,
  rewritePoetryChapter,
  joinStanzasToText,
  joinStanzasWithSpacing,
  translateChapter,
  cleanText,
  collapseConsecutiveBlanks,
  parseChapters,
  buildContentStructure,
  buildContentStructureWithMetadata,
  buildSingleChapterContent,
  quickClean,
  levelStringToNumber,
  ParsedChapter,
  ChapterMetadata,
  ProcessedChapterData,
  ProcessedChapterDataWithMetadata,
  LineMetadata,
  // Types for content assembly
  LevelContent,
  ChapterContent,
  PageContent,
  PoemInfo,
  // Script parsing (poems now use poem-processing module)
  parseScriptLine,
  extractSpeakerNames,
  // Chunking for large chapters
  splitIntoSubChunks,
  reassembleChunks,
  MAX_CHUNK_CHARS,
  // Error handling
  categorizeError,
  isRetryableError,
  getRetryDelay,
  RETRY_CONFIG,
} from "@/lib/story-processing";

// NEW: Single source of truth for stanza detection
import {
  detectStanzas,
  toMetadataMap,
  toTextLines,
  getStanzaParser,
  type SourceFormat,
} from "@/lib/poem-processing";
import { StreamingChapterQueue, QueuedChapter } from "./chapter-queue";
import { StoryType } from "@/types/story";
import { detectAlignmentIssues } from "./alignment-check";

// ============================================================================
// TYPES
// ============================================================================

export interface LevelProcessingParams {
  storyId: string;
  userId: string;
  levelId: string;
  level: string;
  rawContent: string;
  sourceLanguage: "en" | "es";
  detectedLevel: string;
  storySlug: string;
  /** Story type for special preprocessing (poems, scripts) */
  storyType?: StoryType | null;
}

export interface LevelProcessingResult {
  success: boolean;
  error?: string;
}

export interface ParsedChapters {
  hasChapters: boolean;
  chapters: ParsedChapter[];
  cleanedContent: string;
  /** Detected content structure type (prose, anthology, epic, script) */
  structureType: "prose" | "anthology" | "epic" | "script";
}

export interface ProcessedChapter {
  sourceLines: string[];
  translatedLines: string[];
  metadata?: ChapterMetadata;
}

// Re-export for pipeline usage
export type { ProcessedChapterDataWithMetadata };

/** Context for cost tracking */
interface CostContext {
  storyId: string;
  userId: string;
}

// ============================================================================
// STORY-TYPE-AWARE PREPROCESSING (POEMS & SCRIPTS)
// ============================================================================

/**
 * Options for format-aware preprocessing
 */
export interface PreprocessOptions {
  /** Source file format for robust stanza detection */
  sourceFormat?: SourceFormat | null;
  /** Raw HTML content (only for HTML uploads) */
  rawHtml?: string | null;
}

/**
 * Preprocess chapter text based on story type to extract line metadata.
 * - For poems: Detects stanza breaks and assigns stanza numbers
 * - For scripts: Extracts speaker names, annotations, and stage directions
 *
 * NEW: When sourceFormat and rawHtml are provided (from HTML uploads),
 * uses semantic <p> tag parsing instead of ratio-based heuristics.
 * This provides much more accurate stanza detection for sources like
 * Project Gutenberg where empty <p> tags mark stanza boundaries.
 *
 * @param chapterText - The chapter text to preprocess
 * @param storyType - The detected story type (poem, tv-script, movie-script, etc.)
 * @param options - Optional format info for robust stanza detection
 * @returns Object with processed lines and metadata map
 */
export function preprocessChapterForStoryType(
  chapterText: string,
  storyType: StoryType | null | undefined,
  options?: PreprocessOptions
): {
  /** Lines to translate (speaker names removed for scripts) */
  processedLines: string[];
  /** Metadata for each line (indexed by line position) */
  lineMetadata: Map<number, LineMetadata>;
  /** Speaker names found (for script translation prompts) */
  speakerNames: string[];
} {
  const lineMetadata = new Map<number, LineMetadata>();
  const speakerNames: string[] = [];

  // Handle poems - use format-specific parser when available
  if (storyType === 'poem' || storyType === 'song-lyrics' || storyType === 'epic') {
    // DEBUG: Log sample of input to stanza detector to trace spacing
    const debugLines = chapterText.split('\n').slice(0, 30);
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
    console.log(`[PreprocessChapter] DEBUG - Input to stanza detector (first 30 lines):`);
    console.log(`[PreprocessChapter] Consecutive blank runs in first 30 lines: [${consecutiveBlankRuns.join(', ')}]`);
    debugLines.forEach((l, i) => {
      const display = l.trim() === '' ? '(blank)' : l.slice(0, 50);
      console.log(`  ${i}: ${display}`);
    });

    // Use format-specific parser if source format info is available
    // This enables semantic HTML parsing for Gutenberg-style sources
    let stanzaResult;
    if (options?.sourceFormat || options?.rawHtml) {
      const { content, parse, parserType } = getStanzaParser(chapterText, {
        sourceFormat: options.sourceFormat,
        rawHtml: options.rawHtml,
      });
      console.log(`[PreprocessChapter] Using ${parserType} parser (sourceFormat: ${options.sourceFormat || 'unknown'})`);
      stanzaResult = parse(content);
    } else {
      // Fallback to adaptive stanza detection (legacy behavior)
      console.log(`[PreprocessChapter] No source format info, using adaptive stanza detection`);
      stanzaResult = detectStanzas(chapterText, { method: 'adaptive' });
    }

    // Convert to the format expected by the rest of the pipeline
    const processedLines = toTextLines(stanzaResult);
    const metadataMap = toMetadataMap(stanzaResult);

    // Copy to the lineMetadata map expected by this function
    metadataMap.forEach((meta, idx) => {
      lineMetadata.set(idx, {
        stanzaNumber: meta.stanzaNumber,
        isStanzaBreak: meta.isStanzaBreak,
      });
    });

    // DEBUG: Log stanza numbers in metadata
    const stanzaNumCounts = new Map<number, number>();
    lineMetadata.forEach((meta) => {
      if (!meta.isStanzaBreak && meta.stanzaNumber !== undefined) {
        const count = stanzaNumCounts.get(meta.stanzaNumber) || 0;
        stanzaNumCounts.set(meta.stanzaNumber, count + 1);
      }
    });
    console.log(`[PreprocessChapter] DEBUG - Stanza number distribution: ${Array.from(stanzaNumCounts.entries()).slice(0, 10).map(([n, c]) => `${n}:${c}`).join(', ')}...`);

    return { processedLines, lineMetadata, speakerNames };
  }

  // Handle scripts
  if (storyType === 'movie-script' || storyType === 'tv-script' || storyType === 'dialogue') {
    const lines = chapterText.split('\n');
    const processedLines: string[] = [];
    const foundSpeakers = new Set<string>();

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        // Empty line - skip but preserve index offset
        return;
      }

      const parsed = parseScriptLine(trimmed);

      // Track speaker name
      if (parsed.speaker) {
        foundSpeakers.add(parsed.speaker);
      }

      // Store metadata
      if (parsed.speaker || parsed.stageDirection || parsed.isStageDirectionOnly) {
        lineMetadata.set(processedLines.length, {
          speaker: parsed.speaker,
          speakerAnnotation: parsed.speakerAnnotation,
          stageDirection: parsed.stageDirection,
          isStageDirectionOnly: parsed.isStageDirectionOnly,
        });
      }

      // For translation, we send just the dialogue (speaker already extracted)
      // Stage directions are also sent separately for translation
      if (parsed.isStageDirectionOnly && parsed.stageDirection) {
        // This line is only a stage direction - translate it
        processedLines.push(parsed.stageDirection);
      } else {
        // Regular dialogue line (may have inline stage direction)
        processedLines.push(parsed.dialogue || trimmed);
      }
    });

    return {
      processedLines,
      lineMetadata,
      speakerNames: Array.from(foundSpeakers),
    };
  }

  // Default: no special preprocessing needed
  const lines = collapseConsecutiveBlanks(chapterText.split('\n'));
  return { processedLines: lines, lineMetadata, speakerNames };
}

// ============================================================================
// DELAY HELPER
// ============================================================================

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ============================================================================
// CHUNKED PROCESSING HELPERS
// ============================================================================

/**
 * Rewrite a single chapter, chunking if necessary for large content.
 * Returns the rewritten text (reassembled from chunks if chunked).
 *
 * For poetry: Uses chapter-level processing with explicit markers for ~99% cost reduction.
 * Falls back to poem-level then stanza-level if markers aren't preserved.
 */
async function rewriteChapterWithChunking(
  chapterText: string,
  detectedLevel: string,
  targetLevel: string,
  sourceLanguage: "en" | "es",
  ctx: CostContext,
  isPoetry: boolean = false
): Promise<string> {
  const rewriteOptions = {
    isPoetry,
    storyId: ctx.storyId,
    userId: ctx.userId,
  };

  // For poetry: use chapter-level processing with markers for dramatic cost reduction
  // This processes the entire chapter (or poem-boundary-aware chunks) in a single API call
  // instead of making 100+ calls for stanza-by-stanza processing
  if (isPoetry) {
    const chapterResult = await rewritePoetryChapter(
      chapterText,
      detectedLevel,
      targetLevel,
      sourceLanguage,
      rewriteOptions
    );

    if (chapterResult.usedFallback) {
      console.log(`[RewriteChapterWithChunking] Poetry rewrite used ${chapterResult.usedFallback}-level fallback`);
    }

    // Apply cleanText to normalize whitespace (same as admin pipeline)
    return cleanText(chapterResult.rewrittenText, { preserveWhitespace: true });
  }

  // For prose: check if chapter needs chunking
  if (chapterText.length <= MAX_CHUNK_CHARS) {
    // Small chapter - process directly
    const result = await rewriteToLevel(
      chapterText,
      detectedLevel,
      targetLevel,
      sourceLanguage,
      rewriteOptions
    );
    // Apply cleanText to normalize whitespace (same as admin pipeline)
    return cleanText(result.rewrittenText);
  }

  // Large prose chapter - split into chunks
  const chunks = splitIntoSubChunks(chapterText, MAX_CHUNK_CHARS);

  const rewrittenChunks: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    let lastError: Error | null = null;

    // Retry loop for each chunk
    for (let attempt = 1; attempt <= RETRY_CONFIG.MAX_REWRITE_RETRIES; attempt++) {
      try {
        const result = await rewriteToLevel(
          chunk,
          detectedLevel,
          targetLevel,
          sourceLanguage,
          rewriteOptions
        );
        rewrittenChunks.push(result.rewrittenText);
        lastError = null;
        break;
      } catch (error: any) {
        lastError = error;
        const errorType = categorizeError(error);

        if (!isRetryableError(errorType) || attempt === RETRY_CONFIG.MAX_REWRITE_RETRIES) {
          console.error(`[Chunking] Chunk ${i + 1}/${chunks.length} failed (${errorType}): ${error.message}`);
          // Use original chunk as fallback
          rewrittenChunks.push(chunk);
          break;
        }

        const retryDelay = getRetryDelay(errorType, attempt);
        console.warn(`[Chunking] Chunk ${i + 1} retry ${attempt}/${RETRY_CONFIG.MAX_REWRITE_RETRIES} after ${retryDelay}ms`);
        await delay(retryDelay);
      }
    }

    // Rate limit between chunks
    if (i < chunks.length - 1) {
      await delay(USER_STORY_LIMITS.MIN_DELAY_BETWEEN_AI_CALLS_MS);
    }
  }

  // Reassemble chunks and apply cleanText (same as admin pipeline)
  return cleanText(reassembleChunks(rewrittenChunks));
}

// ============================================================================
// PHASE 1: PARSING (shared across all levels)
// ============================================================================

/**
 * Options for parsing story content
 */
export interface ParseContentOptions {
  /**
   * Content structure type. When "auto" or undefined, will analyze text to detect.
   * - "anthology": Poetry collections - preserves "I. LIFE." markers in content
   * - "epic": Narrative poetry - preserves markers
   * - "prose": Standard novels/stories
   * - "script": Screenplays/transcripts
   */
  structureType?: "auto" | "prose" | "anthology" | "epic" | "script";
  /**
   * Story type hint from metadata detection. Used to infer structure type for poetry.
   */
  storyType?: string | null;
}

/**
 * Parse story content into chapters
 * This is done once and shared across all levels
 *
 * @param rawContent - Raw text content
 * @param options - Optional settings including structureType and storyType for handling
 */
export function parseStoryContent(
  rawContent: string,
  options: ParseContentOptions = {}
): ParsedChapters {
  // Infer structure type from storyType if not explicitly provided
  // Poetry types should use anthology structure to preserve formatting
  let effectiveStructureType = options.structureType || "auto";
  if (effectiveStructureType === "auto" && options.storyType) {
    const poetryTypes = ["poem", "song-lyrics", "epic"];
    if (poetryTypes.includes(options.storyType)) {
      effectiveStructureType = options.storyType === "epic" ? "epic" : "anthology";
    }
  }

  // For poetry, skip quickClean to preserve whitespace (indentation)
  // quickClean's normalizeWhitespace strips leading spaces which destroys poem formatting
  const isPoetry = effectiveStructureType === "anthology" || effectiveStructureType === "epic";
  const contentToProcess = isPoetry ? rawContent : quickClean(rawContent);

  // Parse chapters, passing structure type for proper marker handling
  // preprocessText inside parseChapters will do the detailed cleaning
  const parseResult = parseChapters(contentToProcess, {
    structureType: effectiveStructureType
  });

  return {
    hasChapters: parseResult.hasChapters,
    chapters: parseResult.chapters,
    cleanedContent: contentToProcess,
    structureType: parseResult.structureType,
  };
}

// ============================================================================
// PHASE 2: REWRITING (all levels that need it)
// ============================================================================

export interface RewriteParams {
  storyId: string;
  userId: string;
  levelId: string;
  level: string;
  chapters: ParsedChapter[];
  sourceLanguage: "en" | "es";
  detectedLevel: string;
  storyType?: string | null; // For poetry-specific rewrite handling
}

export interface RewriteResult {
  success: boolean;
  chapters: ParsedChapter[];
  error?: string;
}

/**
 * Rewrite chapters to target level if different from detected level
 * Returns the rewritten chapters (or original if no rewrite needed)
 * Preserves chapter metadata through the rewrite process.
 */
export async function rewriteLevelChapters(
  params: RewriteParams
): Promise<RewriteResult> {
  const {
    storyId,
    userId,
    levelId,
    level,
    chapters,
    sourceLanguage,
    detectedLevel,
    storyType,
  } = params;

  const ctx: CostContext = { storyId, userId };
  const needsRewrite = level !== detectedLevel;

  // Determine if this is poetry (requires strict line count preservation)
  const isPoetry = storyType === 'poem' || storyType === 'song-lyrics' || storyType === 'epic';

  // Initialize progress tracker
  const tracker = new LevelProgressTracker(levelId, chapters.length);

  try {
    await tracker.startProcessing();

    if (!needsRewrite) {
      // No rewrite needed, return original chapters with metadata preserved
      return { success: true, chapters };
    }

    await tracker.startRewriting();
    const rewrittenChapters: ParsedChapter[] = [];

    for (let i = 0; i < chapters.length; i++) {
      // Check for cancellation before each chapter
      if (await isStoryCancelled(storyId)) {
        console.log(`[LevelProcessor] Story ${storyId} cancelled, stopping rewrite at chapter ${i + 1}`);
        throw new StoryCancelledError(storyId);
      }

      const chapter = chapters[i];
      const chapterText = chapter.text;

      // Update story-level progress with chapter info
      await updateStoryProgress(storyId, "rewriting_chapter", {
        chapterCurrent: i + 1,
        chapterTotal: chapters.length,
        currentLevel: level,
      });

      // Update level-specific progress
      await tracker.updateRewriteProgress(i + 1);

      // Rewrite this chapter (with chunking for large chapters, strict line count for poetry)
      const rewrittenText = await rewriteChapterWithChunking(
        chapterText,
        detectedLevel,
        level,
        sourceLanguage,
        ctx,
        isPoetry
      );

      // Preserve metadata from original chapter
      rewrittenChapters.push({
        text: rewrittenText,
        metadata: chapter.metadata,
      });

      // Update progress with completed chapter data
      // Apply cleanText to normalize whitespace, then split
      // Keep blank lines (single \n\n paragraph spacing) for display in ComparisonModal
      const cleanedOriginal = cleanText(chapterText);
      const cleanedRewritten = cleanText(rewrittenText);
      await tracker.updateRewriteProgress(i + 1, {
        originalLines: cleanedOriginal.split("\n"),
        rewrittenLines: cleanedRewritten.split("\n"),
      });

      await delay(USER_STORY_LIMITS.MIN_DELAY_BETWEEN_AI_CALLS_MS);
    }

    return { success: true, chapters: rewrittenChapters };
  } catch (error: any) {
    console.error(`[LevelProcessor] Rewrite failed for level ${level}:`, error.message);
    // Don't mark as failed for cancellation - cancel API handles status
    if (!(error instanceof StoryCancelledError) && error.name !== "StoryCancelledError") {
      await tracker.markFailed();
    }
    return { success: false, chapters: [], error: error.message };
  }
}

// ============================================================================
// PHASE 3: TRANSLATION (all levels)
// ============================================================================

export interface TranslateParams {
  storyId: string;
  userId: string;
  levelId: string;
  level: string;
  storySlug: string;
  chapters: ParsedChapter[];
  sourceLanguage: "en" | "es";
  /** Story type for special preprocessing (poems, scripts) */
  storyType?: StoryType | null;
  /** Structure type for anthology pagination */
  structureType?: "prose" | "anthology" | "epic" | "script";
  /** Whether the story has multiple chapters (for content metadata) */
  hasChapters: boolean;
  /** Source file format for robust stanza detection */
  sourceFormat?: SourceFormat | null;
  /** Raw HTML content (only for HTML uploads) */
  rawHtml?: string | null;
}

export interface TranslateResult {
  success: boolean;
  processedChapters: ProcessedChapter[];
  /** Extended chapter data with line metadata (for poems/scripts) */
  processedChaptersWithMetadata?: ProcessedChapterDataWithMetadata[];
  error?: string;
}

/**
 * Translate all chapters to the opposite language
 * Preserves chapter metadata through the translation process.
 * For poems/scripts, also extracts line-level metadata (stanzas, speakers, stage directions).
 */
export async function translateLevelChapters(
  params: TranslateParams
): Promise<TranslateResult> {
  const { storyId, userId, levelId, level, storySlug, chapters, sourceLanguage, storyType, structureType, hasChapters, sourceFormat, rawHtml } = params;

  const ctx: CostContext = { storyId, userId };
  const tracker = new LevelProgressTracker(levelId, chapters.length);

  // Determine if this is poetry (for artistic translation handling)
  const isPoetry = storyType === 'poem' || storyType === 'song-lyrics' || storyType === 'epic';

  // Check if we need special preprocessing for this story type
  const needsMetadata = storyType && (
    storyType === 'poem' ||
    storyType === 'song-lyrics' ||
    storyType === 'epic' ||
    storyType === 'movie-script' ||
    storyType === 'tv-script' ||
    storyType === 'dialogue'
  );

  try {
    // Mark level as PROCESSING in database so streaming reader can work
    await tracker.startProcessing();
    await tracker.startTranslating();
    const processedChapters: ProcessedChapter[] = [];
    const processedChaptersWithMetadata: ProcessedChapterDataWithMetadata[] = [];

    for (let i = 0; i < chapters.length; i++) {
      // Check for cancellation before each chapter
      if (await isStoryCancelled(storyId)) {
        console.log(`[LevelProcessor] Story ${storyId} cancelled, stopping translation at chapter ${i + 1}`);
        throw new StoryCancelledError(storyId);
      }

      const chapter = chapters[i];
      const chapterText = chapter.text;

      // Update story-level progress with chapter info (shows which chapter is being worked on)
      await updateStoryProgress(storyId, "translating_chapter", {
        chapterCurrent: i + 1,
        chapterTotal: chapters.length,
        currentLevel: level,
      });

      // NOTE: Don't update level progress here - wait until chapter is complete
      // The chapter count should only increment AFTER content is written to the database

      // For prose: translate the chapter text directly (same as admin pipeline)
      // For poems/scripts: preprocess first to extract stanza/speaker metadata
      let processedLines: string[];
      let lineMetadata = new Map<number, LineMetadata>();
      let speakerNames: string[] = [];

      let filteredSourceLines: string[];
      let filteredTranslatedLines: string[];

      if (needsMetadata) {
        // Poems/scripts need special preprocessing for stanza/speaker metadata
        const preprocessed = preprocessChapterForStoryType(
          chapterText,
          storyType,
          { sourceFormat, rawHtml }
        );
        processedLines = preprocessed.processedLines;
        lineMetadata = preprocessed.lineMetadata;
        speakerNames = preprocessed.speakerNames;

        // Translate the processed lines using shared translateChapter
        const textToTranslate = processedLines.join('\n');
        const result = await translateChapter(textToTranslate, sourceLanguage, level, {
          storyId: ctx.storyId, userId: ctx.userId, isPoetry
        });

        // For poetry, preserve blank lines (they mark stanza breaks)
        filteredSourceLines = isPoetry ? processedLines : collapseConsecutiveBlanks(processedLines);
        filteredTranslatedLines = isPoetry
          ? result.translatedText.split('\n')
          : collapseConsecutiveBlanks(result.translatedText.split('\n'));
      } else {
        // Prose: use shared translateChapter (handles chunking, alignment, cleaning)
        const result = await translateChapter(chapterText, sourceLanguage, level, {
          storyId: ctx.storyId, userId: ctx.userId, isPoetry: false
        });

        // Clean source text and collapse consecutive blanks to single paragraph breaks
        const cleanedSource = cleanText(chapterText);
        filteredSourceLines = collapseConsecutiveBlanks(cleanedSource.split('\n'));
        filteredTranslatedLines = collapseConsecutiveBlanks(result.translatedText.split('\n'));
      }

      // Detect alignment issues
      const alignmentResult = detectAlignmentIssues(filteredSourceLines, filteredTranslatedLines);
      if (alignmentResult.hasIssues) {
        console.warn(`[Translate] Ch ${i + 1} alignment: ${alignmentResult.issueCount} issues`);
      }

      // Build processed chapter (basic version for backward compatibility)
      const chapterData: ProcessedChapter = {
        sourceLines: filteredSourceLines,
        translatedLines: filteredTranslatedLines,
        metadata: chapter.metadata,
      };
      processedChapters.push(chapterData);

      // Build extended chapter data with line metadata if needed
      if (needsMetadata && lineMetadata.size > 0) {
        // For scripts, we also need to translate stage directions
        const translatedStageDirections = new Map<number, string>();

        // Collect stage directions that need translation
        const stageDirectionsToTranslate: { idx: number; direction: string }[] = [];
        lineMetadata.forEach((meta, idx) => {
          if (meta.stageDirection) {
            stageDirectionsToTranslate.push({ idx, direction: meta.stageDirection });
          }
        });

        // Batch translate stage directions if any exist (stage directions are prose, not poetry)
        if (stageDirectionsToTranslate.length > 0) {
          const directionsText = stageDirectionsToTranslate.map(d => d.direction).join('\n');
          try {
            const dirResult = await translateChapter(directionsText, sourceLanguage, level, {
              storyId: ctx.storyId, userId: ctx.userId, isPoetry: false
            });
            // Map back to line indices
            const dirLines = dirResult.translatedText.split('\n');
            stageDirectionsToTranslate.forEach((d, translateIdx) => {
              if (dirLines[translateIdx]) {
                translatedStageDirections.set(d.idx, dirLines[translateIdx]);
              }
            });
          } catch (err) {
            console.warn(`[LevelProcessor] Stage direction translation failed, using originals`);
          }
        }

        const chapterDataWithMeta: ProcessedChapterDataWithMetadata = {
          sourceLines: filteredSourceLines,
          translatedLines: filteredTranslatedLines,
          metadata: chapter.metadata,
          lineMetadata,
          translatedStageDirections,
        };
        processedChaptersWithMetadata.push(chapterDataWithMeta);
      } else {
        // No special metadata - just copy basic data
        processedChaptersWithMetadata.push({
          sourceLines: filteredSourceLines,
          translatedLines: filteredTranslatedLines,
          metadata: chapter.metadata,
        });
      }

      // Build chapter content immediately and write directly to content field
      // This is the single source of truth - same content used for reading during and after processing
      const builtChapter = buildSingleChapterContent(
        filteredSourceLines,
        filteredTranslatedLines,
        sourceLanguage,
        structureType || "prose",
        lineMetadata.size > 0 ? lineMetadata : undefined
      );

      console.log(`[TranslateLevelChapters] Built chapter ${i + 1}: ${Object.keys(builtChapter.pages).length} pages` +
        (builtChapter.poems ? `, ${builtChapter.poems.length} poems` : ""));

      // Write chapter directly to the content field (single source of truth)
      await tracker.updateChapterContent(
        i + 1, // 1-based chapter number
        {
          pages: builtChapter.pages as any,
          metadata: chapter.metadata,
          poems: builtChapter.poems,
          alignmentIssues: alignmentResult.hasIssues ? alignmentResult : undefined,
        },
        {
          storySlug,
          level: levelStringToNumber(level),
          hasChapters,
          structureType: structureType || "prose",
        }
      );

      // Also update progress tracker with chapter data for ComparisonModal
      // Use the same filtered lines as stored content so progress viewer matches final output
      await tracker.updateTranslationProgress(i + 1, {
        sourceLines: filteredSourceLines,
        translatedLines: filteredTranslatedLines,
        alignmentIssues: alignmentResult.hasIssues ? alignmentResult : undefined,
      });

      await delay(USER_STORY_LIMITS.MIN_DELAY_BETWEEN_AI_CALLS_MS);
    }

    return {
      success: true,
      processedChapters,
      // Always return extended metadata to support structureType-based features (anthology pagination)
      processedChaptersWithMetadata,
    };
  } catch (error: any) {
    console.error(`[LevelProcessor] Translation failed for level ${level}:`, error.message);
    // Don't mark as failed for cancellation - cancel API handles status
    if (!(error instanceof StoryCancelledError) && error.name !== "StoryCancelledError") {
      await tracker.markFailed();
    }
    return { success: false, processedChapters: [], error: error.message };
  }
}

// ============================================================================
// PHASE 4: BUILD AND SAVE (all levels)
// ============================================================================

/**
 * Assemble final LevelContent from pre-built chapter pages.
 * This reuses the pages built during translation (streaming reader),
 * ensuring consistency between what users see while reading and the final saved content.
 *
 * @param storySlug - Story slug for the content structure
 * @param level - CEFR level number (1-6)
 * @param hasChapters - Whether the story has multiple chapters
 * @param completedData - Pre-built chapter data from progress tracker
 * @param structureType - Content structure type for navigation
 * @returns LevelContent ready to save to database
 */
export function assembleContentFromBuiltPages(
  storySlug: string,
  level: number,
  hasChapters: boolean,
  completedData: ChapterTranslationData[],
  structureType?: "prose" | "anthology" | "epic" | "script"
): LevelContent {
  const chapters: Record<number, ChapterContent> = {};

  for (let i = 0; i < completedData.length; i++) {
    const chapterData = completedData[i];
    const chapterNum = i + 1;

    if (!chapterData.builtPages) {
      // This shouldn't happen in normal flow, but log a warning
      console.warn(`[assembleContentFromBuiltPages] Chapter ${chapterNum} missing builtPages`);
      continue;
    }

    // Convert Record<number, BuiltPageContent> to Record<number, PageContent>
    // The types are compatible (BuiltPageContent has same structure as PageContent)
    const pages: Record<number, PageContent> = {};
    for (const [pageNumStr, builtPage] of Object.entries(chapterData.builtPages)) {
      const pageNum = parseInt(pageNumStr, 10);
      pages[pageNum] = builtPage as PageContent;
    }

    const chapterContent: ChapterContent = {
      pages,
      metadata: chapterData.metadata,
      poems: chapterData.poems,
    };

    chapters[chapterNum] = chapterContent;
  }

  // Check if any chapter has alignment issues
  const hasAlignmentIssues = completedData.some(ch => ch.alignmentIssues?.hasIssues);

  const content: LevelContent = {
    storySlug,
    level,
    hasChapters,
    chapters,
    structureType,
    hasAlignmentIssues: hasAlignmentIssues || undefined,
  };

  console.log(`[assembleContentFromBuiltPages] Assembled ${Object.keys(chapters).length} chapters for level ${level}` +
    (hasAlignmentIssues ? ' (has alignment issues)' : ''));

  return content;
}

export interface BuildAndSaveParams {
  storyId: string;
  levelId: string;
  level: string;
  storySlug: string;
  hasChapters: boolean;
  processedChapters: ProcessedChapter[];
  sourceLanguage: "en" | "es";
  /** Extended chapter data with line metadata (for poems/scripts) */
  processedChaptersWithMetadata?: ProcessedChapterDataWithMetadata[];
  /** Content structure type for anthology pagination */
  structureType?: "prose" | "anthology" | "epic" | "script";
}

export interface BuildAndSaveResult {
  success: boolean;
  error?: string;
}

/**
 * Build content structure and save to database.
 *
 * Optimization: When pre-built pages are available from the streaming pipeline,
 * we assemble the final content from those pages instead of rebuilding.
 * This ensures consistency between what users see in the streaming reader
 * and the final saved content.
 *
 * Falls back to full rebuild if pre-built pages are not available (backward compatibility).
 */
export async function buildAndSaveLevel(
  params: BuildAndSaveParams
): Promise<BuildAndSaveResult> {
  const {
    storyId,
    levelId,
    level,
    storySlug,
    hasChapters,
    processedChapters,
    sourceLanguage,
    processedChaptersWithMetadata,
    structureType,
  } = params;

  const tracker = new LevelProgressTracker(levelId, processedChapters.length);

  try {
    await updateStoryProgress(storyId, "building_structure", { currentLevel: level });
    const levelNum = levelStringToNumber(level);

    let content: LevelContent;

    // Prefer the content already written per-chapter by updateChapterContent() during
    // translation. This avoids re-paginating (which historically caused misalignment)
    // and keeps the final saved content identical to what the user previewed.
    let existingContent: LevelContent | undefined;
    try {
      const levelData = await prisma.userStoryLevel.findUnique({
        where: { id: levelId },
        select: { content: true },
      });

      if (levelData?.content) {
        const candidate = levelData.content as unknown as LevelContent;
        if (candidate.chapters && Object.keys(candidate.chapters).length > 0) {
          existingContent = candidate;
        }
      }
    } catch (error) {
      // Non-fatal: fall back to rebuild
      console.warn(`[BuildAndSaveLevel] Could not fetch existing content for level ${level}:`, error);
    }

    if (existingContent) {
      // Content was already built per-chapter during translation — use it directly
      console.log(`[BuildAndSaveLevel] Using existing content for level ${level} (${Object.keys(existingContent.chapters).length} chapters, already built per-chapter)`);
      content = existingContent;
      // Ensure metadata is up to date
      content.storySlug = storySlug;
      content.level = levelNum;
      content.hasChapters = hasChapters;
      if (structureType) content.structureType = structureType;
    } else {
      // Fall back to full rebuild (backward compatibility for levels without per-chapter content)
      console.log(`[BuildAndSaveLevel] Building level ${level} with structureType=${structureType} (full rebuild)`);

      content = processedChaptersWithMetadata
        ? buildContentStructureWithMetadata(
            storySlug,
            levelNum,
            hasChapters,
            processedChaptersWithMetadata,
            sourceLanguage,
            { structureType }
          )
        : buildContentStructure(
            storySlug,
            levelNum,
            hasChapters,
            processedChapters,
            sourceLanguage
          );
    }

    // Scan chapters for alignment issues and set top-level flag
    const anyChapterHasIssues = Object.values(content.chapters).some(
      ch => ch.alignmentIssues?.hasIssues
    );
    if (anyChapterHasIssues) {
      content.hasAlignmentIssues = true;
    }

    // Save and mark complete
    await updateStoryProgress(storyId, "saving_content", { currentLevel: level });
    await tracker.markComplete(content);

    return { success: true };
  } catch (error: any) {
    console.error(`[LevelProcessor] Build/save failed for level ${level}:`, error.message);
    // Don't mark as failed for cancellation - cancel API handles status
    if (!(error instanceof StoryCancelledError) && error.name !== "StoryCancelledError") {
      await tracker.markFailed();
    }
    return { success: false, error: error.message };
  }
}

// ============================================================================
// STREAMING PIPELINE: Producer-Consumer for parallel rewrite→translate
// ============================================================================

export interface StreamingLevelParams {
  storyId: string;
  userId: string;
  levelId: string;
  level: string;
  storySlug: string;
  chapters: ParsedChapter[];
  sourceLanguage: "en" | "es";
  detectedLevel: string;
  /** Story type for special preprocessing (poems, scripts) */
  storyType?: StoryType | null;
  /** Structure type for anthology pagination */
  structureType?: "prose" | "anthology" | "epic" | "script";
  /** Whether the story has multiple chapters */
  hasChapters: boolean;
  /** Source file format for robust stanza detection */
  sourceFormat?: SourceFormat | null;
  /** Raw HTML content (only for HTML uploads) */
  rawHtml?: string | null;
}

export interface StreamingLevelResult {
  success: boolean;
  processedChapters: ProcessedChapter[];
  /** Extended chapter data with line metadata (for poems/scripts) */
  processedChaptersWithMetadata?: ProcessedChapterDataWithMetadata[];
  error?: string;
}

/**
 * PRODUCER: Rewrite chapters using GPT and enqueue for translation.
 * Runs as an async generator, yielding after each chapter completes.
 * Preserves chapter metadata through the rewrite process.
 */
async function* rewriteChaptersProducer(
  params: StreamingLevelParams,
  queue: StreamingChapterQueue
): AsyncGenerator<{ chapterIndex: number; content: string }, void, unknown> {
  const {
    storyId,
    userId,
    levelId,
    level,
    chapters,
    sourceLanguage,
    detectedLevel,
    storyType,
  } = params;

  const ctx: CostContext = { storyId, userId };
  const needsRewrite = level !== detectedLevel;
  const tracker = new LevelProgressTracker(levelId, chapters.length);

  // Determine if this is poetry (requires strict line count preservation)
  const isPoetry = storyType === 'poem' || storyType === 'song-lyrics' || storyType === 'epic';

  // Mark level as PROCESSING in database so streaming reader can work
  await tracker.startProcessing();
  await tracker.startRewriting();

  for (let i = 0; i < chapters.length; i++) {
    // Check for cancellation before each chapter
    if (await isStoryCancelled(storyId)) {
      console.log(`[StreamingProducer] Story ${storyId} cancelled, stopping at chapter ${i + 1}`);
      queue.markProducerComplete(); // Signal consumer to stop waiting
      return; // Exit generator early
    }

    const chapter = chapters[i];
    const chapterText = chapter.text;

    // Update story-level progress
    await updateStoryProgress(storyId, "rewriting_chapter", {
      chapterCurrent: i + 1,
      chapterTotal: chapters.length,
      currentLevel: level,
    });

    // Update level-specific progress
    await tracker.updateRewriteProgress(i + 1);

    let rewrittenContent: string;

    if (needsRewrite) {
      try {
        // Call GPT to rewrite (with chunking for large chapters, strict line count for poetry)
        rewrittenContent = await rewriteChapterWithChunking(
          chapterText,
          detectedLevel,
          level,
          sourceLanguage,
          ctx,
          isPoetry
        );

        // Update progress with chapter data
        // Apply cleanText to normalize whitespace, then split
        // Keep blank lines for display in ComparisonModal
        const cleanedOrig = cleanText(chapterText);
        const cleanedRewrite = cleanText(rewrittenContent);
        await tracker.updateRewriteProgress(i + 1, {
          originalLines: cleanedOrig.split("\n"),
          rewrittenLines: cleanedRewrite.split("\n"),
        });
      } catch (error: any) {
        console.error(`[StreamingProducer] Rewrite failed for chapter ${i + 1}:`, error.message);
        // Graceful degradation: use original content
        queue.markRewriteError(i, error);
        rewrittenContent = chapterText;
      }
    } else {
      // No rewrite needed, use original
      rewrittenContent = chapterText;
    }

    // Enqueue for translation immediately, preserving metadata
    const queuedChapter: QueuedChapter = {
      chapterIndex: i,
      content: rewrittenContent,
      queuedAt: Date.now(),
      metadata: chapter.metadata,
    };
    queue.enqueue(queuedChapter);

    // Yield for progress tracking
    yield { chapterIndex: i, content: rewrittenContent };

    // Apply backpressure if queue is getting too large
    if (queue.shouldApplyBackpressure(STREAMING_LIMITS.QUEUE_BACKPRESSURE_THRESHOLD)) {
      await delay(STREAMING_LIMITS.QUEUE_FULL_WAIT_MS);
    }

    // Rate limit between GPT calls (only if we actually made a call)
    if (needsRewrite && i < chapters.length - 1) {
      await delay(USER_STORY_LIMITS.MIN_DELAY_BETWEEN_AI_CALLS_MS);
    }
  }

  // Signal producer is done
  queue.markProducerComplete();
}

/**
 * CONSUMER: Translate chapters from queue using Claude.
 * Runs concurrently with producer, processing chapters as they arrive.
 * Preserves chapter metadata through the translation process.
 */
async function translateChaptersConsumer(
  params: StreamingLevelParams,
  queue: StreamingChapterQueue
): Promise<TranslateResult> {
  const { storyId, userId, levelId, level, storySlug, chapters, sourceLanguage, storyType, structureType, hasChapters, sourceFormat, rawHtml } = params;

  const ctx: CostContext = { storyId, userId };
  const totalChapters = chapters.length;
  const tracker = new LevelProgressTracker(levelId, totalChapters);
  const processedChapters: (ProcessedChapter | null)[] = new Array(totalChapters).fill(null);
  const processedChaptersWithMetadata: (ProcessedChapterDataWithMetadata | null)[] = new Array(totalChapters).fill(null);

  // Determine if this is poetry (for artistic translation handling)
  const isPoetry = storyType === 'poem' || storyType === 'song-lyrics' || storyType === 'epic';

  // Check if we need special preprocessing for this story type
  const needsMetadata = storyType && (
    storyType === 'poem' ||
    storyType === 'song-lyrics' ||
    storyType === 'epic' ||
    storyType === 'movie-script' ||
    storyType === 'tv-script' ||
    storyType === 'dialogue'
  );

  // Mark level as PROCESSING in database so streaming reader can work
  await tracker.startProcessing();
  await tracker.startTranslating();

  let chaptersProcessed = 0;

  while (chaptersProcessed < totalChapters) {
    // Check for cancellation at the start of each iteration
    if (await isStoryCancelled(storyId)) {
      console.log(`[StreamingConsumer] Story ${storyId} cancelled, stopping translation at chapter ${chaptersProcessed + 1}`);
      break; // Exit loop but return what we have
    }

    // Wait for next chapter from queue (blocks if producer is behind)
    const queuedChapter = await queue.dequeue();

    if (!queuedChapter) {
      // Producer finished but we haven't processed all chapters
      // This means some chapters failed in producer or story was cancelled
      console.warn(`[StreamingConsumer] Queue empty before all chapters processed`);
      break;
    }

    const { chapterIndex, content, metadata } = queuedChapter;

    // Update story-level progress
    await updateStoryProgress(storyId, "translating_chapter", {
      chapterCurrent: chaptersProcessed + 1,
      chapterTotal: totalChapters,
      currentLevel: level,
    });

    // NOTE: Don't update level progress here - wait until chapter is complete
    // The chapter count should only increment AFTER content is written to the database

    try {
      // For prose: translate the chapter text directly using shared translateChapter
      // For poems/scripts: preprocess first to extract stanza/speaker metadata
      let processedLines: string[];
      let lineMetadata = new Map<number, LineMetadata>();
      let speakerNames: string[] = [];
      let filteredSourceLines: string[];
      let filteredTranslatedLines: string[];

      if (needsMetadata) {
        // Poems/scripts need special preprocessing for stanza/speaker metadata
        // Note: For rewritten content, we don't have HTML anymore (plain text after rewrite)
        const preprocessed = preprocessChapterForStoryType(
          content,
          storyType,
          { sourceFormat, rawHtml: null }
        );
        processedLines = preprocessed.processedLines;
        lineMetadata = preprocessed.lineMetadata;
        speakerNames = preprocessed.speakerNames;

        // Translate the processed lines using shared translateChapter
        const textToTranslate = processedLines.join('\n');
        const result = await translateChapter(textToTranslate, sourceLanguage, level, {
          storyId: ctx.storyId, userId: ctx.userId, isPoetry
        });

        // For poetry, preserve blank lines (they mark stanza breaks)
        filteredSourceLines = isPoetry ? processedLines : collapseConsecutiveBlanks(processedLines);
        filteredTranslatedLines = isPoetry
          ? result.translatedText.split('\n')
          : collapseConsecutiveBlanks(result.translatedText.split('\n'));
      } else {
        // Prose: use shared translateChapter (handles chunking, alignment, cleaning)
        const result = await translateChapter(content, sourceLanguage, level, {
          storyId: ctx.storyId, userId: ctx.userId, isPoetry: false
        });

        // Clean source text and collapse consecutive blanks to single paragraph breaks
        const cleanedSource = cleanText(content);
        filteredSourceLines = collapseConsecutiveBlanks(cleanedSource.split('\n'));
        filteredTranslatedLines = collapseConsecutiveBlanks(result.translatedText.split('\n'));
      }

      // Detect alignment issues
      const alignmentResult = detectAlignmentIssues(filteredSourceLines, filteredTranslatedLines);
      if (alignmentResult.hasIssues) {
        console.warn(`[StreamingConsumer] Ch ${chapterIndex + 1} alignment: ${alignmentResult.issueCount} issues`);
      }

      // Preserve metadata from original chapter
      const processedChapter: ProcessedChapter = {
        sourceLines: filteredSourceLines,
        translatedLines: filteredTranslatedLines,
        metadata,
      };

      // Store in correct order (by original chapter index)
      processedChapters[chapterIndex] = processedChapter;

      // Build extended chapter data with line metadata if needed
      if (needsMetadata && lineMetadata.size > 0) {
        const chapterDataWithMeta: ProcessedChapterDataWithMetadata = {
          sourceLines: filteredSourceLines,
          translatedLines: filteredTranslatedLines,
          metadata,
          lineMetadata,
        };
        processedChaptersWithMetadata[chapterIndex] = chapterDataWithMeta;
      } else {
        // No special metadata - just copy basic data
        processedChaptersWithMetadata[chapterIndex] = {
          sourceLines: filteredSourceLines,
          translatedLines: filteredTranslatedLines,
          metadata,
        };
      }

      queue.markTranslateComplete(chapterIndex, processedChapter);

      // Build chapter content immediately and write directly to content field
      // This is the single source of truth - same content used for reading during and after processing
      const builtChapter = buildSingleChapterContent(
        filteredSourceLines,
        filteredTranslatedLines,
        sourceLanguage,
        structureType || "prose",
        lineMetadata.size > 0 ? lineMetadata : undefined
      );

      console.log(`[StreamingConsumer] Built chapter ${chapterIndex + 1}: ${Object.keys(builtChapter.pages).length} pages` +
        (builtChapter.poems ? `, ${builtChapter.poems.length} poems` : ""));

      // Write chapter directly to the content field (single source of truth)
      await tracker.updateChapterContent(
        chapterIndex + 1, // 1-based chapter number
        {
          pages: builtChapter.pages as any,
          metadata,
          poems: builtChapter.poems,
          alignmentIssues: alignmentResult.hasIssues ? alignmentResult : undefined,
        },
        {
          storySlug,
          level: levelStringToNumber(level),
          hasChapters,
          structureType: structureType || "prose",
        }
      );

      // Also update progress tracker with chapter data for ComparisonModal
      // Use the same filtered lines as stored content so progress viewer matches final output
      await tracker.updateTranslationProgress(chaptersProcessed + 1, {
        sourceLines: filteredSourceLines,
        translatedLines: filteredTranslatedLines,
        alignmentIssues: alignmentResult.hasIssues ? alignmentResult : undefined,
      });

    } catch (error: any) {
      console.error(`[StreamingConsumer] Translation failed for chapter ${chapterIndex + 1}:`, error.message);
      queue.markTranslateError(chapterIndex, error);
      // Continue processing other chapters
    }

    chaptersProcessed++;

    // Rate limit between Claude calls
    if (chaptersProcessed < totalChapters) {
      await delay(USER_STORY_LIMITS.MIN_DELAY_BETWEEN_AI_CALLS_MS);
    }
  }

  // Filter out any nulls (failed chapters)
  const validChapters = processedChapters.filter((ch): ch is ProcessedChapter => ch !== null);
  const validChaptersWithMetadata = processedChaptersWithMetadata.filter((ch): ch is ProcessedChapterDataWithMetadata => ch !== null);

  return {
    success: validChapters.length > 0,
    processedChapters: validChapters,
    // Always return extended metadata to support structureType-based features (anthology pagination)
    processedChaptersWithMetadata: validChaptersWithMetadata,
    error: validChapters.length === 0 ? "All chapters failed to translate" : undefined,
  };
}

/**
 * Process a level with streaming pipeline:
 * GPT rewriting → Queue → Claude translation (running in parallel)
 *
 * This cuts processing time by ~50% compared to sequential processing.
 */
export async function processLevelStreaming(
  params: StreamingLevelParams
): Promise<StreamingLevelResult> {
  const { level, chapters, detectedLevel } = params;

  // Create the queue
  const queue = new StreamingChapterQueue(chapters.length);

  // Start producer (GPT rewriting) - runs independently
  const producerPromise = (async () => {
    const generator = rewriteChaptersProducer(params, queue);
    // Consume the generator to drive the rewriting
    for await (const _chapter of generator) {
      // Each yielded chapter has already been enqueued
    }
  })();

  // Start consumer (Claude translation) - runs in parallel
  const consumerPromise = translateChaptersConsumer(params, queue);

  // Wait for both to complete
  const [, translateResult] = await Promise.all([
    producerPromise,
    consumerPromise,
  ]);

  // Log any errors
  const errors = queue.getErrors();
  if (errors.length > 0) {
    console.warn(`[StreamingPipeline] ${errors.length} chapters had errors:`,
      errors.map(e => `ch${e.chapterIndex + 1}(${e.phase})`).join(", ")
    );
  }

  return {
    success: translateResult.success,
    processedChapters: translateResult.processedChapters,
    processedChaptersWithMetadata: translateResult.processedChaptersWithMetadata,
    error: translateResult.error,
  };
}

// ============================================================================
// LEGACY: Single-level processor (kept for backward compatibility)
// ============================================================================

/**
 * @deprecated Use the new phased approach: rewriteLevelChapters → translateLevelChapters → buildAndSaveLevel
 *
 * Process a single level (rewrite if needed + translate + paginate)
 */
export async function processLevel(
  params: LevelProcessingParams
): Promise<LevelProcessingResult> {
  const {
    storyId,
    userId,
    levelId,
    level,
    rawContent,
    sourceLanguage,
    detectedLevel,
    storySlug,
  } = params;

  // Parse chapters
  await updateStoryProgress(storyId, "parsing_chapters", { currentLevel: level });
  const { hasChapters, chapters } = parseStoryContent(rawContent);

  // Rewrite if needed
  const rewriteResult = await rewriteLevelChapters({
    storyId,
    userId,
    levelId,
    level,
    chapters,
    sourceLanguage,
    detectedLevel,
  });

  if (!rewriteResult.success) {
    return { success: false, error: rewriteResult.error };
  }

  // Translate
  const translateResult = await translateLevelChapters({
    storyId,
    userId,
    levelId,
    level,
    storySlug,
    chapters: rewriteResult.chapters,
    sourceLanguage,
    hasChapters,
  });

  if (!translateResult.success) {
    return { success: false, error: translateResult.error };
  }

  // Build and save
  const buildResult = await buildAndSaveLevel({
    storyId,
    levelId,
    level,
    storySlug,
    hasChapters,
    processedChapters: translateResult.processedChapters,
    sourceLanguage,
  });

  return buildResult;
}
