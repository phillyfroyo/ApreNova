// src/app/[lng]/stories/[storySlug]/[level]/[chapter]/[page]/page.tsx

export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import { getStoryContent } from "@/lib/getStoryContent";
import { STORY_METADATA, getStoryTitle } from "@/lib/stories";
import StoryLayoutWithAzureTTS from "@/components/StoryLayoutWithAzureTTS";
import type { Language } from "@/types/i18n";
import { getStoryMap } from "@/lib/getStoryMap";
import LevelUnavailablePage from "@/components/LevelUnavailablePage";
import { toCEFR, toFolderName, type CEFRCode } from "@/lib/cefr";

export default async function Page({ params }: { params: Promise<{ lng: string; storySlug: string; level: string; chapter: string; page: string }> }) {
  const { lng, storySlug, level, chapter, page } = await params;

  if (lng !== "en" && lng !== "es") return notFound();

  // Find the story metadata to check available levels
  const storyMeta = STORY_METADATA.find(s => s.slug === storySlug);
  if (!storyMeta) return notFound();

  // Convert URL level to CEFR code (handles both A1 and l1 formats)
  const cefrLevel = toCEFR(level);
  const isLevelAvailable = storyMeta.levels.includes(cefrLevel as CEFRCode);

  // If level not available, show level selector page
  if (!isLevelAvailable) {
    return (
      <LevelUnavailablePage
        storySlug={storySlug}
        storyTitle={getStoryTitle(lng as Language, storySlug)}
        availableLevels={storyMeta.levels}
        requestedLevel={cefrLevel}
        lng={lng as Language}
      />
    );
  }

  const session = await getServerSession(authOptions);

  // Convert CEFR to folder name for content loading (l1, l2, etc.)
  const folderLevel = toFolderName(cefrLevel);
  const storyMap = await getStoryMap(storySlug, folderLevel);

  // Handle both formats: numeric (1) and prefixed (ch1, page-1)
  const fullChapter = chapter.startsWith('ch') ? chapter : `ch${chapter}`;
  const fullPage = page.startsWith('page-') ? page : `page-${page}`;

  const story = await getStoryContent(storySlug, folderLevel, fullChapter, fullPage, lng);

  if (!story || !story.lines) return notFound();

  return (
    <StoryLayoutWithAzureTTS
      title={getStoryTitle(lng, storySlug)}
      storySlug={storySlug}
      sentences={story.lines}
      stanzas={story.stanzas}
      initialLevel={cefrLevel}
      storyMap={storyMap}
      availableLevels={storyMeta.levels}
      storyType={storyMeta.type}
      structureType={storyMeta.structureType}
      detectedLevel={storyMeta.originalLevel}
    />
  );
}







