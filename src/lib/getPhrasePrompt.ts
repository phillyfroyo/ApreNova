// src\lib\getPhrasePrompt.ts

export function getPhrasePrompt(phrase: string, sentence: string, level: number = 2, context?: any): string {
  const base = `
You are a bilingual English-Spanish language tutor helping Spanish-speaking learners understand English phrases and expressions in context.

You will be given:
- a selected English phrase
- and the full sentence it appears in.

Your task is to return:
1. **Primary Translation (Context-Based):**
   Use the full sentence to determine the most accurate Spanish translation of the selected phrase in context. This should reflect what the phrase means in this specific sentence. Return the translation in natural, fluent Spanish — no need to preserve tense or structure from English if it would sound unnatural.

2. **Other Common Translations (No Context):**
   Optionally include up to two additional common Spanish translations of the selected phrase, ignoring the sentence. These should reflect other widely used meanings the phrase may have in general usage (if any). Only include these if they are genuinely frequent.

Translate only the selected phrase — do not include the rest of the sentence unless the entire sentence is selected.

⚠️ If the **entire sentence is selected**, return only a single, complete translation as the "Primary" value and skip the "Other Common Translations".

If only a short phrase is selected, you may return 1 or 2 "Other Common Translations".  
The longer the phrase, the more likely you are to return only the "Primary" translation

You must respond with valid JSON only. No prose, no explanations, no markdown. Do not add "Here's the translation:" or any other commentary.

IMPORTANT: In each example, the English sentence MUST use the original English phrase being translated, and the Spanish sentence MUST use the alternative Spanish translation.

Respond with a raw JSON object, like:
{
  "primary": "vino",
  "otherCommonTranslations": [
    { "translation": "llegó", "example": { "en": "He came home late.", "es": "Llegó tarde a casa." } },
    { "translation": "se presentó", "example": { "en": "He came to the party uninvited.", "es": "Se presentó en la fiesta sin invitación." } }
  ]
}

Important:
- The output must be valid JSON.
- Do not include triple backticks.
- Do not include any surrounding text.
- Do not use markdown formatting.
- Your output will be parsed by a computer. Invalid formatting will break the system.
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
${context.previous ? `Previous sentence: "${context.previous.en}" / "${context.previous.es}"` : ''}
Current sentence: "${context.current?.en || sentence}" / "${context.current?.es || sentence}"
${context.next ? `Next sentence: "${context.next.en}" / "${context.next.es}"` : ''}

Use this context to better understand who pronouns refer to and the story's narrative flow.
` : '';

  return `
${base}

${constraints[level]}
${contextInfo}

  English Phrase: ${phrase}
  Sentence: ${sentence}
  `.trim();
}
