// src/lib/story-processing/processing-config.ts
// Centralized configuration for story processing pipelines
// Used by both admin and user story pipelines

// ============================================================================
// CHUNKING CONFIGURATION
// ============================================================================

/**
 * Maximum characters per chunk for API calls.
 * This ensures we don't exceed token limits and allows for better error recovery.
 * - GPT-4o has 128K context, but we chunk smaller for reliability
 * - Claude Haiku has 200K context
 * - 12000 chars ≈ 3000-4000 tokens (safe margin)
 */
export const MAX_CHUNK_CHARS = 12000;

/**
 * Maximum tokens per chapter for chapter-level poetry processing.
 * Chapters exceeding this will be split at poem boundaries.
 * - 30,000 tokens ~= 120,000 characters
 * - This allows full chapter context while staying within API limits
 */
export const MAX_CHAPTER_TOKENS = 30000;

/**
 * Characters per token estimate for splitting calculations.
 * GPT models average ~4 chars per token for English text.
 */
export const CHARS_PER_TOKEN_ESTIMATE = 4;

/**
 * Default lines per page for pagination
 */
export const DEFAULT_LINES_PER_PAGE = 10;

/**
 * Lines per page by content structure type.
 * Poetry anthologies get more lines per page to keep poems together.
 */
export const LINES_PER_PAGE_BY_TYPE = {
  prose: 10,      // Default for novels, short stories
  anthology: 30,  // Poetry collections need more lines per page
  epic: 25,       // Narrative poetry
  script: 15,     // Scripts with dialogue
} as const;

/**
 * Get lines per page for a given structure type.
 * Falls back to default if type is not recognized.
 *
 * @param structureType - Content structure type or "auto"
 * @returns Lines per page for that type
 */
export function getLinesPerPage(structureType?: string): number {
  if (structureType && structureType !== "auto" && structureType in LINES_PER_PAGE_BY_TYPE) {
    return LINES_PER_PAGE_BY_TYPE[structureType as keyof typeof LINES_PER_PAGE_BY_TYPE];
  }
  return DEFAULT_LINES_PER_PAGE;
}

// ============================================================================
// RETRY CONFIGURATION
// ============================================================================

/**
 * Retry settings for API calls.
 * Shared across all pipelines for consistent behavior.
 */
export const RETRY_CONFIG = {
  /** Maximum retries for translation API calls */
  MAX_TRANSLATION_RETRIES: 3,

  /** Maximum retries for rewrite API calls */
  MAX_REWRITE_RETRIES: 3,

  /** Maximum retries for truncation recovery */
  MAX_TRUNCATION_RETRIES: 2,

  /** Base delay between retries (milliseconds) */
  RETRY_DELAY_MS: 500,

  /** Base delay for exponential backoff (milliseconds) */
  BACKOFF_BASE_MS: 1000,

  /** Minimum delay between AI API calls (rate limiting) */
  MIN_DELAY_BETWEEN_CALLS_MS: 2000,
} as const;

/**
 * Batch processing settings
 */
export const BATCH_CONFIG = {
  /** Number of chapters to process in parallel during rewriting
   * Kept moderate to avoid connection pool exhaustion and API rate limits.
   * Each chapter can take 20-40s, and sub-chunks add more parallel calls. */
  REWRITE_BATCH_SIZE: 4,

  /** Number of chapters to process sequentially during translation.
   * Set to 1 (fully sequential) to match user portal behavior and avoid
   * rate limits, truncation, and line alignment issues. */
  TRANSLATION_BATCH_SIZE: 1,
} as const;

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Categorized error types for API failures.
 * Helps with retry logic and user feedback.
 */
export type ProcessingErrorType =
  | "rate_limit" // API rate limit hit - retry with backoff
  | "content_refusal" // AI refused to process content - may need manual intervention
  | "network" // Network error - retry
  | "timeout" // Request timed out - retry with longer timeout
  | "truncation" // Output was truncated - retry or chunk smaller
  | "malformed" // Response was malformed - retry
  | "unknown"; // Unknown error

/**
 * Structured error for chunk processing failures
 */
export interface ChunkError {
  chapterIndex: number;
  subChunkIndex?: number;
  errorType: ProcessingErrorType;
  errorMessage: string;
  originalText: string;
  retryCount: number;
}

/**
 * Categorize an error into a ProcessingErrorType
 */
export function categorizeError(error: unknown): ProcessingErrorType {
  if (!error) return "unknown";

  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  // Rate limit detection
  if (
    message.includes("rate limit") ||
    message.includes("429") ||
    message.includes("too many requests")
  ) {
    return "rate_limit";
  }

  // Content refusal detection
  if (
    message.includes("content policy") ||
    message.includes("refused") ||
    message.includes("cannot process") ||
    message.includes("inappropriate")
  ) {
    return "content_refusal";
  }

  // Network errors
  if (
    message.includes("network") ||
    message.includes("econnrefused") ||
    message.includes("econnreset") ||
    message.includes("fetch failed")
  ) {
    return "network";
  }

  // Timeout errors
  if (message.includes("timeout") || message.includes("timed out")) {
    return "timeout";
  }

  // Truncation
  if (message.includes("truncat") || message.includes("incomplete")) {
    return "truncation";
  }

  // Malformed response
  if (
    message.includes("json") ||
    message.includes("parse") ||
    message.includes("malformed")
  ) {
    return "malformed";
  }

  return "unknown";
}

/**
 * Determine if an error type is retryable
 */
