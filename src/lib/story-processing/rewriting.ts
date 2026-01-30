// src/lib/story-processing/rewriting.ts
// Server-only rewriting for CEFR level adaptation
// Used by both admin and user story pipelines (API routes only)

import "server-only";

import { OpenAI } from "openai";
import { generateRewritePrompt, levelStringToNumber } from "./cefr-prompts";
import { logOpenAICost } from "@/lib/cost-tracker";
import { isErrorResponse, stripPreamble, isValidRewriteResponse, isTitleLikeText, isEditorialNote } from "./rewriting-utils";
import { detectStanzas } from "./text-processing";
import { createThrottledCancellationChecker } from "@/lib/user-stories/progress-tracker";

// Re-export utilities for backward compatibility
export { isErrorResponse, stripPreamble, isValidRewriteResponse, isTitleLikeText, isEditorialNote } from "./rewriting-utils";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============================================================================
// MAIN REWRITING FUNCTION
// Uses OpenAI GPT-4 with retry logic
// ============================================================================

export interface RewriteResult {
  rewrittenText: string;
  originalLength: number;
  rewrittenLength: number;
  wasRewritten: boolean;
  attempts: number;
}

export interface RewriteOptions {
  isPoetry?: boolean;
  maxRetries?: number;
  storyId?: string;
  userId?: string;
  /** Admin story slug for cost tracking (admin uploads don't have storyId) */
  adminStorySlug?: string;
}

/**
 * Rewrite text to a specific CEFR level.
 * Uses GPT-4 for quality rewrites with retry logic.
 *
 * @param text - The text to rewrite
 * @param sourceLevel - The detected source level (string like "l4" or number like 4)
 * @param targetLevel - The target level to rewrite to
 * @param language - The language of the text ("en" or "es")
 * @param options - Optional settings: isPoetry, maxRetries, storyId, userId
 */
export async function rewriteToLevel(
  text: string,
  sourceLevel: string | number,
  targetLevel: string | number,
  language: "en" | "es",
  options: RewriteOptions = {}
): Promise<RewriteResult> {
  const { isPoetry = false, maxRetries = 2, storyId, userId, adminStorySlug } = options;
  const sourceLevelNum =
    typeof sourceLevel === "string" ? levelStringToNumber(sourceLevel) : sourceLevel;
  const targetLevelNum =
    typeof targetLevel === "string" ? levelStringToNumber(targetLevel) : targetLevel;

  // If target matches source, return original
  if (sourceLevelNum === targetLevelNum) {
    return {
      rewrittenText: text,
      originalLength: text.length,
      rewrittenLength: text.length,
      wasRewritten: false,
      attempts: 0,
    };
  }

  const prompt = generateRewritePrompt(targetLevelNum, text, language, isPoetry);

  const systemPrompt = `You are an expert language educator specializing in graded readers and CEFR-level content adaptation.

Your task is to rewrite texts to match specific CEFR levels while preserving:
- The exact plot, characters, and story events
- The emotional tone and narrative flow
- Character names (never translate names)

IMPORTANT: Return ONLY the rewritten text. No explanations, no headers, no preambles like "Here's the rewritten text:".`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.5,
        max_tokens: 16000,
      });

      // Log cost (fire-and-forget)
      logOpenAICost("rewriting", "gpt-4o", completion.usage, {
        userId,
        userStoryId: storyId,
        metadata: { sourceLevel: sourceLevelNum, targetLevel: targetLevelNum, attempt, ...(adminStorySlug && { adminStorySlug }) },
      });

      const rawResponse = completion.choices[0]?.message?.content?.trim() || "";
      const finishReason = completion.choices[0]?.finish_reason;

      // Check for error responses
      if (isErrorResponse(rawResponse)) {
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 2000 * attempt));
          continue;
        }
        return {
          rewrittenText: text,
          originalLength: text.length,
          rewrittenLength: text.length,
          wasRewritten: false,
          attempts: attempt,
        };
      }

      // Strip preambles
      const rewrittenText = stripPreamble(rawResponse);

      // Validate content - check response is related to original (catches meta-commentary)
      if (!isValidRewriteResponse(text, rewrittenText)) {
        console.warn(`[Rewrite] Response failed content validation (attempt ${attempt})`);
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 2000 * attempt));
          continue;
        }
        return {
          rewrittenText: text,
          originalLength: text.length,
          rewrittenLength: text.length,
          wasRewritten: false,
          attempts: attempt,
        };
      }

      // Validate the rewrite worked
      if (!rewrittenText || rewrittenText.length < text.length * 0.3) {
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 2000 * attempt));
          continue;
        }
        return {
          rewrittenText: text,
          originalLength: text.length,
          rewrittenLength: text.length,
          wasRewritten: false,
          attempts: attempt,
        };
      }

      // Check if API response was truncated
      if (finishReason === "length") {
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 2000 * attempt));
          continue;
        }
        // Use truncated result if it's our last attempt and it's substantial
      }

      return {
        rewrittenText,
        originalLength: text.length,
        rewrittenLength: rewrittenText.length,
        wasRewritten: true,
        attempts: attempt,
      };
    } catch (error: any) {
      console.error(`[Rewrite] Error:`, error.message);
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  }

  // If all attempts failed, return original text
  return {
    rewrittenText: text,
    originalLength: text.length,
    rewrittenLength: text.length,
    wasRewritten: false,
    attempts: maxRetries,
  };
}

