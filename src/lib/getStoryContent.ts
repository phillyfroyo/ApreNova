// src/lib/getStoryContent.ts
import type { Language } from "@/types/i18n";

/**
 * Try to load story content from either split-chapter format (index.ts) or single-file format (content.ts)
 */
async function loadLevelContent(storySlug: string, level: string) {
  // Try split-chapter format first (index.ts)
  try {
    const indexFile = await import(`@/content/${storySlug}/${level}/index.ts`);
    return indexFile.default || indexFile.levelContent;
  } catch {
    // Fall back to single-file format (content.ts)
    const consolidatedFile = await import(`@/content/${storySlug}/${level}/content.ts`);
    return consolidatedFile.default || consolidatedFile.levelContent;
  }
}

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

    const levelContent = await loadLevelContent(storySlug, level);
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
