// src/lib/story-processing/cefr-prompts.ts
// CEFR prompts for AI processing - uses central cefr.ts definitions
//
// Prompt tiers by level:
//   A1-B1 ("full"): Complete grammar constraints, style guidance, and writing rules
//   B2 ("light"): Minimal constraints — preserve literary quality, only simplify archaic/obscure
//   C1-C2 ("minimal"): Near-passthrough — modernize archaic forms only (C1) or no changes (C2)

import {
  type CEFRCode,
  CEFR_LEVEL_DETAILS,
  getLevelDetails,
  toCEFR,
  toNumericLevel,
  fromNumericLevel,
} from "@/lib/cefr";

// ============================================================================
// CHAPTER-LEVEL POETRY STRUCTURE RULES
// Used for processing multiple poems in a single API call
// ============================================================================

/**
 * Structure rules for chapter-level poetry processing with markers.
 * These rules ensure the AI preserves poem and stanza boundaries.
 */
export const CHAPTER_POETRY_STRUCTURE_RULES = `
CHAPTER STRUCTURE (CRITICAL - MULTIPLE POEMS):
Preserve ALL structural markers EXACTLY:
1. [POEM: "Title"] — start of each poem, keep exact title
2. [/POEM] — end of each poem
3. [STANZA] — stanza break, must remain in exact positions

RULES:
- Same number of [POEM]...[/POEM] blocks and [STANZA] markers as input
- Poem titles unchanged (exact case, spelling, punctuation)
- Do NOT merge/split poems or stanzas
- Each [POEM: "Title"] and [/POEM] on its own line
- [STANZA] on its own line (no extra blank lines around it)
- Preserve line indentation/leading whitespace from original`;

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
 * Options for generating rewrite prompts
 */
export interface RewritePromptOptions {
  /** Whether the text is poetry (enables line count preservation) */
  isPoetry?: boolean;
  /** Whether this is chapter-level processing with poem/stanza markers */
  isChapterWithMarkers?: boolean;
}

// ============================================================================
// PROSE STRUCTURE RULES — shared across all prose rewrite levels
// ============================================================================

const PROSE_STRUCTURE_RULES = `STORY FAITHFULNESS:
- RETELL the full story — do NOT summarize or condense
- Every scene, event, dialogue, and plot point from the original must appear in the rewrite
- Simplify the LANGUAGE, not the STORY

PARAGRAPH ALIGNMENT:
- Each [PN] input paragraph produces EXACTLY ONE [PN] output paragraph
- Never merge, skip, or reorder paragraph markers
- Text within each paragraph flows naturally — no line breaks within paragraphs

DIALOGUE PUNCTUATION:
- Preserve ALL quotation marks ("...") — both opening and closing
- Keep dialogue attribution (he said, she whispered) with the dialogue
- Never convert direct speech to indirect speech`;

// ============================================================================
// POETRY STRUCTURE RULES
// ============================================================================

const POETRY_STRUCTURE_RULES = `STRUCTURE (CRITICAL):
- EXACT same number of lines as the original — non-negotiable
- Each original line → exactly ONE rewritten line
- Stanza breaks (empty lines) must remain in exact same positions
- Preserve leading whitespace/indentation exactly

POETIC ELEMENTS (preserve as much as possible):
- Rhyme scheme, meter/rhythm, tone and mood, imagery
- Repetition/refrains: if the original repeats lines, your rewrite must too

SIMPLIFY only vocabulary and verb forms — never change line count, stanza breaks, or indentation`;

// ============================================================================
// PER-LEVEL WRITING GUIDELINES
// Merged from style guidance + pitfalls — one concise section per level
// ============================================================================

