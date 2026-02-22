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

  // Join with \n — blank StoryLines ("") naturally produce \n\n (blank line)
  // in the output, preserving paragraph spacing.
  const sourceText = sourceLines.join("\n");
  const translatedText = translatedLines.join("\n");

  console.log(`[extractTextFromContent] sourceLines: ${sourceLines.length}, joined length: ${sourceText.length}`);
  console.log(`[extractTextFromContent] First 6 lines after split:`)
  sourceText.split('\n').slice(0, 6).forEach((l, i) => console.log(`  ${i}: ${l ? `"${l.slice(0, 60)}"` : '(blank)'}`));

  return { sourceText, translatedText };
}

/**
 * Apply edited source/translated text back into a LevelContent JSON blob.
 *
 * This is the inverse of extractTextFromContent(). It parses the edited text
 * strings (which have `--- Chapter N ---` dividers and blank-line paragraph
 * spacing), then walks the existing content structure and updates the es/en
 * fields on each StoryLine in-place.
 *
 * Returns a deep-cloned copy of content with updated text.
 */
export function applyTextToContent(
  content: LevelContent,
  sourceLanguage: "en" | "es",
  editedSourceText: string | undefined,
  editedTranslatedText: string | undefined,
): LevelContent {
  const targetLanguage = sourceLanguage === "en" ? "es" : "en";
  const chapterPattern = /^---\s*(?:Chapter|Capítulo)\s+\d+(?::\s*.+?)?\s*---$/i;

  // Split edited text into per-chapter arrays of raw modal lines.
  // The modal shows text produced by extractTextFromContent which joins with
  // "\n\n", so each StoryLine is separated by a blank line in the modal.
  // We DON'T filter blanks here — we pass raw lines through and let the
  // write loop pick every-other-line (skipping separators).
  function parseChapterRawLines(text: string): Map<number, string[]> {
    const allLines = text.split("\n");
    const chapters = new Map<number, string[]>();
    let currentChapterIdx = -1;
    let currentLines: string[] = [];

    const chapterKeys = Object.keys(content.chapters)
      .map(Number)
      .sort((a, b) => a - b);

    for (const line of allLines) {
      if (chapterPattern.test(line)) {
        if (currentChapterIdx >= 0 && currentChapterIdx < chapterKeys.length) {
          chapters.set(chapterKeys[currentChapterIdx], currentLines);
        }
        currentChapterIdx++;
        currentLines = [];
      } else {
        currentLines.push(line);
      }
    }

    if (currentChapterIdx >= 0 && currentChapterIdx < chapterKeys.length) {
      chapters.set(chapterKeys[currentChapterIdx], currentLines);
    }

    if (currentChapterIdx === -1 && chapterKeys.length > 0) {
      chapters.set(chapterKeys[0], allLines);
    }

    return chapters;
  }

  // With join("\n"), each raw line directly corresponds to a StoryLine
  // (including blank lines = paragraph breaks). Just strip the leading blank
  // from the chapter divider's trailing \n and take expectedCount lines.
  function extractContentFromRaw(rawLines: string[], expectedCount: number): string[] {
    let i = 0;
    // Strip leading blank from chapter divider's trailing \n
    if (i < rawLines.length && rawLines[i].trim() === "") {
      i++;
    }
    return rawLines.slice(i, i + expectedCount);
  }

  // Deep clone
  const updated: LevelContent = JSON.parse(JSON.stringify(content));

  const sourceRaw = editedSourceText !== undefined ? parseChapterRawLines(editedSourceText) : null;
  const translatedRaw = editedTranslatedText !== undefined ? parseChapterRawLines(editedTranslatedText) : null;

  const chapterKeys = Object.keys(updated.chapters)
    .map(Number)
    .sort((a, b) => a - b);

  for (const chapterNum of chapterKeys) {
    const chapter = updated.chapters[chapterNum];
    if (!chapter) continue;

    // Count StoryLines in this chapter
    let storyLineCount = 0;
    const pageKeys = Object.keys(chapter.pages).map(Number).sort((a, b) => a - b);
    for (const pageNum of pageKeys) {
      const page: PageContent = chapter.pages[pageNum];
      if (!page) continue;
      if (hasStanzas(page) && page.stanzas) {
        for (const stanza of page.stanzas) storyLineCount += stanza.length;
      } else if (page.lines) {
        storyLineCount += page.lines.length;
      }
    }

    // Extract content lines from raw modal lines, using expected count
    const srcLines = sourceRaw
      ? extractContentFromRaw(sourceRaw.get(chapterNum) || [], storyLineCount)
      : [];
    const tgtLines = translatedRaw
      ? extractContentFromRaw(translatedRaw.get(chapterNum) || [], storyLineCount)
      : [];

    // Write back into content structure
    let srcIdx = 0;
    let tgtIdx = 0;

    for (const pageNum of pageKeys) {
      const page: PageContent = chapter.pages[pageNum];
      if (!page) continue;

      if (hasStanzas(page) && page.stanzas) {
        for (const stanza of page.stanzas) {
          for (const line of stanza) {
            if (sourceRaw) {
              line[sourceLanguage] = srcIdx < srcLines.length ? srcLines[srcIdx] : "";
            }
            if (translatedRaw) {
              line[targetLanguage] = tgtIdx < tgtLines.length ? tgtLines[tgtIdx] : "";
            }
            srcIdx++;
            tgtIdx++;
          }
        }
      } else if (page.lines) {
        for (const line of page.lines) {
          if (sourceRaw) {
            line[sourceLanguage] = srcIdx < srcLines.length ? srcLines[srcIdx] : "";
          }
          if (translatedRaw) {
            line[targetLanguage] = tgtIdx < tgtLines.length ? tgtLines[tgtIdx] : "";
          }
          srcIdx++;
          tgtIdx++;
        }
      }
    }
  }

  return updated;
}
