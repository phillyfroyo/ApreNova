// src/components/AudioPlayerBar.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAudioPlayer, AVAILABLE_VOICES, AVAILABLE_SPEEDS } from "@/contexts/AudioPlayerContext";
import { Pause, Play, X, Loader2, Languages, SkipBack, SkipForward, ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { useParams } from "next/navigation";
import { t } from "@/lib/t";
import type { Language } from "@/types/i18n";

function getContentSentenceCount(sentences: any[]): number {
  return sentences.filter(line => {
    if (line.isStanzaBreak) return false;
    return (line.es && line.es.trim()) || (line.en && line.en.trim());
  }).length;
}

function getContentSentencePosition(sentences: any[], highlightIndex: number | null): number {
  if (highlightIndex === null) return 0;
  let pos = 0;
  for (let i = 0; i < sentences.length; i++) {
    const line = sentences[i];
    if (line.isStanzaBreak) continue;
    if (!((line.es && line.es.trim()) || (line.en && line.en.trim()))) continue;
    pos++;
    if (i === highlightIndex) return pos;
  }
  return 0;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

const DRAG_DISTANCE = 120; // px of drag to go from expanded to minimized

export default function AudioPlayerBar() {
  const {
    state, pausePlayback, resumePlayback, stopPlayback, toggleMode,
    skipForward, skipBack, nextPage, prevPage, setVoice, setPlaybackRate,
  } = useAudioPlayer();
  const params = useParams();
  const lng = (params?.lng as Language) ?? "es";

  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const [langToast, setLangToast] = useState<"on" | "off" | null>(null);
  const langToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Minimize state + drag
  const [minimized, setMinimized] = useState(false);
  const [dragProgress, setDragProgress] = useState<number | null>(null);
  const dragStartY = useRef<number | null>(null);
  const dragStartMinimized = useRef(false);
  const lastTouchY = useRef<number | null>(null);
  const lastTouchTime = useRef<number>(0);
  const velocityY = useRef<number>(0);
  const barRef = useRef<HTMLDivElement>(null);

  // progress: 0 = expanded, 1 = minimized
  const isDragging = dragProgress !== null;
  const progress = isDragging ? dragProgress : (minimized ? 1 : 0);

  // Register native touch handlers on the bar for live drag
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      dragStartY.current = e.touches[0].clientY;
      lastTouchY.current = e.touches[0].clientY;
      lastTouchTime.current = Date.now();
      velocityY.current = 0;
      dragStartMinimized.current = minimized;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (dragStartY.current === null) return;
      e.preventDefault();
      const now = Date.now();
      const currentY = e.touches[0].clientY;

      // Track velocity (px/ms, positive = downward)
      if (lastTouchY.current !== null) {
        const dt = now - lastTouchTime.current;
        if (dt > 0) {
          velocityY.current = (currentY - lastTouchY.current) / dt;
        }
      }
      lastTouchY.current = currentY;
      lastTouchTime.current = now;

      const delta = currentY - dragStartY.current;
      let p: number;
      if (dragStartMinimized.current) {
        p = Math.max(0, Math.min(1, 1 + delta / DRAG_DISTANCE));
      } else {
        p = Math.max(0, Math.min(1, delta / DRAG_DISTANCE));
      }
      setDragProgress(p);
    };

    const onTouchEnd = () => {
      if (dragStartY.current === null) return;
      dragStartY.current = null;

      if (dragProgress === null) return;

      // Flick detection: if velocity is fast enough, snap in that direction
      const FLICK_THRESHOLD = 0.3; // px/ms
      let shouldMinimize: boolean;
      if (Math.abs(velocityY.current) > FLICK_THRESHOLD) {
        shouldMinimize = velocityY.current > 0; // Flick down = minimize
      } else {
        shouldMinimize = dragProgress > 0.4; // Otherwise use position threshold
      }

      setMinimized(shouldMinimize);
      if (shouldMinimize) setShowSettings(false);
      setDragProgress(null);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [minimized, dragProgress]);

  // Detect if mobile bottom nav is present (story pages hide it)
  const [hasBottomNav, setHasBottomNav] = useState(false);
  useEffect(() => {
    const check = () => {
      const bottomNav = document.querySelector('nav.fixed.bottom-0');
      setHasBottomNav(!!bottomNav);
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  // Close settings when tapping outside
  useEffect(() => {
    if (!showSettings) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (settingsButtonRef.current?.contains(target)) return;
      if (settingsRef.current && !settingsRef.current.contains(target)) {
        setShowSettings(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSettings]);

  if (!state.isVisible) return null;

  const { status, position, mode, currentPageSentences, highlightedSentenceIndex, voiceSelection, playbackRate } = state;

  const totalSentences = getContentSentenceCount(currentPageSentences);
  const currentSentence = getContentSentencePosition(currentPageSentences, highlightedSentenceIndex);
  const progressBar = totalSentences > 0 ? (currentSentence / totalSentences) * 100 : 0;

  const handlePlayPause = () => {
    if (status === "playing") pausePlayback();
    else if (status === "paused") resumePlayback();
  };

  const statusLabel = (() => {
    switch (status) {
      case "loading": return t(lng, "stories", "loading");
      case "navigating": return t(lng, "audioPlayer", "turningPage");
      case "finished": return t(lng, "audioPlayer", "storyComplete");
      case "error": return state.error || "Error";
      default: return position?.storyTitle || "";
    }
  })();

  const positionLabel = position
    ? `Ch ${position.chapter} · Page ${position.page}`
    : "";

  const isTransport = status !== "finished";
  const transportDisabled = status === "loading" || status === "navigating";

  const handleClick = () => {
    setMinimized(prev => {
      if (!prev) setShowSettings(false);
      return !prev;
    });
  };

  // Transition class: only apply when NOT dragging (so snap animates but drag is instant)
  const transitionClass = isDragging ? '' : 'transition-all duration-300 ease-in-out';

  // Interpolated sizes
  const playBtnSize = lerp(56, 40, progress);    // 3.5rem → 2.5rem
  const playIconSize = lerp(24, 20, progress);   // 1.5rem → 1.25rem
  const navBtnSize = lerp(40, 32, progress);     // 2.5rem → 2rem
  const navIconSize = lerp(20, 16, progress);    // 1.25rem → 1rem
  const controlGap = lerp(12, 8, progress);      // gap-3 → gap-2
  const controlPyTop = lerp(8, 4, progress);       // top padding shrinks when minimized
  const controlPyBottom = lerp(8, 14, progress);   // more bottom padding when minimized

  // Fading sections
  const fadeOut = 1 - Math.min(1, progress * 2.5);  // Fades out by ~40% progress
  const fadeIn = Math.max(0, (progress - 0.5) * 2); // Fades in after 50% progress

  return (
    <>
      {/* Spacer to prevent content from being hidden behind the bar on mobile */}
      <div
        className={`md:hidden ${transitionClass}`}
        style={{ height: `${lerp(240, 72, progress)}px` }}
      />

      <div
        ref={barRef}
        data-audio-player-bar
        className={`fixed left-0 right-0 z-[55] backdrop-blur-xl border-t border-white/50 rounded-t-[36px] touch-none
          ${hasBottomNav ? 'bottom-16' : 'bottom-0'} md:bottom-0`}
        style={{ backgroundColor: `rgba(255, 255, 255, ${lerp(0.7, 0.25, progress)})` }}
      >
        {/* Drag handle — tap to toggle */}
        <div
          className={`flex justify-center items-center cursor-pointer select-none ${transitionClass}`}
          style={{ paddingTop: '8px', paddingBottom: `${lerp(12, 4, progress)}px` }}
          onClick={handleClick}
        >
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Settings popup (above the player) — only when expanded */}
        {progress < 0.5 && showSettings && (
          <div
            ref={settingsRef}
            className="absolute bottom-full mb-2.5 left-2.5 right-2.5 md:left-auto md:right-2.5 md:w-auto bg-white border border-gray-200 shadow-lg rounded-xl px-4 py-3"
          >
            <div className="max-w-md mx-auto space-y-3">
              {/* Playback speed */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {t(lng, "audioPlayer", "playbackSpeed")}
                </h4>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {AVAILABLE_SPEEDS.map(speed => (
                    <button
                      key={speed}
                      onClick={() => setPlaybackRate(speed)}
                      className={`flex-shrink-0 px-2.5 py-1.5 rounded-md text-sm transition-colors
                        ${playbackRate === speed
                          ? 'bg-indigo-100 text-indigo-700 font-medium'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                      {speed === 1.0 ? '1x' : `${speed}x`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Voice selection */}
              <div className="grid grid-cols-2 gap-4">
                {/* English voices */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    {t(lng, "audioPlayer", "english")}
                  </h4>
                  <div className="space-y-1">
                    {AVAILABLE_VOICES['en-US'].map(voice => (
                      <button
                        key={voice.id}
                        onClick={() => setVoice('en-US', voice.id)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm transition-colors
                          ${voiceSelection['en-US'] === voice.id
                            ? 'bg-indigo-100 text-indigo-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-100'
                          }`}
                      >
                        {voice.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Spanish voices */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    {t(lng, "audioPlayer", "spanish")}
                  </h4>
                  <div className="space-y-1">
                    {AVAILABLE_VOICES['es-ES'].map(voice => (
                      <button
                        key={voice.id}
                        onClick={() => setVoice('es-ES', voice.id)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm transition-colors
                          ${voiceSelection['es-ES'] === voice.id
                            ? 'bg-indigo-100 text-indigo-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-100'
                          }`}
                      >
                        {voice.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Language toggle toast — positioned above the player */}
        {langToast && (
          <div className="absolute bottom-full mb-2 left-0 right-0 flex justify-center pointer-events-none z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900/85 text-white text-xs font-medium shadow-lg">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide
                ${langToast === "on" ? "bg-indigo-500 text-white" : "bg-gray-600 text-gray-300"}`}>
                {langToast === "on" ? "ON" : "OFF"}
              </span>
              {t(lng, "audioPlayer", "readBothLanguages")}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TITLE + PROGRESS BAR — fades out as we minimize              */}
        {/* ============================================================ */}
        <div
          className={`overflow-hidden ${transitionClass}`}
          style={{
            maxHeight: `${lerp(80, 0, progress)}px`,
            opacity: fadeOut,
          }}
        >
          <div className="px-5 pt-2 pb-1">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900 truncate leading-tight">
                  {statusLabel}
                </h3>
                {positionLabel && status !== "finished" && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    {positionLabel}
                  </p>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-3">
              <div className="w-full h-1 bg-gray-300 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-[width] duration-500 ease-out"
                  style={{ width: `${progressBar}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* TRANSPORT CONTROLS — single row, sizes interpolate           */}
        {/* ============================================================ */}
        {isTransport && (
          <div
            className={`relative flex items-center justify-center ${transitionClass}`}
            style={{ gap: `${controlGap}px`, paddingTop: `${controlPyTop}px`, paddingBottom: `${controlPyBottom}px` }}
          >
            {/* Prev page */}
            <button
              onClick={prevPage}
              disabled={transportDisabled}
              className={`flex items-center justify-center rounded-full
                text-gray-600 hover:text-gray-900 hover:bg-gray-200/50
                disabled:text-gray-300 disabled:hover:bg-transparent ${transitionClass}`}
              style={{ width: `${navBtnSize}px`, height: `${navBtnSize}px` }}
              aria-label="Previous page"
            >
              <ChevronLeft style={{ width: `${navIconSize}px`, height: `${navIconSize}px` }} strokeWidth={2.5} />
            </button>

            {/* Prev sentence */}
            <button
              onClick={skipBack}
              disabled={transportDisabled}
              className={`flex items-center justify-center rounded-full
                text-gray-600 hover:text-gray-900 hover:bg-gray-200/50
                disabled:text-gray-300 disabled:hover:bg-transparent ${transitionClass}`}
              style={{ width: `${navBtnSize}px`, height: `${navBtnSize}px` }}
              aria-label="Previous sentence"
            >
              <SkipBack style={{ width: `${navIconSize}px`, height: `${navIconSize}px` }} fill="currentColor" />
            </button>

            {/* Play / Pause */}
            <button
              onClick={handlePlayPause}
              disabled={transportDisabled}
              className={`flex items-center justify-center rounded-full
                bg-indigo-600 text-white hover:bg-indigo-700
                disabled:bg-gray-300 disabled:cursor-default
                shadow-md shadow-indigo-200 ${transitionClass}`}
              style={{ width: `${playBtnSize}px`, height: `${playBtnSize}px` }}
              aria-label={status === "playing" ? "Pause" : "Play"}
            >
              {transportDisabled ? (
                <Loader2 style={{ width: `${playIconSize}px`, height: `${playIconSize}px` }} className="animate-spin" />
              ) : status === "playing" ? (
                <Pause style={{ width: `${playIconSize}px`, height: `${playIconSize}px` }} fill="currentColor" />
              ) : (
                <Play style={{ width: `${playIconSize}px`, height: `${playIconSize}px`, marginLeft: '2px' }} fill="currentColor" />
              )}
            </button>

            {/* Next sentence */}
            <button
              onClick={skipForward}
              disabled={transportDisabled}
              className={`flex items-center justify-center rounded-full
                text-gray-600 hover:text-gray-900 hover:bg-gray-200/50
                disabled:text-gray-300 disabled:hover:bg-transparent ${transitionClass}`}
              style={{ width: `${navBtnSize}px`, height: `${navBtnSize}px` }}
              aria-label="Next sentence"
            >
              <SkipForward style={{ width: `${navIconSize}px`, height: `${navIconSize}px` }} fill="currentColor" />
            </button>

            {/* Next page */}
            <button
              onClick={nextPage}
              disabled={transportDisabled}
              className={`flex items-center justify-center rounded-full
                text-gray-600 hover:text-gray-900 hover:bg-gray-200/50
                disabled:text-gray-300 disabled:hover:bg-transparent ${transitionClass}`}
              style={{ width: `${navBtnSize}px`, height: `${navBtnSize}px` }}
              aria-label="Next page"
            >
              <ChevronRight style={{ width: `${navIconSize}px`, height: `${navIconSize}px` }} strokeWidth={2.5} />
            </button>

            {/* Close button — fades in when minimized */}
            <button
              onClick={stopPlayback}
              className={`absolute right-4 w-8 h-8 flex items-center justify-center rounded-full
                text-gray-400 hover:text-gray-900 ${transitionClass}`}
              style={{
                opacity: fadeIn,
                pointerEvents: progress > 0.5 ? 'auto' : 'none',
              }}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* BOTTOM ROW: Settings, Language, Close — fades out            */}
        {/* ============================================================ */}
        <div
          className={`overflow-hidden ${transitionClass}`}
          style={{
            maxHeight: `${lerp(56, 0, progress)}px`,
            opacity: fadeOut,
          }}
        >
          <div className="flex pb-2 pt-2">
            {/* Settings */}
            <button
              ref={settingsButtonRef}
              onClick={() => setShowSettings(prev => !prev)}
              className={`flex-1 flex flex-col items-center gap-1 transition-colors
                ${showSettings
                  ? "text-indigo-600"
                  : "text-gray-500 hover:text-gray-900"
                }`}
              title="Voice settings"
            >
              <Settings className="w-[22px] h-[22px]" />
              <span className="text-[11px] font-medium">{t(lng, "audioPlayer", "settings")}</span>
            </button>

            {/* Language mode toggle */}
            <button
              onClick={() => {
                toggleMode();
                const newMode = mode === "bilingual" ? "off" : "on";
                setLangToast(newMode);
                if (langToastTimer.current) clearTimeout(langToastTimer.current);
                langToastTimer.current = setTimeout(() => setLangToast(null), 2500);
              }}
              className={`flex-1 flex flex-col items-center gap-1 transition-colors
                ${mode === "bilingual"
                  ? "text-indigo-600"
                  : "text-gray-500 hover:text-gray-900"
                }`}
            >
              <Languages className="w-[22px] h-[22px]" />
              <span className="text-[11px] font-medium">
                {t(lng, "audioPlayer", "languageToggle")}
              </span>
            </button>

            {/* Close */}
            <button
              onClick={stopPlayback}
              className="flex-1 flex flex-col items-center gap-1 text-gray-500 hover:text-gray-900 transition-colors"
              aria-label="Close"
            >
              <X className="w-[22px] h-[22px]" />
              <span className="text-[11px] font-medium">{t(lng, "audioPlayer", "close")}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
