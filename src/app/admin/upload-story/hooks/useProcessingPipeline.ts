"use client";

import { useState, useRef, useCallback } from "react";
import type { ProcessingStatus, ChunkError } from "../types";

// Re-export text utilities from centralized location
export { cleanText, parseChaptersFromText, splitIntoSubChunks } from "@/lib/admin/text-utils";

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
