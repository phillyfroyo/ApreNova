"use client";
import { useState, useEffect } from "react";

type Props = {
  word: string;
  sentence: string;
};

export default function WordWithTooltip({ word, sentence }: Props) {
  const [translation, setTranslation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);

  const fetchTranslation = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/translate-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, sentence }),
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

  const handleClick = () => {
    setShow(!show);
    if (!translation && !loading && !error) {
      fetchTranslation();
    }
  };

  return (
    <span className="relative">
      <button
        className="underline decoration-dotted text-blue-600 hover:text-blue-800"
        onClick={handleClick}
      >
        {word}
      </button>

      {show && (
        <div className="absolute z-50 bg-white border p-2 text-sm mt-2 shadow rounded w-max max-w-xs">
          {loading && <div>Loading...</div>}
          {error && <div className="text-red-500">{error}</div>}
          {translation && (
            <div>
              <strong>Translation:</strong> {translation}
            </div>
          )}
        </div>
      )}
    </span>
  );
}
