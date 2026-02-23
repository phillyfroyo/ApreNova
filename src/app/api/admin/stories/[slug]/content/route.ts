// src/app/api/admin/stories/[slug]/content/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import type { LevelContent } from "@/lib/story-processing/text-processing";
import {
  extractTextFromContent,
  applyTextToContent,
  extractChapterAlignmentMap,
  redetectAlignmentForContent,
} from "@/lib/user-stories/content-utils";
import { toFolderName } from "@/lib/cefr";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

interface AdminContentResult {
  content: LevelContent;
  /** For split-chapter: raw parsed data per chapter file, keyed by chapter number */
  chapterFileData?: Record<number, any>;
  isSplitChapter: boolean;
}

/**
 * Load admin story content from TypeScript source files on disk.
 *
 * Handles two formats:
 * - Split-chapter: index.ts + ch1.ts, ch2.ts, ... (JSON-formatted values)
 * - Single-file: content.ts (JS object literals with unquoted keys)
 */
async function loadAdminContent(
  slug: string,
  level: string
): Promise<AdminContentResult> {
  // Convert CEFR levels (A1, A2, B1...) to folder names (l1, l2, l3...)
  const folderLevel = toFolderName(level);
  const levelDir = path.join(process.cwd(), `src/content/${slug}/${folderLevel}`);

  // Check for split-chapter format (index.ts exists)
  const indexPath = path.join(levelDir, "index.ts");
  let hasSplitChapter = false;
  try {
    await fs.access(indexPath);
    hasSplitChapter = true;
  } catch {
    // not split-chapter
  }

  if (hasSplitChapter) {
    return loadSplitChapterContent(levelDir, slug, level);
  } else {
    return loadSingleFileContent(levelDir, slug, level);
  }
}

/**
 * Split-chapter format: index.ts + ch1.ts, ch2.ts, ...
 * Each chN.ts exports `chapterContent = { ... }` as JSON-formatted values.
 */
async function loadSplitChapterContent(
  levelDir: string,
  slug: string,
  level: string
): Promise<AdminContentResult> {
  // Discover chapter files
  const files = await fs.readdir(levelDir);
  const chapterFiles = files
    .filter((f) => /^ch\d+\.ts$/.test(f))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)![0], 10);
      const numB = parseInt(b.match(/\d+/)![0], 10);
      return numA - numB;
    });

  const chapters: Record<number, any> = {};
  const chapterFileData: Record<number, any> = {};

  for (const file of chapterFiles) {
    const chapterNum = parseInt(file.match(/\d+/)![0], 10);
    const filePath = path.join(levelDir, file);
    const raw = await fs.readFile(filePath, "utf-8");

    // Strip `export const chapterContent = ` prefix and trailing `;`
    const stripped = raw
      .replace(/^export\s+const\s+chapterContent\s*=\s*/, "")
      .replace(/;\s*$/, "")
      .trim();

    const parsed = JSON.parse(stripped);
    chapterFileData[chapterNum] = parsed;
    chapters[chapterNum] = { pages: parsed.pages };
  }

  // Read index.ts to get metadata (hasChapters, storySlug, level)
  const indexRaw = await fs.readFile(path.join(levelDir, "index.ts"), "utf-8");
  const hasChaptersMatch = indexRaw.match(/hasChapters:\s*(true|false)/);
  const hasChapters = hasChaptersMatch ? hasChaptersMatch[1] === "true" : true;

  const content: LevelContent = {
    storySlug: slug,
    level: parseInt(level.replace(/\D/g, ""), 10),
    hasChapters,
    chapters,
  } as any;

  return { content, chapterFileData, isSplitChapter: true };
}

/**
 * Single-file format: content.ts
 * Exports `levelContent = { ... }` with JS object literal syntax (unquoted keys).
 */
async function loadSingleFileContent(
  levelDir: string,
  _slug: string,
  _level: string
): Promise<AdminContentResult> {
  const contentPath = path.join(levelDir, "content.ts");
  const raw = await fs.readFile(contentPath, "utf-8");

  // Strip `export const levelContent = ` prefix and trailing `;`
  const stripped = raw
    .replace(/^export\s+const\s+levelContent\s*=\s*/, "")
    .replace(/;\s*$/, "")
    .trim();

  // Use Function constructor to eval JS object literal (unquoted keys prevent JSON.parse)
  const parsed = new Function("return (" + stripped + ")")();

  const content: LevelContent = parsed;

  return { content, isSplitChapter: false };
}

