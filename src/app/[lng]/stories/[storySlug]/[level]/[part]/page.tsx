// src/app/[lng]/stories/[storySlug]/[level]/[part]/page.tsx
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import { getStoryContent } from "@/lib/getStoryContent";
import { STORY_METADATA } from "@/lib/stories";
import StoryLayout from "@/components/StoryLayout";
import type { Language } from "@/types/i18n";
import { getStoryTitle } from '@/lib/stories'; 

export default async function Page(props: any) {
  const { lng, storySlug, level, part } = props?.params ?? {};

  if (lng !== "es" && lng !== "en") return notFound();
  const typedLang = lng as Language;

  if (!storySlug || !level || !part) {
    throw new Error("Missing dynamic route parameters.");
  }

  console.log("📦 Dynamic route loaded with:", { lng, storySlug, level, part });

  // ✅ Load session if needed (auth, tracking, etc.)
  const session = await getServerSession(authOptions);

  // ✅ Load content
  const lines = await getStoryContent(storySlug, level, part, typedLang);
  if (!lines) return notFound();

  const metadata = STORY_METADATA.find((s) => s.slug === storySlug);

  return (
    <StoryLayout
      title={getStoryTitle(lng, storySlug)}
      storySlug={storySlug}
      sentences={lines}
      initialLevel={level}
    />
  );
}




