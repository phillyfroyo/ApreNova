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
 * Write a content file for a specific story level (single file format)
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
 * Write a single chapter file (split format)
 */
export async function writeChapterFile(
  storySlug: string,
  level: number,
  chapterNum: number,
  content: string
): Promise<FileWriteResult> {
  const relativePath = `src/content/${storySlug}/l${level}/ch${chapterNum}.ts`;
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
 * Write the index.ts file for split chapter format
 */
export async function writeChapterIndexFile(
  storySlug: string,
  level: number,
  content: string
): Promise<FileWriteResult> {
  const relativePath = `src/content/${storySlug}/l${level}/index.ts`;
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
      // Use [\s\S]*? to match any content (including newlines) non-greedily
      // until we hit the closing pattern: newline + spaces + },
      const existingEntryPattern = new RegExp(
        `\\{\\s*\\n\\s*slug:\\s*"${extractedSlug}",[\\s\\S]*?\\n\\s*\\},?`,
        ''
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
    // Simpler approach: find the closing pattern and insert before it
    // Pattern: last entry ends with },\n then },\n};\n\nexport
    const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';

    // Find "export default" and work backwards to find where to insert
    const exportIdx = content.indexOf('export default');
    if (exportIdx === -1) {
      console.error(`[file-writer] Could not find 'export default' in ${lang}.ts`);
      return false;
    }

    // Find the storiesMetadata section
    const metadataIdx = content.indexOf('storiesMetadata:');
    if (metadataIdx === -1) {
      console.error(`[file-writer] Could not find 'storiesMetadata:' in ${lang}.ts`);
      return false;
    }

    // Find the closing pattern: },\n}, which marks end of last entry and storiesMetadata close
    // Search backwards from export for the pattern "  },\n},"
    const closingSection = content.slice(metadataIdx, exportIdx);

    // Find last occurrence of "},\n" or "},\r\n" followed by eventual "},"
    // The structure is: ...entry},\n},\n};\nexport
    // We want to insert before the second }, (storiesMetadata close)
    const lastEntryClose = closingSection.lastIndexOf('  },');

    if (lastEntryClose === -1) {
      console.error(`[file-writer] Could not find last entry close in ${lang}.ts storiesMetadata`);
      console.error(`[file-writer] Closing section:`, JSON.stringify(closingSection.slice(-200)));
      return false;
    }

    // Insert position is right after the last entry's },
    const insertPos = metadataIdx + lastEntryClose + 4; // 4 = length of "  },"

    // Find where the line ends after },
    let lineEndPos = insertPos;
    while (lineEndPos < content.length && content[lineEndPos] !== '\n') {
      lineEndPos++;
    }
    lineEndPos++; // Include the \n

    // Insert the new entry
    content = content.slice(0, lineEndPos) + entry + lineEnding + content.slice(lineEndPos);

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
