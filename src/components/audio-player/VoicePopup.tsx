// src/components/audio-player/VoicePopup.tsx
"use client";

import { useRef, useEffect } from "react";
import { AVAILABLE_VOICES } from "@/contexts/audio-player";
import type { VoiceSelection } from "@/contexts/audio-player";
import { t } from "@/lib/t";
import type { Language } from "@/types/i18n";

interface VoicePopupProps {
  lng: Language;
  voiceSelection: VoiceSelection;
  setVoice: (language: 'en-US' | 'es-ES', voiceId: string) => void;
  show: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

export default function VoicePopup({ lng, voiceSelection, setVoice, show, onClose, triggerRef }: VoicePopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popupRef.current && !popupRef.current.contains(target)) onClose();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [show, onClose, triggerRef]);

  if (!show) return null;

  return (
    <div
      ref={popupRef}
      className="absolute bottom-full mb-2.5 left-2.5 right-2.5 md:left-auto md:right-2.5 md:w-auto bg-white border border-gray-200 shadow-lg rounded-xl px-4 py-3"
    >
      <div className="grid grid-cols-2 gap-4">
        {(['en-US', 'es-ES'] as const).map(lang => (
          <div key={lang}>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {t(lng, "audioPlayer", lang === 'en-US' ? "english" : "spanish")}
            </h4>
            <div className="space-y-1">
              {AVAILABLE_VOICES[lang].map(voice => (
                <button
                  key={voice.id}
                  onClick={() => setVoice(lang, voice.id)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm transition-colors
                    ${voiceSelection[lang] === voice.id
                      ? 'bg-indigo-100 text-indigo-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                    }`}
                >
                  {voice.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
