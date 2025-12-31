// src/components/LevelUnavailablePage.tsx
"use client";

import Link from "next/link";
import { Badge } from "@/components/ui";
import { t } from "@/lib/t";
import { toCEFR } from "@/lib/stories";
import type { Language } from "@/types/i18n";

interface LevelUnavailablePageProps {
  storySlug: string;
  storyTitle: string;
  availableLevels: string[];
  requestedLevel: string;
  lng: Language;
}

export default function LevelUnavailablePage({
  storySlug,
  storyTitle,
  availableLevels,
  requestedLevel,
  lng,
}: LevelUnavailablePageProps) {
  // Convert to CEFR for display
  const requestedCEFR = toCEFR(requestedLevel);

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
              {requestedCEFR}
            </span>
          </p>
        </div>

        {/* Available Levels */}
        <div className="mb-8">
          <p className="text-sm font-medium text-gray-700 mb-3">
            {t(lng, "story", "selectLevel")}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {availableLevels.map((lvl) => {
              const levelNum = lvl.replace("l", "");
              const badgeLevel = `level${levelNum}` as
                | "level1"
                | "level2"
                | "level3"
                | "level4"
                | "level5";
              const cefrLevel = toCEFR(lvl);

              return (
                <Link
                  key={lvl}
                  href={`/${lng}/stories/${storySlug}/${cefrLevel}/1/1`}
                  className="transform hover:scale-105 transition-transform"
                >
                  <Badge level={badgeLevel}>
                    {cefrLevel}
                  </Badge>
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
