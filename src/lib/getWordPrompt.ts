// src/lib/getWordPrompt.ts
export function getWordPrompt(word: string, sentence: string, level: number = 2): string {
  const base = `
You are a bilingual English–Spanish language tutor.

You will be given:
        a single English word, and the sentence it appears in.

Your task is to return:

        1. Primary Translation (Context-Based)
Use the sentence to determine the most accurate Spanish translation of the word.You must always return the word in its base dictionary form, regardless of the English verb tense or conjugation.
For verbs, return the infinitive form (e.g., “venir” instead of “vino” or “viniendo”) For nouns and adjectives, return the base singular form
⚠️ This rule applies even if the English word appears in the past, future, or continuous tense. Always return the neutral base form, suitable for learners building vocabulary.
Example: If the sentence is “He came to the party,” and the word is “came,” return "venir" — not "vino".
Do not return the entire sentence translation — just the Spanish meaning of the word as used in that sentence.

        2. Other Common Translations (No Context)
Then, optionally return up to two additional Spanish translations for the word, ignoring the sentence. These must be distinct from the primary translation, and should reflect the word’s other most common meanings in general usage. Use dictionary/base form — infinitive verbs, nouns, or adjectives. Only omit these if there truly are no other widely used meanings.

Do not include conjugated forms or idiomatic expressions unless they are among the most common definitions. For example, for "broke", use romper, quebrar, etc. — not arruinar.

Never include metaphorical or idiomatic meanings like "rompió" for "ruined" unless the English usage clearly implies that (e.g., "broke his trust"). For physical objects (like vases, windows, toys), only use translations like "romper" or "hacer añicos." Do not include "arruinar" or similar verbs for those cases, even as a third option.

These should be suitable for learners in the Mexico.

You must respond with valid JSON only. No prose, no explanations, no markdown. Do not add “Here’s the translation:” or any other commentary.

Respond with a raw JSON array, like:
{
  "primary": "Vivir",
  "otherCommonTranslations": ["en vivo", "habitar"]
}

Important:
- The output must be valid JSON.
- Do not include triple backticks.
- Do not include any surrounding text.
- Do not use markdown formatting.

Your output will be parsed by a computer. Invalid formatting will break the system.
`.trim();

  const constraints = {
  1: `
Only use the 100 most common Spanish words **whenever possible**.
Only include literal translations that align directly with the English word. Do not include idiomatic or figurative interpretations.
`,
  2: `
Only use the 200 most common Spanish words **whenever possible**.
Include only literal translations. You may include **one** widely used idiomatic translation *if it is extremely common and does not require interpreting the sentence's intent*.
Do not include figurative or contextual interpretations like “me escapé” or “huí”.
`,
  3: `
Use up to the 500 most common Spanish words.
Include literal and idiomatic translations, ordered by general frequency of usage.
`,
  4: `
Use up to the 1000 most common Spanish words.
Include literal, idiomatic, and contextual/figurative translations as appropriate.
`,
  5: `
No vocabulary constraints — use natural fluent Mexican Spanish.
Include literal, idiomatic, and figurative meanings to reflect real-world usage.
`,
};


  return `
${base}

${constraints[level]}

English Word: ${word}
Sentence: ${sentence}
`.trim();
}
