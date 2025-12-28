// src/lib/story-processing/rewriting.ts
// Shared rewriting utilities for CEFR level adaptation
// Used by both admin and user story pipelines

import { OpenAI } from "openai";
import { generateRewritePrompt, levelStringToNumber } from "./cefr-prompts";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============================================================================
// ERROR DETECTION
// Detects when AI returns error messages instead of actual content
// ============================================================================

/**
 * Patterns that indicate AI returned an error/refusal instead of content
 */
const ERROR_PATTERNS = [
  /^I'm sorry,?\s*(but)?/i,
  /^I apologize,?\s*(but)?/i,
  /^Unfortunately,?\s*(I )?(can't|cannot|couldn't)/i,
  /^I (can't|cannot|couldn't) (help|assist|complete|fulfill)/i,
  /^This (text|content|request) (contains|appears|seems)/i,
  /^I('m| am) not able to/i,
  /^As an AI/i,
];

/**
 * Patterns for preambles that should be stripped from responses
 */
const PREAMBLE_PATTERNS = [
  /^(Sure!|Sure,|Okay,|Here('s| is))[^\n]*\n+/i,
  /^(Here('s| is) the rewritten)[^\n]*:\n+/i,
  /^```[a-z]*\n?/i, // Opening code fence
  /\n?```$/i, // Closing code fence
  /^"""\n?/i, // Opening triple quotes
  /\n?"""$/i, // Closing triple quotes
];

/**
 * Check if the response is an error/refusal message
 */
export function isErrorResponse(text: string): boolean {
  const firstLine = text.split("\n")[0] || "";
  return ERROR_PATTERNS.some((pattern) => pattern.test(firstLine));
}

/**
 * Strip common preambles and formatting from AI response
 */
export function stripPreamble(text: string): string {
  let cleaned = text.trim();

  for (const pattern of PREAMBLE_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }

  return cleaned.trim();
}

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

/**
 * Rewrite text to a specific CEFR level.
 * Uses GPT-4 for quality rewrites with retry logic.
 *
 * @param text - The text to rewrite
 * @param sourceLevel - The detected source level (string like "l4" or number like 4)
 * @param targetLevel - The target level to rewrite to
 * @param language - The language of the text ("en" or "es")
 * @param isPoetry - Whether the text is poetry (preserves line breaks)
 * @param maxRetries - Maximum retry attempts (default: 2)
 */
export async function rewriteToLevel(
  text: string,
  sourceLevel: string | number,
  targetLevel: string | number,
  language: "en" | "es",
  isPoetry: boolean = false,
  maxRetries: number = 2
): Promise<RewriteResult> {
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
