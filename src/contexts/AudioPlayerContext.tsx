// src/contexts/AudioPlayerContext.tsx
// Re-exports from refactored audio-player modules for backward compatibility.
export { AudioPlayerProvider, useAudioPlayer, getContentSentences } from "./audio-player";
export { AVAILABLE_SPEEDS, DEFAULT_PLAYBACK_RATE } from "./audio-player";
export type {
  AudioPlayerStatus,
  AudioLanguageMode,
  AudioPlayerPosition,
  AudioPlayerState,
  StartPlaybackOptions,
  AudioPlayerContextType,
} from "./audio-player";
