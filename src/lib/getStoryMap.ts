// lib/getStoryMap.ts

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

export async function getStoryMap(storySlug: string, level: string): Promise<{
  hasChapters: boolean;
  chapters: {
    chapter: number;
    pages: number[];
  }[];
}> {
  try {
    const levelContent = await loadLevelContent(storySlug, level);
    const chapters = Object.keys(levelContent.chapters).map((chapterKey) => {
      const chapterNum = parseInt(chapterKey);
      const pages = Object.keys(levelContent.chapters[chapterNum].pages).map(pageKey => parseInt(pageKey));
      return { chapter: chapterNum, pages: pages.sort((a, b) => a - b) };
    });

    return {
      hasChapters: levelContent.hasChapters,
      chapters: chapters.sort((a, b) => a.chapter - b.chapter),
    };
  } catch (err) {
    console.error(`Failed to load story content for ${storySlug}/${level}:`, err);
    return {
      hasChapters: false,
      chapters: [],
    };
  }
}
