// src/lib/story-processing/translation.ts
// Server-only translation using Anthropic Claude Haiku
// Used by both admin and user story pipelines (API routes only)

import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { generateTranslationPrompt, levelStringToNumber } from "./cefr-prompts";
import { logAnthropicCost } from "@/lib/cost-tracker";
import {
  addLineNumbers,
  parseNumberedLines,
  reconstructWithBlankLines,
  stripLineNumberPrefixes,
  detectTruncation,
  type TruncationResult,
} from "./translation-utils";

// Re-export utilities for backward compatibility
export {
  addLineNumbers,
  parseNumberedLines,
  reconstructWithBlankLines,
  stripLineNumberPrefixes,
  detectTruncation,
  type TruncationResult,
} from "./translation-utils";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 600000, // 10 minute timeout per request (large chapters need time)
});

// ============================================================================
// MAIN TRANSLATION FUNCTION
// Uses Claude Haiku with retry logic and truncation detection
// ============================================================================

export interface TranslationResult {
  translatedText: string;
  translatedLines: string[];
  alignment: {
    sourceLines: number;
    contentLines: number;
    translatedLines: number;
    blankLines: number;
  };
  truncated: boolean;
  truncationInfo?: TruncationResult;
}

export interface TranslationOptions {
  maxRetries?: number;
  storyId?: string;
  userId?: string;
  isPoetry?: boolean;
  /** Admin story slug for cost tracking (admin uploads don't have storyId) */
  adminStorySlug?: string;
}

/**
 * Translate text to the other language using Claude Haiku.
 * Uses line-by-line alignment with [N] prefixes.
 * Includes retry logic and truncation detection.
 *
 * @param text - The text to translate
 * @param sourceLanguage - The source language ("en" or "es")
 * @param level - The CEFR level (as string like "l3" or number like 3)
 * @param options - Optional settings: maxRetries, storyId, userId
 */
