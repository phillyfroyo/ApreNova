// src/components/unified-translator/useTranslationFetch.ts
"use client";

import { useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { t } from "@/lib/t";
import type { Language } from "@/types/i18n";
import type { EnhancedTranslation } from "./types";

interface UseTranslationFetchOptions {
  words: string[];
  sentence: string;
  staticTranslation?: string;
  readOnlyMode: boolean;
  currentLang: Language;
  currentLevel: string;
  contextSentences?: Array<{ es: string; en: string }>;
  sentenceIndex?: number;
}

export function useTranslationFetch({
  words, sentence, staticTranslation, readOnlyMode,
  currentLang, currentLevel, contextSentences, sentenceIndex,
}: UseTranslationFetchOptions) {
  const { data: authSession } = useSession();
  const [translations, setTranslations] = useState<string[]>([]);
  const [enhancedTranslation, setEnhancedTranslation] = useState<EnhancedTranslation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authError, setAuthError] = useState(false);

  const getContextSentences = useCallback(() => {
    if (!contextSentences || sentenceIndex === undefined || sentenceIndex < 0 || sentenceIndex >= contextSentences.length) {
      return null;
    }
    const prevSentence = sentenceIndex > 0 ? contextSentences[sentenceIndex - 1] : null;
    const nextSentence = sentenceIndex < contextSentences.length - 1 ? contextSentences[sentenceIndex + 1] : null;
    return { previous: prevSentence, current: contextSentences[sentenceIndex], next: nextSentence };
  }, [contextSentences, sentenceIndex]);

  const fetchTranslation = useCallback(async (start: number, end: number) => {
    if (readOnlyMode) {
      setTranslations([`\u{1F512} ${t(currentLang, "translator", "lockedFeature")}`]);
      return;
    }

    if (start < 0 || end >= words.length || start > end) {
      setError("Invalid text selection");
      return;
    }

    const phrase = words.slice(start, end + 1).join(" ");
    const cleanWord = phrase.replace(/[.,!?;:()"\u201C\u201D\u2018\u2019\u00BF\u00A1\u00AB\u00BB\u2026\u2014\u2013\-]+/g, "");
    const isSingleWord = start === end;
    const context = getContextSentences();

    const endpoint = isSingleWord
      ? `/api/translate-word?lang=${currentLang}`
      : `/api/translate-phrase?lang=${currentLang}`;

    const body = isSingleWord
      ? { word: cleanWord, sentence, level: currentLevel, context }
      : { phrase: cleanWord, sentence, level: currentLevel, context };

    try {
      if (!authSession?.user) {
        setAuthError(true);
        return;
      }
      setLoading(true);
      setError("");
      setAuthError(false);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (!isSingleWord) {
        if (typeof data.translations === "object" && data.translations.primary) {
          setEnhancedTranslation({
            contextTranslation: data.translations.primary,
            otherCommonTranslations: data.translations.otherCommonTranslations || [],
          });
          setTranslations([]);
        } else if (Array.isArray(data.translations)) {
          setTranslations(data.translations);
          setEnhancedTranslation(null);
        } else {
          throw new Error("Invalid phrase translation format");
        }
      } else {
        if (data.contextTranslation) {
          setEnhancedTranslation({
            contextTranslation: data.contextTranslation,
            isDerivative: data.isDerivative,
            rootWord: data.rootWord,
            rootTranslation: data.rootTranslation,
            otherCommonTranslations: data.otherCommonTranslations,
            partOfSpeech: data.partOfSpeech,
            subject: data.subject,
            subjectTranslation: data.subjectTranslation,
            derivatives: data.derivatives,
            verbChart: data.verbChart,
          });
          setTranslations([data.contextTranslation]);
        } else {
          setTranslations(data.translations || []);
          setEnhancedTranslation(null);
        }
      }
    } catch (err: any) {
      if (err.message === "Authentication required") {
        setAuthError(true);
      } else {
        console.error(err);
        setError("\u26A0\uFE0F Failed to fetch translation.");
      }
    } finally {
      setLoading(false);
    }
  }, [readOnlyMode, sentence, currentLevel, words, currentLang, authSession, getContextSentences]);

  // Manual trigger ref pattern — avoids stale closures while keeping stable callback identity
  const triggerRef = useRef<() => void>(() => {});

  const createTrigger = (startIdx: number | null, endIdx: number | null, setSelection?: (start: number | null, end: number | null) => void) => {
    triggerRef.current = () => {
      if (translations.length > 0 || !!enhancedTranslation || loading || error) {
        setTranslations([]);
        setEnhancedTranslation(null);
        setLoading(false);
        setError("");
        return;
      }

      if (readOnlyMode) {
        setTranslations([`\u{1F512} ${t(currentLang, "translator", "lockedFeature")}`]);
        return;
      }

      const isFullLine = (s: number, e: number) => s === 0 && e === words.length - 1;

      if (startIdx !== null && endIdx !== null) {
        if (isFullLine(startIdx, endIdx) && staticTranslation) {
          setTranslations([staticTranslation]);
          setEnhancedTranslation(null);
        } else {
          fetchTranslation(startIdx, endIdx);
        }
      } else {
        if (staticTranslation) {
          setSelection?.(0, words.length - 1);
          setTranslations([staticTranslation]);
          setEnhancedTranslation(null);
        } else if (!authSession?.user) {
          setAuthError(true);
        } else {
          setSelection?.(0, words.length - 1);
          setLoading(true);
          fetchTranslation(0, words.length - 1);
        }
      }
    };
  };

  const triggerManualTranslation = useCallback(() => {
    triggerRef.current?.();
  }, []);

  const clearTranslation = useCallback(() => {
    setTranslations([]);
    setEnhancedTranslation(null);
    setError("");
    setAuthError(false);
  }, []);

  const hasActiveTranslation = translations.length > 0 || !!enhancedTranslation || loading || error !== "" || authError;

  return {
    translations, enhancedTranslation, loading, error, authError,
    fetchTranslation, triggerManualTranslation, createTrigger, clearTranslation,
    hasActiveTranslation,
  };
}
