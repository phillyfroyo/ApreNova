// src/app/[lng]/stories/[storySlug]/[level]/[chapter]/[page]/page.tsx

export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import { getStoryContent } from "@/lib/getStoryContent";
import { STORY_METADATA, getStoryTitle } from "@/lib/stories";
import StoryLayout from "@/components/StoryLayout";
import type { Language } from "@/types/i18n";
import { getStoryMap } from "@/lib/getStoryMap";

export default async function Page({ params }: any) {
  const lng = params.lng as Language;
  const storySlug = params.storySlug;
  const level = params.level;
  const chapter = params.chapter;
  const page = params.page;

  if (lng !== "en" && lng !== "es") return notFound();

  const session = await getServerSession(authOptions);
  const storyMap = await getStoryMap(storySlug, level);
  const fullChapter = `ch${chapter}`;
  const fullPage = `page-${page}`;
const story = await getStoryContent(storySlug, level, fullChapter, fullPage, lng);

if (!story || !story.lines) return notFound();


  return (
    <StoryLayout
      title={getStoryTitle(lng, storySlug)}
      storySlug={storySlug}
      sentences={story.lines}
      initialLevel={level}
      storyMap={storyMap}
    />
  );
}







