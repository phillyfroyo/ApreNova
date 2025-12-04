// src/lib/admin/story-generator.ts
import type { StoryType, StoryTag, StoryOrigin, StoryAttribution } from "@/types/story";

export interface StoryLine {
  en: string;
  es: string;
}

export interface StoryPage {
  lines: StoryLine[];
}

export interface StoryChapter {
  pages: Record<number, StoryPage>;
}

export interface GeneratedStoryContent {
  storySlug: string;
  level: number;
  hasChapters: boolean;
  chapters: Record<number, StoryChapter>;
}

export interface StoryMetadataInput {
  slug: string;
  title: { en: string; es: string };
  description: { en: string; es: string };
  image?: string;
  levels: number[];
  isPremiumOnly?: boolean;
  // Tagging fields
  storyType: StoryType;
  origin: StoryOrigin;
  tags?: StoryTag[];
  targetAudience?: "children" | "teen" | "adult" | "all";
}

/**
 * Parse raw text into chapters based on markers (--- or CHAPTER)
 */
export function parseChapters(rawText: string): string[][] {
  // Split by chapter markers
  const chapterTexts = rawText.split(/---|\bCHAPTER\b\s*\d*/i).filter((c) => c.trim());

  // For each chapter, split into lines
  return chapterTexts.map((chapter) =>
    chapter
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
  );
}

/**
 * Check if a line is a PAGE marker
 */
function isPageMarker(line: string): boolean {
  const trimmed = line.trim().toUpperCase();
  return trimmed === "PAGE" || trimmed === "---PAGE---" || trimmed === "[PAGE]" || trimmed === "PAGE BREAK";
}

/**
 * Paginate lines into pages.
 * Supports manual PAGE markers for explicit page breaks.
 * If no PAGE markers found, falls back to automatic pagination based on linesPerPage.
 */
export function paginateLines(
  lines: string[],
  linesPerPage: number = 10
): string[][] {
  // Check if there are any PAGE markers in the content
  const hasPageMarkers = lines.some(isPageMarker);

  if (hasPageMarkers) {
    // Manual pagination using PAGE markers
    const pages: string[][] = [];
    let currentPage: string[] = [];

    for (const line of lines) {
      if (isPageMarker(line)) {
        // PAGE marker found - end current page and start new one
        if (currentPage.length > 0) {
          pages.push([...currentPage]);
          currentPage = [];
        }
      } else {
        currentPage.push(line);
      }
    }

    // Don't forget remaining lines
    if (currentPage.length > 0) {
      pages.push(currentPage);
    }

    return pages;
  }

  // Automatic pagination based on linesPerPage
  const pages: string[][] = [];
  let currentPage: string[] = [];

  for (const line of lines) {
    currentPage.push(line);

    // Check if we should end the page
    if (currentPage.length >= linesPerPage) {
      // Try to find a good breaking point (sentence ending)
      const lastLineEndsSentence =
        line.endsWith(".") ||
        line.endsWith("!") ||
        line.endsWith("?") ||
        line.endsWith('"');

      if (lastLineEndsSentence || currentPage.length >= linesPerPage + 2) {
        pages.push([...currentPage]);
        currentPage = [];
      }
    }
  }

  // Don't forget remaining lines
  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}

/**
 * Generate TypeScript content file for a story level
 */
export function generateContentFileTS(content: GeneratedStoryContent): string {
  const chaptersObj: Record<number, { pages: Record<number, { lines: StoryLine[] }> }> = {};

  for (const [chapterNum, chapter] of Object.entries(content.chapters)) {
    const pagesObj: Record<number, { lines: StoryLine[] }> = {};

    for (const [pageNum, page] of Object.entries(chapter.pages)) {
      pagesObj[parseInt(pageNum)] = { lines: page.lines };
    }

    chaptersObj[parseInt(chapterNum)] = { pages: pagesObj };
  }

  // Format the content object as TypeScript
  const contentStr = JSON.stringify(
    {
      storySlug: content.storySlug,
      level: content.level,
      hasChapters: content.hasChapters,
      chapters: chaptersObj,
    },
    null,
    2
  );

  // Convert JSON to TypeScript export
  return `export const levelContent = ${contentStr};\n`;
}

