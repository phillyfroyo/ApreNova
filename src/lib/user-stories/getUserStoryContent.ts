// src/lib/user-stories/getUserStoryContent.ts

import { prisma } from "@/lib/prisma";
import type { Language } from "@/types/i18n";
import type { CEFRCode } from "@/lib/cefr";

interface StoryLine {
  es: string;
  en: string;
  // Poem support
  stanzaNumber?: number;
  isStanzaBreak?: boolean;
  // Script support
  speaker?: string;
  speakerAnnotation?: string;
  stageDirection?: string;
  stageDirectionEs?: string;
  stageDirectionEn?: string;
  isStageDirectionOnly?: boolean;
}

interface ChapterMetadata {
  number: number;
  title: string;
  subtitle?: string;
}

interface PageContent {
  lines?: StoryLine[];
  stanzas?: StoryLine[][];  // For poems - nested array by stanza
  // Anthology poem tracking
  poemNumber?: number;
  poemTitle?: string;
  isFirstPageOfPoem?: boolean;
  isContinuation?: boolean;
}

/** Poem info for anthology navigation */
interface PoemInfo {
  number: number;
  title: string;
  startPage: number;
  endPage: number;
  pageCount: number;
}

interface LevelContent {
  storySlug: string;
  level: number;
  hasChapters: boolean;
  chapters: Record<
    number,
    {
      pages: Record<number, PageContent>;
      metadata?: ChapterMetadata; // Optional for backward compatibility
      poems?: PoemInfo[];  // For anthologies: poem list for navigation
    }
  >;
  /** Content structure type - may not be present in older content */
  structureType?: "prose" | "anthology" | "epic" | "script";
}

/**
 * Infer structure type from story type for older content that doesn't have structureType
 */
function inferStructureType(
  storyType: string | null | undefined,
  levelContent?: LevelContent
): "prose" | "anthology" | "epic" | "script" {
  // If level content has explicit structure type, use it
  if (levelContent?.structureType) {
    return levelContent.structureType;
  }

  // Infer from story type
  if (!storyType) return "prose";

  switch (storyType) {
    case "poem":
    case "song-lyrics":
      return "anthology";
    case "epic":
      return "epic";
    case "script":
    case "transcript":
      return "script";
    default:
      return "prose";
  }
}

/**
 * Get content for a user story from the database
 */
export async function getUserStoryContent(
  userStoryId: string,
  userId: string,
  level: string,
  chapter: string,
  page: string,
  lng: Language
) {
  try {
    console.log(`[getUserStoryContent] Fetching: storyId=${userStoryId}, level=${level}, chapter=${chapter}, page=${page}`);

    // Fetch the story and verify ownership or public visibility
    const story = await prisma.userStory.findFirst({
      where: {
        id: userStoryId,
        OR: [{ userId }, { visibility: "PUBLIC" }],
      },
      select: {
        id: true,
        slug: true,
        title: true,
        titleEs: true,
        titleEn: true,
        storyType: true,
        detectedLevel: true,
      },
    });

    if (!story) {
      console.log(`[getUserStoryContent] Story not found or access denied`);
      throw new Error("Story not found or access denied");
    }

    // Fetch the level content
    const levelData = await prisma.userStoryLevel.findUnique({
      where: {
        userStoryId_level: {
          userStoryId,
          level,
        },
      },
    });

    console.log(`[getUserStoryContent] Level data: status=${levelData?.status}, hasContent=${!!levelData?.content}`);

    if (!levelData || levelData.status !== "READY") {
      console.log(`[getUserStoryContent] Level content not ready: status=${levelData?.status}`);
      throw new Error("Level content not ready");
    }

    const levelContent = levelData.content as unknown as LevelContent;

    const chapterNum = parseInt(chapter);
    const pageNum = parseInt(page);

    // Debug: log available chapters and pages
    const availableChapters = Object.keys(levelContent.chapters || {});
    const availablePages = levelContent.chapters?.[chapterNum]
      ? Object.keys(levelContent.chapters[chapterNum].pages || {})
      : [];
    console.log(`[getUserStoryContent] Available chapters: [${availableChapters.join(', ')}], pages in ch${chapterNum}: [${availablePages.join(', ')}]`);

    const pageData = levelContent.chapters?.[chapterNum]?.pages?.[pageNum];

    if (pageData) {
      // Handle both flat lines and nested stanzas (for poems)
      const hasStanzas = !!pageData.stanzas && pageData.stanzas.length > 0;
      const hasLines = !!pageData.lines && pageData.lines.length > 0;

      // Flatten stanzas to lines for backwards compatibility with page component
      // while also passing the stanzas structure for poem-aware rendering
      let lines: StoryLine[] = [];
      if (hasStanzas) {
        // Flatten stanzas into lines array, preserving stanza metadata
        lines = pageData.stanzas!.flatMap((stanza, stanzaIdx) =>
          stanza.map((line, lineIdx) => ({
            ...line,
            stanzaNumber: line.stanzaNumber ?? (stanzaIdx + 1),
            // Mark last line of each stanza (except the last stanza) as having a break after
            isStanzaBreak: lineIdx === stanza.length - 1 && stanzaIdx < pageData.stanzas!.length - 1,
          }))
        );
      } else if (hasLines) {
        lines = pageData.lines!;
      }

      // Infer structure type for navigation labels
      const structureType = inferStructureType(story.storyType, levelContent);
      console.log(`[getUserStoryContent] Page has ${hasStanzas ? 'stanzas' : 'lines'}: ${hasStanzas ? pageData.stanzas!.length + ' stanzas' : lines.length + ' lines'}, structureType=${structureType}`);

      return {
        storySlug: story.slug,
        storyId: story.id,
        title: story.title,
        titleEs: story.titleEs,
        titleEn: story.titleEn,
        level: levelContent.level,
        chapter: chapterNum,
        page: pageNum,
        hasChapters: levelContent.hasChapters,
        lines,
        stanzas: hasStanzas ? pageData.stanzas : undefined,
        isUserStory: true,
        storyType: story.storyType,
        detectedLevel: story.detectedLevel,
        structureType,
      };
    } else {
      throw new Error(`Page not found: chapter ${chapterNum}, page ${pageNum}`);
    }
  } catch (err) {
    console.error(`Failed to load user story content:`, err);
    return {
      storySlug: "",
      storyId: userStoryId,
      title: "Error",
      level: parseInt(level.replace("l", "")),
      chapter: parseInt(chapter),
      page: parseInt(page),
      hasChapters: false,
      lines: [
        { en: "Content not available.", es: "Contenido no disponible." },
      ],
      isUserStory: true,
      storyType: null,
      detectedLevel: null,
    };
  }
}

