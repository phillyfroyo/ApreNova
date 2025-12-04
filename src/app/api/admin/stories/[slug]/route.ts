// src/app/api/admin/stories/[slug]/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import type { StoryType, StoryTag, StoryOrigin } from "@/types/story";

/**
 * Generate a random 4-digit number for unique filenames
 */
function generateRandomSuffix(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

interface UpdateStoryRequest {
  title?: { en: string; es: string };
  description?: { en: string; es: string };
  thumbnailBase64?: string;
  backgroundBase64?: string;
  // Tagging fields
  storyType?: StoryType;
  origin?: StoryOrigin;
  tags?: StoryTag[];
  targetAudience?: "children" | "teen" | "adult" | "all";
}

// PATCH - Update story metadata (title, description, thumbnail)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body: UpdateStoryRequest = await req.json();
    const { title, description, thumbnailBase64, backgroundBase64 } = body;

    const results: string[] = [];
    const errors: string[] = [];

    // Update UI translation files if title or description provided
    if (title || description) {
      // Update English translations
      const enPath = path.join(process.cwd(), "src/content/ui/en.ts");
      const enContent = await fs.readFile(enPath, "utf-8");

      // Check if story exists in en.ts
      const enStoryRegex = new RegExp(`"${slug}":\\s*\\{[^}]*\\}`, "s");

      if (enStoryRegex.test(enContent)) {
        // Update existing entry
        const newEnEntry = `"${slug}": {
    title: "${title?.en || ""}",
    description: "${description?.en || ""}",
  }`;
        const updatedEnContent = enContent.replace(enStoryRegex, newEnEntry);
        await fs.writeFile(enPath, updatedEnContent);
        results.push("Updated en.ts");
      } else {
        errors.push(`Story "${slug}" not found in en.ts`);
      }

      // Update Spanish translations
      const esPath = path.join(process.cwd(), "src/content/ui/es.ts");
      const esContent = await fs.readFile(esPath, "utf-8");

      const esStoryRegex = new RegExp(`"${slug}":\\s*\\{[^}]*\\}`, "s");

      if (esStoryRegex.test(esContent)) {
        const newEsEntry = `"${slug}": {
    title: "${title?.es || ""}",
    description: "${description?.es || ""}",
  }`;
        const updatedEsContent = esContent.replace(esStoryRegex, newEsEntry);
        await fs.writeFile(esPath, updatedEsContent);
        results.push("Updated es.ts");
      } else {
        errors.push(`Story "${slug}" not found in es.ts`);
      }
    }

    // Update thumbnail if provided
    if (thumbnailBase64) {
      try {
        const base64Data = thumbnailBase64.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, "base64");
        const mimeMatch = thumbnailBase64.match(/^data:image\/(\w+);base64,/);
        const extension = mimeMatch?.[1] || "png";

        // Generate unique filename with random suffix to avoid cache issues
        const randomSuffix = generateRandomSuffix();
        const filename = `${slug}-thumbnail-${randomSuffix}.${extension}`;
        const newImagePath = `/images/${filename}`;

        // Save new thumbnail with unique name
        const thumbnailPath = path.join(process.cwd(), `public/images/${filename}`);
        await fs.writeFile(thumbnailPath, imageBuffer);
        results.push(`Saved thumbnail: ${filename}`);

        // Update image path in stories.ts
        const storiesPath = path.join(process.cwd(), "src/lib/stories.ts");
        const storiesContent = await fs.readFile(storiesPath, "utf-8");

        // Match the image line for this slug's entry
        const imageRegex = new RegExp(
          `(slug:\\s*"${slug}"[^}]*image:\\s*")([^"]+)(")`
        );

        const updatedStoriesContent = storiesContent.replace(imageRegex, `$1${newImagePath}$3`);

        if (updatedStoriesContent !== storiesContent) {
          await fs.writeFile(storiesPath, updatedStoriesContent);
          results.push(`Updated image path in stories.ts to ${newImagePath}`);
        }
      } catch (thumbError) {
        errors.push("Failed to save thumbnail");
      }
    }

    // Update background if provided
    if (backgroundBase64) {
      try {
        const base64Data = backgroundBase64.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, "base64");
        const mimeMatch = backgroundBase64.match(/^data:image\/(\w+);base64,/);
        const extension = mimeMatch?.[1] || "png";

        // Generate unique filename with random suffix to avoid cache issues
        const bgRandomSuffix = generateRandomSuffix();
        const bgFilename = `${slug}-background-${bgRandomSuffix}.${extension}`;
        const backgroundImagePath = `/images/${bgFilename}`;
        const backgroundPath = path.join(process.cwd(), `public${backgroundImagePath}`);
        await fs.writeFile(backgroundPath, imageBuffer);
        results.push(`Saved background: ${bgFilename}`);

        // Update or add theme entry in storyThemes.ts
        const themesPath = path.join(process.cwd(), "src/components/storyThemes.ts");
        const themesContent = await fs.readFile(themesPath, "utf-8");

        // Check if theme entry already exists
        const themeEntryRegex = new RegExp(`"${slug}":\\s*\\{[^}]*\\},?`, "s");
        const hasExistingTheme = themeEntryRegex.test(themesContent);

        // Build theme entry with background image
        const themeEntry = `"${slug}": {
    backgroundImage: "${backgroundImagePath}",
    textColor: "text-gray-900",
    accentColor: "bg-green-600",
    hoverAccentColor: "hover:bg-green-300",
    fontFamily: "font-sans",
  },`;

        let updatedThemesContent: string;

        if (hasExistingTheme) {
          // Update existing entry
          updatedThemesContent = themesContent.replace(themeEntryRegex, themeEntry);
          results.push("Updated theme entry in storyThemes.ts");
        } else {
          // Add new entry before the closing brace
          updatedThemesContent = themesContent.replace(
            /(\n};)\s*$/,
            `  ${themeEntry}\n};`
          );
          results.push("Added theme entry to storyThemes.ts");
        }

        await fs.writeFile(themesPath, updatedThemesContent);
      } catch (bgError) {
        console.error("Failed to save background:", bgError);
        errors.push("Failed to save background image");
      }
    }

    // Update tagging fields in stories.ts
    const { storyType, origin, tags, targetAudience } = body;
    if (storyType || origin || tags || targetAudience) {
      try {
        const storiesPath = path.join(process.cwd(), "src/lib/stories.ts");
        let storiesContent = await fs.readFile(storiesPath, "utf-8");

        // Find the story entry by locating slug and then finding the enclosing braces
        const slugPattern = `slug: "${slug}"`;
        const slugIndex = storiesContent.indexOf(slugPattern);

        if (slugIndex === -1) {
          errors.push(`Could not find story entry for ${slug} in stories.ts`);
        } else {
          // Find the opening brace before the slug
          let braceCount = 0;
          let startIndex = slugIndex;
          for (let i = slugIndex; i >= 0; i--) {
            if (storiesContent[i] === '}') braceCount++;
            if (storiesContent[i] === '{') {
              if (braceCount === 0) {
                startIndex = i;
                break;
              }
              braceCount--;
            }
          }

          // Find the closing brace after the slug (accounting for nested braces)
          braceCount = 1; // We start after the opening brace
          let endIndex = startIndex + 1;
          for (let i = startIndex + 1; i < storiesContent.length; i++) {
            if (storiesContent[i] === '{') braceCount++;
            if (storiesContent[i] === '}') {
              braceCount--;
              if (braceCount === 0) {
                endIndex = i + 1;
                break;
              }
            }
          }

          const originalEntry = storiesContent.slice(startIndex, endIndex);
          let updatedEntry = originalEntry;

          // Update type
          if (storyType) {
            if (/type:\s*"[^"]*"/.test(updatedEntry)) {
              updatedEntry = updatedEntry.replace(/type:\s*"[^"]*"/, `type: "${storyType}"`);
            } else {
              // Add type after levels line
              updatedEntry = updatedEntry.replace(/(levels:\s*\[[^\]]*\])/, `$1,\n    type: "${storyType}"`);
            }
          }

          // Update origin - need to handle nested braces carefully
          if (origin) {
            let originString: string;
            if (origin.isOriginal) {
              originString = "{ isOriginal: true }";
            } else {
              // Build attribution as proper JS object syntax (not JSON)
              const attr = origin.attribution;
              const attrParts: string[] = [];
              if (attr.author !== undefined) attrParts.push(`author: "${attr.author}"`);
              if (attr.authorLifespan) attrParts.push(`authorLifespan: "${attr.authorLifespan}"`);
              if (attr.originalTitle) attrParts.push(`originalTitle: "${attr.originalTitle}"`);
              if (attr.yearPublished) attrParts.push(`yearPublished: ${attr.yearPublished}`);
              if (attr.source) attrParts.push(`source: "${attr.source}"`);
              if (attr.translator) attrParts.push(`translator: "${attr.translator}"`);
              attrParts.push(`publicDomain: ${attr.publicDomain}`);
              if (attr.publicDomainNote) attrParts.push(`publicDomainNote: "${attr.publicDomainNote}"`);

              originString = `{ isOriginal: false, attribution: { ${attrParts.join(", ")} } }`;
            }

            // Find and replace origin with brace matching
            const originMatch = updatedEntry.match(/origin:\s*\{/);
            if (originMatch) {
              const originStart = updatedEntry.indexOf(originMatch[0]);
              let oBraceCount = 1;
              let originEnd = originStart + originMatch[0].length;
              for (let i = originEnd; i < updatedEntry.length; i++) {
                if (updatedEntry[i] === '{') oBraceCount++;
                if (updatedEntry[i] === '}') {
                  oBraceCount--;
                  if (oBraceCount === 0) {
                    originEnd = i + 1;
                    break;
                  }
                }
              }
              const oldOrigin = updatedEntry.slice(originStart, originEnd);
              updatedEntry = updatedEntry.replace(oldOrigin, `origin: ${originString}`);
            } else {
              // Add origin after type
              if (/type:\s*"[^"]*"/.test(updatedEntry)) {
                updatedEntry = updatedEntry.replace(/(type:\s*"[^"]*")/, `$1,\n    origin: ${originString}`);
              } else {
                updatedEntry = updatedEntry.replace(/(levels:\s*\[[^\]]*\])/, `$1,\n    origin: ${originString}`);
              }
            }
          }

          // Update tags
          if (tags) {
            const tagsString = JSON.stringify(tags);
            if (/tags:\s*\[[^\]]*\]/.test(updatedEntry)) {
              updatedEntry = updatedEntry.replace(/tags:\s*\[[^\]]*\]/, `tags: ${tagsString}`);
            } else {
              // Add tags before the closing brace
              updatedEntry = updatedEntry.replace(/,?\s*\}$/, `,\n    tags: ${tagsString}\n  }`);
            }
          }

          // Update targetAudience
          if (targetAudience) {
            if (/targetAudience:\s*"[^"]*"/.test(updatedEntry)) {
              updatedEntry = updatedEntry.replace(/targetAudience:\s*"[^"]*"/, `targetAudience: "${targetAudience}"`);
            } else {
              // Add targetAudience before the closing brace
              updatedEntry = updatedEntry.replace(/,?\s*\}$/, `,\n    targetAudience: "${targetAudience}"\n  }`);
            }
          }

          if (updatedEntry !== originalEntry) {
            storiesContent = storiesContent.slice(0, startIndex) + updatedEntry + storiesContent.slice(endIndex);
            await fs.writeFile(storiesPath, storiesContent);
            results.push("Updated tagging fields in stories.ts");
          }
        }
      } catch (taggingError) {
        console.error("Failed to update tagging:", taggingError);
        errors.push("Failed to update tagging fields");
      }
    }

    if (errors.length > 0 && results.length === 0) {
      return NextResponse.json({ success: false, errors }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Update story error:", error);
    return NextResponse.json(
      { error: "Failed to update story", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete story and all its files
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const results: string[] = [];
    const errors: string[] = [];

    // 1. Delete content directory
    const contentDir = path.join(process.cwd(), `src/content/${slug}`);
    try {
      await fs.rm(contentDir, { recursive: true, force: true });
      results.push(`Deleted content directory: src/content/${slug}`);
    } catch {
      errors.push(`Content directory not found: src/content/${slug}`);
    }

    // 2. Remove from STORY_METADATA in stories.ts
    const storiesPath = path.join(process.cwd(), "src/lib/stories.ts");
    const storiesContent = await fs.readFile(storiesPath, "utf-8");

    // Match the story entry in STORY_METADATA array
    // Handle both direct slug and slugify() patterns
    const directSlugPattern = new RegExp(
      `\\s*\\{[^}]*slug:\\s*"${slug}"[^}]*\\},?\\n?`,
      "g"
    );
    const slugifyPattern = new RegExp(
      `\\s*\\{[^}]*slug:\\s*slugify\\([^)]+\\)[^}]*\\},?\\n?`,
      "g"
    );

    let updatedStoriesContent = storiesContent.replace(directSlugPattern, "\n");

    // Check if anything was removed
    if (updatedStoriesContent !== storiesContent) {
      await fs.writeFile(storiesPath, updatedStoriesContent);
      results.push("Removed from STORY_METADATA in stories.ts");
    } else {
      errors.push("Story not found in STORY_METADATA (may use slugify())");
    }

    // 3. Remove from en.ts storiesMetadata
    const enPath = path.join(process.cwd(), "src/content/ui/en.ts");
    const enContent = await fs.readFile(enPath, "utf-8");
    const enStoryRegex = new RegExp(`\\s*"${slug}":\\s*\\{[^}]*\\},?\\n?`, "g");
    const updatedEnContent = enContent.replace(enStoryRegex, "\n");

    if (updatedEnContent !== enContent) {
      await fs.writeFile(enPath, updatedEnContent);
      results.push("Removed from en.ts storiesMetadata");
    }

    // 4. Remove from es.ts storiesMetadata
    const esPath = path.join(process.cwd(), "src/content/ui/es.ts");
    const esContent = await fs.readFile(esPath, "utf-8");
    const esStoryRegex = new RegExp(`\\s*"${slug}":\\s*\\{[^}]*\\},?\\n?`, "g");
    const updatedEsContent = esContent.replace(esStoryRegex, "\n");

    if (updatedEsContent !== esContent) {
      await fs.writeFile(esPath, updatedEsContent);
      results.push("Removed from es.ts storiesMetadata");
    }

    // 5. Try to delete thumbnail (optional, may not exist)
    const imageExtensions = ["png", "jpg", "jpeg", "webp"];
    for (const ext of imageExtensions) {
      const thumbPath = path.join(process.cwd(), `public/images/${slug}-thumbnail.${ext}`);
      try {
        await fs.unlink(thumbPath);
        results.push(`Deleted thumbnail: ${slug}-thumbnail.${ext}`);
        break;
      } catch {
        // File doesn't exist with this extension, try next
      }
    }

    // 6. Try to delete background image (optional, may not exist)
    for (const ext of imageExtensions) {
      const bgPath = path.join(process.cwd(), `public/images/${slug}-background.${ext}`);
      try {
        await fs.unlink(bgPath);
        results.push(`Deleted background: ${slug}-background.${ext}`);
        break;
      } catch {
        // File doesn't exist with this extension, try next
      }
    }

    // 7. Remove theme entry from storyThemes.ts
    try {
      const themesPath = path.join(process.cwd(), "src/components/storyThemes.ts");
      const themesContent = await fs.readFile(themesPath, "utf-8");

      // Match and remove the theme entry for this slug
      const themeEntryRegex = new RegExp(`\\s*"${slug}":\\s*\\{[^}]*\\},?\\n?`, "g");
      const updatedThemesContent = themesContent.replace(themeEntryRegex, "\n");

      if (updatedThemesContent !== themesContent) {
        await fs.writeFile(themesPath, updatedThemesContent);
        results.push("Removed theme entry from storyThemes.ts");
      }
    } catch (themeError) {
      // storyThemes.ts might not have an entry for this story
    }

    if (results.length === 0) {
      return NextResponse.json(
        { success: false, error: "Story not found or could not be deleted", errors },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Story "${slug}" deleted successfully`,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Delete story error:", error);
    return NextResponse.json(
      { error: "Failed to delete story", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
