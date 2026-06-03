"use client";

import { useState, useRef, useCallback } from "react";
import type { StoryData, LevelContent, ChunkError, TranslationErrorType } from "../types";
import { cleanText, parseChaptersFromText } from "@/lib/admin/text-utils";
import { alignLeadingBlanks } from "@/lib/story-processing/translation-utils";
import {
  TRANSLATION_BATCH_SIZE,
  MAX_CHUNK_CHARS,
} from "../config/constants";

// Translation sub-chunks can be larger than rewrite chunks because translation
// is line-based ([N] prefix) and preserves structure better. Larger chunks mean
// fewer splits and more context for the AI, reducing partial translations.
const TRANSLATION_SUB_CHUNK_CHARS = 24000;

// ============================================
// Types
// ============================================

export interface LevelProgress {
  current: number;
  batchEnd: number;
  total: number;
  subChunk?: { current: number; total: number };
}

// ============================================
// Hook
// ============================================

export interface UseTranslationPipelineOptions {
  storyData: StoryData;
  updateStoryData: (updates: Partial<StoryData>) => void;
  setIsProcessing: (v: boolean) => void;
}

export function useTranslationPipeline({
  storyData,
  updateStoryData,
  setIsProcessing,
}: UseTranslationPipelineOptions) {
  // ============================================
  // State
  // ============================================

  const [translatingLevels, setTranslatingLevels] = useState<Set<number>>(new Set());
  const [levelProgress, setLevelProgress] = useState<Record<number, LevelProgress>>({});
  const [error, setError] = useState("");
  const [chunkErrors, setChunkErrors] = useState<Record<number, ChunkError[]>>({});

  // Track copied translations
  const [copiedFromLevel, setCopiedFromLevel] = useState<Record<number, number>>({});

  // Refs
  const cancelledRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentChapterRef = useRef<number>(-1);

  // ============================================
  // Error Categorization
  // ============================================

  const categorizeError = useCallback((error: Error, responseStatus?: number): TranslationErrorType => {
    const msg = error.message.toLowerCase();
    // Log for debugging - this helps identify what's going wrong
    console.log(`[categorizeError] Categorizing error: "${error.message}" (name: ${error.name})`);

    if (responseStatus === 429 || msg.includes('rate limit') || msg.includes('too many requests')) {
      return 'rate_limit';
    }
    if (msg.includes('content') || msg.includes('policy') || msg.includes('safety')) {
      return 'content_refusal';
    }
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection')) {
      return 'network';
    }
    if (msg.includes('timeout') || msg.includes('timed out') || error.name === 'AbortError') {
      return 'timeout';
    }
    if (msg.includes('json') || msg.includes('parse') || msg.includes('invalid') || responseStatus === 500 || responseStatus === 502) {
      return 'malformed';
    }
    // Log when we fall through to unknown - this is the problematic case
    console.warn(`[categorizeError] Could not categorize error, returning 'unknown': "${error.message}"`);
    return 'unknown';
  }, []);

  // ============================================
  // Completeness Check
  // ============================================

  const isTranslationComplete = useCallback((level: number): boolean => {
    const content = storyData.levelContent[level];
    if (!content?.translatedText) return false;
    if (content.translatedText.includes("[TRANSLATION_FAILED:")) return false;

    const sourceLines = content.sourceText?.split('\n').filter(l => l.trim()).length || 0;
    const transLines = content.translatedText.split('\n').filter(l => l.trim()).length || 0;

    if (sourceLines > 0 && transLines < sourceLines) {
      return false;
    }
    return true;
  }, [storyData.levelContent]);

  // ============================================
  // Smart Resume Helpers
  // ============================================

  const parseTranslatedChapters = useCallback((translatedText: string): string[] => {
    if (!translatedText?.trim()) return [];
    // Split by both Spanish AND English chapter markers
    // (English markers appear when translation failed and source text was used as fallback)
    const parts = translatedText.split(/---\s*(?:Capítulo|Chapter)\s+\d+(?:(?!---).)*---/i);
    return parts.map(p => p.trim()).filter(p => p.length > 0);
  }, []);

  const findFirstIncompleteChapter = useCallback((
    sourceChapters: string[],
    translatedChapters: string[]
  ): number => {
    if (translatedChapters.length < sourceChapters.length) {
      return translatedChapters.length;
    }

    for (let i = 0; i < sourceChapters.length; i++) {
      const sourceText = sourceChapters[i] || '';
      const transText = translatedChapters[i] || '';
      const sourceLines = sourceText.split('\n').filter(l => l.trim()).length;
      const transLines = transText.split('\n').filter(l => l.trim()).length;

      // Check for explicit failure marker
      if (transText.includes('[TRANSLATION_FAILED:')) {
        return i;
      }

      // Check if "translated" text is actually identical to source (not translated)
      // Normalize whitespace for comparison
      const normalizedSource = sourceText.replace(/\s+/g, ' ').trim();
      const normalizedTrans = transText.replace(/\s+/g, ' ').trim();
      if (normalizedSource === normalizedTrans && normalizedSource.length > 50) {
        console.log(`[findFirstIncompleteChapter] Chapter ${i + 1} has identical source and translation - not translated`);
        return i;
      }

      // Check for missing lines
      if (transLines < sourceLines) {
        return i;
      }
    }

    return -1;
  }, []);

  // ============================================
  // Translation API
  // ============================================

  /**
   * Check if an error is a network/connectivity issue worth auto-retrying.
   * These are transient errors where the request never reached the server
   * (sleep, wifi drop, etc.) — retrying is cheap and likely to succeed.
   */
  const isNetworkError = (err: Error): boolean => {
    const msg = err.message.toLowerCase();
    return (
      msg.includes('failed to fetch') ||
      msg.includes('network') ||
      msg.includes('err_network') ||
      msg.includes('econnrefused') ||
      msg.includes('econnreset') ||
      msg.includes('load failed') ||
      err.name === 'TypeError' && msg.includes('fetch')
    );
  };

  // Auto-retry only for network errors (sleep, wifi drop, etc.)
  // AI/content errors are not retried — use the manual chapter retry buttons instead.
  const NETWORK_RETRY_MAX = 2;
  const NETWORK_RETRY_DELAY_MS = 10000; // 10s — give network time to recover

  /**
   * Translate a chunk of text via the admin API.
   * Auto-retries up to 2x for network errors only (sleep, wifi drop).
   * AI/content errors fail immediately — use manual retry buttons.
   */
  const translateChunk = useCallback(async (text: string, level: number): Promise<string> => {
    if (cancelledRef.current) throw new Error("Cancelled");

    const textPreview = text.substring(0, 80).replace(/\n/g, '\\n');
    console.log(`[translateChunk] L${level}: Starting (${text.length} chars, ~${Math.ceil(text.length / 4)} tokens) "${textPreview}..."`);

    for (let attempt = 1; attempt <= NETWORK_RETRY_MAX + 1; attempt++) {
      if (cancelledRef.current) throw new Error("Cancelled");

      // Create a timeout controller (12 minutes per request - large chapters need time)
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), 720000);

      // Link manual cancel to timeout controller
      const manualAbortHandler = () => timeoutController.abort();
      abortControllerRef.current?.signal.addEventListener('abort', manualAbortHandler);

      try {
        if (abortControllerRef.current?.signal.aborted || cancelledRef.current) {
          throw new Error("Cancelled");
        }

        // Determine if content is poetry based on STRUCTURE (not storyType which is cosmetic)
        const effectiveStructure = storyData.structureType === "auto"
          ? storyData.parsedResult?.stats?.structureType
          : storyData.structureType;
        const isPoetry = effectiveStructure === "anthology" || effectiveStructure === "epic";

        const response = await fetch("/api/admin/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            fromLanguage: storyData.sourceLanguage,
            level,
            slug: storyData.slug || undefined,
            sessionId: storyData.sessionId || undefined,
            isPoetry,
          }),
          signal: timeoutController.signal,
        });

        clearTimeout(timeoutId);

        if (cancelledRef.current) throw new Error("Cancelled");

        let data;
        try {
          data = await response.json();
        } catch (parseError) {
          console.error(`[translateChunk] JSON parse error, status=${response.status}:`, parseError);
          throw new Error(`Translation response parse error (HTTP ${response.status})`);
        }

        if (!response.ok) {
          console.error(`[translateChunk] API error (HTTP ${response.status}):`, data);
          const errMsg = data.details || data.error || `Translation failed (HTTP ${response.status})`;
          throw new Error(errMsg);
        }

        if (!data.translatedText || typeof data.translatedText !== 'string') {
          console.error(`[translateChunk] Invalid response - missing translatedText`);
          throw new Error(`Invalid translation response - missing translatedText field`);
        }

        // Log truncation and alignment info
        if (data.truncated) {
          const reasons = data.truncationInfo?.reasons || ["Unknown"];
          console.warn(`[translateChunk] Truncation detected: ${reasons.join("; ")}`);
        }
        if (data.alignment) {
          const a = data.alignment;
          console.log(`[translateChunk] Alignment: ${a.contentLines} content, ${a.translatedLines} translated, ${a.blankLines} blank, ${a.sourceLines} total`);
        }

        abortControllerRef.current?.signal.removeEventListener('abort', manualAbortHandler);
        if (attempt > 1) {
          console.log(`[translateChunk] L${level}: SUCCESS on retry ${attempt - 1} (${data.translatedText.length} chars)`);
        } else {
          console.log(`[translateChunk] L${level}: SUCCESS (${data.translatedText.length} chars)`);
        }
        return data.translatedText;
      } catch (error) {
        clearTimeout(timeoutId);
        abortControllerRef.current?.signal.removeEventListener('abort', manualAbortHandler);

        const err = error instanceof Error ? error : new Error(String(error));
        if (err.message === "Cancelled" || cancelledRef.current) throw new Error("Cancelled");
        if (err.name === "AbortError") throw new Error("Request timed out after 12 minutes");

        // Only auto-retry network errors (sleep, wifi drop, etc.)
        if (isNetworkError(err) && attempt <= NETWORK_RETRY_MAX) {
          console.warn(`[translateChunk] L${level}: Network error on attempt ${attempt} — retrying in ${NETWORK_RETRY_DELAY_MS / 1000}s... (${err.message})`);
          await new Promise(resolve => setTimeout(resolve, NETWORK_RETRY_DELAY_MS));
          continue;
        }

        console.error(`[translateChunk] L${level}: FAILED — ${err.message}`);
        throw err;
      }
    }

    // Should never reach here
    throw new Error("Translation failed");
  }, [storyData.sourceLanguage, storyData.slug, storyData.structureType, storyData.parsedResult?.stats?.structureType]);

  // ============================================
  // Processing Control
  // ============================================

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    abortControllerRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    cancelledRef.current = false;
    abortControllerRef.current = new AbortController();
  }, []);

  // ============================================
  // Sub-chunking for large chapters
  // ============================================

  /**
   * Split a large chapter into sub-chunks at paragraph boundaries (blank lines).
   * Each sub-chunk stays under TRANSLATION_SUB_CHUNK_CHARS (24K).
   */
  const splitChapterIntoSubChunks = useCallback((chapterText: string): string[] => {
    const lines = chapterText.split('\n');
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentSize = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineSize = line.length + 1; // +1 for newline

      // If adding this line would exceed limit AND we have content AND we're at a paragraph break
      if (currentSize + lineSize > TRANSLATION_SUB_CHUNK_CHARS && currentChunk.length > 0 && line.trim() === '') {
        chunks.push(currentChunk.join('\n'));
        currentChunk = [];
        currentSize = 0;
        // Skip the blank line — it'll be re-added when we rejoin chunks
        continue;
      }

      currentChunk.push(line);
      currentSize += lineSize;
    }

    // Push remaining content
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
    }

    // If we couldn't split (no paragraph breaks), force-split at line boundaries
    if (chunks.length === 1 && chapterText.length > TRANSLATION_SUB_CHUNK_CHARS) {
      const maxLines = Math.ceil(lines.length / Math.ceil(chapterText.length / TRANSLATION_SUB_CHUNK_CHARS));
      const forceChunks: string[] = [];
      for (let i = 0; i < lines.length; i += maxLines) {
        forceChunks.push(lines.slice(i, i + maxLines).join('\n'));
      }
      return forceChunks;
    }

    return chunks;
  }, []);

  /**
   * Translate a large chapter by splitting into sub-chunks, translating each,
   * then rejoining. Sub-chunks are translated sequentially to avoid rate limits.
   */
  const translateChapterWithSubChunks = useCallback(async (
    chapterText: string,
    level: number,
    chapterIndex: number,
  ): Promise<string> => {
    const subChunks = splitChapterIntoSubChunks(chapterText);
    console.log(`[translateLevel] L${level} Chapter ${chapterIndex + 1}: Splitting into ${subChunks.length} sub-chunks (${subChunks.map(c => c.length).join(', ')} chars)`);

    const translatedSubChunks: string[] = [];

    for (let s = 0; s < subChunks.length; s++) {
      if (cancelledRef.current) throw new Error("Cancelled");

      // Update progress with sub-chunk info
      setLevelProgress(prev => ({
        ...prev,
        [level]: {
          ...prev[level],
          subChunk: { current: s + 1, total: subChunks.length },
        },
      }));

      console.log(`[translateLevel] L${level} Chapter ${chapterIndex + 1} sub-chunk ${s + 1}/${subChunks.length}: ${subChunks[s].length} chars`);
      const translated = await translateChunk(subChunks[s], level);
      translatedSubChunks.push(translated);
    }

    // Clear sub-chunk progress
    setLevelProgress(prev => ({
      ...prev,
      [level]: { ...prev[level], subChunk: undefined },
    }));

    // Rejoin with blank line between sub-chunks (matching original paragraph breaks)
    return translatedSubChunks.join('\n\n');
  }, [splitChapterIntoSubChunks, translateChunk, setLevelProgress]);

  // ============================================
  // Translation Processing
  // ============================================

  const buildTranslatedText = useCallback((translatedChapters: string[]): string => {
    // Add chapter dividers when reassembling translated chapters
    // The source chapters had markers stripped by parseChaptersFromText,
    // so we need to add the translated markers back (Capítulo for Spanish output)
    const targetLang = storyData.sourceLanguage === "en" ? "es" : "en";
    const chapterLabel = targetLang === "es" ? "Capítulo" : "Chapter";

    return translatedChapters
      .map((chapter, index) => {
        // Only add marker if we have multiple chapters
        if (translatedChapters.length > 1) {
          // Use single \n after marker - chapter content already has any leading whitespace it needs
          return `--- ${chapterLabel} ${index + 1} ---\n${chapter}`;
        }
        return chapter;
      })
      .join("\n\n");
  }, [storyData.sourceLanguage]);

  const saveTranslationProgress = useCallback((
    level: number,
    translatedChapters: string[],
    accumulator: Record<number, LevelContent>
  ) => {
    const fullTranslatedText = buildTranslatedText(translatedChapters);
    // Preserve whitespace based on STRUCTURE (not storyType which is cosmetic)
    const effectiveStructure = storyData.structureType === "auto"
      ? storyData.parsedResult?.stats?.structureType
      : storyData.structureType;
    const preserveWhitespace = effectiveStructure === "anthology" || effectiveStructure === "epic";
    accumulator[level] = {
      ...accumulator[level],
      translatedText: cleanText(fullTranslatedText, { preserveWhitespace }),
    };
    updateStoryData({ levelContent: { ...accumulator } });
  }, [buildTranslatedText, updateStoryData, storyData.structureType]);

  const translateLevel = useCallback(async (level: number, accumulator: Record<number, LevelContent>) => {
    setTranslatingLevels(prev => new Set(prev).add(level));
    setLevelProgress(prev => {
      const next = { ...prev };
      delete next[level];
      return next;
    });
    setError("");
    setChunkErrors(prev => ({ ...prev, [level]: [] }));

    const levelErrors: ChunkError[] = [];

    try {
      const sourceText = accumulator[level].sourceText;
      const existingTranslation = accumulator[level].translatedText || "";
      const chapters = parseChaptersFromText(sourceText);

      // Log chapter detection with size info for each chapter
      console.log(`[translateLevel] L${level}: ${chapters.length} chapters from sourceText (${sourceText.length} chars total)`);
      chapters.forEach((ch, i) => {
        const lines = ch.split('\n');
        const contentLines = lines.filter(l => l.trim()).length;
        console.log(`  Ch ${i + 1}: ${ch.length} chars, ${lines.length} total lines, ${contentLines} content lines`);
      });

      if (chapters.length > 1 || sourceText.length > MAX_CHUNK_CHARS) {
        const existingChapters = parseTranslatedChapters(existingTranslation);
        const startChapter = existingChapters.length > 0
          ? findFirstIncompleteChapter(chapters, existingChapters)
          : 0;

        if (startChapter === -1) {
          console.log(`[translateLevel] L${level} already complete, skipping`);
          setTranslatingLevels(prev => {
            const next = new Set(prev);
            next.delete(level);
            return next;
          });
          return;
        }

        const translatedChapters: string[] = new Array(chapters.length).fill("");
        for (let i = 0; i < existingChapters.length && i < startChapter; i++) {
          translatedChapters[i] = existingChapters[i];
        }

        if (startChapter > 0) {
          console.log(`[translateLevel] L${level} resuming from chapter ${startChapter + 1}/${chapters.length}`);
        }

        setLevelProgress(prev => ({
          ...prev,
          [level]: { current: startChapter + 1, batchEnd: Math.min(startChapter + TRANSLATION_BATCH_SIZE, chapters.length), total: chapters.length }
        }));

        for (let batchStart = startChapter; batchStart < chapters.length; batchStart += TRANSLATION_BATCH_SIZE) {
          if (cancelledRef.current) break;

          const batchEnd = Math.min(batchStart + TRANSLATION_BATCH_SIZE, chapters.length);
          const batchIndices = Array.from({ length: batchEnd - batchStart }, (_, i) => batchStart + i);

          setLevelProgress(prev => ({
            ...prev,
            [level]: { current: batchStart + 1, batchEnd, total: chapters.length }
          }));

          const batchPromises = batchIndices.map(async (i) => {
            try {
              // Track current chapter for truncation status display
              currentChapterRef.current = i;
              const chapterText = chapters[i];
              console.log(`[translateLevel] L${level} Chapter ${i + 1}: Starting translation (${chapterText.length} chars)`);

              // Sub-chunk large chapters to avoid max_tokens truncation
              const translated = chapterText.length > TRANSLATION_SUB_CHUNK_CHARS
                ? await translateChapterWithSubChunks(chapterText, level, i)
                : await translateChunk(chapterText, level);

              console.log(`[translateLevel] L${level} Chapter ${i + 1}: SUCCESS (${translated.length} chars)`);
              return { index: i, translated, success: true as const };
            } catch (err) {
              const error = err as Error;
              console.error(`[translateLevel] L${level} Chapter ${i + 1}: FAILED -`, error.message);
              return { index: i, error, original: chapters[i], success: false as const };
            }
          });

          const batchResults = await Promise.allSettled(batchPromises);

          batchResults.forEach((result) => {
            if (result.status === "fulfilled") {
              const r = result.value;
              if (r.success) {
                // Align leading blank lines with source chapter to prevent off-by-one
                translatedChapters[r.index] = alignLeadingBlanks(chapters[r.index], r.translated);
              } else {
                translatedChapters[r.index] = `[TRANSLATION_FAILED:${r.index}]\n\n${r.original}`;
                levelErrors.push({
                  chapterIndex: r.index,
                  errorType: categorizeError(r.error),
                  errorMessage: r.error.message,
                  originalText: r.original,
                  retryCount: 0,
                });
              }
            }
          });

          // Log batch results summary
          const successes = batchResults.filter(r => r.status === "fulfilled" && r.value.success).length;
          const failures = batchResults.length - successes;
          console.log(`[translateLevel] L${level} Batch ${batchStart + 1}-${batchEnd}: ${successes} succeeded, ${failures} failed`);

          saveTranslationProgress(level, translatedChapters.filter(t => t !== ""), accumulator);

          // Delay between chapters to avoid API rate limits.
          // Use a longer delay (5s) to be safe — we optimize for reliability, not speed.
          if (batchEnd < chapters.length && !cancelledRef.current) {
            console.log(`[translateLevel] L${level}: Waiting 5s before next chapter...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }

        if (translatedChapters.some(t => t !== "")) {
          saveTranslationProgress(level, translatedChapters, accumulator);
        }
      } else {
        try {
          // Single chapter case
          currentChapterRef.current = 0;
          const translatedText = await translateChunk(sourceText, level);
          // Align leading blank lines with source to prevent off-by-one
          const alignedText = alignLeadingBlanks(sourceText, translatedText);
          // Preserve whitespace based on STRUCTURE (not storyType which is cosmetic)
          const effectiveStructure = storyData.structureType === "auto"
            ? storyData.parsedResult?.stats?.structureType
            : storyData.structureType;
          const preserveWhitespace = effectiveStructure === "anthology" || effectiveStructure === "epic";
          accumulator[level] = {
            ...accumulator[level],
            translatedText: cleanText(alignedText, { preserveWhitespace }),
          };
          updateStoryData({ levelContent: { ...accumulator } });
        } catch (singleChunkError) {
          const isCancelled = (singleChunkError as Error).name === "AbortError" ||
                             (singleChunkError as Error).message === "Cancelled" ||
                             cancelledRef.current;
          if (!isCancelled) {
            const errorType = categorizeError(singleChunkError as Error);
            levelErrors.push({
              chapterIndex: 0,
              errorType,
              errorMessage: (singleChunkError as Error).message,
              originalText: sourceText,
              retryCount: 0,
            });
            accumulator[level] = {
              ...accumulator[level],
              translatedText: `[TRANSLATION_FAILED:0]\n\n${sourceText}`,
            };
            updateStoryData({ levelContent: { ...accumulator } });
          }
        }
      }

      if (levelErrors.length > 0) {
        setChunkErrors(prev => ({ ...prev, [level]: levelErrors }));
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setError(`Failed to translate L${level}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    } finally {
      setTranslatingLevels(prev => {
        const next = new Set(prev);
        next.delete(level);
        return next;
      });
      setLevelProgress(prev => {
        const next = { ...prev };
        delete next[level];
        return next;
      });
    }
  }, [storyData, updateStoryData, translateChunk, parseTranslatedChapters, findFirstIncompleteChapter, saveTranslationProgress, categorizeError]);

  // Reset a level's translation (clears translated text so it can be re-translated)
  const resetTranslation = useCallback((level: number) => {
    const current = storyData.levelContent[level];
    if (current) {
      updateStoryData({
        levelContent: {
          ...storyData.levelContent,
          [level]: { ...current, translatedText: "" },
        },
      });
      // Clear any chunk errors for this level
      setChunkErrors(prev => {
        const next = { ...prev };
        delete next[level];
        return next;
      });
      // Clear copied-from info
      setCopiedFromLevel(prev => {
        const next = { ...prev };
        delete next[level];
        return next;
      });
      console.log(`[resetTranslation] L${level} translation cleared`);
    }
  }, [storyData.levelContent, updateStoryData]);

  /**
   * Retranslate a single chapter within a level, with a user-specified number of sub-chunks.
   * The translated chapter replaces only that chapter in the full translated text.
   */
  const retranslateChapter = useCallback(async (
    level: number,
    chapterIndex: number,
    chapterSourceText: string,
    numChunks: number,
  ): Promise<void> => {
    reset();

    try {
      let translatedChapter: string;

      if (numChunks <= 1) {
        // Single chunk — translate the whole chapter at once
        translatedChapter = await translateChunk(chapterSourceText, level);
      } else {
        // Split into the requested number of sub-chunks at paragraph boundaries
        const lines = chapterSourceText.split('\n');
        const linesPerChunk = Math.ceil(lines.length / numChunks);
        const subChunks: string[] = [];
        let currentChunk: string[] = [];

        for (let i = 0; i < lines.length; i++) {
          currentChunk.push(lines[i]);
          // Split at paragraph boundaries near the target chunk size
          if (currentChunk.length >= linesPerChunk && lines[i].trim() === '' && subChunks.length < numChunks - 1) {
            subChunks.push(currentChunk.join('\n'));
            currentChunk = [];
          }
        }
        if (currentChunk.length > 0) {
          subChunks.push(currentChunk.join('\n'));
        }

        console.log(`[retranslateChapter] L${level} Ch ${chapterIndex + 1}: splitting into ${subChunks.length} sub-chunks (${subChunks.map(c => c.length).join(', ')} chars)`);

        // Translate sub-chunks sequentially
        const translatedSubChunks: string[] = [];
        for (let s = 0; s < subChunks.length; s++) {
          if (cancelledRef.current) throw new Error("Cancelled");
          console.log(`[retranslateChapter] L${level} Ch ${chapterIndex + 1} sub-chunk ${s + 1}/${subChunks.length}: ${subChunks[s].length} chars`);
          const translated = await translateChunk(subChunks[s], level);
          translatedSubChunks.push(translated);
        }

        translatedChapter = translatedSubChunks.join('\n\n');
      }

      // Replace only this chapter in the full translated text
      const currentContent = storyData.levelContent[level];
      if (!currentContent?.translatedText) return;

      const fullLines = currentContent.translatedText.split('\n');
      const chapterDivider = /^---\s*(?:Chapter|Capítulo)\s+(\d+)(?:(?!---).)*---$/i;

      // Find chapter boundaries in translated text
      const dividerIndices: number[] = [];
      fullLines.forEach((line, idx) => {
        if (chapterDivider.test(line)) dividerIndices.push(idx);
      });

      if (dividerIndices.length === 0) {
        // No chapters — replace entire text
        updateStoryData({
          levelContent: {
            ...storyData.levelContent,
            [level]: { ...currentContent, translatedText: translatedChapter },
          },
        });
      } else {
        const chapterStart = dividerIndices[chapterIndex];
        const chapterEnd = chapterIndex + 1 < dividerIndices.length ? dividerIndices[chapterIndex + 1] : fullLines.length;

        if (chapterStart !== undefined) {
          const before = fullLines.slice(0, chapterStart + 1); // Include the divider line
          const after = fullLines.slice(chapterEnd);
          const newFullText = [...before, translatedChapter, ...after].join('\n');

          updateStoryData({
            levelContent: {
              ...storyData.levelContent,
              [level]: { ...currentContent, translatedText: newFullText },
            },
          });
        }
      }

      console.log(`[retranslateChapter] L${level} Ch ${chapterIndex + 1}: SUCCESS`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error(`[retranslateChapter] L${level} Ch ${chapterIndex + 1}: FAILED -`, error.message);
      throw error;
    }
  }, [storyData.levelContent, translateChunk, updateStoryData, reset]);

  const translateSingleLevel = useCallback(async (level: number) => {
    reset();
    setIsProcessing(true);
    const accumulator = { ...storyData.levelContent };
    await translateLevel(level, accumulator);
    setIsProcessing(false);
  }, [storyData.levelContent, translateLevel, reset, setIsProcessing]);

  const translateAllLevels = useCallback(async () => {
    reset();
    setIsProcessing(true);
    setError("");

    const generatedLevels = [1, 2, 3, 4, 5, 6].filter(
      level => storyData.levelContent[level]?.status === "done"
    );

    const levelsToTranslate = generatedLevels.filter(
      level => !isTranslationComplete(level)
    );

    if (levelsToTranslate.length === 0) {
      setIsProcessing(false);
      return;
    }

    // Group by identical source text for copy optimization
    const textToLevels = new Map<string, number[]>();
    for (const level of levelsToTranslate) {
      const sourceText = storyData.levelContent[level]?.sourceText || "";
      const existing = textToLevels.get(sourceText) || [];
      existing.push(level);
      textToLevels.set(sourceText, existing);
    }

    const levelsNeedingTranslation: number[] = [];
    const copyMap = new Map<number, number>();

    for (const [, levels] of textToLevels) {
      const primaryLevel = levels[0];
      levelsNeedingTranslation.push(primaryLevel);
      for (let i = 1; i < levels.length; i++) {
        copyMap.set(levels[i], primaryLevel);
      }
    }

    const accumulator = { ...storyData.levelContent };

    // Translate levels sequentially to avoid API rate limiting.
    // Each level already processes chapters in batches of TRANSLATION_BATCH_SIZE.
    for (const level of levelsNeedingTranslation) {
      if (cancelledRef.current) break;
      await translateLevel(level, accumulator);
    }

    // Copy translations to levels with identical source
    if (copyMap.size > 0) {
      const copyInfo: Record<number, number> = {};

      for (const [targetLevel, sourceLevel] of copyMap) {
        const translatedText = accumulator[sourceLevel]?.translatedText;
        if (translatedText && !translatedText.includes('[TRANSLATION_FAILED:')) {
          accumulator[targetLevel] = {
            ...accumulator[targetLevel],
            translatedText,
          };
          copyInfo[targetLevel] = sourceLevel;
        }
      }

      if (Object.keys(copyInfo).length > 0) {
        updateStoryData({ levelContent: { ...accumulator } });
        setCopiedFromLevel(prev => ({ ...prev, ...copyInfo }));
      }
    }

    setIsProcessing(false);
  }, [storyData.levelContent, translateLevel, isTranslationComplete, reset, setIsProcessing, updateStoryData]);

  // ============================================
  // Status Helpers
  // ============================================

  const isLevelTranslating = useCallback((level: number): boolean => {
    return translatingLevels.has(level);
  }, [translatingLevels]);

  const hasLevelErrors = useCallback((level: number): boolean => {
    return (chunkErrors[level]?.length || 0) > 0;
  }, [chunkErrors]);

  return {
    // State
    translatingLevels,
    levelProgress,
    error,
    setError,
    chunkErrors,
    setChunkErrors,
    copiedFromLevel,

    // Processing
    translateSingleLevel,
    translateAllLevels,
    cancel,
    resetTranslation,
    retranslateChapter,

    // Status
    isTranslationComplete,
    isLevelTranslating,
    hasLevelErrors,

  };
}

export default useTranslationPipeline;
