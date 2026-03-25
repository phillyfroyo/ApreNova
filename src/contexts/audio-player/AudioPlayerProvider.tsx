// src/contexts/audio-player/AudioPlayerProvider.tsx
"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAzureTTS } from "@/hooks/useAzureTTS";
import { getPrevNextPage, getNavigationUrl } from "@/utils/storyNavigation";
import type { Language } from "@/types/i18n";
import type { StoryLine } from "@/lib/story-processing/text-processing";
import type { TTSLanguage } from "@/types/azure-tts";
import type { AudioPlayerState, AudioPlayerContextType, StartPlaybackOptions, AudioPlayerPosition } from "./types";
import { DEFAULT_VOICES, DEFAULT_PLAYBACK_RATE } from "./types";
import { loadVoiceSelection, loadPlaybackRate, saveVoiceSelection, savePlaybackRate, persistState } from "./storage";
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

  // The continuous playback TTS instance (separate from per-sentence)
  const {
    playTTS,
    generateTTS,
    stop: stopTTS,
    pause: pauseTTS,
    resume: resumeTTS,
    playbackState: ttsPlaybackState,
  } = useAzureTTS({
    autoCache: true,
    onPlaybackComplete: () => {
      handleSentenceComplete();
    },
    onError: (error) => {
      // Don't log auth errors — expected for unauthenticated users
      if (!error.message.includes("sign in")) {
        console.error("[AudioPlayer] TTS error:", error);
      }
      setState(prev => ({
        ...prev,
        status: "error",
        error: error.message,
      }));
    },
  });

  const [state, setState] = useState<AudioPlayerState>({
    status: "idle",
    position: null,
    mode: "target-only",
    currentPageSentences: [],
    storyMap: null,
    isVisible: false,
    highlightedSentenceIndex: null,
    error: null,
    voiceSelection: DEFAULT_VOICES,
    playbackRate: DEFAULT_PLAYBACK_RATE,
  });

  // Load settings from localStorage on mount
  useEffect(() => {
    setState(prev => ({
      ...prev,
      voiceSelection: loadVoiceSelection(),
      playbackRate: loadPlaybackRate(),
    }));
  }, []);

  // Refs for stable access in callbacks
  const stateRef = useRef(state);
  stateRef.current = state;

  const pendingNavigationRef = useRef<{ chapter: number; page: number } | null>(null);

  // ---- TTS Language helper ----
  const getTTSLanguage = useCallback((langKey: "target" | "native"): TTSLanguage => {
    if (langKey === "target") {
      return oppositeLang === "es" ? "es-ES" : "en-US";
    }
    return lng === "es" ? "es-ES" : "en-US";
  }, [lng, oppositeLang]);

  // ---- Play a specific sentence ----
  const playSentence = useCallback((
    sentences: StoryLine[],
    sentenceIndex: number,
    language: "target" | "native"
  ) => {
    const contentSentences = getContentSentences(sentences);
    const entry = contentSentences.find(e => e.originalIndex === sentenceIndex);

    if (!entry) {
      handleSentenceComplete();
      return;
    }

    const text = language === "target"
      ? (entry.line[oppositeLang] || "").trim()
      : (entry.line[lng] || "").trim();

    if (!text) {
      handleSentenceComplete();
      return;
    }

    const ttsLang = getTTSLanguage(language);
    const s = stateRef.current;
    const selectedVoice = s.voiceSelection[ttsLang];

    setState(prev => ({
      ...prev,
      status: "playing",
      highlightedSentenceIndex: sentenceIndex,
      position: prev.position ? {
        ...prev.position,
        sentenceIndex,
        currentLanguage: language,
      } : null,
    }));

    // Native language always plays at normal speed, only target language uses slow rate
    const effectiveRate = language === "native" ? undefined
      : s.playbackRate !== 1.0 ? s.playbackRate : undefined;

    playTTS({
      text,
      language: ttsLang,
      speed: "normal",
      voice: selectedVoice,
      rate: effectiveRate,
      storySlug: s.position?.storySlug,
    });
  }, [oppositeLang, lng, getTTSLanguage, playTTS]);

  // ---- Sentence complete handler (the core chaining logic) ----
  const handleSentenceComplete = useCallback(() => {
    const s = stateRef.current;
    if (!s.position || s.status === "idle" || s.status === "finished" || s.status === "paused") return;

    const { position, mode, currentPageSentences, storyMap } = s;
    const contentSentences = getContentSentences(currentPageSentences);

    // 1. Bilingual: if just finished target, play native
    if (mode === "bilingual" && position.currentLanguage === "target") {
      setTimeout(() => {
        playSentence(currentPageSentences, position.sentenceIndex, "native");
      }, 300);
      return;
    }

    // 2. Find next content sentence
    const currentContentIdx = contentSentences.findIndex(e => e.originalIndex === position.sentenceIndex);
    const nextContentIdx = currentContentIdx + 1;

    if (nextContentIdx < contentSentences.length) {
      const nextOriginalIdx = contentSentences[nextContentIdx].originalIndex;
      playSentence(currentPageSentences, nextOriginalIdx, "target");
      return;
    }

    // 3. Compute next page
    if (!storyMap) {
      setState(prev => ({ ...prev, status: "finished", highlightedSentenceIndex: null }));
      return;
    }

    const { next } = getPrevNextPage(position.chapter, position.page, storyMap);

    if (!next) {
      setState(prev => ({
        ...prev,
        status: "finished",
        highlightedSentenceIndex: null,
      }));
      return;
    }

    // 4. Navigate to next page
    pendingNavigationRef.current = { chapter: next.ch, page: next.pg };

    setState(prev => ({
      ...prev,
      status: "navigating",
      highlightedSentenceIndex: null,
      position: prev.position ? {
        ...prev.position,
        chapter: next.ch,
        page: next.pg,
        sentenceIndex: 0,
        currentLanguage: "target",
      } : null,
    }));

    const url = getNavigationUrl(
      lng,
      position.storySlug,
      position.level,
      next.ch,
      next.pg,
      position.isUserStory,
      position.userStoryId
    );
    router.push(url);
  }, [playSentence, lng, router]);

  // ---- Public Actions ----

  const startContinuousPlayback = useCallback((options: StartPlaybackOptions) => {
    stopTTS();

    const position: AudioPlayerPosition = {
      storySlug: options.storySlug,
      storyTitle: options.storyTitle,
      level: options.level,
      chapter: options.chapter,
      page: options.page,
      sentenceIndex: options.sentenceIndex ?? 0,
      currentLanguage: "target",
      isUserStory: options.isUserStory,
      userStoryId: options.userStoryId,
    };

    setState(prev => ({
      ...prev,
      status: "loading",
      position,
      storyMap: options.storyMap,
      currentPageSentences: options.sentences,
      isVisible: true,
      error: null,
      highlightedSentenceIndex: null,
    }));

    const contentSentences = getContentSentences(options.sentences);
    const startEntry = contentSentences.find(e => e.originalIndex >= (options.sentenceIndex ?? 0));

    if (!startEntry) {
      setState(prev => ({ ...prev, status: "finished" }));
      return;
    }

    persistState(position, stateRef.current.mode);

    setTimeout(() => {
      playSentence(options.sentences, startEntry.originalIndex, "target");
    }, 100);

    // Media Session API
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: options.storyTitle,
        artist: "Cuentana",
      });
      navigator.mediaSession.setActionHandler("play", () => resumePlayback());
      navigator.mediaSession.setActionHandler("pause", () => pausePlayback());
    }
  }, [stopTTS, playSentence]);

  const pausePlayback = useCallback(() => {
    pauseTTS();
    setState(prev => ({ ...prev, status: "paused" }));
  }, [pauseTTS]);

  const resumePlayback = useCallback(() => {
    const s = stateRef.current;
    if (s.status === "paused" && s.position) {
      resumeTTS();
      setState(prev => ({ ...prev, status: "playing" }));
    }
  }, [resumeTTS]);

  const stopPlayback = useCallback(() => {
    stopTTS();
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
    }));
  }, [stopTTS]);

  const toggleMode = useCallback(() => {
    setState(prev => {
      const newMode = prev.mode === "target-only" ? "bilingual" : "target-only";
      if (prev.position) {
        persistState(prev.position, newMode);
      }
      return { ...prev, mode: newMode };
    });
  }, []);

  const setVoice = useCallback((language: 'en-US' | 'es-ES', voiceId: string) => {
    setState(prev => {
      const newVoiceSelection = { ...prev.voiceSelection, [language]: voiceId };
      saveVoiceSelection(newVoiceSelection);
      return { ...prev, voiceSelection: newVoiceSelection };
    });
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    savePlaybackRate(rate);
    setState(prev => ({ ...prev, playbackRate: rate }));
  }, []);

  // ---- Skip / Page Navigation ----

  const skipForward = useCallback(() => {
    const s = stateRef.current;
    if (!s.position || s.status === "navigating") return;
    stopTTS();

    const contentSentences = getContentSentences(s.currentPageSentences);
    const currentContentIdx = contentSentences.findIndex(e => e.originalIndex === s.position!.sentenceIndex);
    const nextContentIdx = currentContentIdx + 1;

    if (nextContentIdx < contentSentences.length) {
      playSentence(s.currentPageSentences, contentSentences[nextContentIdx].originalIndex, "target");
    } else {
      handleSentenceComplete();
    }
  }, [stopTTS, playSentence, handleSentenceComplete]);

  const skipBack = useCallback(() => {
    const s = stateRef.current;
    if (!s.position || s.status === "navigating") return;
    stopTTS();

    const contentSentences = getContentSentences(s.currentPageSentences);
    const currentContentIdx = contentSentences.findIndex(e => e.originalIndex === s.position!.sentenceIndex);
    const prevContentIdx = currentContentIdx - 1;

    if (prevContentIdx >= 0) {
      playSentence(s.currentPageSentences, contentSentences[prevContentIdx].originalIndex, "target");
    } else {
      if (contentSentences.length > 0) {
        playSentence(s.currentPageSentences, contentSentences[0].originalIndex, "target");
      }
    }
  }, [stopTTS, playSentence]);

  const nextPage = useCallback(() => {
    const s = stateRef.current;
    if (!s.position || !s.storyMap || s.status === "navigating") return;
    stopTTS();

    const { next } = getPrevNextPage(s.position.chapter, s.position.page, s.storyMap);
    if (!next) return;

    pendingNavigationRef.current = { chapter: next.ch, page: next.pg };
    setState(prev => ({
      ...prev,
      status: "navigating",
      highlightedSentenceIndex: null,
      position: prev.position ? {
        ...prev.position,
        chapter: next.ch,
        page: next.pg,
        sentenceIndex: 0,
        currentLanguage: "target",
      } : null,
    }));

    const url = getNavigationUrl(
      lng, s.position.storySlug, s.position.level,
      next.ch, next.pg, s.position.isUserStory, s.position.userStoryId
    );
    router.push(url);
  }, [stopTTS, lng, router]);

  const prevPage = useCallback(() => {
    const s = stateRef.current;
    if (!s.position || !s.storyMap || s.status === "navigating") return;
    stopTTS();

    const { prev: prevPg } = getPrevNextPage(s.position.chapter, s.position.page, s.storyMap);
    if (!prevPg) return;

    pendingNavigationRef.current = { chapter: prevPg.ch, page: prevPg.pg };
    setState(st => ({
      ...st,
      status: "navigating",
      highlightedSentenceIndex: null,
      position: st.position ? {
        ...st.position,
        chapter: prevPg.ch,
        page: prevPg.pg,
        sentenceIndex: 0,
        currentLanguage: "target",
      } : null,
    }));

    const url = getNavigationUrl(
      lng, s.position.storySlug, s.position.level,
      prevPg.ch, prevPg.pg, s.position.isUserStory, s.position.userStoryId
    );
    router.push(url);
  }, [stopTTS, lng, router]);

  // ---- Content Registration (called by StoryLayoutWithAzureTTS on mount) ----
  const registerPageContent = useCallback((
    sentences: StoryLine[],
    chapter: number,
    page: number
  ) => {
    const s = stateRef.current;

    setState(prev => ({
      ...prev,
      currentPageSentences: sentences,
    }));

    if (s.status === "navigating" && pendingNavigationRef.current) {
      const pending = pendingNavigationRef.current;
      if (pending.chapter === chapter && pending.page === page) {
        pendingNavigationRef.current = null;

        const contentSentences = getContentSentences(sentences);
        if (contentSentences.length === 0) {
          handleSentenceComplete();
          return;
        }

        const firstIndex = contentSentences[0].originalIndex;

        setState(prev => ({
          ...prev,
          currentPageSentences: sentences,
          position: prev.position ? {
            ...prev.position,
            chapter,
            page,
            sentenceIndex: firstIndex,
            currentLanguage: "target",
          } : null,
        }));

        setTimeout(() => {
          playSentence(sentences, firstIndex, "target");
        }, 500);
      }
    }
  }, [playSentence, handleSentenceComplete]);

  // ---- Auto-hide after finish ----
  useEffect(() => {
    if (state.status === "finished") {
      const timer = setTimeout(() => {
        setState(prev => ({
          ...prev,
          isVisible: false,
          status: "idle",
          position: null,
          highlightedSentenceIndex: null,
        }));
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
    setVoice,
    setPlaybackRate,
  };

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  );
}
