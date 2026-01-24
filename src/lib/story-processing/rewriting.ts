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
  const { isPoetry = false, maxRetries = 2, storyId, userId } = options;
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
        metadata: { sourceLevel: sourceLevelNum, targetLevel: targetLevelNum, attempt },
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

      // For poetry: validate line count matches (strict requirement)
      if (isPoetry) {
        const originalLines = text.split("\n").length;
        const rewrittenLines = rewrittenText.split("\n").length;

        if (originalLines !== rewrittenLines) {
          console.warn(
            `[Rewrite] Poetry line count mismatch: original=${originalLines}, rewritten=${rewrittenLines} (attempt ${attempt})`
          );
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, 2000 * attempt));
            continue;
          }
          // On final attempt, still return the rewrite but log the issue
          console.error(
            `[Rewrite] Poetry line count mismatch after ${maxRetries} attempts, using result anyway`
          );
        }
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
  const lines = text.split('\n');
  const stanzaMarked = detectStanzas(lines);

  // Group lines by stanzaNumber
  const stanzasMap = new Map<number, string[]>();

  for (const marked of stanzaMarked) {
    // Skip stanza break markers (empty lines between stanzas)
    if (marked.isStanzaBreak) continue;

    if (!stanzasMap.has(marked.stanzaNumber)) {
      stanzasMap.set(marked.stanzaNumber, []);
    }
    stanzasMap.get(marked.stanzaNumber)!.push(marked.text);
  }

  // Convert to array, sorted by stanza number
  const stanzaNumbers = Array.from(stanzasMap.keys()).sort((a, b) => a - b);
  return stanzaNumbers.map(num => stanzasMap.get(num)!);
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
}

/**
 * Rewrite a poem stanza-by-stanza.
 * Each stanza is sent to GPT separately with strict per-stanza line count validation.
 * This guarantees stanza boundaries are preserved (they're structural, not content).
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
  const stanzas = splitIntoStanzas(text);

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

    // Rewrite this stanza with poetry mode (strict line validation)
    const result = await rewriteToLevel(
      stanzaText,
      sourceLevel,
      targetLevel,
      language,
      {
        ...options,
        isPoetry: true,
        maxRetries: options.maxRetries || 3, // More retries for stanza-level
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
    const isValid = originalLineCount === rewrittenLineCount;

    if (!isValid) {
      console.warn(`[RewritePoemByStanza] Stanza ${i + 1} line count mismatch: ${originalLineCount} → ${rewrittenLineCount}`);
      allStanzasValid = false;
    }

    rewrittenStanzas.push(rewrittenLines);
    stanzaValidation.push({
      stanzaIndex: i,
      originalLines: originalLineCount,
      rewrittenLines: rewrittenLineCount,
      valid: isValid,
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
  };
}
