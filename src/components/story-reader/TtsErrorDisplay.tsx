// src/components/story-reader/TtsErrorDisplay.tsx
"use client";

import Link from "next/link";
import { AlertCircle, X } from "lucide-react";
import { t } from "@/lib/t";
import type { Language } from "@/types/i18n";

interface TtsErrorDisplayProps {
  ttsAuthError: boolean;
  ttsError: string | null;
  typedLang: Language;
  setTtsAuthError: (val: boolean) => void;
  setTtsError: (val: string | null) => void;
}

export default function TtsErrorDisplay({
  ttsAuthError,
  ttsError,
  typedLang,
  setTtsAuthError,
  setTtsError,
}: TtsErrorDisplayProps) {
  return (
    <>
      {/* TTS Auth Error Display */}
      {ttsAuthError && (
        <div className="fixed top-16 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 z-50 bg-white text-black px-5 pt-3 pb-3 rounded-xl shadow-lg md:max-w-xl md:whitespace-nowrap">
          <button
            onClick={() => setTtsAuthError(false)}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-sm"
          >
            ✕
          </button>
          <div className="text-sm pr-6">
            <span className="text-gray-700">
              {t(typedLang, "translator", "audioSignInRequired")}{" "}
            </span>
            <Link
              href={`/${typedLang}/auth/login`}
              className="text-indigo-600 hover:underline font-medium"
            >
              {t(typedLang, "translator", "signIn")}
            </Link>
            <span className="text-gray-700"> {t(typedLang, "translator", "or")} </span>
            <Link
              href={`/${typedLang}/auth/signup`}
              className="text-indigo-600 hover:underline font-medium"
            >
              {t(typedLang, "translator", "createAccount")}
            </Link>
          </div>
        </div>
      )}

      {/* TTS Error Display - non-auth errors */}
      {ttsError && !ttsAuthError && (
        <div className="fixed top-16 left-4 right-4 z-50 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded flex items-center">
          <AlertCircle className="mr-2 h-5 w-5" />
          <span>{ttsError}</span>
          <button
            onClick={() => setTtsError(null)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
