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
 *
 * The prompt includes:
 * - Official CEFR context (what learners at this level can do)
 * - Grammar constraints (what to avoid)
 * - Allowed structures (what IS appropriate - often underused)
 * - Connectors to use (for cohesion)
 * - Style guidance (how to preserve narrative quality)
 * - Common pitfalls to avoid
 */
export function generateRewritePrompt(
  targetLevel: CEFRCode | number | string,
  sourceText: string,
  sourceLanguage: "en" | "es",
  isPoetry: boolean = false
): string {
  const level = getLevelDetails(targetLevel);
  const langName = sourceLanguage === "es" ? "Spanish" : "English";

  // Build forbidden rules section
  const forbiddenSection =
    level.forbidden.length > 0
      ? `GRAMMAR CONSTRAINTS (AVOID):\n${level.forbidden.map(r => `- ${r}`).join("\n")}`
      : "";

  // Build allowed structures section
  const allowedSection =
    level.allowed.length > 0
      ? `ALLOWED STRUCTURES (USE THESE):\n${level.allowed.map(r => `- ${r}`).join("\n")}`
      : "";

  // Build connectors section
  const connectorsSection =
    level.connectors.length > 0
      ? `CONNECTORS FOR COHESION:\nUse these to maintain flow: ${level.connectors.join(", ")}`
      : "";

  // Build style guidance section
  const styleSection =
    level.styleGuidance.length > 0
      ? `STYLE GUIDANCE (CRITICAL FOR QUALITY):\n${level.styleGuidance.map(r => `- ${r}`).join("\n")}`
      : "";

  // Build pitfalls section
  const pitfallsSection =
    level.pitfalls.length > 0
      ? `COMMON MISTAKES TO AVOID:\n${level.pitfalls.map(r => `- ${r}`).join("\n")}`
      : "";

  // Different structure rules for poetry vs prose
  const structureRules = isPoetry
    ? `STRUCTURE RULES (POETRY) - CRITICAL:
LINE COUNT REQUIREMENT (MANDATORY):
- The rewritten poem MUST have EXACTLY the same number of lines as the original
- Each original line → exactly ONE rewritten line (simplified vocabulary, same position)
- Empty lines/stanza breaks must remain in the exact same positions
- This is NON-NEGOTIABLE - a poem with wrong line count is a failed rewrite

POETIC FORM PRESERVATION:
- Identify the poem type (Sonnet, Haiku, Limerick, Ballad, Ode, Villanelle, Elegy, Free Verse, Epic, etc.)
- Preserve the form's structure (14 lines for sonnet, 3 lines for haiku, etc.)
- Maintain stanza divisions exactly as in the original

POETIC ELEMENTS (preserve as much as possible):
- Rhyme scheme: Try to maintain end rhymes (ABAB, AABB, etc.) using simpler words
- Meter/rhythm: Keep similar syllable patterns and stress where possible
- Tone and mood: The emotional feel must remain (melancholic, joyful, mysterious, etc.)
- Imagery: Simplify vocabulary but keep the visual/sensory images
- Repetition/refrains: If the original repeats lines, your rewrite must repeat the same lines

WHAT TO SIMPLIFY:
- Replace complex vocabulary with simpler synonyms
- Use more common verb forms (but keep the line count!)
- Simplify metaphors only if absolutely necessary for the target level

WHAT TO NEVER CHANGE:
- Number of lines
- Stanza breaks (empty lines)
- Character/place names
- The core meaning of each line`
    : `STRUCTURE RULES (PROSE):
- Preserve the exact meaning, plot, and character names
- Preserve PARAGRAPH breaks (empty lines between paragraphs)
- Within paragraphs, text should flow naturally as prose
- Do NOT break sentences into separate lines
- Do NOT add line breaks within paragraphs`;

  return `Rewrite this ${langName} ${isPoetry ? "poem" : "story"} for CEFR ${level.code} (${level.name}).

TARGET READER PROFILE:
${level.officialDescription}

LANGUAGE PARAMETERS:
- Sentence length: ${level.sentenceLength}
- Vocabulary: ${level.vocabulary}

${forbiddenSection}

${allowedSection}

${connectorsSection}

${styleSection}

${pitfallsSection}

${structureRules}

TEXT TO REWRITE:
"""
${sourceText}
"""

Return ONLY the rewritten text. Preserve the story's voice and flow while adapting the language level.`;
}

/**
 * Generate a prompt for translating text while maintaining level-appropriate language
 */
export function generateTranslationPrompt(
  text: string,
  fromLang: "en" | "es",
  level: CEFRCode | number | string,
  isPoetry: boolean = false
): string {
  const toLangName = fromLang === "en" ? "Spanish" : "English";
  const fromLangName = fromLang === "en" ? "English" : "Spanish";
  const cefrLevel = getLevelDetails(level);

  const forbiddenRules =
    cefrLevel.forbidden.length > 0
      ? `\nFORBIDDEN:\n${cefrLevel.forbidden.join("\n")}`
      : "";

  // Poetry-specific translation guidance
  const poetryGuidance = isPoetry
    ? `
POETRY TRANSLATION (THIS IS A POEM - HANDLE WITH CARE):
Translating poetry is an art. Your goal is to create a translation that feels like a poem
in ${toLangName}, not just a literal word-for-word conversion.

PRESERVE THESE POETIC ELEMENTS:
- Rhyme scheme: If the original rhymes (ABAB, AABB, etc.), try to maintain rhymes in ${toLangName}
  - It's okay to slightly adjust word choice to achieve rhyme
  - Prioritize natural-sounding rhymes over forced ones
- Rhythm and meter: Match the syllable patterns and stress where possible
  - ${toLangName === "Spanish" ? "Spanish has natural rhythm - use it" : "English stress patterns matter for flow"}
- Imagery and metaphors: Translate the IMAGE, not just the words
  - If a metaphor doesn't work in ${toLangName}, find an equivalent that evokes the same feeling
- Tone and mood: Preserve the emotional atmosphere (melancholic, joyful, mysterious, etc.)
- Sound devices: Alliteration, assonance, onomatopoeia - recreate these effects where possible
- Line breaks: These are intentional - maintain the same line structure

POETRY TRANSLATION PRINCIPLES:
- Faithfulness to MEANING over literal words
- A beautiful ${toLangName} poem > an awkward literal translation
- When choosing between accuracy and artistry, lean toward artistry
- Read your translation aloud - does it SOUND like poetry?

`
    : "";

  const contentType = isPoetry ? "poem" : "text";

  return `Translate this ${fromLangName} ${contentType} to ${toLangName} at CEFR ${cefrLevel.code} (${cefrLevel.name}).

RULES:
- Vocabulary: ${cefrLevel.vocabulary}
- Match the sentence complexity of ${cefrLevel.code}${forbiddenRules}
${poetryGuidance}
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
- C2 (Near-Native): Literary/archaic texts with obsolete vocabulary, archaic grammar (thee/thou/hath), poetic inversions, or specialized historical language that exceeds modern native usage

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
