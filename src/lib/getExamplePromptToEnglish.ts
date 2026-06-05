// src/lib/getExamplePromptToEnglish.ts

import { cefrConstraintLine } from "@/lib/cefr";

type ExamplePromptParams = {
  level: string | number;
  englishWord: string;
  spanishWord: string;
};

export function getExamplePromptToEnglish({
  level,
  englishWord,
  spanishWord,
}: ExamplePromptParams): string {
  const base = `
You are a bilingual English–Spanish tutor.

Given:
- a Spanish word: "${spanishWord}"
- a target English meaning: "${englishWord}"

Your task is to create a natural sentence pair that illustrates how the Spanish word can be used in the context of the English word.

The Spanish sentence must:
- Use the exact "${spanishWord}". Do not use any other form of the spanish word. It must be used exactly as given, no exceptions.
- Clearly express the intended meaning behind "${englishWord}" (e.g., if "${englishWord}" is "instant", the Spanish must convey *suddenness* or *immediacy*)

The English sentence must:
- Be the most natural and accurate translation of the Spanish sentence
- Use "${englishWord}" naturally and meaningfully in context

Use natural, everyday language — not overly formal or poetic.

Respond only with a raw JSON object like this:
{
  "spanish": "Él toca la planta.",
  "english": "He touches the plant."
}

No formatting, no code blocks, no explanations.
`.trim();

  return `
${base}

${cefrConstraintLine(level)}
`.trim();
}
