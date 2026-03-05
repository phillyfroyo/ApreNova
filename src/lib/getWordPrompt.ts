export function getWordPrompt(word: string, sentence: string, level: number = 2, context?: any): string {
  const base = `
You are a bilingual Spanish-English language tutor.

You will be given:
        a single English word, and
        the sentence it appears in.

Your task is to return:

        1. Context Translation
Use the sentence as the primary guide to determine how the word is being used in context. Ignore default or dictionary translations.
Choose the Spanish word(s) that best conveys the meaning of the English word in this specific sentence.
Prioritize contextual meaning, even if it differs from the most common translation.
This should reflect the actual meaning in the sentence, including appropriate conjugations, tenses, or contextual meaning.
IMPORTANT: Translate only the specific word given, not the phrase or concept it belongs to. For example, "Segunda" in "Segunda Guerra Mundial" should translate to "Second", not "World".
Do not return generic translations like "momento," "cosa," or "hacer" unless they are clearly the most natural fit for the sentence context.

When the word is a verb, also identify the subject (pronoun or proper noun) acting on the verb in the sentence.
Return these as "subject" (in English, from the sentence) and "subjectTranslation" (the Spanish equivalent).
Only include these fields when the word is used as a verb.

        2. Root Word Analysis (if applicable)
Analyze if the given word is a conjugated/inflected form of a root word. If it is:
- Provide the root word (infinitive for verbs, singular for nouns, etc.)
- Provide the Spanish translation of that root word
- Set isDerivative to true

If the word is already in its root form, set isDerivative to false and omit rootWord and rootTranslation.

        3. Other Common Translations (No Context)
Then, optionally return one or two additional distinct Spanish translations for the original word (not the root).
These translations should reflect different common meanings or usage types (e.g., one physical, one musical; one emotional, one auditory).

Do not include synonyms or grammatical variations of the primary translation (e.g., don't return sono and estaba sonando together).
Instead, prioritize functionally different senses that would be helpful for learners to contrast and understand.

Avoid using the same functional context repeatedly (e.g., don't use two musical examples). Favor common, realistic contexts that differ in meaning.

Add a short 1-3 word explanation in parentheses after each alternate Spanish meaning. These should describe the specific type of meaning. For example:

- toca (contacto fisico)
- toca (instrumento musical)

These should be suitable for learners in Mexico.

        4. Part of Speech
Identify the part of speech of the word AS IT IS USED in the given sentence.
Use one of: noun, verb, adjective, adverb, preposition, pronoun, conjunction, determiner.

        5. Word Family / Derivatives
List common derivative forms of this word in OTHER parts of speech (excluding the POS identified in section 4).
Only include derivatives that are genuinely common and useful for language learners. Skip rare or archaic forms.
For each derivative, provide:
- "pos": the part of speech (noun, verb, adjective, or adverb)
- "word": the English form (use "to" prefix for verb infinitives, include article for nouns when natural)
- "translation": the Spanish translation
- "example": an object with "en" (English example sentence) and "es" (Spanish translation of that sentence)

Keep example sentences short and simple (8-15 words), appropriate for the CEFR level.
If the word has no common derivatives in other parts of speech, return an empty array.

        6. Verb Conjugation Chart
Provide a conjugation chart for the verb form of this word's family:
- If the word IS used as a verb in the sentence, identify the exact tense from the sentence and conjugate in THAT tense.
- If the word is NOT a verb in the sentence, conjugate the verb derivative in Present Simple.
- If the word is a pronoun, preposition, conjunction, or determiner, or if there is no verb form in the word family at all (e.g., prepositions like "between"), omit the "verbChart" field entirely.

For English conjugations, use these subject pronouns in this exact order:
"I", "you", "he/she/it", "we", "you all", "they"

You must respond with valid JSON only. No prose, no explanations, no markdown. Do not add "Here's the translation:" or any other commentary.

Respond with a JSON object like this example:
{
  "contextTranslation": "interesado",
  "isDerivative": true,
  "rootWord": "interest",
  "rootTranslation": "interesar",
  "otherCommonTranslations": ["fascinado (gran interes)"],
  "partOfSpeech": "adjective",
  "derivatives": [
    {
      "pos": "verb",
      "word": "to interest",
      "translation": "interesar",
      "example": {
        "en": "This topic interests me.",
        "es": "Este tema me interesa."
      }
    },
    {
      "pos": "noun",
      "word": "interest",
      "translation": "el interes",
      "example": {
        "en": "She has a strong interest in art.",
        "es": "Tiene un fuerte interes en el arte."
      }
    },
    {
      "pos": "adverb",
      "word": "interestingly",
      "translation": "curiosamente",
      "example": {
        "en": "Interestingly, they arrived together.",
        "es": "Curiosamente, llegaron juntos."
      }
    }
  ],
  "verbChart": {
    "tense": "Present Simple",
    "infinitive": "to interest",
    "conjugations": {
      "I": "interest",
      "you": "interest",
      "he/she/it": "interests",
      "we": "interest",
      "you all": "interest",
      "they": "interest"
    }
  }
}

Or for a word already used as a verb (e.g. "ran" from "She ran quickly"):
{
  "contextTranslation": "corrio",
  "isDerivative": true,
  "rootWord": "run",
  "rootTranslation": "correr",
  "subject": "she",
  "subjectTranslation": "ella",
  "otherCommonTranslations": ["funciono (una maquina)"],
  "partOfSpeech": "verb",
  "derivatives": [
    {
      "pos": "noun",
      "word": "a run",
      "translation": "una carrera",
      "example": {
        "en": "I went for a run this morning.",
        "es": "Fui a correr esta manana."
      }
    },
    {
      "pos": "noun",
      "word": "a runner",
      "translation": "un corredor",
      "example": {
        "en": "She is a fast runner.",
        "es": "Ella es una corredora rapida."
      }
    }
  ],
  "verbChart": {
    "tense": "Past Simple",
    "infinitive": "to run",
    "conjugations": {
      "I": "ran",
      "you": "ran",
      "he/she/it": "ran",
      "we": "ran",
      "you all": "ran",
      "they": "ran"
    }
  }
}

Important:
- The output must be valid JSON.
- Do not include triple backticks.
- Do not include any surrounding text.
- Do not use markdown formatting.

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
