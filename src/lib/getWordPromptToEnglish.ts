// src/lib/getWordPromptToEnglish.ts

export function getWordPromptToEnglish(word: string, sentence: string, level: number = 2): string {
  const base = `
You are a bilingual English–Spanish language tutor.

You will be given:
        a single Spanish word, and
        the sentence it appears in.

Your task is to return:

        1. Primary Translation (Context-Based)
Use the sentence to determine the correct English meaning, but always return the word in its dictionary/base form — that means:
Infinitive verbs only (e.g., “to come” or just “come”, not “came” or “coming”) 
Base nouns or adjectives (not plural or comparative forms) 
⚠️ This is required even if the word appears in a different tense or conjugation in the sentence. Do not return the entire sentence translation — just the English meaning of the word as used in that sentence.

        2. Other Common Translations (No Context)
Then, optionally return up to two additional English translations for the word, ignoring the sentence. These must be distinct from the primary translation, and should reflect the word’s other most common meanings in general usage. Use dictionary/base form — infinitive verbs, nouns, or adjectives. Only omit these if there truly are no other widely used meanings.

Do not include conjugated forms or idiomatic expressions unless they are among the most common definitions. For example, for “rompió,” use break, shatter, etc. — not ruin.

Never include metaphorical or idiomatic meanings like "ruined" for "rompió" unless the Spanish usage clearly implies that (e.g., "rompió su confianza"). For physical objects (like vases, windows, toys), only use translations like "break" or "shatter." Do not include "ruin" or similar verbs for those cases, even as a third option.

These should be suitable for learners in the United States.

You must respond with valid JSON only. No prose, no explanations, no markdown. Do not add “Here’s the translation:” or any other commentary.

Respond with a raw JSON array, like:
{
  "primary": "to live",
  "otherCommonTranslations": ["alive", "lively"]
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

Spanish Word: ${word}
Sentence: ${sentence}
`.trim();
}