export async function translateText(
  text: string,
  sourceLanguage: "en" | "es",
  level: string | number,
  options: TranslationOptions = {}
): Promise<TranslationResult> {
  const { maxRetries = 3, storyId, userId, isPoetry = false, adminStorySlug } = options;
  const levelNum = typeof level === "string" ? levelStringToNumber(level) : level;
  const { numberedText, lineCount, totalLines, blankLinePositions } = addLineNumbers(text);
  const sourceLines = text.split("\n");

  const toLanguage = sourceLanguage === "en" ? "Spanish" : "English";
  const fromLanguage = sourceLanguage === "en" ? "English" : "Spanish";

  // Poetry-specific system prompt additions
  const poetryContext = isPoetry
    ? `

POETRY TRANSLATION EXPERTISE:
You are translating POETRY. This requires special care to preserve artistic elements:
- Rhyme: Try to maintain rhyme schemes using natural ${toLanguage} rhymes
- Rhythm: Preserve meter and syllable patterns where possible
- Imagery: Translate the emotional impact, not just literal words
- Sound: Recreate alliteration, assonance, and other sound devices
- Feel: The translation should FEEL like poetry in ${toLanguage}

Remember: A beautiful poem in ${toLanguage} is better than an awkward literal translation.`
    : "";

  const contentType = isPoetry ? "poetry" : "literature";

  const systemPrompt = `You are an expert literary translator specializing in ${fromLanguage} to ${toLanguage} translation for language learners.

CONTEXT: You are translating ${contentType} for educational language learning purposes. These texts may contain period-appropriate themes, archaic language, gothic/horror elements, or mature literary content typical of classic and contemporary literature. Your role is to faithfully translate the literary work while adapting vocabulary complexity for language learners.${poetryContext}

CRITICAL RULES:
1. Each line in the input starts with a number in brackets like [1], [2], [3], etc.
2. You MUST preserve these exact line numbers in your output.
3. Each numbered input line produces EXACTLY ONE numbered output line.
4. NEVER split a single input line into multiple output lines.
5. NEVER merge multiple input lines into one output lines.
6. Keep the same [N] prefix for each translated line.
7. Translate ALL lines - do not skip any.

Example:
Input:
[1] The cat sat on the mat.
[2] It was a sunny day.

Output:
[1] El gato se sentó en la alfombra.
[2] Era un día soleado.

Maintain CEFR level complexity. Return ONLY the numbered translated lines.`;

  const prompt = generateTranslationPrompt(numberedText, sourceLanguage, levelNum, isPoetry);

  // DEBUG: Log input preview to compare with output
  const inputLines = numberedText.split("\n").slice(0, 15);
  console.log(`[Translation] Input preview (first 15 of ${lineCount} content lines):`);
  inputLines.forEach((line, i) => console.log(`  ${i}: ${line.substring(0, 100)}${line.length > 100 ? "..." : ""}`));

  let lastError: Error | null = null;
  let bestResult: string[] | null = null;
  let bestResultCount = 0;
  let bestTruncationInfo: TruncationResult | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 16000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      // Log cost (fire-and-forget)
      logAnthropicCost("translation", "claude-haiku-4-5-20251001", response.usage, {
        userId,
        userStoryId: storyId,
        metadata: { level: levelNum, lineCount, attempt, ...(adminStorySlug && { adminStorySlug }) },
      });

      const rawResponse =
        response.content[0].type === "text"
          ? response.content[0].text.trim()
          : "";
      const stopReason = response.stop_reason;

      if (!rawResponse) {
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 2000 * attempt));
          continue;
        }
        throw new Error("No response from AI");
      }

      // DEBUG: Log raw response structure to diagnose line alignment issues
      const rawLines = rawResponse.split("\n").slice(0, 15);
      console.log(`[Translation] Raw response preview (first 15 lines of ${rawResponse.split("\n").length} total):`);
      rawLines.forEach((line, i) => console.log(`  ${i}: ${line.substring(0, 100)}${line.length > 100 ? "..." : ""}`));

      // Parse the numbered lines
      let translatedContentLines = parseNumberedLines(rawResponse, lineCount);

      // DEBUG: Log parsed result to see if line numbers are being extracted correctly
      console.log(`[Translation] Parsed lines preview (expecting ${lineCount} lines, got ${translatedContentLines.filter(l => l).length} non-empty):`);
      translatedContentLines.slice(0, 10).forEach((line, i) => {
        if (line) console.log(`  [${i + 1}]: ${line.substring(0, 80)}${line.length > 80 ? "..." : ""}`);
      });

      // Strip any remaining [N] prefixes
      translatedContentLines = stripLineNumberPrefixes(translatedContentLines);

      const translatedNonEmpty = translatedContentLines.filter(
        (l) => l.length > 0
      ).length;

      // Check for truncation
      // IMPORTANT: Compare content lines to content lines (sourceLines includes blanks, translatedContentLines doesn't)
      const sourceContentLines = sourceLines.filter((l) => l.trim() !== "");
      const truncationInfo = detectTruncation(
        sourceContentLines,
        translatedContentLines,
        lineCount,
        stopReason
      );

      // Track best result in case all attempts have issues
      if (translatedNonEmpty > bestResultCount) {
        bestResultCount = translatedNonEmpty;
        bestResult = translatedContentLines;
        bestTruncationInfo = truncationInfo;
      }

      if (truncationInfo.isTruncated) {
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 2000 * attempt));
          continue;
        }
        // Max retries reached, will use best result below
      } else {
        // Success!

        const fullTranslatedLines = reconstructWithBlankLines(
          translatedContentLines,
          blankLinePositions,
          totalLines
        );

        return {
          translatedText: fullTranslatedLines.join("\n"),
          translatedLines: fullTranslatedLines,
          alignment: {
            sourceLines: totalLines,
            contentLines: lineCount,
            translatedLines: translatedNonEmpty,
            blankLines: blankLinePositions.length,
          },
          truncated: false,
        };
      }
    } catch (error: any) {
      lastError = error;
      console.error(`[Translation] Error:`, error.message);
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  }

  // If we have any result, use it (even if partial)
  if (bestResult && bestResultCount > 0) {

    const fullTranslatedLines = reconstructWithBlankLines(
      bestResult,
      blankLinePositions,
      totalLines
    );

    return {
      translatedText: fullTranslatedLines.join("\n"),
      translatedLines: fullTranslatedLines,
      alignment: {
        sourceLines: totalLines,
        contentLines: lineCount,
        translatedLines: bestResultCount,
        blankLines: blankLinePositions.length,
      },
      truncated: true,
      truncationInfo: bestTruncationInfo || undefined,
    };
  }

  // Complete failure
  if (lastError) {
    throw lastError;
  }

  throw new Error(`Translation failed after ${maxRetries} attempts`);
}
