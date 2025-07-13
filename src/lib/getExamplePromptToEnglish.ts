// src/lib/getExamplePromptToEnglish.ts

type ExamplePromptParams = {
  level: number;
  englishWord: string;
  spanishWord: string;
};

export function getExamplePromptToEnglish({
  level,
  englishWord,
  spanishWord,
}: ExamplePromptParams): string {
  const base = `
You are a bilingual English-Spanish tutor.

Given a Spanish word and its English translation, return:

1. A short, natural Spanish sentence that includes the **exact Spanish word**: "${spanishWord}"
2. A matching English sentence that uses the **exact English word**: "${englishWord}"

Both sentences must describe the same context or scenario. Do not paraphrase or substitute synonyms. Do not change the Spanish word.

⚠️ You must use the exact Spanish word and English word in your examples.

Respond only with a raw JSON object like this:
{
  "spanish": "Ella administra ese negocio muy bien.",
  "english": "She runs that business really well."
}

No formatting, no code blocks, no explanations.
`.trim();

  const constraints = {
    1: `Use only the 100 most common English words. Only present tense. Keep it extremely simple.`,
    2: `Use only the 200 most common English words. Present tense only.`,
    3: `Use up to the 500 most common English words. You may include present and simple past.`,
    4: `Use up to the 1000 most common English words. Present, simple past, and past continuous allowed.`,
    5: `No vocabulary restrictions. Use natural, fluent English.`,
  };

  return `
${base}

${constraints[level]}
`.trim();
}
