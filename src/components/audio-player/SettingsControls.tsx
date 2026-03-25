// src/components/audio-player/SettingsControls.tsx
"use client";

import { Languages, Gauge, Turtle, X } from "lucide-react";
import { t } from "@/lib/t";
import type { Language } from "@/types/i18n";

interface SettingsControlsProps {
  lng: Language;
  playbackRate: number;
  isBilingual: boolean;
  onSpeedToggle: () => void;
  onLangToggle: () => void;
  onClose: () => void;
  /** "mobile" renders icon+label stacked; "desktop" renders inline with text */
  variant: "mobile" | "desktop";
}

export default function SettingsControls({
  lng, playbackRate, isBilingual, onSpeedToggle, onLangToggle, onClose, variant,
}: SettingsControlsProps) {
  if (variant === "desktop") {
    return (
      <div className="flex-1 flex items-center justify-end gap-1">
        <button onClick={onSpeedToggle} className="h-9 px-3 flex items-center gap-1.5 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-200/50 transition-colors" title="Toggle playback speed">
          {playbackRate === 1.0 ? <Gauge className="w-[18px] h-[18px]" /> : <Turtle className="w-[18px] h-[18px]" />}
          <span className="text-xs font-medium">{t(lng, "audioPlayer", "speed")}</span>
        </button>
        <button onClick={onLangToggle} className={`h-9 px-3 flex items-center gap-1.5 rounded-full transition-colors ${isBilingual ? "text-indigo-600 hover:bg-indigo-50" : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"}`}>
          <Languages className="w-[18px] h-[18px]" />
          <span className="text-xs font-medium">{t(lng, "audioPlayer", "languageToggle")}</span>
        </button>
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-200/50 transition-colors" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Mobile variant — stacked icon + label
  return (
    <div className="flex pb-2 pt-2">
      <button onClick={onSpeedToggle} className="flex-1 flex flex-col items-center gap-1 text-gray-700 transition-colors" title="Toggle playback speed">
        {playbackRate === 1.0 ? <Gauge className="w-[22px] h-[22px]" /> : <Turtle className="w-[22px] h-[22px]" />}
        <span className="text-[11px] font-medium">{t(lng, "audioPlayer", "speed")}</span>
      </button>
      <button onClick={onLangToggle} className={`flex-1 flex flex-col items-center gap-1 transition-colors ${isBilingual ? "text-indigo-600" : "text-gray-700"}`}>
        <Languages className="w-[22px] h-[22px]" />
        <span className="text-[11px] font-medium">{t(lng, "audioPlayer", "languageToggle")}</span>
      </button>
      <button onClick={onClose} className="flex-1 flex flex-col items-center gap-1 text-gray-700 transition-colors" aria-label="Close">
        <X className="w-[22px] h-[22px]" />
        <span className="text-[11px] font-medium">{t(lng, "audioPlayer", "close")}</span>
      </button>
    </div>
  );
}
