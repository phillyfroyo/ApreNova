// TranslationTest.tsx
"use client";

import UnifiedTranslator from "@/components/UnifiedTranslator";
import React from "react";


interface Sentence {
  en: string;
  es: string;
}

export default function TranslationTest() {
  const testSentences: Sentence[] = [
    {
      en: "My name is Pedro, and I live in a quiet town in Guatemala.",
      es: "Mi nombre es Pedro y vivo en un pueblo tranquilo en Guatemala."
    },
  ];

  return (
    <div className="min-h-screen p-10 bg-white text-black">
      <h1 className="text-2xl font-bold mb-6">Translation Test</h1>
      {testSentences.map((s, idx) => (
        <div key={idx} className="mb-6">
          <UnifiedTranslator sentence={s.en} />
          <p className="italic text-muted-foreground text-sm mt-2">{s.es}</p>
        </div>
      ))}
    </div>
  );
}
