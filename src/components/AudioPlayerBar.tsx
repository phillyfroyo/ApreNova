// src/components/AudioPlayerBar.tsx
"use client";

import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { Pause, Play, X, Loader2, Languages, Headphones } from "lucide-react";
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
  const { state, pausePlayback, resumePlayback, stopPlayback, toggleMode } = useAudioPlayer();
  const params = useParams();
  const lng = (params?.lng as Language) ?? "es";

  if (!state.isVisible) return null;

  const { status, position, mode, currentPageSentences, highlightedSentenceIndex } = state;

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

  return (
    <>
      {/* Spacer to prevent content from being hidden behind the bar on mobile */}
      <div className="md:hidden h-[60px]" />

      <div
        className="fixed left-0 right-0 z-[55] bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-lg
          bottom-16 md:bottom-0"
        style={{ height: 60 }}
      >
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gray-100">
          <div
            className="h-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center h-full px-3 gap-2">
          {/* Play/Pause button */}
          <button
            onClick={handlePlayPause}
            disabled={status === "loading" || status === "navigating" || status === "finished"}
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full
              bg-indigo-600 text-white hover:bg-indigo-700 transition-colors
              disabled:bg-gray-300 disabled:cursor-default"
            aria-label={status === "playing" ? "Pause" : "Play"}
          >
            {status === "loading" || status === "navigating" ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : status === "playing" ? (
              <Pause className="w-5 h-5" fill="currentColor" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
            )}
          </button>

          {/* Title + position */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">
              {statusLabel}
            </div>
            {positionLabel && status !== "finished" && (
              <div className="text-xs text-gray-500">
                {positionLabel}
                {totalSentences > 0 && ` · ${currentSentence}/${totalSentences}`}
              </div>
            )}
          </div>

          {/* Language mode toggle */}
          <button
            onClick={toggleMode}
            className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors
              ${mode === "bilingual"
                ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
              }`}
            title={mode === "bilingual"
              ? t(lng, "audioPlayer", "bilingual")
              : t(lng, "audioPlayer", "targetOnly")
            }
          >
            <Languages className="w-4 h-4" />
          </button>

          {/* Close button */}
          <button
            onClick={stopPlayback}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full
              text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}
