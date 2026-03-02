"use client";

import React, { useState, useEffect, useRef } from "react";
import { useStoryUpload, StreamProgress, StoryUploadData, getLocalizedPhaseTitle, getLocalizedStageMessage } from "@/contexts/StoryUploadContext";
import { useParams, useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { toCEFR } from "@/lib/cefr";
import { t } from "@/lib/t";
import type { Language } from "@/types/i18n";
// Note: prefetch-cache no longer used for reader prefetching (unified reader uses server-side data)
import { StreamSelector } from "./StreamSelector";

// Map English step labels (from backend) to i18n dictionary keys
const STEP_LABEL_I18N_KEYS: Record<string, string> = {
  "Creating story record": "stepCreatingRecord",
  "Preparing reading levels": "stepPreparingLevels",
  "Detecting language": "stepDetectingLanguage",
  "Analyzing story metadata": "stepAnalyzingMetadata",
  "Generating title": "stepGeneratingTitle",
  "Generating description": "stepGeneratingDescription",
  "Generating hook": "stepGeneratingHook",
  "Detecting story type": "stepDetectingStoryType",
  "Detecting target audience": "stepDetectingAudience",
  "Extracting tags": "stepExtractingTags",
  "Detecting CEFR level": "stepDetectingLevel",
  "Cleaning text": "stepCleaningText",
  "Parsing chapters": "stepParsingChapters",
  "Adapting to reading levels": "stepAdaptingLevels",
  "Rewriting chapter": "stepRewritingChapter",
  "Translating all levels": "stepTranslatingLevels",
  "Translating chapter": "stepTranslatingChapter",
  "Building all levels": "stepBuildingLevels",
  "Building content structure": "stepBuildingStructure",
  "Saving level content": "stepSavingContent",
  "Complete": "stepComplete",
  "Ready for review": "readyForReview",
};

// Localize a step label from the backend (English) to the current language
// Handles labels with chapter suffixes like "Rewriting chapter 3 of 5"
function localizeStepLabel(label: string | undefined, lng: Language): string | undefined {
  if (!label) return label;

  // Try direct match first
  const directKey = STEP_LABEL_I18N_KEYS[label];
  if (directKey) return t(lng, "upload", directKey);

  // Try stripping chapter suffix: "Rewriting chapter 3 of 5" → "Rewriting chapter" + "3 of 5"
  const chapterMatch = label.match(/^(.+?)\s+(\d+)\s+of\s+(\d+)$/);
  if (chapterMatch) {
    const baseLabel = chapterMatch[1];
    const current = chapterMatch[2];
    const total = chapterMatch[3];
    const baseKey = STEP_LABEL_I18N_KEYS[baseLabel];
    if (baseKey) {
      const localizedBase = t(lng, "upload", baseKey);
      const localizedChapter = t(lng, "upload", "stepChapterOf", { current, total });
      return `${localizedBase} ${localizedChapter}`;
    }
  }

  // Fallback: return original label
  return label;
}

// Minimum duration for displaying each step label (ms)
const MIN_STEP_DURATION = 800;
// Animation time (must match CSS animation duration)
const ANIMATION_DURATION = 350;


// Success banner - simple notification after story is confirmed
function SuccessBanner({
  lng,
  storyData,
  detectedLevel,
  session,
  isNavigating,
  setIsNavigating,
  onNavigationComplete,
  streams,
}: {
  lng: string;
  storyData: StoryUploadData | null;
  detectedLevel?: string;
  session: any;
  isNavigating: boolean;
  setIsNavigating: (v: boolean) => void;
  onNavigationComplete: () => void;
  streams?: StreamProgress[];
}) {
  const router = useRouter();
  const pathname = usePathname();

  // Track if we've started navigation to keep button in loading state
  const hasStartedNavigation = useRef(false);
  // Store the path when user clicks "Start reading", not when component mounts
  const navigationStartPathRef = useRef<string | null>(null);
  const isActuallyNavigating = isNavigating || hasStartedNavigation.current;

  // Get levels that are actually READY (from streams data)
  const readyLevels = streams
    ?.filter(s => s.levelStatus === "READY")
    .map(s => s.level) || [];

  // Get the best level for reading - must be from ready levels
  const userQuizLevel = session?.user?.quizLevel;
  const userLevel = userQuizLevel ? toCEFR(userQuizLevel) : null;

  // Priority: 1) user's level if ready, 2) detected level if ready, 3) first ready level, 4) fallback
  const readingLevel =
    (userLevel && readyLevels.includes(userLevel)) ? userLevel :
    (detectedLevel && readyLevels.includes(detectedLevel)) ? detectedLevel :
    readyLevels[0] || detectedLevel || "B1";

  // Detect when navigation completes (pathname changes after we started navigating)
  useEffect(() => {
    // Only trigger if:
    // 1. User has clicked "Start reading" (hasStartedNavigation is true)
    // 2. We have a reference path from when they clicked
    // 3. The pathname has actually changed from that reference
    console.log("[SuccessBanner] pathname effect:", {
      hasStartedNavigation: hasStartedNavigation.current,
      navigationStartPath: navigationStartPathRef.current,
      currentPathname: pathname,
    });
    if (
      hasStartedNavigation.current &&
      navigationStartPathRef.current !== null &&
      pathname !== navigationStartPathRef.current
    ) {
      // Navigation completed - hide the banner
      console.log("[SuccessBanner] Triggering onNavigationComplete due to pathname change");
      onNavigationComplete();
    }
  }, [pathname, onNavigationComplete]);

  // Prefetch the story page when banner appears (in case review modal prefetch didn't happen)
  useEffect(() => {
    if (!storyData?.id) return;
    const prefetchUrl = `/${lng}/my-stories/${storyData.id}/${readingLevel}/1/1`;
    router.prefetch(prefetchUrl);
  }, [storyData?.id, lng, readingLevel, router]);

  const handleStartReading = () => {
    if (storyData?.id && !isActuallyNavigating) {
      // Store the current path BEFORE navigation starts
      navigationStartPathRef.current = pathname;
      hasStartedNavigation.current = true;
      setIsNavigating(true);
      router.push(`/${lng}/my-stories/${storyData.id}/${readingLevel}/1/1`);
    }
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
      <div className="bg-green-600 text-white pl-6 pr-2 py-3 rounded-full shadow-lg flex items-center gap-3">
        {/* Title with checkmark */}
        <div className="flex items-center gap-3 min-w-0">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-medium truncate">
            {storyData?.title && storyData.title !== "Untitled Story"
              ? storyData.title
              : lng === "es" ? "¡Historia lista!" : "Story ready!"}
          </span>
        </div>

        {/* Start Reading button */}
        <button
          onClick={handleStartReading}
          disabled={isActuallyNavigating}
          className="px-4 py-1.5 bg-white text-green-600 rounded-full font-medium text-sm hover:bg-green-50 transition-colors disabled:opacity-70 flex items-center gap-2"
        >
          {isActuallyNavigating ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {lng === "es" ? "Cargando..." : "Loading..."}
            </>
          ) : (
            lng === "es" ? "Empezar a leer" : "Start reading"
          )}
        </button>

        {/* Close button */}
        <button
          onClick={onNavigationComplete}
          className="p-1.5 hover:bg-green-500 rounded-full transition-colors"
          aria-label={lng === "es" ? "Cerrar" : "Close"}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Start Reading Buttons - appear when chapters are ready during processing
// Shows separate buttons for Original and Rewritten stories
function StartReadingButtons({
  lng,
  storyData,
  progress,
  session,
  onStartReading,
  onMinimize,
  isMinimized,
}: {
  lng: string;
  storyData: StoryUploadData | null;
  progress: {
    totalChapters?: number;
    streams?: StreamProgress[];
    detectedLevel?: string;
  };
  session: any;
  onStartReading: () => void;
  onMinimize: () => void;
  isMinimized: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loadingLevel, setLoadingLevel] = useState<string | null>(null);
  const wasMinimizedRef = useRef(isMinimized);
  const navigationStartPathRef = useRef<string | null>(null);

  // Minimize modal when navigation completes (pathname changes after clicking Start Reading)
  useEffect(() => {
    if (
      loadingLevel &&
      navigationStartPathRef.current !== null &&
      pathname !== navigationStartPathRef.current
    ) {
      navigationStartPathRef.current = null;
      onMinimize();
    }
  }, [pathname, loadingLevel, onMinimize]);

  // Reset loading state only when transitioning from minimized → visible
  // (i.e., user re-maximized the widget after navigating away)
  useEffect(() => {
    const wasMinimized = wasMinimizedRef.current;
    wasMinimizedRef.current = isMinimized;

    // Only reset if we're going from minimized (true) to visible (false)
    // This prevents resetting during the initial click flow
    if (wasMinimized && !isMinimized) {
      setLoadingLevel(null);
    }
  }, [isMinimized]);

  // Find all translation streams
  const translationStreams = (progress.streams || []).filter(
    (s) => s.type === "translating"
  );

  // Get the user's preferred level and detected level
  const userQuizLevel = session?.user?.quizLevel;
  const userLevel = userQuizLevel ? toCEFR(userQuizLevel) : null;
  const detectedLevel = progress.detectedLevel;

  // Find the original (detected level) and rewritten (user level) streams
  // First try exact match, then fall back to any stream with matching characteristics
  let originalStream = translationStreams.find(
    (s) => s.level === detectedLevel
  );
  let rewrittenStream = userLevel && userLevel !== detectedLevel
    ? translationStreams.find((s) => s.level === userLevel)
    : null;

  // Fallback: if no exact match, find streams by checking rewrite relationship
  // A stream is "original" if there's no rewrite stream for its level
  // A stream is "rewritten" if there IS a rewrite stream for its level
  if (!originalStream || !rewrittenStream) {
    const rewriteStreams = (progress.streams || []).filter(
      (s) => s.type === "rewriting"
    );
    const rewrittenLevels = new Set(rewriteStreams.map((s) => s.level));

    for (const stream of translationStreams) {
      const wasRewritten = rewrittenLevels.has(stream.level);
      if (!originalStream && !wasRewritten) {
        // This is an original (non-rewritten) level
        originalStream = stream;
      } else if (!rewrittenStream && wasRewritten) {
        // This is a rewritten level
        rewrittenStream = stream;
      }
    }
  }

  // Check if each stream is ready for reading
  // Ready = has levelStatus "PROCESSING" AND at least 1 completed chapter
  // Use currentChapter (completed count) since chapters array may be empty with new incremental content writing
  const originalReady = originalStream?.levelStatus === "PROCESSING" &&
    (originalStream.currentChapter > 0 || (Array.isArray(originalStream.chapters) && originalStream.chapters.length > 0));
  const rewrittenReady = rewrittenStream?.levelStatus === "PROCESSING" &&
    (rewrittenStream.currentChapter > 0 || (Array.isArray(rewrittenStream.chapters) && rewrittenStream.chapters.length > 0));

  // Get total chapters for display (prefer originalStream, fall back to rewrittenStream, then progress)
  const totalChapters = originalStream?.totalChapters || rewrittenStream?.totalChapters || progress.totalChapters || 0;

  // Get completed chapters for each stream
  // Prefer currentChapter (reliable count) over chapters.length (may be empty with incremental content)
  const originalCompletedChapters = originalStream
    ? (originalStream.currentChapter || (Array.isArray(originalStream.chapters) ? originalStream.chapters.length : 0))
    : 0;
  const rewrittenCompletedChapters = rewrittenStream
    ? (rewrittenStream.currentChapter || (Array.isArray(rewrittenStream.chapters) ? rewrittenStream.chapters.length : 0))
    : 0;

  // Prefetch page 1 of each level as soon as it becomes ready
  // Prefetches both the Next.js route and the API data so navigation + render is near-instant
  const prefetchedLevelsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!storyData?.id) return;
    const levels: string[] = [];
    if (originalReady && originalStream?.level) levels.push(originalStream.level);
    if (rewrittenReady && rewrittenStream?.level) levels.push(rewrittenStream.level);
    for (const level of levels) {
      if (!prefetchedLevelsRef.current.has(level)) {
        prefetchedLevelsRef.current.add(level);
        // Prefetch the Next.js route (JS bundle + RSC payload)
        router.prefetch(`/${lng}/my-stories/${storyData.id}/${level}/1/1`);
      }
    }
  }, [storyData?.id, originalReady, rewrittenReady, originalStream?.level, rewrittenStream?.level, lng, router]);

  // Don't show if:
  // - Single chapter story (no point in "read while uploading")
  // - No story ID
  // - Neither stream has any completed chapters yet
  const anyStreamHasChapters = originalCompletedChapters > 0 || rewrittenCompletedChapters > 0;
  if (totalChapters <= 1 || !storyData?.id || !anyStreamHasChapters) {
    return null;
  }

  const handleStartReading = (level: string) => {
    if (loadingLevel) return; // Prevent double-clicks
    navigationStartPathRef.current = pathname;
    setLoadingLevel(level);
    onStartReading();
    // Modal stays open showing loading spinner until navigation completes
    // (pathname change detected in useEffect above triggers onMinimize)
    router.push(`/${lng}/my-stories/${storyData.id}/${level}/1/1`);
  };

  // Button styles - smaller, with color
  const baseButtonClass = "w-full py-1.5 px-3 rounded-lg text-sm font-medium transition-all flex items-center gap-2";
  const enabledClass = "bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:opacity-90";
  const disabledClass = "bg-gray-100 text-gray-400 border border-gray-200";
  const loadingClass = "bg-gradient-to-r from-cyan-400 to-blue-400 text-white opacity-80";

  // Get actual levels from streams (may differ from expected userLevel/detectedLevel)
  const rewrittenLevel = rewrittenStream?.level;
  const originalLevel = originalStream?.level;

  return (
    <div className="px-4 pb-3 space-y-1.5">
      {/* Rewritten story button - show if we have a rewritten stream */}
      {rewrittenStream && rewrittenLevel && (
        <button
          onClick={() => rewrittenReady && handleStartReading(rewrittenLevel)}
          disabled={!rewrittenReady || loadingLevel !== null}
          className={`${baseButtonClass} ${
            loadingLevel === rewrittenLevel ? loadingClass :
            rewrittenReady ? enabledClass : disabledClass
          }`}
        >
          {loadingLevel === rewrittenLevel ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>{lng === "es" ? "Cargando..." : "Loading..."}</span>
            </>
          ) : rewrittenReady ? (
            <>
              <span className="flex-1 text-left">
                {lng === "es"
                  ? `Reescrita ${rewrittenLevel} - Empezar a leer`
                  : `Rewritten ${rewrittenLevel} - Start reading`}
              </span>
              <span className="text-xs opacity-75">({rewrittenCompletedChapters}/{totalChapters})</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-gray-300 animate-pulse flex-shrink-0" />
              <span className="flex-1 text-left">
                {lng === "es"
                  ? `Reescrita ${rewrittenLevel}`
                  : `Rewritten ${rewrittenLevel}`}
              </span>
              <span className="text-xs">{lng === "es" ? "Preparando..." : "Preparing..."}</span>
            </>
          )}
        </button>
      )}

      {/* Original story button - show if we have an original stream */}
      {originalStream && originalLevel && (
        <button
          onClick={() => originalReady && handleStartReading(originalLevel)}
          disabled={!originalReady || loadingLevel !== null}
          className={`${baseButtonClass} ${
            loadingLevel === originalLevel ? loadingClass :
            originalReady ? enabledClass : disabledClass
          }`}
        >
          {loadingLevel === originalLevel ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>{lng === "es" ? "Cargando..." : "Loading..."}</span>
            </>
          ) : originalReady ? (
            <>
              <span className="flex-1 text-left">
                {lng === "es"
                  ? `Original ${originalLevel} - Empezar a leer`
                  : `Original ${originalLevel} - Start reading`}
              </span>
              <span className="text-xs opacity-75">({originalCompletedChapters}/{totalChapters})</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-gray-300 animate-pulse flex-shrink-0" />
              <span className="flex-1 text-left">
                {lng === "es"
                  ? `Original ${originalLevel}`
                  : `Original ${originalLevel}`}
              </span>
              <span className="text-xs">{lng === "es" ? "Preparando..." : "Preparing..."}</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

export default function FloatingProgressWidget() {
  const { lng } = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const {
    isUploading,
    isMinimized,
    progress,
    storyData,
    toggleMinimized,
    minimize,
    cancelUpload,
    requestCancel,
    retryConnection,
    setShowReviewModal,
    setShowProgressViewer,
    setSelectedStreamId,
    resetProgress,
    setIsReadingCurrentStory,
  } = useStoryUpload();

  const [isNavigating, setIsNavigating] = useState(false);
  const previousStoryIdRef = useRef<string | null>(null);

  // Reset navigation state when a new story starts (different storyData.id)
  useEffect(() => {
    if (storyData?.id && storyData.id !== previousStoryIdRef.current) {
      // New story - reset navigation state
      setIsNavigating(false);
      previousStoryIdRef.current = storyData.id;
    }
  }, [storyData?.id]);

  // Drag state for movable card
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);

  // Handle drag start (mouse)
  const handleMouseDragStart = (e: React.MouseEvent) => {
    // Only start drag on left click
    if (e.button !== 0) return;

    const currentX = dragPosition?.x ?? 0;
    const currentY = dragPosition?.y ?? 0;

    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: currentX,
      posY: currentY,
    };
    setIsDragging(true);
    e.preventDefault();
  };

  // Handle drag start (touch)
  const handleTouchDragStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    const currentX = dragPosition?.x ?? 0;
    const currentY = dragPosition?.y ?? 0;

    dragStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      posX: currentX,
      posY: currentY,
    };
    setIsDragging(true);
  };

  // Handle drag move and end
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;

      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;

      setDragPosition({
        x: dragStartRef.current.posX + deltaX,
        y: dragStartRef.current.posY + deltaY,
      });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!dragStartRef.current || e.touches.length !== 1) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - dragStartRef.current.x;
      const deltaY = touch.clientY - dragStartRef.current.y;

      setDragPosition({
        x: dragStartRef.current.posX + deltaX,
        y: dragStartRef.current.posY + deltaY,
      });

      // Prevent scrolling while dragging
      e.preventDefault();
    };

    const handleDragEnd = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleDragEnd);
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleDragEnd);
    document.addEventListener("touchcancel", handleDragEnd);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleDragEnd);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleDragEnd);
      document.removeEventListener("touchcancel", handleDragEnd);
    };
  }, [isDragging]);

  // Reset drag position after minimize transition completes
  useEffect(() => {
    if (isMinimized) {
      // Wait for opacity transition (200ms) before resetting position
      const timeout = setTimeout(() => {
        setDragPosition(null);
      }, 200);
      return () => clearTimeout(timeout);
    }
  }, [isMinimized]);

  // Animated subtitle state management
  const [displayedStepLabel, setDisplayedStepLabel] = useState<string | undefined>();
  const [previousStepLabel, setPreviousStepLabel] = useState<string | undefined>();
  const [isAnimating, setIsAnimating] = useState(false);
  const lastStepChangeRef = useRef<number>(Date.now());
  const pendingStepRef = useRef<string | undefined>(undefined);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const delayTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const newStepLabel = progress.stepLabel;

    // If no change, do nothing
    if (newStepLabel === displayedStepLabel) return;

    // Always update pending to the latest value
    pendingStepRef.current = newStepLabel;

    // If currently animating, just queue it - don't start a new transition
    if (isAnimating) {
      return;
    }

    const now = Date.now();
    const timeSinceLastChange = now - lastStepChangeRef.current;

    const performTransition = (labelToShow: string | undefined) => {
      // Clear any existing timeouts
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }

      // Start animation - set both labels immediately so enter animation shows correct text
      setPreviousStepLabel(displayedStepLabel);
      setDisplayedStepLabel(labelToShow);
      setIsAnimating(true);
      lastStepChangeRef.current = Date.now();

      // Clear previous after animation completes
      animationTimeoutRef.current = setTimeout(() => {
        setPreviousStepLabel(undefined);
        setIsAnimating(false);

        // Check if there's a newer pending step we should transition to
        if (pendingStepRef.current && pendingStepRef.current !== labelToShow) {
          // Schedule the next transition after minimum duration
          delayTimeoutRef.current = setTimeout(() => {
            const nextLabel = pendingStepRef.current;
            pendingStepRef.current = undefined;
            if (nextLabel) {
              performTransition(nextLabel);
            }
          }, MIN_STEP_DURATION);
        } else {
          pendingStepRef.current = undefined;
        }
      }, ANIMATION_DURATION);
    };

    if (timeSinceLastChange >= MIN_STEP_DURATION) {
      // Enough time has passed, transition immediately
      pendingStepRef.current = undefined;
      performTransition(newStepLabel);
    } else {
      // Queue the update - clear any existing delay timeout
      if (delayTimeoutRef.current) {
        clearTimeout(delayTimeoutRef.current);
      }

      const delay = MIN_STEP_DURATION - timeSinceLastChange;

      delayTimeoutRef.current = setTimeout(() => {
        const labelToShow = pendingStepRef.current;
        pendingStepRef.current = undefined;
        if (labelToShow) {
          performTransition(labelToShow);
        }
      }, delay);
    }

    // Cleanup on unmount
    return () => {
      if (delayTimeoutRef.current) {
        clearTimeout(delayTimeoutRef.current);
      }
    };
  }, [progress.stepLabel, displayedStepLabel, isAnimating]);

  // Don't render if not uploading
  if (!isUploading && progress.stage === "idle") {
    return null;
  }

  // Show success message with "Start reading" button after completion
  if (progress.stage === "complete") {
    return (
      <SuccessBanner
        lng={lng as string}
        storyData={storyData}
        detectedLevel={progress.detectedLevel}
        session={session}
        isNavigating={isNavigating}
        setIsNavigating={setIsNavigating}
        onNavigationComplete={resetProgress}
        streams={progress.streams}
      />
    );
  }

  // Error state
  if (progress.stage === "error") {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-red-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <div>
            <span className="font-medium">{t(lng as Language, "upload", "uploadFailed")}</span>
            {progress.error && (
              <p className="text-sm text-red-200">{progress.error}</p>
            )}
          </div>
          <button
            onClick={cancelUpload}
            className="ml-2 text-red-200 hover:text-white"
          >
            {t(lng as Language, "upload", "dismiss")}
          </button>
        </div>
      </div>
    );
  }

  // Reconnecting state - recovering from state loss (e.g., after 404 navigation)
  if (progress.stage === "reconnecting") {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-blue-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <div className="flex-1">
            <span className="font-medium">
              {lng === "es" ? "Reconectando..." : "Reconnecting..."}
            </span>
            <p className="text-sm text-blue-200">
              {lng === "es"
                ? "Recuperando estado de la carga"
                : "Recovering upload state"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Connection lost state - recoverable with retry
  if (progress.stage === "connection-lost") {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-amber-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <span className="font-medium">
              {lng === "es" ? "Conexión perdida" : "Connection lost"}
            </span>
            <p className="text-sm text-amber-200">
              {lng === "es"
                ? "Verifica tu conexión a internet"
                : "Check your internet connection"}
            </p>
          </div>
          <button
            onClick={retryConnection}
            className="px-3 py-1.5 bg-white text-amber-600 rounded-lg font-medium text-sm hover:bg-amber-50 transition-colors"
          >
            {lng === "es" ? "Reintentar" : "Retry"}
          </button>
          <button
            onClick={cancelUpload}
            className="p-1.5 text-amber-200 hover:text-white hover:bg-amber-700 rounded transition-colors"
            title={lng === "es" ? "Cancelar" : "Cancel"}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Compute values needed for minimized state
  // Include streams with:
  // 1. chapters array populated (legacy/direct data)
  // 2. currentChapter >= 1 (at least 1 chapter completed - data available in content field)
  const streamsWithData = (progress.streams || []).filter(
    (s) => (Array.isArray(s.chapters) && s.chapters.length > 0) || s.currentChapter >= 1
  );
  const hasChaptersToView = streamsWithData.length > 0;
  const isRewriting = progress.stage === "rewriting-levels";

  // Handle view click in minimized state
  const handleMinimizedViewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (streamsWithData.length === 1) {
      // Single stream - open it directly
      setSelectedStreamId(streamsWithData[0].id);
      setShowProgressViewer(true);
    } else if (streamsWithData.length > 1) {
      // Multiple streams - expand widget so user can choose
      toggleMinimized();
    }
  };

  // Render both states with opacity transitions for smooth minimize/maximize
  return (
    <>
      {/* Minimized state - thin horizontal bar at top */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 cursor-pointer transition-opacity duration-200 ${
          isMinimized ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={toggleMinimized}
      >
        <div className="h-1 bg-gray-200">
          <div
            className={`h-full transition-all duration-500 ${isRewriting ? "bg-gradient-to-r from-amber-500 to-orange-500" : "bg-gradient-to-r from-blue-500 to-purple-500"}`}
            style={{ width: `${progress.overallProgress}%` }}
          />
        </div>
        <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-white shadow-md rounded-full px-3 py-1 text-xs text-gray-600 flex items-center gap-2 hover:shadow-lg transition-shadow max-w-md">
          <div className={`w-2 h-2 rounded-full animate-pulse flex-shrink-0 ${isRewriting ? "bg-amber-500" : "bg-blue-500"}`} />
          <span className="flex-shrink-0">{progress.overallProgress}%</span>
          <span className="text-gray-400 flex-shrink-0">|</span>
          <span className="truncate">
            {progress.phase
              ? getLocalizedPhaseTitle(progress.phase, lng as Language)
              : getLocalizedStageMessage(progress.stage, lng as Language, {
                  userLevel: progress.userLevel,
                  detectedLevel: progress.detectedLevel,
                  currentLevel: progress.currentLevel,
                }) || progress.message}
          </span>
          {hasChaptersToView && (
            <>
              <span className="text-gray-400">|</span>
              <button
                onClick={handleMinimizedViewClick}
                className={`font-medium flex items-center gap-1 ${isRewriting ? "text-amber-500 hover:text-amber-600" : "text-blue-500 hover:text-blue-600"}`}
              >
                {lng === "es" ? "Ver" : "View"}
                {streamsWithData.length > 1 && (
                  <span className="text-xs bg-blue-100 text-blue-600 px-1 rounded-full">
                    {streamsWithData.length}
                  </span>
                )}
              </button>
            </>
          )}
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded state - floating card */}
      <div
        className={`fixed z-50 w-full max-w-md px-4 transition-opacity duration-200 ${
          isMinimized ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        style={{
          top: dragPosition ? `calc(1rem + ${dragPosition.y}px)` : "1rem",
          left: dragPosition ? `calc(50% + ${dragPosition.x}px)` : "50%",
          transform: "translateX(-50%)",
        }}
      >
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
        {/* Header - drag handle */}
        <div
          className={`px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white flex items-center justify-between rounded-t-2xl ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          onMouseDown={handleMouseDragStart}
          onTouchStart={handleTouchDragStart}
        >
          <div className="flex items-center gap-2 select-none min-w-0">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse flex-shrink-0" />
            <span className="font-medium truncate">
              {storyData?.title && storyData.title !== "Untitled Story"
                ? storyData.title
                : t(lng as Language, "upload", "processingStory")}
            </span>
          </div>
          <div className="flex items-center">
            <button
              onClick={toggleMinimized}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              title="Minimize"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <button
              onClick={requestCancel}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              title="Cancel"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Progress content */}
        <div className="p-4">
          {/* Stage indicator */}
          <div className="flex items-center gap-3 mb-3">
            <div className="relative">
              <svg className="w-10 h-10 -rotate-90">
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="4"
                />
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${progress.overallProgress} 100`}
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-700">
                {progress.overallProgress}%
              </span>
            </div>
            <div className="flex-1 min-w-0">
              {/* Phase title (main) */}
              <p className="font-medium text-gray-800">
                {progress.phase
                  ? getLocalizedPhaseTitle(progress.phase, lng as Language)
                  : getLocalizedStageMessage(progress.stage, lng as Language, {
                      userLevel: progress.userLevel,
                      detectedLevel: progress.detectedLevel,
                      currentLevel: progress.currentLevel,
                    }) || progress.message}
              </p>
              {/* Step label (subtitle) with cylinder animation - fixed height container */}
              <div className="h-5 relative overflow-hidden" style={{ perspective: "200px" }}>
                {/* Exiting label */}
                {previousStepLabel && isAnimating && (
                  <p className="text-sm text-gray-500 truncate absolute inset-0 animate-subtitle-exit">
                    {localizeStepLabel(previousStepLabel, lng as Language)}
                  </p>
                )}
                {/* Current/entering label - use absolute during animation to prevent layout shift */}
                {displayedStepLabel && (
                  <p
                    className={`text-sm text-gray-500 truncate ${isAnimating ? 'absolute inset-0 animate-subtitle-enter' : ''}`}
                  >
                    {localizeStepLabel(displayedStepLabel, lng as Language)}
                  </p>
                )}
                {/* Chapter progress if no step label but in chapter processing */}
                {!displayedStepLabel && !previousStepLabel && (progress.stage === "rewriting-levels" || progress.stage === "translating") &&
                  progress.currentChapter && progress.totalChapters && (
                  <p className="text-sm text-gray-500">
                    {t(lng as Language, "upload", "chapterProgress", { current: progress.currentChapter, total: progress.totalChapters })}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Stage steps */}
          <div className="mt-3 flex justify-between text-xs text-gray-400">
            <StageStep
              label={t(lng as Language, "upload", "detect")}
              active={["detecting-language", "detecting-level"].includes(progress.stage)}
              complete={progress.overallProgress > 20}
            />
            <StageStep
              label={t(lng as Language, "upload", "adapt")}
              active={progress.stage === "rewriting-levels"}
              complete={progress.overallProgress > 70}
            />
            <StageStep
              label={t(lng as Language, "upload", "translate")}
              active={progress.stage === "translating"}
              complete={progress.overallProgress > 90}
            />
            <StageStep
              label={t(lng as Language, "upload", "done")}
              active={progress.stage === "review"}
              complete={progress.overallProgress === 100}
            />
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 ease-out"
              style={{ width: `${progress.overallProgress}%` }}
            />
          </div>
        </div>

        {/* Start Reading buttons - shown when chapters are ready */}
        <StartReadingButtons
          lng={lng as string}
          storyData={storyData}
          progress={progress}
          session={session}
          onStartReading={() => setIsReadingCurrentStory(true)}
          onMinimize={minimize}
          isMinimized={isMinimized}
        />

        {/* Stream selector for viewing progress */}
        <div className="px-4 pb-4">
          <StreamSelector
            streams={progress.streams || []}
            lng={lng as string}
            setShowProgressViewer={setShowProgressViewer}
          />
        </div>

        {/* Review prompt */}
        {progress.stage === "review" && (
          <div className="px-4 pb-4">
            <button
              onClick={() => setShowReviewModal(true)}
              className="w-full py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              {t(lng as Language, "upload", "reviewYourStory")}
            </button>
          </div>
        )}
      </div>
      </div>
    </>
  );
}

function StageStep({ label, active, complete }: { label: string; active: boolean; complete: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-1 ${active ? "text-blue-500" : complete ? "text-green-500" : ""}`}>
      <div className={`w-2 h-2 rounded-full ${
        active ? "bg-blue-500 animate-pulse" :
        complete ? "bg-green-500" :
        "bg-gray-300"
      }`} />
      <span>{label}</span>
    </div>
  );
}
