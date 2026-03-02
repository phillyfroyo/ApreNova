// src/lib/getStoryContent.ts
import type { Language } from "@/types/i18n";
import { getContentFromRegistry } from "./contentRegistry";
import type { StoryLine } from "@/lib/story-processing/text-processing";

/**
 * Build stanzas array from lines that have stanzaNumber metadata.
 * This is used when content files have stanzaNumber on lines but no pre-built stanzas array.
 */
function buildStanzasFromLines(lines: StoryLine[]): StoryLine[][] | undefined {
  if (!lines || lines.length === 0) return undefined;

  // Check if any lines have stanzaNumber metadata
  const hasStanzaNumbers = lines.some(line => line.stanzaNumber !== undefined);
  if (!hasStanzaNumbers) return undefined;

  // Group lines by stanzaNumber
  const stanzaMap = new Map<number, StoryLine[]>();

  for (const line of lines) {
    const stanzaNum = line.stanzaNumber ?? 0;
    if (!stanzaMap.has(stanzaNum)) {
      stanzaMap.set(stanzaNum, []);
    }
    stanzaMap.get(stanzaNum)!.push(line);
  }

  // Convert to array, sorted by stanza number
  const stanzaNumbers = Array.from(stanzaMap.keys()).sort((a, b) => a - b);
  return stanzaNumbers.map(num => stanzaMap.get(num)!);
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

    const levelContent = getContentFromRegistry(storySlug, level);
    if (!levelContent) {
      throw new Error(`Content not found in registry: ${storySlug}/${level}`);
    }

    const chapterNum = parseInt(chapter.replace('ch', ''));
    const pageNum = parseInt(page.replace('page-', ''));
    const pageData = levelContent.chapters[chapterNum]?.pages[pageNum];

    if (pageData) {
      // Use pre-built stanzas if available, otherwise build from lines with stanzaNumber
      const stanzas = pageData.stanzas || buildStanzasFromLines(pageData.lines);

      return {
        storySlug: levelContent.storySlug,
        level: levelContent.level,
        chapter: chapterNum,
        page: pageNum,
        hasChapters: levelContent.hasChapters,
        lines: pageData.lines,
        // Include stanzas for poem rendering (nested array for stanza-level interactions)
        stanzas,
        // Include poem metadata for anthology navigation
        poemNumber: pageData.poemNumber,
        poemTitle: pageData.poemTitle,
        isFirstPageOfPoem: pageData.isFirstPageOfPoem,
        isContinuation: pageData.isContinuation,
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
