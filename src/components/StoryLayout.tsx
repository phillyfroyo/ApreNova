"use client";

import UnifiedTranslator from "@/components/UnifiedTranslator";

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
      <h2 className="text-xl font-semibold mb-4">{title}</h2>

      <UnifiedTranslator sentence={sentence} />
    </div>
  );
}
