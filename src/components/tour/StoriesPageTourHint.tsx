"use client";

import { useEffect } from "react";
import { useTourState } from "./TourProvider";
import { t } from "@/lib/t";
import type { Language } from "@/types/i18n";

interface StoriesPageTourHintProps {
  lang: Language;
}

/**
 * Renders nothing directly. Finds the first story card on /stories and
 * injects (a) a `.tour-ring-overlay` div as a child of the card to draw
 * the rotating gold border around the thumbnail, and (b) a
 * `.tour-thumbnail-toast` "Start here" pill positioned inside the
 * thumbnail. Both live in the card's DOM so any element with a higher
 * z-index (top banner, side panel, story detail modal) naturally covers
 * them — no floating-overlay logic needed.
 *
 * This is a UI hint, not a tracked tour step. Fires whenever the user
 * lands on /stories without a step1CompletedAt timestamp.
 */
export default function StoriesPageTourHint({ lang }: StoriesPageTourHintProps) {
  const { state, disabled } = useTourState();

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (disabled) return;
    if (state?.step1CompletedAt) return;

    let detached = false;
    let cleanup = () => {};

    const tryAttach = () => {
      if (detached) return false;
      const card = document.querySelector<HTMLElement>(
        "[data-tour-story-card='first']"
      );
      if (!card) return false;

      // Ring: real DOM element overlaying the thumbnail. Lives in the
      // card's DOM so banners/side panels at higher z-index clip it.
      const ring = document.createElement("div");
      ring.className = "tour-ring-overlay";
      ring.setAttribute("data-tour-ring", "true");
      card.insertBefore(ring, card.firstChild);

      // Toast: child of card, positioned absolutely inside the thumbnail
      // near the bottom edge. Sharing the card's stacking context means
      // anything that covers the thumbnail covers the toast too.
      const toast = document.createElement("div");
      toast.className = "tour-thumbnail-toast";
      toast.setAttribute("data-tour-toast", "true");
      toast.textContent = t(lang, "tour", "startHere");
      card.appendChild(toast);

      cleanup = () => {
        if (ring.parentNode) ring.parentNode.removeChild(ring);
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      };
      return true;
    };

    if (!tryAttach()) {
      const interval = window.setInterval(() => {
        if (tryAttach()) window.clearInterval(interval);
      }, 250);
      const timeout = window.setTimeout(
        () => window.clearInterval(interval),
        5000
      );
      const attachCleanup = cleanup;
      cleanup = () => {
        window.clearInterval(interval);
        window.clearTimeout(timeout);
        attachCleanup();
      };
    }

    return () => {
      detached = true;
      cleanup();
    };
  }, [state, disabled, lang]);

  return null;
}
