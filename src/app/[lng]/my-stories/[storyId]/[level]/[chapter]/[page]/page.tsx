// src/app/[lng]/my-stories/[storyId]/[level]/[chapter]/[page]/page.tsx

export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import StoryLayoutWithAzureTTS from "@/components/StoryLayoutWithAzureTTS";
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

  const hasLines = story?.lines && story.lines.length > 0;
  const hasStanzas = story?.stanzas && story.stanzas.length > 0;
  console.log(`[UserStoryReaderPage] Story result: hasStory=${!!story}, hasLines=${hasLines}, hasStanzas=${hasStanzas}, linesCount=${story?.lines?.length}`);

  if (!story || (!hasLines && !hasStanzas)) {
    console.log(`[UserStoryReaderPage] No story content, returning notFound`);
    return notFound();
  }

  // Determine title based on language
  const title =
    lng === "es"
      ? story.titleEs || story.title
      : story.titleEn || story.title;

  return (
    <StoryLayoutWithAzureTTS
      title={title || "My Story"}
      storySlug={story.storySlug}
      sentences={story.lines}
      stanzas={story.stanzas}
      initialLevel={level}
      storyMap={storyMap}
      isUserStory={true}
      userStoryId={storyId}
      availableLevels={availableLevels}
      storyType={story.storyType}
    />
  );
}
