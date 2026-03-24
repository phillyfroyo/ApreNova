"use client";

import { useState, useRef, useCallback } from "react";
import type { StoryData, LevelContent, DetectedChapter } from "../types";
import { useProcessingPipeline, type LevelState, type BasePipelineState } from "./useProcessingPipeline";
import { cleanText, splitIntoSubChunks } from "@/lib/admin/text-utils";
import { REWRITE_BATCH_SIZE, MAX_CHUNK_CHARS } from "../config/constants";

// ============================================
// Content Warning Scanner
// ============================================

export interface ContentWarning {
  level: number;
  chapter: number;    // 1-indexed
  line: number;       // 1-indexed
  type: "error_marker" | "ai_refusal" | "translation_failed" | "short_translation" | "quote_mismatch";
  text: string;       // The offending line
}

const AI_REFUSAL_PATTERNS = [
  /^I'm sorry,?\s*(but)?/i,
  /^I apologize,?\s*(but)?/i,
  /^Unfortunately,?\s*(I )?(can't|cannot|couldn't)/i,
  /^I (can't|cannot|couldn't) (help|assist|complete|fulfill|rewrite|translate)/i,
  /^I cannot (rewrite|translate)/i,
  /^As an AI/i,
];

/**
 * Scan level text for suspicious content (error markers, AI refusals).
 * Returns warnings with chapter and line numbers.
 */
export function scanContentWarnings(text: string, level: number): ContentWarning[] {
  if (!text) return [];
  const warnings: ContentWarning[] = [];

  // Split into chapters first
  const chapterParts = text.split(/---\s*(?:Chapter|Capítulo)\s+\d+[^-]*---/i);
  const chapterOffset = chapterParts[0]?.trim() === "" ? 1 : 0; // Skip empty pre-chapter text

  for (let chIdx = chapterOffset; chIdx < chapterParts.length; chIdx++) {
    const chapterNum = chapterOffset === 1 ? chIdx : chIdx + 1;
    const lines = chapterParts[chIdx].split("\n");

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];

      // Check for error markers
      if (line.includes("[ERROR:")) {
        warnings.push({
          level,
          chapter: chapterNum,
          line: lineIdx + 1,
          type: "error_marker",
          text: line.trim(),
        });
      }

      // Check for translation failed markers
      if (line.includes("[TRANSLATION_FAILED:")) {
        warnings.push({
          level,
          chapter: chapterNum,
          line: lineIdx + 1,
          type: "translation_failed",
          text: line.trim(),
        });
      }

      // Check for AI refusal patterns (only on non-empty lines)
      if (line.trim().length > 0) {
        for (const pattern of AI_REFUSAL_PATTERNS) {
          if (pattern.test(line.trim())) {
            warnings.push({
              level,
              chapter: chapterNum,
              line: lineIdx + 1,
              type: "ai_refusal",
              text: line.trim().slice(0, 100),
            });
            break; // Only one warning per line
          }
        }
      }
    }
  }

  return warnings;
}

/**
 * Compare source and translated text line-by-line to find suspiciously short translations.
 * A translated line that is less than 25% of the source line length (and source is > 40 chars)
 * is flagged as potentially truncated/incomplete.
 */
