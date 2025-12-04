// src/lib/admin/cefr-prompts.ts

export interface CEFRLevel {
  level: number;
  cefr: string;
  name: string;
  sentenceLength: string;
  vocabulary: string;
  forbidden: string[];  // The key constraints - what NOT to use
}

/**
 * Slimmed-down CEFR levels focusing on key constraints.
 * GPT knows CEFR basics - we just need to enforce boundaries.
 */
export const CEFR_LEVELS: Record<number, CEFRLevel> = {
  1: {
    level: 1,
    cefr: "A1",
    name: "Beginner",
    sentenceLength: "3-7 words",
    vocabulary: "500 most common words",
    forbidden: [
      "NO past tense",
      "NO future tense",
      "NO perfect tenses",
      "NO conditionals",
      "NO relative clauses",
      "NO abstract nouns",
    ],
  },
  2: {
    level: 2,
    cefr: "A2",
    name: "Elementary",
    sentenceLength: "6-10 words",
    vocabulary: "1,000 most common words",
    forbidden: [
      "NO present perfect",
      "NO past perfect",
      "NO 'will' future (use 'going to')",
      "NO passive voice",
      "NO conditionals",
      "NO subjunctive",
    ],
  },
  3: {
    level: 3,
    cefr: "B1",
    name: "Intermediate",
    sentenceLength: "8-15 words",
    vocabulary: "2,500 words",
    forbidden: [
      "NO past perfect",
      "NO third conditional",
      "NO complex passive",
      "NO literary language",
      "NO rare vocabulary",
    ],
  },
  4: {
    level: 4,
    cefr: "B2",
    name: "Upper Intermediate",
    sentenceLength: "10-20 words",
    vocabulary: "5,000 words",
    forbidden: [
      "NO third conditional (save for C1)",
      "NO obscure vocabulary",
      "NO archaic constructions",
    ],
  },
  5: {
    level: 5,
    cefr: "C1/C2",
    name: "Advanced",
    sentenceLength: "No limit",
    vocabulary: "10,000+ words",
    forbidden: [], // No restrictions
  },
};

/**
 * Generate a prompt for rewriting text at a specific CEFR level
 */
export function generateRewritePrompt(
  targetLevel: number,
  sourceText: string,
  sourceLanguage: "en" | "es"
): string {
  const level = CEFR_LEVELS[targetLevel];
  const langName = sourceLanguage === "es" ? "Spanish" : "English";

  const forbiddenRules = level.forbidden.length > 0
    ? `\nFORBIDDEN:\n${level.forbidden.join("\n")}`
    : "";

  return `Rewrite this ${langName} story for CEFR ${level.cefr} (${level.name}).

RULES:
- Sentences: ${level.sentenceLength}
- Vocabulary: ${level.vocabulary}${forbiddenRules}

Preserve the exact meaning, plot, and character names.
Keep the same number of lines (±2).

TEXT:
"""
${sourceText}
"""

Return ONLY the rewritten text.`;
}

/**
 * Generate a prompt for translating text while maintaining level-appropriate language
 */
export function generateTranslationPrompt(
  text: string,
  fromLang: "en" | "es",
  level: number
): string {
  const toLangName = fromLang === "en" ? "Spanish" : "English";
  const fromLangName = fromLang === "en" ? "English" : "Spanish";
  const cefrLevel = CEFR_LEVELS[level];

  const forbiddenRules = cefrLevel.forbidden.length > 0
    ? `\nFORBIDDEN:\n${cefrLevel.forbidden.join("\n")}`
    : "";

  return `Translate this ${fromLangName} text to ${toLangName} at CEFR ${cefrLevel.cefr} (${cefrLevel.name}).

RULES:
- Vocabulary: ${cefrLevel.vocabulary}
- Match the sentence complexity of ${cefrLevel.cefr}${forbiddenRules}

Translate line-by-line, preserving meaning exactly.

TEXT:
"""
${text}
"""

Return ONLY the translation, one line per source line.`;
}

/**
 * Generate a prompt for detecting the CEFR level of text
 */
export function generateDetectionPrompt(
  text: string,
  language: "en" | "es"
): string {
  const langName = language === "es" ? "Spanish" : "English";

  return `Analyze this ${langName} text and determine its CEFR level.

LEVELS:
- A1: 3-7 word sentences, ~500 words, present tense only
- A2: 6-10 word sentences, ~1000 words, simple past/present
- B1: 8-15 word sentences, ~2500 words, present perfect, basic conditionals
- B2: 10-20 word sentences, ~5000 words, all tenses, second conditional
- C1/C2: No limits, 10000+ words, full native expression

TEXT:
"""
${text}
"""

Return ONLY JSON:
{
  "level": 1-5,
  "cefr": "A1/A2/B1/B2/C1",
  "confidence": "high/medium/low",
  "reasoning": "brief explanation"
}`;
}
