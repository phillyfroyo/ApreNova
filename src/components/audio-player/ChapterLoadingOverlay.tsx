// src/components/audio-player/ChapterLoadingOverlay.tsx
"use client";

import { Loader2 } from "lucide-react";

interface ChapterLoadingOverlayProps {
  chapterNumber: number;
  progress: { sentencesComplete: number; sentencesTotal: number } | null;
  onCancel: () => void;
}

export default function ChapterLoadingOverlay({ chapterNumber, progress, onCancel }: ChapterLoadingOverlayProps) {
  const pct = progress && progress.sentencesTotal > 0
    ? Math.round((progress.sentencesComplete / progress.sentencesTotal) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl px-8 py-6 max-w-sm w-full mx-4 text-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          Preparing Chapter {chapterNumber}
        </h3>
        {progress ? (
          <>
            <p className="text-sm text-gray-500 mb-3">
              {progress.sentencesComplete} of {progress.sentencesTotal} sentences
            </p>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-indigo-500 rounded-full transition-[width] duration-300 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500 mb-4">Checking cache...</p>
        )}
        <button
          onClick={onCancel}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
