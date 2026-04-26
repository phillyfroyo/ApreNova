"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStoryReader } from "@/contexts/StoryReaderContext";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import type { StoryLine } from "@/lib/story-processing/text-processing";
import { useTourState } from "./TourProvider";
import { useDwellTimer } from "./useDwellTimer";
import { TOUR_DURATIONS, TOUR_TIMING } from "./animations";

interface TourOrchestratorProps {
  sentences: StoryLine[];
  storySlug: string;
  chapterNumber: number;
  pageNumber: number;
  /** The language whose words are interactive (target language). */
  targetLang: "en" | "es";
}

/**
 * Picks the line + word to anchor steps 1 and 3.
 * Strategy: first content line with ≥4 words; the 3rd word in that line.
 */
function pickAnchorWord(
  sentences: StoryLine[],
  targetLang: "en" | "es"
): { lineIndex: number; wordIndex: number } | null {
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    if (s.isStanzaBreak || s.isStageDirectionOnly) continue;
    const text = (targetLang === "es" ? s.es : s.en) || "";
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    if (words.length >= 4) {
      return { lineIndex: i, wordIndex: 2 };
    }
  }
  return null;
}

export default function TourOrchestrator({
  sentences,
  storySlug,
  chapterNumber,
  pageNumber,
  targetLang,
}: TourOrchestratorProps) {
  const { state, disabled, markStepComplete } = useTourState();
  const { setWordSelections, setShowEmojiButtons, wordSelections } =
    useStoryReader();
  const audioPlayer = useAudioPlayer();

  const pageKey = `${storySlug}/${chapterNumber}/${pageNumber}`;
  const dwellMet = useDwellTimer(TOUR_TIMING.dwellThresholdMs, pageKey);

  const anchor = useMemo(
    () => pickAnchorWord(sentences, targetLang),
    [sentences, targetLang]
  );

  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | null>(null);
  const adaptiveSkipFiredRef = useRef(false);
  const stepFiredRef = useRef(false);

  // Adaptive skip — steps 1 & 3: organic word selection ends the tour step.
  useEffect(() => {
    if (disabled || !state || !state.nextStep) return;
    if (stepFiredRef.current || adaptiveSkipFiredRef.current) return;
    if (state.nextStep !== 1 && state.nextStep !== 3) return;

    const hasOrganicSelection = Object.values(wordSelections).some(
      (sel) => sel != null
    );
    if (hasOrganicSelection) {
      adaptiveSkipFiredRef.current = true;
      markStepComplete(state.nextStep);
    }
  }, [wordSelections, state, disabled, markStepComplete]);

  // Adaptive skip — step 2: organic audio playback ends the tour step.
  useEffect(() => {
    if (disabled || !state || state.nextStep !== 2) return;
    if (stepFiredRef.current || adaptiveSkipFiredRef.current) return;

    if (audioPlayer.isPlaying) {
      adaptiveSkipFiredRef.current = true;
      markStepComplete(2);
    }
  }, [audioPlayer.isPlaying, state, disabled, markStepComplete]);

  // Trigger logic
  useEffect(() => {
    if (disabled) return;
    if (!state || !state.nextStep) return;
    if (!dwellMet) return;
    if (stepFiredRef.current || adaptiveSkipFiredRef.current) return;

    const step = state.nextStep;

    // Steps 1 and 3 need a content word to anchor on.
    if ((step === 1 || step === 3) && !anchor) return;

    stepFiredRef.current = true;
    setActiveStep(step);

    if (step === 1 || step === 3) {
      const glowDelayMs =
        (TOUR_DURATIONS.wordGlowFadeIn + TOUR_DURATIONS.wordGlowPulseHold) *
        1000;

      const glowTimer = window.setTimeout(() => {
        if (!anchor) return;
        setWordSelections((prev) => ({
          ...prev,
          [anchor.lineIndex]: {
            start: anchor.wordIndex,
            end: anchor.wordIndex,
          },
        }));
        setShowEmojiButtons((prev) => ({
          ...prev,
          [anchor.lineIndex]: true,
        }));
      }, glowDelayMs);

      const dwellMs = TOUR_DURATIONS.emojiRowDwell * 1000;
      const completeTimer = window.setTimeout(() => {
        markStepComplete(step);
        setActiveStep(null);
      }, glowDelayMs + dwellMs);

      return () => {
        window.clearTimeout(glowTimer);
        window.clearTimeout(completeTimer);
      };
    }

    if (step === 2) {
      // Glow the listen button, then mark complete. No auto-activation —
      // sudden audio playback would break user trust irreversibly.
      const holdMs = TOUR_DURATIONS.audioGlowHold * 1000;
      const completeTimer = window.setTimeout(() => {
        markStepComplete(2);
        setActiveStep(null);
      }, holdMs);
      return () => window.clearTimeout(completeTimer);
    }
  }, [
    dwellMet,
    state,
    disabled,
    anchor,
    setWordSelections,
    setShowEmojiButtons,
    markStepComplete,
  ]);

  // Apply the step 1/3 word glow class.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!activeStep || activeStep === 2 || !anchor) return;

    const lineEl = document.querySelector(
      `[data-sentence-index="${anchor.lineIndex}"]`
    );
    const wordEl = lineEl?.querySelector(
      `[data-word-index="${anchor.wordIndex}"]`
    );
    if (!wordEl) return;

    wordEl.classList.add("tour-word-glow");
    return () => {
      wordEl.classList.remove("tour-word-glow");
    };
  }, [activeStep, anchor]);

  // Step 2: glow the listen button while step 2 is active.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (activeStep !== 2) return;

    let cleanup = () => {};
    let polls = 0;

    const tryAttach = () => {
      const btn = document.querySelector<HTMLElement>(
        "[data-tour-listen-button='true']"
      );
      if (!btn) return false;
      btn.classList.add("tour-audio-glow");
      cleanup = () => btn.classList.remove("tour-audio-glow");
      return true;
    };

    if (!tryAttach()) {
      const interval = window.setInterval(() => {
        polls += 1;
        if (tryAttach() || polls > 20) window.clearInterval(interval);
      }, 200);
      const timeout = window.setTimeout(
        () => window.clearInterval(interval),
        5000
      );
      return () => {
        window.clearInterval(interval);
        window.clearTimeout(timeout);
        cleanup();
      };
    }

    return () => cleanup();
  }, [activeStep]);

  // Step 3: highlight the save emoji within the action row, ~600ms after the
  // row appears (which is `glowDelayMs` after the step starts).
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (activeStep !== 3) return;

    const glowDelayMs =
      (TOUR_DURATIONS.wordGlowFadeIn + TOUR_DURATIONS.wordGlowPulseHold) * 1000;
    const saveDelayMs = glowDelayMs + 600;

    let cleanup = () => {};
    const startTimer = window.setTimeout(() => {
      const saveBtn = document.querySelector<HTMLElement>(
        "[data-translation-control='save']"
      );
      if (!saveBtn) return;
      saveBtn.classList.add("tour-save-pulse");
      cleanup = () => saveBtn.classList.remove("tour-save-pulse");
    }, saveDelayMs);

    return () => {
      window.clearTimeout(startTimer);
      cleanup();
    };
  }, [activeStep]);

  return null;
}
