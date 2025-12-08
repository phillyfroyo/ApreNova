// src/app/api/admin/save-story/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

/**
 * Generate a random 4-digit number for unique filenames
 */
function generateRandomSuffix(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}
import {
  generateContentFileTS,
  generateChapterFileTS,
  generateChapterIndexTS,
  generateMetadataEntry,
  generateUITranslationEntry,
  buildContentStructure,
  parseChapters,
  paginateLines,
  type StoryMetadataInput,
  type StoryChapter,
} from "@/lib/admin/story-generator";
import { writeAllStoryFiles, writeChapterFile, writeChapterIndexFile } from "@/lib/admin/file-writer";
import type { StoryType, StoryTag, StoryOrigin } from "@/types/story";

// Threshold for using split chapter format (3+ chapters = split)
const SPLIT_CHAPTER_THRESHOLD = 3;

/**
 * Clean text by removing AI artifacts, markdown formatting, and normalizing
 */
function cleanText(text: string): string {
  let cleaned = text
    // Remove code fences
    .replace(/^```[\w]*\n?/gm, "")
    .replace(/\n?```$/gm, "")
    .replace(/```/g, "")
    // Remove triple quotes that AI sometimes adds
    .replace(/^"""\n?/gm, "")
    .replace(/\n?"""$/gm, "")
    .replace(/"""/g, "")
    .replace(/^'''\n?/gm, "")
    .replace(/\n?'''$/gm, "")
    .replace(/'''/g, "")
    // Remove markdown bold/italic
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    // Remove markdown headers
    .replace(/^#{1,6}\s+/gm, "")
    // Normalize whitespace
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");

  // Process line by line to remove quote wrapping and empty quote lines
  cleaned = cleaned
    .split("\n")
    .map(line => {
      let l = line.trim();
      // Remove surrounding quotes
      if ((l.startsWith('"') && l.endsWith('"')) ||
          (l.startsWith('"') && l.endsWith('"')) ||
          (l.startsWith("'") && l.endsWith("'")) ||
          (l.startsWith("'") && l.endsWith("'"))) {
        l = l.slice(1, -1);
      }
      return l;
    })
    // Filter out lines that are only quotes or empty
    .filter(line => {
      const trimmed = line.trim();
      // Remove lines that are just quotes
      if (/^["'"'""'']+$/.test(trimmed)) return false;
      // Keep non-empty lines
      return trimmed.length > 0;
    })
    .join("\n");

  return cleaned.trim();
}

interface LevelContent {
  level: number;
  en: string; // Full text, newline separated
  es: string; // Full text, newline separated
}

interface SaveStoryRequest {
  slug: string;
  title: { en: string; es: string };
  description: { en: string; es: string };
  levels: LevelContent[];
  linesPerPage?: number;
  thumbnailBase64?: string; // Base64 encoded image data
  backgroundBase64?: string; // Base64 encoded background image
  // Tagging fields
  storyType: StoryType;
  origin: StoryOrigin;
  tags?: StoryTag[];
  targetAudience?: "children" | "teen" | "adult" | "all";
}

export async function POST(req: NextRequest) {
  try {
    const body: SaveStoryRequest = await req.json();
    const {
      slug,
      title,
      description,
      levels,
      linesPerPage = 10,
      thumbnailBase64,
      backgroundBase64,
      storyType,
      origin,
      tags,
      targetAudience,
    } = body;

    if (!slug || !title || !description || !levels || levels.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: slug, title, description, levels" },
        { status: 400 }
      );
    }

    // Generate content files for each level
    // Type supports both single-file and split-chapter formats
    const levelFiles: Array<{
      level: number;
      content: string;
      splitFormat?: boolean;
      chapters?: Record<number, { pages: Record<number, { lines: Array<{ en: string; es: string }> }> }>;
      chapterCount?: number;
      hasChapters?: boolean;
    }> = [];
    const warnings: string[] = [];
    const imageErrors: string[] = [];

    for (const levelData of levels) {
      // Clean the text before parsing
      const cleanedEn = cleanText(levelData.en);
      const cleanedEs = cleanText(levelData.es);

      // Parse chapters from the cleaned text
      const enChapters = parseChapters(cleanedEn);
      const esChapters = parseChapters(cleanedEs);

      // Validate line counts match
      const enLineCount = cleanedEn.split("\n").filter(l => l.trim()).length;
      const esLineCount = cleanedEs.split("\n").filter(l => l.trim()).length;
      if (enLineCount !== esLineCount) {
        warnings.push(`Level ${levelData.level}: EN has ${enLineCount} lines, ES has ${esLineCount} lines. Lines may be misaligned.`);
      }

      // Build the content structure
      const contentStructure = buildContentStructure(
        slug,
        levelData.level,
        {
          en: enChapters.map(ch => {
            // Custom pagination with provided linesPerPage
            const pages = paginateLines(ch, linesPerPage);
            return pages.flat();
          }),
          es: esChapters.map(ch => {
            const pages = paginateLines(ch, linesPerPage);
            return pages.flat();
          }),
        }
      );

      // Actually, let's rebuild this properly - we want to paginate within the structure
      const hasChapters = enChapters.length > 1 || esChapters.length > 1;
      const chapters: Record<number, { pages: Record<number, { lines: Array<{ en: string; es: string }> }> }> = {};

      // Use the max of both to handle potential mismatches
      const maxChapters = Math.max(enChapters.length, esChapters.length);

      for (let chIdx = 0; chIdx < maxChapters; chIdx++) {
        // Safely get chapter content, defaulting to empty array if missing
        const enChapter = enChapters[chIdx] || [];
        const esChapter = esChapters[chIdx] || [];

        const enPages = paginateLines(enChapter, linesPerPage);
        const esPages = paginateLines(esChapter, linesPerPage);
        const pages: Record<number, { lines: Array<{ en: string; es: string }> }> = {};

        const maxPages = Math.max(enPages.length, esPages.length);

        for (let pIdx = 0; pIdx < maxPages; pIdx++) {
          const enLines = enPages[pIdx] || [];
          const esLines = esPages[pIdx] || [];
          const maxLines = Math.max(enLines.length, esLines.length);

          const lines: Array<{ en: string; es: string }> = [];
          for (let lIdx = 0; lIdx < maxLines; lIdx++) {
            lines.push({
              en: enLines[lIdx] || "",
              es: esLines[lIdx] || "",
            });
          }

          pages[pIdx + 1] = { lines };
        }

        chapters[chIdx + 1] = { pages };
      }

      const finalContent = {
        storySlug: slug,
        level: levelData.level,
        hasChapters,
        chapters,
      };

      // Determine whether to use split format based on chapter count
      const useSplitFormat = maxChapters >= SPLIT_CHAPTER_THRESHOLD;

      if (useSplitFormat) {
        // Split format: generate individual chapter files + index
        levelFiles.push({
          level: levelData.level,
          content: "", // Will be handled separately
          splitFormat: true,
          chapters: finalContent.chapters,
          chapterCount: maxChapters,
          hasChapters,
        });
      } else {
        // Single file format
        const tsContent = generateContentFileTS(finalContent);
        levelFiles.push({ level: levelData.level, content: tsContent, splitFormat: false });
      }
    }

    // Save thumbnail FIRST to get the correct image path for metadata
    let thumbnailSaved = false;
    let thumbnailImagePath: string | null = null;
    if (thumbnailBase64) {
      try {
        const base64Data = thumbnailBase64.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, "base64");
        const mimeMatch = thumbnailBase64.match(/^data:image\/(\w+);base64,/);
        const extension = mimeMatch?.[1] || "png";

        // Add random suffix to avoid cache issues with same-named files
        const randomSuffix = generateRandomSuffix();
        const filename = `${slug}-thumbnail-${randomSuffix}.${extension}`;
        thumbnailImagePath = `/images/${filename}`;

        const thumbnailPath = path.join(process.cwd(), `public/images/${filename}`);
        await fs.writeFile(thumbnailPath, imageBuffer);
        thumbnailSaved = true;
      } catch (thumbError) {
        console.error("Failed to save thumbnail:", thumbError);
        imageErrors.push("Failed to save thumbnail image");
      }
    }

    // Save background image
    let backgroundSaved = false;
    let backgroundImagePath: string | null = null;
    if (backgroundBase64) {
      try {
        const base64Data = backgroundBase64.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, "base64");
        const mimeMatch = backgroundBase64.match(/^data:image\/(\w+);base64,/);
        const extension = mimeMatch?.[1] || "png";

        // Add random suffix to avoid cache issues
        const randomSuffix = generateRandomSuffix();
        const filename = `${slug}-background-${randomSuffix}.${extension}`;
        backgroundImagePath = `/images/${filename}`;

        const backgroundPath = path.join(process.cwd(), `public${backgroundImagePath}`);
        await fs.writeFile(backgroundPath, imageBuffer);
        backgroundSaved = true;
      } catch (bgError) {
        console.error("Failed to save background:", bgError);
        imageErrors.push("Failed to save background image");
      }
    }

    // Generate metadata entries with the correct image path
    const metadata: StoryMetadataInput = {
      slug,
      title,
      description,
      image: thumbnailImagePath || undefined, // Use the saved thumbnail path
      levels: levels.map((l) => l.level),
      isPremiumOnly: false,
      storyType: storyType || "short-story",
      origin: origin || { isOriginal: true },
      tags: tags || [],
      targetAudience: targetAudience || "all",
    };

    const metadataEntry = generateMetadataEntry(metadata);
    const uiEnEntry = generateUITranslationEntry("en", metadata);
    const uiEsEntry = generateUITranslationEntry("es", metadata);

    // Separate split-format and single-file format levels
    const splitFormatLevels = levelFiles.filter(l => l.splitFormat);
    const singleFileLevels = levelFiles.filter(l => !l.splitFormat);

    // Write split-format chapter files
    const splitFileResults: Array<{ success: boolean; path: string; error?: string }> = [];
    for (const levelData of splitFormatLevels) {
      if (!levelData.chapters || !levelData.chapterCount) continue;

      // Write individual chapter files
      for (let chNum = 1; chNum <= levelData.chapterCount; chNum++) {
        const chapter = levelData.chapters[chNum];
        if (!chapter) continue;

        const chapterContent = generateChapterFileTS(
          slug,
          levelData.level,
          chNum,
          { pages: chapter.pages } as StoryChapter
        );
        const chResult = await writeChapterFile(slug, levelData.level, chNum, chapterContent);
        splitFileResults.push(chResult);
      }

      // Write index file for this level
      const indexContent = generateChapterIndexTS(
        slug,
        levelData.level,
        levelData.hasChapters || false,
        levelData.chapterCount
      );
      const indexResult = await writeChapterIndexFile(slug, levelData.level, indexContent);
      splitFileResults.push(indexResult);
    }

    // Write single-file format levels and metadata
    const result = await writeAllStoryFiles({
      storySlug: slug,
      levels: singleFileLevels.map(l => ({ level: l.level, content: l.content })),
      metadataEntry,
      uiEnEntry,
      uiEsEntry,
    });

    // Add split file results to the overall result
    result.contentFiles.push(...splitFileResults);
    for (const sfr of splitFileResults) {
      if (!sfr.success && sfr.error) {
        result.errors.push(`Failed to write ${sfr.path}: ${sfr.error}`);
      }
    }

    // Merge image errors
    result.errors.push(...imageErrors);

    // Add or update theme entry in storyThemes.ts
    try {
      const themesPath = path.join(process.cwd(), "src/components/storyThemes.ts");
      const themesContent = await fs.readFile(themesPath, "utf-8");

      // Check if theme entry already exists
      const themeEntryRegex = new RegExp(`"${slug}":\\s*\\{[^}]*\\},?`, "s");
      const hasExistingTheme = themeEntryRegex.test(themesContent);

      // Build theme entry
      const themeEntry = backgroundImagePath
        ? `"${slug}": {
    backgroundImage: "${backgroundImagePath}",
    textColor: "text-gray-900",
    accentColor: "bg-green-600",
    hoverAccentColor: "hover:bg-green-300",
    fontFamily: "font-sans",
  },`
        : `"${slug}": {
    backgroundColor: "#f5f0e6",
    textColor: "text-gray-900",
    accentColor: "bg-green-600",
    hoverAccentColor: "hover:bg-green-300",
    fontFamily: "font-sans",
  },`;

      let updatedThemesContent: string;

      if (hasExistingTheme) {
        // Update existing entry
        updatedThemesContent = themesContent.replace(themeEntryRegex, themeEntry);
      } else {
        // Find STORY_THEMES object and insert before its closing };
        // The structure is: export const STORY_THEMES = { ... }; followed by DEFAULT_THEME
        const storyThemesStart = themesContent.indexOf('STORY_THEMES');
        const defaultThemeStart = themesContent.indexOf('DEFAULT_THEME');

        if (storyThemesStart === -1) {
          console.error("[save-story] Could not find STORY_THEMES in storyThemes.ts");
          throw new Error("Could not find STORY_THEMES in storyThemes.ts");
        }

        // Find the closing }; of STORY_THEMES (before DEFAULT_THEME or end of relevant section)
        const searchEnd = defaultThemeStart > -1 ? defaultThemeStart : themesContent.length;
        const storyThemesSection = themesContent.slice(storyThemesStart, searchEnd);

        // Find the last }; in the STORY_THEMES section
        const lastClosingBrace = storyThemesSection.lastIndexOf('};');
        if (lastClosingBrace === -1) {
          console.error("[save-story] Could not find closing }; for STORY_THEMES");
          throw new Error("Could not find closing brace for STORY_THEMES");
        }

        // Calculate absolute position and insert before the };
        const insertPos = storyThemesStart + lastClosingBrace;

        // Check if there's already a comma before the };
        const beforeClosing = themesContent.slice(insertPos - 10, insertPos).trim();
        const needsComma = !beforeClosing.endsWith(',');

        updatedThemesContent =
          themesContent.slice(0, insertPos) +
          (needsComma ? ',\n' : '\n') +
          `  ${themeEntry}\n` +
          themesContent.slice(insertPos);
      }

      await fs.writeFile(themesPath, updatedThemesContent);
      console.log(`[save-story] Theme entry added for "${slug}"`);
    } catch (themeError) {
      console.error("Failed to update storyThemes.ts:", themeError);
      result.errors.push("Failed to update story theme");
    }

    if (result.errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          errors: result.errors,
          filesWritten: result.contentFiles.filter((f) => f.success).map((f) => f.path),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      filesWritten: result.contentFiles.map((f) => f.path),
      metadataUpdated: result.metadataUpdated,
      uiUpdated: { en: result.uiEnUpdated, es: result.uiEsUpdated },
      thumbnailSaved,
      backgroundSaved,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    console.error("Save story error:", error);
    return NextResponse.json(
      { error: "Failed to save story", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
