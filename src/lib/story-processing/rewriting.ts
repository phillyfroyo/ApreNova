// src/lib/story-processing/rewriting.ts
// Server-only rewriting for CEFR level adaptation
// Used by both admin and user story pipelines (API routes only)

import "server-only";

import { OpenAI } from "openai";
import { generateRewritePrompt, levelStringToNumber } from "./cefr-prompts";
import { logOpenAICost } from "@/lib/cost-tracker";
import { isErrorResponse, stripPreamble } from "./rewriting-utils";

// Re-export utilities for backward compatibility
export { isErrorResponse, stripPreamble } from "./rewriting-utils";

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
