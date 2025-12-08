"use client";

import { useState, useRef, useCallback } from "react";
import type { StoryData, LevelContent, DetectedChapter } from "../types";
import { useProcessingPipeline, cleanText, splitIntoSubChunks, type LevelState, type BasePipelineState } from "./useProcessingPipeline";

// ============================================
// Types
// ============================================

export interface RewritePipelineState extends BasePipelineState {
  levels: Record<number, LevelState & {
    mode: 'generate' | 'use-original' | 'omit';
  }>;
}

export interface ChapterProgress {
  current: number;
  batchEnd: number;
  total: number;
  subChunk?: { current: number; total: number };
}

// ============================================
// Constants
// ============================================

const REWRITE_BATCH_SIZE = 8;
const MAX_CHUNK_CHARS = 12000;

// ============================================
// Hook
// ============================================

export interface UseRewritePipelineOptions {
  storyData: StoryData;
  updateStoryData: (updates: Partial<StoryData>) => void;
  setIsProcessing: (v: boolean) => void;
}

export function useRewritePipeline({
  storyData,
  updateStoryData,
  setIsProcessing,
}: UseRewritePipelineOptions) {
  // Base pipeline for shared functionality
  const initialState: RewritePipelineState = {
    levels: {},
  };

  const pipeline = useProcessingPipeline<RewritePipelineState>(initialState);

  // ============================================
  // Local State
  // ============================================

  const [currentGenerating, setCurrentGenerating] = useState<number | null>(null);
  const [chapterProgress, setChapterProgress] = useState<ChapterProgress | null>(null);
  const [error, setError] = useState("");

  // Comparison modal state
  const [comparisonLevel, setComparisonLevel] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");

  // Refs
  const cancelledRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ============================================
  // Level Mode Management
  // ============================================

  const getLevelMode = useCallback((level: number): 'generate' | 'use-original' | 'omit' => {
    if (storyData.levelContent[level]?.mode) {
      return storyData.levelContent[level].mode;
    }
    return level === storyData.detectedLevel ? 'use-original' : 'generate';
  }, [storyData.levelContent, storyData.detectedLevel]);

  const setLevelMode = useCallback((level: number, mode: 'generate' | 'use-original' | 'omit') => {
    const current = storyData.levelContent[level] || {
      sourceText: "",
      translatedText: "",
      status: "pending" as const,
      mode: "generate" as const
    };
    const newStatus = mode === "omit" ? "omitted" as const : "pending" as const;
    updateStoryData({
      levelContent: {
        ...storyData.levelContent,
        [level]: { ...current, mode, status: newStatus },
      },
    });
  }, [storyData.levelContent, updateStoryData]);

  // ============================================
  // Comparison Modal
  // ============================================

  const openComparison = useCallback((level: number) => {
    if (level === -1) {
      setComparisonLevel(-1);
      setEditedText(storyData.rawText);
      setIsEditing(false);
    } else {
      const content = storyData.levelContent[level];
      if (content?.sourceText) {
        setComparisonLevel(level);
        setEditedText(content.sourceText);
        setIsEditing(false);
      }
    }
  }, [storyData.rawText, storyData.levelContent]);

  const closeComparison = useCallback(() => {
    setComparisonLevel(null);
    setIsEditing(false);
  }, []);

  const saveEditedText = useCallback(() => {
    if (comparisonLevel === -1) {
      updateStoryData({ rawText: editedText });
      setIsEditing(false);
    } else if (comparisonLevel !== null) {
      const current = storyData.levelContent[comparisonLevel];
      updateStoryData({
        levelContent: {
          ...storyData.levelContent,
          [comparisonLevel]: {
            ...current,
            sourceText: editedText,
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
  // Rewrite API
  // ============================================

  const rewriteChunk = useCallback(async (text: string, targetLevel: number): Promise<string> => {
    if (cancelledRef.current) {
      throw new Error("Cancelled");
    }

    const isPoetry = ["poem", "song-lyrics", "epic"].includes(storyData.storyType);

    const response = await fetch("/api/admin/rewrite-level", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        sourceLanguage: storyData.sourceLanguage,
        targetLevel,
        sourceLevel: storyData.detectedLevel,
        isPoetry,
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
      throw new Error("Rewrite response interrupted - please retry");
    }

    if (!response.ok) {
      throw new Error(data.error || "Failed to generate");
    }

    return data.rewrittenText;
  }, [storyData.storyType, storyData.sourceLanguage, storyData.detectedLevel]);

  // Retry with exponential backoff
  const withRetry = useCallback(async <T,>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> => {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        const isRateLimit = lastError.message?.includes("rate") ||
                           lastError.message?.includes("429") ||
                           lastError.message?.includes("too many");
        if (!isRateLimit || attempt === maxRetries - 1) {
          throw lastError;
        }
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  }, []);

  // Rewrite a single chapter with sub-chunk support
  const rewriteSingleChapter = useCallback(async (
    chapterText: string,
    chapterIndex: number,
    chapterTitle: string,
    level: number
  ): Promise<{ rewritten: string; error?: string }> => {
    if (!chapterText.trim()) {
      return { rewritten: "" };
    }

    try {
      const subChunks = splitIntoSubChunks(chapterText, MAX_CHUNK_CHARS);

      if (subChunks.length > 1) {
        console.log(`Rewrite: Chapter ${chapterIndex + 1} split into ${subChunks.length} sub-chunks (parallel)`);

        const subChunkPromises = subChunks.map((subChunk, j) =>
          withRetry(() => rewriteChunk(subChunk, level))
            .then(result => ({ index: j, result, success: true as const }))
            .catch(error => ({ index: j, error, original: subChunk, success: false as const }))
        );

        const results = await Promise.all(subChunkPromises);

        const rewrittenSubChunks: string[] = new Array(subChunks.length);
        let hasError = false;

        for (const result of results) {
          if (result.success) {
            rewrittenSubChunks[result.index] = result.result;
          } else {
            hasError = true;
            rewrittenSubChunks[result.index] = `[ERROR: Sub-chunk ${result.index + 1} failed]\n\n${result.original}`;
          }
        }

        return {
          rewritten: rewrittenSubChunks.join("\n\n"),
          error: hasError ? "Some sub-chunks failed to rewrite" : undefined
        };
      } else {
        const rewritten = await withRetry(() => rewriteChunk(chapterText, level));
        return { rewritten };
      }
    } catch (chunkError) {
      const isCancelled = (chunkError as Error).name === "AbortError" ||
                         (chunkError as Error).message === "Cancelled" ||
                         cancelledRef.current;
      if (isCancelled) {
        return { rewritten: chapterText };
      }

      return {
        rewritten: `[ERROR: Failed to rewrite chapter ${chapterTitle || chapterIndex + 1}]\n\n${chapterText}`,
        error: (chunkError as Error).message,
      };
    }
  }, [rewriteChunk, withRetry]);

  // Process a single level
  const processLevel = useCallback(async (level: number, accumulator: Record<number, LevelContent>) => {
    setCurrentGenerating(level);
    setChapterProgress(null);
    setError("");

    const mode = getLevelMode(level);

    accumulator[level] = { sourceText: "", translatedText: "", status: "generating", mode };
    updateStoryData({ levelContent: { ...accumulator } });

    try {
      if (level === storyData.detectedLevel || mode === "use-original") {
        accumulator[level] = {
          sourceText: cleanText(storyData.rawText),
          translatedText: "",
          status: "done",
          mode,
        };
        updateStoryData({ levelContent: { ...accumulator } });
        setCurrentGenerating(null);
        return true;
      }

      const chapters = storyData.parsedResult?.chapters;

      if (chapters && chapters.length > 1) {
        const rewrittenChapters: string[] = new Array(chapters.length).fill("");
        setChapterProgress({ current: 1, batchEnd: Math.min(REWRITE_BATCH_SIZE, chapters.length), total: chapters.length });

        for (let batchStart = 0; batchStart < chapters.length; batchStart += REWRITE_BATCH_SIZE) {
          if (cancelledRef.current) break;

          const batchEnd = Math.min(batchStart + REWRITE_BATCH_SIZE, chapters.length);
          const batchIndices = Array.from({ length: batchEnd - batchStart }, (_, i) => batchStart + i);

          console.log(`Rewrite: Processing chapters ${batchStart + 1}-${batchEnd} of ${chapters.length} in parallel`);
          setChapterProgress({ current: batchStart + 1, batchEnd, total: chapters.length });

          const batchPromises = batchIndices.map(i =>
            rewriteSingleChapter(chapters[i].rawText, i, chapters[i].title || "", level)
          );

          const batchResults = await Promise.allSettled(batchPromises);

          batchResults.forEach((result, batchIdx) => {
            const chapterIdx = batchStart + batchIdx;
            if (result.status === "fulfilled") {
              rewrittenChapters[chapterIdx] = result.value.rewritten;
            } else {
              rewrittenChapters[chapterIdx] = `[ERROR: Failed to rewrite chapter ${chapterIdx + 1}]\n\n${chapters[chapterIdx].rawText}`;
            }
          });

          const nextBatchEnd = Math.min(batchEnd + REWRITE_BATCH_SIZE, chapters.length);
          setChapterProgress({ current: batchEnd + 1, batchEnd: nextBatchEnd, total: chapters.length });
        }

        const fullRewrittenText = rewrittenChapters
          .map((text, idx) => {
            const chapterNumber = chapters[idx]?.number || idx + 1;
            const rawTitle = chapters[idx]?.title || "";
            const isMeaningfulTitle = rawTitle.length > 0 &&
              !/^(Chapter|Section|Part|Capítulo|Sección|Parte|Full Text)\s*\d*$/i.test(rawTitle.trim());
            const divider = isMeaningfulTitle
              ? `--- Chapter ${chapterNumber}: ${rawTitle} ---`
              : `--- Chapter ${chapterNumber} ---`;
            return idx === 0 ? text : `${divider}\n\n${text}`;
          })
          .join("\n\n");

        accumulator[level] = {
          sourceText: cleanText(fullRewrittenText),
          translatedText: "",
          status: "done",
          mode,
        };
        updateStoryData({ levelContent: { ...accumulator } });
        setChapterProgress(null);
        return true;
      } else {
        const rewrittenText = await rewriteChunk(cleanText(storyData.rawText), level);
        accumulator[level] = {
          sourceText: cleanText(rewrittenText),
          translatedText: "",
          status: "done",
          mode,
        };
        updateStoryData({ levelContent: { ...accumulator } });
        return true;
      }
    } catch (err) {
      accumulator[level] = { sourceText: "", translatedText: "", status: "error", mode };
      updateStoryData({ levelContent: { ...accumulator } });
      setError(`Failed to generate L${level}: ${err instanceof Error ? err.message : "Unknown error"}`);
      return false;
    } finally {
      setCurrentGenerating(null);
      setChapterProgress(null);
    }
  }, [storyData, updateStoryData, getLevelMode, rewriteChunk, rewriteSingleChapter]);

  // Process a single level (public API)
  const processSingleLevel = useCallback(async (level: number) => {
    reset();
    setIsProcessing(true);
    const accumulator = { ...storyData.levelContent };
    await processLevel(level, accumulator);
    setIsProcessing(false);
  }, [storyData.levelContent, processLevel, reset, setIsProcessing]);

  // Process all levels
  const processAllLevels = useCallback(async () => {
    reset();
    setIsProcessing(true);
    setError("");
    const accumulator = { ...storyData.levelContent };

    for (const level of [1, 2, 3, 4, 5]) {
      if (cancelledRef.current) break;

      const mode = getLevelMode(level);
      if (mode === "omit" || accumulator[level]?.status === "done") {
        continue;
      }
      await processLevel(level, accumulator);
    }

    cancelledRef.current = false;
    abortControllerRef.current = null;
    setIsProcessing(false);
  }, [storyData.levelContent, processLevel, getLevelMode, reset, setIsProcessing]);

  // ============================================
  // Status Helpers
  // ============================================

  const getLevelStatus = useCallback((level: number) => {
    return storyData.levelContent[level]?.status ?? "pending";
  }, [storyData.levelContent]);

  const isLevelDone = useCallback((level: number) => {
    return getLevelStatus(level) === "done";
  }, [getLevelStatus]);

  const isLevelGenerating = useCallback((level: number) => {
    return currentGenerating === level;
  }, [currentGenerating]);

  return {
    // State
    currentGenerating,
    chapterProgress,
    error,
    setError,

    // Level mode
    getLevelMode,
    setLevelMode,

    // Processing
    processSingleLevel,
    processAllLevels,
    cancel,

    // Status
    getLevelStatus,
    isLevelDone,
    isLevelGenerating,

    // Comparison modal
    comparisonLevel,
    isEditing,
    editedText,
    setEditedText,
    setIsEditing,
    openComparison,
    closeComparison,
    saveEditedText,
  };
}

export default useRewritePipeline;
