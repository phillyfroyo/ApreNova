// /src/constants/levels.ts
// Re-exports from central cefr.ts for backwards compatibility

import {
  type CEFRCode,
  ALL_CEFR_LEVELS,
  CEFR_NAMES_EN,
  CEFR_NAMES_ES,
  getCEFRLabel,
} from "@/lib/cefr";

// Legacy exports - use CEFRCode from @/lib/cefr instead
export type Level = CEFRCode;

export const ALL_LEVELS = ALL_CEFR_LEVELS;

// Legacy label format
export const LEVEL_LABELS: Record<CEFRCode, string> = {
  A1: "A1 - Foundations",
  A2: "A2 - Developing",
  B1: "B1 - Independent",
  B2: "B2 - Upper-Intermediate",
  C1: "C1 - Advanced",
  C2: "C2 - Mastery",
};

// Spanish labels
export const LEVEL_LABELS_ES: Record<CEFRCode, string> = {
  A1: "A1 - Fundamentos",
  A2: "A2 - En Desarrollo",
  B1: "B1 - Independiente",
  B2: "B2 - Intermedio Alto",
  C1: "C1 - Avanzado",
  C2: "C2 - Maestría",
};

// Get label by language
export function getLevelLabel(level: CEFRCode, lang: "en" | "es" = "en"): string {
  return lang === "es" ? LEVEL_LABELS_ES[level] : LEVEL_LABELS[level];
}
