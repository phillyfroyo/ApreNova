// src/app/[lng]/stories/[storySlug]/[level]/[part]/page.tsx
import { type Metadata } from "next";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import { getStoryContent } from "@/lib/getStoryContent";
import { STORY_METADATA } from "@/lib/stories";
import StoryLayout from "@/components/StoryLayout";
import type { Language } from "@/types/i18n";
import { getStoryTitle } from "@/lib/stories";

type Props = {
  params: {
    lng: Language;
    storySlug: string;
    level: string;
    part: string;
  };
};

export const dynamic = "force-dynamic";

export default async function Page({ params }: Props) {
  const { lng, storySlug, level, part } = params;

  if (lng !== "en" && lng !== "es") return notFound();
  const typedLang = lng;

  if (!storySlug || !level || !part) {
    throw new Error("Missing dynamic route parameters.");
  }

  console.log("📦 Dynamic route loaded with:", { lng, storySlug, level, part });

  const session = await getServerSession(authOptions);

  const cleanPart = part.replace(/^part-/, "");
  const lines = await getStoryContent(storySlug, level, cleanPart, typedLang);
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