/**
 * Poem info for anthology navigation
 */
export interface PoemNavInfo {
  number: number;      // 1-based poem number
  title: string;       // Poem title or Roman numeral
  startPage: number;   // First page of this poem
  endPage: number;     // Last page of this poem
  pageCount: number;   // Total pages this poem spans
}

/**
 * Get story structure (chapters and pages) for a user story
 * Now includes chapter titles for display in UI navigation
 * For anthologies, also includes poem info for poem-based navigation
 */
export async function getUserStoryMap(
  userStoryId: string,
  userId: string,
  level: string
): Promise<{
  hasChapters: boolean;
  chapters: {
    chapter: number;
    pages: number[];
    title?: string;    // Chapter title (e.g., "Down the Rabbit-Hole")
    subtitle?: string; // Optional subtitle
    poems?: PoemNavInfo[];  // For anthologies: poem list for navigation
  }[];
  structureType?: "prose" | "anthology" | "epic" | "script";
}> {
  try {
    // Verify ownership or public visibility
    const story = await prisma.userStory.findFirst({
      where: {
        id: userStoryId,
        OR: [{ userId }, { visibility: "PUBLIC" }],
      },
    });

    if (!story) {
      throw new Error("Story not found or access denied");
    }

    // Fetch the level content
    const levelData = await prisma.userStoryLevel.findUnique({
      where: {
        userStoryId_level: {
          userStoryId,
          level,
        },
      },
    });

    if (!levelData || levelData.status !== "READY") {
      return { hasChapters: false, chapters: [] };
    }

    const levelContent = levelData.content as unknown as LevelContent;

    const chapters = Object.keys(levelContent.chapters || {}).map(
      (chapterKey) => {
        const chapterNum = parseInt(chapterKey);
        const chapterData = levelContent.chapters[chapterNum];
        const pages = Object.keys(chapterData?.pages || {}).map((pageKey) =>
          parseInt(pageKey)
        );
        return {
          chapter: chapterNum,
          pages: pages.sort((a, b) => a - b),
          title: chapterData?.metadata?.title,
          subtitle: chapterData?.metadata?.subtitle,
          // Include poem info for anthologies (used for poem-based navigation)
          poems: chapterData?.poems as PoemNavInfo[] | undefined,
        };
      }
    );

    return {
      hasChapters: levelContent.hasChapters,
      chapters: chapters.sort((a, b) => a.chapter - b.chapter),
      structureType: levelContent.structureType,
    };
  } catch (err) {
    console.error(`Failed to load user story map:`, err);
    return { hasChapters: false, chapters: [] };
  }
}

/**
 * Get available levels for a user story (levels with READY status)
 */
export async function getUserStoryAvailableLevels(
  userStoryId: string,
  userId: string
): Promise<CEFRCode[]> {
  try {
    // Verify ownership or public visibility
    const story = await prisma.userStory.findFirst({
      where: {
        id: userStoryId,
        OR: [{ userId }, { visibility: "PUBLIC" }],
      },
      include: {
        UserStoryLevel: {
          where: { status: "READY" },
          select: { level: true },
        },
      },
    });

    if (!story) {
      return [];
    }

    return story.UserStoryLevel.map((l) => l.level as CEFRCode);
  } catch (err) {
    console.error(`Failed to load user story available levels:`, err);
    return [];
  }
}