export function isRetryableError(errorType: ProcessingErrorType): boolean {
  switch (errorType) {
    case "rate_limit":
    case "network":
    case "timeout":
    case "truncation":
    case "malformed":
      return true;
    case "content_refusal":
    case "unknown":
      return false;
  }
}

/**
 * Get recommended retry delay for an error type
 */
export function getRetryDelay(
  errorType: ProcessingErrorType,
  attempt: number
): number {
  const baseDelay = RETRY_CONFIG.BACKOFF_BASE_MS;

  switch (errorType) {
    case "rate_limit":
      // Longer backoff for rate limits
      return baseDelay * Math.pow(2, attempt) * 2;
    case "timeout":
      // Moderate backoff for timeouts
      return baseDelay * Math.pow(2, attempt);
    default:
      // Standard exponential backoff
      return baseDelay * attempt;
  }
}

// ============================================================================
// FILE VALIDATION
// ============================================================================

/**
 * Supported file types for story upload
 */
export const SUPPORTED_FILE_TYPES = [
  { ext: ".txt", mime: "text/plain", label: "Plain Text" },
  { ext: ".html", mime: "text/html", label: "HTML" },
  { ext: ".htm", mime: "text/html", label: "HTML" },
  { ext: ".md", mime: "text/markdown", label: "Markdown" },
  { ext: ".rtf", mime: "application/rtf", label: "Rich Text" },
] as const;

export type SupportedFileType = (typeof SUPPORTED_FILE_TYPES)[number];

/**
 * All accepted file extensions
 */
export const ACCEPTED_EXTENSIONS = SUPPORTED_FILE_TYPES.map((t) => t.ext);

/**
 * Check if a file is an accepted type for story upload.
 * Works in both browser (File object) and server (filename string) contexts.
 */
export function isAcceptedFile(
  fileOrName: File | string,
  mimeType?: string
): boolean {
  const fileName =
    typeof fileOrName === "string"
      ? fileOrName.toLowerCase()
      : fileOrName.name.toLowerCase();
  const mime =
    mimeType || (typeof fileOrName !== "string" ? fileOrName.type : undefined);

  return SUPPORTED_FILE_TYPES.some(
    (type) => fileName.endsWith(type.ext) || mime === type.mime
  );
}

/**
 * Detected file type
 */
export type DetectedFileType =
  | "text"
  | "html"
  | "rtf"
  | "markdown"
  | "unknown";

/**
 * Detect file type from filename or MIME type.
 * Works in both browser (File object) and server (filename string) contexts.
 */
export function detectFileType(
  fileOrName: File | string,
  mimeType?: string
): DetectedFileType {
  const fileName =
    typeof fileOrName === "string"
      ? fileOrName.toLowerCase()
      : fileOrName.name.toLowerCase();
  const mime =
    mimeType || (typeof fileOrName !== "string" ? fileOrName.type : undefined);

  if (
    fileName.endsWith(".html") ||
    fileName.endsWith(".htm") ||
    mime === "text/html"
  ) {
    return "html";
  }
  if (fileName.endsWith(".rtf") || mime === "application/rtf") {
    return "rtf";
  }
  if (fileName.endsWith(".md") || mime === "text/markdown") {
    return "markdown";
  }
  if (fileName.endsWith(".txt") || mime === "text/plain") {
    return "text";
  }

  return "unknown";
}

// ============================================================================
// TEXT CHUNKING
// ============================================================================

/**
 * Split text into sub-chunks for API calls, respecting paragraph and sentence boundaries.
 * Preserves original spacing (double, triple newlines) between paragraphs.
 *
 * @param text The text to split
 * @param maxChars Maximum characters per chunk (defaults to MAX_CHUNK_CHARS)
 * @returns Array of text chunks
 */
export function splitIntoSubChunks(
  text: string,
  maxChars: number = MAX_CHUNK_CHARS
): string[] {
  // If text fits in one chunk, return as-is
  if (text.length <= maxChars) return [text];

  // Split by paragraph breaks while capturing the separator (preserves spacing)
  const parts = text.split(/(\n{2,})/);
  // parts alternates: [content, separator, content, separator, ...]
  // Build entries: each content piece with the separator BEFORE it
  const entries: { text: string; separatorBefore: string }[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const content = parts[i] || "";
    const separatorBefore = i > 0 ? (parts[i - 1] || "\n\n") : "";
    if (content.trim()) {
      entries.push({ text: content, separatorBefore });
    }
  }

  const chunks: string[] = [];
  let currentChunk = "";

  for (const entry of entries) {
    const sep = currentChunk ? entry.separatorBefore : "";
    if (currentChunk && currentChunk.length + sep.length + entry.text.length > maxChars) {
      chunks.push(currentChunk);
      currentChunk = entry.text;
    } else {
      currentChunk += sep + entry.text;
    }
  }

  if (currentChunk) chunks.push(currentChunk);

  // Second pass: split any chunks that are still too large by sentences
  const result: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= maxChars) {
      result.push(chunk);
    } else {
      // Split by sentence boundaries
      const sentences = chunk.split(/(?<=[.!?])\s+/);
      let sentenceChunk = "";

      for (const sentence of sentences) {
        if (sentenceChunk.length + sentence.length + 1 > maxChars) {
          if (sentenceChunk) result.push(sentenceChunk.trim());
          sentenceChunk = sentence;
        } else {
          sentenceChunk += (sentenceChunk ? " " : "") + sentence;
        }
      }

      if (sentenceChunk) result.push(sentenceChunk.trim());
    }
  }

  return result;
}

/**
 * Reassemble chunks back into text with paragraph breaks
 */
export function reassembleChunks(chunks: string[]): string {
  return chunks.map((c) => c.trim()).join("\n\n");
}
