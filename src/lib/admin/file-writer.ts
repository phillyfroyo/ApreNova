// src/lib/admin/file-writer.ts
import fs from "fs/promises";
import path from "path";

export interface FileWriteResult {
  success: boolean;
  path: string;
  error?: string;
}

export interface StoryFilesWriteResult {
  contentFiles: FileWriteResult[];
  metadataUpdated: boolean;
  uiEnUpdated: boolean;
  uiEsUpdated: boolean;
  errors: string[];
}

const PROJECT_ROOT = process.cwd();

/**
 * Ensure a directory exists, creating it if necessary
 */
async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
}

/**
 * Write a content file for a specific story level
 */
export async function writeContentFile(
  storySlug: string,
  level: number,
  content: string
): Promise<FileWriteResult> {
  const relativePath = `src/content/${storySlug}/l${level}/content.ts`;
  const fullPath = path.join(PROJECT_ROOT, relativePath);

  try {
    await ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content, "utf-8");

    return { success: true, path: relativePath };
  } catch (error) {
    return {
      success: false,
      path: relativePath,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Add or update a story entry in STORY_METADATA in stories.ts
 * If the slug already exists, the existing entry is updated.
 * If not, a new entry is appended.
 */
export async function updateStoriesMetadata(
  metadataEntry: string,
  slug?: string
): Promise<boolean> {
  const filePath = path.join(PROJECT_ROOT, "src/lib/stories.ts");

  try {
    let content = await fs.readFile(filePath, "utf-8");

    // Extract slug from metadataEntry if not provided
    const extractedSlug = slug || metadataEntry.match(/slug:\s*"([^"]+)"/)?.[1];

    if (extractedSlug) {
      // Check if this story already exists in STORY_METADATA
      // Match the entire object entry for this slug
      const existingEntryPattern = new RegExp(
        `\\{\\s*\\n\\s*slug:\\s*"${extractedSlug}",[^}]*targetAudience:[^}]*\\},?`,
        's'
      );

      if (existingEntryPattern.test(content)) {
        console.log(`[file-writer] Story "${extractedSlug}" already exists in stories.ts, updating...`);
        // Remove trailing comma from metadataEntry if present, we'll handle comma logic
        const cleanEntry = metadataEntry.replace(/,\s*$/, '');
        content = content.replace(existingEntryPattern, cleanEntry + ',');
        await fs.writeFile(filePath, content, "utf-8");
        console.log(`[file-writer] Successfully updated "${extractedSlug}" in stories.ts`);
        return true;
      }
    }

    // Story doesn't exist, append new entry
    // Find the STORY_METADATA array and insert before the closing bracket
    // Look for the pattern "];" that ends the array
    const arrayEndPattern = /(\];)\s*\n\s*export function getStoryUrl/;
    const match = content.match(arrayEndPattern);

    if (!match) {
      console.error("Could not find STORY_METADATA array end");
      return false;
    }

    // Insert the new entry before the closing bracket
    content = content.replace(
      arrayEndPattern,
      `${metadataEntry}\n];\n\nexport function getStoryUrl`
    );

    await fs.writeFile(filePath, content, "utf-8");
    console.log(`[file-writer] Successfully added "${extractedSlug}" to stories.ts`);
    return true;
  } catch (error) {
    console.error("Error updating stories.ts:", error);
    return false;
  }
}

/**
 * Add or update story metadata in UI translation file
 * If the slug already exists, the existing entry is updated.
 */
