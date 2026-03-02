// src/utils/storyNavigation.ts
// Shared story navigation utilities used by both StoryLayoutWithAzureTTS and AudioPlayerContext

import type { Language } from "@/types/i18n";

export interface StoryMapForNav {
  hasChapters: boolean;
  chapters: { chapter: number; pages: number[]; title?: string; subtitle?: string }[];
}

/**
 * Given a current chapter and page, returns the previous and next page
 * across the entire story (flattened across chapters).
 */
export function getPrevNextPage(
  currentChapter: number,
  currentPage: number,
  storyMap: StoryMapForNav
): {
  prev: { ch: number; pg: number } | null;
  next: { ch: number; pg: number } | null;
} {
  const flatPages: { ch: number; pg: number }[] = [];

  for (const ch of storyMap.chapters) {
    for (const pg of ch.pages) {
      flatPages.push({ ch: ch.chapter, pg });
    }
  }

  const index = flatPages.findIndex(
    (p) => p.ch === currentChapter && p.pg === currentPage
  );

  return {
    prev: index > 0 ? flatPages[index - 1] : null,
    next: index >= 0 && index < flatPages.length - 1 ? flatPages[index + 1] : null,
  };
}

/**
 * Generate a navigation URL for a given story page.
 */
export function getNavigationUrl(
  lang: Language,
  storySlug: string,
  level: string,
  chapter: number,
  page: number,
  isUserStory: boolean,
  userStoryId?: string
): string {
  if (isUserStory && userStoryId) {
    return `/${lang}/my-stories/${userStoryId}/${level}/${chapter}/${page}`;
  }
  return `/${lang}/stories/${storySlug}/${level}/ch${chapter}/page-${page}`;
}

/**
 * Get total page count across the story.
 */
export function getTotalPages(storyMap: StoryMapForNav): number {
  let total = 0;
  for (const ch of storyMap.chapters) {
    total += ch.pages.length;
  }
  return total;
}

/**
 * Get flat index of a page within the story (0-based).
 */
export function getPageIndex(
  chapter: number,
  page: number,
  storyMap: StoryMapForNav
): number {
  let index = 0;
  for (const ch of storyMap.chapters) {
    for (const pg of ch.pages) {
      if (ch.chapter === chapter && pg === page) return index;
      index++;
    }
  }
  return -1;
}
