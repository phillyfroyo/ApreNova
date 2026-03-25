// src/contexts/audio-player/types.ts
import type { StoryMapForNav } from "@/utils/storyNavigation";
import type { StoryLine } from "@/lib/story-processing/text-processing";

// ============================================================================
// Types
// ============================================================================

export type AudioPlayerStatus =
  | "idle"
  | "playing"
  | "paused"
  | "loading"
  | "generating"
  | "navigating"
  | "error"
  | "finished";

export type PlaybackMode = "chapter" | "legacy";

export type AudioLanguageMode = "target-only" | "bilingual";

export interface AudioPlayerPosition {
  storySlug: string;
  storyTitle: string;
  level: string;
  chapter: number;
  page: number;
  sentenceIndex: number;
  currentLanguage: "target" | "native";
  isUserStory: boolean;
  userStoryId?: string;
}

export interface AudioPlayerState {
  status: AudioPlayerStatus;
  position: AudioPlayerPosition | null;
  mode: AudioLanguageMode;
  playbackMode: PlaybackMode;
  currentPageSentences: StoryLine[];
  storyMap: StoryMapForNav | null;
  isVisible: boolean;
  highlightedSentenceIndex: number | null;
  error: string | null;
  playbackRate: number;
  // Chapter mode fields
  chapterCurrentTime: number;
  chapterDuration: number;
  chapterGenerationProgress: { sentencesComplete: number; sentencesTotal: number } | null;
}

export interface StartPlaybackOptions {
  storySlug: string;
  storyTitle: string;
  level: string;
  chapter: number;
  page: number;
  sentenceIndex?: number;
  isUserStory: boolean;
  userStoryId?: string;
  storyMap: StoryMapForNav;
  sentences: StoryLine[];
}

export interface AudioPlayerContextType {
  state: AudioPlayerState;
  startContinuousPlayback: (options: StartPlaybackOptions) => void;
  pausePlayback: () => void;
  resumePlayback: () => void;
  stopPlayback: () => void;
  toggleMode: () => void;
  registerPageContent: (sentences: StoryLine[], chapter: number, page: number) => void;
  skipForward: () => void;
  skipBack: () => void;
  nextPage: () => void;
  prevPage: () => void;
  isPlaying: boolean;
  setPlaybackRate: (rate: number) => void;
  seekToTime: (time: number) => void;
}

// ============================================================================
// Constants
// ============================================================================

export const AVAILABLE_SPEEDS = [0.7, 1.0];

export const DEFAULT_PLAYBACK_RATE = 1.0;
