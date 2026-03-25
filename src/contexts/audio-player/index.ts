// src/contexts/audio-player/index.ts
export { AudioPlayerProvider, useAudioPlayer } from "./AudioPlayerProvider";
export { getContentSentences } from "./helpers";
export { AVAILABLE_SPEEDS, DEFAULT_PLAYBACK_RATE } from "./types";
export type {
  AudioPlayerStatus,
  AudioLanguageMode,
  AudioPlayerPosition,
  PlaybackMode,
  AudioPlayerState,
  StartPlaybackOptions,
  AudioPlayerContextType,
} from "./types";
