// src/app/[lng]/my-stories/[storyId]/[level]/stream/[chapter]/[page]/page.tsx
// DEPRECATED: Streaming reader page
// Now redirects to the unified reader page which handles both complete and in-progress stories

import { redirect } from "next/navigation";

interface PageParams {
  lng: string;
  storyId: string;
  level: string;
  chapter: string;
  page: string;
}

export default async function StreamingReaderPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { lng, storyId, level, chapter, page } = await params;

  // Redirect to the unified reader page
  redirect(`/${lng}/my-stories/${storyId}/${level}/${chapter}/${page}`);
}
