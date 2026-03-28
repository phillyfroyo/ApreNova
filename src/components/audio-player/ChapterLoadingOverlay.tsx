// src/components/audio-player/ChapterLoadingOverlay.tsx
"use client";

import { Loader2, Play } from "lucide-react";
import { t } from "@/lib/t";
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

interface ChapterLoadingOverlayProps {
  chapterNumber: number;
  progress: { sentencesComplete: number; sentencesTotal: number } | null;
  storyType?: StoryType;
  isReady?: boolean;
  lng: Language;
  onStartListening: () => void;
  onCancel: () => void;
}

export default function ChapterLoadingOverlay({
  chapterNumber, progress, storyType, isReady = false, lng, onStartListening, onCancel,
}: ChapterLoadingOverlayProps) {
  const pct = progress && progress.sentencesTotal > 0
    ? Math.round((progress.sentencesComplete / progress.sentencesTotal) * 100)
    : 0;

  const { sectionLabel, lineUnit } = getLoadingLabels(storyType, lng);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl px-8 py-6 max-w-sm w-full mx-4 text-center">
        {/* Header */}
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {t(lng, "audioPlayer", "preparing")} {sectionLabel} {chapterNumber}
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
                style={{ width: `${isReady ? 100 : pct}%` }}
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500 mb-4">{t(lng, "audioPlayer", "checkingCache")}</p>
        )}

        {/* First-generation message */}
        {progress && (
          <div className="text-sm text-gray-400 leading-relaxed mb-4 space-y-3">
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
              onClick={onStartListening}
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
