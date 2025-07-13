type ExamplePromptParams = {
  level: number;
  englishWord: string;
  spanishWord: string;
};

export function getExamplePrompt({
  level,
  englishWord,
  spanishWord,
}: ExamplePromptParams): string {
  const base = `
You are a bilingual Spanish-English tutor.

Given an English word and its Spanish translation, return:

1. A short, natural English sentence that includes the **exact English word**: "${englishWord}" 
2. A matching Spanish sentence that uses the **exact Spanish word**: "${spanishWord}"

Both sentences must describe the same context or scenario. Do not paraphrase or substitute synonyms. Do not change the English word.

⚠️ You must use the exact English word and Spanish word in your examples.

Respond only with a raw JSON object like this:
{
  "english": "She runs that business really well.",
  "spanish": "Ella administra ese negocio muy bien."
}

No formatting, no code blocks, no explanations.
`.trim();

  const constraints = {
    1: `Use only the 100 most common Spanish words. Only present tense. Keep it extremely simple.`,
    2: `Use only the 200 most common Spanish words. Present tense only.`,
    3: `Use up to the 500 most common Spanish words. You may include present and preterite.`,
    4: `Use up to the 1000 most common Spanish words. Present, preterite, and imperfect allowed.`,
    5: `No vocabulary restrictions. Use natural, fluent Mexican Spanish.`,
  };

  return `
${base}

${constraints[level]}
`.trim();
}

