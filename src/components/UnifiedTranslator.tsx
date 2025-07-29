"use client";
// src\components\UnifiedTranslator.tsx

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from 'next/navigation';
import { t } from '@/lib/t';
import type { Language } from "@/types/i18n";


interface Props {
  sentence: string;
  enabled?: boolean;
  autoTriggerAll?: boolean | number;
  readOnlyMode?: boolean; // 🍌 NEW: disables real GPT fetch
  onTranslationStateChange?: (hasActiveTranslation: boolean) => void;
  onSelectionChange?: (selectedIndices: { start: number; end: number } | null) => void;
  onManualTranslate?: (translateFn: () => void) => void; // Provides manual translation function to parent
  onClearSelection?: (clearFn: () => void) => void; // Provides clear selection function to parent
}



export default function UnifiedTranslator({ sentence, enabled = false, autoTriggerAll, readOnlyMode = false, onTranslationStateChange, onSelectionChange, onManualTranslate, onClearSelection }: Props) {
  const words = sentence.split(" ");
  const [startIdx, setStartIdx] = useState<number | null>(null);
  const [endIdx, setEndIdx] = useState<number | null>(null);
  const [sentenceWidth, setSentenceWidth] = useState<number | null>(null);
  const [translations, setTranslations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Notify parent of translation state changes
  useEffect(() => {
    const hasActiveTranslation = translations.length > 0 || loading || error !== "";
    onTranslationStateChange?.(hasActiveTranslation);
  }, [translations.length, loading, error]); // Removed onTranslationStateChange from deps

  // Notify parent of selection changes
  useEffect(() => {
    if (startIdx !== null && endIdx !== null) {
      onSelectionChange?.({ start: startIdx, end: endIdx });
    } else {
      onSelectionChange?.(null);
    }
  }, [startIdx, endIdx]); // Removed onSelectionChange from deps to prevent infinite loop
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


  const getSelectedText = () => words.slice(startIdx!, endIdx! + 1).join(" ");

  const fetchTranslation = useCallback(
  async (start: number, end: number) => {
    if (readOnlyMode) {
      setTranslations(["🔒 Premium feature — upgrade to unlock smart GPT translations"]);
      return;
    }

    const phrase = words.slice(start, end + 1).join(" ");
    const cleanWord = phrase.replace(/[.,!?;:()"]+/g, "");
    const isSingleWord = start === end;

const endpoint = isSingleWord
  ? `/api/translate-word?lang=${currentLang}`
  : `/api/translate-phrase?input=${encodeURIComponent(cleanWord)}&sentence=${encodeURIComponent(sentence)}&level=${currentLevel}&mode=auto&lang=${currentLang}`;

    const body = isSingleWord
  ? { word: cleanWord, sentence, level: currentLevel }
  : null;

    try {
      setLoading(true);
      setError("");
      const res = await fetch(endpoint, {
        method: isSingleWord ? "POST" : "GET",
        headers: isSingleWord ? { "Content-Type": "application/json" } : undefined,
        body: isSingleWord ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (!isSingleWord) {
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
} else {
  setTranslations(data.translations || []);
}
    } catch (err) {
      console.error(err);
      setError("⚠️ Failed to fetch translation.");
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
    // If translations are already showing, hide them (toggle off)
    if (translations.length > 0 || error) {
      setTranslations([]);
      setError("");
      return;
    }

    if (readOnlyMode) {
      setTranslations(["🔒 Premium feature — upgrade to unlock smart GPT translations"]);
      return;
    }

    if (startIdx !== null && endIdx !== null) {
      // Translate selected words
      fetchTranslation(startIdx, endIdx);
    } else {
      // Translate entire sentence
      setStartIdx(0);
      setEndIdx(words.length - 1);
      fetchTranslation(0, words.length - 1);
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
    setError("");
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

  // Clear any existing translations when selecting new words
  setTranslations([]);
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
  } catch (err) {
    console.error("❌ Failed to fetch example:", err);
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
      console.log('🎯 UnifiedTranslator: Exempting audio/translation control - not closing translation');
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
      {words.map((word, i) => (
        <button
          ref={(el) => {
            buttonRefs.current[i] = el;
          }}
          key={i}
          onClick={() => handleClick(i)}
          className={`px-0.5 -ml-[1.5px] transition whitespace-nowrap leading-normal align-baseline border-r-0 border-l-0 border-[1.5px] rounded-md ${
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

    {enabled && (translations.length > 0 || loading || error) && (
      <div
  ref={tooltipRef}
  style={sentenceWidth ? { width: sentenceWidth } : undefined}
  className="absolute left-1/2 -translate-x-1/2 mt-2 bg-white text-black p-4 rounded-xl shadow z-50"
  data-tooltip
>
        {error && <div className="text-sm text-red-500">{error}</div>}

        <div className="text-sm text-left">
          {loading && (
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold">{t(currentLang, "translator", "translating")}…</span>
              <span className="animate-pulse text-lg">🧠</span>
            </div>
          )}

          {translations.length > 0 && (
            <div className="mt-1 space-y-2">
              <p className="font-semibold">{t(currentLang, "translator", "translation")}:</p>
<ul className="list-disc list-inside">
  <li>
    <button
      onClick={() => fetchExample(translations[0])}
      className="text-blue-600 hover:underline"
    >
      {translations[0]}
    </button>
  </li>
</ul>

              {translations.length > 1 && (
                <>
                  <p className="font-semibold mt-2">
                    {t(currentLang, "translator", "otherCommonUses")}{" "}
                    <span className="italic text-gray-800">
                      {words.slice(startIdx!, endIdx! + 1).join(" ")}
                    </span>
                    :
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
            </div>
          )}
        </div>
      </div>
    )}
  </div>
  );
}