// src/components/story-reader/ListenButton.tsx
"use client";

import { Headphones, Loader2 } from "lucide-react";
import { t } from "@/lib/t";
import BilingualReaderButton from "./BilingualReaderButton";
import type { Language } from "@/types/i18n";
import type { StoryLine } from "@/lib/story-processing/text-processing";
import type { StoryMapType } from "@/contexts/StoryReaderContext";

interface ListenButtonProps {
  typedLang: Language;
  session: any;
  sessionStatus?: "loading" | "authenticated" | "unauthenticated";
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
  sessionStatus,
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

  const isSessionLoading = sessionStatus === "loading";
  // Single-active-generation: while any chapter is being generated, disable Listen on
  // other chapters. The user must let the current one finish or cancel it.
  const generationActive = audioPlayer.isGeneratingActive;
  const generationPos = audioPlayer.state.position;
  const generatingThisChapter = generationActive
    && generationPos?.storySlug === storySlug
    && generationPos?.level === currentLevel
    && generationPos?.chapter === chapterNumber;
  const generatingElsewhere = generationActive && !generatingThisChapter;

  return (
    <div className="flex items-center justify-end gap-3 pr-4">
      <BilingualReaderButton typedLang={typedLang} />
      {isListening ? (
        <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-full border border-indigo-200">
          <Headphones className="w-4 h-4" />
          {t(typedLang, "audioPlayer", "listening")}
        </span>
      ) : generatingThisChapter ? (
        <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-full border border-indigo-200">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t(typedLang, "audioPlayer", "preparing")}
        </span>
      ) : (
        <button
          data-tour-listen-button="true"
          disabled={isSessionLoading || generatingElsewhere}
          title={generatingElsewhere ? t(typedLang, "audioPlayer", "generationInFlightElsewhere") : undefined}
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
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${
            isSessionLoading || generatingElsewhere
              ? "text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed"
              : "text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border-indigo-200"
          }`}
        >
          {isSessionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Headphones className="w-4 h-4" />}
          {t(typedLang, "audioPlayer", "listen")}
        </button>
      )}
      <span className="text-sm text-gray-600">{currentPagePosition}</span>
    </div>
  );
}
