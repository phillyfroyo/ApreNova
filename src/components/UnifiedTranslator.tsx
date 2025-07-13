"use client";
// src\components\UnifiedTranslator.tsx

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from 'next/navigation';


interface Props {
  sentence: string;
  enabled?: boolean;
  autoTriggerAll?: boolean;
  readOnlyMode?: boolean; // 🍌 NEW: disables real GPT fetch
}



export default function UnifiedTranslator({ sentence, enabled = false, autoTriggerAll, readOnlyMode = false }: Props) {
  const words = sentence.split(" ");
  const [startIdx, setStartIdx] = useState<number | null>(null);
  const [endIdx, setEndIdx] = useState<number | null>(null);
  const [translations, setTranslations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const pathname = usePathname() ?? "";
  const pathParts = pathname.split("/");
  const currentLevel = pathParts[4] || "l2"; // Fallback to l1 if undefined
  const currentLang = pathParts[1] || "es"; // 👈 'es' or 'en'
  const isSpanishToEnglish = currentLang === "en";
  const directionLang = currentLang === "en" ? "es" : "en"; // 👈 Flip it!




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
      ? { word: cleanWord, sentence: "", level: currentLevel }
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
        setTranslations(Array.isArray(data) ? data : [data.translation]);
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
  [readOnlyMode, sentence, currentLevel, words] // ✅ FULL LIST
);

  const handleClick = (index: number) => {
  if (!enabled) return;

// If in readOnlyMode, still allow full range selection but skip GPT
if (readOnlyMode) {
  if (startIdx === null || endIdx === null) {
    setStartIdx(index);
    setEndIdx(index);
  } else {
    const newStart = Math.min(startIdx, index);
    const newEnd = Math.max(endIdx, index);
    setStartIdx(newStart);
    setEndIdx(newEnd);
  }
  setTranslations(["🔒 Premium feature — upgrade to unlock smart GPT translations"]);
  return;
}

  
  if (startIdx === null && endIdx === null) {
    // First word clicked
    setStartIdx(index);
    setEndIdx(index);
    fetchTranslation(index, index);
    return;
  }

  if (startIdx === index && endIdx === index) {
    // Deselect single-word selection
    setStartIdx(null);
    setEndIdx(null);
    setTranslations([]);
    setError("");
    return;
  }

  if (startIdx !== null && endIdx !== null) {
    if (index < startIdx || index > endIdx) {
      // Expand selection
      const newStart = Math.min(startIdx, index);
      const newEnd = Math.max(endIdx, index);
      setStartIdx(newStart);
      setEndIdx(newEnd);
      fetchTranslation(newStart, newEnd);
    } else if (index > startIdx && index < endIdx) {
      // Shrink from right
      setEndIdx(index);
      fetchTranslation(startIdx, index);
    } else if (index === startIdx && startIdx !== endIdx) {
      // Shrink from left
      const newStart = startIdx + 1;
      setStartIdx(newStart);
      fetchTranslation(newStart, endIdx);
    } else {
      // Fallback: Reset everything
      setStartIdx(null);
      setEndIdx(null);
      setTranslations([]);
      setError("");
    }
    return;
  }

  // Final fallback: select range that includes clicked word
  const s = Math.min(startIdx!, endIdx!, index);
  const e = Math.max(startIdx!, endIdx!, index);
  setStartIdx(s);
  setEndIdx(e);
  fetchTranslation(s, e);
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
    const res = await fetch(`/api/example-sentence?lang=${directionLang}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    spanishWord: isSpanishToEnglish ? sourceWord : targetWord,
    englishWord: isSpanishToEnglish ? targetWord : sourceWord,
    originalSentence: sentence,
    level: currentLevel,
  }),
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

  const [hasAutoTranslated, setHasAutoTranslated] = useState(false);


useEffect(() => {
  if (enabled && autoTriggerAll && !hasAutoTranslated) {
    setStartIdx(0);
    setEndIdx(words.length - 1);
    fetchTranslation(0, words.length - 1);
    setHasAutoTranslated(true); // ✅ Prevent the loop
  }
}, [enabled, autoTriggerAll, words.length, fetchTranslation, hasAutoTranslated]);

useEffect(() => {
  setHasAutoTranslated(false); // safe reset
}, [sentence]);

useEffect(() => {
  const handleOutsideClick = (e: MouseEvent) => {
    if (
      containerRef.current &&
      !containerRef.current.contains(e.target as Node) &&
      tooltipRef.current &&
      !tooltipRef.current.contains(e.target as Node)
    ) {
      setStartIdx(null);
      setEndIdx(null);
      setTranslations([]);
      setError("");
    }
  };

  document.addEventListener("mousedown", handleOutsideClick);
  return () => document.removeEventListener("mousedown", handleOutsideClick);
}, []);

          return (
  <div className="p-4 relative">
    <div ref={containerRef} className="flex flex-wrap justify-center gap-1 text-lg text-center">
      {words.map((word, i) => (
        <button
          ref={(el) => {
            buttonRefs.current[i] = el;
          }}
          key={i}
          onClick={() => handleClick(i)}
          className={`px-0.5 -ml-[1.5px] transition whitespace-nowrap leading-normal align-baseline border-r-0 border-l-0 ${
            enabled && isSelected(i)
              ? "bg-white/10 backdrop-blur-sm border-[1.5px] border-black/10 rounded-md shadow-md shadow-black/20"
              : "text-black"
          }`}
        >
          {word}
        </button>
      ))}
    </div>


    {enabled && (translations.length > 0 || loading || error) && (
      <div
        ref={tooltipRef}
        className="absolute left-1/2 -translate-x-1/2 mt-2 bg-white text-black p-4 rounded-xl shadow z-50 w-fit max-w-[80vw] min-w-[8rem]"
      >
        {error && <div className="text-sm text-red-500">{error}</div>}
        {(translations.length > 0 || loading) && (
          <div className="text-sm">
            <strong className="flex items-center gap-2">
              {"Translation:"}
              {loading && <span className="animate-pulse text-lg">🧠</span>}
            </strong>

            {translations.length > 0 && (
              <ul className="list-disc list-inside mt-1">
                {translations.map((t: any, i: number) => {
                  const translation = typeof t === "string" ? t : t.translation;
                  const hasExample = !!exampleMap[translation];

                  return (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-lg leading-snug">•</span>
                      <div>
                        {!readOnlyMode ? (
  <button
    onClick={() => fetchExample(translation)}
    className="text-blue-600 hover:underline break-words text-left"
  >
    {translation}
  </button>
) : (
  <span className="text-blue-600 break-words text-left opacity-60">
    {translation}
  </span>
)}
{readOnlyMode && <span>{translation}</span>}
                        {hasExample && (
                          <div className="mt-1 text-sm">
                            <p className="text-gray-900">
                              &quot;{exampleMap[translation].english}&quot;
                            </p>
                            <p className="text-gray-600 italic">
                              &quot;{exampleMap[translation].spanish}&quot;
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    )}
  </div>
); }
