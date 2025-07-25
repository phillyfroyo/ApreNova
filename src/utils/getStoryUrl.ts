// src/utils/getStoryUrl.ts
import type { Language } from "@/types/i18n";

export function getStoryUrl(
  storySlug: string,
  level: string,
  chapter: number | string,
  page: number | string,
  lng: Language
): string {
  return `/${lng}/stories/${storySlug}/${level}/${chapter}/${page}`;
}
