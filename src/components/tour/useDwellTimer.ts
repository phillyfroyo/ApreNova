"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Returns true after the user has been on the page for at least `thresholdMs`,
 * OR has scrolled before that threshold elapsed. Treats either signal as
 * "this is a real read, not a fast-flip-through."
 *
 * Resets when the keyed dependency changes (e.g. story page slug).
 */
export function useDwellTimer(thresholdMs: number, key: string): boolean {
  const [met, setMet] = useState(false);
  const scrollFiredRef = useRef(false);

  useEffect(() => {
    setMet(false);
    scrollFiredRef.current = false;

    const timeout = window.setTimeout(() => {
      setMet(true);
    }, thresholdMs);

    const onScroll = () => {
      if (scrollFiredRef.current) return;
      scrollFiredRef.current = true;
      setMet(true);
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("scroll", onScroll);
    };
  }, [thresholdMs, key]);

  return met;
}
