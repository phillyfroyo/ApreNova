"use client";

import { useState, useRef, useEffect } from "react";
import { useStoryUpload } from "@/contexts/StoryUploadContext";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTourState } from "@/components/tour/TourProvider";

/** Tour step 4: shown while step 1 is complete AND step 4 isn't. The button pulses + spins
 *  for 10 seconds, then auto-completes. Clicking the button completes early. */
const STEP4_HOLD_MS = 10000;

export default function UploadStoryButton() {
  const { setShowUploadModal, isUploading } = useStoryUpload();
  const { data: session } = useSession();
  const { lng } = useParams();
  const [showAuthPopover, setShowAuthPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // ---- Tour step 4 ----
  // Fires whenever the user has step 1 done but step 4 isn't. Independent of nextStep
  // (the sequential 1→2→3 path) — runs in parallel so we catch users who stop the in-story
  // tour midway. Pulse+spin for 10s, then auto-complete; click completes early.
  const { state: tourState, disabled: tourDisabled, markStepComplete } = useTourState();
  const shouldShowStep4 =
    !tourDisabled &&
    !!tourState?.step1CompletedAt &&
    !tourState?.step4CompletedAt &&
    !isUploading;
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (!shouldShowStep4) {
      setAnimating(false);
      return;
    }
    setAnimating(true);
    const timer = setTimeout(() => {
      setAnimating(false);
      markStepComplete(4).catch(() => {});
    }, STEP4_HOLD_MS);
    return () => clearTimeout(timer);
  }, [shouldShowStep4, markStepComplete]);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        buttonRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowAuthPopover(false);
      }
    };

    if (showAuthPopover) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showAuthPopover]);

  const handleClick = () => {
    // Clicking the upload button is the organic completion path for step 4.
    if (shouldShowStep4) {
      setAnimating(false);
      markStepComplete(4).catch(() => {});
    }
    // If not logged in, show auth popover
    if (!session?.user) {
      setShowAuthPopover(true);
      return;
    }

    // Open the upload modal
    setShowUploadModal(true);
  };

  const isSpanish = lng === "es";

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleClick}
        disabled={isUploading}
        data-tour-upload-pulse={animating ? "true" : undefined}
        className="group relative flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-default"
        title={isSpanish ? "Subir historia" : "Upload story"}
      >
        {isUploading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        )}

        {/* Hover tooltip (only when popover is not shown) */}
        {!showAuthPopover && (
          <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            {isSpanish ? "Subir historia" : "Upload story"}
          </span>
        )}
      </button>

      {/* Auth required popover */}
      {showAuthPopover && (
        <div
          ref={popoverRef}
          className="absolute top-full right-0 mt-2 w-80 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {/* Arrow */}
          <div className="absolute -top-2 right-4 w-4 h-4 bg-white/95 dark:bg-gray-800/95 border-l border-t border-gray-200 dark:border-gray-700 transform rotate-45" />

          <div className="relative">
            <p className="text-sm text-gray-700 dark:text-gray-200 mb-3">
              {isSpanish
                ? "Se necesita una cuenta para subir historias. ¡Es gratis!"
                : "An account is required to upload stories. It's free!"}
            </p>

            <div className="flex gap-2">
              <Link
                href={`/${lng}/auth/login`}
                className="flex-1 px-3 py-2 text-sm text-center text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-md transition-colors"
                onClick={() => setShowAuthPopover(false)}
              >
                {isSpanish ? "Iniciar sesión" : "Log in"}
              </Link>
              <Link
                href={`/${lng}/auth/signup`}
                className="flex-1 px-3 py-2 text-sm text-center text-white bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-md transition-colors"
                onClick={() => setShowAuthPopover(false)}
              >
                {isSpanish ? "Crear cuenta" : "Create account"}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
