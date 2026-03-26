// src/contexts/audio-player/AudioPlayerProvider.tsx
"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAzureTTS } from "@/hooks/useAzureTTS";
import { useChapterAudio } from "@/hooks/useChapterAudio";
import { getPrevNextPage, getNavigationUrl } from "@/utils/storyNavigation";
import { VOICE_CONFIG } from "@/lib/azure-speech";
import type { Language } from "@/types/i18n";
import type { StoryLine } from "@/lib/story-processing/text-processing";
import type { TTSLanguage } from "@/types/azure-tts";
import type { ChapterAudioMode } from "@/types/chapter-audio";
import type { AudioPlayerState, AudioPlayerContextType, StartPlaybackOptions, AudioPlayerPosition } from "./types";
import { DEFAULT_PLAYBACK_RATE } from "./types";
import { loadPlaybackRate, savePlaybackRate, persistState } from "./storage";
import { getContentSentences } from "./helpers";

// ============================================================================
// Context
// ============================================================================

const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null);

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error("useAudioPlayer must be used within AudioPlayerProvider");
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const lng = (params?.lng as Language) ?? "es";
  const oppositeLang: Language = lng === "en" ? "es" : "en";

  // ---- Legacy TTS instance (per-sentence chaining fallback) ----
  const {
    playTTS,
    stop: stopTTS,
    pause: pauseTTS,
    resume: resumeTTS,
  } = useAzureTTS({
    autoCache: true,
    onPlaybackComplete: () => handleSentenceComplete(),
    onError: (error) => {
      if (!error.message.includes("sign in")) {
        console.error("[AudioPlayer] TTS error:", error);
      }
      setState(prev => ({ ...prev, status: "error", error: error.message }));
    },
  });

  // ---- Chapter audio instance ----
  const chapterAudio = useChapterAudio({
    onSentenceChange: (timing) => {
      // Update highlighted sentence for the current page
      const s = stateRef.current;
      if (s.playbackMode === "chapter" && s.position) {
        if (timing.pageNumber === s.position.page) {
          setState(prev => ({ ...prev, highlightedSentenceIndex: timing.lineIndex }));
        }
      }
    },
    onPageChange: (pageNumber) => {
      const s = stateRef.current;
      if (s.playbackMode === "chapter" && s.position && pageNumber !== s.position.page) {
        // Pause audio during page transition — resume only if was playing
        wasPlayingBeforeNavRef.current = s.status === "playing";
        chapterAudio.pause();
        setState(prev => ({
          ...prev,
          status: "navigating",
          highlightedSentenceIndex: null,
          position: prev.position ? { ...prev.position, page: pageNumber, sentenceIndex: 0, currentLanguage: "target" } : null,
        }));

        const url = getNavigationUrl(
          lng, s.position.storySlug, s.position.level,
          s.position.chapter, pageNumber,
          s.position.isUserStory, s.position.userStoryId
        );
        router.push(url);
      }
    },
    onPlaybackComplete: () => {
      const s = stateRef.current;
      if (s.playbackMode !== "chapter" || !s.storyMap || !s.position) {
        setState(prev => ({ ...prev, status: "finished", highlightedSentenceIndex: null }));
        return;
      }

      // Check if there's a next chapter
      // Find the last page of the current chapter to determine if we need to advance
      const currentChapter = s.storyMap.chapters.find(c => c.chapter === s.position!.chapter);
      if (!currentChapter) {
        setState(prev => ({ ...prev, status: "finished", highlightedSentenceIndex: null }));
        return;
      }

      const nextChapter = s.storyMap.chapters.find(c => c.chapter === s.position!.chapter + 1);
      if (!nextChapter) {
        setState(prev => ({ ...prev, status: "finished", highlightedSentenceIndex: null }));
        return;
      }

      // Auto-advance to next chapter
      const nextPage = nextChapter.pages[0];
      setState(prev => ({
        ...prev,
        status: "loading",
        highlightedSentenceIndex: null,
        position: prev.position ? {
          ...prev.position,
          chapter: nextChapter.chapter,
          page: nextPage,
          sentenceIndex: 0,
          currentLanguage: "target",
        } : null,
      }));

      // Navigate to first page of next chapter
      const url = getNavigationUrl(
        lng, s.position.storySlug, s.position.level,
        nextChapter.chapter, nextPage,
        s.position.isUserStory, s.position.userStoryId
      );
      router.push(url);

      // Start chapter audio for the next chapter
      const chapterMode = getChapterAudioMode(s.mode);
      const speed = s.playbackRate === 0.7 ? "slow" as const : "normal" as const;
      chapterAudio.loadAndPlay({
        storySlug: s.position.storySlug,
        level: s.position.level,
        chapter: nextChapter.chapter,
        mode: chapterMode,
        speed,
      });
    },
    onError: (error) => {
      console.error("[AudioPlayer] Chapter audio error:", error);
      setState(prev => ({ ...prev, status: "error", error: error.message }));
    },
  });

  // ---- State ----
  const [state, setState] = useState<AudioPlayerState>({
    status: "idle",
    position: null,
    mode: "target-only",
    playbackMode: "chapter",
    currentPageSentences: [],
    storyMap: null,
    isVisible: false,
    highlightedSentenceIndex: null,
    error: null,
    playbackRate: DEFAULT_PLAYBACK_RATE,
    chapterCurrentTime: 0,
    chapterDuration: 0,
    chapterGenerationProgress: null,
  });

  useEffect(() => {
    setState(prev => ({ ...prev, playbackRate: loadPlaybackRate() }));
  }, []);

  const stateRef = useRef(state);
  stateRef.current = state;
  const pendingNavigationRef = useRef<{ chapter: number; page: number } | null>(null);
  const wasPlayingBeforeNavRef = useRef(false);
  const pendingSeekTimeRef = useRef<number | null>(null);

  // ---- Audio bookmark persistence ----
  const saveAudioBookmark = useCallback(async () => {
    const s = stateRef.current;
    if (s.playbackMode !== "chapter" || !s.position) return;
    const audioTime = chapterAudio.state.currentTime;
    if (!audioTime || audioTime <= 0) return;

    try {
      await fetch("/api/story-bookmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storySlug: s.position.storySlug,
          level: s.position.level,
          chapter: s.position.chapter,
          page: s.position.page,
          audioTime,
          audioMode: getChapterAudioMode(s.mode),
          audioSpeed: s.playbackRate === 0.7 ? "slow" : "normal",
        }),
      });
    } catch (e) {
      console.error("[AudioBookmark] Failed to save:", e);
    }
  }, [chapterAudio.state.currentTime]);

  // ---- Sync chapter audio state into our state ----
  useEffect(() => {
    if (stateRef.current.playbackMode !== "chapter") return;

    const cs = chapterAudio.state;

    setState(prev => {
      const updates: Partial<AudioPlayerState> = {
        chapterCurrentTime: cs.currentTime,
        chapterDuration: cs.duration,
      };

      // Map chapter audio status to our status
      if (cs.status === "generating") {
        updates.status = "generating";
        updates.chapterGenerationProgress = cs.progress
          ? { sentencesComplete: cs.progress.sentencesComplete, sentencesTotal: cs.progress.sentencesTotal }
          : null;
      } else if (cs.status === "playing" && prev.status !== "playing") {
        updates.status = "playing";
        updates.chapterGenerationProgress = null;

        // Perform pending seek after audio starts playing (e.g., resuming from audio bookmark)
        if (pendingSeekTimeRef.current !== null) {
          const seekTime = pendingSeekTimeRef.current;
          pendingSeekTimeRef.current = null;

          if (seekTime === -1) {
            // Sentinel: seek to the start of the current page
            const pos = stateRef.current.position;
            if (pos && chapterAudio.metadata?.pageBoundaries) {
              const pageBoundary = chapterAudio.metadata.pageBoundaries.find(b => b.pageNumber === pos.page);
              if (pageBoundary) {
                requestAnimationFrame(() => {
                  chapterAudio.seekToTime(pageBoundary.startTime);
                  chapterAudio.resetSentenceTracking();
                });
              }
            }
          } else {
            requestAnimationFrame(() => {
              chapterAudio.seekToTime(seekTime);
              chapterAudio.resetSentenceTracking();
            });
          }
        }
      } else if (cs.status === "paused" && prev.status !== "paused" && prev.status !== "navigating") {
        updates.status = "paused";
      } else if (cs.status === "error") {
        updates.status = "error";
        updates.error = cs.error;
      }

      return { ...prev, ...updates };
    });
  }, [chapterAudio.state]);

  // ---- Helper: determine ChapterAudioMode ----
  function getChapterAudioMode(languageMode: "target-only" | "bilingual"): ChapterAudioMode {
    if (languageMode === "bilingual") {
      return lng === "en" ? "bilingual-en" : "bilingual-es";
    }
    // Target-only: play the language the user is learning (oppositeLang)
    return oppositeLang === "es" ? "es" : "en";
  }

  // ---- TTS Language helper (legacy mode) ----
  const getTTSLanguage = useCallback((langKey: "target" | "native"): TTSLanguage => {
    if (langKey === "target") return oppositeLang === "es" ? "es-ES" : "en-US";
    return lng === "es" ? "es-ES" : "en-US";
  }, [lng, oppositeLang]);

  // ---- Legacy: play a specific sentence ----
  const playSentence = useCallback((sentences: StoryLine[], sentenceIndex: number, language: "target" | "native") => {
    const contentSentences = getContentSentences(sentences);
    const entry = contentSentences.find(e => e.originalIndex === sentenceIndex);
    if (!entry) { handleSentenceComplete(); return; }

    const text = language === "target" ? (entry.line[oppositeLang] || "").trim() : (entry.line[lng] || "").trim();
    if (!text) { handleSentenceComplete(); return; }

    const ttsLang = getTTSLanguage(language);
    const s = stateRef.current;
    const selectedVoice = VOICE_CONFIG[ttsLang].normal;

    setState(prev => ({
      ...prev,
      status: "playing",
      highlightedSentenceIndex: sentenceIndex,
      position: prev.position ? { ...prev.position, sentenceIndex, currentLanguage: language } : null,
    }));

    const effectiveRate = language === "native" ? undefined : s.playbackRate !== 1.0 ? s.playbackRate : undefined;
    playTTS({ text, language: ttsLang, speed: "normal", voice: selectedVoice, rate: effectiveRate, storySlug: s.position?.storySlug });
  }, [oppositeLang, lng, getTTSLanguage, playTTS]);

  // ---- Legacy: sentence complete handler ----
  const handleSentenceComplete = useCallback(() => {
    const s = stateRef.current;
    if (s.playbackMode === "chapter") return; // chapter mode handles this internally
    if (!s.position || s.status === "idle" || s.status === "finished" || s.status === "paused") return;

    const { position, mode, currentPageSentences, storyMap } = s;
    const contentSentences = getContentSentences(currentPageSentences);

    if (mode === "bilingual" && position.currentLanguage === "target") {
      setTimeout(() => playSentence(currentPageSentences, position.sentenceIndex, "native"), 300);
      return;
    }

    const currentContentIdx = contentSentences.findIndex(e => e.originalIndex === position.sentenceIndex);
    const nextContentIdx = currentContentIdx + 1;
    if (nextContentIdx < contentSentences.length) {
      playSentence(currentPageSentences, contentSentences[nextContentIdx].originalIndex, "target");
      return;
    }

    if (!storyMap) { setState(prev => ({ ...prev, status: "finished", highlightedSentenceIndex: null })); return; }
    const { next } = getPrevNextPage(position.chapter, position.page, storyMap);
    if (!next) { setState(prev => ({ ...prev, status: "finished", highlightedSentenceIndex: null })); return; }

    pendingNavigationRef.current = { chapter: next.ch, page: next.pg };
    setState(prev => ({
      ...prev,
      status: "navigating",
      highlightedSentenceIndex: null,
      position: prev.position ? { ...prev.position, chapter: next.ch, page: next.pg, sentenceIndex: 0, currentLanguage: "target" } : null,
    }));
    router.push(getNavigationUrl(lng, position.storySlug, position.level, next.ch, next.pg, position.isUserStory, position.userStoryId));
  }, [playSentence, lng, router]);

  // ==== Public Actions ====

  const startContinuousPlayback = useCallback(async (options: StartPlaybackOptions) => {
    stopTTS();
    chapterAudio.stop();
    pendingSeekTimeRef.current = null;

    const s = stateRef.current;
    const chapterMode = getChapterAudioMode(s.mode);
    const speed = s.playbackRate === 0.7 ? "slow" as const : "normal" as const;

    // Check for existing audio bookmark for this story
    let bookmarkChapter = options.chapter;
    let bookmarkPage = options.page;
    let bookmarkAudioTime: number | null = null;

    try {
      const res = await fetch(`/api/story-bookmark?storySlug=${encodeURIComponent(options.storySlug)}`);
      if (res.ok) {
        const data = await res.json();
        const bm = data.bookmark;
        if (bm?.audioTime != null && bm.level === options.level) {
          // Audio bookmark exists for same level — resume from there
          bookmarkChapter = bm.chapter;
          bookmarkPage = bm.page;
          bookmarkAudioTime = bm.audioTime;
        }
      }
    } catch {
      // Bookmark fetch failed — start from current position
    }

    const position: AudioPlayerPosition = {
      storySlug: options.storySlug,
      storyTitle: options.storyTitle,
      level: options.level,
      chapter: bookmarkChapter,
      page: bookmarkPage,
      sentenceIndex: options.sentenceIndex ?? 0,
      currentLanguage: "target",
      isUserStory: options.isUserStory,
      userStoryId: options.userStoryId,
    };

    setState(prev => ({
      ...prev,
      status: "loading",
      playbackMode: "chapter",
      position,
      storyMap: options.storyMap,
      currentPageSentences: options.sentences,
      isVisible: true,
      error: null,
      highlightedSentenceIndex: null,
      chapterCurrentTime: 0,
      chapterDuration: 0,
      chapterGenerationProgress: null,
    }));

    persistState(position, s.mode);

    // Navigate to the bookmarked page if different from current
    if (bookmarkChapter !== options.chapter || bookmarkPage !== options.page) {
      const url = getNavigationUrl(
        lng, options.storySlug, options.level,
        bookmarkChapter, bookmarkPage,
        options.isUserStory, options.userStoryId
      );
      router.push(url);
    }

    pendingSeekTimeRef.current = null;

    // Start chapter audio generation + playback.
    // initialSeekTime: exact audio position from bookmark
    // initialPage: seek to page start when no audio bookmark
    chapterAudio.loadAndPlay({
      storySlug: options.storySlug,
      level: options.level,
      chapter: bookmarkChapter,
      mode: chapterMode,
      speed,
      initialSeekTime: bookmarkAudioTime ?? undefined,
      initialPage: bookmarkAudioTime === null ? bookmarkPage : undefined,
    });

    // Media Session API
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: options.storyTitle, artist: "Cuentana" });
      navigator.mediaSession.setActionHandler("play", () => resumePlayback());
      navigator.mediaSession.setActionHandler("pause", () => pausePlayback());
    }
  }, [stopTTS, chapterAudio, lng, router]);

  const pausePlayback = useCallback(() => {
    const s = stateRef.current;
    if (s.playbackMode === "chapter") {
      saveAudioBookmark();
      chapterAudio.pause();
    } else {
      pauseTTS();
    }
    setState(prev => ({ ...prev, status: "paused" }));
  }, [pauseTTS, chapterAudio, saveAudioBookmark]);

  const resumePlayback = useCallback(() => {
    const s = stateRef.current;
    if (s.status !== "paused" || !s.position) return;
    if (s.playbackMode === "chapter") {
      chapterAudio.play();
    } else {
      resumeTTS();
    }
    setState(prev => ({ ...prev, status: "playing" }));
  }, [resumeTTS, chapterAudio]);

  const stopPlayback = useCallback(() => {
    saveAudioBookmark();
    stopTTS();
    chapterAudio.stop();
    pendingNavigationRef.current = null;
    persistState(null, stateRef.current.mode);
    setState(prev => ({
      ...prev,
      status: "idle",
      position: null,
      isVisible: false,
      highlightedSentenceIndex: null,
      error: null,
      currentPageSentences: [],
      storyMap: null,
      chapterCurrentTime: 0,
      chapterDuration: 0,
      chapterGenerationProgress: null,
    }));
  }, [stopTTS, chapterAudio, saveAudioBookmark]);

  const toggleMode = useCallback(() => {
    setState(prev => {
      const newMode = prev.mode === "target-only" ? "bilingual" : "target-only";
      if (prev.position) persistState(prev.position, newMode);
      return { ...prev, mode: newMode };
    });
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    savePlaybackRate(rate);
    setState(prev => ({ ...prev, playbackRate: rate }));
  }, []);

  const seekToTime = useCallback((time: number) => {
    if (stateRef.current.playbackMode === "chapter") {
      chapterAudio.seekToTime(time);
    }
  }, [chapterAudio]);

  // ---- Skip / Page Navigation ----

  const skipForward = useCallback(() => {
    const s = stateRef.current;
    if (s.playbackMode === "chapter") {
      chapterAudio.skipForwardSentence();
      return;
    }
    // Legacy
    if (!s.position || s.status === "navigating") return;
    stopTTS();
    const contentSentences = getContentSentences(s.currentPageSentences);
    const currentContentIdx = contentSentences.findIndex(e => e.originalIndex === s.position!.sentenceIndex);
    if (currentContentIdx + 1 < contentSentences.length) {
      playSentence(s.currentPageSentences, contentSentences[currentContentIdx + 1].originalIndex, "target");
    } else {
      handleSentenceComplete();
    }
  }, [stopTTS, playSentence, handleSentenceComplete, chapterAudio]);

  const skipBack = useCallback(() => {
    const s = stateRef.current;
    if (s.playbackMode === "chapter") {
      chapterAudio.skipBackSentence();
      return;
    }
    // Legacy
    if (!s.position || s.status === "navigating") return;
    stopTTS();
    const contentSentences = getContentSentences(s.currentPageSentences);
    const currentContentIdx = contentSentences.findIndex(e => e.originalIndex === s.position!.sentenceIndex);
    if (currentContentIdx - 1 >= 0) {
      playSentence(s.currentPageSentences, contentSentences[currentContentIdx - 1].originalIndex, "target");
    } else if (contentSentences.length > 0) {
      playSentence(s.currentPageSentences, contentSentences[0].originalIndex, "target");
    }
  }, [stopTTS, playSentence, chapterAudio]);

  const nextPage = useCallback(() => {
    const s = stateRef.current;
    if (s.playbackMode === "chapter") {
      chapterAudio.skipForwardPage();
      return;
    }
    // Legacy
    if (!s.position || !s.storyMap || s.status === "navigating") return;
    stopTTS();
    const { next } = getPrevNextPage(s.position.chapter, s.position.page, s.storyMap);
    if (!next) return;
    pendingNavigationRef.current = { chapter: next.ch, page: next.pg };
    setState(prev => ({
      ...prev, status: "navigating", highlightedSentenceIndex: null,
      position: prev.position ? { ...prev.position, chapter: next.ch, page: next.pg, sentenceIndex: 0, currentLanguage: "target" } : null,
    }));
    router.push(getNavigationUrl(lng, s.position.storySlug, s.position.level, next.ch, next.pg, s.position.isUserStory, s.position.userStoryId));
  }, [stopTTS, lng, router, chapterAudio]);

  const prevPage = useCallback(() => {
    const s = stateRef.current;
    if (s.playbackMode === "chapter") {
      chapterAudio.skipBackPage();
      return;
    }
    // Legacy
    if (!s.position || !s.storyMap || s.status === "navigating") return;
    stopTTS();
    const { prev: prevPg } = getPrevNextPage(s.position.chapter, s.position.page, s.storyMap);
    if (!prevPg) return;
    pendingNavigationRef.current = { chapter: prevPg.ch, page: prevPg.pg };
    setState(st => ({
      ...st, status: "navigating", highlightedSentenceIndex: null,
      position: st.position ? { ...st.position, chapter: prevPg.ch, page: prevPg.pg, sentenceIndex: 0, currentLanguage: "target" } : null,
    }));
    router.push(getNavigationUrl(lng, s.position.storySlug, s.position.level, prevPg.ch, prevPg.pg, s.position.isUserStory, s.position.userStoryId));
  }, [stopTTS, lng, router, chapterAudio]);

  // ---- Content Registration (called by StoryLayoutWithAzureTTS on mount) ----
  const registerPageContent = useCallback((sentences: StoryLine[], chapter: number, page: number) => {
    const s = stateRef.current;
    setState(prev => ({ ...prev, currentPageSentences: sentences }));

    // In chapter mode: resume audio after page navigation completes (only if was playing)
    if (s.playbackMode === "chapter") {
      if (s.status === "navigating") {
        chapterAudio.resetSentenceTracking();

        // Pre-set highlight to the first sentence on the new page before resuming audio
        // so the highlight is visible immediately when the page renders
        const firstSentence = chapterAudio.metadata?.sentenceTimings.find(t => t.pageNumber === page);
        if (firstSentence) {
          setState(prev => ({ ...prev, highlightedSentenceIndex: firstSentence.lineIndex }));
        }

        // Wait for DOM paint before resuming audio so text is visible first
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (wasPlayingBeforeNavRef.current) {
              chapterAudio.play();
              setState(prev => ({ ...prev, status: "playing" }));
            } else {
              setState(prev => ({ ...prev, status: "paused" }));
            }
          });
        });
      }
      return;
    }

    // Legacy mode: resume playback after page navigation
    if (s.status === "navigating" && pendingNavigationRef.current) {
      const pending = pendingNavigationRef.current;
      if (pending.chapter === chapter && pending.page === page) {
        pendingNavigationRef.current = null;
        const contentSentences = getContentSentences(sentences);
        if (contentSentences.length === 0) { handleSentenceComplete(); return; }
        const firstIndex = contentSentences[0].originalIndex;
        setState(prev => ({
          ...prev,
          currentPageSentences: sentences,
          position: prev.position ? { ...prev.position, chapter, page, sentenceIndex: firstIndex, currentLanguage: "target" } : null,
        }));
        setTimeout(() => playSentence(sentences, firstIndex, "target"), 500);
      }
    }
  }, [playSentence, handleSentenceComplete]);

  // ---- Auto-hide after finish ----
  useEffect(() => {
    if (state.status === "finished") {
      const timer = setTimeout(() => {
        setState(prev => ({ ...prev, isVisible: false, status: "idle", position: null, highlightedSentenceIndex: null }));
        persistState(null, state.mode);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [state.status, state.mode]);

  const value: AudioPlayerContextType = {
    state,
    startContinuousPlayback,
    pausePlayback,
    resumePlayback,
    stopPlayback,
    toggleMode,
    registerPageContent,
    skipForward,
    skipBack,
    nextPage,
    prevPage,
    isPlaying: state.status === "playing",
    setPlaybackRate,
    seekToTime,
  };

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  );
}
