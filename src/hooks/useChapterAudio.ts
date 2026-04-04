// src/hooks/useChapterAudio.ts
// Client-side chapter audio playback with programmatic TextTrack sync.
// Builds VTTCue objects from sentenceTimings metadata and uses the browser's
// native cuechange events for highlight synchronization — zero network
// dependencies, no CORS, no VTT file needed.
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
  status: "idle" | "loading" | "generating" | "ready" | "playing" | "paused" | "error" | "finished";
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
// Helpers
// ============================================================================

/**
 * Build VTTCue objects from chapter metadata and add them to a TextTrack.
 * Each sentence gets a cue spanning its duration. Page changes are detected
 * from the page number embedded in each sentence cue.
 *
 * With Whisper-aligned timestamps, cue times match audible output directly.
 */
function buildCuesFromMetadata(
  track: TextTrack,
  metadata: ChapterAudioMetadata
): void {
  const timings = metadata.sentenceTimings;

  for (let i = 0; i < timings.length; i++) {
    const st = timings[i];

    // Make cues contiguous: extend endTime to the next sentence's startTime.
    // This keeps the highlight on the current sentence through the silence
    // gap between sentences, preventing cumulative drift from gaps where
    // no cue is active.
    const endTime = i < timings.length - 1
      ? timings[i + 1].startTime
      : st.endTime;

    const cue = new VTTCue(
      st.startTime,
      endTime,
      JSON.stringify({ t: "s", i, p: st.pageNumber, l: st.lineIndex, lang: st.language })
    );
    cue.id = `s-${i}`;
    track.addCue(cue);
  }
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
  const currentSentenceRef = useRef<SentenceTiming | null>(null);
  optionsRef.current = options;

  // TextTrack ref for reading active cues on demand
  const textTrackRef = useRef<TextTrack | null>(null);
  const audioInDOMRef = useRef(false);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- Binary search for current sentence by time (used for seeking) ----
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
        return mid;
      }
    }

    if (lo < timings.length) return lo;
    return -1;
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

  // ---- Process active cues and fire callbacks ----
  // Sentence highlights fire immediately from cue transitions.
  // Page turns are DELAYED because audio.currentTime runs ~1.5-2s ahead
  const processCues = useCallback((textTrack: TextTrack, emitPageChange: boolean) => {
    const activeCues = textTrack.activeCues;
    if (!activeCues || !metadataRef.current) return;

    let latestPayload: { i: number; p: number; l: number; lang: string } | null = null;

    for (let i = 0; i < activeCues.length; i++) {
      const cue = activeCues[i] as VTTCue;
      let payload: { t: string; i?: number; p?: number; l?: number; lang?: string };
      try { payload = JSON.parse(cue.text); } catch { continue; }

      if (payload.t === "s" && payload.i !== undefined && payload.p !== undefined) {
        if (!latestPayload || payload.i > latestPayload.i) {
          latestPayload = payload as { i: number; p: number; l: number; lang: string };
        }
      }
    }

    // Update sentence highlight
    if (latestPayload && latestPayload.i !== lastSentenceIdxRef.current) {
      lastSentenceIdxRef.current = latestPayload.i;
      const timing = metadataRef.current!.sentenceTimings[latestPayload.i];
      currentSentenceRef.current = timing;
      setState(prev => ({ ...prev, currentSentence: timing }));
      optionsRef.current.onSentenceChange?.(timing);
    }

    // Page turn (immediate — Whisper timestamps match audible output)
    if (emitPageChange && latestPayload && latestPayload.p !== lastPageRef.current) {
      lastPageRef.current = latestPayload.p;
      setState(prev => ({ ...prev, currentPage: latestPayload!.p }));
      optionsRef.current.onPageChange?.(latestPayload.p);
    }
  }, []);

  // On-demand sync: pick up current sentence highlight only (no page navigation)
  const syncFromActiveCues = useCallback(() => {
    const track = textTrackRef.current;
    if (track) processCues(track, false);
  }, [processCues]);

  // ---- Progress timer (~4x/sec for progress bar) ----
  const startProgressTimer = useCallback(() => {
    if (progressTimerRef.current) return;
    progressTimerRef.current = setInterval(() => {
      if (audioRef.current && !audioRef.current.paused) {
        setState(prev => ({ ...prev, currentTime: audioRef.current!.currentTime }));
      }
    }, 250);
  }, []);

  const stopProgressTimer = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  // ---- Remove audio element from DOM ----
  const removeAudioFromDOM = useCallback(() => {
    if (audioInDOMRef.current && audioRef.current && audioRef.current.parentNode) {
      audioRef.current.parentNode.removeChild(audioRef.current);
    }
    audioInDOMRef.current = false;
  }, []);

  // ---- Get current playback time ----
  const getCurrentTime = useCallback((): number => {
    return audioRef.current?.currentTime ?? 0;
  }, []);

  // ---- Get current sentence position ----
  const getCurrentPosition = useCallback((): { pageNumber: number; lineIndex: number } | null => {
    const st = currentSentenceRef.current;
    if (st) return { pageNumber: st.pageNumber, lineIndex: st.lineIndex };

    const time = audioRef.current?.currentTime ?? 0;
    const timings = metadataRef.current?.sentenceTimings;
    if (time > 0 && timings && timings.length > 0) {
      const idx = findSentenceAtTime(time);
      if (idx >= 0 && idx < timings.length) {
        return { pageNumber: timings[idx].pageNumber, lineIndex: timings[idx].lineIndex };
      }
    }
    return null;
  }, [findSentenceAtTime]);

  // ---- Load chapter audio and start playback ----
  const loadAndPlay = useCallback(async (request: ChapterAudioRequest & { initialSeekTime?: number; initialPage?: number; seekToPosition?: { pageNumber: number; lineIndex: number } }) => {
    if (abortRef.current) abortRef.current.abort();

    // Stop any existing audio
    if (audioRef.current) {
      audioRef.current.pause();
      removeAudioFromDOM();
      audioRef.current = null;
    }
    textTrackRef.current = null;
    stopProgressTimer();
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

    const loadStartTime = Date.now();
    let timeoutMs = 90_000;
    const abortOnTimeout = () => {
      const elapsed = Math.round((Date.now() - loadStartTime) / 1000);
      console.error(`[ChapterAudio] Timeout after ${elapsed}s (limit was ${Math.round(timeoutMs / 1000)}s)`);
      abortController.abort();
      setState(prev => ({
        ...prev,
        status: "error",
        error: "Audio generation timed out. Please try again.",
        progress: null,
      }));
      optionsRef.current.onError?.(new Error("Audio generation timed out"));
    };
    let timeoutId = setTimeout(abortOnTimeout, timeoutMs);

    let progressIntervalId: ReturnType<typeof setInterval> | null = null;
    let simulatedComplete = 0;
    const startSimulatedProgress = (total: number) => {
      if (progressIntervalId) return;
      const target = Math.floor(total * 0.5);
      const intervalMs = Math.max(500, (total * 1_000) / Math.max(target, 1));
      progressIntervalId = setInterval(() => {
        if (simulatedComplete >= target) {
          clearInterval(progressIntervalId!);
          progressIntervalId = null;
          return;
        }
        simulatedComplete++;
        setState(prev => ({
          ...prev,
          progress: { status: "generating", sentencesComplete: simulatedComplete, sentencesTotal: total },
        }));
      }, intervalMs);
    };
    const stopSimulatedProgress = () => {
      if (progressIntervalId) {
        clearInterval(progressIntervalId);
        progressIntervalId = null;
      }
    };

    try {
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

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let audioUrl = "";
      let chapterMetadata: ChapterAudioMetadata | null = null;
      let wasCached = false;
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const data = JSON.parse(line);

          if (data.type === "progress") {
            if (data.sentencesTotal && data.sentencesComplete === 0) {
              clearTimeout(timeoutId);
              timeoutMs = 60_000 + data.sentencesTotal * 3_000;
              console.log(`[ChapterAudio] ${data.sentencesTotal} segments — timeout set to ${Math.round(timeoutMs / 1000)}s`);
              timeoutId = setTimeout(abortOnTimeout, timeoutMs);
              startSimulatedProgress(data.sentencesTotal);
              setState(prev => ({
                ...prev,
                status: "generating",
                progress: { status: "generating", sentencesComplete: 0, sentencesTotal: data.sentencesTotal },
              }));
            }
          } else if (data.type === "complete") {
            stopSimulatedProgress();
            audioUrl = data.audioUrl;
            chapterMetadata = data.metadata;
            wasCached = !!data.cached;
            if (data.metadata?.totalSentences) {
              const total = data.metadata.totalSentences;
              setState(prev => ({
                ...prev,
                progress: { status: "complete", sentencesComplete: total, sentencesTotal: total },
              }));
            }
          } else if (data.type === "error") {
            throw new Error(data.error);
          }
        }
      }

      clearTimeout(timeoutId);
      stopSimulatedProgress();

      if (!audioUrl || !chapterMetadata) {
        throw new Error("No audio URL received from server");
      }

      if (abortController.signal.aborted) return;

      // Store metadata
      setMetadata(chapterMetadata);
      metadataRef.current = chapterMetadata;

      // Create audio element, append to DOM for TextTrack support
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.style.display = "none";
      document.body.appendChild(audio);
      audioInDOMRef.current = true;

      audio.addEventListener("ended", () => {
        stopProgressTimer();
        setState(prev => ({ ...prev, status: "finished", currentSentence: null }));
        optionsRef.current.onPlaybackComplete?.();
      });
      audio.addEventListener("error", () => {
        stopProgressTimer();
        setState(prev => ({ ...prev, status: "error", error: "Audio playback failed" }));
        optionsRef.current.onError?.(new Error("Audio playback failed"));
      });

      // ---- Wait for audio metadata to get actual decoded duration ----
      await new Promise<void>((resolve) => {
        if (audio.readyState >= 1) { resolve(); return; }
        audio.addEventListener("loadedmetadata", () => resolve(), { once: true });
      });

      setState(prev => ({ ...prev, duration: audio.duration }));

      // ---- Build TextTrack cues from Whisper-aligned metadata ----
      const textTrack = audio.addTextTrack("metadata", "sentence-sync", "en");
      textTrack.mode = "hidden"; // must be 'hidden' for cuechange to fire
      buildCuesFromMetadata(textTrack, chapterMetadata!);
      textTrackRef.current = textTrack;

      textTrack.addEventListener("cuechange", () => processCues(textTrack, true));

      // Diagnostic: log a sample timing to verify Whisper alignment reached client
      const sampleP3 = chapterMetadata!.sentenceTimings.filter(s => s.pageNumber === 3);
      if (sampleP3.length > 0) {
        const last = sampleP3[sampleP3.length - 1];
        console.log(`[ChapterAudio] Timing check — page 3 last sentence: [${last.startTime.toFixed(3)}-${last.endTime.toFixed(3)}] "${last.text.substring(0, 40)}"`);
      }
      console.log(`[ChapterAudio] TextTrack sync active — ${textTrack.cues?.length ?? 0} cues built from metadata`);

      // Seek to initial position before playing
      if (request.seekToPosition && chapterMetadata) {
        const target = chapterMetadata.sentenceTimings.find(
          t => t.pageNumber === request.seekToPosition!.pageNumber && t.lineIndex === request.seekToPosition!.lineIndex
        );
        if (target) {
          audio.currentTime = target.startTime;
        }
      } else if (request.initialSeekTime && request.initialSeekTime > 0) {
        audio.currentTime = request.initialSeekTime;
      } else if (request.initialPage && chapterMetadata) {
        const pageBoundary = chapterMetadata.pageBoundaries.find(b => b.pageNumber === request.initialPage);
        if (pageBoundary && pageBoundary.startTime > 0) {
          audio.currentTime = pageBoundary.startTime;
        }
      }

      // Determine the correct starting page from the seek position
      const startPage = request.seekToPosition
        ? request.seekToPosition.pageNumber
        : request.initialSeekTime
          ? (chapterMetadata!.pageBoundaries.findLast(b => b.startTime <= (request.initialSeekTime || 0))?.pageNumber
            ?? chapterMetadata!.pageBoundaries[0]?.pageNumber ?? 0)
          : request.initialPage
            ? request.initialPage
            : (chapterMetadata!.pageBoundaries[0]?.pageNumber || 0);

      // Pre-fire the first sentence highlight before audio starts
      const startTime = audio.currentTime;
      const firstSentenceIdx = findSentenceAtTime(startTime);
      if (firstSentenceIdx !== -1) {
        lastSentenceIdxRef.current = firstSentenceIdx;
        const timing = chapterMetadata!.sentenceTimings[firstSentenceIdx];
        setState(prev => ({ ...prev, currentSentence: timing }));
        optionsRef.current.onSentenceChange?.(timing);
      }

      if (wasCached) {
        await audio.play();
        startProgressTimer();
        // Sync from active cues immediately — cuechange won't fire for already-active cues
        requestAnimationFrame(() => syncFromActiveCues());
        setState(prev => ({
          ...prev,
          status: "playing",
          duration: chapterMetadata!.totalDuration,
          progress: null,
          currentPage: startPage,
        }));
      } else {
        const total = chapterMetadata!.totalSentences;
        setState(prev => ({
          ...prev,
          status: "ready",
          duration: chapterMetadata!.totalDuration,
          progress: { status: "complete" as const, sentencesComplete: total, sentencesTotal: total },
          currentPage: startPage,
        }));
      }

    } catch (err: any) {
      clearTimeout(timeoutId);
      stopSimulatedProgress();
      if (err.name === "AbortError") return;

      setState(prev => ({
        ...prev,
        status: "error",
        error: err.message || "Failed to load chapter audio",
        progress: null,
      }));
      optionsRef.current.onError?.(err instanceof Error ? err : new Error(err.message));
    }
  }, [startProgressTimer, stopProgressTimer, removeAudioFromDOM, findSentenceAtTime, processCues, syncFromActiveCues]);

  // ---- Playback controls ----

  const play = useCallback(() => {
    if (audioRef.current && !audioRef.current.ended) {
      audioRef.current.play();
      startProgressTimer();
      setState(prev => ({ ...prev, status: "playing" }));
      // Sync from active cues after resume — cuechange won't re-fire for already-active cues
      requestAnimationFrame(() => syncFromActiveCues());
    }
  }, [startProgressTimer, syncFromActiveCues]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      stopProgressTimer();
      setState(prev => ({ ...prev, status: "paused" }));
    }
  }, [stopProgressTimer]);

  const pauseSilently = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      stopProgressTimer();
    }
  }, [stopProgressTimer]);

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    stopProgressTimer();
    if (audioRef.current) {
      audioRef.current.pause();
      removeAudioFromDOM();
      audioRef.current = null;
    }
    textTrackRef.current = null;
    lastSentenceIdxRef.current = -1;
    lastPageRef.current = -1;
    currentSentenceRef.current = null;
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
  }, [stopProgressTimer, removeAudioFromDOM]);

  // After seeking, update highlight/page state immediately (cuechange will confirm)
  const syncAfterSeek = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const currentTime = audio.currentTime;
    setState(prev => ({ ...prev, currentTime }));

    const sentenceIdx = findSentenceAtTime(currentTime);
    if (sentenceIdx !== -1) {
      lastSentenceIdxRef.current = sentenceIdx;
      const timing = metadataRef.current!.sentenceTimings[sentenceIdx];
      currentSentenceRef.current = timing;
      setState(prev => ({ ...prev, currentSentence: timing }));
      optionsRef.current.onSentenceChange?.(timing);
    }

    const page = findPageAtTime(currentTime);
    if (page !== lastPageRef.current) {
      lastPageRef.current = page;
      setState(prev => ({ ...prev, currentPage: page }));
      optionsRef.current.onPageChange?.(page);
    }
  }, [findSentenceAtTime, findPageAtTime]);

  const seekToTime = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(time, audioRef.current.duration || 0));
      syncAfterSeek();
    }
  }, [syncAfterSeek]);

  const seekToSentence = useCallback((pageNumber: number, lineIndex: number) => {
    const timings = metadataRef.current?.sentenceTimings;
    if (!timings || !audioRef.current) return;

    const target = timings.find(t => t.pageNumber === pageNumber && t.lineIndex === lineIndex);
    if (target) {
      audioRef.current.currentTime = target.startTime;
      syncAfterSeek();
    }
  }, [syncAfterSeek]);

  const seekToPage = useCallback((pageNumber: number) => {
    const boundaries = metadataRef.current?.pageBoundaries;
    if (!boundaries || !audioRef.current) return;

    const target = boundaries.find(b => b.pageNumber === pageNumber);
    if (target) {
      audioRef.current.currentTime = target.startTime;
      syncAfterSeek();
    }
  }, [syncAfterSeek]);

  const skipForwardSentence = useCallback(() => {
    const timings = metadataRef.current?.sentenceTimings;
    if (!timings || !audioRef.current) return;

    const currentIdx = lastSentenceIdxRef.current;
    const nextIdx = currentIdx + 1;
    if (nextIdx < timings.length) {
      audioRef.current.currentTime = timings[nextIdx].startTime;
      syncAfterSeek();
    }
  }, [syncAfterSeek]);

  const skipBackSentence = useCallback(() => {
    const timings = metadataRef.current?.sentenceTimings;
    if (!timings || !audioRef.current) return;

    const currentIdx = lastSentenceIdxRef.current;
    const currentTiming = currentIdx >= 0 ? timings[currentIdx] : null;
    if (currentTiming && audioRef.current.currentTime - currentTiming.startTime > 2) {
      audioRef.current.currentTime = currentTiming.startTime;
    } else {
      const prevIdx = Math.max(0, currentIdx - 1);
      audioRef.current.currentTime = timings[prevIdx].startTime;
    }
    syncAfterSeek();
  }, [syncAfterSeek]);

  const skipForwardPage = useCallback(() => {
    const boundaries = metadataRef.current?.pageBoundaries;
    if (!boundaries || !audioRef.current) return;

    const currentPage = lastPageRef.current;
    const currentBoundaryIdx = boundaries.findIndex(b => b.pageNumber === currentPage);
    const nextIdx = currentBoundaryIdx + 1;
    if (nextIdx < boundaries.length) {
      audioRef.current.currentTime = boundaries[nextIdx].startTime;
      syncAfterSeek();
    }
  }, [syncAfterSeek]);

  const skipBackPage = useCallback(() => {
    const boundaries = metadataRef.current?.pageBoundaries;
    if (!boundaries || !audioRef.current) return;

    const currentPage = lastPageRef.current;
    const currentBoundaryIdx = boundaries.findIndex(b => b.pageNumber === currentPage);
    const prevIdx = Math.max(0, currentBoundaryIdx - 1);
    audioRef.current.currentTime = boundaries[prevIdx].startTime;
    syncAfterSeek();
  }, [syncAfterSeek]);

  // Reset sentence tracking so the next cuechange fires onSentenceChange
  // even if the same sentence index is active (e.g., after page navigation)
  const resetSentenceTracking = useCallback(() => {
    lastSentenceIdxRef.current = -1;
    syncFromActiveCues();
  }, [syncFromActiveCues]);

  // ---- Cleanup ----
  useEffect(() => {
    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        if (audioInDOMRef.current && audioRef.current.parentNode) {
          audioRef.current.parentNode.removeChild(audioRef.current);
        }
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
    pauseSilently,
    stop,
    seekToTime,
    seekToSentence,
    seekToPage,
    skipForwardSentence,
    skipBackSentence,
    skipForwardPage,
    skipBackPage,
    resetSentenceTracking,
    getCurrentPosition,
    getCurrentTime,
    setLookahead: (_sec: number) => {}, // no-op — TextTrack handles timing natively
  };
}
