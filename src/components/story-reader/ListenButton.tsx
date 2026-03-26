// src/components/story-reader/ListenButton.tsx
"use client";

import { Headphones } from "lucide-react";
import { t } from "@/lib/t";
import type { Language } from "@/types/i18n";
import type { StoryLine } from "@/lib/story-processing/text-processing";
import type { StoryMapType } from "@/contexts/StoryReaderContext";

interface ListenButtonProps {
  typedLang: Language;
  session: any;
  audioPlayer: any;
  storySlug: string;
  title: string;
  currentLevel: string;
  chapterNumber: number;
  pageNumber: number;
  sentences: StoryLine[];
  storyMap: StoryMapType;
  isUserStory: boolean;
  userStoryId?: string;
  currentPagePosition: number;
  setMenuOpen: (val: boolean) => void;
  setTtsAuthError: (val: boolean) => void;
  stop: () => void;
  setActiveAudio: (val: null) => void;
}

export default function ListenButton({
  typedLang,
  session,
  audioPlayer,
  storySlug,
  title,
  currentLevel,
  chapterNumber,
  pageNumber,
  sentences,
  storyMap,
  isUserStory,
  userStoryId,
  currentPagePosition,
  setMenuOpen,
  setTtsAuthError,
  stop,
  setActiveAudio,
}: ListenButtonProps) {
  const isListening =
    audioPlayer.isPlaying ||
    audioPlayer.state.status === "navigating" ||
    audioPlayer.state.status === "paused" ||
    audioPlayer.state.status === "loading";

  return (
    <div className="flex items-center justify-end gap-3 pr-4">
      {isListening ? (
        <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-full border border-indigo-200">
          <Headphones className="w-4 h-4" />
          {t(typedLang, "audioPlayer", "listening")}
        </span>
      ) : (
        <button
          onClick={() => {
            setMenuOpen(false);
            if (!session?.user) {
              setTtsAuthError(true);
              return;
            }
            stop();
            setActiveAudio(null);
            audioPlayer.startContinuousPlayback({
              storySlug,
              storyTitle: title,
              level: currentLevel,
              chapter: chapterNumber,
              page: pageNumber,
              sentences,
              storyMap,
              isUserStory,
              userStoryId,
            });
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-full border border-indigo-200 transition-colors"
        >
          <Headphones className="w-4 h-4" />
          {t(typedLang, "audioPlayer", "listen")}
        </button>
      )}
      <span className="text-sm text-gray-600">{currentPagePosition}</span>
    </div>
  );
}
