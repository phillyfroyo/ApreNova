// src/hooks/useGlobalClickHandler.ts
"use client";

import { useEffect } from "react";

interface UseGlobalClickHandlerParams {
  menuOpen: boolean;
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAnyDropdownOpen: boolean;
  activeAudio: { isPlaying: boolean } | null;
  setActiveAudio: React.Dispatch<React.SetStateAction<any>>;
  showEmojiButtons: Record<number, boolean>;
  setShowEmojiButtons: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  showStanzaEmojis: Record<number, boolean>;
  setShowStanzaEmojis: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  setActiveStanzaLine: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  activeTranslations: Record<number, boolean>;
  setStanzaAITranslation: React.Dispatch<React.SetStateAction<any>>;
  setSaveAuthLine: React.Dispatch<React.SetStateAction<number | null>>;
  skipGlobalClickRef: React.MutableRefObject<boolean>;
  pause: () => void;
  hasSelectedWords: () => boolean;
  clearAllWordSelections: () => void;
}

export function useGlobalClickHandler({
  menuOpen,
  setMenuOpen,
  isAnyDropdownOpen,
  activeAudio,
  setActiveAudio,
  showEmojiButtons,
  setShowEmojiButtons,
  showStanzaEmojis,
  setShowStanzaEmojis,
  setActiveStanzaLine,
  activeTranslations,
  setStanzaAITranslation,
  setSaveAuthLine,
  skipGlobalClickRef,
  pause,
  hasSelectedWords,
  clearAllWordSelections,
}: UseGlobalClickHandlerParams) {
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      // Skip if a control flagged to suppress this click
      if (skipGlobalClickRef.current) {
        skipGlobalClickRef.current = false;
        return;
      }

      const rawTarget = e.target as Element;
      // Resolve SVG elements to their HTML parent so closest() can traverse the HTML DOM
      const target = (
        rawTarget instanceof SVGElement
          ? rawTarget.closest("svg")?.parentElement ?? rawTarget
          : rawTarget
      ) as HTMLElement;

      if (
        target.tagName === "BUTTON" ||
        target.closest("button") ||
        target.closest('[role="button"]') ||
        target.closest(".dropdown") ||
        target.closest("[data-dropdown]") ||
        target.closest("[data-tooltip]") ||
        target.hasAttribute("data-just-closed-translation")
      ) {
        return;
      }

      // For translator areas, only block clicks if actually clicking on text
      const translatorElement = target.closest("[data-translator]");
      if (translatorElement) {
        if (
          target.nodeType === Node.TEXT_NODE ||
          target.closest("[data-word]") ||
          (target as HTMLElement).hasAttribute("data-word")
        ) {
          return;
        }
      }

      // Ignore all clicks inside the audio player bar
      const audioBar = document.querySelector("[data-audio-player-bar]");
      if (audioBar) {
        const barRect = audioBar.getBoundingClientRect();
        if (
          e.clientX >= barRect.left &&
          e.clientX <= barRect.right &&
          e.clientY >= barRect.top &&
          e.clientY <= barRect.bottom
        ) {
          return;
        }
      }

      if (menuOpen) {
        setMenuOpen(false);
        return;
      }

      if (isAnyDropdownOpen) {
        return;
      }

      const hasActiveTranslations = Object.values(activeTranslations).some(Boolean);
      if (hasActiveTranslations) {
        if (target.closest("[data-tooltip]")) return;
        clearAllWordSelections();
        setShowEmojiButtons({});
        setSaveAuthLine(null);
        return;
      }

      if (activeAudio?.isPlaying) {
        pause();
        setActiveAudio(null);
        setShowEmojiButtons({});
        setShowStanzaEmojis({});
        return;
      }

      const hasAnyEmojiButtons = Object.values(showEmojiButtons).some(Boolean);
      const hasAnyStanzaEmojis = Object.values(showStanzaEmojis).some(Boolean);
      if (activeAudio && !activeAudio.isPlaying && (hasAnyEmojiButtons || hasAnyStanzaEmojis)) {
        setActiveAudio(null);
        setShowEmojiButtons({});
        setShowStanzaEmojis({});
        return;
      }

      if (
        target.hasAttribute("data-audio-control") ||
        target.hasAttribute("data-translation-control") ||
        target.closest("[data-audio-scrubber]") ||
        target.closest("[data-audio-control]") ||
        target.closest("[data-translation-control]")
      ) {
        return;
      }

      // Priority 1: If words are selected, deselect them first (keep emoji row open)
      if (hasSelectedWords()) {
        clearAllWordSelections();
        return;
      }

      // Priority 2: Stanza-level detection for poems, or per-line for prose
      const clickY = e.clientY;
      const isPoemWithStanzas = !!document.querySelector("[data-stanza-number]");

      if (isPoemWithStanzas) {
        const allStanzas = document.querySelectorAll("[data-stanza-number]");
        for (const stanzaEl of Array.from(allStanzas)) {
          const rect = stanzaEl.getBoundingClientRect();
          if (clickY >= rect.top && clickY < rect.bottom) {
            const stanzaIdx = parseInt(stanzaEl.getAttribute("data-stanza-number") || "0") - 1;
            const isAlreadyOpen = showStanzaEmojis[stanzaIdx];

            const textEls = stanzaEl.querySelectorAll("[data-text-content]");
            let clickedOnTextLine = false;
            for (const textEl of Array.from(textEls)) {
              const textRect = textEl.getBoundingClientRect();
              if (clickY >= textRect.top && clickY < textRect.bottom) {
                clickedOnTextLine = true;
                const lineIndex = parseInt(textEl.getAttribute("data-text-content") || "-1");
                if (lineIndex >= 0) {
                  setActiveStanzaLine((prev) => ({ ...prev, [stanzaIdx]: lineIndex }));
                }
                break;
              }
            }

            if (clickedOnTextLine) {
              if (!isAlreadyOpen) {
                setShowStanzaEmojis({ [stanzaIdx]: true });
              }
            } else {
              if (isAlreadyOpen) {
                setShowStanzaEmojis({});
                setStanzaAITranslation({});
              }
            }
            return;
          }
        }
        // Click was outside all stanzas
        setShowStanzaEmojis({});
        setStanzaAITranslation({});
        return;
      }

      // Per-line detection for prose/scripts
      const allTextContents = document.querySelectorAll("[data-text-content]");

      const lineBounds = Array.from(allTextContents).map((el) => {
        const rect = (el as HTMLElement).getBoundingClientRect();
        const index = parseInt(el.getAttribute("data-text-content") || "-1");
        return { element: el as HTMLElement, top: rect.top, bottom: rect.bottom, index };
      });

      let clickedOnTextLine = false;
      let clickedLineIndex = -1;

      for (const line of lineBounds) {
        if (clickY >= line.top && clickY < line.bottom) {
          clickedOnTextLine = true;
          clickedLineIndex = line.index;
          break;
        }
      }

      if (clickedOnTextLine && clickedLineIndex >= 0) {
        const isAlreadyOpen = showEmojiButtons[clickedLineIndex];
        if (!isAlreadyOpen) {
          setShowEmojiButtons({ [clickedLineIndex]: true });
        }
      } else {
        const hasAnyOpen = Object.values(showEmojiButtons).some(Boolean);
        if (hasAnyOpen) {
          setShowEmojiButtons({});
        }
      }
    };

    document.addEventListener("click", handleGlobalClick);
    return () => document.removeEventListener("click", handleGlobalClick);
  }, [
    menuOpen,
    isAnyDropdownOpen,
    activeAudio,
    showEmojiButtons,
    showStanzaEmojis,
    activeTranslations,
    pause,
    hasSelectedWords,
    clearAllWordSelections,
  ]);
}
