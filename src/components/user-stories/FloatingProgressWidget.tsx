"use client";

import React, { useState, useEffect, useRef } from "react";
import { useStoryUpload, StreamProgress } from "@/contexts/StoryUploadContext";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toCEFR } from "@/lib/cefr";

// Minimum duration for displaying each step label (ms)
const MIN_STEP_DURATION = 800;
// Animation time (must match CSS animation duration)
const ANIMATION_DURATION = 350;

// Stream selector dropdown component
function StreamSelector({
  streams,
  lng,
  setShowProgressViewer,
}: {
  streams: StreamProgress[];
  lng: string;
  setShowProgressViewer: (show: boolean) => void;
}) {
  const { setSelectedStreamId } = useStoryUpload();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter to only show streams that have started or have data
  const visibleStreams = streams.filter(
    (s) => s.status !== "waiting" || (Array.isArray(s.chapters) && s.chapters.length > 0)
  );

  // Count streams with viewable data
  const activeStreams = streams.filter(
    (s) => s.status === "in-progress" || s.status === "complete"
  );
  const streamsWithData = streams.filter(
    (s) => Array.isArray(s.chapters) && s.chapters.length > 0
  );

  // Don't show if no streams have data yet
  if (streamsWithData.length === 0) {
    return null;
  }

  const handleStreamClick = (stream: StreamProgress) => {
    if (stream.status === "waiting" || (Array.isArray(stream.chapters) && stream.chapters.length === 0)) {
      return; // Can't view streams that haven't started
    }
    setSelectedStreamId(stream.id);
    setShowProgressViewer(true);
    setIsOpen(false);
  };

  const getStatusIcon = (status: StreamProgress["status"]) => {
    switch (status) {
      case "in-progress":
        return (
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        );
      case "complete":
        return (
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      default:
        return (
          <div className="w-2 h-2 rounded-full bg-gray-300" />
        );
    }
  };

  const getStreamTypeIcon = (type: StreamProgress["type"]) => {
    if (type === "rewriting") {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
    );
  };

  // Single stream - show simple button
  if (streamsWithData.length === 1) {
    const stream = streamsWithData[0];
    return (
      <div className="px-4 pb-4">
        <button
          onClick={() => handleStreamClick(stream)}
          className="w-full py-2 px-4 bg-white border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          {getStreamTypeIcon(stream.type)}
          <span className="flex-1 text-left">
            {lng === "es" ? "Ver progreso" : "View Progress"}
            <span className="text-xs text-gray-400 ml-2">({stream.label})</span>
          </span>
        </button>
      </div>
    );
  }

  // Multiple streams - show dropdown
  return (
    <div className="px-4 pb-4" ref={dropdownRef}>
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full py-2 px-4 bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors flex items-center gap-2 ${isOpen ? "rounded-t-lg border-b-0" : "rounded-lg"}`}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span className="flex-1 text-left">
            {lng === "es" ? "Ver progreso" : "View Progress"}
          </span>
          <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full flex-shrink-0">
            {streamsWithData.length}
          </span>
          <svg
            className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown menu - expands inline to grow the card */}
        {isOpen && (
          <div className="border border-t-0 border-gray-200 rounded-b-lg bg-white overflow-hidden">
            {streams.map((stream) => {
              const hasData = Array.isArray(stream.chapters) && stream.chapters.length > 0;
              const isDisabled = stream.status === "waiting" && !hasData;

              return (
                <button
                  key={stream.id}
                  onClick={() => handleStreamClick(stream)}
                  disabled={isDisabled}
                  className={`w-full px-3 py-2 flex items-center gap-3 text-left transition-colors ${
                    isDisabled
                      ? "bg-gray-50 text-gray-400 cursor-not-allowed"
                      : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <span className="flex-shrink-0">
                    {getStreamTypeIcon(stream.type)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">
                      {stream.label}
                    </span>
                    {hasData ? (
                      <span className="block text-xs text-gray-400">
                        {stream.chapters.length} / {stream.totalChapters} chapters completed
                      </span>
                    ) : stream.status === "waiting" ? (
                      <span className="block text-xs text-gray-400">
                        Waiting to start...
                      </span>
                    ) : null}
                  </span>
                  <span className="flex-shrink-0">
                    {getStatusIcon(stream.status)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
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
    cancelUpload,
    requestCancel,
    setShowReviewModal,
    setShowProgressViewer,
    setSelectedStreamId,
  } = useStoryUpload();

  const [isNavigating, setIsNavigating] = useState(false);

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
    // Get the best level for reading:
    // 1. Use user's quiz level if it was processed
    // 2. Fall back to detected level (always processed)
    // 3. Default to B1
    const userQuizLevel = session?.user?.quizLevel;
    // Convert any level format (number, l1-l6, A1-C2) to CEFR format
    const userLevel = userQuizLevel ? toCEFR(userQuizLevel) : null;
    const detectedLevel = storyData?.detectedLevel;

    // Prefer user's level if set, otherwise use detected level
    const readingLevel = userLevel || detectedLevel || "B1";

    const handleStartReading = () => {
      if (storyData?.id && !isNavigating) {
        setIsNavigating(true);
        // Route: /[lng]/my-stories/[storyId]/[level]/[chapter]/[page]
        router.push(`/${lng}/my-stories/${storyData.id}/${readingLevel}/1/1`);
      }
    };

    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
        <div className="bg-green-600 text-white pl-6 pr-4 py-3 rounded-full shadow-lg flex items-center gap-4">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">
              {lng === "es" ? "¡Historia lista!" : "Story ready!"}
            </span>
          </div>
          <button
            onClick={handleStartReading}
            disabled={isNavigating}
            className="px-4 py-1.5 bg-white text-green-600 rounded-full font-medium text-sm hover:bg-green-50 transition-colors disabled:opacity-70 flex items-center gap-2"
          >
            {isNavigating ? (
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
        </div>
      </div>
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
            <span className="font-medium">Upload failed</span>
            {progress.error && (
              <p className="text-sm text-red-200">{progress.error}</p>
            )}
          </div>
          <button
            onClick={cancelUpload}
            className="ml-2 text-red-200 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // Compute values needed for minimized state
  const streamsWithData = (progress.streams || []).filter(
    (s) => Array.isArray(s.chapters) && s.chapters.length > 0
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
          <span className="truncate">{progress.phaseTitle || progress.message}</span>
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
          <div className="flex items-center gap-2 select-none">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="font-medium">
              {lng === "es" ? "Procesando historia" : "Processing Story"}
            </span>
          </div>
          <div className="flex items-center gap-2">
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
                {progress.phaseTitle || progress.message}
              </p>
              {/* Step label (subtitle) with cylinder animation - fixed height container */}
              <div className="h-5 relative overflow-hidden" style={{ perspective: "200px" }}>
                {/* Exiting label */}
                {previousStepLabel && isAnimating && (
                  <p className="text-sm text-gray-500 truncate absolute inset-0 animate-subtitle-exit">
                    {previousStepLabel}
                  </p>
                )}
                {/* Current/entering label - use absolute during animation to prevent layout shift */}
                {displayedStepLabel && (
                  <p
                    className={`text-sm text-gray-500 truncate ${isAnimating ? 'absolute inset-0 animate-subtitle-enter' : ''}`}
                  >
                    {displayedStepLabel}
                  </p>
                )}
                {/* Chapter progress if no step label but in chapter processing */}
                {!displayedStepLabel && !previousStepLabel && (progress.stage === "rewriting-levels" || progress.stage === "translating") &&
                  progress.currentChapter && progress.totalChapters && (
                  <p className="text-sm text-gray-500">
                    Chapter {progress.currentChapter}/{progress.totalChapters}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Stage steps */}
          <div className="mt-3 flex justify-between text-xs text-gray-400">
            <StageStep
              label="Detect"
              active={["detecting-language", "detecting-level"].includes(progress.stage)}
              complete={progress.overallProgress > 20}
            />
            <StageStep
              label="Adapt"
              active={progress.stage === "rewriting-levels"}
              complete={progress.overallProgress > 70}
            />
            <StageStep
              label="Translate"
              active={progress.stage === "translating"}
              complete={progress.overallProgress > 90}
            />
            <StageStep
              label="Done"
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

        {/* Stream selector for viewing progress */}
        <StreamSelector
          streams={progress.streams || []}
          lng={lng as string}
          setShowProgressViewer={setShowProgressViewer}
        />

        {/* Review prompt */}
        {progress.stage === "review" && (
          <div className="px-4 pb-4">
            <button
              onClick={() => setShowReviewModal(true)}
              className="w-full py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Review Your Story
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
