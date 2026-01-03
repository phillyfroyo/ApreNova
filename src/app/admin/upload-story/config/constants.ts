// src/app/admin/upload-story/config/constants.ts
// Centralized configuration constants for the story upload pipeline
//
// NOTE: Core processing constants (chunking, retries, error handling) are now
// defined in the shared library at @/lib/story-processing/processing-config.ts
// We re-export them here for backward compatibility.

import {
  MAX_CHUNK_CHARS as SHARED_MAX_CHUNK_CHARS,
  RETRY_CONFIG,
  BATCH_CONFIG,
  DEFAULT_LINES_PER_PAGE as SHARED_LINES_PER_PAGE,
} from "@/lib/story-processing";

// ============================================
// Re-exports from shared library
// ============================================

/** Maximum characters per chunk for API calls */
export const MAX_CHUNK_CHARS = SHARED_MAX_CHUNK_CHARS;

/** Number of chapters to process in parallel during rewriting */
export const REWRITE_BATCH_SIZE = BATCH_CONFIG.REWRITE_BATCH_SIZE;

/** Number of chapters to process in parallel during translation */
export const TRANSLATION_BATCH_SIZE = BATCH_CONFIG.TRANSLATION_BATCH_SIZE;

/** Maximum retries for translation API calls */
export const MAX_TRANSLATION_RETRIES = RETRY_CONFIG.MAX_TRANSLATION_RETRIES;

/** Delay between retries in milliseconds */
export const RETRY_DELAY_MS = RETRY_CONFIG.RETRY_DELAY_MS;

/** Maximum retries for truncation issues */
export const MAX_TRUNCATION_RETRIES = RETRY_CONFIG.MAX_TRUNCATION_RETRIES;

/** Maximum retries for rewrite API calls */
export const MAX_REWRITE_RETRIES = RETRY_CONFIG.MAX_REWRITE_RETRIES;

/** Base delay for exponential backoff (ms) */
export const REWRITE_BACKOFF_BASE_MS = RETRY_CONFIG.BACKOFF_BASE_MS;

// ============================================
// File Generation
// ============================================

/** Minimum chapters to trigger split-file format (3+ chapters = split) */
export const SPLIT_CHAPTER_THRESHOLD = 3;

/** Default lines per page for pagination */
export const DEFAULT_LINES_PER_PAGE = 10;

// ============================================
// UI Steps
// ============================================

export const STEPS = [
  { number: 1, label: "Upload Text" },
  { number: 2, label: "Parse & Detect" },
  { number: 3, label: "Metadata" },
  { number: 4, label: "Generate Levels" },
  { number: 5, label: "Translate" },
  { number: 6, label: "Paginate" },
  { number: 7, label: "Preview & Save" },
] as const;

export type Step = (typeof STEPS)[number]["number"];

// ============================================
// File Upload
// ============================================

/** Supported file types for story upload */
export const SUPPORTED_FILE_TYPES = {
  "text/plain": [".txt"],
  "text/html": [".html", ".htm"],
  "application/xhtml+xml": [".xhtml"],
} as const;

/** All accepted file extensions */
export const ACCEPTED_EXTENSIONS = [".txt", ".html", ".htm", ".xhtml"] as const;

// ============================================
// CEFR Level Labels
// ============================================

export const LEVEL_LABELS: Record<number, { short: string; full: string; description: string }> = {
  1: { short: "A1", full: "A1 (Beginner)", description: "No past/future/perfect tenses" },
  2: { short: "A2", full: "A2 (Elementary)", description: "Simple present tense" },
  3: { short: "B1", full: "B1 (Intermediate)", description: "Complex structures allowed" },
  4: { short: "B2", full: "B2 (Upper Intermediate)", description: "Advanced vocabulary" },
  5: { short: "C1", full: "C1 (Advanced)", description: "Modern language, no archaic forms" },
  6: { short: "C2+", full: "C2+ (Literary)", description: "Original text, unrestricted" },
} as const;

// ============================================
// Draft Storage
// ============================================

/** Auto-save debounce delay in milliseconds */
export const AUTO_SAVE_DEBOUNCE_MS = 2000;

/** Maximum age for draft auto-cleanup (30 days in ms) */
export const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Maximum drafts to keep per story slug */
export const MAX_DRAFTS_PER_SLUG = 5;

// ============================================
// API Limits
// ============================================

/** Maximum characters for attribution parsing (first N chars of front matter) */
export const ATTRIBUTION_PARSE_LIMIT = 15000;

/** Maximum characters to sample for level detection */
export const LEVEL_DETECTION_SAMPLE_SIZE = 1500;
