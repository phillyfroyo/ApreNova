// /src/lib/t.ts
import en from "@/content/ui/en";
import es from "@/content/ui/es";
import type { Language } from "@/types/i18n";

const translations = { en, es };

export function t(
  lang: Language,
  section: keyof typeof en,
  key: string,
  variables?: Record<string, string | number>
): string {
  const template = translations[lang][section]?.[key] ?? "";

  if (!variables) return template;

  // Replace any {key} in the template with corresponding variable value
  return template.replace(/\{(\w+)\}/g, (_, variable) =>
    variables[variable] !== undefined ? String(variables[variable]) : `{${variable}}`
  );
}

