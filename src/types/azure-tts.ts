// src/types/azure-tts.ts

export type TTSLanguage = 'es-ES' | 'en-US';
export type TTSSpeed = 'normal' | 'slow';

export interface WordTiming {
  word: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  confidence: number;
}

export interface TTSRequest {
  text: string;
  language: TTSLanguage;
  speed: TTSSpeed;
  storySlug?: string;
  chapterPage?: string;
  // Script support - speaker name and stage direction
  speakerName?: string;      // Read aloud before dialogue with pause
  stageDirection?: string;   // Read in softer voice before dialogue
}

export interface TTSResponse {
  audioUrl: string;
  wordTimings: WordTiming[];
  duration: number;
  cached: boolean;
}

export interface TTSBatchRequest {
  items: TTSRequest[];
  storySlug: string;
  chapterPage: string;
}

export interface TTSBatchResponse {
  results: TTSResponse[];
  totalDuration: number;
  cacheHitRate: number;
}

export interface TTSCacheEntry {
  audioUrl: string;
  wordTimings: WordTiming[];
  duration: number;
  createdAt: number;
  accessedAt: number;
  language: TTSLanguage;
  speed: TTSSpeed;
  textHash: string;
}

export interface AzureSpeechConfig {
  subscriptionKey: string;
  serviceRegion: string;
  endpoint?: string;
}

export interface VoiceConfig {
  'es-ES': {
    normal: string;
    slow: string;
  };
  'en-US': {
    normal: string;
    slow: string;
  };
}

export interface TTSError {
  code: string;
  message: string;
  details?: any;
}

export interface RateLimitInfo {
  remaining: number;
  resetTime: number;
  limit: number;
}

// SSML generation types
export interface SSMLOptions {
  text: string;
  voice: string;
  rate: number; // 0.5 to 2.0
  pitch?: string; // e.g., "+0Hz", "-50Hz"
  volume?: string; // e.g., "loud", "soft", "+10dB"
}

// Audio generation options
export interface AudioGenerationOptions {
  format: 'mp3' | 'wav' | 'ogg';
  sampleRate: number;
  bitRate?: number;
  channels: 1 | 2;
}

// Cache management types
export interface CacheStats {
  totalFiles: number;
  totalSize: number; // in bytes
  oldestFile: number; // timestamp
  newestFile: number; // timestamp
  hitRate: number;
}

export interface CacheCleanupOptions {
  maxAge: number; // in milliseconds
  maxSize: number; // in bytes
  maxFiles: number;
}

// Enhanced word highlighting types
export interface WordHighlightConfig {
  style: 'subtle' | 'prominent' | 'pulse' | 'custom';
  smoothTransitions: boolean;
  showConfidence: boolean;
  clickToSeek: boolean;
  autoScroll: boolean;
}

export interface AudioPlayerConfig {
  preloadStrategy: 'none' | 'next' | 'all';
  fallbackToStatic: boolean;
  retryAttempts: number;
  retryDelay: number; // milliseconds
  wordHighlighting: WordHighlightConfig;
}

export interface SentenceAudioData {
  sentenceIndex: number;
  text: string;
  language: TTSLanguage;
  speed: TTSSpeed;
  audioUrl?: string;
  wordTimings?: WordTiming[];
  duration?: number;
  isLoading: boolean;
  hasError: boolean;
  errorMessage?: string;
  lastPlayed?: number; // timestamp
}

export interface AudioPlayerState {
  currentSentence: number | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  currentWordIndex: number;
  playbackSpeed: TTSSpeed;
  isLoading: boolean;
  hasError: boolean;
  errorMessage?: string;
  isSupported: boolean; // Azure TTS vs static fallback
}

export interface WordSynchronizationData {
  word: string;
  startTime: number;
  endTime: number;
  confidence: number;
  isActive: boolean;
  index: number;
  boundingRect?: DOMRect;
}

// Performance monitoring types
export interface AudioPerformanceMetrics {
  ttsGenerationTime: number; // ms
  audioLoadTime: number; // ms
  firstWordTime: number; // ms
  totalPlaybackTime: number; // ms
  cacheHitRate: number;
  errorRate: number;
  retryCount: number;
}

export interface StoryAudioSession {
  storySlug: string;
  level: string;
  chapter: number;
  page: number;
  startTime: number;
  endTime?: number;
  sentences: SentenceAudioData[];
  metrics: AudioPerformanceMetrics;
  userPreferences: {
    preferredSpeed: TTSSpeed;
    highlightStyle: string;
    autoplay: boolean;
  };
}

// API response types for enhanced audio features
export interface EnhancedTTSResponse extends TTSResponse {
  wordTimings: WordTiming[];
  phonemeData?: PhonemeData[];
  prosodyMarkers?: ProsodyMarker[];
  qualityScore: number;
  processingTime: number;
}

export interface PhonemeData {
  phoneme: string;
  startTime: number;
  endTime: number;
  word: string;
  wordIndex: number;
}

export interface ProsodyMarker {
  type: 'stress' | 'pause' | 'emphasis' | 'boundary';
  startTime: number;
  endTime: number;
  intensity: number;
  description?: string;
}

// Batch processing types
export interface BatchAudioRequest {
  sentences: Array<{
    text: string;
    index: number;
    priority: 'high' | 'normal' | 'low';
  }>;
  language: TTSLanguage;
  speeds: TTSSpeed[];
  storyContext: {
    storySlug: string;
    level: string;
    chapter: number;
    page: number;
  };
  options: {
    parallel: boolean;
    maxConcurrent: number;
    timeout: number;
  };
}

export interface BatchAudioResponse {
  results: Array<{
    sentenceIndex: number;
    success: boolean;
    audioData?: EnhancedTTSResponse;
    error?: TTSError;
    processingTime: number;
  }>;
  totalTime: number;
  successRate: number;
  cacheHits: number;
  errors: TTSError[];
}