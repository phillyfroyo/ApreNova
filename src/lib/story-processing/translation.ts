// src/lib/story-processing/translation.ts
// Shared translation utilities using Anthropic Claude Haiku
// Used by both admin and user story pipelines

import Anthropic from "@anthropic-ai/sdk";
import { generateTranslationPrompt, levelStringToNumber } from "./cefr-prompts";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 120000, // 2 minute timeout per request
});

// ============================================================================
// LINE NUMBER ALIGNMENT UTILITIES
// These functions handle the [N] prefix system for maintaining line alignment
// ============================================================================

/**
 * Add line numbers to NON-BLANK lines only for translation alignment.
 * Tracks which lines are blank so we can reconstruct later.
 *
 * Input: "line1\n\nline3"
 * Output: {
 *   numberedText: "[1] line1\n[2] line3",
 *   lineCount: 2,
 *   blankLinePositions: [1] // 0-indexed positions of blank lines
 * }
 */
export function addLineNumbers(text: string): {
  numberedText: string;
  lineCount: number;
  totalLines: number;
  blankLinePositions: number[];
} {
  const lines = text.split("\n");
  const blankLinePositions: number[] = [];
  const contentLines: string[] = [];

  lines.forEach((line, idx) => {
    if (line.trim() === "") {
      blankLinePositions.push(idx);
    } else {
      contentLines.push(`[${contentLines.length + 1}] ${line}`);
    }
  });

  return {
    numberedText: contentLines.join("\n"),
    lineCount: contentLines.length,
    totalLines: lines.length,
    blankLinePositions,
  };
}

/**
 * Parse numbered lines from translation response.
 * Extracts content by line number, stripping the [N] prefix.
 */
export function parseNumberedLines(
  text: string,
  expectedCount: number
): string[] {
  const result: string[] = new Array(expectedCount).fill("");

  // Match patterns like [1] text, [2] text, etc.
  const linePattern = /\[(\d+)\]\s*([^\n]*)/g;

  let match;
  while ((match = linePattern.exec(text + "\n")) !== null) {
    const lineNum = parseInt(match[1], 10);
    let lineText = match[2].trim();

    // Double-check: strip any remaining [N] prefix that might be nested
    lineText = lineText.replace(/^\[\d+\]\s*/, "");

    if (lineNum >= 1 && lineNum <= expectedCount) {
      result[lineNum - 1] = lineText;
    }
  }

  return result;
}

/**
 * Reconstruct full text by re-inserting blank lines at their original positions
 */
export function reconstructWithBlankLines(
  translatedLines: string[],
  blankLinePositions: number[],
  totalLines: number
): string[] {
  const result: string[] = [];
  let translatedIdx = 0;

  for (let i = 0; i < totalLines; i++) {
    if (blankLinePositions.includes(i)) {
      result.push(""); // Re-insert blank line
    } else {
      result.push(translatedLines[translatedIdx] || "");
      translatedIdx++;
    }
  }

  return result;
}

/**
 * Final cleanup: strip any [N] prefixes that might have leaked through
 */
export function stripLineNumberPrefixes(lines: string[]): string[] {
  return lines.map((line) => line.replace(/^\[\d+\]\s*/, "").trim());
}

// ============================================================================
// TRUNCATION DETECTION
// Borrowed from admin pipeline - detects when translations are incomplete
// ============================================================================

export interface TruncationResult {
  isTruncated: boolean;
  reasons: string[];
  translatedNonEmpty: number;
  punctuationMismatches: number;
  mismatchedLines: number[];
}

/**
 * Check for truncation issues in translation response
 */
