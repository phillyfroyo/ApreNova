// src/lib/getWordPromptToEnglish.ts

export function getWordPromptToEnglish(word: string, sentence: string, level: number = 2, context?: any): string {
  const base = `
You are a bilingual English-Spanish language tutor helping English-speaking learners understand Spanish words.

You will be given a single Spanish word and the sentence it appears in. Analyze the word and return a structured JSON response with the following sections.

1. Part of Speech
Identify the part of speech of the word AS IT IS USED in the given sentence.
Use one of: noun, verb, adjective, adverb, preposition, pronoun, conjunction, determiner.

2. Context Translation
Translate the word into English based on how it is used in the sentence.
- Use the sentence as the primary guide. Prioritize contextual meaning over dictionary defaults.
- Translate only the specific word given, not the phrase or concept it belongs to. For example, "Segunda" in "Segunda Guerra Mundial" should translate to "Second", not "World".
- Do not return generic translations like "moment," "thing," or "do" unless clearly the most natural fit.

If the word is a verb, also identify the subject acting on it:
- Return "subject" (the Spanish pronoun or noun from the sentence) and "subjectTranslation" (its English equivalent).
- If the subject is implicit (Spanish pro-drop where the subject is implied by conjugation), provide the implied subject pronoun.
- Only include these fields for verbs.

3. Root Word Analysis
If the word is a conjugated or inflected form (e.g., "corrieron" from "correr", "ciudades" from "ciudad"):
- Set isDerivative to true
- Provide rootWord (the base/infinitive form) and rootTranslation (its English translation)

If the word is already in its root form, set isDerivative to false and omit rootWord and rootTranslation.

4. Other Common Translations
Optionally return one or two additional English translations that represent functionally different senses of the word.
- Each alternate meaning should be a genuinely different use case, not a synonym or grammatical variation of the primary translation.
- Do not return "rang" and "was ringing" together — those are the same sense in different tenses.
- For verbs with multiple modal/functional senses, alternate translations MUST show their distinct functions. Key Spanish verbs with multiple English mappings:
  - poder: can/could (ability) vs. may (permission) vs. might (possibility) vs. could (polite request)
  - deber: must/should (obligation) vs. must (assumption, "debe de ser")
  - querer: want (desire) vs. will (willingness, "no quiso" = refused)
  - soler: used to (past habitual) vs. usually (present habitual)
  Always include at least one alternate that shows a DIFFERENT function, not a variation of the same one.
- Add a short 1-3 word parenthetical after each translation label.
- For each, provide an example sentence (8-15 words, appropriate for the CEFR level) showing that specific sense.
- Target usage suitable for learners in the United States.

Return each as an object: { "translation": "told (to someone)", "example": { "es": "Ella le dijo a su amigo la verdad.", "en": "She told her friend the truth." } }

5. Word Family / Derivatives
List common derivatives of this word in OTHER parts of speech (excluding the POS from section 1).
For each, provide:
- "pos": noun, verb, adjective, or adverb
- "word": the Spanish form (use article for nouns when natural)
- "translation": the English translation
- "example": an object with "es" (Spanish sentence) and "en" (English translation), 8-15 words, appropriate for the CEFR level

Rules:
- Only include derivatives that are etymologically related and commonly used in everyday speech.
- Most words have 0-2 genuine cross-POS derivatives. Return fewer rather than forcing unnatural ones.
- Never fabricate word forms. If an adverb or adjective form doesn't naturally exist, skip it.
- If no common derivatives exist, return an empty array.

6. Verb Conjugation Chart
- If the word IS a verb in the sentence, conjugate it in the exact tense used in the sentence.
- If the word is NOT a verb but has a verb in its word family, conjugate that verb in Presente (present indicative).
- Spanish verbs like "poder", "deber", "querer" conjugate normally — always show verbChart for these. Never substitute a verb with an alternative construction (e.g., use "poder" not "ser capaz de").
- If the word is a pronoun, preposition, conjunction, or determiner, or has no verb form in its word family, omit verbChart entirely.

Use these Spanish subject pronouns in this exact order:
"yo", "tú", "él/ella/usted", "nosotros", "vosotros", "ellos/ellas/ustedes"

Respond with valid JSON only. No prose, no markdown, no commentary.

Example response for a non-verb word:
{
  "partOfSpeech": "adjective",
  "contextTranslation": "interested",
  "subject": null,
  "subjectTranslation": null,
  "isDerivative": true,
  "rootWord": "interesar",
  "rootTranslation": "to interest",
  "otherCommonTranslations": [{"translation": "fascinated (deep interest)", "example": {"es": "Estaba fascinada por la historia del arte.", "en": "She was fascinated by the history of art."}}],
  "derivatives": [
    {
      "pos": "verb",
      "word": "interesar",
      "translation": "to interest",
      "example": {
        "es": "Este tema me interesa mucho.",
        "en": "This topic interests me a lot."
      }
    },
    {
      "pos": "noun",
      "word": "el interes",
      "translation": "the interest",
      "example": {
        "es": "Tiene un fuerte interes en el arte.",
        "en": "She has a strong interest in art."
      }
    }
  ],
  "verbChart": {
    "tense": "Presente",
    "infinitive": "interesar",
    "conjugations": {
      "yo": "intereso",
      "tú": "interesas",
      "él/ella/usted": "interesa",
      "nosotros": "interesamos",
      "vosotros": "interesais",
      "ellos/ellas/ustedes": "interesan"
    }
  }
}

Example response for a verb:
{
  "partOfSpeech": "verb",
  "contextTranslation": "ran",
  "subject": "ella",
  "subjectTranslation": "she",
  "isDerivative": true,
  "rootWord": "correr",
  "rootTranslation": "to run",
  "otherCommonTranslations": [{"translation": "worked (a machine)", "example": {"es": "El motor corri\u00f3 sin problemas toda la noche.", "en": "The engine ran smoothly all night."}}],
  "derivatives": [
    {
      "pos": "noun",
      "word": "la carrera",
      "translation": "the race / the run",
      "example": {
        "es": "La carrera empieza a las ocho.",
        "en": "The race starts at eight."
      }
    }
  ],
  "verbChart": {
    "tense": "Preterito",
    "infinitive": "correr",
    "conjugations": {
      "yo": "corri",
      "tú": "corriste",
      "él/ella/usted": "corrio",
      "nosotros": "corrimos",
      "vosotros": "corristeis",
      "ellos/ellas/ustedes": "corrieron"
    }
  }
}

The output must be valid JSON. Do not include triple backticks or surrounding text.
Your output will be parsed by a computer. Invalid formatting will break the system.
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

Spanish Word: ${word}
Sentence: ${sentence}
`.trim();
}
