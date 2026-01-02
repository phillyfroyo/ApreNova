// src/lib/user-stories/getUserStoryContent.ts

import { prisma } from "@/lib/prisma";
import type { Language } from "@/types/i18n";
import type { CEFRCode } from "@/lib/cefr";

interface StoryLine {
  es: string;
  en: string;
}

interface ChapterMetadata {
  number: number;
  title: string;
  subtitle?: string;
}

interface LevelContent {
  storySlug: string;
  level: number;
  hasChapters: boolean;
  chapters: Record<
    number,
    {
      pages: Record<
        number,
        {
          lines: StoryLine[];
        }
      >;
      metadata?: ChapterMetadata; // Optional for backward compatibility
    }
  >;
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
    // Fetch the story and verify ownership or public visibility
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
      throw new Error("Level content not ready");
    }

    const levelContent = levelData.content as unknown as LevelContent;

    const chapterNum = parseInt(chapter);
    const pageNum = parseInt(page);

    const pageData = levelContent.chapters?.[chapterNum]?.pages?.[pageNum];

    if (pageData) {
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
        lines: pageData.lines,
        isUserStory: true,
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
    };
  }
}

/**
 * Get story structure (chapters and pages) for a user story
 * Now includes chapter titles for display in UI navigation
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
  }[];
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
        };
      }
    );

    return {
      hasChapters: levelContent.hasChapters,
      chapters: chapters.sort((a, b) => a.chapter - b.chapter),
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