// ============================================================================
// STANZA-BASED POEM REWRITING
// Process poems stanza-by-stanza to guarantee stanza structure preservation
// ============================================================================

/**
 * Split poem text into stanzas (nested array of lines).
 * Uses detectStanzas() to identify stanza boundaries.
 *
 * @param text - Raw poem text with line breaks
 * @returns Array of stanzas, where each stanza is an array of lines
 */
export function splitIntoStanzas(text: string): string[][] {
  // Use the new stanza detector which takes a string
  const result = detectStanzas(text, { method: 'adaptive' });

  // Return the stanzas as arrays of text strings
  return result.stanzas.map(stanza =>
    stanza.map(line => line.text)
  );
}

/**
 * Join stanzas back into text with double-newlines between stanzas.
 *
 * @param stanzas - Array of stanzas, each stanza is array of lines
 * @returns Text with single newlines within stanzas, double newlines between
 */
export function joinStanzasToText(stanzas: string[][]): string {
  return stanzas
    .map(stanza => stanza.join('\n'))
    .join('\n\n');
}

/**
 * Split text into stanzas WITH spacing information preserved.
 * Returns both the stanzas and the number of blank lines before each stanza.
 *
 * @param text - Raw poem text with line breaks
 * @returns Object with stanzas array and blankLinesBefore array (same length)
 */
export function splitIntoStanzasWithSpacing(text: string): {
  stanzas: string[][];
  blankLinesBefore: number[];  // How many blank lines before each stanza (first is leading blanks)
} {
  // Use the new stanza detector
  const result = detectStanzas(text, { method: 'adaptive' });

  const stanzas: string[][] = [];
  const blankLinesBefore: number[] = [];

  let currentStanza: string[] = [];
  let blankCount = 0;
  let lastStanzaNum = -1;

  // Process annotated lines to track blank spacing
  for (const annotated of result.annotatedLines) {
    if (annotated.isStanzaBreak) {
      blankCount++;
    } else {
      // New stanza started?
      if (annotated.stanzaNumber !== lastStanzaNum) {
        // Save previous stanza if exists
        if (currentStanza.length > 0) {
          stanzas.push(currentStanza);
        }
        // Record blank lines before this stanza
        blankLinesBefore.push(blankCount);
        currentStanza = [];
        blankCount = 0;
        lastStanzaNum = annotated.stanzaNumber;
      }
      currentStanza.push(annotated.text);
    }
  }

  // Don't forget the last stanza
  if (currentStanza.length > 0) {
    stanzas.push(currentStanza);
  }

  return { stanzas, blankLinesBefore };
}

/**
 * Join stanzas back into text with normalized spacing.
 * Uses exactly 1 blank line between stanzas for consistent formatting.
 *
 * @param stanzas - Array of stanzas, each stanza is array of lines
 * @param _blankLinesBefore - Ignored (kept for API compatibility)
 * @returns Text with normalized vertical spacing (1 blank line between stanzas)
 */
export function joinStanzasWithSpacing(stanzas: string[][], _blankLinesBefore: number[]): string {
  // Join lines within each stanza with single newlines
  // Join stanzas with double newlines (1 blank line between)
  return stanzas
    .map(stanza => stanza.join('\n'))
    .join('\n\n');
}

/**
 * Result of stanza-by-stanza rewriting
 */
export interface StanzaRewriteResult {
  rewrittenStanzas: string[][];
  originalStanzas: string[][];
  totalOriginalLines: number;
  totalRewrittenLines: number;
  allStanzasValid: boolean;
  stanzaValidation: {
    stanzaIndex: number;
    originalLines: number;
    rewrittenLines: number;
    valid: boolean;
  }[];
  wasRewritten: boolean;
  /** Number of blank lines before each stanza (for preserving vertical spacing) */
  blankLinesBefore: number[];
}

/**
 * Rewrite a poem stanza-by-stanza.
 * Each stanza is sent to GPT separately to preserve stanza boundaries.
 * Line counts may change when adapting across CEFR levels (this is expected).
 *
 * @param text - The full poem text
 * @param sourceLevel - Detected source CEFR level
 * @param targetLevel - Target CEFR level
 * @param language - "en" or "es"
 * @param options - Rewrite options (maxRetries, storyId, userId)
 */
