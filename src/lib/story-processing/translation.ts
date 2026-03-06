// src/lib/story-processing/translation.ts
// ⚠️  SHARED MODULE — Used by BOTH admin and user pipelines.
//     Do NOT duplicate translation logic elsewhere.
//
// Server-only translation using Anthropic Claude Haiku.
// Key exports:
//   translateText()    — Low-level: translate a block of text (line-numbered alignment)
//   translateChapter() — High-level: translate a full chapter (chunking + alignment + cleaning)

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
  alignLeadingBlanks,
  type TruncationResult,
} from "./translation-utils";
import { cleanText } from "@/lib/admin/text-utils";
import { splitChapterForTranslation, TRANSLATION_SUB_CHUNK_CHARS } from "./processing-config";

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
  const { numberedText, lineCount, totalLines, blankLinePositions, structuralLines } = addLineNumbers(text);
  const sourceLines = text.split("\n");

  // DEBUG: Log blank line info to trace whitespace preservation
  if (blankLinePositions.length > 0 || totalLines !== lineCount || structuralLines.length > 0) {
    console.log(`[Translation] Line info: ${blankLinePositions.length} blanks, ${structuralLines.length} structural, ${lineCount} content lines, ${totalLines} total lines`);
    if (blankLinePositions.length > 0) {
      console.log(`[Translation] First 10 blank positions: ${blankLinePositions.slice(0, 10).join(', ')}`);
    }
    if (structuralLines.length > 0) {
      console.log(`[Translation] Structural lines: ${structuralLines.map(s => `pos ${s.position}: "${s.text.slice(0, 30)}"`).join(', ')}`);
    }
  }

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
8. Preserve ALL quotation marks in dialogue. If the original has "..." the translation MUST also have "..." — never drop opening or closing quotes.

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

  // Dynamically calculate max_tokens based on input size.
  // Translation output is roughly the same size as input (line-for-line).
  // Spanish text tends to be ~15-20% longer than English, so use 2x multiplier for safety.
  // Claude Haiku 4.5 supports up to 64K output tokens, so we have plenty of headroom.
  const estimatedInputTokens = Math.ceil(numberedText.length / 4);
  const dynamicMaxTokens = Math.min(
    Math.max(Math.ceil(estimatedInputTokens * 2), 4000),
    64000
  );
  console.log(`[Translation] Dynamic max_tokens: ${dynamicMaxTokens} (input: ${numberedText.length} chars, ~${estimatedInputTokens} tokens)`);

  let lastError: Error | null = null;
  let bestResult: string[] | null = null;
  let bestResultCount = 0;
  let bestTruncationInfo: TruncationResult | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: dynamicMaxTokens,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      // Log cost (fire-and-forget, swallow DB errors)
      logAnthropicCost("translation", "claude-haiku-4-5-20251001", response.usage, {
        userId,
        userStoryId: storyId,
        metadata: { level: levelNum, lineCount, attempt, ...(adminStorySlug && { adminStorySlug }) },
      }).catch(() => {});

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

      // Repair mismatched quotation marks by comparing with source content lines
      // Match all quote types: straight ", curly " ", and guillemets « »
      const ALL_QUOTES_RE = /["\u201C\u201D\u00AB\u00BB]/g;
      const OPEN_QUOTE_RE = /^["\u201C\u00AB]/;
      const CLOSE_QUOTE_RE = /["\u201D\u00BB]\s*$/;
      const sourceContentLinesForRepair = sourceLines.filter((l) => l.trim() !== "");
      for (let i = 0; i < translatedContentLines.length && i < sourceContentLinesForRepair.length; i++) {
        const src = sourceContentLinesForRepair[i];
        let tgt = translatedContentLines[i];
        if (!src || !tgt) continue;
        const srcQuotes = (src.match(ALL_QUOTES_RE) || []).length;
        const tgtQuotes = (tgt.match(ALL_QUOTES_RE) || []).length;
        if (srcQuotes > 0) {
          const srcTrimmed = src.trimStart();
          const tgtTrimmed = tgt.trimStart();
          // Check opening/closing positions regardless of total count
          if (OPEN_QUOTE_RE.test(srcTrimmed) && !OPEN_QUOTE_RE.test(tgtTrimmed)) {
            const openChar = srcTrimmed.match(OPEN_QUOTE_RE)![0];
            const leadingSpace = tgt.match(/^(\s*)/)?.[1] || '';
            tgt = leadingSpace + openChar + tgtTrimmed;
          }
          if (CLOSE_QUOTE_RE.test(src.trimEnd()) && !CLOSE_QUOTE_RE.test(tgt.trimEnd())) {
            const closeChar = src.trimEnd().match(/(["\u201D\u00BB])\s*$/)![1];
            tgt = tgt.trimEnd() + closeChar;
          }
          if (tgt !== translatedContentLines[i]) {
            console.log(`[Translation] Repaired quotes on line ${i + 1}`);
            translatedContentLines[i] = tgt;
          }
        }
      }

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
          totalLines,
          structuralLines
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
      totalLines,
      structuralLines
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

// ============================================================================
// CHAPTER-LEVEL TRANSLATION
// Shared by both admin and user pipelines.
// Handles chunking, alignment, and cleaning — the complete translate-a-chapter flow.
// ============================================================================

export interface TranslateChapterOptions {
  storyId?: string;
  userId?: string;
  isPoetry?: boolean;
  adminStorySlug?: string;
}

/**
 * Translate a full chapter of text, handling sub-chunking for large chapters.
 * This is the single source of truth for chapter translation logic, shared
 * by both admin and user pipelines.
 *
 * Steps (matching the admin pipeline's working behavior):
 * 1. If small enough, call translateText() directly
 * 2. If large, splitChapterForTranslation() → translateText() per chunk → join with '\n\n'
 * 3. alignLeadingBlanks(sourceText, translatedText) — match leading blank lines
 * 4. cleanText(translatedText) — strip markdown artifacts, normalize whitespace
 * 5. Return { translatedText, translatedLines }
 */
export async function translateChapter(
  chapterText: string,
  sourceLanguage: "en" | "es",
  level: string | number,
  options: TranslateChapterOptions = {}
): Promise<{ translatedText: string; translatedLines: string[] }> {
  const { storyId, userId, isPoetry = false, adminStorySlug } = options;

  const translateOptions: TranslationOptions = {
    storyId,
    userId,
    isPoetry,
    adminStorySlug,
  };

  let translatedText: string;

  // Step 1 & 2: Translate (with sub-chunking for large chapters)
  // For poetry, skip chunking as it can break stanza/verse structure
  if (chapterText.length > TRANSLATION_SUB_CHUNK_CHARS && !isPoetry) {
    // Large chapter — split at paragraph boundaries and translate each sub-chunk
    const subChunks = splitChapterForTranslation(chapterText);
    console.log(`[translateChapter] Splitting into ${subChunks.length} sub-chunks (${subChunks.map(c => c.length).join(', ')} chars)`);

    const translatedSubChunks: string[] = [];
    for (let i = 0; i < subChunks.length; i++) {
      console.log(`[translateChapter] Sub-chunk ${i + 1}/${subChunks.length}: ${subChunks[i].length} chars`);
      const result = await translateText(subChunks[i], sourceLanguage, level, translateOptions);
      translatedSubChunks.push(result.translatedText);
    }

    // Rejoin with blank line between sub-chunks (matching original paragraph breaks)
    translatedText = translatedSubChunks.join('\n\n');
  } else {
    // Small chapter or poetry — translate directly
    const result = await translateText(chapterText, sourceLanguage, level, translateOptions);
    translatedText = result.translatedText;
  }

  // Step 3: Align leading blank lines with source
  translatedText = alignLeadingBlanks(chapterText, translatedText);

  // Step 4: Clean text (strip markdown artifacts, normalize whitespace)
  translatedText = cleanText(translatedText, { preserveWhitespace: isPoetry });

  // Step 5: Return both text and lines
  return {
    translatedText,
    translatedLines: translatedText.split('\n'),
  };
}
