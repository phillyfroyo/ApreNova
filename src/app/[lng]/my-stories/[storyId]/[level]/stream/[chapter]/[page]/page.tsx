// src/app/[lng]/my-stories/[storyId]/[level]/stream/[chapter]/[page]/page.tsx
// Streaming reader route for in-progress stories
// Allows reading while story is still being processed

export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import StreamingStoryReader from "@/components/user-stories/StreamingStoryReader";
import type { Language } from "@/types/i18n";
import type { CEFRCode } from "@/lib/cefr";

interface PageParams {
  lng: string;
  storyId: string;
  level: string;
  chapter: string;
  page: string;
}

export default async function StreamingReaderPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { lng, storyId, level, chapter, page } = await params;

  console.log(`[StreamingReaderPage] Rendering: storyId=${storyId}, level=${level}, chapter=${chapter}, page=${page}`);

  if (lng !== "en" && lng !== "es") {
    console.log(`[StreamingReaderPage] Invalid language: ${lng}`);
    return notFound();
  }

  const session = await getServerSession(authOptions);

  // Require authentication for user stories
  if (!session?.user?.id) {
    console.log(`[StreamingReaderPage] No session, redirecting to login`);
    redirect(`/${lng}/auth/login`);
  }

  // Fetch story to verify access and check status
  const story = await prisma.userStory.findFirst({
    where: {
      id: storyId,
      OR: [
        { userId: session.user.id },
        { visibility: "PUBLIC" },
      ],
    },
    select: {
      id: true,
      status: true,
      UserStoryLevel: {
        where: { level },
        select: {
          level: true,
          status: true,
        },
      },
    },
  });

  if (!story) {
    console.log(`[StreamingReaderPage] Story not found`);
    return notFound();
  }

  const levelData = story.UserStoryLevel[0];

  // If level is READY, redirect to normal reader
  if (levelData?.status === "READY") {
    console.log(`[StreamingReaderPage] Level is READY, redirecting to normal reader`);
    redirect(`/${lng}/my-stories/${storyId}/${level}/${chapter}/${page}`);
  }

  // Get available levels (ready ones only for level switcher)
  const allLevels = await prisma.userStoryLevel.findMany({
    where: {
      userStoryId: storyId,
      status: "READY",
    },
    select: { level: true },
  });

  const availableLevels = allLevels.map(l => l.level as CEFRCode);

  // If level is not processing (PENDING or FAILED), show not found
  // Note: READY case is handled above with redirect
  if (levelData?.status !== "PROCESSING") {
    console.log(`[StreamingReaderPage] Level not available: status=${levelData?.status}`);
    return notFound();
  }

  return (
    <StreamingStoryReader
      storyId={storyId}
      level={level}
      initialChapter={parseInt(chapter)}
      initialPage={parseInt(page)}
      lng={lng as Language}
      availableLevels={availableLevels}
    />
  );
}
