// src/app/[lng]/my-stories/[storyId]/[level]/[chapter]/[page]/page.tsx
// Unified reader page for user stories
// Handles both complete content and in-progress stories with pending chapters

export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import UserStoryReader from "@/components/user-stories/UserStoryReader";
import type { Language } from "@/types/i18n";
import {
  getUserStoryContent,
  getUserStoryMap,
  getUserStoryAvailableLevels,
} from "@/lib/user-stories/getUserStoryContent";

interface PageParams {
  lng: string;
  storyId: string;
  level: string;
  chapter: string;
  page: string;
}

export default async function UserStoryReaderPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { lng, storyId, level, chapter, page } = await params;

  console.log(`[UserStoryReaderPage] Rendering: storyId=${storyId}, level=${level}, chapter=${chapter}, page=${page}`);

  if (lng !== "en" && lng !== "es") {
    console.log(`[UserStoryReaderPage] Invalid language: ${lng}`);
    return notFound();
  }

  const session = await getServerSession(authOptions);

  // Require authentication for user stories
  if (!session?.user?.id) {
    console.log(`[UserStoryReaderPage] No session, redirecting to login`);
    redirect(`/${lng}/auth/login`);
  }

  console.log(`[UserStoryReaderPage] Session OK, fetching content...`);

  // Get story map for navigation
  const storyMap = await getUserStoryMap(storyId, session.user.id, level);

  // Get available levels for this story
  const availableLevels = await getUserStoryAvailableLevels(storyId, session.user.id);

  // Get story content
  const story = await getUserStoryContent(
    storyId,
    session.user.id,
    level,
    chapter,
    page,
    lng as Language
  );

  // Story not found at all
  if (!story) {
    console.log(`[UserStoryReaderPage] Story not found`);
    return notFound();
  }

  const hasLines = story.lines && story.lines.length > 0;
  const hasStanzas = story.stanzas && story.stanzas.length > 0;
  const isPending = story.chapterPending || story.levelPending;

  console.log(`[UserStoryReaderPage] Story result: hasLines=${hasLines}, hasStanzas=${hasStanzas}, isPending=${isPending}, isProcessing=${story.isProcessing}`);

  // If not pending and no content, return 404
  if (!isPending && !hasLines && !hasStanzas) {
    console.log(`[UserStoryReaderPage] No content and not pending, returning notFound`);
    return notFound();
  }

  // Determine title based on language
  const title =
    lng === "es"
      ? story.titleEs || story.title
      : story.titleEn || story.title;

  return (
    <UserStoryReader
      storyId={storyId}
      storySlug={story.storySlug}
      title={title || "My Story"}
      lines={story.lines}
      stanzas={story.stanzas}
      level={level}
      chapter={parseInt(chapter)}
      page={parseInt(page)}
      storyMap={storyMap}
      availableLevels={availableLevels}
      storyType={story.storyType}
      detectedLevel={story.detectedLevel}
      structureType={story.structureType}
      lng={lng as Language}
      chapterHasAlignmentIssues={story.chapterHasAlignmentIssues}
      isProcessing={story.isProcessing}
      chapterPending={story.chapterPending}
      levelPending={story.levelPending}
      availableChapters={story.availableChapters}
      totalChapters={story.totalChapters}
    />
  );
}
