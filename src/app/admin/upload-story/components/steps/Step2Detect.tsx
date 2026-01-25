"use client";

import { useState } from "react";
import type { StoryData } from "../../types";
import { LEVEL_LABELS } from "../../config/constants";

interface Step2DetectProps {
  storyData: StoryData;
  updateStoryData: (updates: Partial<StoryData>) => void;
  isProcessing: boolean;
  setIsProcessing: (v: boolean) => void;
}

export function Step2Detect({
  storyData,
  updateStoryData,
  isProcessing,
  setIsProcessing,
}: Step2DetectProps) {
  const [error, setError] = useState("");

  const detectLevel = async () => {
    setIsProcessing(true);
    setError("");
    try {
      const response = await fetch("/api/admin/detect-level", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: storyData.rawText, language: storyData.sourceLanguage }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to detect level");
        return;
      }
      updateStoryData({ detectedLevel: data.level });
    } catch {
      setError("Failed to detect level. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const lines = storyData.rawText.split("\n").filter((l) => l.trim());
  // Use preprocessed chapter count from Step 1 (accurate), not naive regex
  const chapterCount = storyData.parsedResult?.stats.chaptersDetected ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Parse & Detect Level</h2>
        <p className="text-gray-500 text-sm">We&apos;ll analyze your text to detect its CEFR level.</p>
      </div>

      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="font-medium text-gray-900 mb-4">Text Analysis</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{lines.length}</div>
            <div className="text-sm text-gray-500">Lines</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{chapterCount}</div>
            <div className="text-sm text-gray-500">Chapters</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {storyData.rawText.split(/\s+/).filter((w) => w.trim()).length}
            </div>
            <div className="text-sm text-gray-500">Words</div>
          </div>
        </div>
      </div>

      {storyData.detectedLevel === null ? (
        <div className="text-center">
          <button
            onClick={detectLevel}
            disabled={isProcessing}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {isProcessing ? "Analyzing..." : "Detect CEFR Level"}
          </button>
          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
        </div>
      ) : (
        <div className="bg-green-50 rounded-lg p-6 text-center">
          <div className="text-4xl mb-2">📊</div>
          <h3 className="text-lg font-semibold text-green-800">
            Detected Level: L{storyData.detectedLevel}
          </h3>
          <p className="text-green-600">
            {LEVEL_LABELS[storyData.detectedLevel]?.full || `Level ${storyData.detectedLevel}`}
          </p>
          <button
            onClick={() => updateStoryData({ detectedLevel: null })}
            className="text-sm text-green-700 underline mt-3"
          >
            Re-analyze
          </button>
        </div>
      )}

      <div className="border-t pt-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Manual Override</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6].map((level) => (
            <button
              key={level}
              onClick={() => updateStoryData({ detectedLevel: level })}
              className={`px-4 py-2 rounded-lg border-2 transition-all ${
                storyData.detectedLevel === level
                  ? level === 6
                    ? "border-purple-500 bg-purple-50 text-purple-700"
                    : "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              L{level}
              {level === 6 && <span className="text-xs ml-1">(C2+)</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Step2Detect;
