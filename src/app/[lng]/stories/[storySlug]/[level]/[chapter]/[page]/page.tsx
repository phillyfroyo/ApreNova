// src/app/[lng]/stories/[storySlug]/[level]/[chapter]/[page]/page.tsx

export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import { getStoryContent } from "@/lib/getStoryContent";
import { STORY_METADATA, getStoryTitle, toLLevel } from "@/lib/stories";
import StoryLayoutWithAzureTTS from "@/components/StoryLayoutWithAzureTTS";
import type { Language } from "@/types/i18n";
import { getStoryMap } from "@/lib/getStoryMap";
import LevelUnavailablePage from "@/components/LevelUnavailablePage";

export default async function Page({ params }: { params: Promise<{ lng: string; storySlug: string; level: string; chapter: string; page: string }> }) {
  const { lng, storySlug, level, chapter, page } = await params;

  if (lng !== "en" && lng !== "es") return notFound();

  // Find the story metadata to check available levels
  const storyMeta = STORY_METADATA.find(s => s.slug === storySlug);
  if (!storyMeta) return notFound();

  // Convert CEFR level from URL (A1, A2, B1, B2, C1) to L-level (l1, l2, l3, l4, l5) for content loading
  const lLevel = toLLevel(level);

  // Check if requested level is available for this story
  const isLevelAvailable = storyMeta.levels.includes(lLevel as any);

  // If level not available, show level selector page
  if (!isLevelAvailable) {
    return (
      <LevelUnavailablePage
        storySlug={storySlug}
        storyTitle={getStoryTitle(lng as Language, storySlug)}
        availableLevels={storyMeta.levels}
        requestedLevel={lLevel}
        lng={lng as Language}
      />
    );
  }

  const session = await getServerSession(authOptions);
  const storyMap = await getStoryMap(storySlug, lLevel);

  // Handle both formats: numeric (1) and prefixed (ch1, page-1)
  const fullChapter = chapter.startsWith('ch') ? chapter : `ch${chapter}`;
  const fullPage = page.startsWith('page-') ? page : `page-${page}`;

  const story = await getStoryContent(storySlug, lLevel, fullChapter, fullPage, lng);

  if (!story || !story.lines) return notFound();

  return (
    <StoryLayoutWithAzureTTS
      title={getStoryTitle(lng, storySlug)}
      storySlug={storySlug}
      sentences={story.lines}
      initialLevel={level}
      storyMap={storyMap}
    />
  );
}







