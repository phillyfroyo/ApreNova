// src/types/chapter-audio.ts
import type { WordTiming, TTSLanguage, TTSSpeed } from "./azure-tts";

// ============================================================================
// Chapter Audio Modes
// ============================================================================

/** Identifies which audio variant to generate/play */
export type ChapterAudioMode =
  | "en"             // English only (Brian)
  | "es"             // Spanish only (Ava)
  | "bilingual-en"   // For en/ users: ES(Ava) → EN(Brian) per sentence
  | "bilingual-es";  // For es/ users: EN(Brian) → ES(Ava) per sentence

// ============================================================================
// Requests & Responses
// ============================================================================

export interface ChapterAudioRequest {
  storySlug: string;
  level: string;
  chapter: number;
  mode: ChapterAudioMode;
  speed: TTSSpeed;
}

export interface ChapterAudioResponse {
  audioUrl: string;
  metadata: ChapterAudioMetadata;
  cached: boolean;
}

// ============================================================================
// Timing Metadata
// ============================================================================

/** Timing for one sentence segment within the concatenated chapter audio */
export interface SentenceTiming {
  pageNumber: number;
  lineIndex: number;
  language: "en" | "es";
  startTime: number;       // seconds from chapter audio start
  endTime: number;
  text: string;
  wordTimings: WordTiming[];  // adjusted to chapter-level offsets
}

/** Page boundary within the chapter audio */
export interface PageBoundary {
  pageNumber: number;
  startTime: number;
  endTime: number;
  sentenceCount: number;
}

/** Full metadata stored alongside the chapter MP3 in R2 */
export interface ChapterAudioMetadata {
  variant: ChapterAudioRequest;
  totalDuration: number;
  totalSentences: number;
  sentenceTimings: SentenceTiming[];
  pageBoundaries: PageBoundary[];
  generatedAt: number;
  sentenceHashes: string[];  // per-sentence R2 cache keys for staleness detection
  version: number;           // metadata schema version
}

// ============================================================================
// Generation Progress
// ============================================================================

export interface ChapterGenerationProgress {
  status: "generating" | "concatenating" | "uploading" | "complete" | "error";
  sentencesComplete: number;
  sentencesTotal: number;
  error?: string;
}

// ============================================================================
// Internal: Segment plan for concatenation
// ============================================================================

export type TTSSegmentType = "speech" | "silence";

export interface TTSSpeechSegment {
  type: "speech";
  text: string;
  language: TTSLanguage;
  voice: string;
  rate: number;
  speed: TTSSpeed;
  pageNumber: number;
  lineIndex: number;
  langKey: "en" | "es";
  /** Optional speaker/stage direction for scripts */
  speakerName?: string;
  stageDirection?: string;
}

export interface TTSSilenceSegment {
  type: "silence";
  durationMs: number;
}

export type TTSSegment = TTSSpeechSegment | TTSSilenceSegment;