export async function rewritePoemByStanza(
  text: string,
  sourceLevel: string | number,
  targetLevel: string | number,
  language: "en" | "es",
  options: RewriteOptions = {}
): Promise<StanzaRewriteResult> {
  // Use spacing-aware split to preserve vertical whitespace
  const { stanzas, blankLinesBefore } = splitIntoStanzasWithSpacing(text);

  const rewrittenStanzas: string[][] = [];
  const stanzaValidation: StanzaRewriteResult['stanzaValidation'] = [];
  let allStanzasValid = true;
  let anyWasRewritten = false;

  // Create throttled cancellation checker if storyId is provided
  // Checks every 10 seconds to avoid wasting API calls after user cancels
  const cancellationChecker = options.storyId
    ? createThrottledCancellationChecker(options.storyId, 10000)
    : null;

  for (let i = 0; i < stanzas.length; i++) {
    // Check for cancellation (throttled - only queries DB every 10 seconds)
    if (cancellationChecker) {
      await cancellationChecker.checkIfCancelled();
    }

    const stanza = stanzas[i];
    const stanzaText = stanza.join('\n');
    const originalLineCount = stanza.length;

    // Skip rewriting for title-like stanzas (single word, ALL CAPS, etc.)
    // These don't need simplification and often cause AI confusion
    if (isTitleLikeText(stanzaText)) {
      rewrittenStanzas.push(stanza); // Keep original
      stanzaValidation.push({
        stanzaIndex: i,
        originalLines: originalLineCount,
        rewrittenLines: originalLineCount,
        valid: true,
      });
      continue;
    }

    // Skip rewriting for editorial notes (bracketed publication info, annotations)
    // These should be preserved exactly as-is
    if (isEditorialNote(stanzaText)) {
      rewrittenStanzas.push(stanza); // Keep original
      stanzaValidation.push({
        stanzaIndex: i,
        originalLines: originalLineCount,
        rewrittenLines: originalLineCount,
        valid: true,
      });
      continue;
    }

    // Rewrite this stanza with poetry mode
    const result = await rewriteToLevel(
      stanzaText,
      sourceLevel,
      targetLevel,
      language,
      {
        ...options,
        isPoetry: true,
      }
    );

    // Validate response content - check it's related to the original
    if (!isValidRewriteResponse(stanzaText, result.rewrittenText)) {
      console.warn(`[RewritePoemByStanza] Stanza ${i + 1} failed content validation, using original`);
      rewrittenStanzas.push(stanza); // Fall back to original
      stanzaValidation.push({
        stanzaIndex: i,
        originalLines: originalLineCount,
        rewrittenLines: originalLineCount,
        valid: true,
      });
      continue;
    }

    if (result.wasRewritten) {
      anyWasRewritten = true;
    }

    // Split result back into lines
    const rewrittenLines = result.rewrittenText.split('\n');
    const rewrittenLineCount = rewrittenLines.length;
    // Line count differences are normal when adapting across CEFR levels
    const linesMatch = originalLineCount === rewrittenLineCount;
    if (!linesMatch) {
      allStanzasValid = false;
    }

    // Re-apply original indentation to rewritten lines (AI may not preserve it reliably)
    // Only do this if line counts match; otherwise we can't map 1:1
    const indentedRewrittenLines = linesMatch
      ? rewrittenLines.map((rewrittenLine, lineIdx) => {
          const originalLine = stanza[lineIdx];
          // Extract leading whitespace from original line
          const leadingWhitespace = originalLine.match(/^(\s*)/)?.[1] || '';
          // Strip any whitespace AI may have added and apply original
          return leadingWhitespace + rewrittenLine.trimStart();
        })
      : rewrittenLines;

    rewrittenStanzas.push(indentedRewrittenLines);
    stanzaValidation.push({
      stanzaIndex: i,
      originalLines: originalLineCount,
      rewrittenLines: rewrittenLineCount,
      valid: linesMatch,
    });
  }

  const totalOriginalLines = stanzas.reduce((sum, s) => sum + s.length, 0);
  const totalRewrittenLines = rewrittenStanzas.reduce((sum, s) => sum + s.length, 0);

  console.log(`[RewritePoemByStanza] Complete: ${totalOriginalLines} → ${totalRewrittenLines} lines, all valid: ${allStanzasValid}`);

  return {
    rewrittenStanzas,
    originalStanzas: stanzas,
    totalOriginalLines,
    totalRewrittenLines,
    allStanzasValid,
    stanzaValidation,
    wasRewritten: anyWasRewritten,
    blankLinesBefore,  // Preserve vertical spacing info
  };
}
