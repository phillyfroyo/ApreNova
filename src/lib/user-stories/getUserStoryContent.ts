// src/lib/user-stories/getUserStoryContent.ts

import { prisma } from "@/lib/prisma";
import type { Language } from "@/types/i18n";
import type { CEFRCode } from "@/lib/cefr";
import { detectAlignmentIssues } from "./alignment-check";

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

/** Result type for getUserStoryContent */
export interface UserStoryContentResult {
  // Content data
  storySlug: string;
  storyId: string;
  title: string;
  titleEs?: string | null;
  titleEn?: string | null;
  level: number;
  chapter: number;
  page: number;
  hasChapters: boolean;
  lines: StoryLine[];
  stanzas?: StoryLine[][];
  isUserStory: true;
  storyType: string | null;
  detectedLevel: string | null;
  structureType?: "prose" | "anthology" | "epic" | "script";
  // Status info for handling pending content
  isProcessing?: boolean;
  chapterPending?: boolean;
  levelPending?: boolean;
  availableChapters?: number[];
  totalChapters?: number;
  // Alignment warning for this chapter
  chapterHasAlignmentIssues?: boolean;
}

/**
 * Get content for a user story from the database
 * Now supports reading during processing with pending state info
 */
export async function getUserStoryContent(
  userStoryId: string,
  userId: string,
  level: string,
  chapter: string,
  page: string,
  lng: Language
): Promise<UserStoryContentResult | null> {
  try {
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
        sourceLanguage: true,
      },
    });

    if (!story) {
      return null; // Story not found
    }

    // Fetch the level content with processing progress
    const levelData = await prisma.userStoryLevel.findUnique({
      where: {
        userStoryId_level: {
          userStoryId,
          level,
        },
      },
      select: {
        status: true,
        content: true,
        processingProgress: true,
      },
    });

    // Level doesn't exist yet
    if (!levelData) {
      return {
        storySlug: story.slug,
        storyId: story.id,
        title: story.title,
        titleEs: story.titleEs,
        titleEn: story.titleEn,
        level: 0,
        chapter: parseInt(chapter),
        page: parseInt(page),
        hasChapters: false,
        lines: [],
        isUserStory: true,
        storyType: story.storyType,
        detectedLevel: story.detectedLevel,
        isProcessing: true,
        levelPending: true,
        availableChapters: [],
        totalChapters: 0,
      };
    }

    const isProcessing = levelData.status === "PROCESSING" || levelData.status === "PENDING";
    const levelContent = levelData.content as unknown as LevelContent | null;
    const progress = levelData.processingProgress as { totalChapters?: number } | null;

    // Get available chapters from content
    const availableChapters = levelContent?.chapters
      ? Object.keys(levelContent.chapters).map(Number).sort((a, b) => a - b)
      : [];
    const totalChapters = progress?.totalChapters || availableChapters.length;

    const chapterNum = parseInt(chapter);
    const pageNum = parseInt(page);

    // Check if chapter is available
    if (!levelContent?.chapters?.[chapterNum]) {
      // Chapter not available yet
      return {
        storySlug: story.slug,
        storyId: story.id,
        title: story.title,
        titleEs: story.titleEs,
        titleEn: story.titleEn,
        level: levelContent?.level || 0,
        chapter: chapterNum,
        page: pageNum,
        hasChapters: levelContent?.hasChapters ?? (totalChapters > 1),
        lines: [],
        isUserStory: true,
        storyType: story.storyType,
        detectedLevel: story.detectedLevel,
        structureType: inferStructureType(story.storyType, levelContent || undefined),
        isProcessing,
        chapterPending: true,
        availableChapters,
        totalChapters,
      };
    }

    const pageData = levelContent.chapters[chapterNum]?.pages?.[pageNum];

    if (!pageData) {
      // Page not found in this chapter
      return null;
    }

    // Handle both flat lines and nested stanzas (for poems)
    const hasStanzas = !!pageData.stanzas && pageData.stanzas.length > 0;
    const hasLines = !!pageData.lines && pageData.lines.length > 0;

    // Flatten stanzas to lines for backwards compatibility with page component
    let lines: StoryLine[] = [];
    if (hasStanzas) {
      lines = pageData.stanzas!.flatMap((stanza, stanzaIdx) =>
        stanza.map((line, lineIdx) => ({
          ...line,
          stanzaNumber: line.stanzaNumber ?? (stanzaIdx + 1),
          isStanzaBreak: lineIdx === stanza.length - 1 && stanzaIdx < pageData.stanzas!.length - 1,
        }))
      );
    } else if (hasLines) {
      lines = pageData.lines!;
    }

    const structureType = inferStructureType(story.storyType, levelContent);

    // Check if this chapter has alignment issues
    const chapterContent = levelContent.chapters[chapterNum];
    let chapterHasAlignmentIssues = (chapterContent as any)?.alignmentIssues?.hasIssues || false;

    // For content processed before alignment detection was added, detect on-the-fly
    if ((chapterContent as any)?.alignmentIssues === undefined) {
      const srcLang = story.sourceLanguage === "es" ? "es" : "en";
      const tgtLang = srcLang === "en" ? "es" : "en";
      const srcLines: string[] = [];
      const tgtLines: string[] = [];
      const pKeys = Object.keys(chapterContent.pages).map(Number).sort((a, b) => a - b);
      for (const pk of pKeys) {
        const pg = chapterContent.pages[pk];
        if (!pg) continue;
        const pgLines = (pg.stanzas && pg.stanzas.length > 0)
          ? pg.stanzas.flat()
          : (pg.lines || []);
        for (const ln of pgLines) {
          srcLines.push((ln as any)[srcLang] ?? "");
          tgtLines.push((ln as any)[tgtLang] ?? "");
        }
      }
      const result = detectAlignmentIssues(srcLines, tgtLines);
      chapterHasAlignmentIssues = result.hasIssues;
    }

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
      isProcessing,
      availableChapters,
      totalChapters,
      chapterHasAlignmentIssues,
    };
  } catch (err) {
    console.error(`Failed to load user story content:`, err);
    return null;
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

    // Allow reading during PROCESSING (content is built incrementally) or when READY
    if (!levelData || (levelData.status !== "READY" && levelData.status !== "PROCESSING")) {
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
