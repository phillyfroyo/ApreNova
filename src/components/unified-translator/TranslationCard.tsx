// src/components/unified-translator/TranslationCard.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { t } from "@/lib/t";
import type { Language } from "@/types/i18n";
import type { EnhancedTranslation } from "./types";
import VerbChart, { getPartOfSpeechLabel } from "./VerbChart";

interface TranslationCardProps {
  translations: string[];
  enhancedTranslation: EnhancedTranslation | null;
  loading: boolean;
  error: string;
  authError: boolean;
  currentLang: Language;
  showSpanishFirst: boolean;
  selectedText: string;
  onClose: () => void;
  tooltipRef: React.RefObject<HTMLDivElement | null>;
}

export default function TranslationCard({
  translations, enhancedTranslation, loading, error, authError,
  currentLang, showSpanishFirst, selectedText, onClose, tooltipRef,
}: TranslationCardProps) {
  const [visibleExamples, setVisibleExamples] = useState<Set<number>>(new Set());

  const toggleExample = (idx: number) => {
    setVisibleExamples(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div
      ref={tooltipRef}
      className="mt-1 bg-white text-black px-4 pt-3 pb-3 rounded-xl shadow z-50 relative w-[calc(100%+16px)] -ml-2"
      data-tooltip
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-sm"
        data-translation-control="close"
      >
        ✕
      </button>

      {authError && (
        <div className="text-sm pr-6">
          <span className="text-gray-700">{t(currentLang, "translator", "signInRequired")} </span>
          <Link href={`/${currentLang}/auth/login`} className="text-indigo-600 hover:underline font-medium">
            {t(currentLang, "translator", "signIn")}
          </Link>
          <span className="text-gray-700"> {t(currentLang, "translator", "or")} </span>
          <Link href={`/${currentLang}/auth/signup`} className="text-indigo-600 hover:underline font-medium">
            {t(currentLang, "translator", "createAccount")}
          </Link>
        </div>
      )}
      {error && !authError && <div className="text-sm text-red-500 pr-6">{error}</div>}

      <div className="text-sm text-left pr-6">
        {loading && (
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold">{t(currentLang, "translator", "translating")}…</span>
            <span className="animate-pulse text-lg">{"\u{1F9E0}"}</span>
          </div>
        )}

        {(translations.length > 0 || enhancedTranslation) && (
          <div className="mt-1 space-y-2">
            {enhancedTranslation ? (
              <EnhancedTranslationContent
                enhancedTranslation={enhancedTranslation}
                currentLang={currentLang}
                showSpanishFirst={showSpanishFirst}
                selectedText={selectedText}
                visibleExamples={visibleExamples}
                toggleExample={toggleExample}
              />
            ) : (
              <LegacyTranslationContent
                translations={translations}
                currentLang={currentLang}
                selectedText={selectedText}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Enhanced translation (single words + phrases with examples)
// ============================================================================

function EnhancedTranslationContent({
  enhancedTranslation, currentLang, showSpanishFirst, selectedText,
  visibleExamples, toggleExample,
}: {
  enhancedTranslation: EnhancedTranslation;
  currentLang: Language;
  showSpanishFirst: boolean;
  selectedText: string;
  visibleExamples: Set<number>;
  toggleExample: (idx: number) => void;
}) {
  return (
    <>
      {/* Part of speech + tense */}
      {enhancedTranslation.partOfSpeech ? (
        <p className="text-xs text-gray-500 italic mb-0.5">
          {getPartOfSpeechLabel(enhancedTranslation.partOfSpeech, enhancedTranslation.verbChart, currentLang)}
        </p>
      ) : (
        <p className="font-semibold">{t(currentLang, "translator", "translation")}:</p>
      )}

      {/* Main translation */}
      <div className="text-lg font-medium text-gray-900" style={{ wordSpacing: '0.15em' }}>
        {enhancedTranslation.subject && !selectedText.toLowerCase().startsWith(enhancedTranslation.subject.toLowerCase()) && (
          <span className="font-medium text-gray-500">{enhancedTranslation.subject} </span>
        )}
        <span className="font-medium">{selectedText}</span> = {enhancedTranslation.subjectTranslation && (
          <span className="text-gray-500">{enhancedTranslation.subjectTranslation} </span>
        )}{enhancedTranslation.contextTranslation}
      </div>

      {/* Root word */}
      {enhancedTranslation.isDerivative && enhancedTranslation.rootWord && (
        <div className="mt-3">
          <p className="font-semibold text-sm text-gray-700">{t(currentLang, "translator", "rootWord")}:</p>
          <div className="text-sm text-gray-800">
            <span className="font-medium">{enhancedTranslation.rootWord}</span> = {enhancedTranslation.rootTranslation}
          </div>
        </div>
      )}

      {/* Other common uses */}
      {enhancedTranslation.otherCommonTranslations && enhancedTranslation.otherCommonTranslations.length > 0 && (
        <>
          <p className="font-normal mt-2">
            <span className="font-bold italic text-gray-800">{selectedText}</span>
            {" "}{t(currentLang, "translator", "otherCommonUses")}:
          </p>
          <ul className="list-disc list-inside">
            {enhancedTranslation.otherCommonTranslations.map((item, i) => {
              const label = typeof item === 'string' ? item : item.translation;
              const example = typeof item === 'object' && item.example ? item.example : null;
              return (
                <li key={i}>
                  {example ? (
                    <button onClick={() => toggleExample(i)} className="text-blue-600 hover:underline">{label}</button>
                  ) : (
                    <span className="text-gray-800">{label}</span>
                  )}
                  {example && visibleExamples.has(i) && (
                    <ExamplePair example={example} showSpanishFirst={showSpanishFirst} />
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Derivatives / Word Family */}
      {enhancedTranslation.derivatives && enhancedTranslation.derivatives.length > 0 && (
        <div className="mt-3 border-t pt-2">
          <p className="font-semibold text-sm text-gray-700 mb-1">Word Family:</p>
          <div className="space-y-2">
            {enhancedTranslation.derivatives.map((d, i) => (
              <div key={i} className="text-sm">
                <span className="text-gray-500 italic text-xs">({d.pos})</span>{' '}
                <span className="font-medium">{d.word}</span>{' = '}
                <span className="text-gray-800">{d.translation}</span>
                {d.example && (
                  <div className="ml-4 mt-0.5 text-xs text-gray-500">
                    <ExamplePair example={d.example} showSpanishFirst={showSpanishFirst} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verb Conjugation Chart */}
      {enhancedTranslation.verbChart && ["verb", "auxiliary verb", "modal verb"].includes(enhancedTranslation.partOfSpeech || "") && (
        <VerbChart verbChart={enhancedTranslation.verbChart} selectedWord={selectedText} />
      )}
    </>
  );
}

// ============================================================================
// Legacy format (phrases and fallback)
// ============================================================================

function LegacyTranslationContent({
  translations, currentLang, selectedText,
}: {
  translations: string[];
  currentLang: Language;
  selectedText: string;
}) {
  return (
    <>
      <p className="font-semibold">{t(currentLang, "translator", "translation")}:</p>
      <div className="text-lg font-medium text-gray-900" style={{ wordSpacing: '0.15em' }}>
        {translations[0]}
      </div>
      {translations.length > 1 && (
        <>
          <p className="font-normal mt-2">
            <span className="font-bold italic text-gray-800">{selectedText}</span>
            {" "}{t(currentLang, "translator", "otherCommonUses")}:
          </p>
          <ul className="list-disc list-inside">
            {translations.slice(1).map((alt, i) => (
              <li key={i} className="text-gray-800">{alt}</li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

// ============================================================================
// Shared example pair renderer
// ============================================================================

function ExamplePair({ example, showSpanishFirst }: { example: { en: string; es: string }; showSpanishFirst: boolean }) {
  return (
    <div className="ml-2 mt-1 text-sm">
      {showSpanishFirst ? (
        <>
          <p className="text-gray-900">&quot;{example.es}&quot;</p>
          <p className="text-gray-600 italic">&quot;{example.en}&quot;</p>
        </>
      ) : (
        <>
          <p className="text-gray-900">&quot;{example.en}&quot;</p>
          <p className="text-gray-600 italic">&quot;{example.es}&quot;</p>
        </>
      )}
    </div>
  );
}
