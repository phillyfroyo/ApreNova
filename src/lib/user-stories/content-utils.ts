// src/lib/user-stories/content-utils.ts
// Utilities for extracting raw text from user story content JSON

import type {
  LevelContent,
  StoryLine,
  PageContent,
} from "@/lib/story-processing/text-processing";
import { hasStanzas, flattenStanzas } from "@/lib/story-processing/text-processing";

/**
 * Extract source and translated text from a LevelContent JSON blob.
 *
 * Walks chapters → pages → lines (or stanzas for poetry), pulling the
 * source-language and target-language strings from each StoryLine.
 * Returns two plain-text strings with `--- Chapter N ---` dividers.
 */
export function extractTextFromContent(
  content: LevelContent,
  sourceLanguage: "en" | "es"
): { sourceText: string; translatedText: string } {
  const targetLanguage = sourceLanguage === "en" ? "es" : "en";
  const sourceLines: string[] = [];
  const translatedLines: string[] = [];

  // Sort chapter keys numerically
  const chapterKeys = Object.keys(content.chapters)
    .map(Number)
    .sort((a, b) => a - b);

  for (const chapterNum of chapterKeys) {
    const chapter = content.chapters[chapterNum];
    if (!chapter) continue;

    // Add chapter divider
    const title = chapter.metadata?.title;
    const divider = title
      ? `--- Chapter ${chapterNum}: ${title} ---`
      : `--- Chapter ${chapterNum} ---`;
    sourceLines.push(divider);
    translatedLines.push(divider);

    // Sort page keys numerically
    const pageKeys = Object.keys(chapter.pages)
      .map(Number)
      .sort((a, b) => a - b);

    for (const pageNum of pageKeys) {
      const page: PageContent = chapter.pages[pageNum];
      if (!page) continue;

      // Get lines — flatten stanzas for poetry
      const lines: StoryLine[] = hasStanzas(page)
        ? flattenStanzas(page.stanzas!)
        : page.lines || [];

      for (const line of lines) {
        sourceLines.push(line[sourceLanguage] ?? "");
        translatedLines.push(line[targetLanguage] ?? "");
      }
    }
  }

  // Join with \n\n to restore paragraph spacing that was lost when blank lines
  // were filtered during content building. This matches the admin portal's raw
  // text format where paragraphs are separated by blank lines.
  const sourceText = sourceLines.join("\n\n");
  const translatedText = translatedLines.join("\n\n");

  console.log(`[extractTextFromContent] sourceLines: ${sourceLines.length}, joined length: ${sourceText.length}`);
  console.log(`[extractTextFromContent] First 6 lines after split:`)
  sourceText.split('\n').slice(0, 6).forEach((l, i) => console.log(`  ${i}: ${l ? `"${l.slice(0, 60)}"` : '(blank)'}`));

  return { sourceText, translatedText };
}
