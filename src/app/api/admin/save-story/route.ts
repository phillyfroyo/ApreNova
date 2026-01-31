// src/app/api/admin/save-story/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import {
  generateContentFileTS,
  generateChapterFileTS,
  generateChapterIndexTS,
  generateMetadataEntry,
  generateUITranslationEntry,
  parseChapters,
  buildContentStructure,
  type StoryMetadataInput,
  type StoryChapter,
} from "@/lib/admin/story-generator";
import { writeAllStoryFiles, writeChapterFile, writeChapterIndexFile } from "@/lib/admin/file-writer";
import { cleanText } from "@/lib/admin/text-utils";
import { detectStanzas } from "@/lib/admin/text-preprocessor";
import { SPLIT_CHAPTER_THRESHOLD } from "@/app/admin/upload-story/config/constants";
import type { StoryType, StoryTag, StoryOrigin, ContentStructureType } from "@/types/story";
import {
  paginateAnthologyPoems,
  detectPoemBoundaries,
  buildContentStructureWithMetadata,
  type StoryLine as SharedStoryLine,
  type ProcessedChapterDataWithMetadata,
} from "@/lib/story-processing/text-processing";
import { toCEFR, type CEFRCode } from "@/lib/cefr";

/**
 * Generate a random 4-digit number for unique filenames
 */
function generateRandomSuffix(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
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
  // Structure type for anthology-aware pagination
  structureType?: ContentStructureType;
  // Original level - the CEFR level of the unmodified source text
  originalLevel?: string;
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
      structureType,
      originalLevel,
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
      // Preserve whitespace for anthology/epic content (stanza breaks matter)
      const preserveWhitespace = structureType === "anthology" || structureType === "epic";
      const cleanedEn = cleanText(levelData.en, { preserveWhitespace });
      const cleanedEs = cleanText(levelData.es, { preserveWhitespace });

      // Validate line counts match
      const enLineCount = cleanedEn.split("\n").filter(l => l.trim()).length;
      const esLineCount = cleanedEs.split("\n").filter(l => l.trim()).length;
      if (enLineCount !== esLineCount) {
        warnings.push(`Level ${levelData.level}: EN has ${enLineCount} lines, ES has ${esLineCount} lines. Lines may be misaligned.`);
      }

      // ========== ANTHOLOGY PIPELINE ==========
      // Two-level structure: Sections (collections) contain Poems (pages)
      if (structureType === "anthology") {
        const enLines = cleanedEn.split("\n");
        const esLines = cleanedEs.split("\n");

        // First: Detect section/collection boundaries (e.g., "I. LIFE.", "II. LOVE.")
        const { detectSectionBoundaries } = await import("@/lib/story-processing/text-processing");
        const sections = detectSectionBoundaries(enLines);
        console.log(`[save-story] Anthology Level ${levelData.level}: Detected ${sections.length} sections/collections`);

        // Build chapter data for each section
        const chapterData: ProcessedChapterDataWithMetadata[] = sections.map((section, sectionIdx) => {
          // Get section lines from both languages
          const sectionEnLines = section.lines;
          const sectionEsLines = esLines.slice(section.startLine, section.endLine);

          // Within this section, detect individual poems
          const poemsInSection = detectPoemBoundaries(sectionEnLines);
          console.log(`[save-story] Section "${section.number}. ${section.title}": ${poemsInSection.length} poems`);

          // Combine all lines from poems in this section (preserving poem structure for pagination)
          const sourceLines: string[] = [];
          const translatedLines: string[] = [];
          const lineMetadata = new Map<number, { stanzaNumber?: number; isStanzaBreak?: boolean }>();

          // Process each poem in this section
          for (const poem of poemsInSection) {
            const poemSourceLines = sectionEnLines.slice(poem.startLine, poem.endLine);
            const poemTranslatedLines = sectionEsLines.slice(poem.startLine, poem.endLine);

            // Detect stanzas within this poem
            const stanzaMarked = detectStanzas(poemSourceLines);
            const translatedStanzaMarked = detectStanzas(poemTranslatedLines);

            // Add lines with metadata
            stanzaMarked.forEach((markedLine, lineIdx) => {
              const globalIdx = sourceLines.length;
              lineMetadata.set(globalIdx, {
                stanzaNumber: markedLine.stanzaNumber,
                isStanzaBreak: markedLine.isStanzaBreak,
              });
              sourceLines.push(markedLine.text);
            });

            translatedStanzaMarked.forEach((markedLine) => {
              translatedLines.push(markedLine.text);
            });
          }

          return {
            sourceLines,
            translatedLines,
            lineMetadata,
            metadata: {
              number: sectionIdx + 1,
              title: `${section.number}. ${section.title}`,
            },
          };
        });

        // Use shared buildContentStructureWithMetadata for proper anthology pagination
        const content = buildContentStructureWithMetadata(
          slug,
          levelData.level,
          sections.length > 1, // hasChapters (sections)
          chapterData,
          "en", // sourceLanguage
          { structureType: "anthology" }
        );

        const maxChapters = Object.keys(content.chapters).length;
        const useSplitFormat = maxChapters >= SPLIT_CHAPTER_THRESHOLD;

        if (useSplitFormat) {
          levelFiles.push({
            level: levelData.level,
            content: "",
            splitFormat: true,
            // Cast chapters to expected format - structure is compatible at runtime
            chapters: content.chapters as Record<number, { pages: Record<number, { lines: Array<{ en: string; es: string }> }> }>,
            chapterCount: maxChapters,
            hasChapters: content.hasChapters,
          });
        } else {
          // Cast content to GeneratedStoryContent format for TS file generation
          const tsContent = generateContentFileTS(content as unknown as import("@/lib/admin/story-generator").GeneratedStoryContent);
          levelFiles.push({ level: levelData.level, content: tsContent, splitFormat: false });
        }
        continue; // Skip prose pipeline
      }

      // ========== PROSE PIPELINE (default) ==========
      // Parse chapters from the cleaned text
      const enChapters = parseChapters(cleanedEn);
      const esChapters = parseChapters(cleanedEs);

      // Use shared buildContentStructure for prose content
      const finalContent = buildContentStructure(
        slug,
        levelData.level,
        { en: enChapters, es: esChapters }
      );

      const maxChapters = Object.keys(finalContent.chapters).length;

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
          hasChapters: finalContent.hasChapters,
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
    // Convert level codes to CEFR format (e.g., "l2" -> "A2", "l5" -> "C1")
    const cefrLevels = levels.map((l) => toCEFR(l.level));

    const metadata: StoryMetadataInput = {
      slug,
      title,
      description,
      image: thumbnailImagePath || undefined, // Use the saved thumbnail path
      levels: cefrLevels,
      isPremiumOnly: false,
      storyType: storyType || "short-story",
      origin: origin || { isOriginal: true },
      tags: tags || [],
      targetAudience: targetAudience || "all",
      // Content structure type for navigation labels (Collection/Poem vs Chapter/Page)
      structureType: structureType && structureType !== "prose" ? structureType : undefined,
      // Original level - convert to CEFR if provided
      originalLevel: originalLevel ? toCEFR(originalLevel) : undefined,
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
        levelData.chapterCount,
        structureType  // Pass structureType for anthology/epic navigation labels
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
