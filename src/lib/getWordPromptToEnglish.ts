// src/lib/getWordPromptToEnglish.ts

export function getWordPromptToEnglish(word: string, level: number = 2): string {
  const base = `
You are a bilingual English-Spanish language tutor.

Given a single Spanish word, return up to 3 of the most common English translations — in dictionary/base form (infinitive verbs, base nouns, adjectives).

These translations should reflect the word's most common meanings across different usage types — for example, "banco" might include "bank", "bench", or "pew".

Avoid returning conjugated forms or overly figurative interpretations. You may assume general usage, but do not rely on sentence context or surrounding phrases.

Never include metaphorical or idiomatic meanings like "ruined" for "rompió" unless the Spanish usage clearly implies that (e.g., "rompió su confianza"). For physical objects (like vases, windows, toys), only use translations like "break" or "shatter." Do not include "ruin" or similar verbs for those cases, even as a third option.

These should be suitable for learners in the United States.
`.trim();

  const constraints = {
    1: `
Only use the 100 most common English words **whenever possible**.
Only include literal translations that align directly with the Spanish word. Do not include idiomatic or figurative interpretations.
`,
    2: `
Only use the 200 most common English words **whenever possible**.
Include only literal translations. You may include **one** widely used idiomatic translation *if it is extremely common and does not require interpreting the sentence's intent*.
Do not include figurative or contextual interpretations like “got away” or “ran off”.
`,
    3: `
Use up to the 500 most common English words.
Include literal and idiomatic translations, ordered by general frequency of usage.
`,
    4: `
Use up to the 1000 most common English words.
Include literal, idiomatic, and contextual/figurative translations as appropriate.
`,
    5: `
No vocabulary constraints — use natural fluent English.
Include literal, idiomatic, and figurative meanings to reflect real-world usage.
`,
  };

  return `
${base}

${constraints[level]}

Return a raw JSON array like this:
["translation1", "translation2", "translation3"]

Do not include keys, markdown, objects, or explanation.
`.trim();
}

