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

    const consolidatedFile = await import(`@/content/${storySlug}/${level}/content.ts`);
    const levelContent = consolidatedFile.default || consolidatedFile.levelContent;
    const chapterNum = parseInt(chapter.replace('ch', ''));
    const pageNum = parseInt(page.replace('page-', ''));
    const pageData = levelContent.chapters[chapterNum]?.pages[pageNum];
    
    if (pageData) {
      return {
        storySlug: levelContent.storySlug,
        level: levelContent.level,
        chapter: chapterNum,
        page: pageNum,
        hasChapters: levelContent.hasChapters,
        lines: pageData.lines
      };
    } else {
      throw new Error(`Page not found: chapter ${chapterNum}, page ${pageNum}`);
    }
  } catch (err) {
    console.error(
      `❌ Failed to load content for: ${storySlug}/${level}/${chapter}/${page}`,
      err
    );
    return {
      storySlug,
      level: parseInt(level.replace('l', '')),
      chapter: parseInt(chapter.replace('ch', '')),
      page: parseInt(page.replace('page-', '')),
      hasChapters: false,
      lines: [{ en: "Content not available.", es: "Contenido no disponible." }],
    };
  }
}
