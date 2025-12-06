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
    cefr: "C1",
    name: "Advanced",
    sentenceLength: "No limit",
    vocabulary: "10,000+ common modern words",
    forbidden: [
      "NO archaic vocabulary (thane, hither, wherefore, etc.)",
      "NO obsolete grammar (thee, thou, hast, doth, etc.)",
      "NO literary/poetic inversions",
      "NO specialized academic jargon",
      "Use modern equivalents for dated expressions",
    ],
  },
  6: {
    level: 6,
    cefr: "C2+",
    name: "Literary/Archaic",
    sentenceLength: "No limit",
    vocabulary: "Unrestricted (including archaic, literary, specialized)",
    forbidden: [], // No restrictions - original literary texts
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

STRUCTURE RULES:
- Preserve the exact meaning, plot, and character names
- KEEP EVERY LINE BREAK - do not merge lines or paragraphs
- Each input line → one output line (reworded at the target level)
- Empty lines must remain empty lines

TEXT (${sourceText.split("\n").length} lines):
"""
${sourceText}
"""

Return ONLY the rewritten text with the same line structure.`;
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
- A1 (Level 1): 3-7 word sentences, ~500 words, present tense only
- A2 (Level 2): 6-10 word sentences, ~1000 words, simple past/present
- B1 (Level 3): 8-15 word sentences, ~2500 words, present perfect, basic conditionals
- B2 (Level 4): 10-20 word sentences, ~5000 words, all tenses, second conditional
- C1 (Level 5): No limits, 10000+ words, full modern native expression
- C2+ (Level 6): Literary/archaic texts with obsolete vocabulary, archaic grammar (thee/thou/hath), poetic inversions, or specialized historical language that exceeds modern native usage

IMPORTANT: Use Level 6 for:
- Texts with archaic vocabulary (thane, mead-hall, hither, wherefore)
- Old/Middle English translations or adaptations
- Classical literature with preserved period language
- Poetry with inverted syntax or obsolete forms

TEXT:
"""
${text}
"""

Return ONLY JSON:
{
  "level": 1-6,
  "cefr": "A1/A2/B1/B2/C1/C2+",
  "confidence": "high/medium/low",
  "reasoning": "brief explanation"
}`;
}