export function scanTranslationQuality(
  sourceText: string,
  translatedText: string,
  level: number
): ContentWarning[] {
  if (!sourceText || !translatedText) return [];
  const warnings: ContentWarning[] = [];

  const chapterDivider = /^---\s*(?:Chapter|Capítulo)\s+(\d+)[^-]*---$/i;

  const sourceChapterParts = sourceText.split(/---\s*(?:Chapter|Capítulo)\s+\d+[^-]*---/i);
  const transChapterParts = translatedText.split(/---\s*(?:Chapter|Capítulo)\s+\d+[^-]*---/i);

  // Detect chapter numbers from divider lines
  const sourceChapterNums: number[] = [];
  for (const line of sourceText.split("\n")) {
    const m = line.match(chapterDivider);
    if (m) sourceChapterNums.push(parseInt(m[1], 10));
  }

  const sourceOffset = sourceChapterParts[0]?.trim() === "" ? 1 : 0;
  const transOffset = transChapterParts[0]?.trim() === "" ? 1 : 0;

  const numChapters = Math.min(
    sourceChapterParts.length - sourceOffset,
    transChapterParts.length - transOffset
  );

  for (let chIdx = 0; chIdx < numChapters; chIdx++) {
    const chapterNum = sourceChapterNums[chIdx] || chIdx + 1;
    const sourceLines = sourceChapterParts[chIdx + sourceOffset].split("\n");
    const transLines = transChapterParts[chIdx + transOffset].split("\n");

    // Get content lines only (non-empty)
    const srcContent = sourceLines.filter(l => l.trim().length > 0);
    const transContent = transLines.filter(l => l.trim().length > 0);

    const compareCount = Math.min(srcContent.length, transContent.length);

    for (let i = 0; i < compareCount; i++) {
      const srcLine = srcContent[i].trim();
      const transLine = transContent[i].trim();

      // Flag if source is substantial (>40 chars) and translation is < 25% of source length
      if (srcLine.length > 40 && transLine.length < srcLine.length * 0.25) {
        warnings.push({
          level,
          chapter: chapterNum,
          line: i + 1,
          type: "short_translation",
          text: `"${transLine}" ← "${srcLine.slice(0, 80)}${srcLine.length > 80 ? '...' : ''}"`,
        });
      }
    }
  }

  return warnings;
}

/**
 * Compare original and rewritten/translated text to detect quotation mark mismatches.
 * Counts total quote characters per content line in each chapter.
 * If the counts differ, flags it as a quote_mismatch warning.
 */
