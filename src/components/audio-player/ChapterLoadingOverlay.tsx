// src/components/audio-player/ChapterLoadingOverlay.tsx
// Chapter audio generation widget. Two states:
//  - Expanded: centered modal with progress + start-listening button (default)
//  - Minimized: small bottom-right pill that persists across navigation, so the
//    user can read or browse elsewhere while generation runs in the background.
"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2, Play, AlertCircle, Minus, Maximize2, X, Check } from "lucide-react";
import { t } from "@/lib/t";
import { getNavigationUrl } from "@/utils/storyNavigation";
import { useAudioPlayer } from "@/contexts/audio-player";
import type { Language } from "@/types/i18n";
import type { StoryType } from "@/types/story";

/** Return the appropriate dictionary keys for section label and line unit. */
function getLoadingLabelKeys(storyType: StoryType | undefined) {
  switch (storyType) {
    case "poem":
    case "song-lyrics":
    case "epic":
      return { sectionKey: "collection", lineUnitKey: "line" } as const;
    case "novel":
      return { sectionKey: "chapter", lineUnitKey: "paragraph" } as const;
    default:
      return { sectionKey: "chapter", lineUnitKey: "line" } as const;
  }
}

/** Resolve translated loading labels for a given story type. */
function getLoadingLabels(storyType: StoryType | undefined, lng: Language = "en") {
  const { sectionKey, lineUnitKey } = getLoadingLabelKeys(storyType);
  return {
    sectionLabel: t(lng, "audioPlayer", sectionKey),
    lineUnit: t(lng, "audioPlayer", lineUnitKey),
  };
}

interface NavTarget {
  storySlug: string;
  level: string;
  chapter: number;
  page: number;
  isUserStory: boolean;
  userStoryId?: string;
}

interface ChapterLoadingOverlayProps {
  chapterNumber: number;
  progress: { sentencesComplete: number; sentencesTotal: number } | null;
  storyType?: StoryType;
  isReady?: boolean;
  isError?: boolean;
  lng: Language;
  onStartListening: () => void;
  onCancel: () => void;
  /** Override the title — e.g. "Preparing Slow Mode". Falls back to default section label. */
  label?: string | null;
  /** Where the audio belongs. Used to route the user back if they navigated away while minimized. */
  navTarget: NavTarget;
}