export async function updateUITranslation(
  lang: "en" | "es",
  slug: string,
  entry: string
): Promise<boolean> {
  const filePath = path.join(PROJECT_ROOT, `src/content/ui/${lang}.ts`);

  try {
    let content = await fs.readFile(filePath, "utf-8");

    if (!content.includes("storiesMetadata:")) {
      console.error(`[file-writer] storiesMetadata not found in ${lang}.ts`);
      return false;
    }

    // Check if this story already exists
    if (content.includes(`"${slug}":`)) {
      console.log(`[file-writer] Story "${slug}" already exists in ${lang}.ts, updating...`);
      // Match the existing entry for this slug
      const existingEntryPattern = new RegExp(
        `"${slug}":\\s*\\{[^}]*\\},?`,
        's'
      );
      // Ensure entry has proper comma at end
      const cleanEntry = entry.replace(/,?\s*$/, ',');
      content = content.replace(existingEntryPattern, cleanEntry);
      await fs.writeFile(filePath, content, "utf-8");
      console.log(`[file-writer] Successfully updated "${slug}" in ${lang}.ts`);
      return true;
    }

    // Story doesn't exist, add new entry
    // Match the end of storiesMetadata object
    // Structure is: storiesMetadata: { ...entries... },\n};\n\nexport default
    // The },\n}; pattern closes storiesMetadata (with trailing comma) then closes main object
    const lastEntryPattern = /(storiesMetadata:\s*\{[\s\S]*?)(\n},\n};\n+export default)/;
    const match = content.match(lastEntryPattern);

    if (!match) {
      // Try alternate pattern without trailing comma on storiesMetadata
      const altPattern = /(storiesMetadata:\s*\{[\s\S]*?)(\n}\n};\n+export default)/;
      const altMatch = content.match(altPattern);

      if (!altMatch) {
        console.error(`[file-writer] Could not find end of storiesMetadata in ${lang}.ts`);
        console.error(`[file-writer] Last 200 chars of file:`, content.slice(-200));
        return false;
      }

      // Use alternate pattern
      content = content.replace(altPattern, `$1\n${entry}$2`);
    } else {
      // Insert the new entry before the closing },
      content = content.replace(lastEntryPattern, `$1\n${entry}$2`);
    }

    await fs.writeFile(filePath, content, "utf-8");
    console.log(`[file-writer] Successfully added "${slug}" to ${lang}.ts`);
    return true;
  } catch (error) {
    console.error(`[file-writer] Error updating ${lang}.ts:`, error);
    return false;
  }
}

/**
 * Copy or save a thumbnail image
 */
export async function saveThumbnail(
  storySlug: string,
  imageData: Buffer | null,
  sourcePath?: string
): Promise<FileWriteResult> {
  const relativePath = `public/images/${storySlug}-thumbnail.png`;
  const fullPath = path.join(PROJECT_ROOT, relativePath);

  try {
    if (imageData) {
      await fs.writeFile(fullPath, imageData);
    } else if (sourcePath) {
      await fs.copyFile(sourcePath, fullPath);
    } else {
      // Copy a placeholder image
      const placeholderPath = path.join(PROJECT_ROOT, "public/images/placeholder3.png");
      await fs.copyFile(placeholderPath, fullPath);
    }

    return { success: true, path: relativePath };
  } catch (error) {
    return {
      success: false,
      path: relativePath,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Write all files for a new story
 */
export async function writeAllStoryFiles(params: {
  storySlug: string;
  levels: Array<{ level: number; content: string }>;
  metadataEntry: string;
  uiEnEntry: string;
  uiEsEntry: string;
}): Promise<StoryFilesWriteResult> {
  const errors: string[] = [];
  const contentFiles: FileWriteResult[] = [];

  // Write content files for each level
  for (const { level, content } of params.levels) {
    const result = await writeContentFile(params.storySlug, level, content);
    contentFiles.push(result);
    if (!result.success) {
      errors.push(`Failed to write L${level}: ${result.error}`);
    }
  }

  // Update stories.ts metadata
  const metadataUpdated = await updateStoriesMetadata(params.metadataEntry);
  if (!metadataUpdated) {
    errors.push("Failed to update stories.ts");
  }

  // Update UI translations
  const uiEnUpdated = await updateUITranslation("en", params.storySlug, params.uiEnEntry);
  if (!uiEnUpdated) {
    errors.push("Failed to update en.ts");
  }

  const uiEsUpdated = await updateUITranslation("es", params.storySlug, params.uiEsEntry);
  if (!uiEsUpdated) {
    errors.push("Failed to update es.ts");
  }

  return {
    contentFiles,
    metadataUpdated,
    uiEnUpdated,
    uiEsUpdated,
    errors,
  };
}
