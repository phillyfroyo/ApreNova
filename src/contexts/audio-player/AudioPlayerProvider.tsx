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
import type { AudioPlayerState, AudioPlayerStatus, AudioPlayerContextType, StartPlaybackOptions, AudioPlayerPosition, AudioLanguageMode, PendingPlayback } from "./types";
import { DEFAULT_PLAYBACK_RATE, DEFAULT_CACHE_STATUS } from "./types";
import type { VariantCacheStatus } from "./types";
import { loadPlaybackRate, savePlaybackRate, loadLanguageMode, saveLanguageMode, persistState } from "./storage";
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
      // DOM-direct highlight — bypasses React render for instant transitions
      const s = stateRef.current;
      if (s.playbackMode === "chapter" && s.position) {
        if (timing.pageNumber === s.position.page) {
          applyHighlight(timing.lineIndex, timing.language);
        }
      }
    },
    onPageChange: (pageNumber) => {
      const s = stateRef.current;
      if (s.playbackMode === "chapter" && s.position && pageNumber !== s.position.page) {
        navigatingToPageRef.current = { page: pageNumber, shouldResume: true };
        chapterAudio.pauseSilently();
        setStatusOverride("navigating"); // Synchronous ref + re-render trigger

        setState(prev => ({
          ...prev,
          highlightedSentenceIndex: null, highlightedLanguage: null,
          position: prev.position ? { ...prev.position, page: pageNumber, sentenceIndex: 0, currentLanguage: "target" } : null,
        }));

        const view = currentViewRef.current;
        if (view && view.storySlug === s.position.storySlug && view.level === s.position.level) {
          const url = getNavigationUrl(
            lng, s.position.storySlug, s.position.level,
            s.position.chapter, pageNumber,
            s.position.isUserStory, s.position.userStoryId
          );
          router.push(url);
        }
      }
    },
    onPlaybackComplete: async () => {
      try {
      const s = stateRef.current;
      if (s.playbackMode !== "chapter" || !s.storyMap || !s.position) {
        setStatusOverride("finished");
        setState(prev => ({ ...prev, highlightedSentenceIndex: null, highlightedLanguage: null }));
        return;
      }

      const currentChapter = s.storyMap.chapters.find(c => c.chapter === s.position!.chapter);
      if (!currentChapter) {
        setStatusOverride("finished");
        setState(prev => ({ ...prev, highlightedSentenceIndex: null, highlightedLanguage: null }));
        return;
      }

      const nextChapter = s.storyMap.chapters.find(c => c.chapter === s.position!.chapter + 1);
      if (!nextChapter) {
        setStatusOverride("finished");
        setState(prev => ({ ...prev, highlightedSentenceIndex: null, highlightedLanguage: null }));
        return;
      }

      // Auto-advance to next chapter — check cache first
      const nextPage = nextChapter.pages[0];
      const chapterMode = getChapterAudioMode(s.mode);
      const speed = s.playbackRate === 0.7 ? "slow" as const : "normal" as const;

      // Build options for the next chapter
      const nextOptions: StartPlaybackOptions = {
        storySlug: s.position.storySlug,
        storyTitle: s.position.storyTitle,
        level: s.position.level,
        chapter: nextChapter.chapter,
        page: nextPage,
        sentenceIndex: 0,
        isUserStory: s.position.isUserStory,
        userStoryId: s.position.userStoryId,
        storyMap: s.storyMap!,
        sentences: s.currentPageSentences,
      };

      // Check cache status for all variants of the next chapter
      const { isCached, cacheStatus } = await fetchCacheStatus(
        s.position.storySlug, s.position.level, nextChapter.chapter, s.mode, speed
      );

      if (isCached) {
        // Cached — seamless transition
        setStatusOverride(null);
        setState(prev => ({
          ...prev,
          highlightedSentenceIndex: null, highlightedLanguage: null,
          position: prev.position ? {
            ...prev.position,
            chapter: nextChapter.chapter,
            page: nextPage,
            sentenceIndex: 0,
            currentLanguage: "target",
          } : null,
        }));

        const url = getNavigationUrl(
          lng, s.position.storySlug, s.position.level,
          nextChapter.chapter, nextPage,
          s.position.isUserStory, s.position.userStoryId
        );
        router.push(url);

        chapterAudio.loadAndPlay({
          storySlug: s.position.storySlug,
          level: s.position.level,
          chapter: nextChapter.chapter,
          mode: chapterMode,
          speed,
        });
      } else {
        // Not cached — show settings picker
        setStatusOverride("idle");
        setState(prev => ({
          ...prev,
          highlightedSentenceIndex: null, highlightedLanguage: null,
          pendingPlayback: {
            options: nextOptions,
            resolvedChapter: nextChapter.chapter,
            resolvedPage: nextPage,
            bookmarkAudioTime: null,
            cacheStatus,
          },
        }));
      }
      } catch (err) {
        console.error("[AudioPlayer] Auto-advance error:", err);
        setStatusOverride("finished");
        setState(prev => ({ ...prev, highlightedSentenceIndex: null, highlightedLanguage: null }));
      }
    },
    onError: (error) => {
      console.error("[AudioPlayer] Chapter audio error:", error);
      setStatusOverride("error");
      setState(prev => ({ ...prev, error: error.message }));
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
    highlightedSentenceIndex: null, highlightedLanguage: null,
    error: null,
    playbackRate: DEFAULT_PLAYBACK_RATE,
    chapterCurrentTime: 0,
    chapterDuration: 0,
    chapterGenerationProgress: null,
    generationLabel: null,
    pendingPlayback: null,
  });

  useEffect(() => {
    setState(prev => ({ ...prev, playbackRate: loadPlaybackRate(), mode: loadLanguageMode() }));
  }, []);

  const stateRef = useRef(state);
  stateRef.current = state;

  // ---- Status override for chapter mode ----
  // In chapter mode, useChapterAudio.state.status is the source of truth for audio
  // lifecycle (loading/generating/playing/paused/error/finished). The provider only
  // needs to overlay transient states like "navigating" and "idle".
  // We use a ref (synchronous reads in callbacks) paired with state (triggers re-renders).
  const [statusOverride, setStatusOverrideState] = useState<AudioPlayerStatus | null>(null);
  const statusOverrideRef = useRef<AudioPlayerStatus | null>(null);
  const setStatusOverride = useCallback((status: AudioPlayerStatus | null) => {
    statusOverrideRef.current = status;
    setStatusOverrideState(status);
  }, []);

  const pendingNavigationRef = useRef<{ chapter: number; page: number } | null>(null);
  const navigatingToPageRef = useRef<{ page: number; shouldResume: boolean } | null>(null);
  const pendingSeekTimeRef = useRef<number | null>(null);
  // Deferred label for variant reloads — applied only once generation actually starts
  const pendingGenerationLabelRef = useRef<string | null>(null);
  // Tracks the story/level currently rendered — set by registerPageContent
  const currentViewRef = useRef<{ storySlug: string; level: string; chapter: number; page: number } | null>(null);
  // DOM-direct highlight: refs to sentence line elements, registered by StoryLayout
  const sentenceElementsRef = useRef<React.MutableRefObject<(HTMLDivElement | null)[]> | null>(null);
  const lastHighlightRef = useRef<{ lineIndex: number; language: "en" | "es" | null } | null>(null);

  // ---- DOM-direct highlight manipulation (bypasses React render for instant transitions) ----
  const applyHighlight = useCallback((lineIndex: number, language: "en" | "es") => {
    const prev = lastHighlightRef.current;
    const refs = sentenceElementsRef.current?.current;
    if (!refs) return;

    // Clear previous highlight
    if (prev) {
      const prevEl = refs[prev.lineIndex];
      if (prevEl) {
        prevEl.classList.remove("audio-highlight");
        prevEl.querySelector("[data-target-line]")?.classList.remove("audio-highlight-target");
        prevEl.querySelector("[data-native-line]")?.classList.remove("audio-highlight-native");
        // Clear bilingual outer highlight
        const textContent = prevEl.querySelector("[data-text-content]") as HTMLElement | null;
        if (textContent) textContent.classList.remove("audio-highlight-bilingual");
      }
    }

    // Apply new highlight
    const el = refs[lineIndex];
    if (el) {
      const s = stateRef.current;
      const isBilingual = s.mode === "bilingual" && s.isVisible;

      if (isBilingual) {
        // Bilingual: highlight the specific sub-line + outer container
        const textContent = el.querySelector("[data-text-content]") as HTMLElement | null;
        if (textContent) textContent.classList.add("audio-highlight-bilingual");

        const oppLang = lng === "en" ? "es" : "en";
        if (language === oppLang) {
          el.querySelector("[data-target-line]")?.classList.add("audio-highlight-target");
        } else {
          el.querySelector("[data-native-line]")?.classList.add("audio-highlight-native");
        }
      } else {
        // Normal: highlight the whole line
        el.classList.add("audio-highlight");
      }
    }

    // Auto-scroll when the highlighted line changes (not just language within same line)
    if (el && (!prev || prev.lineIndex !== lineIndex)) {
      const isMobile = window.innerWidth < 768;
      const rect = el.getBoundingClientRect();
      const targetY = window.scrollY + rect.top - window.innerHeight * (isMobile ? 0.25 : 0.35);
      window.scrollTo({ top: targetY, behavior: "smooth" });
    }

    lastHighlightRef.current = { lineIndex, language };
  }, [lng]);

  const clearHighlight = useCallback(() => {
    const prev = lastHighlightRef.current;
    const refs = sentenceElementsRef.current?.current;
    if (prev && refs) {
      const el = refs[prev.lineIndex];
      if (el) {
        el.classList.remove("audio-highlight");
        el.querySelector("[data-target-line]")?.classList.remove("audio-highlight-target");
        el.querySelector("[data-native-line]")?.classList.remove("audio-highlight-native");
        const textContent = el.querySelector("[data-text-content]") as HTMLElement | null;
        if (textContent) textContent.classList.remove("audio-highlight-bilingual");
      }
    }
    lastHighlightRef.current = null;
  }, []);

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

  // ---- Sync chapter audio data (NOT status) into provider state ----
  // Status is now derived via effectiveStatus; this effect only syncs progress bar
  // data and handles pending seeks.
  useEffect(() => {
    if (stateRef.current.playbackMode !== "chapter") return;

    const cs = chapterAudio.state;

    setState(prev => ({
      ...prev,
      chapterCurrentTime: cs.currentTime,
      chapterDuration: cs.duration,
      chapterGenerationProgress: cs.status === "generating" && cs.progress
        ? { sentencesComplete: cs.progress.sentencesComplete, sentencesTotal: cs.progress.sentencesTotal }
        : cs.status === "ready" && cs.progress
          ? { sentencesComplete: cs.progress.sentencesComplete, sentencesTotal: cs.progress.sentencesTotal }
          : (cs.status === "ready" ? prev.chapterGenerationProgress : (cs.status !== "generating" ? null : prev.chapterGenerationProgress)),
      // Apply deferred variant-reload label once generation starts (not during loading/cache check);
      // clear once audio is playing or ready
      generationLabel: (cs.status === "playing" || cs.status === "ready") ? null
        : cs.status === "generating" && pendingGenerationLabelRef.current
          ? pendingGenerationLabelRef.current
          : prev.generationLabel,
    }));

    // Clear pending generation label ref after it's been applied or is no longer needed
    if (cs.status === "generating" || cs.status === "playing" || cs.status === "ready") {
      pendingGenerationLabelRef.current = null;
    }

    // Handle pending seek when audio starts playing (e.g., resuming from bookmark)
    if (cs.status === "playing" && pendingSeekTimeRef.current !== null) {
      const seekTime = pendingSeekTimeRef.current;
      pendingSeekTimeRef.current = null;

      if (seekTime === -1) {
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

    // Clear redundant overrides once the hook's status matches.
    // "navigating" is NOT cleared here — registerPageContent handles that after a paint frame.
    // "playing" override is cleared once the hook confirms it's playing.
    const override = statusOverrideRef.current;
    if (override && override !== "navigating" && cs.status === override) {
      setStatusOverride(null);
    }
  }, [chapterAudio.state]);

  // ---- Helper: determine ChapterAudioMode ----
  function getChapterAudioMode(languageMode: "target-only" | "bilingual"): ChapterAudioMode {
    if (languageMode === "bilingual") {
      return lng === "en" ? "bilingual-en" : "bilingual-es";
    }
    // Target-only: play the language the user is learning (oppositeLang)
    return oppositeLang === "es" ? "es" : "en";
  }

  // ---- Helper: check cache status for all variants of a chapter ----
  async function fetchCacheStatus(
    storySlug: string, level: string, chapter: number, mode: AudioLanguageMode, speed: "normal" | "slow"
  ): Promise<{ isCached: boolean; cacheStatus: VariantCacheStatus }> {
    const targetMode = getChapterAudioMode("target-only");
    const bilingualMode = getChapterAudioMode("bilingual");
    let cacheStatus: VariantCacheStatus = { ...DEFAULT_CACHE_STATUS };
    let isCached = false;
    try {
      const res = await fetch(
        `/api/azure-tts/chapter-cache-status?storySlug=${encodeURIComponent(storySlug)}&level=${encodeURIComponent(level)}&chapter=${chapter}&targetMode=${targetMode}&bilingualMode=${bilingualMode}`
      );
      if (res.ok) {
        cacheStatus = await res.json();
        const modeStatus = mode === "bilingual" ? cacheStatus.bilingual : cacheStatus.target;
        isCached = speed === "slow" ? modeStatus.slow : modeStatus.normal;
      }
    } catch { /* treat as uncached — show picker */ }
    return { isCached, cacheStatus };
  }

  // ---- Helper: build PendingPlayback options from current position ----
  function buildPendingFromPosition(
    s: AudioPlayerState,
    cacheStatus: VariantCacheStatus,
    seekToPosition?: { pageNumber: number; lineIndex: number },
    wasPlaying?: boolean,
  ): PendingPlayback {
    return {
      options: {
        storySlug: s.position!.storySlug,
        storyTitle: s.position!.storyTitle,
        level: s.position!.level,
        chapter: s.position!.chapter,
        page: s.position!.page,
        isUserStory: s.position!.isUserStory,
        userStoryId: s.position!.userStoryId,
        storyMap: s.storyMap!,
        sentences: s.currentPageSentences,
      },
      resolvedChapter: s.position!.chapter,
      resolvedPage: s.position!.page,
      bookmarkAudioTime: null,
      seekToPosition,
      wasPlaying,
      cacheStatus,
    };
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

    if (!storyMap) { setState(prev => ({ ...prev, status: "finished", highlightedSentenceIndex: null, highlightedLanguage: null })); return; }
    const { next } = getPrevNextPage(position.chapter, position.page, storyMap);
    if (!next) { setState(prev => ({ ...prev, status: "finished", highlightedSentenceIndex: null, highlightedLanguage: null })); return; }

    pendingNavigationRef.current = { chapter: next.ch, page: next.pg };
    setState(prev => ({
      ...prev,
      status: "navigating",
      highlightedSentenceIndex: null, highlightedLanguage: null,
      position: prev.position ? { ...prev.position, chapter: next.ch, page: next.pg, sentenceIndex: 0, currentLanguage: "target" } : null,
    }));
    router.push(getNavigationUrl(lng, position.storySlug, position.level, next.ch, next.pg, position.isUserStory, position.userStoryId));
  }, [playSentence, lng, router]);

  // ==== Public Actions ====

  // ---- Helper: begin playback (used by startContinuousPlayback when cached, and by confirmAndPlay) ----
  const beginPlayback = useCallback((
    options: StartPlaybackOptions,
    resolvedChapter: number,
    resolvedPage: number,
    bookmarkAudioTime: number | null,
    modeOverride?: AudioLanguageMode,
    speedOverride?: number,
    seekToPosition?: { pageNumber: number; lineIndex: number },
  ) => {
    const s = stateRef.current;
    const effectiveMode = modeOverride ?? s.mode;
    const effectiveRate = speedOverride ?? s.playbackRate;
    const chapterMode = getChapterAudioMode(effectiveMode);
    const speed = effectiveRate === 0.7 ? "slow" as const : "normal" as const;

    // Bilingual mode needs less lookahead (highlights were jumping ahead);
    // normal mode needs more (highlights were lagging behind)
    chapterAudio.setLookahead(effectiveMode === "bilingual" ? 0 : 0.15);

    const position: AudioPlayerPosition = {
      storySlug: options.storySlug,
      storyTitle: options.storyTitle,
      level: options.level,
      chapter: resolvedChapter,
      page: resolvedPage,
      sentenceIndex: options.sentenceIndex ?? 0,
      currentLanguage: "target",
      isUserStory: options.isUserStory,
      userStoryId: options.userStoryId,
    };

    setStatusOverride(null);

    setState(prev => ({
      ...prev,
      playbackMode: "chapter",
      position,
      mode: effectiveMode,
      playbackRate: effectiveRate,
      storyMap: options.storyMap,
      currentPageSentences: options.sentences,
      isVisible: true,
      error: null,
      highlightedSentenceIndex: null, highlightedLanguage: null,
      chapterCurrentTime: 0,
      chapterDuration: 0,
      chapterGenerationProgress: null,
      generationLabel: null,
      pendingPlayback: null,
    }));

    persistState(position, effectiveMode);

    // Navigate to the bookmarked page if different from current
    if (resolvedChapter !== options.chapter || resolvedPage !== options.page) {
      const url = getNavigationUrl(
        lng, options.storySlug, options.level,
        resolvedChapter, resolvedPage,
        options.isUserStory, options.userStoryId
      );
      router.push(url);
    }

    pendingSeekTimeRef.current = null;

    chapterAudio.loadAndPlay({
      storySlug: options.storySlug,
      level: options.level,
      chapter: resolvedChapter,
      mode: chapterMode,
      speed,
      seekToPosition,
      initialSeekTime: !seekToPosition ? (bookmarkAudioTime ?? undefined) : undefined,
      initialPage: !seekToPosition && bookmarkAudioTime === null ? resolvedPage : undefined,
    });

    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: options.storyTitle, artist: "Cuentana" });
      navigator.mediaSession.setActionHandler("play", () => resumePlayback());
      navigator.mediaSession.setActionHandler("pause", () => pausePlayback());
    }
  }, [chapterAudio, lng, router]);

  const startContinuousPlayback = useCallback(async (options: StartPlaybackOptions) => {
    stopTTS();
    chapterAudio.stop();
    pendingSeekTimeRef.current = null;

    const s = stateRef.current;
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
          bookmarkChapter = bm.chapter;
          bookmarkPage = bm.page;
          bookmarkAudioTime = bm.audioTime;
        }
      }
    } catch {
      // Bookmark fetch failed — start from current position
    }

    // Check cache status for all variants
    const { isCached, cacheStatus } = await fetchCacheStatus(
      options.storySlug, options.level, bookmarkChapter, s.mode, speed
    );

    if (isCached) {
      // Variant is cached — play immediately
      beginPlayback(options, bookmarkChapter, bookmarkPage, bookmarkAudioTime);
    } else {
      // Not cached — show settings picker so user can choose before generating
      setState(prev => ({
        ...prev,
        isVisible: true,
        pendingPlayback: {
          options,
          resolvedChapter: bookmarkChapter,
          resolvedPage: bookmarkPage,
          bookmarkAudioTime,
          cacheStatus,
        },
      }));
    }
  }, [stopTTS, chapterAudio, beginPlayback]);

  const confirmAndPlay = useCallback((modeOverride?: AudioLanguageMode, speedOverride?: number) => {
    const pending = stateRef.current.pendingPlayback;
    if (!pending) return;
    beginPlayback(pending.options, pending.resolvedChapter, pending.resolvedPage, pending.bookmarkAudioTime, modeOverride, speedOverride, pending.seekToPosition);
  }, [beginPlayback]);

  const dismissPicker = useCallback(() => {
    const s = stateRef.current;
    const pending = s.pendingPlayback;
    const midPlayback = pending?.seekToPosition != null;
    setState(prev => ({
      ...prev,
      pendingPlayback: null,
      // If picker was shown mid-playback, keep player visible
      isVisible: midPlayback ? prev.isVisible : false,
    }));
    // Only resume if audio was actually playing when the picker opened
    if (midPlayback && pending?.wasPlaying) {
      chapterAudio.play();
    }
  }, [chapterAudio]);

  const pausePlayback = useCallback(() => {
    const s = stateRef.current;
    if (s.playbackMode === "chapter") {
      saveAudioBookmark();
      chapterAudio.pause(); // hook sets its own status to "paused" → flows through effectiveStatus
      setStatusOverride(null); // clear any override so hook status is visible
    } else {
      pauseTTS();
      setState(prev => ({ ...prev, status: "paused" }));
    }
  }, [pauseTTS, chapterAudio, saveAudioBookmark]);

  const resumePlayback = useCallback(() => {
    const s = stateRef.current;
    // For chapter mode, check hook's status directly; for legacy, check provider state
    const currentStatus = s.playbackMode === "chapter"
      ? (statusOverrideRef.current ?? chapterAudio.state.status)
      : s.status;
    if ((currentStatus !== "paused" && currentStatus !== "ready") || !s.position) return;
    if (s.playbackMode === "chapter") {
      setStatusOverride(null); // clear override, hook's "playing" flows through
      chapterAudio.play();
    } else {
      resumeTTS();
      setState(prev => ({ ...prev, status: "playing" }));
    }
  }, [resumeTTS, chapterAudio]);

  const stopPlayback = useCallback(() => {
    // Clear audio bookmark so reading bookmark takes precedence on next play
    const s = stateRef.current;
    if (s.playbackMode === "chapter" && s.position) {
      fetch("/api/story-bookmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storySlug: s.position.storySlug,
          level: s.position.level,
          chapter: s.position.chapter,
          page: s.position.page,
        }),
      }).catch(() => {});
    }
    stopTTS();
    chapterAudio.stop();
    setStatusOverride("idle");
    pendingNavigationRef.current = null;
    navigatingToPageRef.current = null;
    persistState(null, stateRef.current.mode);
    setState(prev => ({
      ...prev,
      position: null,
      isVisible: false,
      highlightedSentenceIndex: null, highlightedLanguage: null,
      error: null,
      currentPageSentences: [],
      storyMap: null,
      chapterCurrentTime: 0,
      chapterDuration: 0,
      chapterGenerationProgress: null,
      generationLabel: null,
    }));
  }, [stopTTS, chapterAudio, saveAudioBookmark]);

  const toggleMode = useCallback(async () => {
    const s = stateRef.current;
    const newMode = s.mode === "target-only" ? "bilingual" : "target-only";

    // If actively playing/paused in chapter mode, check cache before changing mode
    const hookStatus = chapterAudio.state.status;
    const isActive = s.position && s.playbackMode === "chapter" &&
      (hookStatus === "playing" || hookStatus === "paused");

    if (!isActive) {
      // No audio playing — just update the preference
      saveLanguageMode(newMode);
      setState(prev => {
        if (prev.position) persistState(prev.position, newMode);
        return { ...prev, mode: newMode };
      });
      return;
    }

    // Immediately pause and show loading state
    const wasPlaying = hookStatus === "playing";
    const seekPos = chapterAudio.getCurrentPosition() ?? undefined;
    chapterAudio.pause();
    setStatusOverride("loading");

    const speed = s.playbackRate === 0.7 ? "slow" as const : "normal" as const;
    const { isCached, cacheStatus } = await fetchCacheStatus(
      s.position!.storySlug, s.position!.level, s.position!.chapter, newMode, speed
    );

    if (isCached) {
      saveLanguageMode(newMode);
      chapterAudio.setLookahead(newMode === "bilingual" ? 0 : 0.15);
      setState(prev => {
        if (prev.position) persistState(prev.position, newMode);
        return { ...prev, mode: newMode };
      });
      chapterAudio.stop();
      setStatusOverride(null);
      chapterAudio.loadAndPlay({
        storySlug: s.position!.storySlug,
        level: s.position!.level,
        chapter: s.position!.chapter,
        mode: getChapterAudioMode(newMode),
        speed,
        seekToPosition: seekPos,
      });
    } else {
      setStatusOverride(null);
      setState(prev => ({
        ...prev,
        pendingPlayback: buildPendingFromPosition(s, cacheStatus, seekPos, wasPlaying),
      }));
    }
  }, [chapterAudio, lng, oppositeLang]);

  const setPlaybackRate = useCallback(async (rate: number) => {
    const s = stateRef.current;

    // If actively playing/paused in chapter mode, check cache before changing rate
    const hookStatus = chapterAudio.state.status;
    const isActive = s.position && s.playbackMode === "chapter" &&
      (hookStatus === "playing" || hookStatus === "paused");

    if (!isActive) {
      // No audio playing — just update the preference
      savePlaybackRate(rate);
      setState(prev => ({ ...prev, playbackRate: rate }));
      return;
    }

    // Immediately pause and show loading state
    const wasPlaying = hookStatus === "playing";
    const seekPos = chapterAudio.getCurrentPosition() ?? undefined;
    chapterAudio.pause();
    setStatusOverride("loading");

    const speed = rate === 0.7 ? "slow" as const : "normal" as const;
    const { isCached, cacheStatus } = await fetchCacheStatus(
      s.position!.storySlug, s.position!.level, s.position!.chapter, s.mode, speed
    );

    if (isCached) {
      savePlaybackRate(rate);
      setState(prev => ({ ...prev, playbackRate: rate }));
      chapterAudio.stop();
      setStatusOverride(null);
      chapterAudio.loadAndPlay({
        storySlug: s.position!.storySlug,
        level: s.position!.level,
        chapter: s.position!.chapter,
        mode: getChapterAudioMode(s.mode),
        speed,
        seekToPosition: seekPos,
      });
    } else {
      setStatusOverride(null);
      setState(prev => ({
        ...prev,
        pendingPlayback: buildPendingFromPosition(s, cacheStatus, seekPos, wasPlaying),
      }));
    }
  }, [chapterAudio, lng, oppositeLang]);

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
      if (!s.position || !s.storyMap) return;
      const { next } = getPrevNextPage(s.position.chapter, s.position.page, s.storyMap);
      if (!next) return;
      const wasPlaying = chapterAudio.state.status === "playing";
      navigatingToPageRef.current = { page: next.pg, shouldResume: wasPlaying };
      chapterAudio.pauseSilently();
      chapterAudio.skipForwardPage();
      setStatusOverride("navigating");
      setState(prev => ({
        ...prev,
        highlightedSentenceIndex: null, highlightedLanguage: null,
        position: prev.position ? { ...prev.position, chapter: next.ch, page: next.pg, sentenceIndex: 0, currentLanguage: "target" } : null,
      }));
      router.push(getNavigationUrl(lng, s.position.storySlug, s.position.level, next.ch, next.pg, s.position.isUserStory, s.position.userStoryId));
      return;
    }
    // Legacy
    if (!s.position || !s.storyMap || s.status === "navigating") return;
    stopTTS();
    const { next } = getPrevNextPage(s.position.chapter, s.position.page, s.storyMap);
    if (!next) return;
    pendingNavigationRef.current = { chapter: next.ch, page: next.pg };
    setState(prev => ({
      ...prev, status: "navigating", highlightedSentenceIndex: null, highlightedLanguage: null,
      position: prev.position ? { ...prev.position, chapter: next.ch, page: next.pg, sentenceIndex: 0, currentLanguage: "target" } : null,
    }));
    router.push(getNavigationUrl(lng, s.position.storySlug, s.position.level, next.ch, next.pg, s.position.isUserStory, s.position.userStoryId));
  }, [stopTTS, lng, router, chapterAudio]);

  const prevPage = useCallback(() => {
    const s = stateRef.current;
    if (s.playbackMode === "chapter") {
      if (!s.position || !s.storyMap) return;
      const { prev: prevPg } = getPrevNextPage(s.position.chapter, s.position.page, s.storyMap);
      if (!prevPg) return;
      const wasPlaying = chapterAudio.state.status === "playing";
      navigatingToPageRef.current = { page: prevPg.pg, shouldResume: wasPlaying };
      chapterAudio.pauseSilently();
      chapterAudio.skipBackPage();
      setStatusOverride("navigating");
      setState(prev => ({
        ...prev,
        highlightedSentenceIndex: null, highlightedLanguage: null,
        position: prev.position ? { ...prev.position, chapter: prevPg.ch, page: prevPg.pg, sentenceIndex: 0, currentLanguage: "target" } : null,
      }));
      router.push(getNavigationUrl(lng, s.position.storySlug, s.position.level, prevPg.ch, prevPg.pg, s.position.isUserStory, s.position.userStoryId));
      return;
    }
    // Legacy
    if (!s.position || !s.storyMap || s.status === "navigating") return;
    stopTTS();
    const { prev: prevPg } = getPrevNextPage(s.position.chapter, s.position.page, s.storyMap);
    if (!prevPg) return;
    pendingNavigationRef.current = { chapter: prevPg.ch, page: prevPg.pg };
    setState(st => ({
      ...st, status: "navigating", highlightedSentenceIndex: null, highlightedLanguage: null,
      position: st.position ? { ...st.position, chapter: prevPg.ch, page: prevPg.pg, sentenceIndex: 0, currentLanguage: "target" } : null,
    }));
    router.push(getNavigationUrl(lng, s.position.storySlug, s.position.level, prevPg.ch, prevPg.pg, s.position.isUserStory, s.position.userStoryId));
  }, [stopTTS, lng, router, chapterAudio]);

  // ---- Content Registration (called by StoryLayoutWithAzureTTS on mount) ----
  const registerPageContent = useCallback((sentences: StoryLine[], chapter: number, page: number, storySlug?: string, level?: string) => {
    const s = stateRef.current;
    setState(prev => ({ ...prev, currentPageSentences: sentences }));

    // Track what's currently rendered
    if (storySlug && level) {
      currentViewRef.current = { storySlug, level, chapter, page };
    }

    // In chapter mode: check if user navigated away from the audio's story/level
    if (s.playbackMode === "chapter" && s.position && storySlug && level) {
      const sameStory = s.position.storySlug === storySlug;
      const sameLevel = s.position.level === level;

      if (!sameStory || !sameLevel) {
        // Different story or different level — stop + close player, save bookmark
        saveAudioBookmark();
        chapterAudio.stop();
        setStatusOverride("idle");
        persistState(null, s.mode);
        setState(prev => ({
          ...prev,
          position: null,
          isVisible: false,
          highlightedSentenceIndex: null, highlightedLanguage: null,
          error: null,
          currentPageSentences: sentences,
          storyMap: null,
          chapterCurrentTime: 0,
          chapterDuration: 0,
          chapterGenerationProgress: null,
        }));
        return;
      }

      const samePage = s.position.chapter === chapter && s.position.page === page;
      const isNavigating = navigatingToPageRef.current !== null;
      if (!samePage && !isNavigating) {
        // Different page/chapter of same story+level — pause, keep player open
        saveAudioBookmark();
        chapterAudio.pause(); // hook sets "paused"
        setStatusOverride(null);
        setState(prev => ({ ...prev, highlightedSentenceIndex: null, highlightedLanguage: null }));
        return;
      }
    }

    // In chapter mode (continued — same page or navigating)
    if (s.playbackMode === "chapter") {
      chapterAudio.resetSentenceTracking();
      const nav = navigatingToPageRef.current;
      if (nav && nav.page === page) {
        navigatingToPageRef.current = null;
        const firstSentence = chapterAudio.metadata?.sentenceTimings.find(t => t.pageNumber === page);

        // Set highlight eagerly via DOM; sync loop will confirm on its first frame.
        if (firstSentence) {
          applyHighlight(firstSentence.lineIndex, firstSentence.language);
        }

        // Delay resume by one frame so the "navigating" spinner paints before clearing.
        requestAnimationFrame(() => {
          if (nav.shouldResume) {
            // Seek to the new page's start — audio.currentTime may have
            // advanced past this point due to decoder pipeline buffering.
            // The seek discards stale buffered audio so playback starts
            // cleanly at the first sentence of the new page.
            if (firstSentence) {
              chapterAudio.seekToTime(firstSentence.startTime);
            }
            setStatusOverride("playing");
            chapterAudio.play();
          } else {
            setStatusOverride(null);
          }
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

  // ---- Derive effective status ----
  // In chapter mode: override (navigating/idle/finished/error) takes priority,
  // otherwise the hook's audio lifecycle status is the source of truth.
  // In legacy mode: provider state.status is used directly.
  const effectiveStatus: AudioPlayerStatus = (() => {
    if (statusOverride) return statusOverride;
    if (state.playbackMode === "chapter") return chapterAudio.state.status as AudioPlayerStatus;
    return state.status;
  })();

  // ---- Clear DOM highlight when not actively playing ----
  useEffect(() => {
    if (effectiveStatus !== "playing") {
      clearHighlight();
    }
  }, [effectiveStatus, clearHighlight]);

  // ---- Auto-hide after finish ----
  useEffect(() => {
    if (effectiveStatus === "finished") {
      const timer = setTimeout(() => {
        setStatusOverride("idle");
        setState(prev => ({ ...prev, isVisible: false, position: null, highlightedSentenceIndex: null, highlightedLanguage: null }));
        persistState(null, state.mode);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [effectiveStatus, state.mode]);

  const value: AudioPlayerContextType = {
    state: { ...state, status: effectiveStatus },
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
    isPlaying: effectiveStatus === "playing",
    setPlaybackRate,
    seekToTime,
    confirmAndPlay,
    dismissPicker,
    registerSentenceElements: (refs: React.MutableRefObject<(HTMLDivElement | null)[]>) => {
      sentenceElementsRef.current = refs;
    },
  };

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  );
}
