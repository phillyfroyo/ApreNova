// src/components/LevelUnavailablePage.tsx
"use client";

import Link from "next/link";
import { t } from "@/lib/t";
import type { Language } from "@/types/i18n";
import { getCEFRLabel, type CEFRCode } from "@/lib/cefr";

interface LevelUnavailablePageProps {
  storySlug: string;
  storyTitle: string;
  availableLevels: string[]; // Now CEFR codes: A1, A2, B1, etc.
  requestedLevel: string; // CEFR code
  lng: Language;
}

// CEFR badge colors
const CEFR_BADGE_COLORS: Record<string, string> = {
  A1: "bg-green-100 text-green-800 border-green-200",
  A2: "bg-blue-100 text-blue-800 border-blue-200",
  B1: "bg-yellow-100 text-yellow-800 border-yellow-200",
  B2: "bg-orange-100 text-orange-800 border-orange-200",
  C1: "bg-purple-100 text-purple-800 border-purple-200",
  C2: "bg-red-100 text-red-800 border-red-200",
};

export default function LevelUnavailablePage({
  storySlug,
  storyTitle,
  availableLevels,
  requestedLevel,
  lng,
}: LevelUnavailablePageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        {/* Icon */}
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-amber-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-xl font-bold text-gray-900 mb-2">{storyTitle}</h1>

        {/* Message */}
        <p className="text-gray-600 mb-6">
          {t(lng, "story", "levelUnavailable")}
        </p>

        {/* Requested Level Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-500 mb-2">
            {lng === "es" ? "Nivel solicitado:" : "Requested level:"}{" "}
            <span className="font-semibold text-gray-700">
              {getCEFRLabel(requestedLevel as CEFRCode, lng)}
            </span>
          </p>
        </div>

        {/* Available Levels */}
        <div className="mb-8">
          <p className="text-sm font-medium text-gray-700 mb-3">
            {t(lng, "story", "selectLevel")}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {availableLevels.map((cefrLevel) => {
              const colorClass = CEFR_BADGE_COLORS[cefrLevel] || "bg-gray-100 text-gray-800 border-gray-200";

              return (
                <Link
                  key={cefrLevel}
                  href={`/${lng}/stories/${storySlug}/${cefrLevel}/1/1`}
                  className="transform hover:scale-105 transition-transform"
                >
                  <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border ${colorClass}`}>
                    {getCEFRLabel(cefrLevel as CEFRCode, lng)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Back to Stories */}
        <Link
          href={`/${lng}/stories`}
          className="text-amber-700 hover:text-amber-800 text-sm font-medium underline"
        >
          {lng === "es" ? "Volver a Historias" : "Back to Stories"}
        </Link>
      </div>
    </div>
  );
}
