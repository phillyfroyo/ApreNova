// src/lib/user-stories/level-processor.ts
// Handles processing of a single CEFR level for a user story
//
// New architecture (v2):
// - Separate functions for rewriting, translating, and building
// - Pipeline calls rewrite for ALL levels first, then translate for ALL levels
// - This is more logical and allows for potential parallelization

import { USER_STORY_LIMITS, STREAMING_LIMITS } from "./limits";
import { LevelProgressTracker, updateStoryProgress, isStoryCancelled, StoryCancelledError, createThrottledCancellationChecker } from "./progress-tracker";
import {
  rewriteToLevel,
  rewritePoemByStanza,
  joinStanzasToText,
  joinStanzasWithSpacing,
  translateText,
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
  // Poem and script parsing
  detectStanzas,
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
import { StreamingChapterQueue, QueuedChapter } from "./chapter-queue";
import { StoryType } from "@/types/story";

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
 * Preprocess chapter text based on story type to extract line metadata.
 * - For poems: Detects stanza breaks and assigns stanza numbers
 * - For scripts: Extracts speaker names, annotations, and stage directions
 *
 * @param chapterText - The chapter text to preprocess
 * @param storyType - The detected story type (poem, tv-script, movie-script, etc.)
 * @returns Object with processed lines and metadata map
 */
export function preprocessChapterForStoryType(
  chapterText: string,
  storyType: StoryType | null | undefined
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

  // Handle poems
  if (storyType === 'poem' || storyType === 'song-lyrics' || storyType === 'epic') {
    const lines = chapterText.split('\n');
    const stanzaMarked = detectStanzas(lines);

    const processedLines: string[] = [];
    stanzaMarked.forEach((markedLine, idx) => {
      lineMetadata.set(idx, {
        stanzaNumber: markedLine.stanzaNumber,
        isStanzaBreak: markedLine.isStanzaBreak,
      });
      processedLines.push(markedLine.text);
    });

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
  const lines = chapterText.split('\n').filter(l => l.trim());
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

  // For poetry: use stanza-by-stanza rewriting to guarantee stanza structure preservation
  if (isPoetry) {
    console.log(`[RewriteChapter] Using stanza-by-stanza rewriting for poetry`);
    const stanzaResult = await rewritePoemByStanza(
      chapterText,
      detectedLevel,
      targetLevel,
      sourceLanguage,
      rewriteOptions
    );

    // Join stanzas back together, preserving original vertical spacing
    const joinedText = joinStanzasWithSpacing(
      stanzaResult.rewrittenStanzas,
      stanzaResult.blankLinesBefore
    );

    return joinedText;
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
    return result.rewrittenText;
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

  // Reassemble chunks
  return reassembleChunks(rewrittenChunks);
}

/**
 * Translate a single chapter, chunking if necessary for large content.
 * Returns the translated lines.
 */
async function translateChapterWithChunking(
  chapterText: string,
  sourceLanguage: "en" | "es",
  level: string,
  ctx: CostContext,
  isPoetry: boolean = false
): Promise<string[]> {
  const translateOptions = {
    storyId: ctx.storyId,
    userId: ctx.userId,
    isPoetry,
  };

  // Check if chapter needs chunking
  // Note: For poetry, we avoid chunking as it can break stanza/verse structure
  if (chapterText.length <= MAX_CHUNK_CHARS || isPoetry) {
    // Small chapter or poetry - process directly (don't chunk poetry)
    const result = await translateText(chapterText, sourceLanguage, level, translateOptions);
    return result.translatedLines;
  }

  // Large chapter - split into chunks (prose only)
  const chunks = splitIntoSubChunks(chapterText, MAX_CHUNK_CHARS);

  const allTranslatedLines: string[] = [];

  // Create throttled cancellation checker for long chunking operations
  // Checks every 10 seconds to avoid wasting API calls after user cancels
  const cancellationChecker = createThrottledCancellationChecker(ctx.storyId, 10000);

  for (let i = 0; i < chunks.length; i++) {
    // Check for cancellation (throttled - only queries DB every 10 seconds)
    await cancellationChecker.checkIfCancelled();

    const chunk = chunks[i];
    let lastError: Error | null = null;

    // Retry loop for each chunk
    for (let attempt = 1; attempt <= RETRY_CONFIG.MAX_TRANSLATION_RETRIES; attempt++) {
      try {
        const result = await translateText(chunk, sourceLanguage, level, translateOptions);
        allTranslatedLines.push(...result.translatedLines);
        lastError = null;
        break;
      } catch (error: any) {
        lastError = error;
        const errorType = categorizeError(error);

        if (!isRetryableError(errorType) || attempt === RETRY_CONFIG.MAX_TRANSLATION_RETRIES) {
          console.error(`[Chunking] Translation chunk ${i + 1}/${chunks.length} failed (${errorType}): ${error.message}`);
          // Use placeholder as fallback
          const chunkLines = chunk.split("\n").filter((l) => l.trim());
          allTranslatedLines.push(...chunkLines.map(() => "[Translation failed]"));
          break;
        }

        const retryDelay = getRetryDelay(errorType, attempt);
        console.warn(`[Chunking] Translation chunk ${i + 1} retry ${attempt}/${RETRY_CONFIG.MAX_TRANSLATION_RETRIES} after ${retryDelay}ms`);
        await delay(retryDelay);
      }
    }

    // Rate limit between chunks
    if (i < chunks.length - 1) {
      await delay(USER_STORY_LIMITS.MIN_DELAY_BETWEEN_AI_CALLS_MS);
    }
  }

  return allTranslatedLines;
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
      console.log(`[parseStoryContent] Inferred structureType=${effectiveStructureType} from storyType=${options.storyType}`);
    }
  }

  // For poetry, skip quickClean to preserve whitespace (indentation)
  // quickClean's normalizeWhitespace strips leading spaces which destroys poem formatting
  const isPoetry = effectiveStructureType === "anthology" || effectiveStructureType === "epic";
  const contentToProcess = isPoetry ? rawContent : quickClean(rawContent);

  if (isPoetry) {
    console.log(`[parseStoryContent] Skipping quickClean for poetry to preserve whitespace`);
  }

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
      await tracker.updateRewriteProgress(i + 1, {
        originalLines: chapterText.split("\n").filter((l) => l.trim()),
        rewrittenLines: rewrittenText.split("\n").filter((l) => l.trim()),
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
  chapters: ParsedChapter[];
  sourceLanguage: "en" | "es";
  /** Story type for special preprocessing (poems, scripts) */
  storyType?: StoryType | null;
  /** Structure type for anthology pagination */
  structureType?: "prose" | "anthology" | "epic" | "script";
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
  const { storyId, userId, levelId, level, chapters, sourceLanguage, storyType, structureType } = params;

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

      // Update story-level progress with chapter info
      await updateStoryProgress(storyId, "translating_chapter", {
        chapterCurrent: i + 1,
        chapterTotal: chapters.length,
        currentLevel: level,
      });

      // Update level-specific progress
      await tracker.updateTranslationProgress(i + 1);

      // Preprocess for story type (poems: stanzas, scripts: speakers)
      const { processedLines, lineMetadata, speakerNames } = preprocessChapterForStoryType(
        chapterText,
        storyType
      );

      // Translate the processed lines (with chunking for large chapters, artistic handling for poetry)
      const textToTranslate = processedLines.join('\n');
      const translatedLines = await translateChapterWithChunking(
        textToTranslate,
        sourceLanguage,
        level,
        ctx,
        isPoetry
      );

      // Filter translated lines - but preserve blank lines for poetry (they mark stanza breaks)
      const filteredTranslatedLines = isPoetry
        ? translatedLines
        : translatedLines.filter((l) => l.trim());

      // For poetry, also preserve blank lines in source
      const filteredSourceLines = isPoetry
        ? processedLines
        : processedLines.filter((l) => l.trim());

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
            const translatedDirections = await translateChapterWithChunking(
              directionsText,
              sourceLanguage,
              level,
              ctx,
              false // Stage directions are prose, not poetry
            );
            // Map back to line indices
            stageDirectionsToTranslate.forEach((d, translateIdx) => {
              if (translatedDirections[translateIdx]) {
                translatedStageDirections.set(d.idx, translatedDirections[translateIdx]);
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

      // Build chapter content immediately for streaming reader consistency
      // This ensures "Start Reading" shows the same pagination as the final content
      const builtChapter = buildSingleChapterContent(
        filteredSourceLines,
        filteredTranslatedLines,
        sourceLanguage,
        structureType || "prose",
        lineMetadata.size > 0 ? lineMetadata : undefined
      );

      console.log(`[TranslateLevelChapters] Built chapter ${i + 1}: ${Object.keys(builtChapter.pages).length} pages` +
        (builtChapter.poems ? `, ${builtChapter.poems.length} poems` : ""));

      // Update progress with built pages for streaming reader
      await tracker.updateTranslationProgress(i + 1, {
        sourceLines: filteredSourceLines,
        translatedLines: filteredTranslatedLines,
        builtPages: builtChapter.pages as any, // Convert PageContent to BuiltPageContent
        poems: builtChapter.poems,
        metadata: chapter.metadata,
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
 * Uses extended metadata builder for poems/scripts when available.
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
    // Build content structure
    await updateStoryProgress(storyId, "building_structure", { currentLevel: level });
    const levelNum = levelStringToNumber(level);

    console.log(`[BuildAndSaveLevel] Building level ${level} with structureType=${structureType}`);

    // Use metadata-aware builder if we have extended chapter data
    const content = processedChaptersWithMetadata
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
  chapters: ParsedChapter[];
  sourceLanguage: "en" | "es";
  detectedLevel: string;
  /** Story type for special preprocessing (poems, scripts) */
  storyType?: StoryType | null;
  /** Structure type for anthology pagination */
  structureType?: "prose" | "anthology" | "epic" | "script";
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
        await tracker.updateRewriteProgress(i + 1, {
          originalLines: chapterText.split("\n").filter((l) => l.trim()),
          rewrittenLines: rewrittenContent.split("\n").filter((l) => l.trim()),
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
  const { storyId, userId, levelId, level, chapters, sourceLanguage, storyType, structureType } = params;

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

    // Update level-specific progress
    await tracker.updateTranslationProgress(chaptersProcessed + 1);

    try {
      // Preprocess for story type (poems: stanzas, scripts: speakers)
      // This extracts metadata from the REWRITTEN content
      const { processedLines, lineMetadata, speakerNames } = preprocessChapterForStoryType(
        content,
        storyType
      );

      // Call Claude to translate (with chunking for large chapters, artistic handling for poetry)
      const textToTranslate = processedLines.join('\n');
      const translatedLines = await translateChapterWithChunking(
        textToTranslate,
        sourceLanguage,
        level,
        ctx,
        isPoetry
      );

      // Preserve blank lines for poetry (they mark stanza breaks), filter for prose
      const filteredSourceLines = isPoetry
        ? processedLines
        : processedLines.filter((l) => l.trim());
      const filteredTranslatedLines = isPoetry
        ? translatedLines
        : translatedLines.filter((l) => l.trim());

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

      // Build chapter content immediately for streaming reader consistency
      // This ensures "Start Reading" shows the same pagination as the final content
      const builtChapter = buildSingleChapterContent(
        filteredSourceLines,
        filteredTranslatedLines,
        sourceLanguage,
        structureType || "prose",
        lineMetadata.size > 0 ? lineMetadata : undefined
      );

      console.log(`[StreamingConsumer] Built chapter ${chapterIndex + 1}: ${Object.keys(builtChapter.pages).length} pages` +
        (builtChapter.poems ? `, ${builtChapter.poems.length} poems` : ""));

      // Update progress with built pages for streaming reader
      await tracker.updateTranslationProgress(chaptersProcessed + 1, {
        sourceLines: filteredSourceLines,
        translatedLines: filteredTranslatedLines,
        builtPages: builtChapter.pages as any, // Convert PageContent to BuiltPageContent
        poems: builtChapter.poems,
        metadata,
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
    chapters: rewriteResult.chapters,
    sourceLanguage,
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
