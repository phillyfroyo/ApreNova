// src/components/user-stories/ChapterPendingOverlay.tsx
// Shown when user navigates to a chapter that's still being processed

"use client";

import { useState, useEffect } from "react";
import type { Language } from "@/types/i18n";

interface ChapterPendingOverlayProps {
  currentChapter: number;
  completedChapters: number;
  totalChapters: number;
  onGoBack: () => void;
  lng: Language;
}

export default function ChapterPendingOverlay({
  currentChapter,
  completedChapters,
  totalChapters,
  onGoBack,
  lng,
}: ChapterPendingOverlayProps) {
  const [dots, setDots] = useState("");

  // Animated dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? "" : prev + ".");
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const isSpanish = lng === "es";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-950">
      <div className="text-center max-w-md px-6">
        {/* Animated processing icon */}
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-gray-700"></div>
          <div className="absolute inset-0 rounded-full border-4 border-cyan-500 border-t-transparent animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-cyan-400">{currentChapter}</span>
          </div>
        </div>

        {/* Message */}
        <h2 className="text-xl font-semibold text-white mb-2">
          {isSpanish
            ? `El capítulo ${currentChapter} se está procesando${dots}`
            : `Chapter ${currentChapter} is still processing${dots}`}
        </h2>

        <p className="text-gray-400 mb-6">
          {isSpanish
            ? `${completedChapters} de ${totalChapters} capítulos listos`
            : `${completedChapters} of ${totalChapters} chapters ready`}
        </p>

        {/* Progress bar */}
        <div className="w-full bg-gray-700 rounded-full h-2 mb-6">
          <div
            className="bg-cyan-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${(completedChapters / totalChapters) * 100}%` }}
          ></div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onGoBack}
            className="px-6 py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium"
          >
            {isSpanish
              ? `Volver al capítulo ${completedChapters}`
              : `Go back to chapter ${completedChapters}`}
          </button>
        </div>

        {/* Hint */}
        <p className="text-gray-500 text-sm mt-6">
          {isSpanish
            ? "Esta página se actualizará automáticamente cuando el capítulo esté listo"
            : "This page will update automatically when the chapter is ready"}
        </p>
      </div>
    </div>
  );
}
