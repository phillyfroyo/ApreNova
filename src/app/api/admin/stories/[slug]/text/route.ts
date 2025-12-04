// src/app/api/admin/stories/[slug]/text/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

/**
 * GET - Fetch the story text for a given slug
 * Used by the edit modal to enable AI generation features
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Try to find any level content file for this story
    const contentDir = path.join(process.cwd(), `src/content/${slug}`);

    try {
      const entries = await fs.readdir(contentDir, { withFileTypes: true });

      // Look for level directories (l1, l2, etc.) that contain content.ts
      const levelDirs = entries
        .filter((e) => e.isDirectory() && e.name.match(/^l\d+$/))
        .map((e) => e.name)
        .sort();

      if (levelDirs.length === 0) {
        return NextResponse.json(
          { error: "No content directories found" },
          { status: 404 }
        );
      }

      // Read the first level's content.ts file (usually l1 for simplest text)
      const firstLevel = levelDirs[0];
      const filePath = path.join(contentDir, firstLevel, "content.ts");

      let content: string;
      try {
        content = await fs.readFile(filePath, "utf-8");
      } catch {
        return NextResponse.json(
          { error: `Content file not found: ${firstLevel}/content.ts` },
          { status: 404 }
        );
      }

      // Extract Spanish text from the content structure
      // The file exports a storyContent object with chapters > pages > lines
      // We'll extract the es text from each line
      // Handle both formats: es: "text" and "es": "text"

      const lines: string[] = [];

      // Regex to match both es: "..." and "es": "..." patterns
      const esRegex = /["']?es["']?\s*:\s*["'`]([^"'`]+)["'`]/g;
      let match;
      while ((match = esRegex.exec(content)) !== null) {
        const text = match[1].trim();
        if (text && text.length > 0) {
          lines.push(text);
        }
      }

      if (lines.length === 0) {
        return NextResponse.json(
          { error: "Could not extract text from content" },
          { status: 404 }
        );
      }

      // Join lines with newlines, limit to first ~3000 chars for API efficiency
      const text = lines.join("\n").slice(0, 3000);

      return NextResponse.json({ text });
    } catch (err) {
      console.error("Error reading content directory:", err);
      return NextResponse.json(
        { error: "Story content directory not found" },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("Fetch story text error:", error);
    return NextResponse.json(
      { error: "Failed to fetch story text" },
      { status: 500 }
    );
  }
}
