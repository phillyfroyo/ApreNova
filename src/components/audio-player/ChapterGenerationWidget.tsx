// src/components/audio-player/ChapterGenerationWidget.tsx
// Floating widget shown during chapter audio generation. Sibling to AudioPlayerBar
// (mounted at the root layout level) so it persists across navigation independently
// of the bottom player bar. The bar only appears once playback actually starts.
"use client";

import { useAudioPlayer } from "@/contexts/audio-player";
import { useParams } from "next/navigation";
import { STORY_METADATA } from "@/lib/stories";
import type { Language } from "@/types/i18n";
import ChapterLoadingOverlay from "./ChapterLoadingOverlay";

export default function ChapterGenerationWidget() {
  const { state, resumePlayback, stopPlayback } = useAudioPlayer();
  const params = useParams();
  const lng = (params?.lng as Language) ?? "es";

  if (!state.isGeneratingWidgetVisible || !state.position) return null;

  const { position, status } = state;
  const storyMeta = STORY_METADATA.find(s => s.slug === position.storySlug);

  // Render in generating, ready, error, or labelled-loading states.
  // Other states (playing/paused/finished/idle/navigating) should not show the widget.
  const showStates = new Set(["generating", "ready", "error"]);
  const showLabelledLoading = status === "loading" && state.generationLabel;
  if (!showStates.has(status) && !showLabelledLoading) return null;

  return (
    <ChapterLoadingOverlay
      chapterNumber={position.chapter}
      progress={state.chapterGenerationProgress}
      storyType={storyMeta?.type}
      isReady={status === "ready"}
      isError={status === "error"}
      lng={lng}
      onStartListening={resumePlayback}
      onCancel={stopPlayback}
      label={state.generationLabel}
      navTarget={{
        storySlug: position.storySlug,
        level: position.level,
        chapter: position.chapter,
        page: position.page,
        isUserStory: position.isUserStory,
        userStoryId: position.userStoryId,
      }}
    />
  );
}
