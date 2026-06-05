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
  // True while the rich info (Call B) is still loading AFTER the quick headline
  // (Call A) has rendered. Lets the card show a subtle indicator in the rich
  // area — and is the seam the loading-tidbit will later fill.
  const [richLoading, setRichLoading] = useState(false);
  const [error, setError] = useState("");
  const [authError, setAuthError] = useState(false);

  // Monotonic id of the latest single-word request. A response only renders if
  // its id still matches — so a slow Call B from a previous tap can't overwrite
  // the card after the user has tapped a new word.
  const reqSeq = useRef(0);

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

    if (!authSession?.user) {
      setAuthError(true);
      return;
    }

    // ---- Single word: two-call "translation-first" flow ----
    // Call A (quick) returns just the headline fast -> render immediately.
    // Call B (rich) returns the full payload -> replace the card.
    // A reqSeq guard ensures a stale Call B can't clobber a newer tap.
    if (isSingleWord) {
      const myReq = ++reqSeq.current;
      const isCurrent = () => myReq === reqSeq.current;
      const body = { word: cleanWord, sentence, level: currentLevel, context };

      setLoading(true);
      setRichLoading(false);
      setError("");
      setAuthError(false);

      // Call A \u2014 quick headline
      const quickPromise = (async () => {
        try {
          const res = await fetch(`/api/translate-word-quick?lang=${currentLang}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (data.error || !isCurrent() || !data.contextTranslation) return;
          // Only set the headline if Call B hasn't already landed (B is richer).
          setEnhancedTranslation((prev) =>
            prev && prev.partOfSpeech !== undefined
              ? prev // B already rendered \u2014 don't downgrade
              : {
                  contextTranslation: data.contextTranslation,
                  subject: data.subject ?? undefined,
                  subjectTranslation: data.subjectTranslation ?? undefined,
                },
          );
          setTranslations((prev) => (prev.length ? prev : [data.contextTranslation]));
          if (isCurrent()) setRichLoading(true);
        } catch {
          /* Call A failing is non-fatal \u2014 Call B may still deliver everything. */
        }
      })();

      // Call B \u2014 full rich payload
      const richPromise = (async () => {
        try {
          const res = await fetch(`/api/translate-word?lang=${currentLang}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!isCurrent()) return;
          if (data.error) throw new Error(data.error);
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
          }
        } catch (err: any) {
          if (!isCurrent()) return;
          // If B fails but A already rendered the headline, keep the headline
          // (graceful degradation) \u2014 only surface an error if nothing showed.
          if (err.message === "Authentication required") {
            setAuthError(true);
          } else {
            console.error(err);
            setEnhancedTranslation((prev) => {
              if (!prev) setError("\u26A0\uFE0F Failed to fetch translation.");
              return prev;
            });
          }
        }
      })();

      await Promise.allSettled([quickPromise, richPromise]);
      if (isCurrent()) {
        setLoading(false);
        setRichLoading(false);
      }
      return;
    }

    // ---- Phrase: single call (unchanged) ----
    try {
      setLoading(true);
      setError("");
      setAuthError(false);
      const res = await fetch(`/api/translate-phrase?lang=${currentLang}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase: cleanWord, sentence, level: currentLevel, context }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

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
        reqSeq.current++; // invalidate any in-flight request so it can't repopulate
        setTranslations([]);
        setEnhancedTranslation(null);
        setLoading(false);
        setRichLoading(false);
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
    reqSeq.current++; // invalidate any in-flight request so it can't repopulate
    setTranslations([]);
    setEnhancedTranslation(null);
    setLoading(false); // <- without this, X-ing out mid-load left the card stuck open
    setRichLoading(false);
    setError("");
    setAuthError(false);
  }, []);

  const hasActiveTranslation = translations.length > 0 || !!enhancedTranslation || loading || error !== "" || authError;

  return {
    translations, enhancedTranslation, loading, richLoading, error, authError,
    fetchTranslation, triggerManualTranslation, createTrigger, clearTranslation,
    hasActiveTranslation,
  };
}
