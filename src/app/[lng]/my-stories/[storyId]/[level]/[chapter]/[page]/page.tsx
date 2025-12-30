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

  if (lng !== "en" && lng !== "es") return notFound();

  const session = await getServerSession(authOptions);

  // Require authentication for user stories
  if (!session?.user?.id) {
    redirect(`/${lng}/auth/login`);
  }

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

  if (!story || !story.lines || story.lines.length === 0) {
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
      initialLevel={level}
      storyMap={storyMap}
      isUserStory={true}
      userStoryId={storyId}
      availableLevels={availableLevels}
    />
  );
}