const WRITING_GUIDELINES: Record<string, string> = {
  A1: `WRITING GUIDELINES:
- Write connected prose, not isolated sentences — this is a STORY, not a vocabulary exercise
- Keep cause-and-effect clear with simple connectors
- Simple dialogue adds variety; preserve basic character emotions
- Use pronouns after 2-3 sentences about the same subject
- Do NOT create choppy note-taking style or remove character personality`,

  A2: `WRITING GUIDELINES:
- Write CONNECTED prose — "simple and direct", not fragmented
- Every scene and event from the original must appear — do NOT skip or condense
- Preserve the author's voice, humor, and personality through simple patterns
- Mix simple and compound sentences for natural rhythm; vary sentence length
- Use connectors to maintain narrative flow
- Dialogue conveys personality — use it. Emotional reactions should remain
- Do NOT over-fragment into tiny disconnected sentences
- Do NOT flatten character voice into neutral narration or remove humor`,

  B1: `WRITING GUIDELINES:
- Write "simple CONNECTED text" — full narrative flow that reads naturally, not "adapted"
- Preserve the author's voice, humor, irony, and style
- Keep complex emotions, internal monologue, and character development intact
- Subplots, descriptive passages, and narrative tension should remain
- Mix simple, compound, and complex sentences naturally
- Do NOT over-simplify to A2 level — B1 readers handle much more complexity
- Do NOT flatten character voice or remove descriptive richness`,

  B2: `WRITING GUIDELINES:
- Minimal simplification — preserve the author's full literary voice
- Keep all literary devices: metaphor, irony, figurative language, stylistic flourishes
- Maintain complex character psychology and sophisticated narrative techniques
- Only simplify what would genuinely confuse a B2 reader (obscure/archaic vocabulary)`,

  C1: `WRITING GUIDELINES:
- Only modernize archaic elements — preserve everything else
- Replace archaic forms with their modern equivalents
- Maintain full literary sophistication, all devices and techniques
- If the original is complex, the C1 version should be equally complex`,

  C2: `No adaptation needed — preserve the original text exactly as-is.`,
};

// ============================================================================
// REWRITE PROMPT GENERATOR
// ============================================================================

/**
 * Generate a prompt for rewriting text at a specific CEFR level.
 *
 * Three tiers based on how much adaptation the level requires:
 *   A1-B1 ("full"): Grammar constraints, allowed structures, writing guidelines
 *   B2 ("light"): Light constraints, writing guidelines only
 *   C1-C2 ("minimal"): Minimal instructions
 */
