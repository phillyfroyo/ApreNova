// src/lib/cefr.ts
// Central CEFR level definitions - single source of truth
// All level-related code should import from this file

/**
 * CEFR Level Codes - used in database, URLs, and internal logic
 */
export type CEFRCode = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

/**
 * All CEFR levels in order
 */
export const ALL_CEFR_LEVELS: CEFRCode[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

/**
 * Level descriptors in English
 */
export const CEFR_NAMES_EN: Record<CEFRCode, string> = {
  A1: "Foundations",
  A2: "Developing",
  B1: "Independent",
  B2: "Upper-Intermediate",
  C1: "Advanced",
  C2: "Near-Native",
};

/**
 * Level descriptors in Spanish
 */
export const CEFR_NAMES_ES: Record<CEFRCode, string> = {
  A1: "Fundamentos",
  A2: "En Desarrollo",
  B1: "Independiente",
  B2: "Intermedio Alto",
  C1: "Avanzado",
  C2: "Casi Nativo",
};

/**
 * Get localized CEFR name
 */
export function getCEFRName(level: CEFRCode, lang: "en" | "es" = "en"): string {
  return lang === "es" ? CEFR_NAMES_ES[level] : CEFR_NAMES_EN[level];
}

/**
 * Get full display label (e.g., "A1 - Foundations")
 */
export function getCEFRLabel(level: CEFRCode, lang: "en" | "es" = "en"): string {
  return `${level} - ${getCEFRName(level, lang)}`;
}

/**
 * CEFR level details for AI prompts and processing
 *
 * Structure:
 * - officialDescription: From the official CEFR framework
 * - forbidden: Grammar/vocabulary constraints (what NOT to use)
 * - allowed: Grammar/vocabulary that IS appropriate (often overlooked)
 * - connectors: Transitional words appropriate for this level
 * - styleGuidance: How to write well at this level (preserve narrative quality)
 * - pitfalls: Common mistakes to avoid when adapting to this level
 */
export interface CEFRLevelDetails {
  code: CEFRCode;
  numericLevel: number; // 1-6 for backwards compatibility with AI prompts
  name: string;
  officialDescription: string; // From official CEFR framework
  sentenceLength: string;
  vocabulary: string;
  forbidden: string[]; // Constraints for AI - what NOT to use
  allowed: string[]; // What IS appropriate - often underused
  connectors: string[]; // Transitional words for this level
  styleGuidance: string[]; // How to preserve narrative quality
  pitfalls: string[]; // Common mistakes when adapting to this level
}

/**
 * Full CEFR level specifications for AI processing
 *
 * These definitions balance:
 * 1. Official CEFR descriptors (communicative competence)
 * 2. Grammar constraints (technical guardrails)
 * 3. Style guidance (narrative quality preservation)
 */
export const CEFR_LEVEL_DETAILS: Record<CEFRCode, CEFRLevelDetails> = {
  A1: {
    code: "A1",
    numericLevel: 1,
    name: "Foundations",
    officialDescription: "Can understand and use familiar everyday expressions and very basic phrases aimed at the satisfaction of needs of a concrete type. Can interact in a simple way provided the other person talks slowly and clearly.",
    sentenceLength: "3-10 words",
    vocabulary: "~700 most frequent lemmas (headwords), concrete nouns, simple verbs (go, see, say, want, like, come, take, make, give, know)",
    forbidden: [
      "NO future tense",
      "NO perfect tenses",
      "NO conditionals",
      "NO relative clauses (who, which, that)",
      "NO abstract nouns (consideration, disappointment, curiosity)",
      "NO passive voice",
    ],
    allowed: [
      "Simple present tense",
      "Simple past tense for narration (walked, saw, said, went) — stories are naturally told in past tense",
      "Basic compound sentences with 'and', 'but'",
      "Simple dialogue (breaks up narration naturally)",
      "Pronouns (she, he, it) after subject is clearly established",
      "Basic emotions: happy, sad, scared, surprised, angry",
    ],
    connectors: ["and", "but", "then", "so"],
    styleGuidance: [
      "Write connected prose, not isolated sentences — this is a STORY, not a vocabulary exercise",
      "The story MUST remain a faithful retelling — keep all major plot points, characters, and scenes",
      "Simplify the LANGUAGE, not the STORY — every chapter should cover the same events as the original",
      "Keep cause-and-effect clear: 'She was hungry. So she ate.'",
      "Use simple connectors to maintain narrative flow",
      "Repeat character names for clarity, but not every sentence",
      "After 2-3 sentences about the same subject, pronouns are fine",
      "Preserve basic character emotions and reactions",
      "Simple dialogue adds variety and feels natural",
    ],
    pitfalls: [
      "SUMMARIZING instead of retelling — do NOT condense 3 pages into 3 sentences",
      "Skipping scenes or plot points — every event in the original should appear in simplified form",
      "Creating choppy 'note-taking' style prose (list of disconnected facts)",
      "Removing all personality from characters",
      "Eliminating cause-effect relationships",
      "Over-repeating names in every single sentence",
      "Making text feel like a vocabulary list instead of a story",
    ],
  },
  A2: {
    code: "A2",
    numericLevel: 2,
    name: "Developing",
    officialDescription: "Can understand sentences and frequently used expressions related to areas of most immediate relevance. Can communicate in simple and routine tasks requiring a simple and direct exchange of information. Can describe in simple terms aspects of his/her background and immediate environment.",
    sentenceLength: "6-10 words (occasional 12 for flow)",
    vocabulary: "1,000 most common words, common abstract nouns okay (idea, problem, time), common phrasal verbs",
    forbidden: [
      "NO present perfect (has seen, have gone)",
      "NO past perfect (had seen, had gone)",
      "NO 'will' future (use 'going to' instead)",
      "NO passive voice",
      "NO conditionals (if...would)",
      "NO subjunctive mood",
    ],
    allowed: [
      "Simple past tense (walked, saw, said)",
      "Simple present tense",
      "'Going to' future",
      "Compound sentences with and, but, or, so",
      "Basic subordinate clauses with because, when, before, after",
      "Common phrasal verbs (look at, pick up, get up)",
    ],
    connectors: ["and", "but", "so", "because", "then", "after", "before", "when", "while", "also", "too", "first", "next", "finally"],
    styleGuidance: [
      "Write CONNECTED prose - the key CEFR phrase is 'simple and direct', not fragmented",
      "Preserve the author's voice and humor through simple patterns",
      "Use 'She thought X, but Y happened' for irony",
      "Use 'He wanted to X, so he did Y' to show motivation",
      "Mix simple and compound sentences for natural rhythm",
      "Dialogue conveys personality - use it",
      "Pronouns are natural after the subject is established",
      "Vary sentence length slightly to avoid monotony",
      "Emotional reactions should remain: curious, worried, excited, confused",
    ],
    pitfalls: [
      "Over-fragmenting into tiny disconnected sentences (the #1 problem)",
      "Removing all humor and personality",
      "Eliminating transitional words and connectors",
      "Treating A2 like A1 (A2 readers can handle more complexity)",
      "Using only periods, never commas",
      "Flattening character voice into neutral narration",
    ],
  },
  B1: {
    code: "B1",
    numericLevel: 3,
    name: "Independent",
    officialDescription: "Can understand the main points of clear standard input on familiar matters. Can produce simple connected text on topics which are familiar or of personal interest. Can describe experiences and events, dreams, hopes and ambitions and briefly give reasons and explanations for opinions and plans.",
    sentenceLength: "8-15 words",
    vocabulary: "2,500 words, common idioms and expressions, abstract vocabulary acceptable (decision, possibility, relationship)",
    forbidden: [
      "NO past perfect (had done) - unless essential for clarity",
      "NO third conditional (if had done, would have)",
      "NO complex passive constructions",
      "NO literary/archaic language",
      "NO rare or specialized vocabulary",
    ],
    allowed: [
      "All simple tenses (present, past, future)",
      "Present perfect (has done, have been)",
      "First conditional (if...will)",
      "Second conditional (if...would) - sparingly",
      "Relative clauses (who, which, that)",
      "Basic passive voice (was seen, is called)",
      "Reported speech",
    ],
    connectors: ["and", "but", "so", "because", "however", "although", "even though", "despite", "therefore", "as a result", "then", "after", "before", "when", "while", "as soon as", "until", "if", "unless", "meanwhile", "finally"],
    styleGuidance: [
      "The key CEFR phrase is 'simple CONNECTED text' - maintain full narrative flow",
      "The story should read naturally, not feel 'adapted'",
      "Preserve the author's voice, humor, and style",
      "Keep irony and subtle humor where possible",
      "Complex emotions and internal monologue are appropriate",
      "Character development should remain intact",
      "Subplots and secondary details can be preserved",
      "Descriptive passages add richness - don't eliminate them",
      "Mix simple, compound, and complex sentences naturally",
      "Internal thoughts and reactions add depth",
      "Dialogue should sound natural, not stilted",
    ],
    pitfalls: [
      "Over-simplifying to A2 level (B1 readers can handle much more)",
      "Flattening character voice and personality",
      "Removing descriptive richness",
      "Eliminating internal monologue and character thoughts",
      "Making all sentences the same length (kills rhythm)",
      "Removing narrative tension and foreshadowing",
    ],
  },
  B2: {
    code: "B2",
    numericLevel: 4,
    name: "Upper-Intermediate",
    officialDescription: "Can understand the main ideas of complex text on both concrete and abstract topics. Can interact with a degree of fluency and spontaneity that makes regular interaction with native speakers quite possible without strain. Can produce clear, detailed text on a wide range of subjects.",
    sentenceLength: "10-20 words (flexible)",
    vocabulary: "5,000 words, idioms, expressions, figurative language, abstract and nuanced vocabulary",
    forbidden: [
      "NO third conditional - use sparingly if at all",
      "NO obscure or archaic vocabulary",
      "NO archaic grammatical constructions",
      "NO overly complex embedded clauses (3+ levels deep)",
    ],
    allowed: [
      "All tenses including past perfect",
      "All conditionals (first, second, limited third)",
      "Complex passive constructions",
      "Sophisticated relative clauses",
      "Subjunctive in common expressions",
      "All standard discourse markers",
      "Metaphor, simile, and figurative language",
    ],
    connectors: ["All standard connectors", "moreover", "furthermore", "nevertheless", "consequently", "hence", "thus", "whereas", "in contrast", "on the other hand", "in addition", "as a matter of fact"],
    styleGuidance: [
      "Simplification should be minimal at this level",
      "Preserve the author's full literary voice",
      "Maintain sophisticated narrative techniques",
      "Keep complex character psychology",
      "Preserve stylistic flourishes and word choices",
      "Metaphor, irony, and literary devices should remain",
      "Only simplify what would genuinely confuse a B2 reader",
      "Full literary experience should be maintained",
    ],
    pitfalls: [
      "Over-simplifying (B2 readers are near-fluent)",
      "Removing literary devices and figurative language",
      "Flattening sophisticated prose into basic sentences",
      "Eliminating nuance and subtlety",
    ],
  },
  C1: {
    code: "C1",
    numericLevel: 5,
    name: "Advanced",
    officialDescription: "Can understand a wide range of demanding, longer texts, and recognise implicit meaning. Can express him/herself fluently and spontaneously without much obvious searching for expressions. Can produce clear, well-structured, detailed text on complex subjects, showing controlled use of organisational patterns, connectors and cohesive devices.",
    sentenceLength: "No limit",
    vocabulary: "10,000+ words, full modern vocabulary, literary and sophisticated vocabulary welcome",
    forbidden: [
      "NO archaic pronouns (thee, thou, ye)",
      "NO archaic verb forms (hath, doth, art, wilt)",
      "NO obsolete grammatical structures",
      "NO archaic vocabulary (forsooth, hither, thither, wherefore)",
      "NO poetic inversions that feel dated",
    ],
    allowed: [
      "All modern English grammar without restriction",
      "Full complexity of native expression",
      "Literary and sophisticated constructions",
      "All tenses, moods, and aspects",
      "Complex embedded clauses",
      "Sophisticated vocabulary and register",
    ],
    connectors: ["All connectors without restriction"],
    styleGuidance: [
      "Only modernize archaic elements - preserve everything else",
      "Maintain the author's complete voice and style",
      "Keep all literary devices and techniques",
      "Sophistication should not be reduced",
      "If the original is complex, the C1 version should be complex",
      "Replace archaic forms with modern equivalents: thee→you, hath→has, wherefore→why",
    ],
    pitfalls: [
      "Over-simplifying (C1 is near-native)",
      "Modernizing too aggressively (only change truly archaic elements)",
      "Reducing literary quality",
    ],
  },
  C2: {
    code: "C2",
    numericLevel: 6,
    name: "Near-Native",
    officialDescription: "Can understand with ease virtually everything heard or read. Can summarise information from different spoken and written sources, reconstructing arguments and accounts in a coherent presentation. Can express him/herself spontaneously, very fluently and precisely, differentiating finer shades of meaning even in more complex situations.",
    sentenceLength: "No limit",
    vocabulary: "Unrestricted (including archaic, literary, specialized)",
    forbidden: [], // No restrictions - original literary texts
    allowed: [
      "Everything - this is the original or near-original text",
      "All archaic forms preserved",
      "All literary devices preserved",
      "Full original complexity",
    ],
    connectors: ["All - no restrictions"],
    styleGuidance: [
      "No adaptation needed",
      "Preserve the original text as-is",
      "This level is for readers who want the authentic original experience",
    ],
    pitfalls: [
      "Making any unnecessary changes",
    ],
  },
};

// ============================================
// CONVERSION UTILITIES
// ============================================

/**
 * Legacy level code mapping (l1-l6 to A1-C2)
 */
const LEGACY_TO_CEFR: Record<string, CEFRCode> = {
  l1: "A1",
  l2: "A2",
  l3: "B1",
  l4: "B2",
  l5: "C1",
  l6: "C2",
  // Also handle numeric strings
  "1": "A1",
  "2": "A2",
  "3": "B1",
  "4": "B2",
  "5": "C1",
  "6": "C2",
};

/**
 * CEFR to numeric level (for AI prompts that use numbers)
 */
const CEFR_TO_NUMERIC: Record<CEFRCode, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

/**
 * Numeric to CEFR
 */
const NUMERIC_TO_CEFR: Record<number, CEFRCode> = {
  1: "A1",
  2: "A2",
  3: "B1",
  4: "B2",
  5: "C1",
  6: "C2",
};

/**
 * Convert any level format to CEFR code
 * Handles: "l1", "L1", "1", 1, "A1", "a1"
 */
export function toCEFR(level: string | number | null | undefined): CEFRCode {
  if (level === null || level === undefined) return "B1"; // Default

  // If already a valid CEFR code
  const upperLevel = String(level).toUpperCase();
  if (ALL_CEFR_LEVELS.includes(upperLevel as CEFRCode)) {
    return upperLevel as CEFRCode;
  }

  // Try legacy mapping
  const lowerLevel = String(level).toLowerCase();
  if (LEGACY_TO_CEFR[lowerLevel]) {
    return LEGACY_TO_CEFR[lowerLevel];
  }

  // Try numeric
  const numLevel = typeof level === "number" ? level : parseInt(String(level), 10);
  if (!isNaN(numLevel) && numLevel >= 1 && numLevel <= 6) {
    return NUMERIC_TO_CEFR[numLevel];
  }

  // Default to B1
  return "B1";
}

/**
 * Convert CEFR to numeric level (for AI prompts)
 */
export function toNumericLevel(level: CEFRCode | string | number): number {
  const cefr = toCEFR(level);
  return CEFR_TO_NUMERIC[cefr];
}

/**
 * Convert CEFR to legacy folder name (l1-l6) for content file paths
 * Used when loading content from /content/[story]/[level]/ folders
 */
export function toFolderName(level: CEFRCode | string | number): string {
  const numLevel = toNumericLevel(level);
  return `l${numLevel}`;
}

/**
 * Convert numeric level to CEFR
 */
export function fromNumericLevel(level: number): CEFRCode {
  return NUMERIC_TO_CEFR[level] || "B1";
}

/**
 * Check if a string is a valid CEFR code
 */
export function isValidCEFR(level: string | null | undefined): level is CEFRCode {
  if (!level) return false;
  return ALL_CEFR_LEVELS.includes(level.toUpperCase() as CEFRCode);
}

/**
 * Get level details for AI processing
 */
export function getLevelDetails(level: CEFRCode | string | number): CEFRLevelDetails {
  const cefr = toCEFR(level);
  return CEFR_LEVEL_DETAILS[cefr];
}

// ============================================
// DROPDOWN / UI OPTIONS
// ============================================

export interface CEFROption {
  value: CEFRCode;
  label: string;
  name: string;
}

/**
 * Get CEFR options for dropdowns
 */
export function getCEFROptions(lang: "en" | "es" = "en"): CEFROption[] {
  return ALL_CEFR_LEVELS.map((code) => ({
    value: code,
    label: getCEFRLabel(code, lang),
    name: getCEFRName(code, lang),
  }));
}
