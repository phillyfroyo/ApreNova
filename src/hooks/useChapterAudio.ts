// src/hooks/useChapterAudio.ts
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type {
  ChapterAudioRequest,
  ChapterAudioMetadata,
  SentenceTiming,
  ChapterGenerationProgress,
} from "@/types/chapter-audio";

// ============================================================================
// Types
// ============================================================================

export interface ChapterAudioState {
  status: "idle" | "loading" | "generating" | "playing" | "paused" | "error" | "finished";
  currentTime: number;
  duration: number;
  currentSentence: SentenceTiming | null;
  currentPage: number;
  progress: ChapterGenerationProgress | null;
  error: string | null;
}

interface UseChapterAudioOptions {
  onSentenceChange?: (timing: SentenceTiming) => void;
  onPageChange?: (pageNumber: number) => void;
  onPlaybackComplete?: () => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useChapterAudio(options: UseChapterAudioOptions = {}) {
  const [state, setState] = useState<ChapterAudioState>({
    status: "idle",
    currentTime: 0,
    duration: 0,
    currentSentence: null,
    currentPage: 0,
    progress: null,
    error: null,
  });

  const [metadata, setMetadata] = useState<ChapterAudioMetadata | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const metadataRef = useRef<ChapterAudioMetadata | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const optionsRef = useRef(options);
  const lastSentenceIdxRef = useRef(-1);
  const lastPageRef = useRef(-1);
  optionsRef.current = options;

  // ---- Binary search for current sentence by time ----
  const findSentenceAtTime = useCallback((time: number): number => {
    const timings = metadataRef.current?.sentenceTimings;
    if (!timings || timings.length === 0) return -1;

    let lo = 0;
    let hi = timings.length - 1;

    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (time < timings[mid].startTime) {
        hi = mid - 1;
      } else if (time >= timings[mid].endTime) {
        lo = mid + 1;
      } else {
        return mid; // time is within this sentence
      }
    }

    return -1; // in a silence gap between sentences
  }, []);

  const findPageAtTime = useCallback((time: number): number => {
    const boundaries = metadataRef.current?.pageBoundaries;
    if (!boundaries || boundaries.length === 0) return 0;

    for (let i = boundaries.length - 1; i >= 0; i--) {
      if (time >= boundaries[i].startTime) {
        return boundaries[i].pageNumber;
      }
    }
    return boundaries[0].pageNumber;
  }, []);

  // ---- Time update handler ----
  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const currentTime = audio.currentTime;
    setState(prev => ({ ...prev, currentTime }));

    // Find current sentence
    const sentenceIdx = findSentenceAtTime(currentTime);
    if (sentenceIdx !== -1 && sentenceIdx !== lastSentenceIdxRef.current) {
      lastSentenceIdxRef.current = sentenceIdx;
      const timing = metadataRef.current!.sentenceTimings[sentenceIdx];
      setState(prev => ({ ...prev, currentSentence: timing }));
      optionsRef.current.onSentenceChange?.(timing);
    }

