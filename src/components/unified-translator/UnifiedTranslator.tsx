// src/components/unified-translator/UnifiedTranslator.tsx
"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import type { Language } from "@/types/i18n";
import type { UnifiedTranslatorProps } from "./types";
import { useWordSelection } from "./useWordSelection";
import { useTranslationFetch } from "./useTranslationFetch";
import TranslationCard from "./TranslationCard";

export default function UnifiedTranslator({
  sentence, staticTranslation, enabled = false, autoTriggerAll, readOnlyMode = false,
  onTranslationStateChange, onSelectionChange, onManualTranslate, onClearSelection,
  onTranslationData, sentenceIndex, contextSentences, externalSelection, onWordClick,
  parentHasSelection,
}: UnifiedTranslatorProps) {
  const leadingWhitespace = sentence.match(/^(\s*)/)?.[1] || "";
  const contentWithoutLeading = sentence.trimStart();
  const words = contentWithoutLeading.split(" ");

  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const sentenceRef = useRef<HTMLDivElement>(null);
  const [sentenceWidth, setSentenceWidth] = useState<number | null>(null);

  const pathname = usePathname() ?? "";
  const pathParts = pathname.split("/");
  const currentLevel = pathParts[4] || "l2";
  const currentLang = (pathParts[1] as Language) || "es";
  const showSpanishFirst = currentLang === "en";

  // ---- Translation fetch hook ----
  const {
    translations, enhancedTranslation, loading, error, authError,
    fetchTranslation, triggerManualTranslation, createTrigger, clearTranslation,
    hasActiveTranslation,
  } = useTranslationFetch({
    words, sentence, staticTranslation, readOnlyMode,
    currentLang, currentLevel, contextSentences, sentenceIndex,
  });

  // ---- Word selection hook ----
  const { startIdx, endIdx, handleClick, isSelected, setSelection } = useWordSelection({
    words, enabled, externalSelection, onWordClick, parentHasSelection,
    containerRef, tooltipRef,
    onSelectionCleared: clearTranslation,
  });

  // Keep manual trigger in sync with current selection state
  createTrigger(startIdx, endIdx, setSelection);

  // ---- Cleanup helper ----
  const clearAll = useCallback(() => {
    setSelection(null, null);
    clearTranslation();
  }, [setSelection, clearTranslation]);

  // ---- Notify parent of translation state changes ----
  useEffect(() => {
    onTranslationStateChange?.(hasActiveTranslation);
  }, [hasActiveTranslation]);

  // ---- Notify parent of selection changes (only for internal selections) ----
  useEffect(() => {
    if (externalSelection !== undefined) return;
    if (startIdx !== null && endIdx !== null) {
      onSelectionChange?.({ start: startIdx, end: endIdx });
    } else {
      onSelectionChange?.(null);
    }
  }, [startIdx, endIdx, externalSelection]);

  // ---- Notify parent of translation data for saving vocabulary ----
  useEffect(() => {
    if (startIdx !== null && endIdx !== null && (translations.length > 0 || enhancedTranslation)) {
      const selectedText = words.slice(startIdx, endIdx + 1).join(" ").replace(/[.,!?;:()"\u201C\u201D\u2018\u2019\u00BF\u00A1\u00AB\u00BB\u2026\u2014\u2013\-]+/g, "");
      const translation = enhancedTranslation?.contextTranslation || translations[0];
      onTranslationData?.({ word: selectedText, translation, enrichedData: enhancedTranslation ? {
        partOfSpeech: enhancedTranslation.partOfSpeech,
        derivatives: enhancedTranslation.derivatives,
        verbChart: enhancedTranslation.verbChart,
        isDerivative: enhancedTranslation.isDerivative,
        rootWord: enhancedTranslation.rootWord,
        rootTranslation: enhancedTranslation.rootTranslation,
        otherCommonTranslations: enhancedTranslation.otherCommonTranslations,
        subject: enhancedTranslation.subject,
        subjectTranslation: enhancedTranslation.subjectTranslation,
      } : undefined });
    } else {
      onTranslationData?.(null);
    }
  }, [startIdx, endIdx, translations, enhancedTranslation]);

  // ---- Provide manual translate + clear functions to parent (once) ----
  useEffect(() => {
    onManualTranslate?.(triggerManualTranslation);
  }, []);

  useEffect(() => {
    onClearSelection?.(clearAll);
  }, []);

  // ---- Auto-trigger translation ----
  const [lastAutoTriggerCount, setLastAutoTriggerCount] = useState(0);

  useEffect(() => {
    if (enabled && autoTriggerAll) {
      const currentTriggerCount = typeof autoTriggerAll === 'number' ? autoTriggerAll : 1;
      if (currentTriggerCount !== lastAutoTriggerCount) {
        setSelection(0, words.length - 1);
        fetchTranslation(0, words.length - 1);
        setLastAutoTriggerCount(currentTriggerCount);
      }
    }
  }, [enabled, autoTriggerAll, words.length, fetchTranslation, lastAutoTriggerCount, setSelection]);

  useEffect(() => {
    setLastAutoTriggerCount(0);
  }, [sentence]);

  // ---- Sentence width tracking ----
  useEffect(() => {
    if (sentenceRef.current) {
      const resizeObserver = new ResizeObserver(() => {
        if (sentenceRef.current) setSentenceWidth(sentenceRef.current.offsetWidth);
      });
      resizeObserver.observe(sentenceRef.current);
      setSentenceWidth(sentenceRef.current.offsetWidth);
      return () => resizeObserver.disconnect();
    }
  }, [sentence]);

  // ---- Selected text helper ----
  const getCleanSelectedText = () => {
    if (startIdx === null || endIdx === null || startIdx < 0 || endIdx >= words.length) return "";
    return words.slice(startIdx, endIdx + 1).join(" ").replace(/[.,!?;:()"\u201C\u201D\u2018\u2019\u00BF\u00A1\u00AB\u00BB\u2026\u2014\u2013\-]+/g, "");
  };

  return (
    <div className="relative w-full" data-translator>
      <div ref={containerRef} className="relative">
        <div ref={sentenceRef} className="flex flex-wrap justify-start gap-1 text-lg text-left w-full">
          {leadingWhitespace && (
            <span className="whitespace-pre" style={{ userSelect: 'none' }}>{leadingWhitespace}</span>
          )}
          {words.map((word, i) => (
            <button
              key={i}
              data-word-index={i}
              onClick={() => handleClick(i)}
              className={`px-0.5 -ml-[1.5px] whitespace-nowrap leading-normal align-baseline border-r-0 border-l-0 border-[1.5px] rounded-md transition-colors duration-200 ease-in-out ${
                enabled && isSelected(i)
                  ? "bg-white/10 backdrop-blur-sm border-black/10 shadow-md shadow-black/20"
                  : "text-black border-transparent"
              }`}
            >
              {word}
            </button>
          ))}
        </div>
      </div>

      {enabled && hasActiveTranslation && (
        <TranslationCard
          translations={translations}
          enhancedTranslation={enhancedTranslation}
          loading={loading}
          error={error}
          authError={authError}
          currentLang={currentLang}
          showSpanishFirst={showSpanishFirst}
          selectedText={getCleanSelectedText()}
          onClose={clearAll}
          tooltipRef={tooltipRef}
        />
      )}
    </div>
  );
}
