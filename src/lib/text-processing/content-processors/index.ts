// src/lib/text-processing/content-processors/index.ts
// Content processor router - dispatches to appropriate processor based on content type

import type { ContentType, PreprocessedText, StructureAnalysis } from '../types';
import { preprocessAnthology, analyzeContentStructure, detectEditorialNotes } from './anthology-processor';
import { preprocessProse } from './prose-processor';
import { preprocessEpic } from './epic-processor';
import { preprocessScript, parseScriptLine, extractSpeakerNames } from './script-processor';

// Re-export individual processors for direct use
export { preprocessAnthology, analyzeContentStructure, detectEditorialNotes } from './anthology-processor';
export { preprocessProse } from './prose-processor';
export { preprocessEpic } from './epic-processor';
export { preprocessScript, parseScriptLine, extractSpeakerNames } from './script-processor';

// ============================================================================
// CONTENT TYPE DETECTION
// ============================================================================

/**
 * Auto-detect content type from text
 */
export function detectContentType(text: string): ContentType {
  const analysis = analyzeContentStructure(text);
  return analysis.structureType;
}

/**
 * Get full structure analysis for text
 */
export function getStructureAnalysis(text: string): StructureAnalysis {
  return analyzeContentStructure(text);
}

// ============================================================================
// MAIN PROCESSING ROUTER
// ============================================================================

/**
 * Preprocess text based on content type
 *
 * This is the main entry point for content processing.
 * It routes to the appropriate processor based on content type.
 *
 * @param text - Extracted text (after file extraction)
 * @param contentType - Type of content ("auto" to auto-detect, or specific type)
 * @returns PreprocessedText with chapters, stats, etc.
 */
export function processContent(
  text: string,
  contentType: "auto" | ContentType = "auto"
): PreprocessedText {
  // Determine content type
  let effectiveType: ContentType;
  if (contentType === "auto") {
    effectiveType = detectContentType(text);
    console.log(`[processContent] Auto-detected content type: ${effectiveType}`);
  } else {
    effectiveType = contentType;
  }

  // Route to appropriate processor
  switch (effectiveType) {
    case 'anthology':
      return preprocessAnthology(text, effectiveType);
    case 'epic':
      return preprocessEpic(text, effectiveType);
    case 'script':
      return preprocessScript(text, effectiveType);
    case 'prose':
    default:
      return preprocessProse(text, effectiveType);
  }
}

// ============================================================================
// HUMAN-READABLE LABELS
// ============================================================================

/**
 * Get human-readable label for content type
 */
export function getContentTypeLabel(contentType: ContentType): string {
  const labels: Record<ContentType, string> = {
    anthology: "Anthology (Poetry)",
    prose: "Prose (Novel/Short Story)",
    epic: "Epic (Narrative Poetry)",
    script: "Script (Screenplay/Transcript)",
  };
  return labels[contentType] || contentType.charAt(0).toUpperCase() + contentType.slice(1);
}

/**
 * All valid content types
 */
export const CONTENT_TYPES: ContentType[] = ["anthology", "prose", "epic", "script"];
