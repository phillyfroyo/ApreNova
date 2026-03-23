// src/components/AudioPlayerBar.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAudioPlayer, AVAILABLE_VOICES } from "@/contexts/AudioPlayerContext";
import { Pause, Play, X, Loader2, Languages, SkipBack, SkipForward, ChevronLeft, ChevronRight, Gauge, Turtle, Mic } from "lucide-react";
import { useParams } from "next/navigation";
import { t } from "@/lib/t";
import { STORY_METADATA } from "@/lib/stories";
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

  const [showVoice, setShowVoice] = useState(false);
  const voiceRef = useRef<HTMLDivElement>(null);
  const voiceButtonRef = useRef<HTMLButtonElement>(null);
  const [langToast, setLangToast] = useState<"on" | "off" | null>(null);
  const [langToastFading, setLangToastFading] = useState(false);
  const langToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [speedToast, setSpeedToast] = useState<string | null>(null);
  const [speedToastFading, setSpeedToastFading] = useState(false);
  const speedToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (shouldMinimize) setShowVoice(false);
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

  // Close voice popup when tapping outside
  useEffect(() => {
    if (!showVoice) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (voiceButtonRef.current?.contains(target)) return;
      if (voiceRef.current && !voiceRef.current.contains(target)) setShowVoice(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showVoice]);

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
      if (!prev) setShowVoice(false);
      return !prev;
    });
  };

  const handleSpeedToggle = () => {
    const newSpeed = playbackRate === 1.0 ? 0.7 : 1.0;
    setPlaybackRate(newSpeed);
    setShowVoice(false);
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

        {/* Voice popup (above the player) */}
        {progress < 0.5 && showVoice && (
          <div
            ref={voiceRef}
            className="absolute bottom-full mb-2.5 left-2.5 right-2.5 md:left-auto md:right-2.5 md:w-auto bg-white border border-gray-200 shadow-lg rounded-xl px-4 py-3"
          >
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
        )}

        {/* Speed toggle toast — positioned above the player */}
        {speedToast && (
          <div className={`absolute bottom-full mb-2 left-0 right-0 flex justify-center pointer-events-none z-10 transition-opacity duration-300 ${speedToastFading ? 'opacity-0' : 'opacity-100'}`}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900/85 text-white text-xs font-medium shadow-lg">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-indigo-500 text-white">
                {speedToast}
              </span>
              {t(lng, "audioPlayer", "playbackSpeed")}
            </div>
          </div>
        )}

        {/* Language toggle toast — positioned above the player */}
        {langToast && (
          <div className={`absolute bottom-full mb-2 left-0 right-0 flex justify-center pointer-events-none z-10 transition-opacity duration-300 ${langToastFading ? 'opacity-0' : 'opacity-100'}`}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900/85 text-white text-xs font-medium shadow-lg">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide
                ${langToast === "on" ? "bg-indigo-500 text-white" : "bg-gray-600 text-gray-300"}`}>
                {langToast === "on" ? t(lng, "audioPlayer", "on") : t(lng, "audioPlayer", "off")}
              </span>
              {t(lng, "audioPlayer", "readBothLanguages")}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MOBILE LAYOUT                                                */}
        {/* ============================================================ */}

        {/* TITLE + PROGRESS BAR — fades out as we minimize              */}
        <div
          className={`md:hidden overflow-hidden ${transitionClass}`}
          style={{
            maxHeight: `${lerp(80, 0, progress)}px`,
            opacity: fadeOut,
          }}
        >
          <div className="px-5 pt-2 pb-1">
            <div className="flex items-center gap-3">
              {(() => {
                const storyMeta = position ? STORY_METADATA.find(s => s.slug === position.storySlug) : null;
                return storyMeta?.image ? (
                  <img
                    src={storyMeta.image}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                  />
                ) : null;
              })()}
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

        {/* TRANSPORT CONTROLS — single row, sizes interpolate (mobile)  */}
        {isTransport && (
          <div
            className={`md:hidden relative flex items-center justify-center ${transitionClass}`}
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

        {/* BOTTOM ROW: Settings, Language, Close — fades out (mobile)   */}
        <div
          className={`md:hidden overflow-hidden ${transitionClass}`}
          style={{
            maxHeight: `${lerp(56, 0, progress)}px`,
            opacity: fadeOut,
          }}
        >
          <div className="flex pb-2 pt-2">
            {/* Speed toggle */}
            <button
              onClick={handleSpeedToggle}
              className="flex-1 flex flex-col items-center gap-1 text-gray-700 transition-colors"
              title="Toggle playback speed"
            >
              {playbackRate === 1.0
                ? <Gauge className="w-[22px] h-[22px]" />
                : <Turtle className="w-[22px] h-[22px]" />
              }
              <span className="text-[11px] font-medium">{t(lng, "audioPlayer", "speed")}</span>
            </button>

            {/* Voice */}
            <button
              ref={voiceButtonRef}
              onClick={() => setShowVoice(prev => !prev)}
              className="flex-1 flex flex-col items-center gap-1 text-gray-700 transition-colors"
              title="Voice selection"
            >
              <Mic className="w-[22px] h-[22px]" />
              <span className="text-[11px] font-medium">{t(lng, "audioPlayer", "voice")}</span>
            </button>

            {/* Language mode toggle */}
            <button
              onClick={handleLangToggle}
              className={`flex-1 flex flex-col items-center gap-1 transition-colors
                ${mode === "bilingual"
                  ? "text-indigo-600"
                  : "text-gray-700"
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
              className="flex-1 flex flex-col items-center gap-1 text-gray-700 transition-colors"
              aria-label="Close"
            >
              <X className="w-[22px] h-[22px]" />
              <span className="text-[11px] font-medium">{t(lng, "audioPlayer", "close")}</span>
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* DESKTOP LAYOUT — single row                                  */}
        {/* ============================================================ */}
        <div className="hidden md:block">
          {/* Progress bar — thin line across top */}
          <div className="w-full h-0.5 bg-gray-200">
            <div
              className="h-full bg-indigo-500 transition-[width] duration-500 ease-out"
              style={{ width: `${progressBar}%` }}
            />
          </div>

          {isTransport ? (
            <div className="flex items-center px-6 py-2">
              {/* Left: Thumbnail + Title + position */}
              <div className="flex-1 min-w-0 flex items-center gap-3">
                {(() => {
                  const storyMeta = position ? STORY_METADATA.find(s => s.slug === position.storySlug) : null;
                  return storyMeta?.image ? (
                    <img
                      src={storyMeta.image}
                      alt=""
                      className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : null;
                })()}
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 truncate leading-tight">
                    {statusLabel}
                  </h3>
                  {positionLabel && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {positionLabel}
                    </p>
                  )}
                </div>
              </div>

              {/* Center: Transport controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={prevPage}
                  disabled={transportDisabled}
                  className="w-9 h-9 flex items-center justify-center rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-200/50 disabled:text-gray-300 disabled:hover:bg-transparent transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
                </button>
                <button
                  onClick={skipBack}
                  disabled={transportDisabled}
                  className="w-9 h-9 flex items-center justify-center rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-200/50 disabled:text-gray-300 disabled:hover:bg-transparent transition-colors"
                  aria-label="Previous sentence"
                >
                  <SkipBack className="w-[18px] h-[18px]" fill="currentColor" />
                </button>
                <button
                  onClick={handlePlayPause}
                  disabled={transportDisabled}
                  className="w-11 h-11 flex items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-default shadow-md shadow-indigo-200 transition-colors"
                  aria-label={status === "playing" ? "Pause" : "Play"}
                >
                  {transportDisabled ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : status === "playing" ? (
                    <Pause className="w-5 h-5" fill="currentColor" />
                  ) : (
                    <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
                  )}
                </button>
                <button
                  onClick={skipForward}
                  disabled={transportDisabled}
                  className="w-9 h-9 flex items-center justify-center rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-200/50 disabled:text-gray-300 disabled:hover:bg-transparent transition-colors"
                  aria-label="Next sentence"
                >
                  <SkipForward className="w-[18px] h-[18px]" fill="currentColor" />
                </button>
                <button
                  onClick={nextPage}
                  disabled={transportDisabled}
                  className="w-9 h-9 flex items-center justify-center rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-200/50 disabled:text-gray-300 disabled:hover:bg-transparent transition-colors"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-5 h-5" strokeWidth={2.5} />
                </button>
              </div>

              {/* Right: Settings */}
              <div className="flex-1 flex items-center justify-end gap-1">
                <button
                  onClick={handleSpeedToggle}
                  className="h-9 px-3 flex items-center gap-1.5 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-200/50 transition-colors"
                  title="Toggle playback speed"
                >
                  {playbackRate === 1.0
                    ? <Gauge className="w-[18px] h-[18px]" />
                    : <Turtle className="w-[18px] h-[18px]" />
                  }
                  <span className="text-xs font-medium">{t(lng, "audioPlayer", "speed")}</span>
                </button>
                <button
                  ref={voiceButtonRef}
                  onClick={() => setShowVoice(prev => !prev)}
                  className="h-9 px-3 flex items-center gap-1.5 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-200/50 transition-colors"
                  title="Voice selection"
                >
                  <Mic className="w-[18px] h-[18px]" />
                  <span className="text-xs font-medium">{t(lng, "audioPlayer", "voice")}</span>
                </button>
                <button
                  onClick={handleLangToggle}
                  className={`h-9 px-3 flex items-center gap-1.5 rounded-full transition-colors
                    ${mode === "bilingual"
                      ? "text-indigo-600 hover:bg-indigo-50"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
                    }`}
                >
                  <Languages className="w-[18px] h-[18px]" />
                  <span className="text-xs font-medium">{t(lng, "audioPlayer", "languageToggle")}</span>
                </button>
                <button
                  onClick={stopPlayback}
                  className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-200/50 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
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
