// src/constants/i18n.ts
import type { Language } from "@/types/i18n";

export const LANGUAGES: Record<Language, { label: string; flag: string }> = {
  en: { label: "English", flag: "🇺🇸" },
  es: { label: "Español", flag: "🇲🇽" },
};

// Optional fallback
export const DEFAULT_LANGUAGE: Language = "es";
