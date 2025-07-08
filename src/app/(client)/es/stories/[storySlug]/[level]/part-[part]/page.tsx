// /src/app/(client)/es/stories/[storySlug]/[level]/part-[part]/page.tsx
import { getStoryContent } from "@/lib/getStoryContent";
import StoryLayout from "@/components/StoryLayout";
import { STORY_METADATA } from "@/lib/stories";

export default async function Page({
  params: { storySlug, level, part },
}: {
  params: { storySlug: string; level: string; part: string };
}) {
  const lang = "es"; // TODO: dynamic later
  const lines = await getStoryContent(storySlug, level, part, lang);

  const metadata = STORY_METADATA.find((s) => s.slug === storySlug);

  return (
    <StoryLayout
      title={metadata?.title ?? "Untitled"}
      storySlug={storySlug}
      sentences={lines}
      initialLevel="l2"
    />
  );
}

