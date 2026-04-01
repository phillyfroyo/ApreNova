// src/components/audio-player/SettingsPicker.tsx
"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { t } from "@/lib/t";
import type { Language } from "@/types/i18n";
import type { AudioLanguageMode, VariantCacheStatus } from "@/contexts/audio-player/types";

type VariantKey = "target-normal" | "target-slow" | "bilingual-normal" | "bilingual-slow";

interface Variant {
  key: VariantKey;
  titleKey: string;
  descKey: string;
  mode: AudioLanguageMode;
  speed: number;
  cached: boolean;
  estimateMs: number | null;
}

interface SettingsPickerProps {
  lng: Language;
  initialSpeed: number;
  initialMode: AudioLanguageMode;
  cacheStatus: VariantCacheStatus;
  onConfirm: (speed: number, mode: AudioLanguageMode) => void;
  onDismiss: () => void;
}

function getSelectedKey(mode: AudioLanguageMode, speed: number): VariantKey {
  if (mode === "bilingual") return speed === 0.7 ? "bilingual-slow" : "bilingual-normal";
  return speed === 0.7 ? "target-slow" : "target-normal";
}

/** Format milliseconds into a human-friendly string like "30s" or "1m 15s" */
function formatEstimate(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

export default function SettingsPicker({
  lng, initialSpeed, initialMode, cacheStatus, onConfirm, onDismiss,
}: SettingsPickerProps) {
  const [selected, setSelected] = useState<VariantKey>(getSelectedKey(initialMode, initialSpeed));

  const estimates = cacheStatus.estimates ?? {};

  const variants: Variant[] = [
    {
      key: "target-normal",
      titleKey: "variantStandard",
      descKey: "variantStandardDesc",
      mode: "target-only",
      speed: 1.0,
      cached: cacheStatus.target.normal,
      estimateMs: estimates.targetNormal ?? null,
    },
    {
      key: "target-slow",
      titleKey: "variantSlow",
      descKey: "variantSlowDesc",
      mode: "target-only",
      speed: 0.7,
      cached: cacheStatus.target.slow,
      estimateMs: estimates.targetSlow ?? null,
    },
    {
      key: "bilingual-normal",
      titleKey: "variantStandardBilingual",
      descKey: "variantStandardBilingualDesc",
      mode: "bilingual",
      speed: 1.0,
      cached: cacheStatus.bilingual.normal,
      estimateMs: estimates.bilingualNormal ?? null,
    },
    {
      key: "bilingual-slow",
      titleKey: "variantSlowBilingual",
      descKey: "variantSlowBilingualDesc",
      mode: "bilingual",
      speed: 0.7,
      cached: cacheStatus.bilingual.slow,
      estimateMs: estimates.bilingualSlow ?? null,
    },
  ];

  const selectedVariant = variants.find(v => v.key === selected)!;

  // Build the generation notice text
  const noticeText = (() => {
    if (selectedVariant.cached) return null;
    const base = t(lng, "audioPlayer", "requiresGeneration");
    if (selectedVariant.estimateMs) {
      const timeStr = formatEstimate(selectedVariant.estimateMs);
      return `${base} · ~${timeStr}`;
    }
    return base;
  })();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl px-6 py-6 max-w-sm w-full mx-4">
        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
          {t(lng, "audioPlayer", "audioSettings")}
        </h3>

        {/* Variant list */}
        <div className="flex flex-col gap-2">
          {variants.map((variant) => {
            const isSelected = selected === variant.key;
            return (
              <button
                key={variant.key}
                onClick={() => setSelected(variant.key)}
                className={`relative flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                  isSelected
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-gray-50"
                }`}
              >
                {/* Radio indicator */}
                <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  isSelected ? "border-indigo-500 bg-indigo-500" : "border-gray-300"
                }`}>
                  {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold leading-tight whitespace-nowrap ${isSelected ? "text-indigo-700" : "text-gray-800"}`}>
                      {t(lng, "audioPlayer", variant.titleKey)}
                    </p>
                    {variant.cached && (
                      <span className="flex items-center gap-0.5 text-[11px] font-medium text-green-600 bg-green-50 px-1.5 py-px rounded-full">
                        <Check className="w-2.5 h-2.5" />
                        {t(lng, "audioPlayer", "cached")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 whitespace-nowrap">
                    {t(lng, "audioPlayer", variant.descKey)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Generation notice + actions — single block so cached/uncached swaps atomically */}
        <div className="mt-5">
          <div className="h-5 flex items-center justify-center mb-3">
            <p className={`text-xs text-amber-600 ${selectedVariant.cached ? "invisible" : "visible"}`}>
              {noticeText || t(lng, "audioPlayer", "requiresGeneration")}
            </p>
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={onDismiss}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              {t(lng, "audioPlayer", "cancel")}
            </button>
            <button
              onClick={() => onConfirm(selectedVariant.speed, selectedVariant.mode)}
              className="min-w-[160px] inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-full hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-colors"
            >
              {selectedVariant.cached ? t(lng, "audioPlayer", "startListening") : t(lng, "audioPlayer", "startGenerating")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
