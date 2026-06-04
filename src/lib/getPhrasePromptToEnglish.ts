// src/lib/getPhrasePromptToEnglish.ts

export function getPhrasePromptToEnglish(phrase: string, sentence: string, level: number = 2, context?: any): string {
  const base = `
You are a bilingual Spanish-English language tutor helping English-speaking learners understand Spanish phrases and expressions in context.

You will be given:
- a selected Spanish phrase
- and the full sentence it appears in.

Your task is to return:
1. **Primary Translation (Context-Based):**
   Use the full sentence to determine the most accurate English translation of the selected phrase in context. This should reflect what the phrase means in this specific sentence. Return the translation in natural, fluent English — no need to preserve tense or structure from Spanish if it would sound unnatural.

2. **Other Common Translations (No Context):**
   Optionally include up to two additional common English translations of the selected phrase, ignoring the sentence. These should reflect other widely used meanings the phrase may have in general usage (if any). Only include these if they are genuinely frequent.

Translate only the selected phrase — do not include the rest of the sentence unless the entire sentence is selected.

⚠️ If the **entire sentence is selected**, return only a single, complete translation as the "Primary" value and skip the "Other Common Translations".

If only a short phrase is selected, you may return 1 or 2 "Other Common Translations".  
The longer the phrase, the more likely you are to return only the "Primary" translation

IMPORTANT: In each example, the Spanish sentence MUST use the original Spanish phrase being translated, and the English sentence MUST use the alternative English translation. For instance, primary "he came"; an alternate { "translation": "he arrived", "example": { "es": "Llegó a las ocho.", "en": "He arrived at eight." } }.
`.trim();

  const constraints: Record<number, string> = {
    1: `CEFR level A1.`,
    2: `CEFR level A2.`,
    3: `CEFR level B1.`,
    4: `CEFR level B2.`,
    5: `CEFR level C1.`,
  };

  const contextInfo = context ? `

STORY CONTEXT (for better understanding of pronouns and references):
${context.previous ? `Previous sentence: "${context.previous.es}" / "${context.previous.en}"` : ''}
Current sentence: "${context.current?.es || sentence}" / "${context.current?.en || sentence}"
${context.next ? `Next sentence: "${context.next.es}" / "${context.next.en}"` : ''}

Use this context to better understand who pronouns refer to and the story's narrative flow.
` : '';

  return `
${base}

${constraints[level]}
${contextInfo}

  Spanish Phrase: ${phrase}
  Sentence: ${sentence}
  `.trim();
}
