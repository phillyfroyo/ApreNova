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
You are a bilingual Spanish–English tutor.

Given:
- an English word: "${englishWord}"
- a target Spanish meaning: "${spanishWord}"

Your task is to create a natural sentence pair that illustrates how the English word can be used in the context of the Spanish word.

The English sentence must:
- Use the exact "${englishWord}". Do not use any other form of the english word. It must be used exactly as given, no exceptions.
- Clearly express the intended meaning behind "${spanishWord}" (e.g., if "${spanishWord}" is "instantáneo", the English must convey *suddenness* or *immediacy*)

The Spanish sentence must:
- Be the most natural and accurate translation of the English sentence
- Use "${spanishWord}" naturally and meaningfully in context

Use natural, everyday language — not overly formal or poetic.

Respond only with a raw JSON object like this:
{
  "english": "He touches the plant.",
  "spanish": "Él toca la planta."
}

No formatting, no code blocks, no explanations.
`.trim();

  const constraints = {
    1: `CEFR level A1.`,
    2: `CEFR level A2.`,
    3: `CEFR level B1.`,
    4: `CEFR level B2.`,
    5: `CEFR level C1.`,
  };

  return `
${base}

${constraints[level]}
`.trim();
}

