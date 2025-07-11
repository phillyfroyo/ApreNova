// src/app/[lng]/stories/[storySlug]/[level]/[part]/page.tsx
export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import { getStoryContent } from "@/lib/getStoryContent";
import { STORY_METADATA, getStoryTitle } from "@/lib/stories";
import StoryLayout from "@/components/StoryLayout";
import type { Language } from "@/types/i18n";

// ✅ No type annotation — let Next.js handle it internally
export default async function Page({ params }: any) {
  const lng = params.lng as Language;
  const storySlug = params.storySlug;
  const level = params.level;
  const part = params.part;

  if (lng !== "en" && lng !== "es") return notFound();
  const typedLang = lng;

  const session = await getServerSession(authOptions);
  const cleanPart = part.replace(/^part-/, "");
  const lines = await getStoryContent(storySlug, level, cleanPart, typedLang);
  if (!lines) return notFound();

  return (
    <StoryLayout
      title={getStoryTitle(lng, storySlug)}
      storySlug={storySlug}
      sentences={lines}
      initialLevel={level}
    />
  );
}







