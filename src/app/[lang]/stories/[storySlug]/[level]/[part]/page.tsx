// src/app/[lang]/stories/[storySlug]/[level]/[part]/page.tsx
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import { getStoryContent } from "@/lib/getStoryContent";
import { STORY_METADATA } from "@/lib/stories";
import StoryLayout from "@/components/StoryLayout";
import type { Language } from "@/types/i18n";

export default async function Page({
  params,
}: {
  params: { lang: string; storySlug: string; level: string; part: string };
}) {
  const { lang, storySlug, level, part } = params;

  // ✅ Guard + narrow
  if (lang !== "es" && lang !== "en") return notFound();
  const typedLang = lang as Language;

  // ✅ Guard against missing params (super rare unless route is malformed)
  if (!storySlug || !level || !part) {
    throw new Error("Missing dynamic route parameters.");
  }

  console.log("📦 Dynamic route loaded with:", { lang, storySlug, level, part });

  // ✅ Load session if needed (auth, tracking, etc.)
  const session = await getServerSession(authOptions);

  // ✅ Load content
  const lines = await getStoryContent(storySlug, level, part, typedLang);
  if (!lines) return notFound();

  const metadata = STORY_METADATA.find((s) => s.slug === storySlug);

  return (
    <StoryLayout
      title={metadata?.title ?? "Untitled"}
      storySlug={storySlug}
      sentences={lines}
      initialLevel={level}
    />
  );
}




