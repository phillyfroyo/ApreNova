"use client";
// src\components\UnifiedTranslator.tsx

import { useState, useRef, useEffect } from "react";
import { usePathname } from 'next/navigation';

interface Props {
  sentence: string;
}

export default function UnifiedTranslator({ sentence }: Props) {
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


  const [exampleMap, setExampleMap] = useState<{ [key: string]: { english: string; spanish: string } }>({});


  const getSelectedText = () => words.slice(startIdx!, endIdx! + 1).join(" ");

  const fetchTranslation = async (start: number, end: number) => {
    const phrase = words.slice(start, end + 1).join(" ");
    const cleanWord = phrase.replace(/[.,!?;:()"]+/g, "");
    const isSingleWord = start === end;


    const endpoint = isSingleWord
  ? "/api/translate-word"
  : `/api/translate-phrase?input=${encodeURIComponent(cleanWord)}&sentence=${encodeURIComponent(sentence)}&level=${currentLevel}&mode=auto`;

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
      console.log("🎯 Data from API:", data);

// If it's a multi-word phrase, the response is a single string
if (!isSingleWord) {
  if (Array.isArray(data)) {
    setTranslations(data);
    console.log("✅ Set phrase translations:", data);
  } else {
    setTranslations([data.translation]);
  }
} else {
  setTranslations(data.translations || []);
  console.log("✅ Set word translations:", data.translations || []);
}
    } catch (err) {
      console.error(err);
      setError("⚠️ Failed to fetch translation.");
    } finally {
      setLoading(false);
    }
  };

  const handleClick = (index: number) => {
    if (startIdx === null && endIdx === null) {
  // First word clicked
  setStartIdx(index);
  setEndIdx(index);
  fetchTranslation(index, index);
  return;
}

// If clicking the same exact word again — clear the selection
if (startIdx === index && endIdx === index) {
  setStartIdx(null);
  setEndIdx(null);
  setTranslations([]);
  setError("");
  return;
}

// Expand selection to include both the current selection and clicked index
const s = Math.min(startIdx!, endIdx!, index);
const e = Math.max(startIdx!, endIdx!, index);
setStartIdx(s);
setEndIdx(e);
fetchTranslation(s, e);
  };
const fetchExample = async (spanishWord: string) => {
  const englishWord = words.slice(startIdx!, endIdx! + 1).join(" ");
  const sentenceText = sentence;
  // 🔁 Toggle: hide if already open
  if (exampleMap[spanishWord]) {
    setExampleMap((prev) => {
      const updated = { ...prev };
      delete updated[spanishWord];
      return updated;
    });
    return;
  }

  try {
    const res = await fetch("/api/example-sentence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spanishWord,
        englishWord,
        originalSentence: sentenceText,
      }),
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    setExampleMap((prev) => ({
      ...prev,
      [spanishWord]: {
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

  const getTooltipPosition = () => {
  if (
    startIdx === null ||
    endIdx === null ||
    !tooltipRef.current ||
    !buttonRefs.current[startIdx] ||
    !buttonRefs.current[endIdx]
  ) {
    return { left: 0 };
  }

  const firstEl = buttonRefs.current[startIdx];
  const lastEl = buttonRefs.current[endIdx];
  const parentRect = firstEl?.offsetParent?.getBoundingClientRect();
  const firstRect = firstEl?.getBoundingClientRect();
  const lastRect = lastEl?.getBoundingClientRect();

  if (!firstRect || !lastRect || !parentRect) return { left: 0 };

  const center = (firstRect.left + lastRect.right) / 2 - parentRect.left;
  return { left: center };
};

  useEffect(() => {
    if (tooltipRef.current) {
      const { left } = getTooltipPosition();
      tooltipRef.current.style.left = `${left}px`;
    }
  }, [startIdx, endIdx, translations]);

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
          isSelected(i)
    ? "bg-white/10 backdrop-blur-sm border-[1.5px] border-black/10 rounded-md shadow-md shadow-black/20"
    : "text-black"
     }`}
      >
       {word}
      </button>
        ))}
      </div>

  {(translations.length > 0 || loading || error) && (
  <div
    ref={tooltipRef}
    className="absolute left-1/2 -translate-x-1/2 mt-2 bg-white text-black p-4 rounded-xl shadow z-50 w-fit max-w-[80vw] min-w-[8rem]"
  >
    {loading && <div className="text-sm">Loading...</div>}
    {error && <div className="text-sm text-red-500">{error}</div>}
    {translations.length > 0 && (
      <div className="text-sm">
        <strong>{translations.length === 1 ? "Translation" : "Translations"}:</strong>
        <ul className="list-disc list-inside mt-1">
          {translations.map((t: any, i: number) => {
            const translation = typeof t === "string" ? t : t.translation;
            const hasExample = !!exampleMap[translation];

            return (
              <li key={i}>
                <button
                  onClick={() => fetchExample(translation)}
                  className="text-blue-600 hover:underline break-words"
                >
                  {translation}
                </button>

                {hasExample && (
                  <div className="mt-1 text-sm">
                    <p className="text-gray-900">&quot;{exampleMap[translation].english}&quot;</p>
                    <p className="text-gray-600 italic">&quot;{exampleMap[translation].spanish}&quot;</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    )}
  </div>
)}
    </div>
  );
}
