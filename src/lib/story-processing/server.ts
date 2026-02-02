// src/lib/story-processing/server.ts
// Server-only exports that use AI SDKs (Anthropic, OpenAI)
// This module should ONLY be imported in API routes and server components.
//
// Importing this module in a client component will cause a build-time error
// thanks to the "server-only" package.
//
// For client-safe utilities, import from "@/lib/story-processing/client"

import "server-only";

// ============================================================================
// RE-EXPORT ALL CLIENT-SAFE UTILITIES
// Server code can use everything
// ============================================================================

export * from "./client";

// ============================================================================
// TRANSLATION (uses Anthropic Claude Haiku)
// ============================================================================

export {
  translateText,
  type TranslationResult,
  type TranslationOptions,
} from "./translation";

// ============================================================================
// REWRITING (uses OpenAI GPT-4)
// ============================================================================

export {
  rewriteToLevel,
  rewritePoemByStanza,
  rewritePoetryChapter,
  splitIntoStanzas,
  joinStanzasToText,
  joinStanzasWithSpacing,
  type RewriteResult,
  type RewriteOptions,
  type StanzaRewriteResult,
  type ChapterRewriteResult,
} from "./rewriting";

// ============================================================================
// POETRY MARKERS (for chapter-level processing)
// ============================================================================

export {
  addPoemAndStanzaMarkers,
  parsePoemAndStanzaMarkers,
  reconstructChapterFromPoems,
  splitChapterAtPoemBoundaries,
  estimateTokens,
  validateStanzaCounts,
  type MarkedPoetryResult,
  type ParsedPoem,
  type ParsedChapterResult,
} from "./poetry-markers";

// ============================================================================
// DETECTION (uses OpenAI GPT-4o-mini)
// ============================================================================

export {
  detectLanguage,
  detectCEFRLevel,
  type CEFRDetectionResult,
  type DetectionContext,
} from "./detection";
