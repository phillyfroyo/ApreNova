// src/utils/getStoryUrl.ts
import type { Language } from "@/types/i18n";
import { toCEFR } from "@/lib/stories";

export function getStoryUrl(
  storySlug: string,
  level: string,
  chapter: number | string,
  page: number | string,
  lng: Language
): string {
  // Convert to CEFR format for URLs (A1, A2, B1, B2, C1)
  const cefrLevel = toCEFR(level);
  return `/${lng}/stories/${storySlug}/${cefrLevel}/${chapter}/${page}`;
}
