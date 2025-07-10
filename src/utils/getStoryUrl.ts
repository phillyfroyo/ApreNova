// src/utils/getStoryUrl.ts
import type { Language } from "@/types/i18n";

export function getStoryUrl(
  storySlug: string,
  level: string,
  part: string,
  lang: Language
): string {
  return `/${lang}/stories/${storySlug}/${level}/${part}`;
}