const ALL_QUOTE_CHARS = /["\u201C\u201D\u00AB\u00BB]/g;

export function scanQuoteMismatches(
  originalText: string,
  comparisonText: string,
  level: number
): ContentWarning[] {
  if (!originalText || !comparisonText) return [];
  const warnings: ContentWarning[] = [];

  const chapterDivider = /^---\s*(?:Chapter|Capítulo)\s+(\d+)[^-]*---$/i;

  const origChapterParts = originalText.split(/---\s*(?:Chapter|Capítulo)\s+\d+[^-]*---/i);
  const compChapterParts = comparisonText.split(/---\s*(?:Chapter|Capítulo)\s+\d+[^-]*---/i);

  // Detect chapter numbers from divider lines
  const chapterNums: number[] = [];
  for (const line of originalText.split("\n")) {
    const m = line.match(chapterDivider);
    if (m) chapterNums.push(parseInt(m[1], 10));
  }

  const origOffset = origChapterParts[0]?.trim() === "" ? 1 : 0;
  const compOffset = compChapterParts[0]?.trim() === "" ? 1 : 0;

  const numChapters = Math.min(
    origChapterParts.length - origOffset,
    compChapterParts.length - compOffset
  );

  for (let chIdx = 0; chIdx < numChapters; chIdx++) {
    const chapterNum = chapterNums[chIdx] || chIdx + 1;
    let origLines = origChapterParts[chIdx + origOffset].split("\n");
    let compLines = compChapterParts[chIdx + compOffset].split("\n");

    // The chapter split leaves a leading empty line — strip it to match
    // the comparison modal's chapter parsing which starts after the divider
    if (origLines[0]?.trim() === "") origLines = origLines.slice(1);
    if (compLines[0]?.trim() === "") compLines = compLines.slice(1);

    // Build content-line-index → total-line-index mapping for comparison text
    const compContentToTotal: number[] = [];
    for (let j = 0; j < compLines.length; j++) {
      if (compLines[j].trim().length > 0) {
        compContentToTotal.push(j);
      }
    }

    // Get content lines only (non-empty)
    const origContent = origLines.filter(l => l.trim().length > 0);
    const compContent = compLines.filter(l => l.trim().length > 0);

    const compareCount = Math.min(origContent.length, compContent.length);

    for (let i = 0; i < compareCount; i++) {
      const origLine = origContent[i].trim();
      const compLine = compContent[i].trim();

      const origQuotes = (origLine.match(ALL_QUOTE_CHARS) || []).length;
      const compQuotes = (compLine.match(ALL_QUOTE_CHARS) || []).length;

      // Flag if: (1) rewrite has odd quotes when original doesn't (broken/unpaired), or
      //          (2) original has quotes but rewrite dropped them entirely
      const hasOddQuotes = compQuotes > 0 && compQuotes % 2 !== 0 && origQuotes % 2 === 0;
      const droppedDialogue = origQuotes > 0 && compQuotes === 0;

      if (hasOddQuotes || droppedDialogue) {
        warnings.push({
          level,
          chapter: chapterNum,
          line: (compContentToTotal[i] ?? i) + 1,
          type: "quote_mismatch",
          text: hasOddQuotes
            ? `Odd quotes (${compQuotes}): "${compLine.slice(0, 80)}${compLine.length > 80 ? '...' : ''}"`
            : `Dialogue dropped (${origQuotes} → 0): "${compLine.slice(0, 80)}${compLine.length > 80 ? '...' : ''}"`,
        });
      }
    }
  }

  return warnings;
}

/**
 * Compare two texts line-by-line within chapters to detect misaligned lines.
 * A misalignment is where one side has content and the other side is blank at the same line position.
 * This typically indicates a double-blank-line issue or paragraph merging/splitting.
 *
 * Only checks the first few lines of each chapter since that's where the off-by-one typically starts.
 */
export interface LineAlignmentWarning {
  chapter: number;       // 1-indexed chapter number
  line: number;          // 1-indexed line within chapter
  type: 'left_blank' | 'right_blank';  // Which side is blank
  leftContent: string;
  rightContent: string;
}

export function scanLineAlignment(
  leftText: string,
  rightText: string,
): LineAlignmentWarning[] {
  if (!leftText || !rightText) return [];
  const warnings: LineAlignmentWarning[] = [];

  const chapterDivider = /^---\s*(?:Chapter|Capítulo)\s+(\d+)[^-]*---$/i;

  // Split both texts into chapters
  const splitIntoChapters = (text: string) => {
    const lines = text.split("\n");
    const chapters: { number: number; lines: string[] }[] = [];
    let currentLines: string[] = [];
    let currentNum = 0;

    for (const line of lines) {
      const m = line.match(chapterDivider);
      if (m) {
        if (currentLines.length > 0 || chapters.length > 0) {
          chapters.push({ number: currentNum, lines: currentLines });
        }
        currentNum = parseInt(m[1], 10);
        currentLines = [];
      } else {
        currentLines.push(line);
      }
    }
    if (currentLines.length > 0) {
      chapters.push({ number: currentNum, lines: currentLines });
    }
    return chapters;
  };

  const leftChapters = splitIntoChapters(leftText);
  const rightChapters = splitIntoChapters(rightText);

  const numChapters = Math.min(leftChapters.length, rightChapters.length);

  for (let chIdx = 0; chIdx < numChapters; chIdx++) {
    const leftLines = leftChapters[chIdx].lines;
    const rightLines = rightChapters[chIdx].lines;
    const chapterNum = leftChapters[chIdx].number || chIdx + 1;

    // Check first 5 lines of each chapter for misalignment
    const checkCount = Math.min(5, leftLines.length, rightLines.length);
    for (let i = 0; i < checkCount; i++) {
      const leftIsBlank = leftLines[i].trim() === "";
      const rightIsBlank = rightLines[i].trim() === "";

      if (leftIsBlank !== rightIsBlank) {
        warnings.push({
          chapter: chapterNum,
          line: i + 1,
          type: leftIsBlank ? 'left_blank' : 'right_blank',
          leftContent: leftLines[i].trim().slice(0, 60) || '(blank)',
          rightContent: rightLines[i].trim().slice(0, 60) || '(blank)',
        });
      }
    }
  }

  return warnings;
}

// ============================================
// Types
// ============================================

export interface RewritePipelineState extends BasePipelineState {
  levels: Record<number, LevelState & {
    mode: 'generate' | 'use-original' | 'omit';
  }>;
}

export interface ChapterProgress {
  current: number;
  batchEnd: number;
  total: number;
  subChunk?: { current: number; total: number };
}

// ============================================
// Hook
// ============================================

export interface UseRewritePipelineOptions {
  storyData: StoryData;
  updateStoryData: (updates: Partial<StoryData>) => void;
  setIsProcessing: (v: boolean) => void;
}

export function useRewritePipeline({
  storyData,
  updateStoryData,
  setIsProcessing,
}: UseRewritePipelineOptions) {
  // Base pipeline for shared functionality
  const initialState: RewritePipelineState = {
    levels: {},
  };

  const pipeline = useProcessingPipeline<RewritePipelineState>(initialState);

  // ============================================
  // Local State
  // ============================================

  const [currentGenerating, setCurrentGenerating] = useState<number | null>(null);
  const [chapterProgress, setChapterProgress] = useState<ChapterProgress | null>(null);
  const [retryStatus, setRetryStatus] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Comparison modal state
  const [comparisonLevel, setComparisonLevel] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");

  // Refs
  const cancelledRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ============================================
  // Level Mode Management
  // ============================================

  const getLevelMode = useCallback((level: number): 'generate' | 'use-original' | 'omit' => {
    if (storyData.levelContent[level]?.mode) {
      return storyData.levelContent[level].mode;
    }
    return level === storyData.detectedLevel ? 'use-original' : 'generate';
  }, [storyData.levelContent, storyData.detectedLevel]);

  const setLevelMode = useCallback((level: number, mode: 'generate' | 'use-original' | 'omit') => {
    const current = storyData.levelContent[level] || {
      sourceText: "",
      translatedText: "",
      status: "pending" as const,
      mode: "generate" as const
    };
    const newStatus = mode === "omit" ? "omitted" as const : "pending" as const;
    updateStoryData({
      levelContent: {
        ...storyData.levelContent,
        [level]: { ...current, mode, status: newStatus },
      },
    });
  }, [storyData.levelContent, updateStoryData]);

  // ============================================
  // Comparison Modal
  // ============================================

  const openComparison = useCallback((level: number) => {
    if (level === -1) {
      setComparisonLevel(-1);
      setEditedText(storyData.rawText);
      setIsEditing(false);
    } else {
      const content = storyData.levelContent[level];
      if (content?.sourceText) {
        setComparisonLevel(level);
        setEditedText(content.sourceText);
        setIsEditing(false);
      }
    }
  }, [storyData.rawText, storyData.levelContent]);

  const closeComparison = useCallback(() => {
    setComparisonLevel(null);
    setIsEditing(false);
  }, []);

  const saveEditedText = useCallback(() => {
    if (comparisonLevel === -1) {
      // Update rawText and also sync the source level's sourceText if it exists
      const updates: Partial<StoryData> = { rawText: editedText };
      const sourceLevel = storyData.detectedLevel;
      if (sourceLevel && storyData.levelContent[sourceLevel]?.status === "done") {
        updates.levelContent = {
          ...storyData.levelContent,
          [sourceLevel]: {
            ...storyData.levelContent[sourceLevel],
            sourceText: editedText,
          },
        };
      }
      updateStoryData(updates);
      setIsEditing(false);
    } else if (comparisonLevel !== null) {
      const current = storyData.levelContent[comparisonLevel];
      updateStoryData({
        levelContent: {
          ...storyData.levelContent,
          [comparisonLevel]: {
            ...current,
            sourceText: editedText,
          },
        },
      });
      setIsEditing(false);
    }
  }, [comparisonLevel, editedText, storyData.levelContent, storyData.detectedLevel, updateStoryData]);

  // ============================================
  // Processing Control
  // ============================================

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    abortControllerRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    cancelledRef.current = false;
    abortControllerRef.current = new AbortController();
  }, []);

  // ============================================
  // Rewrite API
  // ============================================

  const rewriteChunk = useCallback(async (text: string, targetLevel: number): Promise<string> => {
    if (cancelledRef.current) {
      throw new Error("Cancelled");
    }

    // Determine if content is poetry based on STRUCTURE (not storyType which is cosmetic)
    // When structureType is "auto", use the detected structure from preprocessing
    const effectiveStructure = storyData.structureType === "auto"
      ? storyData.parsedResult?.stats?.structureType
      : storyData.structureType;
    const isPoetry = effectiveStructure === "anthology" || effectiveStructure === "epic";

    const response = await fetch("/api/admin/rewrite-level", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        sourceLanguage: storyData.sourceLanguage,
        targetLevel,
        sourceLevel: storyData.detectedLevel,
        isPoetry,
        slug: storyData.slug || undefined,
        sessionId: storyData.sessionId || undefined,
      }),
      signal: abortControllerRef.current?.signal,
    });

    if (cancelledRef.current) {
      throw new Error("Cancelled");
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      throw new Error("Rewrite response interrupted - please retry");
    }

    if (!response.ok) {
      const reason = data.failureReason || "unknown";
      console.error(`[rewriteChunk] Failed: ${data.error} (reason: ${reason}, input: ${text.length} chars)`);
      throw new Error(data.error || "Failed to generate");
    }

    return data.rewrittenText;
  }, [storyData.storyType, storyData.sourceLanguage, storyData.detectedLevel]);

  // Retry with exponential backoff (retries all transient errors, not just rate limits)
  const withRetry = useCallback(async <T,>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> => {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        // Don't retry cancellations
        if (lastError.name === "AbortError" || lastError.message === "Cancelled" || cancelledRef.current) {
          throw lastError;
        }
        if (attempt === maxRetries) {
          throw lastError;
        }
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`[Rewrite] Error: ${lastError.message}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  }, []);

  // Rewrite a single chapter with sub-chunk support
  const rewriteSingleChapter = useCallback(async (
    chapterText: string,
    chapterIndex: number,
    chapterTitle: string,
    level: number
  ): Promise<{ rewritten: string; error?: string }> => {
    if (!chapterText.trim()) {
      return { rewritten: "" };
    }

    try {
      const subChunks = splitIntoSubChunks(chapterText, MAX_CHUNK_CHARS);

      if (subChunks.length > 1) {
        console.log(`Rewrite: Chapter ${chapterIndex + 1} split into ${subChunks.length} sub-chunks (parallel)`);

        const subChunkPromises = subChunks.map((subChunk, j) =>
          withRetry(() => rewriteChunk(subChunk, level))
            .then(result => ({ index: j, result, success: true as const }))
            .catch(error => ({ index: j, error, original: subChunk, success: false as const }))
        );

        const results = await Promise.all(subChunkPromises);

        const rewrittenSubChunks: string[] = new Array(subChunks.length);
        let hasError = false;

        for (const result of results) {
          if (result.success) {
            // Normalize leading/trailing whitespace from AI response
            rewrittenSubChunks[result.index] = result.result.replace(/^\n+/, "").replace(/\n+$/, "");
          } else {
            hasError = true;
            rewrittenSubChunks[result.index] = `[ERROR: Sub-chunk ${result.index + 1} failed]\n\n${result.original}`;
          }
        }

        return {
          rewritten: rewrittenSubChunks.join("\n\n"),
          error: hasError ? "Some sub-chunks failed to rewrite" : undefined
        };
      } else {
        const rewritten = await withRetry(() => rewriteChunk(chapterText, level));
        // Normalize leading/trailing whitespace from AI response
        return { rewritten: rewritten.replace(/^\n+/, "").replace(/\n+$/, "") };
      }
    } catch (chunkError) {
      const isCancelled = (chunkError as Error).name === "AbortError" ||
                         (chunkError as Error).message === "Cancelled" ||
                         cancelledRef.current;
      if (isCancelled) {
        return { rewritten: chapterText };
      }

      return {
        rewritten: `[ERROR: Failed to rewrite chapter ${chapterTitle || chapterIndex + 1}]\n\n${chapterText}`,
        error: (chunkError as Error).message,
      };
    }
  }, [rewriteChunk, withRetry]);

  // Process a single level
  const processLevel = useCallback(async (level: number, accumulator: Record<number, LevelContent>) => {
    setCurrentGenerating(level);
    setChapterProgress(null);
    setError("");

    const mode = getLevelMode(level);

    accumulator[level] = { sourceText: "", translatedText: "", status: "generating", mode };
    updateStoryData({ levelContent: { ...accumulator } });

    try {
      if (level === storyData.detectedLevel || mode === "use-original") {
        // Preserve whitespace based on STRUCTURE (not storyType which is cosmetic)
        const effectiveStructure = storyData.structureType === "auto"
          ? storyData.parsedResult?.stats?.structureType
          : storyData.structureType;
        const preserveWhitespace = effectiveStructure === "anthology" || effectiveStructure === "epic";
        accumulator[level] = {
          sourceText: cleanText(storyData.rawText, { preserveWhitespace }),
          translatedText: "",
          status: "done",
          mode,
        };
        updateStoryData({ levelContent: { ...accumulator } });
        setCurrentGenerating(null);
        return true;
      }

      // Re-split rawText into chapters live (instead of using stale parsedResult.chapters)
      // This ensures any manual edits to the original text are reflected in the rewrite
      const chapterPattern = /^---\s*(?:Chapter|Capítulo)\s+(\d+)(?::\s*(.+?))?\s*---$/im;
      const liveChapters: { rawText: string; title: string; number: number }[] = [];
      {
        const rawText = storyData.rawText;
        const parts = rawText.split(/^(---\s*(?:Chapter|Capítulo)\s+\d+(?::\s*.+?)?\s*---)\s*$/im);
        // parts alternates: [preContent, divider1, content1, divider2, content2, ...]
        for (let pi = 1; pi < parts.length; pi += 2) {
          const divider = parts[pi];
          const content = parts[pi + 1] || "";
          const match = divider.match(chapterPattern);
          liveChapters.push({
            rawText: content.replace(/^\n+/, "").replace(/\s+$/, ""),
            title: match?.[2]?.trim() || "",
            number: match ? parseInt(match[1], 10) : Math.ceil(pi / 2),
          });
        }
        // Fallback: if no chapter markers found, use parsedResult chapters
        if (liveChapters.length === 0 && storyData.parsedResult?.chapters) {
          for (const ch of storyData.parsedResult.chapters) {
            liveChapters.push({ rawText: ch.rawText, title: ch.title || "", number: ch.number });
          }
        }
      }

      if (liveChapters.length > 1) {
        const rewrittenChapters: string[] = new Array(liveChapters.length).fill("");
        setChapterProgress({ current: 1, batchEnd: Math.min(REWRITE_BATCH_SIZE, liveChapters.length), total: liveChapters.length });

        for (let batchStart = 0; batchStart < liveChapters.length; batchStart += REWRITE_BATCH_SIZE) {
          if (cancelledRef.current) break;

          const batchEnd = Math.min(batchStart + REWRITE_BATCH_SIZE, liveChapters.length);
          const batchIndices = Array.from({ length: batchEnd - batchStart }, (_, i) => batchStart + i);

          console.log(`Rewrite: Processing chapters ${batchStart + 1}-${batchEnd} of ${liveChapters.length} in parallel`);
          setChapterProgress({ current: batchStart + 1, batchEnd, total: liveChapters.length });

          const batchPromises = batchIndices.map(i =>
            rewriteSingleChapter(liveChapters[i].rawText, i, liveChapters[i].title || "", level)
          );

          const batchResults = await Promise.allSettled(batchPromises);

          batchResults.forEach((result, batchIdx) => {
            const chapterIdx = batchStart + batchIdx;
            if (result.status === "fulfilled") {
              rewrittenChapters[chapterIdx] = result.value.rewritten;
            } else {
              rewrittenChapters[chapterIdx] = `[ERROR: Failed to rewrite chapter ${chapterIdx + 1}]\n\n${liveChapters[chapterIdx].rawText}`;
            }
          });

          const nextBatchEnd = Math.min(batchEnd + REWRITE_BATCH_SIZE, liveChapters.length);
          setChapterProgress({ current: batchEnd + 1, batchEnd: nextBatchEnd, total: liveChapters.length });
        }

        // Check if cancelled before saving
        if (cancelledRef.current) {
          accumulator[level] = { sourceText: "", translatedText: "", status: "pending", mode };
          updateStoryData({ levelContent: { ...accumulator } });
          setChapterProgress(null);
          console.log(`[processLevel] L${level} generation cancelled, reset to pending`);
          return false;
        }

        // Auto-retry any failed chapters individually
        // Use includes() not startsWith() — sub-chunk errors appear mid-text
        const failedIndices = rewrittenChapters
          .map((text, idx) => text.includes("[ERROR:") ? idx : -1)
          .filter(idx => idx !== -1);

        if (failedIndices.length > 0 && !cancelledRef.current) {
          console.log(`[Rewrite] L${level}: ${failedIndices.length} failed chapters, retrying individually...`);
          setRetryStatus(`${failedIndices.length} failed chapter${failedIndices.length > 1 ? 's' : ''} detected, retrying...`);

          for (let i = 0; i < failedIndices.length; i++) {
            if (cancelledRef.current) break;
            const chapterIdx = failedIndices[i];
            console.log(`[Rewrite] Retrying chapter ${chapterIdx + 1}...`);
            setRetryStatus(`Retrying chapter ${chapterIdx + 1} (${i + 1} of ${failedIndices.length})`);

            const result = await rewriteSingleChapter(
              liveChapters[chapterIdx].rawText, chapterIdx, liveChapters[chapterIdx].title || "", level
            );
            rewrittenChapters[chapterIdx] = result.rewritten;
          }
          setRetryStatus(null);
        }

        // Check for any still-failed chapters
        const stillFailed = rewrittenChapters.filter(text => text.includes("[ERROR:")).length;
        if (stillFailed > 0) {
          console.warn(`[Rewrite] L${level}: ${stillFailed} chapters still failed after retry`);
          setError(`L${level}: ${stillFailed} chapter${stillFailed > 1 ? 's' : ''} failed after retry`);
        }

        const fullRewrittenText = rewrittenChapters
          .map((text, idx) => {
            const chapterNumber = liveChapters[idx]?.number || idx + 1;
            const rawTitle = liveChapters[idx]?.title || "";
            const isMeaningfulTitle = rawTitle.length > 0 &&
              !/^(Chapter|Section|Part|Capítulo|Sección|Parte|Full Text)\s*\d*$/i.test(rawTitle.trim());
            const divider = isMeaningfulTitle
              ? `--- Chapter ${chapterNumber}: ${rawTitle} ---`
              : `--- Chapter ${chapterNumber} ---`;
            // Trim leading/trailing blank lines from rewritten text to prevent
            // off-by-one alignment when chapters are reassembled with dividers
            const normalizedText = text.replace(/^\n+/, "").replace(/\n+$/, "");
            return `${divider}\n\n${normalizedText}`;
          })
          .join("\n\n");

        // Preserve whitespace based on STRUCTURE (not storyType which is cosmetic)
        const effectiveStructureForSave = storyData.structureType === "auto"
          ? storyData.parsedResult?.stats?.structureType
          : storyData.structureType;
        const preserveWhitespaceForSave = effectiveStructureForSave === "anthology" || effectiveStructureForSave === "epic";
        accumulator[level] = {
          sourceText: cleanText(fullRewrittenText, { preserveWhitespace: preserveWhitespaceForSave }),
          translatedText: "",
          status: "done",
          mode,
        };
        updateStoryData({ levelContent: { ...accumulator } });
        setChapterProgress(null);
        return true;
      } else {
        // Preserve whitespace based on STRUCTURE (not storyType which is cosmetic)
        const effectiveStructureSingle = storyData.structureType === "auto"
          ? storyData.parsedResult?.stats?.structureType
          : storyData.structureType;
        const preserveWhitespaceSingle = effectiveStructureSingle === "anthology" || effectiveStructureSingle === "epic";
        const rewrittenText = await rewriteChunk(cleanText(storyData.rawText, { preserveWhitespace: preserveWhitespaceSingle }), level);
        accumulator[level] = {
          sourceText: cleanText(rewrittenText, { preserveWhitespace: preserveWhitespaceSingle }),
          translatedText: "",
          status: "done",
          mode,
        };
        updateStoryData({ levelContent: { ...accumulator } });
        return true;
      }
    } catch (err) {
      accumulator[level] = { sourceText: "", translatedText: "", status: "error", mode };
      updateStoryData({ levelContent: { ...accumulator } });
      setError(`Failed to generate L${level}: ${err instanceof Error ? err.message : "Unknown error"}`);
      return false;
    } finally {
      setCurrentGenerating(null);
      setChapterProgress(null);
    }
  }, [storyData, updateStoryData, getLevelMode, rewriteChunk, rewriteSingleChapter]);

  // Process a single level (public API)
  const processSingleLevel = useCallback(async (level: number) => {
    reset();
    setIsProcessing(true);
    const accumulator = { ...storyData.levelContent };
    await processLevel(level, accumulator);
    setIsProcessing(false);
  }, [storyData.levelContent, processLevel, reset, setIsProcessing]);

  // Process all levels
  const processAllLevels = useCallback(async () => {
    reset();
    setIsProcessing(true);
    setError("");
    const accumulator = { ...storyData.levelContent };

    for (const level of [1, 2, 3, 4, 5, 6]) {
      if (cancelledRef.current) break;

      const mode = getLevelMode(level);
      if (mode === "omit" || accumulator[level]?.status === "done") {
        continue;
      }
      await processLevel(level, accumulator);
    }

    cancelledRef.current = false;
    abortControllerRef.current = null;
    setIsProcessing(false);
  }, [storyData.levelContent, processLevel, getLevelMode, reset, setIsProcessing]);

  // ============================================
  // Status Helpers
  // ============================================

  const getLevelStatus = useCallback((level: number) => {
    return storyData.levelContent[level]?.status ?? "pending";
  }, [storyData.levelContent]);

  const isLevelDone = useCallback((level: number) => {
    return getLevelStatus(level) === "done";
  }, [getLevelStatus]);

  const isLevelGenerating = useCallback((level: number) => {
    return currentGenerating === level;
  }, [currentGenerating]);

  // Reset a level back to pending (clears generated content)
  const resetLevel = useCallback((level: number) => {
    const accumulator = { ...storyData.levelContent };
    accumulator[level] = { sourceText: "", translatedText: "", status: "pending", mode: getLevelMode(level) };
    updateStoryData({ levelContent: accumulator });
    console.log(`[resetLevel] L${level} reset to pending`);
  }, [storyData.levelContent, getLevelMode, updateStoryData]);

  // Scan a level's source text for suspicious content
  const getContentWarnings = useCallback((level: number): ContentWarning[] => {
    const content = storyData.levelContent[level];
    if (!content?.sourceText) return [];
    return scanContentWarnings(content.sourceText, level);
  }, [storyData.levelContent]);

  return {
    // State
    currentGenerating,
    chapterProgress,
    retryStatus,
    error,
    setError,

    // Level mode
    getLevelMode,
    setLevelMode,

    // Processing
    processSingleLevel,
    processAllLevels,
    cancel,

    // Status
    getLevelStatus,
    isLevelDone,
    isLevelGenerating,
    resetLevel,
    getContentWarnings,

    // Comparison modal
    comparisonLevel,
    isEditing,
    editedText,
    setEditedText,
    setIsEditing,
    openComparison,
    closeComparison,
    saveEditedText,
  };
}

export default useRewritePipeline;
