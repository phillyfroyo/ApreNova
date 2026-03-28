// src/components/audio-player/AudioPlayerBar.tsx
"use client";

import { useState, useRef } from "react";
import { useAudioPlayer } from "@/contexts/audio-player";
import { getContentSentences } from "@/contexts/audio-player";
import { useParams } from "next/navigation";
import { X } from "lucide-react";
import { t } from "@/lib/t";
import { STORY_METADATA } from "@/lib/stories";
import type { Language } from "@/types/i18n";
import TransportControls from "./TransportControls";
import SettingsControls from "./SettingsControls";
import ToastNotification from "./ToastNotification";
import ChapterLoadingOverlay, { getLoadingLabels } from "./ChapterLoadingOverlay";
import { useDragToMinimize } from "./useDragToMinimize";
import { useBottomNavDetection } from "./useBottomNavDetection";

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export default function AudioPlayerBar() {
  const {
    state, pausePlayback, resumePlayback, stopPlayback, toggleMode,
    skipForward, skipBack, nextPage, prevPage, setPlaybackRate, seekToTime,
  } = useAudioPlayer();
  const params = useParams();
  const lng = (params?.lng as Language) ?? "es";

  // Toast state
  const [langToast, setLangToast] = useState<"on" | "off" | null>(null);
  const [langToastFading, setLangToastFading] = useState(false);
  const langToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [speedToast, setSpeedToast] = useState<string | null>(null);
  const [speedToastFading, setSpeedToastFading] = useState(false);
  const speedToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { barRef, progress, isDragging, minimized, setMinimized, transitionClass } = useDragToMinimize();
  const hasBottomNav = useBottomNavDetection();

  if (!state.isVisible) return null;

  const { status, position, mode, currentPageSentences, highlightedSentenceIndex, playbackRate, playbackMode, chapterCurrentTime, chapterDuration } = state;

  const isChapterMode = playbackMode === "chapter";
  const storyMeta = position ? STORY_METADATA.find(s => s.slug === position.storySlug) : null;

  // Compute progress — time-based for chapter mode, sentence-based for legacy
  let progressBar: number;
  if (isChapterMode) {
    progressBar = chapterDuration > 0 ? (chapterCurrentTime / chapterDuration) * 100 : 0;
  } else {
    const contentSentences = getContentSentences(currentPageSentences);
    const totalSentences = contentSentences.length;
    const currentSentence = highlightedSentenceIndex !== null
      ? contentSentences.findIndex(e => e.originalIndex === highlightedSentenceIndex) + 1
      : 0;
    progressBar = totalSentences > 0 ? (currentSentence / totalSentences) * 100 : 0;
  }

  // Format time as mm:ss
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Handle seekable progress bar click
  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isChapterMode || chapterDuration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekToTime(fraction * chapterDuration);
  };

  const handlePlayPause = () => {
    if (status === "playing") pausePlayback();
    else if (status === "paused") resumePlayback();
  };

  const statusLabel = (() => {
    switch (status) {
      case "loading": return t(lng, "stories", "loading");
      case "generating": {
        const p = state.chapterGenerationProgress;
        const { sectionLabel, lineUnit } = getLoadingLabels(storyMeta?.type, lng);
        const section = position ? `${sectionLabel} ${position.chapter}` : sectionLabel;
        const preparing = t(lng, "audioPlayer", "preparing");
        return p ? `${preparing} ${section} | ${lineUnit} ${p.sentencesComplete}/${p.sentencesTotal}` : `${preparing} ${section}...`;
      }
      case "ready": return t(lng, "audioPlayer", "startListening");
      case "navigating": return t(lng, "audioPlayer", "turningPage");
      case "finished": return t(lng, "audioPlayer", "storyComplete");
      case "error": return state.error || "Error";
      default: return position?.storyTitle || "";
    }
  })();

  const positionLabel = (() => {
    if (!position) return "";
    const base = `Ch ${position.chapter} · Page ${position.page}`;
    if (isChapterMode && chapterDuration > 0) {
      return `${base} · ${formatTime(chapterCurrentTime)} / ${formatTime(chapterDuration)}`;
    }
    return base;
  })();
  const isTransport = status !== "finished";
  const transportDisabled = status === "loading" || status === "navigating" || status === "generating" || status === "ready";

  const handleClick = () => {
    setMinimized(prev => !prev);
  };

  const handleSpeedToggle = () => {
    const newSpeed = playbackRate === 1.0 ? 0.7 : 1.0;
    setPlaybackRate(newSpeed);
    setSpeedToast(newSpeed === 1.0 ? '1x' : '0.7x');
    setSpeedToastFading(false);
    if (speedToastTimer.current) clearTimeout(speedToastTimer.current);
    speedToastTimer.current = setTimeout(() => {
      setSpeedToastFading(true);
      setTimeout(() => { setSpeedToast(null); setSpeedToastFading(false); }, 300);
    }, 2200);
  };

  const handleLangToggle = () => {
    toggleMode();
    const newMode = mode === "bilingual" ? "off" : "on";
    setLangToast(newMode);
    setLangToastFading(false);
    if (langToastTimer.current) clearTimeout(langToastTimer.current);
    langToastTimer.current = setTimeout(() => {
      setLangToastFading(true);
      setTimeout(() => { setLangToast(null); setLangToastFading(false); }, 300);
    }, 2200);
  };

  // Interpolated sizes for mobile drag animation
  const mobileSizes = {
    playBtnSize: lerp(56, 40, progress),
    playIconSize: lerp(24, 20, progress),
    navBtnSize: lerp(40, 32, progress),
    navIconSize: lerp(20, 16, progress),
    transitionClass,
  };
  const controlGap = lerp(12, 8, progress);
  const controlPyTop = lerp(8, 4, progress);
  const controlPyBottom = lerp(8, 14, progress);
  const fadeOut = 1 - Math.min(1, progress * 2.5);
  const fadeIn = Math.max(0, (progress - 0.5) * 2);

  return (
    <>
      {/* Chapter generation loading overlay — shown during generation, ready, or error */}
      {(status === "generating" || status === "ready" || status === "error") && position && (
        <ChapterLoadingOverlay
          chapterNumber={position.chapter}
          progress={state.chapterGenerationProgress}
          storyType={storyMeta?.type}
          isReady={status === "ready"}
          isError={status === "error"}
          lng={lng}
          onStartListening={resumePlayback}
          onCancel={stopPlayback}
        />
      )}

      {/* Spacer to prevent content from being hidden behind the bar on mobile */}
      <div
        className={`md:hidden ${transitionClass}`}
        style={{ height: `${lerp(240, 72, progress)}px` }}
      />

      <div
        ref={barRef}
        data-audio-player-bar
        className={`fixed left-0 right-0 z-[55] backdrop-blur-xl border-t border-white/50 rounded-t-[36px] md:rounded-none touch-none
          ${hasBottomNav ? 'bottom-16' : 'bottom-0'} md:bottom-0`}
        style={{ backgroundColor: `rgba(255, 255, 255, ${lerp(0.7, 0.25, progress)})` }}
      >
        {/* Drag handle — tap to toggle (mobile only) */}
        <div
          className={`md:hidden flex justify-center items-center cursor-pointer select-none ${transitionClass}`}
          style={{ paddingTop: '8px', paddingBottom: `${lerp(12, 4, progress)}px` }}
          onClick={handleClick}
        >
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Speed toast */}
        <ToastNotification
          visible={!!speedToast}
          fading={speedToastFading}
          badge={speedToast || ''}
          badgeColor="bg-indigo-500 text-white"
          label={t(lng, "audioPlayer", "playbackSpeed")}
        />

        {/* Language toast */}
        <ToastNotification
          visible={!!langToast}
          fading={langToastFading}
          badge={langToast === "on" ? t(lng, "audioPlayer", "on") : t(lng, "audioPlayer", "off")}
          badgeColor={langToast === "on" ? "bg-indigo-500 text-white" : "bg-gray-600 text-gray-300"}
          label={t(lng, "audioPlayer", "readBothLanguages")}
        />

        {/* ============================================================ */}
        {/* MOBILE LAYOUT                                                */}
        {/* ============================================================ */}

        {/* Title + progress bar — fades out as we minimize */}
        <div
          className={`md:hidden overflow-hidden ${transitionClass}`}
          style={{ maxHeight: `${lerp(80, 0, progress)}px`, opacity: fadeOut }}
        >
          <div className="px-5 pt-2 pb-1">
            <div className="flex items-center gap-3">
              {storyMeta?.image && (
                <img src={storyMeta.image} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900 truncate leading-tight">{statusLabel}</h3>
                {positionLabel && status !== "finished" && (
                  <p className="text-sm text-gray-500 mt-0.5">{positionLabel}</p>
                )}
              </div>
            </div>
            <div className="mt-3">
              <div
                className={`w-full h-1 bg-gray-300 rounded-full overflow-hidden ${isChapterMode ? "cursor-pointer" : ""}`}
                onClick={handleProgressBarClick}
              >
                <div className="h-full bg-indigo-500 rounded-full transition-[width] duration-300 ease-out" style={{ width: `${progressBar}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Transport controls — single row, sizes interpolate (mobile) */}
        {isTransport && (
          <div
            className={`md:hidden relative flex items-center justify-center ${transitionClass}`}
            style={{ gap: `${controlGap}px`, paddingTop: `${controlPyTop}px`, paddingBottom: `${controlPyBottom}px` }}
          >
            <TransportControls
              status={status}
              transportDisabled={transportDisabled}
              onPlayPause={handlePlayPause}
              onSkipBack={skipBack}
              onSkipForward={skipForward}
              onPrevPage={prevPage}
              onNextPage={nextPage}
              variant="mobile"
              sizes={mobileSizes}
            />
            {/* Close button — fades in when minimized */}
            <button
              onClick={stopPlayback}
              className={`absolute right-4 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-900 ${transitionClass}`}
              style={{ opacity: fadeIn, pointerEvents: progress > 0.5 ? 'auto' : 'none' }}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Bottom row: Settings — fades out (mobile) */}
        <div
          className={`md:hidden overflow-hidden ${transitionClass}`}
          style={{ maxHeight: `${lerp(56, 0, progress)}px`, opacity: fadeOut }}
        >
          <SettingsControls
            lng={lng}
            playbackRate={playbackRate}
            isBilingual={mode === "bilingual"}
            onSpeedToggle={handleSpeedToggle}
            onLangToggle={handleLangToggle}
            onClose={stopPlayback}
            variant="mobile"
          />
        </div>

        {/* ============================================================ */}
        {/* DESKTOP LAYOUT — single row                                  */}
        {/* ============================================================ */}
        <div className="hidden md:block">
          {/* Progress bar — thin line across top */}
          <div
            className={`w-full h-0.5 bg-gray-200 ${isChapterMode ? "cursor-pointer hover:h-1 transition-all" : ""}`}
            onClick={handleProgressBarClick}
          >
            <div className="h-full bg-indigo-500 transition-[width] duration-300 ease-out" style={{ width: `${progressBar}%` }} />
          </div>

          {isTransport ? (
            <div className="flex items-center px-6 py-2">
              {/* Left: Thumbnail + Title + position */}
              <div className="flex-1 min-w-0 flex items-center gap-3">
                {storyMeta?.image && (
                  <img src={storyMeta.image} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 truncate leading-tight">{statusLabel}</h3>
                  {positionLabel && (
                    <p className="text-xs text-gray-500 mt-0.5">{positionLabel}</p>
                  )}
                </div>
              </div>

              {/* Center: Transport controls */}
              <TransportControls
                status={status}
                transportDisabled={transportDisabled}
                onPlayPause={handlePlayPause}
                onSkipBack={skipBack}
                onSkipForward={skipForward}
                onPrevPage={prevPage}
                onNextPage={nextPage}
                variant="desktop"
              />

              {/* Right: Settings */}
              <SettingsControls
                lng={lng}
                playbackRate={playbackRate}
                isBilingual={mode === "bilingual"}
                onSpeedToggle={handleSpeedToggle}
                onLangToggle={handleLangToggle}
                onClose={stopPlayback}
                variant="desktop"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center px-6 py-4">
              <h3 className="text-sm font-semibold text-gray-900">{statusLabel}</h3>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
