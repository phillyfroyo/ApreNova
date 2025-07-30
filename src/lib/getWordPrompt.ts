export function getWordPrompt(word: string, sentence: string, level: number = 2, context?: any): string {
  const base = `
You are a bilingual Spanish–English language tutor.

You will be given:
        a single English word, and
        the sentence it appears in.

Your task is to return:

        1. Context Translation
Use the sentence as the primary guide to determine how the word is being used in context. Ignore default or dictionary translations. 
Choose the Spanish word(s) that best conveys the meaning of the English word in this specific sentence. 
Prioritize contextual meaning, even if it differs from the most common translation.
This should reflect the actual meaning in the sentence, including appropriate conjugations, tenses, or contextual meaning.
Do not return generic translations like "momento," "cosa," or "hacer" unless they are clearly the most natural fit for the sentence context.

        2. Root Word Analysis (if applicable)
Analyze if the given word is a conjugated/inflected form of a root word. If it is:
- Provide the root word (infinitive for verbs, singular for nouns, etc.)
- Provide the Spanish translation of that root word
- Set isDerivative to true

If the word is already in its root form, set isDerivative to false and omit rootWord and rootTranslation.

        3. Other Common Translations (No Context)
Then, optionally return one or two additional distinct Spanish translations for the original word (not the root).
These translations should reflect different common meanings or usage types (e.g., one physical, one musical; one emotional, one auditory).

Do not include synonyms or grammatical variations of the primary translation (e.g., don't return sonó and estaba sonando together).
Instead, prioritize functionally different senses that would be helpful for learners to contrast and understand.

Avoid using the same functional context repeatedly (e.g., don't use two musical examples). Favor common, realistic contexts that differ in meaning — like sonar, tocar música, sonar emocional, etc.

Add a short 1-3 word explanation in parentheses after each alternate Spanish meaning. These should describe the specific type of meaning. For example:

- toca (contacto físico)
- toca (instrumento musical)

These should be suitable for learners in Mexico.

You must respond with valid JSON only. No prose, no explanations, no markdown. Do not add "Here's the translation:" or any other commentary.

Respond with a JSON object like:
{
  "contextTranslation": "te toca",
  "isDerivative": true,
  "rootWord": "touch",
  "rootTranslation": "tocar",
  "otherCommonTranslations": ["toca (contacto físico)", "toca (instrumento musical)"]
}

Or for a root word:
{
  "contextTranslation": "ser",
  "isDerivative": false,
  "otherCommonTranslations": ["existir", "estar"]
}

Important:
- The output must be valid JSON.
- Do not include triple backticks.
- Do not include any surrounding text.
- Do not use markdown formatting.

Your output will be parsed by a computer. Invalid formatting will break the system.

`.trim();

  const constraints = {
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

English Word: ${word}
Sentence: ${sentence}
`.trim();
}
