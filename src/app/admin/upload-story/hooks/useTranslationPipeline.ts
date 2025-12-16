"use client";

import { useState, useRef, useCallback } from "react";
import type { StoryData, LevelContent, ChunkError, TranslationErrorType } from "../types";
import { cleanText, parseChaptersFromText } from "@/lib/admin/text-utils";
import {
  TRANSLATION_BATCH_SIZE,
  MAX_CHUNK_CHARS,
  MAX_TRANSLATION_RETRIES,
  RETRY_DELAY_MS,
  MAX_TRUNCATION_RETRIES,
} from "../config/constants";

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
  const [truncationRetryStatus, setTruncationRetryStatus] = useState<{
    chapter: number;
    attempt: number;
    maxAttempts: number;
    reasons: string[];
  } | null>(null);

  // Comparison modal state
  const [comparisonLevel, setComparisonLevel] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");

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
    if (msg.includes('json') || msg.includes('parse') || responseStatus === 500 || responseStatus === 502) {
      return 'malformed';
    }
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
    const parts = translatedText.split(/---\s*(?:Capítulo|Chapter)\s+\d+[^-]*---/i);
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

  const translateChunk = useCallback(async (text: string, level: number): Promise<string> => {
    let lastError: Error | null = null;
    let truncationRetries = 0;

    for (let attempt = 1; attempt <= MAX_TRANSLATION_RETRIES; attempt++) {
      if (cancelledRef.current) {
        throw new Error("Cancelled");
      }

      try {
        const response = await fetch("/api/admin/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            fromLanguage: storyData.sourceLanguage,
            level,
          }),
          signal: abortControllerRef.current?.signal,
        });

        if (cancelledRef.current) {
          throw new Error("Cancelled");
        }

        let data;
        try {
          data = await response.json();
        } catch (parseError) {
          throw new Error("Translation response interrupted");
        }

        if (!response.ok) {
          throw new Error(data.error || "Failed to translate");
        }

        // Check for truncation
        if (data.truncated && truncationRetries < MAX_TRUNCATION_RETRIES) {
          truncationRetries++;
          const reasons = data.truncationInfo?.reasons || [data.truncationInfo?.reason || "Unknown"];
          console.warn(`[translateChunk] Truncation detected: ${reasons.join("; ")}, retry ${truncationRetries}/${MAX_TRUNCATION_RETRIES}`);

          // Update UI to show retry status
          setTruncationRetryStatus({
            chapter: currentChapterRef.current,
            attempt: truncationRetries,
            maxAttempts: MAX_TRUNCATION_RETRIES,
            reasons,
          });

          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * 2));
          continue; // Retry the same chunk
        }

        // Clear retry status on success or final attempt
        setTruncationRetryStatus(null);

        if (data.truncated) {
          console.warn(`[translateChunk] Truncation persisted after ${MAX_TRUNCATION_RETRIES} retries:`, data.truncationInfo);
        }

        return data.translatedText;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (lastError.message === "Cancelled") {
          throw lastError;
        }

        if (attempt < MAX_TRANSLATION_RETRIES) {
          console.log(`[translateChunk] Attempt ${attempt} failed, retrying in ${RETRY_DELAY_MS}ms...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    }

    throw lastError || new Error("Translation failed after retries");
  }, [storyData.sourceLanguage]);

  // ============================================
  // Comparison Modal
  // ============================================

  const openComparison = useCallback((level: number) => {
    const content = storyData.levelContent[level];
    if (content?.translatedText) {
      setComparisonLevel(level);
      setEditedText(content.translatedText);
      setIsEditing(false);
    }
  }, [storyData.levelContent]);

  const closeComparison = useCallback(() => {
    setComparisonLevel(null);
    setIsEditing(false);
  }, []);

  const saveEditedTranslation = useCallback(() => {
    if (comparisonLevel !== null) {
      const current = storyData.levelContent[comparisonLevel];
      updateStoryData({
        levelContent: {
          ...storyData.levelContent,
          [comparisonLevel]: {
            ...current,
            translatedText: editedText,
          },
        },
      });
      setIsEditing(false);
    }
  }, [comparisonLevel, editedText, storyData.levelContent, updateStoryData]);

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
  // Translation Processing
  // ============================================

  const buildTranslatedText = useCallback((translatedChapters: string[]): string => {
    // Don't add chapter dividers here - the translated text already contains
    // translated chapter markers (e.g., "--- Capítulo N ---") from the source
    return translatedChapters.join("\n\n");
  }, []);

  const saveTranslationProgress = useCallback((
    level: number,
    translatedChapters: string[],
    accumulator: Record<number, LevelContent>
  ) => {
    const fullTranslatedText = buildTranslatedText(translatedChapters);
    accumulator[level] = {
      ...accumulator[level],
      translatedText: cleanText(fullTranslatedText),
    };
    updateStoryData({ levelContent: { ...accumulator } });
  }, [buildTranslatedText, updateStoryData]);

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
              const translated = await translateChunk(chapters[i], level);
              return { index: i, translated, success: true as const };
            } catch (err) {
              return { index: i, error: err as Error, original: chapters[i], success: false as const };
            }
          });

          const batchResults = await Promise.allSettled(batchPromises);

          batchResults.forEach((result) => {
            if (result.status === "fulfilled") {
              const r = result.value;
              if (r.success) {
                translatedChapters[r.index] = r.translated;
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

          saveTranslationProgress(level, translatedChapters.filter(t => t !== ""), accumulator);
        }

        if (translatedChapters.some(t => t !== "")) {
          saveTranslationProgress(level, translatedChapters, accumulator);
        }
      } else {
        try {
          // Single chapter case
          currentChapterRef.current = 0;
          const translatedText = await translateChunk(sourceText, level);
          accumulator[level] = {
            ...accumulator[level],
            translatedText: cleanText(translatedText),
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

    const generatedLevels = [1, 2, 3, 4, 5].filter(
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

    // Translate unique levels in parallel
    const translationPromises = levelsNeedingTranslation.map(level =>
      translateLevel(level, accumulator).then(() => ({ level, success: true }))
    );

    await Promise.allSettled(translationPromises);

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
    truncationRetryStatus,

    // Processing
    translateSingleLevel,
    translateAllLevels,
    cancel,

    // Status
    isTranslationComplete,
    isLevelTranslating,
    hasLevelErrors,

    // Comparison modal
    comparisonLevel,
    isEditing,
    editedText,
    setEditedText,
    setIsEditing,
    openComparison,
    closeComparison,
    saveEditedTranslation,
  };
}

export default useTranslationPipeline;
