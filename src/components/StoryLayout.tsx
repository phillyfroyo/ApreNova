"use client";
// src\components\StoryLayout.tsx

import UnifiedTranslator from "@/components/UnifiedTranslator";

type Props = {
  title: string;
  storySlug: string;
  sentences: { en: string; es: string }[];
  initialLevel: string;
};

export default function StoryLayout({ title, storySlug, sentences, initialLevel }: Props) {
  const testSentences = [
  "My name is Pedro, and I live in a quiet town in Guatemala.",
  "I ran out of milk this morning.",
  "She picked up a new hobby during quarantine.",
  "The car broke down on the highway.",
  "Things are looking up for our project.",
  "He turned in the assignment late.",
  "Please look up the definition.",
  "I need to get over my fear of speaking.",
];

return (
  <div className="p-6 text-lg leading-relaxed space-y-6">
    <h2 className="text-xl font-semibold mb-4">{title}</h2>

    {testSentences.map((s, idx) => (
      <div key={idx} className="border-t pt-4">
        <p className="mb-2 font-medium text-gray-700">Sentence {idx + 1}:</p>
        <UnifiedTranslator sentence={s} />
      </div>
    ))}
  </div>
);
}
