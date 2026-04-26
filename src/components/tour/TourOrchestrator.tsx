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
 * Strategy: first content line with ≥4 words; pick the longest word
 * (excluding the first word, which is often a capitalized article or
 * proper noun). Punctuation is stripped when measuring length so words
 * with trailing commas don't get an unfair edge.
 *
 * Long words are unlikely to be articles (la, un, el, the, a) or proper
 * names — they tend to be the kind of vocabulary a learner benefits from
 * seeing translated.
 */
function pickAnchorWord(
  sentences: StoryLine[],
  targetLang: "en" | "es"
): { lineIndex: number; wordIndex: number } | null {
  const stripPunct = (w: string) =>
    w.replace(/[.,!?;:()"“”‘’¿¡«»…—–\-]/g, "");

  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    if (s.isStanzaBreak || s.isStageDirectionOnly) continue;
    const text = (targetLang === "es" ? s.es : s.en) || "";
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    if (words.length < 4) continue;

    let bestIdx = -1;
    let bestLen = -1;
    // Skip index 0 (first word) — often capitalized, an article, or a
    // proper noun like "Los", "The".
    for (let j = 1; j < words.length; j++) {
      const cleanLen = stripPunct(words[j]).length;
      if (cleanLen > bestLen) {
        bestLen = cleanLen;
        bestIdx = j;
      }
    }
    if (bestIdx >= 0) return { lineIndex: i, wordIndex: bestIdx };
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
  const { wordSelections } = useStoryReader();
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
    if (stepFiredRef.current || adaptiveSkipFiredRef.current) return;

    const step = state.nextStep;

    // Step 2 fires immediately on page render — no dwell required.
    // Steps 1 and 3 wait for dwell so the user has settled in before the
    // auto-tap happens.
    if (step !== 2 && !dwellMet) return;

    // Steps 1 and 3 need a content word to anchor on.
    if ((step === 1 || step === 3) && !anchor) return;

    stepFiredRef.current = true;
    setActiveStep(step);
    // Mark complete in DB immediately. The on-screen visuals continue
    // running until the hold timer fires (or component unmounts), but the
    // step shouldn't fire again on subsequent pages — even if the user
    // navigates away mid-animation. Otherwise the step gets stuck firing
    // on every page until the user happens to stay long enough for the
    // hold timer to complete.
    markStepComplete(step);

    if (step === 1 || step === 3) {
      // Synthesize a real click on the anchor word's button. The unified
      // translator's word buttons own their visual selection state via
      // internal hooks; merely updating the context's wordSelections does
      // not trigger the highlight because in prose the unified translator
      // is uncontrolled (externalSelection is undefined). A real click
      // fires the same code path a user tap does.
      if (anchor) {
        const clickAnchor = () => {
          const lineEl = document.querySelector(
            `[data-sentence-index="${anchor.lineIndex}"]`
          );
          const wordEl = lineEl?.querySelector<HTMLElement>(
            `[data-word-index="${anchor.wordIndex}"]`
          );
          if (wordEl) {
            wordEl.click();
            return true;
          }
          return false;
        };

        if (!clickAnchor()) {
          // The DOM may not be ready yet (lazy hydration); poll briefly.
          let polls = 0;
          const interval = window.setInterval(() => {
            polls += 1;
            if (clickAnchor() || polls > 20) window.clearInterval(interval);
          }, 100);
        }
      }

      const dwellMs = TOUR_DURATIONS.emojiRowDwell * 1000;
      const visualTimer = window.setTimeout(() => setActiveStep(null), dwellMs);
      return () => window.clearTimeout(visualTimer);
    }

    if (step === 2) {
      const holdMs = TOUR_DURATIONS.audioGlowHold * 1000;
      const visualTimer = window.setTimeout(() => setActiveStep(null), holdMs);
      return () => window.clearTimeout(visualTimer);
    }
  }, [dwellMet, state, disabled, anchor, markStepComplete]);

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

  // Step 1: emoji row wave → translate icon bounce. Fires after the
  // anchor word is clicked and the row appears.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (activeStep !== 1) return;

    const timers: number[] = [];
    let cleanup = () => {};

    const tryAttach = () => {
      // The emoji row contains the speaker button; find its parent row.
      const speaker = document.querySelector<HTMLElement>(
        "[data-audio-control='speaker']"
      );
      const row = speaker?.parentElement;
      const translateBtn = document.querySelector<HTMLElement>(
        "[data-translation-control='gpt']"
      );
      if (!row || !translateBtn) return false;

      // Phase 1: wave across the row.
      row.setAttribute("data-tour-emoji-wave", "true");

      // Phase 2: after the row-wide bounce finishes (~1.9s = last delay
      // 470ms + 1400ms animation), the translate icon picks up the
      // infinite loop on its own to call attention as the focal feature.
      const waveDurationMs = 1900;
      const t1 = window.setTimeout(() => {
        row.removeAttribute("data-tour-emoji-wave");
        translateBtn.classList.add("tour-icon-bounce");
      }, waveDurationMs);
      timers.push(t1);

      cleanup = () => {
        row.removeAttribute("data-tour-emoji-wave");
        translateBtn.classList.remove("tour-icon-bounce");
      };
      return true;
    };

    // Delay before starting the wave: gives the user a beat to register
    // the word selection and emoji row first.
    let polls = 0;
    const startTimer = window.setTimeout(() => {
      if (!tryAttach()) {
        const interval = window.setInterval(() => {
          polls += 1;
          if (tryAttach() || polls > 30) window.clearInterval(interval);
        }, 100);
        timers.push(interval as unknown as number);
      }
    }, 1000);
    timers.push(startTimer);

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      cleanup();
    };
  }, [activeStep]);

  // Step 3: wave across the row → save icon picks up the infinite bounce.
  // Mirrors step 1 visually but focuses on the save feature instead of
  // the translate feature.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (activeStep !== 3) return;

    const timers: number[] = [];
    let cleanup = () => {};

    const tryAttach = () => {
      const speaker = document.querySelector<HTMLElement>(
        "[data-audio-control='speaker']"
      );
      const row = speaker?.parentElement;
      const saveBtn = document.querySelector<HTMLElement>(
        "[data-translation-control='save']"
      );
      if (!row || !saveBtn) return false;

      // The save button lives inside a wrapper <div> with overflow:hidden;
      // bouncing the wrapper avoids clipping.
      const saveTarget = saveBtn.parentElement ?? saveBtn;

      row.setAttribute("data-tour-emoji-wave", "true");

      const waveDurationMs = 1900;
      const t1 = window.setTimeout(() => {
        row.removeAttribute("data-tour-emoji-wave");
        saveTarget.classList.add("tour-icon-bounce");
      }, waveDurationMs);
      timers.push(t1);

      cleanup = () => {
        row.removeAttribute("data-tour-emoji-wave");
        saveTarget.classList.remove("tour-icon-bounce");
      };
      return true;
    };

    let polls = 0;
    const startTimer = window.setTimeout(() => {
      if (!tryAttach()) {
        const interval = window.setInterval(() => {
          polls += 1;
          if (tryAttach() || polls > 30) window.clearInterval(interval);
        }, 100);
        timers.push(interval as unknown as number);
      }
    }, 1000);
    timers.push(startTimer);

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      cleanup();
    };
  }, [activeStep]);

  return null;
}
