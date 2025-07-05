"use client";

import WordWithTooltip from "@/components/WordWithTooltip";

type Props = {
  title: string;
  storySlug: string;
  sentences: { en: string; es: string }[];
  initialLevel: string;
};

export default function StoryLayout({ title, storySlug, sentences, initialLevel }: Props) {
  const sentence = "My name is Pedro, and I live in a quiet town in Guatemala.";

  return (
    <div className="p-6 text-lg leading-relaxed">
      {/* Example title use */}
      <h2 className="text-xl font-semibold mb-4">{title}</h2>

      {sentence.split(" ").map((word, idx) => {
        const cleanWord = word.replace(/[.,!?;:()]/g, "");
        const trailingPunct = word.match(/[.,!?;:()]+$/)?.[0] || "";

        return (
          <span key={idx} className="mr-1">
            <WordWithTooltip word={cleanWord} sentence={sentence} />
            {trailingPunct}
          </span>
        );
      })}
    </div>
  );
}
