// src/lib/admin/api-types.ts
// Centralized types for all admin API request/response contracts

import type { StoryType, StoryTag, StoryOrigin } from "@/types/story";
import type { FormAttribution } from "./attribution-helpers";

// ============================================================================
// Authentication
// ============================================================================

export interface AuthRequest {
  secret: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
}

// ============================================================================
// Level Detection
// ============================================================================

export interface DetectLevelRequest {
  text: string;
  language?: "en" | "es";
}

export interface DetectLevelResponse {
  level: number;
  confidence: number;
  reasoning: string;
}

// ============================================================================
// Level Rewriting
// ============================================================================

export interface RewriteLevelRequest {
  text: string;
  sourceLanguage: "en" | "es";
  targetLevel: number;
  sourceLevel?: number;
  isPoetry?: boolean;
}

export interface RewriteLevelResponse {
  rewrittenText: string;
  targetLevel: number;
  wasRewritten: boolean;
}

export interface RewriteLevelErrorResponse {
  error: string;
  aiMessage?: string;
}

// ============================================================================
// Translation
// ============================================================================

export interface TranslateRequest {
  text: string;
  fromLanguage: "en" | "es";
  level: number;
}

export interface TranslationAlignment {
  sourceLines: number;
  contentLines: number;
  translatedLines: number;
  blankLines: number;
}

export interface TruncationInfo {
  reasons: string[];
  expected: number;
  received: number;
  punctuationMismatches: number;
  mismatchedLines?: number[];
  lastSourceLine: string;
  lastTranslatedLine: string;
}

export interface TranslateResponse {
  translatedText: string;
  fromLanguage: "en" | "es";
  toLanguage: "en" | "es";
  level: number;
  alignment: TranslationAlignment;
  truncated: boolean;
  truncationInfo?: TruncationInfo;
  alignmentIssue?: string;
}

export interface TranslateErrorResponse {
  error: string;
  details?: string;
}

// ============================================================================
// Metadata Generation
// ============================================================================

export type MetadataType = "title" | "description" | "image" | "background" | "translate-to-spanish";

export interface GenerateMetadataRequest {
  storyText: string;
  sourceLanguage: "en" | "es";
  type: MetadataType;
  customPrompt?: string;
}

export interface TitleDescriptionOption {
  en: string;
  es: string;
}

export interface ImageOption {
  url: string;
  revisedPrompt?: string;
}

export interface GenerateTextMetadataResponse {
  type: "title" | "description";
  options: TitleDescriptionOption[];
}

export interface GenerateImageMetadataResponse {
  type: "image" | "background";
  options: ImageOption[];
  originalPrompt: string;
}

export interface TranslateToSpanishResponse {
  translatedTexts: string[];
}

export type GenerateMetadataResponse =
  | GenerateTextMetadataResponse
  | GenerateImageMetadataResponse
  | TranslateToSpanishResponse;

// ============================================================================
// Attribution Parsing
// ============================================================================

export interface ParseAttributionRequest {
  frontMatterText: string;
}

export interface ParseAttributionMetadata {
  sourceTitleEs?: string;
  displayTitle?: string;
  displayTitleEs?: string;
  summary?: string;
}

export interface ParseAttributionResponse {
  attribution: Partial<FormAttribution>;
  metadata: ParseAttributionMetadata;
}

// ============================================================================
// Image Proxy
// ============================================================================

export interface ProxyImageRequest {
  imageUrl: string;
}

export interface ProxyImageResponse {
  dataUrl: string;
}

// ============================================================================
// Save Story
// ============================================================================

export interface LevelContent {
  level: number;
  en: string;
  es: string;
}

export interface SaveStoryRequest {
  slug: string;
  title: { en: string; es: string };
  description: { en: string; es: string };
  levels: LevelContent[];
  linesPerPage?: number;
  thumbnailBase64?: string;
  backgroundBase64?: string;
  storyType: StoryType;
  origin: StoryOrigin;
  tags?: StoryTag[];
  targetAudience?: "children" | "teen" | "adult" | "all";
}

export interface SaveStoryResponse {
  success: boolean;
  message?: string;
  warnings?: string[];
  errors?: string[];
  filesWritten?: string[];
  details?: string;
}

// ============================================================================
// Generic Error Response
// ============================================================================

export interface ApiErrorResponse {
  error: string;
  details?: string;
  raw?: string;
}

// ============================================================================
// API Result wrapper for typed error handling
// ============================================================================

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; details?: string };
