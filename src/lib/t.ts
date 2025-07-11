// /src/lib/t.ts
import en from "@/content/ui/en";
import es from "@/content/ui/es";
import type { Language } from "@/types/i18n";

const translations = { en, es };

export function t(
  lang: Language,
  section: keyof typeof en,
  key: string
): string {
  return translations[lang][section]?.[key] ?? "";
}
