"use client";

import WordWithTooltip from "@/components/WordWithTooltip";

export default function StoryLayout() {
  const sentence = "My name is Pedro, and I live in a quiet town in Guatemala.";

  return (
    <div className="p-6 text-lg leading-relaxed">
      {sentence.split(" ").map((word, idx) => {
        const cleanWord = word.replace(/[.,!?;:()]/g, "");
        const trailingPunct = word.match(/[.,!?;:()]+$/)?.[0] || "";

        return (
          <span key={idx} className="mr-1">
            <WordWithTooltip word={cleanWord} sentence={sentence} />{trailingPunct}
          </span>
        );
      })}
    </div>
  );
}
