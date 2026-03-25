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
  | "navigating"
  | "error"
  | "finished";

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

export interface VoiceSelection {
  'en-US': string;
  'es-ES': string;
}

export interface AudioPlayerState {
  status: AudioPlayerStatus;
  position: AudioPlayerPosition | null;
  mode: AudioLanguageMode;
  currentPageSentences: StoryLine[];
  storyMap: StoryMapForNav | null;
  isVisible: boolean;
  highlightedSentenceIndex: number | null;
  error: string | null;
  voiceSelection: VoiceSelection;
  playbackRate: number;
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
  setVoice: (language: 'en-US' | 'es-ES', voiceId: string) => void;
  setPlaybackRate: (rate: number) => void;
}

// ============================================================================
// Constants
// ============================================================================

export const AVAILABLE_VOICES: Record<'en-US' | 'es-ES', { id: string; label: string }[]> = {
  'en-US': [
    { id: 'en-US-BrianMultilingualNeural', label: 'Brian' },
    { id: 'en-US-AvaMultilingualNeural', label: 'Ava' },
  ],
  'es-ES': [
    { id: 'en-US-BrianMultilingualNeural', label: 'Brian' },
    { id: 'en-US-AvaMultilingualNeural', label: 'Ava' },
  ],
};

export const AVAILABLE_SPEEDS = [0.7, 1.0];

export const DEFAULT_VOICES: VoiceSelection = {
  'en-US': 'en-US-BrianMultilingualNeural',
  'es-ES': 'en-US-BrianMultilingualNeural',
};

export const DEFAULT_PLAYBACK_RATE = 1.0;
