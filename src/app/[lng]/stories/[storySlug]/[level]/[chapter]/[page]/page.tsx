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

export default async function Page({ params }: { params: Promise<{ lng: string; storySlug: string; level: string; chapter: string; page: string }> }) {
  const { lng, storySlug, level, chapter, page } = await params;

  if (lng !== "en" && lng !== "es") return notFound();

  const session = await getServerSession(authOptions);
  const storyMap = await getStoryMap(storySlug, level);
  
  // Handle both formats: numeric (1) and prefixed (ch1, page-1)
  const fullChapter = chapter.startsWith('ch') ? chapter : `ch${chapter}`;
  const fullPage = page.startsWith('page-') ? page : `page-${page}`;
  
const story = await getStoryContent(storySlug, level, fullChapter, fullPage, lng);

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







