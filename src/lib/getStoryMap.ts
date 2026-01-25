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

/** Poem info for anthology navigation */
interface PoemNavInfo {
  number: number;      // 1-based poem number
  title: string;       // Poem title or Roman numeral
  startPage: number;   // First page of this poem
  endPage: number;     // Last page of this poem
  pageCount: number;   // Total pages this poem spans
}

export async function getStoryMap(storySlug: string, level: string): Promise<{
  hasChapters: boolean;
  chapters: {
    chapter: number;
    pages: number[];
    title?: string;
    subtitle?: string;
    poems?: PoemNavInfo[];  // For anthologies: poem list for navigation
  }[];
  structureType?: "prose" | "anthology" | "epic" | "script";
}> {
  try {
    const levelContent = await loadLevelContent(storySlug, level);
    const chapters = Object.keys(levelContent.chapters).map((chapterKey) => {
      const chapterNum = parseInt(chapterKey);
      const chapterData = levelContent.chapters[chapterNum];
      const pages = Object.keys(chapterData.pages).map(pageKey => parseInt(pageKey));

      return {
        chapter: chapterNum,
        pages: pages.sort((a, b) => a - b),
        title: chapterData.metadata?.title,
        subtitle: chapterData.metadata?.subtitle,
        poems: chapterData.poems,  // Include poem navigation data for anthologies
      };
    });

    return {
      hasChapters: levelContent.hasChapters,
      chapters: chapters.sort((a, b) => a.chapter - b.chapter),
      structureType: levelContent.structureType,  // Include structure type for navigation labels
    };
  } catch (err) {
    console.error(`Failed to load story content for ${storySlug}/${level}:`, err);
    return {
      hasChapters: false,
      chapters: [],
    };
  }
}
