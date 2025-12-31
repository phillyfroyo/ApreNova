// lib/getStoryMap.ts
import { getContentFromRegistry } from "./contentRegistry";

export async function getStoryMap(storySlug: string, level: string): Promise<{
  hasChapters: boolean;
  chapters: {
    chapter: number;
    pages: number[];
  }[];
}> {
  try {
    const levelContent = getContentFromRegistry(storySlug, level);
    if (!levelContent) {
      throw new Error(`Content not found in registry: ${storySlug}/${level}`);
    }

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
