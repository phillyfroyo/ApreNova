// src/lib/admin/story-generator.ts
import type { StoryType, StoryTag, StoryOrigin, StoryAttribution } from "@/types/story";
import type { CEFRCode } from "@/lib/cefr";

// Re-export text normalization utilities from text-preprocessor
export { detectLineBreakStyle, normalizeLineBreaks, getLineBreakStyleDescription } from "./text-preprocessor";
export type { LineBreakStyle } from "./text-preprocessor";

// ============================================
// STRING UTILITIES
// ============================================

/**
 * Helper to escape strings for JavaScript code output
 */
function escapeJsString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/**
 * Serialize the new StoryAttribution format to JavaScript code
 */
function serializeAttribution(attr: StoryAttribution): string {
  const parts: string[] = [];

  // Author (required)
  const authorParts: string[] = [];
  authorParts.push(`name: "${escapeJsString(attr.author.name)}"`);
  if (attr.author.lifespan) authorParts.push(`lifespan: "${escapeJsString(attr.author.lifespan)}"`);
  if (attr.author.isUnknown) authorParts.push(`isUnknown: true`);
  if (attr.author.isCollective) authorParts.push(`isCollective: true`);
  if (attr.author.note) authorParts.push(`note: "${escapeJsString(attr.author.note)}"`);
  parts.push(`author: { ${authorParts.join(", ")} }`);

  // Dating
  if (attr.yearWritten) parts.push(`yearWritten: "${escapeJsString(attr.yearWritten)}"`);
  if (attr.yearFirstPublished) parts.push(`yearFirstPublished: ${attr.yearFirstPublished}`);

  // Source Edition
  if (attr.sourceEdition) {
    const seParts: string[] = [];
    if (attr.sourceEdition.title) seParts.push(`title: "${escapeJsString(attr.sourceEdition.title)}"`);
    if (attr.sourceEdition.publisher) seParts.push(`publisher: "${escapeJsString(attr.sourceEdition.publisher)}"`);
    if (attr.sourceEdition.publicationYear) seParts.push(`publicationYear: ${attr.sourceEdition.publicationYear}`);
    if (attr.sourceEdition.editor) seParts.push(`editor: "${escapeJsString(attr.sourceEdition.editor)}"`);
    seParts.push(`isPublicDomain: ${attr.sourceEdition.isPublicDomain}`);
    if (attr.sourceEdition.publicDomainNote) seParts.push(`publicDomainNote: "${escapeJsString(attr.sourceEdition.publicDomainNote)}"`);
    if (attr.sourceEdition.url) seParts.push(`url: "${escapeJsString(attr.sourceEdition.url)}"`);
    if (attr.sourceEdition.notes) seParts.push(`notes: "${escapeJsString(attr.sourceEdition.notes)}"`);
    parts.push(`sourceEdition: { ${seParts.join(", ")} }`);
  }

  // Translator
  if (attr.translator) {
    const trParts: string[] = [];
    trParts.push(`name: "${escapeJsString(attr.translator.name)}"`);
    if (attr.translator.lifespan) trParts.push(`lifespan: "${escapeJsString(attr.translator.lifespan)}"`);
    if (attr.translator.translationYear) trParts.push(`translationYear: ${attr.translator.translationYear}`);
    trParts.push(`isPublicDomain: ${attr.translator.isPublicDomain}`);
    if (attr.translator.publicDomainNote) trParts.push(`publicDomainNote: "${escapeJsString(attr.translator.publicDomainNote)}"`);
    parts.push(`translator: { ${trParts.join(", ")} }`);
  }

  // Rights (required)
  const rightsParts: string[] = [];
  rightsParts.push(`originalWorkStatus: "${attr.rights.originalWorkStatus}"`);
  rightsParts.push(`displayStatement: "${escapeJsString(attr.rights.displayStatement)}"`);
  if (attr.rights.provenanceNote) rightsParts.push(`provenanceNote: "${escapeJsString(attr.rights.provenanceNote)}"`);
  if (attr.rights.provenanceUrl) rightsParts.push(`provenanceUrl: "${escapeJsString(attr.rights.provenanceUrl)}"`);
  if (attr.rights.copyrightNote) rightsParts.push(`copyrightNote: "${escapeJsString(attr.rights.copyrightNote)}"`);
  parts.push(`rights: { ${rightsParts.join(", ")} }`);

  // Region/Culture
  if (attr.region) parts.push(`region: "${escapeJsString(attr.region)}"`);
  if (attr.culturalInfluences && attr.culturalInfluences.length > 0) {
    parts.push(`culturalInfluences: [${attr.culturalInfluences.map(c => `"${escapeJsString(c)}"`).join(", ")}]`);
  }

  // Genres
  if (attr.genres && attr.genres.length > 0) {
    parts.push(`genres: [${attr.genres.map(g => `"${escapeJsString(g)}"`).join(", ")}]`);
  }

  return `{ ${parts.join(", ")} }`;
}

