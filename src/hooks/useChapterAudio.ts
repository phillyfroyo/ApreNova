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

  // Find the last sentence index per page (for page-end cues)
  const lastSentencePerPage = new Map<number, number>();
  for (let i = 0; i < timings.length; i++) {
    lastSentencePerPage.set(timings[i].pageNumber, i);
  }

  for (let i = 0; i < timings.length; i++) {
    const st = timings[i];

    // Sentence cue — uses PA-aligned endTime directly (no contiguous extension).
    // PA timestamps match audible output, so gaps between cues don't cause drift.
    const sentenceEnd = st.endTime;

    const sentenceCue = new VTTCue(
      st.startTime,
      sentenceEnd,
      JSON.stringify({ t: "s", i, p: st.pageNumber, l: st.lineIndex, lang: st.language })
    );
    sentenceCue.id = `s-${i}`;
    track.addCue(sentenceCue);

    // Page-end cue: spans the full inter-page silence gap for reliable
    // cuechange detection. Fires as soon as the last sentence ends.
    if (lastSentencePerPage.get(st.pageNumber) === i && i < timings.length - 1) {
      const nextSentence = timings[i + 1];
      const pageEndCue = new VTTCue(
        st.endTime,
        nextSentence.startTime,
        JSON.stringify({ t: "pe", fromPage: st.pageNumber, toPage: nextSentence.pageNumber })
      );
      pageEndCue.id = `pe-${st.pageNumber}`;
      track.addCue(pageEndCue);
    }

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
  const processCues = useCallback((textTrack: TextTrack, emitPageChange: boolean) => {
    const activeCues = textTrack.activeCues;
    if (!activeCues || !metadataRef.current) return;

    let latestSentence: { i: number; p: number; l: number; lang: string } | null = null;
    let pageEnd: { fromPage: number; toPage: number } | null = null;

    for (let i = 0; i < activeCues.length; i++) {
      const cue = activeCues[i] as VTTCue;
      let payload: any;
      try { payload = JSON.parse(cue.text); } catch { continue; }

      if (payload.t === "s" && payload.i !== undefined) {
        if (!latestSentence || payload.i > latestSentence.i) {
          latestSentence = payload;
        }
      } else if (payload.t === "pe" && payload.toPage !== undefined) {
        pageEnd = payload;
      }
    }

    // Update sentence highlight
    if (latestSentence && latestSentence.i !== lastSentenceIdxRef.current) {
      lastSentenceIdxRef.current = latestSentence.i;
      const timing = metadataRef.current!.sentenceTimings[latestSentence.i];
      currentSentenceRef.current = timing;
      setState(prev => ({ ...prev, currentSentence: timing }));
      optionsRef.current.onSentenceChange?.(timing);
    }

    // Page turn: fires from page-end cue at the exact moment the last
    // sentence on the current page finishes speaking (PA-aligned timestamp).
    // No delay needed — timestamps match audible output.
    if (emitPageChange && pageEnd && pageEnd.toPage !== lastPageRef.current) {
      lastPageRef.current = pageEnd.toPage;
      setState(prev => ({ ...prev, currentPage: pageEnd!.toPage }));
      optionsRef.current.onPageChange?.(pageEnd.toPage);
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
  const loadAndPlay = useCallback(async (request: ChapterAudioRequest & { initialSeekTime?: number; initialPage?: number; seekToPosition?: { pageNumber: number; lineIndex: number }; estimatedMs?: number }) => {
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
      const estimatedMs = request.estimatedMs;
      const TICK_MS = 500;

      if (estimatedMs && estimatedMs > 0) {
        // Estimate-based progress: linear to 80% across 80% of estimated time,
        // then +1 sentence per tick with 10% longer intervals each time, up to 98%.
        const fastPhaseMs = estimatedMs * 0.8;
        const fastPhaseTicks = Math.max(1, Math.floor(fastPhaseMs / TICK_MS));
        const fastTarget = Math.floor(total * 0.8);
        const increment = Math.max(1, Math.round(fastTarget / fastPhaseTicks));
        const ceiling = Math.floor(total * 0.98);
        let slowTickMs = TICK_MS;

        const tick = () => {
          if (simulatedComplete < fastTarget) {
            simulatedComplete = Math.min(fastTarget, simulatedComplete + increment);
          } else if (simulatedComplete < ceiling) {
            // Gradual slowdown: +1 sentence, 10% longer each tick
            simulatedComplete++;
            slowTickMs = Math.round(slowTickMs * 1.1);
          }
          setState(prev => ({
            ...prev,
            progress: { status: "generating", sentencesComplete: simulatedComplete, sentencesTotal: total },
          }));
          if (simulatedComplete < ceiling) {
            const nextMs = simulatedComplete < fastTarget ? TICK_MS : slowTickMs;
            progressIntervalId = setTimeout(tick, nextMs) as unknown as ReturnType<typeof setInterval>;
          }
        };
        progressIntervalId = setTimeout(tick, TICK_MS) as unknown as ReturnType<typeof setInterval>;
      } else {
        // No estimate available: simple linear progress to 50%
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
      }
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
              // Scale timeout: 120s base + 5s per segment. Bilingual chapters
              // with forced alignment (dual synthesis + dual PA) can take 8-10min.
              timeoutMs = 120_000 + data.sentencesTotal * 5_000;
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

            // Debug: log first 6 sentence timings to verify bilingual ordering
            if (data.metadata?.sentenceTimings) {
              console.log("[ChapterAudio] First 6 sentences in metadata:");
              for (const s of data.metadata.sentenceTimings.slice(0, 6)) {
                console.log(`  [${s.startTime.toFixed(2)}-${s.endTime.toFixed(2)}] lang=${s.language} line=${s.lineIndex} "${s.text.substring(0, 35)}"`);
              }
            }
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

      // ---- Build TextTrack cues from PA-aligned metadata ----
      const textTrack = audio.addTextTrack("metadata", "sentence-sync", "en");
      textTrack.mode = "hidden"; // must be 'hidden' for cuechange to fire
      buildCuesFromMetadata(textTrack, chapterMetadata!);
      textTrackRef.current = textTrack;

      textTrack.addEventListener("cuechange", () => processCues(textTrack, true));
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
      audioRef.current.play().catch(() => {}); // AbortError if interrupted by pause()
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
  // Sync sentence highlight + internal page tracking after a seek.
  // Does NOT fire onPageChange — callers handle page navigation themselves.
  // This prevents seek → onPageChange → navigation → seek loops.
  const syncSentenceAfterSeek = useCallback(() => {
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

    // Update page tracking silently so processCues doesn't re-fire
    // onPageChange for a page the caller already navigated to.
    const page = findPageAtTime(currentTime);
    if (page !== lastPageRef.current) {
      lastPageRef.current = page;
      setState(prev => ({ ...prev, currentPage: page }));
    }
  }, [findSentenceAtTime, findPageAtTime]);

  const seekToTime = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(time, audioRef.current.duration || 0));
      syncSentenceAfterSeek();
    }
  }, [syncSentenceAfterSeek]);

  const seekToSentence = useCallback((pageNumber: number, lineIndex: number) => {
    const timings = metadataRef.current?.sentenceTimings;
    if (!timings || !audioRef.current) return;

    const target = timings.find(t => t.pageNumber === pageNumber && t.lineIndex === lineIndex);
    if (target) {
      audioRef.current.currentTime = target.startTime;
      syncSentenceAfterSeek();
    }
  }, [syncSentenceAfterSeek]);

  const seekToPage = useCallback((pageNumber: number) => {
    const boundaries = metadataRef.current?.pageBoundaries;
    if (!boundaries || !audioRef.current) return;

    const target = boundaries.find(b => b.pageNumber === pageNumber);
    if (target) {
      audioRef.current.currentTime = target.startTime;
      syncSentenceAfterSeek();
    }
  }, [syncSentenceAfterSeek]);

  const skipForwardSentence = useCallback(() => {
    const timings = metadataRef.current?.sentenceTimings;
    if (!timings || !audioRef.current) return;

    const currentIdx = lastSentenceIdxRef.current;
    if (currentIdx < 0) return;
    const currentLine = timings[currentIdx].lineIndex;
    const currentPage = timings[currentIdx].pageNumber;

    // Find the next entry where lineIndex or pageNumber changes (next visual line)
    let nextIdx = currentIdx + 1;
    while (nextIdx < timings.length &&
           timings[nextIdx].lineIndex === currentLine &&
           timings[nextIdx].pageNumber === currentPage) {
      nextIdx++;
    }
    if (nextIdx < timings.length) {
      audioRef.current.currentTime = timings[nextIdx].startTime;
      syncSentenceAfterSeek();
    }
  }, [syncSentenceAfterSeek]);

  const skipBackSentence = useCallback(() => {
    const timings = metadataRef.current?.sentenceTimings;
    if (!timings || !audioRef.current) return;

    const currentIdx = lastSentenceIdxRef.current;
    if (currentIdx < 0) return;
    const currentTiming = timings[currentIdx];

    // If more than 2s into current line, restart it (go to first entry of this line)
    if (audioRef.current.currentTime - currentTiming.startTime > 2) {
      // Find the first entry for this lineIndex + pageNumber
      let lineStart = currentIdx;
      while (lineStart > 0 &&
             timings[lineStart - 1].lineIndex === currentTiming.lineIndex &&
             timings[lineStart - 1].pageNumber === currentTiming.pageNumber) {
        lineStart--;
      }
      audioRef.current.currentTime = timings[lineStart].startTime;
    } else {
      // Go to the previous visual line (find where lineIndex changes going backward)
      let prevIdx = currentIdx - 1;
      // Skip past other entries on the same line (e.g., native language of current line)
      while (prevIdx >= 0 &&
             timings[prevIdx].lineIndex === currentTiming.lineIndex &&
             timings[prevIdx].pageNumber === currentTiming.pageNumber) {
        prevIdx--;
      }
      if (prevIdx >= 0) {
        // Now find the first entry of that previous line
        const prevLine = timings[prevIdx].lineIndex;
        const prevPage = timings[prevIdx].pageNumber;
        while (prevIdx > 0 &&
               timings[prevIdx - 1].lineIndex === prevLine &&
               timings[prevIdx - 1].pageNumber === prevPage) {
          prevIdx--;
        }
        audioRef.current.currentTime = timings[prevIdx].startTime;
      } else {
        audioRef.current.currentTime = timings[0].startTime;
      }
    }
    syncSentenceAfterSeek();
  }, [syncSentenceAfterSeek]);

  const skipForwardPage = useCallback(() => {
    const boundaries = metadataRef.current?.pageBoundaries;
    if (!boundaries || !audioRef.current) return;

    const currentPage = lastPageRef.current;
    const currentBoundaryIdx = boundaries.findIndex(b => b.pageNumber === currentPage);
    const nextIdx = currentBoundaryIdx + 1;
    if (nextIdx < boundaries.length) {
      audioRef.current.currentTime = boundaries[nextIdx].startTime;
      syncSentenceAfterSeek();
    }
  }, [syncSentenceAfterSeek]);

  const skipBackPage = useCallback(() => {
    const boundaries = metadataRef.current?.pageBoundaries;
    if (!boundaries || !audioRef.current) return;

    const currentPage = lastPageRef.current;
    const currentBoundaryIdx = boundaries.findIndex(b => b.pageNumber === currentPage);
    const prevIdx = Math.max(0, currentBoundaryIdx - 1);
    audioRef.current.currentTime = boundaries[prevIdx].startTime;
    syncSentenceAfterSeek();
  }, [syncSentenceAfterSeek]);

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
