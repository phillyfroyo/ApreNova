// src/app/api/admin/stories/[slug]/archive/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const PROJECT_ROOT = process.cwd();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { isArchived } = await req.json();

    if (typeof isArchived !== "boolean") {
      return NextResponse.json(
        { error: "isArchived must be a boolean" },
        { status: 400 }
      );
    }

    // Update stories.ts to set isArchived
    const storiesPath = path.join(PROJECT_ROOT, "src/lib/stories.ts");
    let content = await fs.readFile(storiesPath, "utf-8");

    // Find the story entry and update/add isArchived field
    // Match the story object by slug
    const storyPattern = new RegExp(
      `(\\{\\s*\\n\\s*slug:\\s*"${slug}",[\\s\\S]*?)(\\n\\s*\\},?)`,
      ""
    );

    const match = content.match(storyPattern);
    if (!match) {
      return NextResponse.json(
        { error: `Story "${slug}" not found` },
        { status: 404 }
      );
    }

    const storyContent = match[1];
    const storyEnding = match[2];

    // Check if isArchived already exists in this entry
    const hasIsArchived = /isArchived:\s*(true|false)/.test(storyContent);

    let updatedStoryContent: string;

    if (hasIsArchived) {
      // Update existing isArchived field
      updatedStoryContent = storyContent.replace(
        /isArchived:\s*(true|false)/,
        `isArchived: ${isArchived}`
      );
    } else if (isArchived) {
      // Add isArchived field only if setting to true (no need to add false)
      // Insert after isPremiumOnly or after levels if no isPremiumOnly
      if (storyContent.includes("isPremiumOnly:")) {
        updatedStoryContent = storyContent.replace(
          /(isPremiumOnly:\s*(true|false)),?/,
          `$1,\n    isArchived: ${isArchived},`
        );
      } else {
        // Insert after levels
        updatedStoryContent = storyContent.replace(
          /(levels:\s*\[[^\]]*\]),?/,
          `$1,\n    isArchived: ${isArchived},`
        );
      }
    } else {
      // Setting to false and field doesn't exist - nothing to do
      updatedStoryContent = storyContent;
    }

    // If we're setting to false and it already exists, we could remove it
    // But for simplicity, we'll just set it to false
    content = content.replace(storyPattern, updatedStoryContent + storyEnding);

    await fs.writeFile(storiesPath, content, "utf-8");

    console.log(`[archive] Story "${slug}" isArchived set to ${isArchived}`);

    return NextResponse.json({
      success: true,
      slug,
      isArchived,
    });
  } catch (error) {
    console.error("Archive error:", error);
    return NextResponse.json(
      { error: "Failed to update archive status", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
