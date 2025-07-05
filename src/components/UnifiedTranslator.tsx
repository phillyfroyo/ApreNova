"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  sentence: string;
}

export default function UnifiedTranslator({ sentence }: Props) {
  const words = sentence.split(" ");
  const [startIdx, setStartIdx] = useState<number | null>(null);
  const [endIdx, setEndIdx] = useState<number | null>(null);
  const [translation, setTranslation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const getSelectedText = () => words.slice(startIdx!, endIdx! + 1).join(" ");

  const fetchTranslation = async (start: number, end: number) => {
    const phrase = words.slice(start, end + 1).join(" ");
    const cleanWord = phrase.replace(/[.,!?;:()"]+/g, "");
    const isSingleWord = start === end;

    const endpoint = isSingleWord ? "/api/translate-word" : "/api/translate-phrase";
    const body = isSingleWord
      ? { word: cleanWord, sentence }
      : { phrase, sentence };

    try {
      setLoading(true);
      setError("");
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTranslation(data.translation);
    } catch (err) {
      console.error(err);
      setError("⚠️ Failed to fetch translation.");
    } finally {
      setLoading(false);
    }
  };

  const handleClick = (index: number) => {
    if (startIdx === null && endIdx === null) {
      setStartIdx(index);
      setEndIdx(index);
      fetchTranslation(index, index);
      return;
    }

    if (startIdx === index && endIdx === index) {
      setStartIdx(null);
      setEndIdx(null);
      setTranslation("");
      setError("");
      return;
    }

    const [s, e] = index > startIdx! ? [startIdx!, index] : [index, startIdx!];
    setStartIdx(s);
    setEndIdx(e);
    fetchTranslation(s, e);
  };

  const isSelected = (i: number) => {
    if (startIdx === null || endIdx === null) return false;
    return i >= startIdx && i <= endIdx;
  };

  const getTooltipPosition = () => {
    if (startIdx === null || !containerRef.current || !tooltipRef.current) return { left: 0 };
    const span = containerRef.current.querySelectorAll("button")[startIdx];
    if (!span) return { left: 0 };
    const rect = span.getBoundingClientRect();
    return { left: rect.left + rect.width / 2 };
  };

  useEffect(() => {
    if (tooltipRef.current) {
      const { left } = getTooltipPosition();
      tooltipRef.current.style.left = `${left}px`;
    }
  }, [startIdx, endIdx, translation]);

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
        setTranslation("");
        setError("");
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <div className="p-4 relative">
      <div ref={containerRef} className="flex flex-wrap gap-1 text-lg">
        {words.map((word, i) => (
          <button
            key={i}
            onClick={() => handleClick(i)}
            className={`px-1 underline transition rounded whitespace-nowrap ${
              isSelected(i) ? "bg-yellow-200" : "text-blue-600 hover:text-blue-800"
            }`}
          >
            {word}
          </button>
        ))}
      </div>

      {(translation || loading || error) && (
        <div
          ref={tooltipRef}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-white text-black p-3 border shadow rounded w-max max-w-sm"
        >
          {loading && <div className="text-sm">Loading...</div>}
          {error && <div className="text-sm text-red-500">{error}</div>}
          {translation && (
            <div className="text-sm">
              <strong>Translation:</strong> {translation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