export function detectTruncation(
  sourceLines: string[],
  translatedLines: string[],
  lineCount: number,
  stopReason: string | null | undefined
): TruncationResult {
  const reasons: string[] = [];
  let isTruncated = false;
  let punctuationMismatches = 0;
  const mismatchedLines: number[] = [];

  const translatedNonEmpty = translatedLines.filter((l) => l.length > 0).length;

  // Check 1: API hit max_tokens limit (definitive truncation)
  if (stopReason === "max_tokens") {
    isTruncated = true;
    reasons.push("API response hit max_tokens limit");
  }

  // Check 2: Line count mismatch - MUST be exact match for bilingual alignment
  if (translatedNonEmpty !== lineCount) {
    isTruncated = true;
    reasons.push(`Line count mismatch: ${translatedNonEmpty}/${lineCount} (must be exact)`);
  }

  // Check 3: Compare last source line length vs last translated line length
  const nonEmptySourceLines = sourceLines.filter((l) => l.trim());
  const lastSourceLine = nonEmptySourceLines[nonEmptySourceLines.length - 1] || "";
  const lastTranslatedLine = translatedLines.filter((l) => l.length > 0).pop() || "";

  if (lastSourceLine.length > 50 && lastTranslatedLine.length < lastSourceLine.length * 0.3) {
    isTruncated = true;
    reasons.push(
      `Final line too short: ${lastTranslatedLine.length} chars vs ${lastSourceLine.length} source chars`
    );
  }

  // Check 4: Punctuation mismatch at line endings
  const sentenceEndPunctuation = /[.!?。？！"']$/;

  for (let i = 0; i < Math.min(sourceLines.length, translatedLines.length); i++) {
    const sourceLine = sourceLines[i]?.trim() || "";
    const transLine = translatedLines[i]?.trim() || "";

    if (
      sourceLine.length > 10 &&
      sentenceEndPunctuation.test(sourceLine) &&
      !sentenceEndPunctuation.test(transLine) &&
      transLine.length > 0
    ) {
      punctuationMismatches++;
      if (mismatchedLines.length < 5) {
        mismatchedLines.push(i + 1);
      }
    }
  }

  if (punctuationMismatches > 3) {
    isTruncated = true;
    reasons.push(
      `Punctuation mismatch: ${punctuationMismatches} lines end differently`
    );
  }

  return {
    isTruncated,
    reasons,
    translatedNonEmpty,
    punctuationMismatches,
    mismatchedLines,
  };
}

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

/**
 * Translate text to the other language using Claude Haiku.
 * Uses line-by-line alignment with [N] prefixes.
 * Includes retry logic and truncation detection.
 *
 * @param text - The text to translate
 * @param sourceLanguage - The source language ("en" or "es")
 * @param level - The CEFR level (as string like "l3" or number like 3)
 * @param maxRetries - Maximum retry attempts (default: 3)
 */
export async function translateText(
  text: string,
  sourceLanguage: "en" | "es",
  level: string | number,
  maxRetries: number = 3
): Promise<TranslationResult> {
  const levelNum = typeof level === "string" ? levelStringToNumber(level) : level;
  const { numberedText, lineCount, totalLines, blankLinePositions } = addLineNumbers(text);
  const sourceLines = text.split("\n");

  const toLanguage = sourceLanguage === "en" ? "Spanish" : "English";
  const fromLanguage = sourceLanguage === "en" ? "English" : "Spanish";

  const systemPrompt = `You are an expert literary translator specializing in ${fromLanguage} to ${toLanguage} translation for language learners.

CONTEXT: You are translating literature for educational language learning purposes. These texts may contain period-appropriate themes, archaic language, gothic/horror elements, or mature literary content typical of classic and contemporary literature. Your role is to faithfully translate the literary work while adapting vocabulary complexity for language learners.

CRITICAL RULES:
1. Each line in the input starts with a number in brackets like [1], [2], [3], etc.
2. You MUST preserve these exact line numbers in your output.
3. Each numbered input line produces EXACTLY ONE numbered output line.
4. NEVER split a single input line into multiple output lines.
5. NEVER merge multiple input lines into one output line.
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

  const prompt = generateTranslationPrompt(numberedText, sourceLanguage, levelNum);

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

      // Parse the numbered lines
      let translatedContentLines = parseNumberedLines(rawResponse, lineCount);

      // Strip any remaining [N] prefixes
      translatedContentLines = stripLineNumberPrefixes(translatedContentLines);

      const translatedNonEmpty = translatedContentLines.filter(
        (l) => l.length > 0
      ).length;

      // Check for truncation
      const truncationInfo = detectTruncation(
        sourceLines,
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
