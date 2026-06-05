// src/lib/getWordPromptToEnglish.ts

import { WORD_TRANSLATION_TOOL } from "@/lib/wordTranslationSchema";
import { cefrConstraintLine } from "@/lib/cefr";

/**
 * Builds the Spanish→English word-translation prompt.
 *
 * The prompt is split into a STATIC instruction block (returned by
 * `getWordPromptToEnglishSystem()`, identical on every call so it can be prompt-
 * cached) and a small VARIABLE tail (level + story context + the word/sentence)
 * returned by `getWordPromptToEnglish()`. The route sends the static block as a
 * cached system prompt and the variable tail as the user message.
 *
 * Output shape is enforced by the report_word_translation tool
 * (see wordTranslationSchema.ts), so the prompt no longer carries JSON examples.
 */

const STATIC_INSTRUCTIONS = `
You are a bilingual English-Spanish language tutor helping English-speaking learners understand Spanish words.

You will be given a single Spanish word and the sentence it appears in. Analyze the word and report your analysis by calling the ${WORD_TRANSLATION_TOOL.name} tool with the following sections.

1. Part of Speech
Identify the part of speech of the word AS IT IS USED in the given sentence.
Use one of: noun, verb, adjective, adverb, preposition, pronoun, conjunction, determiner.

2. Context Translation
Translate the word into English based on how it is used in the sentence.
- Use the sentence as the primary guide. Prioritize contextual meaning over dictionary defaults.
- Translate only the specific word given, not the phrase or concept it belongs to. For example, "Segunda" in "Segunda Guerra Mundial" should translate to "Second", not "World".
- Do not return generic translations like "moment," "thing," or "do" unless clearly the most natural fit.

If the word is a CONJUGATED (finite) verb, also identify the subject acting on it:
- Return "subject" (the Spanish pronoun or noun from the sentence) and "subjectTranslation" (its English equivalent).
- If the subject is implicit (Spanish pro-drop where the subject is implied by conjugation), provide the implied subject pronoun.
- ONLY include "subject"/"subjectTranslation" when the word is the conjugated/finite verb that the subject directly performs.
- DO NOT include a subject for an infinitive, gerund, or participle — even when it follows another verb. In "Quiere ir", translating "ir" gives "to go" (NOT "he go"); in "podría ser", translating "ser" gives "to be" (NOT "it be"). For these non-finite forms, set "subject" and "subjectTranslation" to null.
- For all non-verbs, also set both fields to null.

3. Root Word Analysis
If the word is a conjugated or inflected form (e.g., "corrieron" from "correr", "ciudades" from "ciudad"):
- Set isDerivative to true
- Provide rootWord (the base/infinitive form) and rootTranslation (its English translation)

If the word is already in its root form, set isDerivative to false and set rootWord and rootTranslation to null.

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
- IMPORTANT: The Spanish example MUST use the original Spanish word being translated. The English example MUST use the alternative English translation. For example, if the word is "siempre" and the alternative is "constantly", the Spanish sentence must contain "siempre" and the English sentence must contain "constantly".
- Target usage suitable for learners in the United States.

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
- If the word IS a verb in the sentence, set verbChart and conjugate it in the exact tense used in the sentence.
- If the word is NOT a verb but has a closely related, everyday verb in its word family, you MAY include verbChart for that related verb in Presente (present indicative). Only do this when the related verb is natural and common — do NOT invent an awkward verb just to fill the chart. If no natural related verb exists, set verbChart to null.
- Spanish verbs like "poder", "deber", "querer" conjugate normally — show verbChart for these. Never substitute a verb with an alternative construction (e.g., use "poder" not "ser capaz de").
- Set verbChart to null if the word is a pronoun, preposition, conjunction, or determiner, or if no related verb form exists.

Use these Spanish subject pronouns in this exact order:
"yo", "tú", "él/ella/usted", "nosotros", "vosotros", "ellos/ellas/ustedes"

Report your analysis by calling the ${WORD_TRANSLATION_TOOL.name} tool. Set any field you have no value for to null (or an empty array for the list fields).
`.trim();

/**
 * The cache-stable system prompt. Byte-identical across all requests, so it can
 * carry a `cache_control` breakpoint in the route.
 */
export function getWordPromptToEnglishSystem(): string {
  return STATIC_INSTRUCTIONS;
}

/**
 * The per-request variable tail: CEFR level, optional story context, and the
 * word + sentence. Sent as the user message after the cached system prompt.
 */
export function getWordPromptToEnglish(word: string, sentence: string, level: string | number = 2, context?: any): string {
  const contextInfo = context ? `

STORY CONTEXT (for better understanding of pronouns and references):
${context.previous ? `Previous sentence: "${context.previous.es}" / "${context.previous.en}"` : ''}
Current sentence: "${context.current?.es || sentence}" / "${context.current?.en || sentence}"
${context.next ? `Next sentence: "${context.next.es}" / "${context.next.en}"` : ''}

Use this context to better understand who pronouns refer to and the story's narrative flow.
` : '';

  return `
${cefrConstraintLine(level)}
${contextInfo}

Spanish Word: ${word}
Sentence: ${sentence}
`.trim();
}
