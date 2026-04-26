"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStoryReader } from "@/contexts/StoryReaderContext";
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
 * Picks the line + word to anchor the tour reveal.
 * Strategy: first content line with ≥4 words; the 3rd word in that line.
 * Returns null if no suitable line exists on this page.
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

  const pageKey = `${storySlug}/${chapterNumber}/${pageNumber}`;
  const dwellMet = useDwellTimer(TOUR_TIMING.dwellThresholdMs, pageKey);

  const anchor = useMemo(
    () => pickAnchorWord(sentences, targetLang),
    [sentences, targetLang]
  );

  // The step we're firing on this page visit (locked at trigger time).
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | null>(null);
  // Whether the user organically interacted before we fired (adaptive skip).
  const adaptiveSkipFiredRef = useRef(false);
  const stepFiredRef = useRef(false);

  // Adaptive skip: if user clicks any word before we trigger, mark current
  // step complete silently and don't fire.
  useEffect(() => {
    if (disabled || !state || !state.nextStep) return;
    if (stepFiredRef.current || adaptiveSkipFiredRef.current) return;

    const hasOrganicSelection = Object.values(wordSelections).some(
      (sel) => sel != null
    );
    if (hasOrganicSelection) {
      adaptiveSkipFiredRef.current = true;
      markStepComplete(state.nextStep);
    }
  }, [wordSelections, state, disabled, markStepComplete]);

  // Trigger logic: dwell met + step pending + not yet fired + anchor exists
  useEffect(() => {
    if (disabled) return;
    if (!state || !state.nextStep) return;
    if (!dwellMet) return;
    if (stepFiredRef.current || adaptiveSkipFiredRef.current) return;

    const step = state.nextStep;

    if ((step === 1 || step === 3) && !anchor) return;
    if (step === 2) return;

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
  }, [
    dwellMet,
    state,
    disabled,
    anchor,
    setWordSelections,
    setShowEmojiButtons,
    markStepComplete,
  ]);

  // Apply the glow class directly to the anchor word's DOM node while the step is active.
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

  // Step 1 word glow — applied via data attribute targeting in a global style block.
  // This component renders nothing visible itself; effects work via the body data attributes.
  return null;
}
