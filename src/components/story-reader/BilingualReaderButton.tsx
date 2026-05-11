// src/components/story-reader/BilingualReaderButton.tsx
// Non-audio bilingual reading toggle. Renders both languages on the story page
// independent of audio state. Persists to localStorage via AudioPlayerProvider.
"use client";

import { Languages } from "lucide-react";
import { useAudioPlayer } from "@/contexts/audio-player";
import { t } from "@/lib/t";
import type { Language } from "@/types/i18n";

interface BilingualReaderButtonProps {
  typedLang: Language;
}

export default function BilingualReaderButton({ typedLang }: BilingualReaderButtonProps) {
  const { state, setBilingualReadingMode } = useAudioPlayer();
  const enabled = state.bilingualReadingMode;
  const label = t(typedLang, "audioPlayer", "languageToggle"); // "ES + EN" / "EN + ES"

  return (
    <button
      onClick={() => setBilingualReadingMode(!enabled)}
      aria-pressed={enabled}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${
        enabled
          ? "text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border-indigo-600"
          : "text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border-indigo-200"
      }`}
    >
      <Languages className="w-4 h-4" />
      {label}
    </button>
  );
}