export default function ChapterLoadingOverlay({
  chapterNumber, progress, storyType, isReady = false, isError = false, lng, onStartListening, onCancel, label, navTarget,
}: ChapterLoadingOverlayProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  // When the bottom AudioPlayerBar is showing, lift the minimized pill above it.
  const { state: audioState } = useAudioPlayer();
  const minimizedBottomClass = audioState.isVisible ? "bottom-24 md:bottom-20" : "bottom-4";

  const pct = progress && progress.sentencesTotal > 0
    ? Math.round((progress.sentencesComplete / progress.sentencesTotal) * 100)
    : 0;

  const { sectionLabel, lineUnit } = getLoadingLabels(storyType, lng);

  const targetUrl = getNavigationUrl(
    lng, navTarget.storySlug, navTarget.level,
    navTarget.chapter, navTarget.page,
    navTarget.isUserStory, navTarget.userStoryId,
  );
  const onTargetPage = pathname === targetUrl;

  // Start listening — if user has navigated away from the story page, route back first.
  const handleStartListening = () => {
    if (!onTargetPage) router.push(targetUrl);
    onStartListening();
  };

  // ============================================================================
  // ERROR — stays modal regardless of minimized state (error is rare, demands attention)
  // ============================================================================
  if (isError) {
    if (isMinimized) {
      return (
        <button
          onClick={() => setIsMinimized(false)}
          className={`fixed ${minimizedBottomClass} right-4 z-[60] flex items-center gap-2 px-4 py-2.5 bg-white rounded-full shadow-lg border border-red-100 hover:shadow-xl transition-shadow`}
          aria-label={t(lng, "audioPlayer", "errorTitle")}
        >
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-sm font-medium text-gray-900">{t(lng, "audioPlayer", "errorTitle")}</span>
        </button>
      );
    }
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="relative bg-white rounded-2xl shadow-xl px-8 py-6 max-w-sm w-full mx-4 text-center">
          <button
            onClick={() => setIsMinimized(true)}
            className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Minimize"
          >
            <Minus className="w-4 h-4" />
          </button>
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t(lng, "audioPlayer", "errorTitle")}
          </h3>
          <p className="text-base text-gray-600 leading-relaxed mb-6">
            {t(lng, "audioPlayer", "errorMessage")}
          </p>
          <button
            onClick={onCancel}
            className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors"
          >
            {t(lng, "audioPlayer", "errorClose")}
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MINIMIZED — bottom-right pill, persists while user reads/navigates
  // ============================================================================
  if (isMinimized) {
    // Ready state: show check + tap-to-listen (routes back if needed)
    if (isReady) {
      return (
        <div className={`fixed ${minimizedBottomClass} right-4 z-[60] flex items-center gap-2 bg-white rounded-full shadow-lg border border-green-100 overflow-hidden`}>
          <button
            onClick={handleStartListening}
            className="flex items-center gap-2 pl-3 pr-2 py-2 hover:bg-green-50 transition-colors"
            aria-label={t(lng, "audioPlayer", "startListening")}
          >
            <Check className="w-4 h-4 text-green-500" />
            <span className="text-sm font-medium text-gray-900">{t(lng, "audioPlayer", "startListening")}</span>
            <Play className="w-3.5 h-3.5 text-indigo-600 ml-1" fill="currentColor" />
          </button>
          <button
            onClick={onCancel}
            className="px-2 py-2 text-gray-300 hover:text-gray-500 transition-colors border-l border-gray-100"
            aria-label={t(lng, "audioPlayer", "cancel")}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    // Generating state: show progress %
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className={`fixed ${minimizedBottomClass} right-4 z-[60] flex items-center gap-2.5 pl-3 pr-3 py-2 bg-white rounded-full shadow-lg border border-gray-100 hover:shadow-xl transition-shadow group`}
        aria-label="Expand audio generation status"
      >
        <Loader2 className="w-4 h-4 text-indigo-500 animate-spin flex-shrink-0" />
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          {progress ? (
            <span className="text-xs font-medium text-gray-700 tabular-nums">{pct}%</span>
          ) : (
            <span className="text-xs font-medium text-gray-700">…</span>
          )}
        </div>
        <Maximize2 className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 transition-colors" />
      </button>
    );
  }

  // ============================================================================
  // EXPANDED — centered modal (default state)
  // ============================================================================
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-xl px-8 py-6 max-w-sm w-full mx-4 text-center">
        {/* Minimize button — top right */}
        <button
          onClick={() => setIsMinimized(true)}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Minimize"
        >
          <Minus className="w-4 h-4" />
        </button>

        {/* Header */}
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {label || `${t(lng, "audioPlayer", "preparing")} ${sectionLabel} ${chapterNumber}`}
        </h3>

        {/* Progress bar + line counter */}
        {progress ? (
          <>
            <p className="text-sm text-gray-500 mb-2">
              {lineUnit} {progress.sentencesComplete}/{progress.sentencesTotal}
            </p>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-indigo-500 rounded-full transition-[width] duration-300 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500 mb-4">{t(lng, "audioPlayer", "checkingCache")}</p>
        )}

        {/* First-generation message */}
        {progress && (
          <div className="text-base text-gray-900 leading-relaxed mb-4 space-y-5">
            <p>{t(lng, "audioPlayer", "firstGenLine1", { section: sectionLabel.toLowerCase() })}</p>
            <p>{t(lng, "audioPlayer", "firstGenLine2")}</p>
            <p>{t(lng, "audioPlayer", "firstGenLine3")}</p>
          </div>
        )}

        {/* Bottom row: cancel left, spinner or start listening right */}
        <div className="flex items-center justify-between">
          <button
            onClick={onCancel}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            {t(lng, "audioPlayer", "cancel")}
          </button>
          {isReady ? (
            <button
              onClick={handleStartListening}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-full hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-colors"
            >
              <Play className="w-4 h-4" fill="currentColor" />
              {t(lng, "audioPlayer", "startListening")}
            </button>
          ) : (
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
          )}
        </div>
      </div>
    </div>
  );
}

export { getLoadingLabels };
