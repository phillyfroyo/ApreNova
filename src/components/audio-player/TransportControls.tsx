// src/components/audio-player/TransportControls.tsx
"use client";

import { Pause, Play, Loader2, SkipBack, SkipForward, ChevronLeft, ChevronRight } from "lucide-react";

interface TransportControlsProps {
  status: string;
  transportDisabled: boolean;
  onPlayPause: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  /** "mobile" uses interpolated inline sizes; "desktop" uses fixed Tailwind classes */
  variant: "mobile" | "desktop";
  /** For mobile: interpolated sizes from drag progress */
  sizes?: {
    playBtnSize: number;
    playIconSize: number;
    navBtnSize: number;
    navIconSize: number;
    transitionClass: string;
  };
}

export default function TransportControls({
  status, transportDisabled, onPlayPause, onSkipBack, onSkipForward, onPrevPage, onNextPage,
  variant, sizes,
}: TransportControlsProps) {
  const isPlaying = status === "playing";

  const navBtnClass = (disabled: boolean) =>
    `w-9 h-9 flex items-center justify-center rounded-full ${disabled ? "text-gray-300 cursor-default" : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"}`;

  if (variant === "desktop") {
    return (
      <div className="flex items-center gap-2">
        <button onClick={onPrevPage} disabled={transportDisabled} className={navBtnClass(transportDisabled)} aria-label="Previous page">
          <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
        </button>
        <button onClick={onSkipBack} disabled={transportDisabled} className={navBtnClass(transportDisabled)} aria-label="Previous sentence">
          <SkipBack className="w-[18px] h-[18px]" fill="currentColor" />
        </button>
        <button onClick={onPlayPause} disabled={transportDisabled} className={`w-11 h-11 flex items-center justify-center rounded-full text-white shadow-md shadow-indigo-200 ${transportDisabled ? "bg-gray-300 cursor-default" : "bg-indigo-600 hover:bg-indigo-700"}`} aria-label={isPlaying ? "Pause" : "Play"}>
          {transportDisabled ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-5 h-5" fill="currentColor" />
          ) : (
            <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
          )}
        </button>
        <button onClick={onSkipForward} disabled={transportDisabled} className={navBtnClass(transportDisabled)} aria-label="Next sentence">
          <SkipForward className="w-[18px] h-[18px]" fill="currentColor" />
        </button>
        <button onClick={onNextPage} disabled={transportDisabled} className={navBtnClass(transportDisabled)} aria-label="Next page">
          <ChevronRight className="w-5 h-5" strokeWidth={2.5} />
        </button>
      </div>
    );
  }

  // Mobile variant with interpolated sizes
  const { playBtnSize = 56, playIconSize = 24, navBtnSize = 40, navIconSize = 20 } = sizes || {};

  const mobileNavClass = (disabled: boolean) =>
    `flex items-center justify-center rounded-full ${disabled ? "text-gray-300 cursor-default" : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"}`;

  return (
    <>
      <button onClick={onPrevPage} disabled={transportDisabled} className={mobileNavClass(transportDisabled)} style={{ width: `${navBtnSize}px`, height: `${navBtnSize}px` }} aria-label="Previous page">
        <ChevronLeft style={{ width: `${navIconSize}px`, height: `${navIconSize}px` }} strokeWidth={2.5} />
      </button>
      <button onClick={onSkipBack} disabled={transportDisabled} className={mobileNavClass(transportDisabled)} style={{ width: `${navBtnSize}px`, height: `${navBtnSize}px` }} aria-label="Previous sentence">
        <SkipBack style={{ width: `${navIconSize}px`, height: `${navIconSize}px` }} fill="currentColor" />
      </button>
      <button
        onClick={onPlayPause} disabled={transportDisabled}
        className={`flex items-center justify-center rounded-full text-white shadow-md shadow-indigo-200 ${transportDisabled ? "bg-gray-300 cursor-default" : "bg-indigo-600 hover:bg-indigo-700"}`}
        style={{ width: `${playBtnSize}px`, height: `${playBtnSize}px` }}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {transportDisabled ? (
          <Loader2 style={{ width: `${playIconSize}px`, height: `${playIconSize}px` }} className="animate-spin" />
        ) : isPlaying ? (
          <Pause style={{ width: `${playIconSize}px`, height: `${playIconSize}px` }} fill="currentColor" />
        ) : (
          <Play style={{ width: `${playIconSize}px`, height: `${playIconSize}px`, marginLeft: '2px' }} fill="currentColor" />
        )}
      </button>
      <button onClick={onSkipForward} disabled={transportDisabled} className={mobileNavClass(transportDisabled)} style={{ width: `${navBtnSize}px`, height: `${navBtnSize}px` }} aria-label="Next sentence">
        <SkipForward style={{ width: `${navIconSize}px`, height: `${navIconSize}px` }} fill="currentColor" />
      </button>
      <button onClick={onNextPage} disabled={transportDisabled} className={mobileNavClass(transportDisabled)} style={{ width: `${navBtnSize}px`, height: `${navBtnSize}px` }} aria-label="Next page">
        <ChevronRight style={{ width: `${navIconSize}px`, height: `${navIconSize}px` }} strokeWidth={2.5} />
      </button>
    </>
  );
}
