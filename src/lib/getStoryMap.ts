// lib/getStoryMap.ts

import fs from "fs";
import path from "path";

export async function getStoryMap(storySlug: string, level: string): Promise<{
  hasChapters: boolean;
  chapters: {
    chapter: number;
    pages: number[];
  }[];
}> {
  try {
    const consolidatedFile = await import(`@/content/${storySlug}/${level}/content.ts`);
    const levelContent = consolidatedFile.default || consolidatedFile.levelContent;
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
    console.error(`Failed to load consolidated file for ${storySlug}/${level}:`, err);
    return {
      hasChapters: false,
      chapters: [],
    };
  }
}
