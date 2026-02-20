// src/app/api/admin/stories/[slug]/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import type { StoryType, StoryTag, StoryOrigin, StoryAttribution } from "@/types/story";
import { prisma } from "@/lib/prisma";

/**
 * Generate a random 4-digit number for unique filenames
 */
function generateRandomSuffix(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Helper to escape strings for JavaScript code output
 */
function escapeJsString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/**
 * Serialize the new StoryAttribution format to JavaScript code for stories.ts
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
    if (attr.sourceEdition.source) seParts.push(`source: "${escapeJsString(attr.sourceEdition.source)}"`);
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

interface UpdateStoryRequest {
  title?: { en: string; es: string };
  description?: { en: string; es: string };
  hook?: { en: string; es: string };
  thumbnailBase64?: string;
  backgroundBase64?: string;
  // Delete flags
  deleteCurrentThumbnail?: boolean;
  deleteCurrentBackground?: boolean;
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
    const { title, description, hook, thumbnailBase64, backgroundBase64, deleteCurrentThumbnail, deleteCurrentBackground } = body;

    const results: string[] = [];
    const errors: string[] = [];

    // Handle thumbnail deletion
    if (deleteCurrentThumbnail) {
      try {
        // Find and delete the current thumbnail file
        const storiesPath = path.join(process.cwd(), "src/lib/stories.ts");
        const storiesContent = await fs.readFile(storiesPath, "utf-8");

        // Extract current image path
        const imageMatch = storiesContent.match(new RegExp(`slug:\\s*"${slug}"[^}]*image:\\s*"([^"]+)"`));
        if (imageMatch && imageMatch[1]) {
          const currentImagePath = imageMatch[1];
          const fullPath = path.join(process.cwd(), "public", currentImagePath);
          try {
            await fs.unlink(fullPath);
            results.push(`Deleted thumbnail: ${currentImagePath}`);
          } catch {
            // File may not exist
          }

          // Update stories.ts to remove the image path (set to placeholder)
          const updatedContent = storiesContent.replace(
            new RegExp(`(slug:\\s*"${slug}"[^}]*image:\\s*)"[^"]+"`),
            `$1"/images/placeholder1.png"`
          );
          await fs.writeFile(storiesPath, updatedContent);
          results.push("Updated image path in stories.ts to placeholder");
        }
      } catch (err) {
        errors.push("Failed to delete thumbnail");
      }
    }

    // Handle background deletion
    if (deleteCurrentBackground) {
      try {
        const themesPath = path.join(process.cwd(), "src/components/storyThemes.ts");
        const themesContent = await fs.readFile(themesPath, "utf-8");

        // Check if theme entry exists with backgroundImage
        const themeMatch = themesContent.match(new RegExp(`"${slug}":\\s*\\{[^}]*backgroundImage:\\s*"([^"]+)"[^}]*\\}`));
        if (themeMatch && themeMatch[1]) {
          const currentBgPath = themeMatch[1];
          const fullPath = path.join(process.cwd(), "public", currentBgPath);
          try {
            await fs.unlink(fullPath);
            results.push(`Deleted background: ${currentBgPath}`);
          } catch {
            // File may not exist
          }
        }

        // Replace theme entry to use default gradient instead of backgroundImage
        const themeEntryRegex = new RegExp(`"${slug}":\\s*\\{[^}]*\\},?`, "s");
        const hasExistingTheme = themeEntryRegex.test(themesContent);

        if (hasExistingTheme) {
          // Replace with gradient-based theme
          const newThemeEntry = `"${slug}": {
    backgroundGradient: "linear-gradient(135deg, #fffdf9 0%, #d4c4a8 100%)",
    textColor: "text-gray-900",
    accentColor: "bg-green-600",
    hoverAccentColor: "hover:bg-green-300",
    fontFamily: "font-sans",
  },`;
          const updatedThemesContent = themesContent.replace(themeEntryRegex, newThemeEntry);
          await fs.writeFile(themesPath, updatedThemesContent);
          results.push("Updated theme to use default gradient");
        }
      } catch (err) {
        errors.push("Failed to delete background");
      }
    }

    // Update UI translation files if title, description, or hook provided
    if (title || description || hook) {
      // Helper to build the entry string for a given language
      const buildEntry = (lang: "en" | "es") => {
        const t = escapeJsString(title?.[lang] || "");
        const h = escapeJsString(hook?.[lang] || "");
        const d = escapeJsString(description?.[lang] || "");
        const hookLine = h ? `\n    hook: "${h}",` : "";
        return `"${slug}": {
    title: "${t}",${hookLine}
    description: "${d}",
  }`;
      };

      // Update English translations
      const enPath = path.join(process.cwd(), "src/content/ui/en.ts");
      const enContent = await fs.readFile(enPath, "utf-8");
      const enStoryRegex = new RegExp(`"${slug}":\\s*\\{[^}]*\\}`, "s");

      if (enStoryRegex.test(enContent)) {
        const updatedEnContent = enContent.replace(enStoryRegex, buildEntry("en"));
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
        const updatedEsContent = esContent.replace(esStoryRegex, buildEntry("es"));
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
              // Use the new serializeAttribution helper for the new format
              const attrString = serializeAttribution(origin.attribution);
              originString = `{ isOriginal: false, attribution: ${attrString} }`;
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

/**
 * Find and remove an object entry from content by matching a key pattern.
 * Properly handles nested braces unlike simple regex.
 *
 * @param content - The file content to search
 * @param keyPattern - Pattern to find the start of the entry (e.g., 'slug: "test"' or '"test":')
 * @param braceBeforeKey - If true, looks for brace before key (like in arrays). If false, looks for brace after key (like in objects with string keys).
 * @returns Updated content with the entry removed, or null if not found
 */
function removeObjectEntry(content: string, keyPattern: string, braceBeforeKey: boolean = true): string | null {
  const keyIndex = content.indexOf(keyPattern);
  if (keyIndex === -1) return null;

  let startIndex: number;
  let endIndex: number;

  if (braceBeforeKey) {
    // For patterns like { slug: "test", ... } where brace is BEFORE the key
    // Find the opening brace before the key
    let braceCount = 0;
    startIndex = keyIndex;
    for (let i = keyIndex; i >= 0; i--) {
      if (content[i] === '}') braceCount++;
      if (content[i] === '{') {
        if (braceCount === 0) {
          startIndex = i;
          break;
        }
        braceCount--;
      }
    }

    // Find the closing brace after the key (accounting for nested braces)
    braceCount = 1; // We start after the opening brace
    endIndex = startIndex + 1;
    for (let i = startIndex + 1; i < content.length; i++) {
      if (content[i] === '{') braceCount++;
      if (content[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }
  } else {
    // For patterns like "test": { ... } where brace is AFTER the key
    // Start from the key itself
    startIndex = keyIndex;

    // Find the opening brace AFTER the key
    let braceStart = content.indexOf('{', keyIndex);
    if (braceStart === -1) return null;

    // Find the closing brace (accounting for nested braces)
    let braceCount = 1;
    endIndex = braceStart + 1;
    for (let i = braceStart + 1; i < content.length; i++) {
      if (content[i] === '{') braceCount++;
      if (content[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }
  }

  // Extend to include trailing comma and whitespace
  let trailingEnd = endIndex;
  const trailingMatch = content.slice(endIndex).match(/^,?\s*/);
  if (trailingMatch) {
    trailingEnd = endIndex + trailingMatch[0].length;
  }

  // Extend to include leading whitespace (but preserve at least one newline for formatting)
  let leadingStart = startIndex;
  for (let i = startIndex - 1; i >= 0; i--) {
    if (content[i] === ' ' || content[i] === '\t') {
      leadingStart = i;
    } else if (content[i] === '\n') {
      leadingStart = i;
      break;
    } else {
      break;
    }
  }

  // Remove the entry
  return content.slice(0, leadingStart) + content.slice(trailingEnd);
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

    // 2. Remove from STORY_METADATA in stories.ts (handles nested braces properly)
    const storiesPath = path.join(process.cwd(), "src/lib/stories.ts");
    const storiesContent = await fs.readFile(storiesPath, "utf-8");

    const updatedStoriesContent = removeObjectEntry(storiesContent, `slug: "${slug}"`);

    if (updatedStoriesContent && updatedStoriesContent !== storiesContent) {
      await fs.writeFile(storiesPath, updatedStoriesContent);
      results.push("Removed from STORY_METADATA in stories.ts");
    } else {
      errors.push("Story not found in STORY_METADATA");
    }

    // 3. Remove from en.ts storiesMetadata (handles nested braces properly)
    const enPath = path.join(process.cwd(), "src/content/ui/en.ts");
    const enContent = await fs.readFile(enPath, "utf-8");
    const updatedEnContent = removeObjectEntry(enContent, `"${slug}":`, false);

    if (updatedEnContent && updatedEnContent !== enContent) {
      await fs.writeFile(enPath, updatedEnContent);
      results.push("Removed from en.ts storiesMetadata");
    }

    // 4. Remove from es.ts storiesMetadata (handles nested braces properly)
    const esPath = path.join(process.cwd(), "src/content/ui/es.ts");
    const esContent = await fs.readFile(esPath, "utf-8");
    const updatedEsContent = removeObjectEntry(esContent, `"${slug}":`, false);

    if (updatedEsContent && updatedEsContent !== esContent) {
      await fs.writeFile(esPath, updatedEsContent);
      results.push("Removed from es.ts storiesMetadata");
    }

    // 5. Try to delete thumbnail (check for random suffix pattern)
    const imageExtensions = ["png", "jpg", "jpeg", "webp"];
    const publicImagesDir = path.join(process.cwd(), "public/images");
    try {
      const files = await fs.readdir(publicImagesDir);
      // Match both old format (slug-thumbnail.ext) and new format (slug-thumbnail-XXXX.ext)
      const thumbnailPattern = new RegExp(`^${slug}-thumbnail(-\\d+)?\\.(png|jpg|jpeg|webp)$`);
      for (const file of files) {
        if (thumbnailPattern.test(file)) {
          await fs.unlink(path.join(publicImagesDir, file));
          results.push(`Deleted thumbnail: ${file}`);
        }
      }
    } catch {
      // Directory read failed, try direct paths as fallback
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
    }

    // 6. Try to delete background image (check for random suffix pattern)
    try {
      const files = await fs.readdir(publicImagesDir);
      // Match both old format and new format with random suffix
      const backgroundPattern = new RegExp(`^${slug}-background(-\\d+)?\\.(png|jpg|jpeg|webp)$`);
      for (const file of files) {
        if (backgroundPattern.test(file)) {
          await fs.unlink(path.join(publicImagesDir, file));
          results.push(`Deleted background: ${file}`);
        }
      }
    } catch {
      // Directory read failed, try direct paths as fallback
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
    }

    // 7. Remove theme entry from storyThemes.ts (handles nested braces properly)
    try {
      const themesPath = path.join(process.cwd(), "src/components/storyThemes.ts");
      const themesContent = await fs.readFile(themesPath, "utf-8");
      const updatedThemesContent = removeObjectEntry(themesContent, `"${slug}":`, false);

      if (updatedThemesContent && updatedThemesContent !== themesContent) {
        await fs.writeFile(themesPath, updatedThemesContent);
        results.push("Removed theme entry from storyThemes.ts");
      }
    } catch (themeError) {
      // storyThemes.ts might not have an entry for this story
    }

    // 8. Delete API cost records associated with this story
    try {
      const { count } = await prisma.apiCost.deleteMany({
        where: {
          metadata: {
            path: ["adminStorySlug"],
            equals: slug,
          },
        },
      });
      if (count > 0) {
        results.push(`Deleted ${count} API cost record(s) from database`);
      }
    } catch (costError) {
      console.error("Failed to delete cost records:", costError);
      errors.push("Failed to delete API cost records from database");
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
