"use client";

import { useState, useRef, useCallback } from "react";
import type { ProcessingStatus, ChunkError } from "../types";

// ============================================
// Types
// ============================================

export interface LevelState {
  status: ProcessingStatus;
  content: string;
}

export interface BasePipelineState {
  levels: Record<number, LevelState>;
}

// ============================================
// Text Cleaning Utility
// ============================================

export function cleanText(text: string): string {
  let cleaned = text
    // Remove code fences
    .replace(/^```[\w]*\n?/gm, "")
    .replace(/\n?```$/gm, "")
    .replace(/```/g, "")
    // Remove triple quotes
    .replace(/^"""\n?/gm, "")
    .replace(/\n?"""$/gm, "")
    .replace(/^'''\n?/gm, "")
    .replace(/\n?'''$/gm, "")
    // Remove markdown bold/italic
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    // Remove markdown headers
    .replace(/^#{1,6}\s+/gm, "")
    // Normalize whitespace
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");

  // Process line by line to remove quote wrapping
  cleaned = cleaned
    .split("\n")
    .map(line => {
      let l = line.trim();
      if ((l.startsWith('"') && l.endsWith('"')) ||
          (l.startsWith('"') && l.endsWith('"')) ||
          (l.startsWith("'") && l.endsWith("'")) ||
          (l.startsWith("'") && l.endsWith("'"))) {
        l = l.slice(1, -1);
      }
      if (l === '""' || l === "''" || l === '""' || l === "''") {
        return "";
      }
      return l;
    })
    .filter(line => line.length > 0 || line === "")
    .join("\n");

  return cleaned
    .split("\n")
    .filter(line => !/^["'"'""'']+$/.test(line.trim()))
    .join("\n")
    .trim();
}

// ============================================
// Chapter Parsing Utilities
// ============================================

export function parseChaptersFromText(text: string): string[] {
  // Split on common chapter patterns
  const chapterRegex = /(?:^|\n)(?:---\s*)?(?:Chapter|CHAPTER|Capítulo|CAPÍTULO)\s+\d+[^\n]*(?:\s*---)?(?:\n|$)/gi;
  const matches = text.match(chapterRegex);

  if (!matches || matches.length <= 1) {
    // No chapter markers or only one - treat as single chapter
    return [text.trim()];
  }

  // Split by chapter markers
  const parts = text.split(chapterRegex);
  const chapters: string[] = [];

  // First part might be front matter or first chapter
  if (parts[0]?.trim()) {
    chapters.push(parts[0].trim());
  }

  // Add remaining chapters with their headers
  for (let i = 1; i < parts.length; i++) {
    if (parts[i]?.trim()) {
      const header = matches[i - 1]?.trim() || '';
      chapters.push((header + '\n\n' + parts[i]).trim());
    }
  }

  return chapters.length > 0 ? chapters : [text.trim()];
}

export function splitIntoSubChunks(text: string, maxChars: number = 12000): string[] {
  if (text.length <= maxChars) return [text];

  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    if (currentChunk.length + para.length + 2 > maxChars) {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = para;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + para;
    }
  }

  if (currentChunk) chunks.push(currentChunk.trim());

  // If any chunk is still too large, split by sentences
  const result: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= maxChars) {
      result.push(chunk);
    } else {
      // Split by sentence
      const sentences = chunk.split(/(?<=[.!?])\s+/);
      let sentenceChunk = "";
      for (const sentence of sentences) {
        if (sentenceChunk.length + sentence.length + 1 > maxChars) {
          if (sentenceChunk) result.push(sentenceChunk.trim());
          sentenceChunk = sentence;
        } else {
          sentenceChunk += (sentenceChunk ? " " : "") + sentence;
        }
      }
      if (sentenceChunk) result.push(sentenceChunk.trim());
    }
  }

  return result;
}

// ============================================
// Main Hook (Simplified - No Persistence)
// ============================================

export interface UseProcessingPipelineReturn<T extends BasePipelineState> {
  // State
  state: T;
  setState: React.Dispatch<React.SetStateAction<T>>;

  // Refs for cancellation
  cancelledRef: React.MutableRefObject<boolean>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;

  // Processing control
  cancel: () => void;
  reset: () => void;

  // Status helpers
  getLevelStatus: (level: number) => ProcessingStatus;
  isLevelComplete: (level: number) => boolean;
  isLevelProcessing: (level: number) => boolean;
  isLevelPartial: (level: number) => boolean;
  isLevelError: (level: number) => boolean;

  // Progress update helpers
  setLevelProcessing: (level: number, chapter: number, batchEnd: number, total: number, subChunk?: { current: number; total: number }) => void;
  setLevelComplete: (level: number, lineCount: number) => void;
  setLevelPartial: (level: number, completedChapters: number, totalChapters: number, lineCount: { source: number; processed: number }) => void;
  setLevelError: (level: number, errors: ChunkError[]) => void;
  setLevelIdle: (level: number) => void;
}

export function useProcessingPipeline<T extends BasePipelineState>(
  initialState: T
): UseProcessingPipelineReturn<T> {
  const [state, setState] = useState<T>(initialState);
  const cancelledRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

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
  // Status Helpers
  // ============================================

  const getLevelStatus = useCallback((level: number): ProcessingStatus => {
    return state.levels[level]?.status ?? { state: 'idle' };
  }, [state.levels]);

  const isLevelComplete = useCallback((level: number): boolean => {
    return getLevelStatus(level).state === 'complete';
  }, [getLevelStatus]);

  const isLevelProcessing = useCallback((level: number): boolean => {
    return getLevelStatus(level).state === 'processing';
  }, [getLevelStatus]);

  const isLevelPartial = useCallback((level: number): boolean => {
    return getLevelStatus(level).state === 'partial';
  }, [getLevelStatus]);

  const isLevelError = useCallback((level: number): boolean => {
    return getLevelStatus(level).state === 'error';
  }, [getLevelStatus]);

  // ============================================
  // Progress Update Helpers
  // ============================================

  const setLevelProcessing = useCallback((
    level: number,
    chapter: number,
    batchEnd: number,
    total: number,
    subChunk?: { current: number; total: number }
  ) => {
    setState(prev => ({
      ...prev,
      levels: {
        ...prev.levels,
        [level]: {
          ...prev.levels[level],
          status: { state: 'processing', chapter, batchEnd, total, subChunk },
        },
      },
    }));
  }, []);

  const setLevelComplete = useCallback((level: number, lineCount: number) => {
    setState(prev => ({
      ...prev,
      levels: {
        ...prev.levels,
        [level]: {
          ...prev.levels[level],
          status: { state: 'complete', lineCount },
        },
      },
    }));
  }, []);

  const setLevelPartial = useCallback((
    level: number,
    completedChapters: number,
    totalChapters: number,
    lineCount: { source: number; processed: number }
  ) => {
    setState(prev => ({
      ...prev,
      levels: {
        ...prev.levels,
        [level]: {
          ...prev.levels[level],
          status: { state: 'partial', completedChapters, totalChapters, lineCount },
        },
      },
    }));
  }, []);

  const setLevelError = useCallback((level: number, errors: ChunkError[]) => {
    setState(prev => ({
      ...prev,
      levels: {
        ...prev.levels,
        [level]: {
          ...prev.levels[level],
          status: { state: 'error', errors },
        },
      },
    }));
  }, []);

  const setLevelIdle = useCallback((level: number) => {
    setState(prev => ({
      ...prev,
      levels: {
        ...prev.levels,
        [level]: {
          ...prev.levels[level],
          status: { state: 'idle' },
        },
      },
    }));
  }, []);

  return {
    state,
    setState,
    cancelledRef,
    abortControllerRef,
    cancel,
    reset,
    getLevelStatus,
    isLevelComplete,
    isLevelProcessing,
    isLevelPartial,
    isLevelError,
    setLevelProcessing,
    setLevelComplete,
    setLevelPartial,
    setLevelError,
    setLevelIdle,
  };
}

export default useProcessingPipeline;
