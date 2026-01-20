// src/app/[lng]/my-stories/[storyId]/[level]/stream/[chapter]/[page]/loading.tsx
// Loading skeleton for the streaming story reader page - shown during navigation

import StoryLoadingSkeleton from "@/components/StoryLoadingSkeleton";

export default function StreamingStoryReaderLoading() {
  return <StoryLoadingSkeleton />;
}
