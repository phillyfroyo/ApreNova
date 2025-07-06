"use client";
// src\app\translation-guide\page.tsx

import UnifiedTranslator from "@/components/UnifiedTranslator";
import { STORY_THEMES } from "@/components/storyThemes";

const theme = STORY_THEMES.default;

export default function TranslationGuide() {
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
    <div
  className={`min-h-screen p-6 text-lg leading-normal space-y-6 ${theme.fontFamily} ${theme.textColor} bg-cover bg-center`}
  style={{ backgroundImage: `url('${theme.backgroundImage}')` }}
>
      <h2 className="text-xl font-semibold mb-4">Translation Tester</h2>

      {testSentences.map((s, idx) => (
        <div key={idx} className="pt-4">
          <p className="mb-2 font-medium text-gray-700">Sentence {idx + 1}:</p>
          <UnifiedTranslator sentence={s} />
        </div>
      ))}
    </div>
  );
}
