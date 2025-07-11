// /src/lib/t.ts
import type { Language } from "@/types/i18n";
import en from "@/content/ui/en";
import es from "@/content/ui/es";

const dictionaries = {
  en,
  es,
};

export function t(lang: Language, key: keyof typeof en): string {
  const dict = dictionaries[lang] || dictionaries.en;
  return dict[key] || `[${key}]`;
}
