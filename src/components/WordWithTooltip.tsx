"use client";
import { useState, useRef, useEffect } from "react";

export default function WordGroupSelector({ sentence }: { sentence: string }) {
  const words = sentence.split(" ");
  const [startIdx, setStartIdx] = useState<number | null>(null);
  const [endIdx, setEndIdx] = useState<number | null>(null);
  const [translation, setTranslation] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const fetchTranslation = async (start: number, end: number) => {
    const phrase = words.slice(start, end + 1).join(" ");
    const endpoint = start === end ? "/api/translate-word" : "/api/translate-phrase";
    const body = start === end
      ? { word: phrase, sentence }
      : { phrase, sentence };

    try {
      setLoading(true);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTranslation(data.translation);
    } catch (err: any) {
      console.error(err);
      setError("⚠️ Failed to fetch translation.");
    } finally {
      setLoading(false);
    }
  };

  const handleClick = async (index: number) => {
    if (startIdx === null) {
      setStartIdx(index);
      setEndIdx(index);
      setTranslation("");
      setError("");
    } else if (endIdx === null || index > endIdx) {
      setEndIdx(index);
      fetchTranslation(startIdx, index);
    } else if (index < startIdx) {
      setStartIdx(index);
      fetchTranslation(index, endIdx!);
    } else {
      setStartIdx(null);
      setEndIdx(null);
      setTranslation("");
      setError("");
    }
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

  return (
    <div className="p-4 relative">
      <div ref={containerRef} className="flex flex-wrap gap-1 text-lg">
        {words.map((word, i) => (
          <button
            key={i}
            onClick={() => handleClick(i)}
            className={`px-1 underline transition rounded ${
              isSelected(i) ? "bg-yellow-200" : "text-blue-600 hover:text-blue-800"
            }`}
          >
            {word}
          </button>
        ))}
      </div>

      {translation && (
        <div
          ref={tooltipRef}
          className="absolute top-full mt-2 transform -translate-x-1/2 z-50 bg-white text-black p-3 border shadow rounded w-max max-w-sm"
        >
          <div className="text-sm">
            <strong>Translation:</strong> {translation}
          </div>
        </div>
      )}

      {loading && <div className="mt-2 text-sm">Loading...</div>}
      {error && <div className="mt-2 text-sm text-red-500">{error}</div>}
    </div>
  );
}
