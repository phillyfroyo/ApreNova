// src/lib/getWordQuickPrompt.ts
//
// MINIMAL word-translation prompt for the "quick" (Call A) endpoint.
//
// This is the fast half of the two-call translation: it asks ONLY for the
// headline — the context translation and (for finite verbs) the subject. No
// part of speech, root analysis, alternates, derivatives, or conjugation chart.
// Smallest possible generation = fastest return, so the translation can render
// while the rich call (the existing /api/translate-word) is still working.
//
// Same static/variable split as the full word prompt so the static block is
// prompt-cacheable. Direction (es->en / en->es) is parameterized.

import { cefrConstraintLine } from "@/lib/cefr";

const STATIC_ES_TO_EN = `
You are a bilingual English-Spanish tutor helping English speakers understand Spanish words.

Given a single Spanish word and the sentence it appears in, return only its context-appropriate English translation.
- Use the sentence as the primary guide; prioritize contextual meaning over dictionary defaults.
- Translate only the given word, not the surrounding phrase.

If the word is a CONJUGATED (finite) verb, also give its subject: "subject" (the Spanish pronoun/noun from the sentence) and "subjectTranslation" (its English equivalent). Resolve an implicit pro-drop subject from context.
DO NOT give a subject for an infinitive, gerund, or participle (e.g. "ir" in "Quiere ir" -> "to go", not "he go"; "ser" in "podría ser" -> "to be", not "it be"). For non-finite forms and all non-verbs, set subject and subjectTranslation to null.

Report your answer by calling the report_quick_translation tool.
`.trim();

const STATIC_EN_TO_ES = `
You are a bilingual Spanish-English tutor helping Spanish speakers understand English words.

Given a single English word and the sentence it appears in, return only its context-appropriate Spanish translation.
- Use the sentence as the primary guide; prioritize contextual meaning over dictionary defaults.
- Translate only the given word, not the surrounding phrase.

If the word is a CONJUGATED (finite) verb, also give its subject: "subject" (the English pronoun/noun from the sentence) and "subjectTranslation" (its Spanish equivalent). Infer an implicit subject from context.
DO NOT give a subject for an infinitive, gerund, or participle (e.g. "go" in "wants to go" -> "ir", not "he go"; "be" in "could be" -> "ser", not "it be"). For non-finite forms and all non-verbs, set subject and subjectTranslation to null.

Report your answer by calling the report_quick_translation tool.
`.trim();

/** Cache-stable system prompt for the quick endpoint, by direction. */
export function getWordQuickSystem(isSpanishToEnglish: boolean): string {
  return isSpanishToEnglish ? STATIC_ES_TO_EN : STATIC_EN_TO_ES;
}

/** Per-request variable tail: level + optional story context + word/sentence. */
export function getWordQuickUser(
  word: string,
  sentence: string,
  level: string | number = 2,
  context?: any,
  isSpanishToEnglish = true,
): string {
  const contextInfo = context ? `

STORY CONTEXT:
${context.previous ? `Previous: "${context.previous.es || ''}" / "${context.previous.en || ''}"` : ''}
Current: "${context.current?.es || context.current?.en || sentence}"
${context.next ? `Next: "${context.next.es || ''}" / "${context.next.en || ''}"` : ''}
` : '';

  const label = isSpanishToEnglish ? "Spanish Word" : "English Word";
  return `
${cefrConstraintLine(level)}
${contextInfo}

${label}: ${word}
Sentence: ${sentence}
`.trim();
}