/**
 * Write content back to split-chapter TS files.
 * Merges updated pages back into the original chapter file data to preserve
 * extra fields (storySlug, level, chapter).
 * Only writes files whose content actually changed to avoid unnecessary
 * bundler hot-reload churn.
 */
async function writeSplitChapterContent(
  levelDir: string,
  content: LevelContent,
  chapterFileData: Record<number, any>
): Promise<void> {
  const chapterKeys = Object.keys(content.chapters)
    .map(Number)
    .sort((a, b) => a - b);

  for (const chapterNum of chapterKeys) {
    const chapter = content.chapters[chapterNum];
    if (!chapter) continue;

    // Merge updated pages into original chapter data
    const originalData = chapterFileData[chapterNum] || {};
    const merged = { ...originalData, pages: chapter.pages };

    const filePath = path.join(levelDir, `ch${chapterNum}.ts`);
    const newContent = `export const chapterContent = ${JSON.stringify(merged, null, 2)};\n`;

    // Only write if content actually changed
    try {
      const existing = await fs.readFile(filePath, "utf-8");
      if (existing === newContent) continue;
    } catch {
      // File doesn't exist yet, write it
    }

    await fs.writeFile(filePath, newContent, "utf-8");
  }
}

/**
 * Write content back to single-file content.ts.
 */
async function writeSingleFileContent(
  levelDir: string,
  content: LevelContent
): Promise<void> {
  const filePath = path.join(levelDir, "content.ts");
  const newContent = `export const levelContent = ${JSON.stringify(content, null, 2)};\n`;

  // Only write if content actually changed
  try {
    const existing = await fs.readFile(filePath, "utf-8");
    if (existing === newContent) return;
  } catch {
    // File doesn't exist yet, write it
  }

  await fs.writeFile(filePath, newContent, "utf-8");
}

// GET - Fetch story content for a specific level
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const level = searchParams.get("level");

    if (!level) {
      return NextResponse.json(
        { error: "Level parameter is required" },
        { status: 400 }
      );
    }

    try {
      const { content } = await loadAdminContent(slug, level);
      const format = searchParams.get("format");
      const sourceLanguage = (searchParams.get("sourceLanguage") || "en") as "en" | "es";

      if (format === "raw") {
        const { sourceText, translatedText } = extractTextFromContent(content, sourceLanguage);

        // Run alignment detection on-the-fly
        if (content.hasAlignmentIssues === undefined) {
          redetectAlignmentForContent(content, sourceLanguage);
        }

        return NextResponse.json({
          sourceText,
          translatedText,
          sourceLanguage,
          hasAlignmentIssues: content.hasAlignmentIssues || false,
          chapterAlignmentIssues: extractChapterAlignmentMap(content),
        });
      }

      // Default: return chapters JSON (backward compat)
      return NextResponse.json({
        slug,
        level,
        chapters: content.chapters,
      });
    } catch (readError) {
      return NextResponse.json(
        { error: `Content not found for ${slug}/${level}` },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("Fetch story content error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch story content",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// PATCH - Save edited source/translated text for a specific level
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const body = await req.json();
    const { level, sourceText, translatedText } = body as {
      level: string;
      sourceText?: string;
      translatedText?: string;
    };

    if (!level) {
      return NextResponse.json(
        { error: "Missing level parameter" },
        { status: 400 }
      );
    }

    if (sourceText === undefined && translatedText === undefined) {
      return NextResponse.json(
        { error: "Nothing to save" },
        { status: 400 }
      );
    }

    const sourceLanguage = (body.sourceLanguage || "en") as "en" | "es";

    // Load existing content
    const { content, chapterFileData, isSplitChapter } = await loadAdminContent(slug, level);

    // Apply edits
    const updatedContent = applyTextToContent(content, sourceLanguage, sourceText, translatedText);

    // Re-detect alignment
    redetectAlignmentForContent(updatedContent, sourceLanguage);

    // Write back to disk
    const folderLevel = toFolderName(level);
    const levelDir = path.join(process.cwd(), `src/content/${slug}/${folderLevel}`);
    if (isSplitChapter && chapterFileData) {
      await writeSplitChapterContent(levelDir, updatedContent, chapterFileData);
    } else {
      await writeSingleFileContent(levelDir, updatedContent);
    }

    console.log(`[admin/content/PATCH] Saved edited content for slug=${slug} level=${level}`);

    return NextResponse.json({
      success: true,
      hasAlignmentIssues: updatedContent.hasAlignmentIssues || false,
      chapterAlignmentIssues: extractChapterAlignmentMap(updatedContent),
    });
  } catch (error) {
    console.error("Error saving admin story content:", error);
    return NextResponse.json(
      {
        error: "Failed to save content",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
