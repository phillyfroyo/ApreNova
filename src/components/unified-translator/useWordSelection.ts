// src/components/unified-translator/useWordSelection.ts
"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";

interface UseWordSelectionOptions {
  words: string[];
  enabled: boolean;
  externalSelection?: { start: number; end: number } | null;
  onWordClick?: (wordIndex: number) => void;
  parentHasSelection?: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  tooltipRef: React.RefObject<HTMLDivElement | null>;
  onSelectionCleared: () => void;
}

export function useWordSelection({
  words, enabled, externalSelection, onWordClick, parentHasSelection,
  containerRef, tooltipRef, onSelectionCleared,
}: UseWordSelectionOptions) {
  const [internalStartIdx, setInternalStartIdx] = useState<number | null>(null);
  const [internalEndIdx, setInternalEndIdx] = useState<number | null>(null);

  // Use external selection if provided, otherwise use internal state
  const startIdx = externalSelection !== undefined ? externalSelection?.start ?? null : internalStartIdx;
  const endIdx = externalSelection !== undefined ? externalSelection?.end ?? null : internalEndIdx;

  // Clear internal selection when parent signals deselection
  const prevParentHasSelection = useRef(parentHasSelection);
  useLayoutEffect(() => {
    if (prevParentHasSelection.current && !parentHasSelection) {
      setInternalStartIdx(null);
      setInternalEndIdx(null);
    }
    prevParentHasSelection.current = parentHasSelection;
  }, [parentHasSelection]);

  // Outside click handler
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const htmlTarget = target instanceof SVGElement ? target.closest('svg')?.parentElement ?? target : target;
      if (
        htmlTarget.hasAttribute('data-audio-control') ||
        htmlTarget.hasAttribute('data-translation-control') ||
        htmlTarget.closest('[data-audio-scrubber]') ||
        htmlTarget.closest('[data-audio-control]') ||
        htmlTarget.closest('[data-translation-control]') ||
        htmlTarget.closest('button')
      ) {
        return;
      }

      const audioBar = document.querySelector('[data-audio-player-bar]');
      if (audioBar) {
        const barRect = audioBar.getBoundingClientRect();
        if (e.clientX >= barRect.left && e.clientX <= barRect.right &&
            e.clientY >= barRect.top && e.clientY <= barRect.bottom) {
          return;
        }
      }

      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node)
      ) {
        target.setAttribute('data-just-closed-translation', 'true');
        setTimeout(() => target.removeAttribute('data-just-closed-translation'), 10);

        setInternalStartIdx(null);
        setInternalEndIdx(null);
        onSelectionCleared();
      }
    };

    document.addEventListener("mousedown", handleOutsideClick, true);
    return () => document.removeEventListener("mousedown", handleOutsideClick, true);
  }, [containerRef, tooltipRef, onSelectionCleared]);

  const handleClick = useCallback((index: number) => {
    if (!enabled) return;

    onWordClick?.(index);

    if (externalSelection !== undefined) return;

    onSelectionCleared();

    if (startIdx === null && endIdx === null) {
      setInternalStartIdx(index);
      setInternalEndIdx(index);
      return;
    }

    if (startIdx === index && endIdx === index) {
      setInternalStartIdx(null);
      setInternalEndIdx(null);
      return;
    }

    if (startIdx !== null && endIdx !== null) {
      if (index < startIdx || index > endIdx) {
        setInternalStartIdx(Math.min(startIdx, index));
        setInternalEndIdx(Math.max(endIdx, index));
      } else if (index > startIdx && index < endIdx) {
        setInternalEndIdx(index);
      } else if (index === startIdx && startIdx !== endIdx) {
        setInternalStartIdx(startIdx + 1);
      } else {
        setInternalStartIdx(null);
        setInternalEndIdx(null);
      }
      return;
    }

    const s = Math.min(startIdx!, endIdx!, index);
    const e = Math.max(startIdx!, endIdx!, index);
    setInternalStartIdx(s);
    setInternalEndIdx(e);
  }, [enabled, externalSelection, onWordClick, startIdx, endIdx, onSelectionCleared]);

  const isSelected = useCallback((i: number) => {
    if (parentHasSelection === false) return false;
    if (startIdx === null || endIdx === null) return false;
    return i >= startIdx && i <= endIdx;
  }, [parentHasSelection, startIdx, endIdx]);

  const setSelection = useCallback((start: number | null, end: number | null) => {
    setInternalStartIdx(start);
    setInternalEndIdx(end);
  }, []);

  return {
    startIdx, endIdx, handleClick, isSelected, setSelection,
  };
}
