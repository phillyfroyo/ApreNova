// src/components/AudioPlayerBar.tsx
"use client";

import { useState, useEffect, useRef } from "react";
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
  const progress = totalSentences > 0 ? (currentSentence / totalSentences) * 100 : 0;

  const handlePlayPause = () => {
    if (status === "playing") {
      pausePlayback();
    } else if (status === "paused") {
      resumePlayback();
    }
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

  return (
    <>
      {/* Spacer to prevent content from being hidden behind the bar on mobile */}
      <div className="md:hidden h-[240px]" />

      <div
        data-audio-player-bar
        className={`fixed left-0 right-0 z-[55] bg-white/70 backdrop-blur-xl border-t border-white/50 rounded-t-2xl
          ${hasBottomNav ? 'bottom-16' : 'bottom-0'} md:bottom-0`}
      >
        {/* Settings popup (above the player) */}
        {showSettings && (
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
        {/* TOP ROW: Title + chapter info + close                        */}
        {/* ============================================================ */}
        <div className="px-5 pt-4 pb-1">
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
                className="h-full bg-indigo-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* MIDDLE ROW: Transport controls                               */}
        {/* ============================================================ */}
        {isTransport && (
          <div className="flex items-center justify-center py-2 gap-3">
            {/* Prev page */}
            <button
              onClick={prevPage}
              disabled={transportDisabled}
              className="w-10 h-10 flex items-center justify-center rounded-full
                text-gray-600 hover:text-gray-900 hover:bg-gray-200/50 transition-colors
                disabled:text-gray-300 disabled:hover:bg-transparent"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
            </button>

            {/* Prev sentence */}
            <button
              onClick={skipBack}
              disabled={transportDisabled}
              className="w-10 h-10 flex items-center justify-center rounded-full
                text-gray-600 hover:text-gray-900 hover:bg-gray-200/50 transition-colors
                disabled:text-gray-300 disabled:hover:bg-transparent"
              aria-label="Previous sentence"
            >
              <SkipBack className="w-5 h-5" fill="currentColor" />
            </button>

            {/* Play / Pause — larger */}
            <button
              onClick={handlePlayPause}
              disabled={transportDisabled}
              className="w-14 h-14 flex items-center justify-center rounded-full
                bg-indigo-600 text-white hover:bg-indigo-700 transition-colors
                disabled:bg-gray-300 disabled:cursor-default
                shadow-md shadow-indigo-200"
              aria-label={status === "playing" ? "Pause" : "Play"}
            >
              {transportDisabled ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : status === "playing" ? (
                <Pause className="w-6 h-6" fill="currentColor" />
              ) : (
                <Play className="w-6 h-6 ml-0.5" fill="currentColor" />
              )}
            </button>

            {/* Next sentence */}
            <button
              onClick={skipForward}
              disabled={transportDisabled}
              className="w-10 h-10 flex items-center justify-center rounded-full
                text-gray-600 hover:text-gray-900 hover:bg-gray-200/50 transition-colors
                disabled:text-gray-300 disabled:hover:bg-transparent"
              aria-label="Next sentence"
            >
              <SkipForward className="w-5 h-5" fill="currentColor" />
            </button>

            {/* Next page */}
            <button
              onClick={nextPage}
              disabled={transportDisabled}
              className="w-10 h-10 flex items-center justify-center rounded-full
                text-gray-600 hover:text-gray-900 hover:bg-gray-200/50 transition-colors
                disabled:text-gray-300 disabled:hover:bg-transparent"
              aria-label="Next page"
            >
              <ChevronRight className="w-5 h-5" strokeWidth={2.5} />
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* BOTTOM ROW: Settings, Language, Close                        */}
        {/* ============================================================ */}
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
    </>
  );
}
