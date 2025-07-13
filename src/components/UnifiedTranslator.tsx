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
  const [sentenceWidth, setSentenceWidth] = useState<number | null>(null);
  const [translations, setTranslations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const sentenceRef = useRef<HTMLDivElement>(null);

  const pathname = usePathname() ?? "";
  const pathParts = pathname.split("/");
  const currentLevel = pathParts[4] || "l2"; // Fallback to l1 if undefined
  const currentLang = pathParts[1] || "es"; // 👈 'es' or 'en'
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

  const [hasAutoTranslated, setHasAutoTranslated] = useState(false);


useEffect(() => {
  if (enabled && autoTriggerAll && !hasAutoTranslated) {
    setStartIdx(0);
    setEndIdx(words.length - 1);
    fetchTranslation(0, words.length - 1);
    setHasAutoTranslated(true);
  }
}, [enabled, autoTriggerAll, words.length, fetchTranslation, hasAutoTranslated]);

useEffect(() => {
  setHasAutoTranslated(false);
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

// ✅ This should be completely separate
useEffect(() => {
  if (sentenceRef.current) {
    const resizeObserver = new ResizeObserver(() => {
      setSentenceWidth(sentenceRef.current!.offsetWidth);
    });

    resizeObserver.observe(sentenceRef.current);
    setSentenceWidth(sentenceRef.current.offsetWidth); // initial sync

    return () => resizeObserver.disconnect();
  }
}, [sentence]);

          return (
  <div className="p-4 relative">
    <div ref={containerRef} className="relative">
      <div ref={sentenceRef} className="inline-flex flex-wrap justify-center gap-1 text-lg text-center">
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
    </div>

    {enabled && (translations.length > 0 || loading || error) && (
      <div
  ref={tooltipRef}
  style={sentenceWidth ? { width: sentenceWidth } : undefined}
  className="absolute left-1/2 -translate-x-1/2 mt-2 bg-white text-black p-4 rounded-xl shadow z-50"
>
        {error && <div className="text-sm text-red-500">{error}</div>}

        <div className="text-sm text-left">
          {loading && (
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold">Translating…</span>
              <span className="animate-pulse text-lg">🧠</span>
            </div>
          )}

          {translations.length > 0 && (
            <div className="mt-1 space-y-2">
              <p className="font-semibold">Translation:</p>
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
                    Other common uses of{" "}
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