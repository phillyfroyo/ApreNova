// src/contexts/audio-player/storage.ts
import type { AudioLanguageMode, AudioPlayerPosition } from "./types";
import { DEFAULT_PLAYBACK_RATE } from "./types";

const SPEED_STORAGE_KEY = 'cuentana_playback_speed';
const STORAGE_KEY = "cuentana_audio_player";

export function loadPlaybackRate(): number {
  try {
    const stored = localStorage.getItem(SPEED_STORAGE_KEY);
    if (stored) return parseFloat(stored);
  } catch (e) {}
  return DEFAULT_PLAYBACK_RATE;
}

export function savePlaybackRate(rate: number) {
  try {
    localStorage.setItem(SPEED_STORAGE_KEY, String(rate));
  } catch (e) {}
}

export function persistState(position: AudioPlayerPosition | null, mode: AudioLanguageMode) {
  try {
    if (position) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ position, mode, timestamp: Date.now() }));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch (e) {
    // Ignore
  }
}
