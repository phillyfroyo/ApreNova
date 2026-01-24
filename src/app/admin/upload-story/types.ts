// src/app/admin/upload-story/types.ts
// Shared types for the story upload pipeline

import type { StoryType, StoryTag, ContentStructureType } from "@/types/story";
import type { FormAttribution } from "@/lib/admin/attribution-helpers";

// ============================================
// Core Types
// ============================================

export type SourceLanguage = "en" | "es";
// Note: Step type is re-exported from config/constants at bottom of file

// ============================================
// Processing Status - Explicit State Machine
// ============================================

export type ProcessingStatus =
  | { state: 'idle' }
  | { state: 'processing'; chapter: number; batchEnd: number; total: number; subChunk?: { current: number; total: number } }
  | { state: 'partial'; completedChapters: number; totalChapters: number; lineCount: { source: number; processed: number } }
  | { state: 'complete'; lineCount: number }
  | { state: 'error'; errors: ChunkError[] };

// ============================================
// Error Types
// ============================================

export type TranslationErrorType = 'rate_limit' | 'content_refusal' | 'network' | 'timeout' | 'malformed' | 'unknown';

export interface ChunkError {
  chapterIndex: number;
  subChunkIndex?: number;
  errorType: TranslationErrorType;
  errorMessage: string;
  originalText: string;
  retryCount: number;
}

// ============================================
// Level Content
// ============================================

export interface LevelContent {
  sourceText: string;
  translatedText: string;
  status: "pending" | "generating" | "done" | "error" | "omitted";
  mode: "generate" | "use-original" | "omit";
}

// ============================================
// Chapter Detection
// ============================================

export interface DetectedChapter {
  number: number;
  title: string;
  subtitle?: string;
  rawText: string;
  startLine: number;
  endLine: number;
}

export interface PreprocessedResult {
  frontMatter: string;
  chapters: DetectedChapter[];
  stats: {
    originalLength: number;
    cleanedLength: number;
    lineNumbersRemoved: number;
    pageMarkersRemoved: number;
    footnoteIndicatorsRemoved: number;
    asteriskDividersRemoved: number;
    chaptersDetected: number;
    backMatterRemoved: boolean;
  };
  cleanedFullText: string;
}

// ============================================
// Annotations
// ============================================

export interface ExtractedAnnotation {
  id: string;
  type: "sidenote" | "footnote" | "marginal";
  text: string;
  nearbyText: string;
}

// ============================================
// Main Story Data
// ============================================

export interface StoryData {
  rawText: string;
  sourceLanguage: SourceLanguage;
  slug: string;
  detectedLevel: number | null;
  title: { en: string; es: string };
  displayTitle: { en: string; es: string } | null;
  description: { en: string; es: string };
  hook: { en: string; es: string } | null;
  selectedLevels: number[];
  levelContent: Record<number, LevelContent>;
  linesPerPage: number;
  thumbnailFile: File | null;
  thumbnailPreview: string | null;
  backgroundFile: File | null;
  backgroundPreview: string | null;
  storyType: StoryType;
  structureType: ContentStructureType | "auto";  // Content structure for navigation/processing
  isOriginal: boolean;
  attribution: FormAttribution | null;
  tags: StoryTag[];
  targetAudience: "children" | "teen" | "adult" | "all";
  parsedResult: PreprocessedResult | null;
  uploadedFileName: string | null;
  extractedAnnotations: ExtractedAnnotation[];
}

// ============================================
// Comparison Modal Props
// ============================================

export interface ComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  level: number | null;
  leftTitle: string;
  leftText: string;
  rightTitle: string;
  rightText: string;
  onSave?: (editedText: string, side: 'left' | 'right') => void;
  editableSide?: 'left' | 'right' | 'none';
  headerGradient?: string;
}

// ============================================
// Pipeline State Types
// ============================================

export interface LevelPipelineState {
  status: ProcessingStatus;
  mode?: 'generate' | 'use-original' | 'omit';
}

export interface RewritePipelineState {
  levels: Record<number, LevelPipelineState>;
  comparisonLevel: number | null;
}

export interface TranslationPipelineState {
  levels: Record<number, LevelPipelineState>;
  comparisonLevel: number | null;
  chunkErrors: Record<number, ChunkError[]>;
  copiedFromLevel: Record<number, number>;
}

// ============================================
// Persisted State (for localStorage)
// ============================================

export interface PersistedPipelineState {
  levels: Record<number, {
    status: 'idle' | 'partial' | 'complete' | 'error';
    completedChapters?: number;
    totalChapters?: number;
    errors?: ChunkError[];
  }>;
  savedAt: string;
}

// ============================================
// Constants (Re-exported from centralized config)
// ============================================

export {
  REWRITE_BATCH_SIZE,
  TRANSLATION_BATCH_SIZE,
  MAX_CHUNK_CHARS,
  MAX_TRANSLATION_RETRIES,
  RETRY_DELAY_MS,
  STEPS,
  type Step,
} from "./config/constants";