    // Find current page
    const page = findPageAtTime(currentTime);
    if (page !== lastPageRef.current) {
      lastPageRef.current = page;
      setState(prev => ({ ...prev, currentPage: page }));
      optionsRef.current.onPageChange?.(page);
    }
  }, [findSentenceAtTime, findPageAtTime]);

  // ---- Load chapter audio and start playback ----
  const loadAndPlay = useCallback(async (request: ChapterAudioRequest) => {
    // Abort any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    // Stop any existing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    lastSentenceIdxRef.current = -1;
    lastPageRef.current = -1;
    setMetadata(null);
    metadataRef.current = null;

    const abortController = new AbortController();
    abortRef.current = abortController;

    setState({
      status: "loading",
      currentTime: 0,
      duration: 0,
      currentSentence: null,
      currentPage: 0,
      progress: null,
      error: null,
    });

    try {
      // Fetch chapter audio with streaming progress
      const response = await fetch("/api/azure-tts/chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      // Read NDJSON stream
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let audioUrl = "";
      let chapterMetadata: ChapterAudioMetadata | null = null;
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // keep incomplete line

        for (const line of lines) {
          if (!line.trim()) continue;
          const data = JSON.parse(line);

          if (data.type === "progress") {
            setState(prev => ({
              ...prev,
              status: "generating",
              progress: data,
            }));
          } else if (data.type === "complete") {
            audioUrl = data.audioUrl;
            chapterMetadata = data.metadata;
          } else if (data.type === "error") {
            throw new Error(data.error);
          }
        }
      }

      if (!audioUrl || !chapterMetadata) {
        throw new Error("No audio URL received from server");
      }

      // Check if cancelled during generation
      if (abortController.signal.aborted) return;

      // Store metadata
      setMetadata(chapterMetadata);
      metadataRef.current = chapterMetadata;

      // Create audio element and start playback
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.addEventListener("timeupdate", handleTimeUpdate);
      audio.addEventListener("loadedmetadata", () => {
        setState(prev => ({ ...prev, duration: audio.duration }));
      });
      audio.addEventListener("ended", () => {
        setState(prev => ({ ...prev, status: "finished", currentSentence: null }));
        optionsRef.current.onPlaybackComplete?.();
      });
      audio.addEventListener("error", () => {
        setState(prev => ({ ...prev, status: "error", error: "Audio playback failed" }));
        optionsRef.current.onError?.(new Error("Audio playback failed"));
      });

      await audio.play();
      setState(prev => ({
        ...prev,
        status: "playing",
        duration: chapterMetadata!.totalDuration,
        progress: null,
        currentPage: chapterMetadata!.pageBoundaries[0]?.pageNumber || 0,
      }));

    } catch (err: any) {
      // Ignore abort errors — these are intentional cancellations
      if (err.name === "AbortError") return;

      setState(prev => ({
        ...prev,
        status: "error",
        error: err.message || "Failed to load chapter audio",
        progress: null,
      }));
      optionsRef.current.onError?.(err instanceof Error ? err : new Error(err.message));
    }
  }, [handleTimeUpdate]);

  // ---- Playback controls ----

  const play = useCallback(() => {
    if (audioRef.current && state.status === "paused") {
      audioRef.current.play();
      setState(prev => ({ ...prev, status: "playing" }));
    }
  }, [state.status]);

  const pause = useCallback(() => {
    if (audioRef.current && state.status === "playing") {
      audioRef.current.pause();
      setState(prev => ({ ...prev, status: "paused" }));
    }
  }, [state.status]);

  const stop = useCallback(() => {
    // Abort any in-flight fetch
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    lastSentenceIdxRef.current = -1;
    lastPageRef.current = -1;
    setMetadata(null);
    metadataRef.current = null;
    setState({
      status: "idle",
      currentTime: 0,
      duration: 0,
      currentSentence: null,
      currentPage: 0,
      progress: null,
      error: null,
    });
  }, []);

  const seekToTime = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(time, audioRef.current.duration || 0));
    }
  }, []);

  // ---- Sentence-level seeking ----

  const seekToSentence = useCallback((pageNumber: number, lineIndex: number) => {
    const timings = metadataRef.current?.sentenceTimings;
    if (!timings || !audioRef.current) return;

    const target = timings.find(t => t.pageNumber === pageNumber && t.lineIndex === lineIndex);
    if (target) {
      audioRef.current.currentTime = target.startTime;
    }
  }, []);

  const seekToPage = useCallback((pageNumber: number) => {
    const boundaries = metadataRef.current?.pageBoundaries;
    if (!boundaries || !audioRef.current) return;

    const target = boundaries.find(b => b.pageNumber === pageNumber);
    if (target) {
      audioRef.current.currentTime = target.startTime;
    }
  }, []);

  const skipForwardSentence = useCallback(() => {
    const timings = metadataRef.current?.sentenceTimings;
    if (!timings || !audioRef.current) return;

    const currentIdx = lastSentenceIdxRef.current;
    const nextIdx = currentIdx + 1;
    if (nextIdx < timings.length) {
      audioRef.current.currentTime = timings[nextIdx].startTime;
    }
  }, []);

  const skipBackSentence = useCallback(() => {
    const timings = metadataRef.current?.sentenceTimings;
    if (!timings || !audioRef.current) return;

    const currentIdx = lastSentenceIdxRef.current;
    // If we're more than 2s into current sentence, restart it; otherwise go to previous
    const currentTiming = currentIdx >= 0 ? timings[currentIdx] : null;
    if (currentTiming && audioRef.current.currentTime - currentTiming.startTime > 2) {
      audioRef.current.currentTime = currentTiming.startTime;
    } else {
      const prevIdx = Math.max(0, currentIdx - 1);
      audioRef.current.currentTime = timings[prevIdx].startTime;
    }
  }, []);

  const skipForwardPage = useCallback(() => {
    const boundaries = metadataRef.current?.pageBoundaries;
    if (!boundaries || !audioRef.current) return;

    const currentPage = lastPageRef.current;
    const currentBoundaryIdx = boundaries.findIndex(b => b.pageNumber === currentPage);
    const nextIdx = currentBoundaryIdx + 1;
    if (nextIdx < boundaries.length) {
      audioRef.current.currentTime = boundaries[nextIdx].startTime;
    }
  }, []);

  const skipBackPage = useCallback(() => {
    const boundaries = metadataRef.current?.pageBoundaries;
    if (!boundaries || !audioRef.current) return;

    const currentPage = lastPageRef.current;
    const currentBoundaryIdx = boundaries.findIndex(b => b.pageNumber === currentPage);
    const prevIdx = Math.max(0, currentBoundaryIdx - 1);
    audioRef.current.currentTime = boundaries[prevIdx].startTime;
  }, []);

  // ---- Cleanup ----
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return {
    state,
    metadata,
    loadAndPlay,
    play,
    pause,
    stop,
    seekToTime,
    seekToSentence,
    seekToPage,
    skipForwardSentence,
    skipBackSentence,
    skipForwardPage,
    skipBackPage,
  };
}
