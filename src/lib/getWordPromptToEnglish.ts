// src/lib/getWordPromptToEnglish.ts

export function getWordPromptToEnglish(word: string, level: number = 2): string {
  const base = `
You are a bilingual English-Spanish language tutor.

Given a single Spanish word, return up to 3 of the most common English translations — in dictionary/base form (infinitive verbs, base nouns, adjectives only).

These translations should reflect the word's most common meanings across different usage types — for example, "banco" might include "bank", "bench", or "pew".

Avoid returning conjugated forms or overly figurative interpretations. You may assume general usage, but do not rely on sentence context or surrounding phrases.

If the word is ambiguous, assume the literal physical meaning unless context clearly demands otherwise.

These should be suitable for learners in the United States.
`.trim();

  const constraints = {
    1: `
Only use the 100 most common English words whenever possible.
Only include literal translations that align directly with the Spanish word.
If no suitable translation exists within that list, return the best simple and direct literal equivalent.
`.trim(),

    2: `
Only use the 200 most common English words whenever possible.
Include only literal translations. You may include **one** extremely common idiomatic translation *if it is natural and does not rely on interpretation*.
Avoid figurative or overly contextual meanings.
`.trim(),

    3: `
Use up to the 500 most common English words.
Include literal and idiomatic translations, ordered by general frequency of usage.
`.trim(),

    4: `
Use up to the 1000 most common English words.
Include literal, idiomatic, and contextual/figurative translations as appropriate.
`.trim(),

    5: `
No vocabulary constraints — use natural fluent American English.
Include literal, idiomatic, and figurative meanings to reflect real-world usage.
`.trim(),
  };

  return `
${base}

${constraints[level]}

Return a raw JSON array like this:
["translation1", "translation2", "translation3"]

Do not include keys, markdown, objects, or explanation.
`.trim();
}
