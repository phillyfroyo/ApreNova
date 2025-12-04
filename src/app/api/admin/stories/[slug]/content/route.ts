// src/app/api/admin/stories/[slug]/content/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

// GET - Fetch story content for a specific level
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
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

    // Read the content file for this level
    const contentPath = path.join(
      process.cwd(),
      `src/content/${slug}/${level}/content.ts`
    );

    try {
      const contentFile = await fs.readFile(contentPath, "utf-8");

      // Parse the TypeScript content file to extract the data
      // The file exports levelContent = { chapters: { ... } }
      const chaptersMatch = contentFile.match(/chapters:\s*\{([\s\S]*?)\n  \}/);

      if (!chaptersMatch) {
        return NextResponse.json(
          { error: "Could not parse content file" },
          { status: 500 }
        );
      }

      // For a simpler approach, let's use a dynamic import-like pattern
      // Extract the entire levelContent object using regex
      const levelContentMatch = contentFile.match(
        /export\s+const\s+levelContent\s*=\s*(\{[\s\S]*?\n\});/
      );

      if (!levelContentMatch) {
        return NextResponse.json(
          { error: "Could not find levelContent export" },
          { status: 500 }
        );
      }

      // Parse the chapters structure more carefully
      // We'll extract chapter and page data by walking through the file
      const chapters: Record<
        number,
        {
          pages: Record<
            number,
            {
              lines: Array<{ en: string; es: string }>;
            }
          >;
        }
      > = {};

      // Find all chapter blocks
      const chapterRegex = /(\d+):\s*\{\s*pages:\s*\{/g;
      let chapterMatch;
      const chapterPositions: { num: number; start: number }[] = [];

      while ((chapterMatch = chapterRegex.exec(contentFile)) !== null) {
        chapterPositions.push({
          num: parseInt(chapterMatch[1]),
          start: chapterMatch.index,
        });
      }

      // For each chapter, find its pages
      for (let i = 0; i < chapterPositions.length; i++) {
        const chapterNum = chapterPositions[i].num;
        const startPos = chapterPositions[i].start;
        const endPos =
          i < chapterPositions.length - 1
            ? chapterPositions[i + 1].start
            : contentFile.length;

        const chapterSection = contentFile.slice(startPos, endPos);

        chapters[chapterNum] = { pages: {} };

        // Find all pages in this chapter
        const pageRegex = /(\d+):\s*\{\s*lines:\s*\[/g;
        let pageMatch;
        const pagePositions: { num: number; start: number }[] = [];

        while ((pageMatch = pageRegex.exec(chapterSection)) !== null) {
          pagePositions.push({
            num: parseInt(pageMatch[1]),
            start: pageMatch.index,
          });
        }

        // For each page, extract lines
        for (let j = 0; j < pagePositions.length; j++) {
          const pageNum = pagePositions[j].num;
          const pageStart = pagePositions[j].start;
          const pageEnd =
            j < pagePositions.length - 1
              ? pagePositions[j + 1].start
              : chapterSection.length;

          const pageSection = chapterSection.slice(pageStart, pageEnd);

          // Extract lines array
          const linesMatch = pageSection.match(/lines:\s*\[([\s\S]*?)\]/);
          if (linesMatch) {
            const linesStr = linesMatch[1];
            const lines: Array<{ en: string; es: string }> = [];

            // Parse each line object
            const lineRegex =
              /\{\s*es:\s*"([^"]*(?:\\.[^"]*)*)"\s*,\s*en:\s*"([^"]*(?:\\.[^"]*)*)"\s*\}/g;
            let lineMatch;

            while ((lineMatch = lineRegex.exec(linesStr)) !== null) {
              lines.push({
                es: lineMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n"),
                en: lineMatch[2].replace(/\\"/g, '"').replace(/\\n/g, "\n"),
              });
            }

            chapters[chapterNum].pages[pageNum] = { lines };
          }
        }
      }

      return NextResponse.json({
        slug,
        level,
        chapters,
      });
    } catch (readError) {
      // Content file doesn't exist
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
