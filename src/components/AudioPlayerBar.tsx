// src/components/AudioPlayerBar.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useAudioPlayer, AVAILABLE_VOICES, AVAILABLE_SPEEDS, AVAILABLE_WORD_BREAKS } from "@/contexts/AudioPlayerContext";
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
    skipForward, skipBack, nextPage, prevPage, setVoice, setPlaybackRate, setWordBreak,
  } = useAudioPlayer();
  const params = useParams();
  const lng = (params?.lng as Language) ?? "es";

  const [showVoiceMenu, setShowVoiceMenu] = useState(false);
  const voiceMenuRef = useRef<HTMLDivElement>(null);
  const gearButtonRef = useRef<HTMLButtonElement>(null);

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

  // Close voice menu when tapping outside
  useEffect(() => {
    if (!showVoiceMenu) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (gearButtonRef.current?.contains(target)) return;
      if (voiceMenuRef.current && !voiceMenuRef.current.contains(target)) {
        setShowVoiceMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showVoiceMenu]);

  if (!state.isVisible) return null;

  const { status, position, mode, currentPageSentences, highlightedSentenceIndex, voiceSelection, playbackRate, wordBreakMs } = state;

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
    ? `Ch ${position.chapter} · P ${position.page}`
    : "";

  const isTransport = status !== "finished";
  const transportDisabled = status === "loading" || status === "navigating";

  return (
    <>
      {/* Spacer to prevent content from being hidden behind the bar on mobile */}
      <div className="md:hidden h-[90px]" />

      <div
        data-audio-player-bar
        className={`fixed left-0 right-0 z-[55] bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-lg
          ${hasBottomNav ? 'bottom-16' : 'bottom-0'} md:bottom-0`}
        style={{ height: 90 }}
      >
        {/* Voice selection menu (above the player bar) */}
        {showVoiceMenu && (
          <div
            ref={voiceMenuRef}
            className="absolute bottom-full mb-2.5 left-2.5 right-2.5 md:left-auto md:right-2.5 md:w-auto bg-white border border-gray-200 shadow-lg rounded-xl px-4 py-3"
          >
            <div className="max-w-md mx-auto space-y-3">
              {/* Playback speed */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {t(lng, "audioPlayer", "playbackSpeed")}
                </h4>
                <div className="flex gap-1.5 overflow-x-auto pb-2">
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

              {/* Word spacing */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {t(lng, "audioPlayer", "wordBreak")}
                </h4>
                <div className="flex gap-1.5 overflow-x-auto pb-2">
                  {AVAILABLE_WORD_BREAKS.map(ms => (
                    <button
                      key={ms}
                      onClick={() => setWordBreak(ms)}
                      className={`flex-shrink-0 px-2.5 py-1.5 rounded-md text-sm transition-colors
                        ${wordBreakMs === ms
                          ? 'bg-indigo-100 text-indigo-700 font-medium'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                      {ms === 0 ? 'Off' : `${ms}ms`}
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

        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gray-100">
          <div
            className="h-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Top row: title, position, voice settings, language toggle, close */}
        <div className="flex items-center h-[38px] px-3 gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">
              {statusLabel}
            </div>
          </div>

          {positionLabel && status !== "finished" && (
            <span className="text-xs text-gray-400 flex-shrink-0">
              {positionLabel}
              {totalSentences > 0 && ` · ${currentSentence}/${totalSentences}`}
            </span>
          )}

          {/* Voice settings */}
          <button
            ref={gearButtonRef}
            onClick={() => setShowVoiceMenu(prev => !prev)}
            className={`flex-shrink-0 px-2 py-1 rounded-md text-xs font-medium transition-colors
              ${showVoiceMenu
                ? "bg-indigo-100 text-indigo-700"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            title="Voice settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {/* Language mode toggle */}
          <button
            onClick={toggleMode}
            className={`flex-shrink-0 px-2 py-1 rounded-md text-xs font-medium transition-colors
              ${mode === "bilingual"
                ? "bg-indigo-100 text-indigo-700"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            title={mode === "bilingual"
              ? t(lng, "audioPlayer", "bilingual")
              : t(lng, "audioPlayer", "targetOnly")
            }
          >
            <Languages className="w-3.5 h-3.5" />
          </button>

          {/* Close */}
          <button
            onClick={stopPlayback}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full
              text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Bottom row: transport controls */}
        {isTransport && (
          <div className="flex items-center justify-center h-[48px] gap-1">
            {/* Prev page */}
            <button
              onClick={prevPage}
              disabled={transportDisabled}
              className="w-9 h-9 flex items-center justify-center rounded-full
                text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors
                disabled:text-gray-300 disabled:hover:bg-transparent"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
            </button>

            {/* Prev sentence */}
            <button
              onClick={skipBack}
              disabled={transportDisabled}
              className="w-9 h-9 flex items-center justify-center rounded-full
                text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors
                disabled:text-gray-300 disabled:hover:bg-transparent"
              aria-label="Previous sentence"
            >
              <SkipBack className="w-4 h-4" fill="currentColor" />
            </button>

            {/* Play / Pause */}
            <button
              onClick={handlePlayPause}
              disabled={transportDisabled}
              className="w-11 h-11 flex items-center justify-center rounded-full
                bg-indigo-600 text-white hover:bg-indigo-700 transition-colors
                disabled:bg-gray-300 disabled:cursor-default mx-1"
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

            {/* Next sentence */}
            <button
              onClick={skipForward}
              disabled={transportDisabled}
              className="w-9 h-9 flex items-center justify-center rounded-full
                text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors
                disabled:text-gray-300 disabled:hover:bg-transparent"
              aria-label="Next sentence"
            >
              <SkipForward className="w-4 h-4" fill="currentColor" />
            </button>

            {/* Next page */}
            <button
              onClick={nextPage}
              disabled={transportDisabled}
              className="w-9 h-9 flex items-center justify-center rounded-full
                text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors
                disabled:text-gray-300 disabled:hover:bg-transparent"
              aria-label="Next page"
            >
              <ChevronRight className="w-5 h-5" strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
