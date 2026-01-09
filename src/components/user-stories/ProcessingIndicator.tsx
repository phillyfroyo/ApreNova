// src/components/user-stories/ProcessingIndicator.tsx
// Shows processing progress while reading a story that's still being processed
// Displayed as a small indicator in the corner of the reader

"use client";

import { useState, useEffect } from "react";
import type { Language } from "@/types/i18n";

interface ProcessingIndicatorProps {
  completedChapters: number;
  totalChapters: number;
  currentStage?: string;
  lng: Language;
}

export default function ProcessingIndicator({
  completedChapters,
  totalChapters,
  currentStage,
  lng,
}: ProcessingIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [dots, setDots] = useState("");

  const isSpanish = lng === "es";
  const progress = totalChapters > 0 ? (completedChapters / totalChapters) * 100 : 0;

  // Animated dots when processing
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? "" : prev + ".");
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Stage labels
  const getStageLabel = () => {
    switch (currentStage) {
      case "rewriting":
        return isSpanish ? "Adaptando" : "Adapting";
      case "translating":
        return isSpanish ? "Traduciendo" : "Translating";
      default:
        return isSpanish ? "Procesando" : "Processing";
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg
          bg-gray-800/90 backdrop-blur border border-gray-700
          hover:bg-gray-700/90 transition-all duration-200
          ${isExpanded ? "rounded-b-none" : ""}
        `}
      >
        {/* Spinning indicator */}
        <div className="relative w-5 h-5">
          <div className="absolute inset-0 rounded-full border-2 border-gray-600"></div>
          <div className="absolute inset-0 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin"></div>
        </div>

        {/* Compact progress text */}
        <span className="text-sm text-gray-300">
          {completedChapters}/{totalChapters}
        </span>

        {/* Expand icon */}
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="bg-gray-800/90 backdrop-blur border border-gray-700 border-t-0 rounded-b-lg shadow-lg p-3 min-w-[200px]">
          {/* Stage label */}
          <div className="text-xs text-cyan-400 mb-2">
            {getStageLabel()}{dots}
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-700 rounded-full h-1.5 mb-2">
            <div
              className="bg-cyan-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          {/* Detailed text */}
          <p className="text-xs text-gray-400">
            {isSpanish
              ? `${completedChapters} de ${totalChapters} capítulos listos`
              : `${completedChapters} of ${totalChapters} chapters ready`}
          </p>
        </div>
      )}
    </div>
  );
}