/**
 * Generate the entry to add to STORY_METADATA array
 */
export function generateMetadataEntry(metadata: StoryMetadataInput): string {
  const levelsArray = metadata.levels.map((l) => `"l${l}"`).join(", ");
  const tagsArray = metadata.tags && metadata.tags.length > 0
    ? metadata.tags.map((t) => `"${t}"`).join(", ")
    : null;

  // Build origin string
  let originStr: string;
  if (metadata.origin.isOriginal) {
    originStr = `{ isOriginal: true }`;
  } else {
    const attr = metadata.origin.attribution;
    const attrParts: string[] = [];
    attrParts.push(`author: "${attr.author}"`);
    if (attr.authorLifespan) attrParts.push(`authorLifespan: "${attr.authorLifespan}"`);
    if (attr.originalTitle) attrParts.push(`originalTitle: "${attr.originalTitle}"`);
    if (attr.yearPublished) attrParts.push(`yearPublished: ${attr.yearPublished}`);
    if (attr.source) attrParts.push(`source: "${attr.source}"`);
    if (attr.translator) attrParts.push(`translator: "${attr.translator}"`);
    attrParts.push(`publicDomain: ${attr.publicDomain}`);
    if (attr.publicDomainNote) attrParts.push(`publicDomainNote: "${attr.publicDomainNote}"`);
    originStr = `{ isOriginal: false, attribution: { ${attrParts.join(", ")} } }`;
  }

  let entry = `  {
    slug: "${metadata.slug}",
    image: "${metadata.image || `/images/${metadata.slug}-thumbnail.png`}",
    levels: [${levelsArray}],${metadata.isPremiumOnly ? `\n    isPremiumOnly: true,` : ""}
    type: "${metadata.storyType}",
    origin: ${originStr},`;

  if (tagsArray) {
    entry += `\n    tags: [${tagsArray}],`;
  }

  if (metadata.targetAudience) {
    entry += `\n    targetAudience: "${metadata.targetAudience}",`;
  }

  entry += `\n  },`;

  return entry;
}

/**
 * Generate UI translation entries for both en.ts and es.ts
 */
export function generateUITranslationEntry(
  lang: "en" | "es",
  metadata: StoryMetadataInput
): string {
  return `  "${metadata.slug}": {
    title: "${lang === "en" ? metadata.title.en : metadata.title.es}",
    description: "${lang === "en" ? metadata.description.en : metadata.description.es}",
  },`;
}

/**
 * Build the complete content structure from parsed and translated text
 */
export function buildContentStructure(
  storySlug: string,
  level: number,
  chapters: { en: string[][]; es: string[][] }
): GeneratedStoryContent {
  const hasChapters = chapters.en.length > 1;
  const chapterContent: Record<number, StoryChapter> = {};

  for (let chIdx = 0; chIdx < chapters.en.length; chIdx++) {
    const enPages = paginateLines(chapters.en[chIdx]);
    const esPages = paginateLines(chapters.es[chIdx]);

    const pages: Record<number, StoryPage> = {};

    // Match pages by index
    const maxPages = Math.max(enPages.length, esPages.length);

    for (let pIdx = 0; pIdx < maxPages; pIdx++) {
      const enLines = enPages[pIdx] || [];
      const esLines = esPages[pIdx] || [];
      const maxLines = Math.max(enLines.length, esLines.length);

      const lines: StoryLine[] = [];
      for (let lIdx = 0; lIdx < maxLines; lIdx++) {
        lines.push({
          en: enLines[lIdx] || "",
          es: esLines[lIdx] || "",
        });
      }

      pages[pIdx + 1] = { lines };
    }

    chapterContent[chIdx + 1] = { pages };
  }

  return {
    storySlug,
    level,
    hasChapters,
    chapters: chapterContent,
  };
}
