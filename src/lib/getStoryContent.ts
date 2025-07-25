// src/lib/getStoryContent.ts
import type { Language } from "@/types/i18n";

export async function getStoryContent(
  storySlug: string,
  level: string,
  chapter: string,
  page: string,
  lng: Language
) {
  try {
    console.log("🌍 getStoryContent called with:", {
      storySlug,
      level,
      chapter,
      page,
      lng,
    });

    const file = await import(
      `@/content/${storySlug}/${level}/${chapter}/${page}.${lng}.ts`
    );
    return file.default;
  } catch (err) {
    console.error(
      `❌ Failed to load: /content/${storySlug}/${level}/${chapter}/${page}.${lng}.ts`,
      err
    );
    return {
      storySlug,
      level: parseInt(level),
      chapter: parseInt(chapter),
      page: parseInt(page),
      hasChapters: false,
      lines: [{ en: "Content not available.", es: "Contenido no disponible." }],
    };
  }
}