export function generateRewritePrompt(
  targetLevel: CEFRCode | number | string,
  sourceText: string,
  sourceLanguage: "en" | "es",
  isPoetryOrOptions: boolean | RewritePromptOptions = false
): string {
  // Handle both old boolean signature and new options object
  const options: RewritePromptOptions = typeof isPoetryOrOptions === 'boolean'
    ? { isPoetry: isPoetryOrOptions }
    : isPoetryOrOptions;

  const { isPoetry = false, isChapterWithMarkers = false } = options;
  const level = getLevelDetails(targetLevel);
  const langName = sourceLanguage === "es" ? "Spanish" : "English";
  const numLevel = level.numericLevel;

  // Determine content type for prompt header
  const contentType = isChapterWithMarkers ? "poetry chapter" : (isPoetry ? "poem" : "story");

  // Structure rules depend on content type, not level
  let structureRules: string;
  if (isChapterWithMarkers) {
    structureRules = CHAPTER_POETRY_STRUCTURE_RULES;
  } else if (isPoetry) {
    structureRules = POETRY_STRUCTURE_RULES;
  } else {
    structureRules = PROSE_STRUCTURE_RULES;
  }

  // Writing guidelines are per-level
  const guidelines = WRITING_GUIDELINES[level.code] || WRITING_GUIDELINES.B2;

  // ── Tier: C1-C2 (minimal) ──────────────────────────────────────────────
  if (numLevel >= 5) {
    return `Rewrite this ${langName} ${contentType} for CEFR ${level.code} (${level.name}).

${guidelines}

${structureRules}

TEXT TO REWRITE:
"""
${sourceText}
"""

Return ONLY the rewritten text.`;
  }

  // ── Tier: B2 (light) ──────────────────────────────────────────────────
  if (numLevel === 4) {
    const forbiddenSection = level.forbidden.length > 0
      ? `AVOID:\n${level.forbidden.map(r => `- ${r}`).join("\n")}`
      : "";

    return `Rewrite this ${langName} ${contentType} for CEFR ${level.code} (${level.name}).

LANGUAGE: Sentences ${level.sentenceLength}. Vocabulary: ${level.vocabulary}.
${forbiddenSection}

${guidelines}

${structureRules}

TEXT TO REWRITE:
"""
${sourceText}
"""

Return ONLY the rewritten text. Preserve the story's voice and flow.`;
  }

  // ── Tier: A1-B1 (full) ────────────────────────────────────────────────
  const forbiddenSection = level.forbidden.length > 0
    ? `GRAMMAR — AVOID:\n${level.forbidden.map(r => `- ${r}`).join("\n")}`
    : "";

  const allowedSection = level.allowed.length > 0
    ? `GRAMMAR — USE THESE:\n${level.allowed.map(r => `- ${r}`).join("\n")}`
    : "";

  return `Rewrite this ${langName} ${contentType} for CEFR ${level.code} (${level.name}).

LANGUAGE: Sentences ${level.sentenceLength}. Vocabulary: ${level.vocabulary}.

${forbiddenSection}

${allowedSection}

${guidelines}

${structureRules}

TEXT TO REWRITE:
"""
${sourceText}
"""

Return ONLY the rewritten text. Preserve the story's voice and flow while adapting the language level.`;
}

// ============================================================================
// TRANSLATION PROMPT GENERATOR
// ============================================================================

/**
 * Generate a prompt for translating text while maintaining level-appropriate language.
 * Translation prompts are already lean — light per-level tiering applied.
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

  // Poetry-specific translation guidance (kept concise)
  const poetryGuidance = isPoetry
    ? `
POETRY TRANSLATION:
- Translate the IMAGE and MEANING, not just the words
- Try to maintain rhyme scheme, rhythm, and tone in ${toLangName}
- Preserve line breaks exactly — they are intentional
- A beautiful ${toLangName} poem > an awkward literal translation
`
    : "";

  // For lower levels, add style guidance so translation matches the rewrite's tone
  const numLevel = cefrLevel.numericLevel;
  let translationStyle = "";
  if (numLevel <= 1) {
    translationStyle = `\nSTYLE: Use short, simple sentences. Concrete vocabulary only. The translation should feel natural at A1 level.`;
  } else if (numLevel <= 2) {
    translationStyle = `\nSTYLE: Use simple, connected sentences. The translation should read as natural ${toLangName} at A2 level, not feel like a word-for-word conversion.`;
  } else if (numLevel <= 3) {
    translationStyle = `\nSTYLE: Maintain natural narrative flow. The translation should read like a well-written ${toLangName} story at B1 level.`;
  }

  const contentType = isPoetry ? "poem" : "text";

  return `Translate this ${fromLangName} ${contentType} to ${toLangName} at CEFR ${cefrLevel.code} (${cefrLevel.name}).

RULES:
- Vocabulary: ${cefrLevel.vocabulary}
- Match the sentence complexity of ${cefrLevel.code}${forbiddenRules}${translationStyle}
${poetryGuidance}
LINE PRESERVATION:
- Each line starts with [N] — keep the same [N] prefix for each translated line
- Each [N] produces exactly ONE [N] translated line — do NOT split, merge, or reorder

DIALOGUE: Preserve ALL quotation marks ("...") — both opening and closing.

TEXT TO TRANSLATE:
${text}

Return ONLY the numbered translated lines.`;
}

// ============================================================================
// DETECTION PROMPT
// ============================================================================

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
