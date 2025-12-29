// src/lib/story-processing/cefr-prompts.ts
// CEFR prompts for AI processing - uses central cefr.ts definitions

import {
  type CEFRCode,
  CEFR_LEVEL_DETAILS,
  getLevelDetails,
  toCEFR,
  toNumericLevel,
  fromNumericLevel,
} from "@/lib/cefr";

// Re-export from cefr.ts for backwards compatibility
export { toCEFR, toNumericLevel, fromNumericLevel };

// Legacy function names for backwards compatibility
export const levelStringToNumber = toNumericLevel;
export const levelNumberToString = (level: number): string => fromNumericLevel(level);

// Re-export the level details interface
export type { CEFRLevelDetails as CEFRLevel } from "@/lib/cefr";

// Re-export level details for code that imports from here
export const CEFR_LEVELS = CEFR_LEVEL_DETAILS;

/**
 * Generate a prompt for rewriting text at a specific CEFR level
 */
export function generateRewritePrompt(
  targetLevel: CEFRCode | number | string,
  sourceText: string,
  sourceLanguage: "en" | "es",
  isPoetry: boolean = false
): string {
  const level = getLevelDetails(targetLevel);
  const langName = sourceLanguage === "es" ? "Spanish" : "English";

  const forbiddenRules =
    level.forbidden.length > 0
      ? `\nFORBIDDEN:\n${level.forbidden.join("\n")}`
      : "";

  // Different structure rules for poetry vs prose
  const structureRules = isPoetry
    ? `STRUCTURE RULES (POETRY):
- Preserve the exact meaning, plot, and character names
- KEEP EVERY LINE BREAK - do not merge lines
- Each input line → one output line (reworded at the target level)
- Empty lines must remain empty lines
- Maintain poetic rhythm where possible`
    : `STRUCTURE RULES (PROSE):
- Preserve the exact meaning, plot, and character names
- Preserve PARAGRAPH breaks (empty lines between paragraphs)
- Within paragraphs, text should flow naturally as prose
- Do NOT break sentences into separate lines
- Do NOT add line breaks within paragraphs
- Keep the narrative flowing and readable`;

  return `Rewrite this ${langName} ${isPoetry ? "poem" : "story"} for CEFR ${level.code} (${level.name}).

RULES:
- Sentences: ${level.sentenceLength}
- Vocabulary: ${level.vocabulary}${forbiddenRules}

${structureRules}

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
  level: CEFRCode | number | string
): string {
  const toLangName = fromLang === "en" ? "Spanish" : "English";
  const fromLangName = fromLang === "en" ? "English" : "Spanish";
  const cefrLevel = getLevelDetails(level);

  const forbiddenRules =
    cefrLevel.forbidden.length > 0
      ? `\nFORBIDDEN:\n${cefrLevel.forbidden.join("\n")}`
      : "";

  return `Translate this ${fromLangName} text to ${toLangName} at CEFR ${cefrLevel.code} (${cefrLevel.name}).

RULES:
- Vocabulary: ${cefrLevel.vocabulary}
- Match the sentence complexity of ${cefrLevel.code}${forbiddenRules}

CRITICAL - LINE NUMBER PRESERVATION:
- Each line starts with [N] where N is a number
- You MUST keep the same [N] prefix for each translated line
- Each [N] line produces exactly ONE [N] translated line
- Do NOT split, merge, or reorder lines

TEXT TO TRANSLATE:
${text}

Return ONLY the numbered translated lines in the same format.`;
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
- A1 (Foundations): 3-7 word sentences, ~500 words, present tense only
- A2 (Developing): 6-10 word sentences, ~1000 words, simple past/present
- B1 (Independent): 8-15 word sentences, ~2500 words, present perfect, basic conditionals
- B2 (Upper-Intermediate): 10-20 word sentences, ~5000 words, all tenses, second conditional
- C1 (Advanced): No limits, 10000+ words, full modern native expression
- C2 (Mastery): Literary/archaic texts with obsolete vocabulary, archaic grammar (thee/thou/hath), poetic inversions, or specialized historical language that exceeds modern native usage

IMPORTANT: Use C2 for:
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
  "level": "A1/A2/B1/B2/C1/C2",
  "cefr": "A1/A2/B1/B2/C1/C2",
  "confidence": "high/medium/low",
  "reasoning": "brief explanation"
}`;
}
