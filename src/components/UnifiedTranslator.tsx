"use client";
// src\components\UnifiedTranslator.tsx

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { t } from '@/lib/t';
import type { Language } from "@/types/i18n";


interface Props {
  sentence: string;
  staticTranslation?: string; // Pre-existing translation to use when full line is selected (avoids GPT call)
  enabled?: boolean;
  autoTriggerAll?: boolean | number;
  readOnlyMode?: boolean; // 🍌 NEW: disables real GPT fetch
  onTranslationStateChange?: (hasActiveTranslation: boolean) => void;
  onSelectionChange?: (selectedIndices: { start: number; end: number } | null) => void;
  onManualTranslate?: (translateFn: () => void) => void; // Provides manual translation function to parent
  onClearSelection?: (clearFn: () => void) => void; // Provides clear selection function to parent
  onTranslationData?: (data: { word: string; translation: string } | null) => void; // Exposes current translation for saving
  // Context for better translations
  sentenceIndex?: number;
  contextSentences?: Array<{ es: string; en: string }>;
  // Cross-line stanza selection support
  externalSelection?: { start: number; end: number } | null; // Parent can force a selection range
  onWordClick?: (wordIndex: number) => void; // Notify parent of word clicks for cross-line coordination
}



export default function UnifiedTranslator({ sentence, staticTranslation, enabled = false, autoTriggerAll, readOnlyMode = false, onTranslationStateChange, onSelectionChange, onManualTranslate, onClearSelection, onTranslationData, sentenceIndex, contextSentences, externalSelection, onWordClick }: Props) {
  // Extract leading whitespace for poetry indentation
  const leadingWhitespace = sentence.match(/^(\s*)/)?.[1] || "";
  const contentWithoutLeading = sentence.trimStart();
  const words = contentWithoutLeading.split(" ");
  const [internalStartIdx, setInternalStartIdx] = useState<number | null>(null);
  const [internalEndIdx, setInternalEndIdx] = useState<number | null>(null);
  const [sentenceWidth, setSentenceWidth] = useState<number | null>(null);
  const [translations, setTranslations] = useState<string[]>([]);
  const [enhancedTranslation, setEnhancedTranslation] = useState<{
    contextTranslation?: string;
    isDerivative?: boolean;
    rootWord?: string;
    rootTranslation?: string;
    otherCommonTranslations?: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authError, setAuthError] = useState(false);

  // Use external selection if provided, otherwise use internal state
  const startIdx = externalSelection !== undefined ? externalSelection?.start ?? null : internalStartIdx;
  const endIdx = externalSelection !== undefined ? externalSelection?.end ?? null : internalEndIdx;
  // Setters that work with internal state (used when no external selection)
  const setStartIdx = setInternalStartIdx;
  const setEndIdx = setInternalEndIdx;

  // Notify parent of translation state changes
  useEffect(() => {
    const hasActiveTranslation = translations.length > 0 || loading || error !== "" || authError;
    onTranslationStateChange?.(hasActiveTranslation);
  }, [translations.length, loading, error, authError]); // Removed onTranslationStateChange from deps

  // Notify parent of selection changes (only for internal selections, not external)
  useEffect(() => {
    if (externalSelection !== undefined) return; // External selection managed by parent
    if (internalStartIdx !== null && internalEndIdx !== null) {
      onSelectionChange?.({ start: internalStartIdx, end: internalEndIdx });
    } else {
      onSelectionChange?.(null);
    }
  }, [internalStartIdx, internalEndIdx, externalSelection]); // Removed onSelectionChange from deps to prevent infinite loop

  // Notify parent of translation data for saving vocabulary
  useEffect(() => {
    if (startIdx !== null && endIdx !== null && translations.length > 0) {
      const selectedText = words.slice(startIdx, endIdx + 1).join(" ").replace(/[.,!?;:()"]+/g, "");
      const translation = enhancedTranslation?.contextTranslation || translations[0];
      onTranslationData?.({ word: selectedText, translation });
    } else {
      onTranslationData?.(null);
    }
  }, [startIdx, endIdx, translations, enhancedTranslation]);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const sentenceRef = useRef<HTMLDivElement>(null);

  const pathname = usePathname() ?? "";
  const pathParts = pathname.split("/");
  const currentLevel = pathParts[4] || "l2"; // Fallback to l1 if undefined
  const currentLang = (pathParts[1] as Language) || "es"; // 👈 'es' or 'en'
  const isSpanishToEnglish = currentLang === "en";
  const showSpanishFirst = currentLang === "en";

  const [exampleMap, setExampleMap] = useState<{ [key: string]: { english: string; spanish: string } }>({});


  const getSelectedText = () => {
    if (startIdx === null || endIdx === null || startIdx < 0 || endIdx >= words.length) {
      return "";
    }
    return words.slice(startIdx, endIdx + 1).join(" ");
  };
  
  const getCleanSelectedText = () => {
    if (startIdx === null || endIdx === null || startIdx < 0 || endIdx >= words.length) {
      return "";
    }
    const selectedText = words.slice(startIdx, endIdx + 1).join(" ");
    return selectedText.replace(/[.,!?;:()"]+/g, "");
  };

  const getContextSentences = () => {
    if (!contextSentences || sentenceIndex === undefined || sentenceIndex < 0 || sentenceIndex >= contextSentences.length) {
      return null;
    }
    
    const prevSentence = sentenceIndex > 0 ? contextSentences[sentenceIndex - 1] : null;
    const nextSentence = sentenceIndex < contextSentences.length - 1 ? contextSentences[sentenceIndex + 1] : null;
    
    return {
      previous: prevSentence,
      current: contextSentences[sentenceIndex],
      next: nextSentence
    };
  };

  const fetchTranslation = useCallback(
  async (start: number, end: number) => {
    if (readOnlyMode) {
      setTranslations([`🔒 ${t(currentLang, "translator", "lockedFeature")}`]);
      return;
    }

    // Validate indices
    if (start < 0 || end >= words.length || start > end) {
      setError("Invalid text selection");
      return;
    }

    const phrase = words.slice(start, end + 1).join(" ");
    const cleanWord = phrase.replace(/[.,!?;:()"]+/g, "");
    const isSingleWord = start === end;

    const context = getContextSentences();
    
    const endpoint = isSingleWord
      ? `/api/translate-word?lang=${currentLang}`
      : `/api/translate-phrase?lang=${currentLang}`;

    const body = isSingleWord
      ? { word: cleanWord, sentence, level: currentLevel, context }
      : { phrase: cleanWord, sentence, level: currentLevel, context };

    try {
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
        // Handle phrase translations (unchanged)
        if (typeof data.translations === "object" && data.translations.primary) {
          const merged = [
            data.translations.primary,
            ...(data.translations.otherCommonTranslations || [])
          ];
          setTranslations(merged);
        } else if (Array.isArray(data.translations)) {
          setTranslations(data.translations); // fallback
        } else {
          throw new Error("Invalid phrase translation format");
        }
        setEnhancedTranslation(null); // Clear enhanced data for phrases
      } else {
        // Handle single word translations with enhanced data
        if (data.contextTranslation) {
          setEnhancedTranslation({
            contextTranslation: data.contextTranslation,
            isDerivative: data.isDerivative,
            rootWord: data.rootWord,
            rootTranslation: data.rootTranslation,
            otherCommonTranslations: data.otherCommonTranslations
          });
          setTranslations(data.translations || [data.contextTranslation]);
        } else {
          // Fallback to legacy format
          setTranslations(data.translations || []);
          setEnhancedTranslation(null);
        }
      }
    } catch (err: any) {
      if (err.message === "Authentication required") {
        setAuthError(true);
      } else {
        console.error(err);
        setError("⚠️ Failed to fetch translation.");
      }
    } finally {
      setLoading(false);
    }
  },
  [readOnlyMode, sentence, currentLevel, words, currentLang] // ✅ FULL LIST
);

  // Use ref to store the latest function without causing re-renders
  const triggerManualTranslationRef = useRef<() => void>(() => {});
  
  // Update the ref whenever dependencies change
  triggerManualTranslationRef.current = () => {
    // If translations are already showing or loading, hide them (toggle off)
    if (translations.length > 0 || loading || error) {
      setTranslations([]);
      setEnhancedTranslation(null);
      setLoading(false);
      setError("");
      return;
    }

    if (readOnlyMode) {
      // Set all states together - React 18 batches into single render
      setStartIdx(0);
      setEndIdx(words.length - 1);
      setTranslations([`🔒 ${t(currentLang, "translator", "lockedFeature")}`]);
      return;
    }

    // Check if full line is being translated (use static translation if available)
    const isFullLine = (start: number, end: number) => start === 0 && end === words.length - 1;

    if (startIdx !== null && endIdx !== null) {
      // Words already highlighted
      if (isFullLine(startIdx, endIdx) && staticTranslation) {
        // Use static translation for full line
        setTranslations([staticTranslation]);
        setEnhancedTranslation(null);
      } else {
        // Partial selection - call GPT
        fetchTranslation(startIdx, endIdx);
      }
    } else {
      // No selection - translate full line
      setStartIdx(0);
      setEndIdx(words.length - 1);
      if (staticTranslation) {
        // Use static translation for full line
        setTranslations([staticTranslation]);
        setEnhancedTranslation(null);
      } else {
        // No static translation available - call GPT
        setLoading(true);
        fetchTranslation(0, words.length - 1);
      }
    }
  };

  // Stable function that uses the ref
  const triggerManualTranslation = useCallback(() => {
    triggerManualTranslationRef.current?.();
  }, []);

  // Clear selection function
  const clearSelection = useCallback(() => {
    setStartIdx(null);
    setEndIdx(null);
    setTranslations([]);
    setEnhancedTranslation(null);
    setError("");
    setAuthError(false);
  }, []);

  // Provide manual translation function to parent only once
  useEffect(() => {
    if (onManualTranslate) {
      onManualTranslate(triggerManualTranslation);
    }
  }, []); // Empty dependency array - only run once

  // Provide clear selection function to parent only once
  useEffect(() => {
    if (onClearSelection) {
      onClearSelection(clearSelection);
    }
  }, []); // Empty dependency array - only run once

  const handleClick = (index: number) => {
  if (!enabled) return;

  // Notify parent of word click for cross-line stanza selection
  onWordClick?.(index);

  // If using external selection, let parent handle all selection logic
  if (externalSelection !== undefined) {
    return;
  }

  // Clear any existing translations when selecting new words
  setTranslations([]);
  setEnhancedTranslation(null);
  setError("");

  if (startIdx === null && endIdx === null) {
    // First word clicked - just select, don't auto-translate
    setStartIdx(index);
    setEndIdx(index);
    return;
  }

  if (startIdx === index && endIdx === index) {
    // Deselect single-word selection
    setStartIdx(null);
    setEndIdx(null);
    return;
  }

  if (startIdx !== null && endIdx !== null) {
    if (index < startIdx || index > endIdx) {
      // Expand selection
      const newStart = Math.min(startIdx, index);
      const newEnd = Math.max(endIdx, index);
      setStartIdx(newStart);
      setEndIdx(newEnd);
    } else if (index > startIdx && index < endIdx) {
      // Shrink from right
      setEndIdx(index);
    } else if (index === startIdx && startIdx !== endIdx) {
      // Shrink from left
      const newStart = startIdx + 1;
      setStartIdx(newStart);
    } else {
      // Fallback: Reset everything
      setStartIdx(null);
      setEndIdx(null);
    }
    return;
  }

  // Final fallback: select range that includes clicked word
  const s = Math.min(startIdx!, endIdx!, index);
  const e = Math.max(startIdx!, endIdx!, index);
  setStartIdx(s);
  setEndIdx(e);
  };

const fetchExample = async (translation: string) => {
  const selected = words.slice(startIdx!, endIdx! + 1).join(" ");
  const sourceWord = isSpanishToEnglish ? translation : selected;
  const targetWord = isSpanishToEnglish ? selected : translation;

  if (exampleMap[translation]) {
    setExampleMap((prev) => {
      const updated = { ...prev };
      delete updated[translation];
      return updated;
    });
    return;
  }

  try {
 const payload = {
  spanishWord: currentLang === "es" ? sourceWord : targetWord,
  englishWord: currentLang === "es" ? targetWord : sourceWord,
  originalSentence: sentence,
  level: currentLevel,
};

console.log("📤 Example fetch payload:", payload);

const res = await fetch(`/api/example-sentence?lang=${currentLang}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    setExampleMap((prev) => ({
      ...prev,
      [translation]: {
        english: data.english,
        spanish: data.spanish,
      },
    }));
    console.log("🎯 Data from API:", data);
  } catch (err: any) {
    if (err.message === "Authentication required") {
      setAuthError(true);
    } else {
      console.error("❌ Failed to fetch example:", err);
    }
  }
};

  const isSelected = (i: number) => {
    if (startIdx === null || endIdx === null) return false;
    return i >= startIdx && i <= endIdx;
  };

  const [lastAutoTriggerCount, setLastAutoTriggerCount] = useState(0);

useEffect(() => {
  if (enabled && autoTriggerAll) {
    const currentTriggerCount = typeof autoTriggerAll === 'number' ? autoTriggerAll : 1;
    if (currentTriggerCount !== lastAutoTriggerCount) {
      setStartIdx(0);
      setEndIdx(words.length - 1);
      fetchTranslation(0, words.length - 1);
      setLastAutoTriggerCount(currentTriggerCount);
    }
  }
}, [enabled, autoTriggerAll, words.length, fetchTranslation, lastAutoTriggerCount]);

useEffect(() => {
  setLastAutoTriggerCount(0);
}, [sentence]);

useEffect(() => {
  const handleOutsideClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // ALWAYS exempt audio/translation controls - don't rely on timing
    if (
      target.hasAttribute('data-audio-control') ||       // Audio buttons (speaker, turtle, close)
      target.hasAttribute('data-translation-control') || // Translation buttons (pencil, diamond)
      target.closest('[data-audio-scrubber]') ||         // Audio scrubber area
      target.closest('[data-audio-control]') ||          // Any audio control element
      target.closest('[data-translation-control]')       // Any translation control element
    ) {
      return; // Never close translation for these elements
    }
    
    if (
      containerRef.current &&
      !containerRef.current.contains(e.target as Node) &&
      tooltipRef.current &&
      !tooltipRef.current.contains(e.target as Node)
    ) {
      // Mark this element as having just closed a translation
      target.setAttribute('data-just-closed-translation', 'true');
      setTimeout(() => target.removeAttribute('data-just-closed-translation'), 10);
      
      setStartIdx(null);
      setEndIdx(null);
      setTranslations([]);
      setError("");
    }
  };

  document.addEventListener("mousedown", handleOutsideClick, true); // Use capture phase
  return () => document.removeEventListener("mousedown", handleOutsideClick, true);
}, []);

// ✅ This should be completely separate
useEffect(() => {
  if (sentenceRef.current) {
    const resizeObserver = new ResizeObserver(() => {
      if (sentenceRef.current) {
  setSentenceWidth(sentenceRef.current.offsetWidth);
}
    });

    resizeObserver.observe(sentenceRef.current);
    setSentenceWidth(sentenceRef.current.offsetWidth); // initial sync

    return () => resizeObserver.disconnect();
  }
}, [sentence]);

          return (
  <div className="relative" data-translator>
    <div ref={containerRef} className="relative">
      <div ref={sentenceRef} className="flex flex-wrap justify-start gap-1 text-lg text-left w-full">
      {/* Render leading whitespace for poetry indentation */}
      {leadingWhitespace && (
        <span className="whitespace-pre" style={{ userSelect: 'none' }}>{leadingWhitespace}</span>
      )}
      {words.map((word, i) => (
        <button
          ref={(el) => {
            buttonRefs.current[i] = el;
          }}
          key={i}
          onClick={() => handleClick(i)}
          className={`px-0.5 -ml-[1.5px] whitespace-nowrap leading-normal align-baseline border-r-0 border-l-0 border-[1.5px] rounded-md ${
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

    {enabled && (translations.length > 0 || loading || error || authError) && (
      <div
  ref={tooltipRef}
  style={sentenceWidth ? { width: sentenceWidth } : undefined}
  className="mt-1 -ml-[15px] bg-white text-black px-4 pt-3 pb-3 rounded-xl shadow z-50 relative"
  data-tooltip
>
        {/* Close button */}
        <button
          onClick={clearSelection}
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
              <span className="animate-pulse text-lg">🧠</span>
            </div>
          )}

          {translations.length > 0 && (
            <div className="mt-1 space-y-2">
              {/* Enhanced single word translation format */}
              {enhancedTranslation && startIdx === endIdx ? (
                <>
                  <p className="font-semibold">{t(currentLang, "translator", "translation")}:</p>
                  <div className="text-lg font-medium text-gray-900" style={{ wordSpacing: '0.15em' }}>
                    <span className="font-medium">{getCleanSelectedText()}</span> = {enhancedTranslation.contextTranslation}
                  </div>

                  {enhancedTranslation.isDerivative && enhancedTranslation.rootWord && (
                    <div className="mt-3">
                      <p className="font-semibold text-sm text-gray-700">{t(currentLang, "translator", "rootWord")}:</p>
                      <div className="text-sm text-gray-800">
                        <span className="font-medium">{enhancedTranslation.rootWord}</span> = {enhancedTranslation.rootTranslation}
                      </div>
                    </div>
                  )}

                  {enhancedTranslation.otherCommonTranslations && enhancedTranslation.otherCommonTranslations.length > 0 && (
                    <>
                      <p className="font-normal mt-2">
                        <span className="font-bold italic text-gray-800">
                          {getCleanSelectedText()}
                        </span>
                        {" "}{t(currentLang, "translator", "otherCommonUses")}:
                      </p>
                      <ul className="list-disc list-inside">
                        {enhancedTranslation.otherCommonTranslations.map((t, i) => {
                          const hasExample = !!exampleMap[t];
                          return (
                            <li key={i}>
                              <button
                                onClick={() => fetchExample(t)}
                                className="text-blue-600 hover:underline"
                              >
                                {t}
                              </button>
                              {hasExample && (
                                <div className="ml-2 mt-1 text-sm">
                                  {showSpanishFirst ? (
                                    <>
                                      <p className="text-gray-900">&quot;{exampleMap[t].spanish}&quot;</p>
                                      <p className="text-gray-600 italic">&quot;{exampleMap[t].english}&quot;</p>
                                    </>
                                  ) : (
                                    <>
                                      <p className="text-gray-900">&quot;{exampleMap[t].english}&quot;</p>
                                      <p className="text-gray-600 italic">&quot;{exampleMap[t].spanish}&quot;</p>
                                    </>
                                  )}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </>
              ) : (
                /* Legacy format for phrases and fallback */
                <>
                  <p className="font-semibold">{t(currentLang, "translator", "translation")}:</p>
                  <div className="text-lg font-medium text-gray-900" style={{ wordSpacing: '0.15em' }}>
                    {translations[0]}
                  </div>

                  {translations.length > 1 && (
                    <>
                      <p className="font-normal mt-2">
                        <span className="font-bold italic text-gray-800">
                          {getCleanSelectedText()}
                        </span>
                        {" "}{t(currentLang, "translator", "otherCommonUses")}:
                      </p>
                      <ul className="list-disc list-inside">
                        {translations.slice(1).map((t, i) => {
                          const hasExample = !!exampleMap[t];
                          return (
                            <li key={i}>
                              <button
                                onClick={() => fetchExample(t)}
                                className="text-blue-600 hover:underline"
                              >
                                {t}
                              </button>
                              {hasExample && (
                                <div className="ml-2 mt-1 text-sm">
                                  {showSpanishFirst ? (
                                    <>
                                      <p className="text-gray-900">&quot;{exampleMap[t].spanish}&quot;</p>
                                      <p className="text-gray-600 italic">&quot;{exampleMap[t].english}&quot;</p>
                                    </>
                                  ) : (
                                    <>
                                      <p className="text-gray-900">&quot;{exampleMap[t].english}&quot;</p>
                                      <p className="text-gray-600 italic">&quot;{exampleMap[t].spanish}&quot;</p>
                                    </>
                                  )}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    )}
  </div>
  );
}