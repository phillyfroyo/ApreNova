// src/hooks/useStoryAudioPlayback.ts
"use client";

import { useCallback, useEffect } from "react";
import type { StoryLine } from "@/lib/story-processing/text-processing";
import type { ActiveAudio } from "@/contexts/StoryReaderContext";
import type { Language } from "@/types/i18n";

interface UseStoryAudioPlaybackParams {
  sentences: StoryLine[];
  typedLang: Language;
  storySlug: string;
  currentChapter: string;
  currentPage: string;
  wordSelections: Record<number, { start: number; end: number } | null>;
  activeAudio: ActiveAudio | null;
  setActiveAudio: React.Dispatch<React.SetStateAction<ActiveAudio | null>>;
  setTtsError: React.Dispatch<React.SetStateAction<string | null>>;
  setLineWidths: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  isDragging: boolean;
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
  progressBarRef: React.RefObject<HTMLDivElement | null>;
  textRefs: React.MutableRefObject<(HTMLSpanElement | null)[]>;
  // TTS methods
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seekTo: (time: number) => void;
  createRequest: any;
  playTTSSegment: any;
  // Audio player (continuous playback)
  audioPlayer: any;
}

export function useStoryAudioPlayback({
  sentences,
  typedLang,
  storySlug,
  currentChapter,
  currentPage,
  wordSelections,
  activeAudio,
  setActiveAudio,
  setTtsError,
  setLineWidths,
  isDragging,
  setIsDragging,
  progressBarRef,
  textRefs,
  pause,
  resume,
  stop,
  seekTo,
  createRequest,
  playTTSSegment,
  audioPlayer,
}: UseStoryAudioPlaybackParams) {
  // --- handlePlay ---
  const handlePlay = useCallback(
    async (index: number, isSlow: boolean, text: string, skipWordSelection: boolean = false) => {
      setTtsError(null);

      // Mutual exclusion: stop continuous playback when per-sentence audio is triggered
      if (audioPlayer.isPlaying || audioPlayer.state.status === "paused") {
        audioPlayer.stopPlayback();
      }

      // If clicking the same line and mode, toggle play/pause
      if (activeAudio && activeAudio.index === index && activeAudio.isSlow === isSlow) {
        if (activeAudio.isPlaying) {
          pause();
        } else {
          resume();
        }
        return;
      }

      // Stop any current playback
      if (activeAudio) {
        stop();
        setActiveAudio(null);
      }

      // Set loading state
      setActiveAudio({
        index,
        isPlaying: false,
        isSlow,
        progress: 0,
        duration: 0,
        currentWordIndex: -1,
      });

      try {
        const sentenceData = sentences[index];
        const isSpanishText = typedLang === "en";
        const language = isSpanishText ? "es-ES" : "en-US";
        const speed = isSlow ? "slow" : "normal";

        const stageDirectionForTTS = isSpanishText
          ? sentenceData.stageDirectionEs || sentenceData.stageDirection
          : sentenceData.stageDirectionEn || sentenceData.stageDirection;

        const request = createRequest(
          text,
          language,
          speed,
          storySlug,
          `${currentChapter}-${currentPage}-line${index + 1}`,
          sentenceData.speaker,
          stageDirectionForTTS,
        );

        const wordSelection = skipWordSelection ? undefined : wordSelections[index];
        await playTTSSegment(request, wordSelection || undefined);

        const width = textRefs.current[index]?.offsetWidth || 0;
        setLineWidths((prev) => ({ ...prev, [index]: width }));
      } catch (error) {
        console.error("TTS playback failed:", error);
        setActiveAudio(null);
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = typedLang === "es" ? "es-ES" : "en-US";
        utterance.rate = isSlow ? 0.7 : 1.0;
        speechSynthesis.cancel();
        speechSynthesis.speak(utterance);
      }
    },
    [
      activeAudio,
      audioPlayer,
      sentences,
      typedLang,
      storySlug,
      currentChapter,
      currentPage,
      wordSelections,
      pause,
      resume,
      stop,
      createRequest,
      playTTSSegment,
      textRefs,
    ],
  );

  // --- handleSeek ---
  const handleSeek = useCallback(
    (newTime: number) => {
      seekTo(newTime);
      if (activeAudio) {
        setActiveAudio((prev) => (prev ? { ...prev, progress: newTime } : null));
      }
    },
    [seekTo, activeAudio],
  );

  // --- handleDrag ---
  const handleDrag = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!progressBarRef.current || !activeAudio?.duration) return;

      const rect = progressBarRef.current.getBoundingClientRect();
      let clientX: number;

      if ("touches" in e) {
        clientX = e.touches[0].clientX;
      } else {
        clientX = e.clientX;
      }

      const offsetX = Math.min(Math.max(clientX - rect.left, 0), rect.width);
      const newTime = (offsetX / rect.width) * activeAudio.duration;
      handleSeek(newTime);
    },
    [activeAudio, handleSeek],
  );

  // --- Global drag listeners ---
  const handleGlobalMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      handleDrag(e);
    },
    [isDragging, handleDrag],
  );

  const handleGlobalUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleGlobalMove);
    window.addEventListener("touchmove", handleGlobalMove, { passive: false });
    window.addEventListener("mouseup", handleGlobalUp);
    window.addEventListener("touchend", handleGlobalUp);

    return () => {
      window.removeEventListener("mousemove", handleGlobalMove);
      window.removeEventListener("touchmove", handleGlobalMove);
      window.removeEventListener("mouseup", handleGlobalUp);
      window.removeEventListener("touchend", handleGlobalUp);
    };
  }, [handleGlobalMove, handleGlobalUp]);

  return {
    handlePlay,
    handleSeek,
    handleDrag,
  };
}
