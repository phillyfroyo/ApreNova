// C:\Users\phili\Dev\my-aprenova\src\app\es\stories\[storySlug]\[level]\[part]\page.tsx
import { getStoryContent } from "@/lib/getStoryContent";
import StoryLayout from "@/components/StoryLayout";
import { STORY_METADATA } from "@/lib/stories";

type RouteParams = { storySlug: string; level: string; part: string };
export default async function Page({ params }: { params: RouteParams }) {
  const { storySlug, level, part } = await Promise.resolve(params);

  console.log("📦 Dynamic route loaded with:", { storySlug, level, part });

  const lang = "es";

  if (!storySlug || !level || !part) {
    throw new Error("Missing dynamic route parameters.");
  }

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


