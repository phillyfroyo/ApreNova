// src/lib/getStoryContent.ts
import type { Language } from "@/types/i18n";

export async function getStoryContent(
  storySlug: string,
  level: string,
  part: string,
  lng: Language
) {
  try {
    console.log("🌍 getStoryContent called with:", { storySlug, level, part, lng });

    const file = await import(`@/content/${storySlug}/${level}/part-${part}.${lng}.ts`);
    return file.default;
  } catch (err) {
    console.error(
      `❌ Failed to load: /content/${storySlug}/${level}/part-${part}.${lng}.ts`,
      err
    );
    return [{ en: "Content not available.", es: "Contenido no disponible." }];
  }
}

