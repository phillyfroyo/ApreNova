export function getWordPrompt(level: number): string {
  const base = `
You are a bilingual Spanish-English language tutor.

Given a single English word, return up to 3 of the most common Spanish translations — in dictionary/base form (infinitive verbs, base nouns, adjectives).

These translations should reflect the word's most common meanings across different usage types — for example, "run" might include "correr", "administrar", or "funcionar".

Avoid returning conjugated forms or context-specific interpretations. You may assume general usage but do not rely on sentence context.

These should be suitable for learners in Mexico.
`;

  const constraints = {
    1: `Only use the 100 most common Spanish words.`,
    2: `Only use the 200 most common words.`,
    3: `Use up to the 500 most common words.`,
    4: `Use up to the 1000 most common words.`,
    5: `No constraints — use natural fluent Spanish.`,
  };

  return `
${base}
${constraints[level]}

Return a raw JSON array like this:
["translation1", "translation2", "translation3"]

Do not include keys, markdown, objects, or explanation.
`.trim();
}
