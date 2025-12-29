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
  C2: "Mastery",
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
  C2: "Maestr\u00eda",
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
 */
export interface CEFRLevelDetails {
  code: CEFRCode;
  numericLevel: number; // 1-6 for backwards compatibility with AI prompts
  name: string;
  sentenceLength: string;
  vocabulary: string;
  forbidden: string[]; // Constraints for AI - what NOT to use
}

/**
 * Full CEFR level specifications for AI processing
 */
export const CEFR_LEVEL_DETAILS: Record<CEFRCode, CEFRLevelDetails> = {
  A1: {
    code: "A1",
    numericLevel: 1,
    name: "Foundations",
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
  A2: {
    code: "A2",
    numericLevel: 2,
    name: "Developing",
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
  B1: {
    code: "B1",
    numericLevel: 3,
    name: "Independent",
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
  B2: {
    code: "B2",
    numericLevel: 4,
    name: "Upper-Intermediate",
    sentenceLength: "10-20 words",
    vocabulary: "5,000 words",
    forbidden: [
      "NO third conditional (save for C1)",
      "NO obscure vocabulary",
      "NO archaic constructions",
    ],
  },
  C1: {
    code: "C1",
    numericLevel: 5,
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
  C2: {
    code: "C2",
    numericLevel: 6,
    name: "Mastery",
    sentenceLength: "No limit",
    vocabulary: "Unrestricted (including archaic, literary, specialized)",
    forbidden: [], // No restrictions - original literary texts
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
