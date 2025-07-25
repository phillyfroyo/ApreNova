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
  const basePath = path.join(process.cwd(), "src", "content", storySlug, level);
  const chapterDirs = fs
    .readdirSync(basePath, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory() && dirent.name.startsWith("ch"))
    .map((dirent) => dirent.name);

  const hasChapters = chapterDirs.length > 1;

  const chapters = chapterDirs.map((chName) => {
    const chNum = parseInt(chName.replace("ch", ""));
    const pageFiles = fs
      .readdirSync(path.join(basePath, chName))
      .filter((f) => f.endsWith(".en.ts") && f.startsWith("page-"));
    const pageNums = pageFiles.map((f) =>
      parseInt(f.replace("page-", "").replace(".en.ts", ""))
    );
    return { chapter: chNum, pages: pageNums.sort((a, b) => a - b) };
  });

  return {
    hasChapters,
    chapters: chapters.sort((a, b) => a.chapter - b.chapter),
  };
}