export interface StoryLine {
  en: string;
  es: string;
  // Poem support
  stanzaNumber?: number;
  isStanzaBreak?: boolean;
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
  levels: CEFRCode[];  // CEFR codes like "A1", "A2", "B1", etc.
  isPremiumOnly?: boolean;
  // Tagging fields
  storyType: StoryType;
  origin: StoryOrigin;
  tags?: StoryTag[];
  targetAudience?: "children" | "teen" | "adult" | "all";
  // Content structure type - determines navigation labels
  structureType?: "prose" | "anthology" | "epic" | "script";
  // Original level - the CEFR level of the unmodified source text
  originalLevel?: CEFRCode;
}

/**
 * Parse raw text into chapters based on markers
 *
 * Handles multiple formats:
 * - "--- Chapter X: Title ---" (full divider format from generation step)
 * - "--- Capítulo X: Título ---" (Spanish equivalent)
 * - "CHAPTER X" or "CHAPTER X: Title"
 * - Simple "---" dividers (legacy)
 */
export function parseChapters(rawText: string): string[][] {
  // Step 1: Normalize the text - replace full chapter dividers with a clean separator
  // Match patterns like "--- Chapter 2: Title ---" or "--- Capítulo 3: Título ---"
  // Also handle cases where the title might be duplicated like "Chapter 3: Chapter 3"
  let normalized = rawText
    // Full divider format: --- Chapter X: Title --- (possibly with varying whitespace)
    .replace(/---\s*(Chapter|Capítulo)\s+\d+\s*[:\-—–]?\s*[^-]*---/gi, '\n---CHAPTER_BREAK---\n')
    // Also handle simpler format: --- Chapter X ---
    .replace(/---\s*(Chapter|Capítulo)\s+\d+\s*---/gi, '\n---CHAPTER_BREAK---\n')
    // Handle standalone CHAPTER markers (not wrapped in ---)
    .replace(/^\s*(CHAPTER|Capítulo)\s+\d+\s*[:\-—–]?\s*.*$/gim, '\n---CHAPTER_BREAK---\n')
    // Handle simple --- dividers (but not our placeholder)
    .replace(/^---(?!CHAPTER_BREAK)---*\s*$/gm, '\n---CHAPTER_BREAK---\n');

  // Step 2: Split by our clean marker
  const chapterTexts = normalized
    .split('---CHAPTER_BREAK---')
    .map(chunk => chunk.trim())
    .filter(chunk => chunk.length > 0);

  // Step 3: For each chapter, split into lines and clean up
  return chapterTexts.map((chapter) =>
    chapter
      .split("\n")
      .map((line) => line.trim())
      // Filter out empty lines and any remaining chapter title lines that slipped through
      .filter((line) => {
        if (line.length === 0) return false;
        // Filter out lines that are just chapter titles (e.g., "Chapter 2: Chapter 2" or "Capítulo 3")
        if (/^(Chapter|Capítulo)\s+\d+\s*[:\-—–]?\s*(Chapter|Capítulo)?\s*\d*\s*$/i.test(line)) return false;
        // Filter out lines that are just a colon (artifact from bad parsing)
        if (line === ':') return false;
        return true;
      })
  ).filter(chapter => chapter.length > 0); // Remove any empty chapters
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
  // Handle undefined/null/empty lines
  if (!lines || !Array.isArray(lines) || lines.length === 0) {
    return [[]];
  }

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
 * Generate TypeScript content file for a story level (single file format)
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
 * Generate TypeScript content file for a single chapter (split format)
 */
export function generateChapterFileTS(
  storySlug: string,
  level: number,
  chapterNum: number,
  chapter: StoryChapter
): string {
  const pagesObj: Record<number, { lines: StoryLine[] }> = {};

  for (const [pageNum, page] of Object.entries(chapter.pages)) {
    pagesObj[parseInt(pageNum)] = { lines: page.lines };
  }

  const contentStr = JSON.stringify(
    {
      storySlug,
      level,
      chapter: chapterNum,
      pages: pagesObj,
    },
    null,
    2
  );

  return `export const chapterContent = ${contentStr};\n`;
}

/**
 * Generate the index.ts file that re-exports all chapters (split format)
 */
export function generateChapterIndexTS(
  storySlug: string,
  level: number,
  hasChapters: boolean,
  chapterCount: number
): string {
  const imports: string[] = [];
  const exports: string[] = [];

  for (let i = 1; i <= chapterCount; i++) {
    imports.push(`import { chapterContent as ch${i} } from "./ch${i}";`);
    exports.push(`  ${i}: { pages: ch${i}.pages },`);
  }

  return `// Auto-generated index file for split chapter format
${imports.join("\n")}

export const levelContent = {
  storySlug: "${storySlug}",
  level: ${level},
  hasChapters: ${hasChapters},
  chapters: {
${exports.join("\n")}
  },
};

export default levelContent;

// Export chapter count for lazy loading
export const chapterCount = ${chapterCount};

// Export function to dynamically load a single chapter
export async function loadChapter(chapterNum: number) {
  const module = await import(\`./ch\${chapterNum}\`);
  return module.chapterContent;
}
`;
}

/**
 * Generate the entry to add to STORY_METADATA array
 */
export function generateMetadataEntry(metadata: StoryMetadataInput): string {
  // Output CEFR codes directly (e.g., "A1", "A2", "B1")
  const levelsArray = metadata.levels.map((l) => `"${l}"`).join(", ");
  const tagsArray = metadata.tags && metadata.tags.length > 0
    ? metadata.tags.map((t) => `"${t}"`).join(", ")
    : null;

  // Build origin string using the new format
  let originStr: string;
  if (metadata.origin.isOriginal) {
    originStr = `{ isOriginal: true }`;
  } else {
    const attrString = serializeAttribution(metadata.origin.attribution);
    originStr = `{ isOriginal: false, attribution: ${attrString} }`;
  }

  let entry = `  {
    slug: "${metadata.slug}",
    image: "${metadata.image || "/images/placeholder1.png"}",
    levels: [${levelsArray}],${metadata.isPremiumOnly ? `\n    isPremiumOnly: true,` : ""}
    type: "${metadata.storyType}",
    origin: ${originStr},`;

  if (tagsArray) {
    entry += `\n    tags: [${tagsArray}],`;
  }

  if (metadata.targetAudience) {
    entry += `\n    targetAudience: "${metadata.targetAudience}",`;
  }

  // Content structure type for navigation labels (Collection/Poem vs Chapter/Page)
  if (metadata.structureType && metadata.structureType !== "prose") {
    entry += `\n    structureType: "${metadata.structureType}",`;
  }

  // Original level - the CEFR level of the unmodified source text
  if (metadata.originalLevel) {
    entry += `\n    originalLevel: "${metadata.originalLevel}",`;
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
