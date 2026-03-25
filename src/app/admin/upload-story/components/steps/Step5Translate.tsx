"use client";

import { useState, useCallback } from "react";
import type { StoryData, ChunkError, TranslationErrorType } from "../../types";
import { useTranslationPipeline } from "../../hooks/useTranslationPipeline";
import { scanContentWarnings, scanTranslationQuality, scanQuoteMismatches } from "../../hooks/useRewritePipeline";
import { ComparisonModal } from "@/components/ComparisonModal";
import { detectAlignmentIssues, type ChapterAlignmentResult } from "@/lib/user-stories/alignment-check";

interface Step5TranslateProps {
  storyData: StoryData;
  updateStoryData: (updates: Partial<StoryData>) => void;
  isProcessing: boolean;
  setIsProcessing: (v: boolean) => void;
}

export function Step5Translate({
  storyData,
  updateStoryData,
  isProcessing,
  setIsProcessing,
}: Step5TranslateProps) {
  const pipeline = useTranslationPipeline({
    storyData,
    updateStoryData,
    setIsProcessing,
  });

  const {
    translatingLevels,
    levelProgress,
    error,
    setError,
    chunkErrors,
    setChunkErrors,
    copiedFromLevel,
    translateSingleLevel,
    translateAllLevels,
    cancel,
    resetTranslation,
    retranslateChapter,
    isTranslationComplete,
  } = pipeline;

  // Local UI state for error management
  const [expandedError, setExpandedError] = useState<string | null>(null);
  const [manualOverrideText, setManualOverrideText] = useState<Record<string, string>>({});
  const [expandedLineBreakdown, setExpandedLineBreakdown] = useState<number | null>(null);

  // Translation comparison modal state
  const [translationComparisonLevel, setTranslationComparisonLevel] = useState<number | null>(null);
  const [isRetranslatingChapter, setIsRetranslatingChapter] = useState(false);

  const openTranslationComparison = useCallback((level: number) => {
    const content = storyData.levelContent[level];
    if (content?.translatedText) {
      setTranslationComparisonLevel(level);
    }
  }, [storyData.levelContent]);

  const closeTranslationComparison = useCallback(() => {
    setTranslationComparisonLevel(null);
  }, []);

  const saveTranslationFromModal = useCallback((edits: { left?: string; right?: string }) => {
    if (translationComparisonLevel === null) return;
    const content = storyData.levelContent[translationComparisonLevel];
    if (!content) return;

    updateStoryData({
      levelContent: {
        ...storyData.levelContent,
        [translationComparisonLevel]: {
          ...content,
          ...(edits.left !== undefined && { sourceText: edits.left }),
          ...(edits.right !== undefined && { translatedText: edits.right }),
        },
      },
    });
  }, [translationComparisonLevel, storyData.levelContent, updateStoryData]);

  const handleRetranslateChapter = useCallback(async (chapterIndex: number, chapterText: string, numChunks: number) => {
    if (translationComparisonLevel === null) return;
    setIsRetranslatingChapter(true);
    try {
      await retranslateChapter(translationComparisonLevel, chapterIndex, chapterText, numChunks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retranslation failed");
    } finally {
      setIsRetranslatingChapter(false);
    }
  }, [translationComparisonLevel, retranslateChapter, setError]);

  // Error helper functions
  const getErrorIcon = (errorType: TranslationErrorType): string => {
    switch (errorType) {
      case 'rate_limit': return String.fromCodePoint(0x23F1, 0xFE0F);
      case 'content_refusal': return String.fromCodePoint(0x1F6AB);
      case 'network': return String.fromCodePoint(0x1F4E1);
      case 'timeout': return String.fromCodePoint(0x23F3);
      case 'malformed': return String.fromCodePoint(0x26A0, 0xFE0F);
      default: return String.fromCodePoint(0x2753);
    }
  };

  const getErrorDisplayMessage = (errorType: TranslationErrorType): string => {
    switch (errorType) {
      case 'rate_limit': return 'Rate limited - retry later';
      case 'content_refusal': return 'Content policy issue';
      case 'network': return 'Network error';
      case 'timeout': return 'Request timed out';
      case 'malformed': return 'Malformed response';
      default: return 'Unknown error';
    }
  };

  const retryChunk = useCallback(async (level: number, chunkError: ChunkError) => {
    setIsProcessing(true);
    setError("");

    try {
      const response = await fetch("/api/admin/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: chunkError.originalText,
          fromLanguage: storyData.sourceLanguage,
          level,
          slug: storyData.slug || undefined,
          isPoetry: storyData.structureType === "anthology" || storyData.structureType === "epic",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Translation failed");
      }

      const data = await response.json();
      const translatedText = data.translatedText;

      const currentContent = storyData.levelContent[level];
      if (currentContent?.translatedText) {
        const placeholder = chunkError.subChunkIndex !== undefined
          ? `[TRANSLATION_FAILED:${chunkError.chapterIndex}:${chunkError.subChunkIndex}]`
          : `[TRANSLATION_FAILED:${chunkError.chapterIndex}]`;

        const lines = currentContent.translatedText.split('\n');
        const newLines: string[] = [];
        let skipUntilDivider = false;

        for (const line of lines) {
          if (line.includes(placeholder)) {
            newLines.push(translatedText);
            skipUntilDivider = true;
          } else if (skipUntilDivider) {
            if (line.startsWith('--- Cap') || line.startsWith('[TRANSLATION_FAILED:')) {
              skipUntilDivider = false;
              newLines.push(line);
            }
          } else {
            newLines.push(line);
          }
        }

        updateStoryData({
          levelContent: {
            ...storyData.levelContent,
            [level]: {
              ...currentContent,
              translatedText: newLines.join('\n'),
            },
          },
        });

        setChunkErrors(prev => ({
          ...prev,
          [level]: (prev[level] || []).filter(e =>
            !(e.chapterIndex === chunkError.chapterIndex &&
              e.subChunkIndex === chunkError.subChunkIndex)
          ),
        }));
      }
    } catch (err) {
      setChunkErrors(prev => ({
        ...prev,
        [level]: (prev[level] || []).map(e =>
          e.chapterIndex === chunkError.chapterIndex &&
          e.subChunkIndex === chunkError.subChunkIndex
            ? { ...e, retryCount: e.retryCount + 1, errorMessage: (err as Error).message }
            : e
        ),
      }));
      setError(`Retry failed: ${(err as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [storyData, updateStoryData, setChunkErrors, setError, setIsProcessing]);

  const applyManualOverride = useCallback((level: number, chunkError: ChunkError) => {
    const errorKey = `${level}-${chunkError.chapterIndex}-${chunkError.subChunkIndex ?? 'main'}`;
    const overrideText = manualOverrideText[errorKey];

    if (!overrideText?.trim()) {
      setError("Please enter translation text before applying override.");
      return;
    }

    const currentContent = storyData.levelContent[level];
    if (currentContent?.translatedText) {
      const placeholder = chunkError.subChunkIndex !== undefined
        ? `[TRANSLATION_FAILED:${chunkError.chapterIndex}:${chunkError.subChunkIndex}]`
        : `[TRANSLATION_FAILED:${chunkError.chapterIndex}]`;

      const lines = currentContent.translatedText.split('\n');
      const newLines: string[] = [];
      let skipUntilDivider = false;

      for (const line of lines) {
        if (line.includes(placeholder)) {
          newLines.push(overrideText.trim());
          skipUntilDivider = true;
        } else if (skipUntilDivider) {
          if (line.startsWith('--- Cap') || line.startsWith('[TRANSLATION_FAILED:')) {
            skipUntilDivider = false;
            newLines.push(line);
          }
        } else {
          newLines.push(line);
        }
      }

      updateStoryData({
        levelContent: {
          ...storyData.levelContent,
          [level]: {
            ...currentContent,
            translatedText: newLines.join('\n'),
          },
        },
      });

      setChunkErrors(prev => ({
        ...prev,
        [level]: (prev[level] || []).filter(e =>
          !(e.chapterIndex === chunkError.chapterIndex &&
            e.subChunkIndex === chunkError.subChunkIndex)
        ),
      }));

      setManualOverrideText(prev => {
        const newState = { ...prev };
        delete newState[errorKey];
        return newState;
      });

      setError("");
    }
  }, [manualOverrideText, storyData.levelContent, updateStoryData, setChunkErrors, setError]);

  const applyOriginalAsFallback = useCallback((level: number, chunkError: ChunkError) => {
    const currentContent = storyData.levelContent[level];
    if (currentContent?.translatedText) {
      const placeholder = chunkError.subChunkIndex !== undefined
        ? `[TRANSLATION_FAILED:${chunkError.chapterIndex}:${chunkError.subChunkIndex}]`
        : `[TRANSLATION_FAILED:${chunkError.chapterIndex}]`;

      const updatedText = currentContent.translatedText.replace(
        new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\n\\n', 'g'),
        '[UNTRANSLATED - ORIGINAL TEXT]\n\n'
      );

      updateStoryData({
        levelContent: {
          ...storyData.levelContent,
          [level]: {
            ...currentContent,
            translatedText: updatedText,
          },
        },
      });

      setChunkErrors(prev => ({
        ...prev,
        [level]: (prev[level] || []).filter(e =>
          !(e.chapterIndex === chunkError.chapterIndex &&
            e.subChunkIndex === chunkError.subChunkIndex)
        ),
      }));
    }
  }, [storyData.levelContent, updateStoryData, setChunkErrors]);

  const generatedLevels = [1, 2, 3, 4, 5, 6].filter(
    (l) => storyData.levelContent[l]?.status === "done" &&
           storyData.levelContent[l]?.mode !== "omit" &&
           storyData.levelContent[l]?.sourceText?.length > 0
  );

  const hasErrors = Object.values(chunkErrors).some(errors => errors.length > 0);

  const allTranslated = generatedLevels.every(
    (l) => storyData.levelContent[l]?.translatedText?.length > 0
  );

  const targetLang = storyData.sourceLanguage === "en" ? "Spanish" : "English";

  if (generatedLevels.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Levels Generated</h2>
        <p className="text-gray-500">Go back to Step 4 and generate at least one level first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Translate to {targetLang}</h2>
        <p className="text-gray-500 text-sm">
          Each generated level will be translated maintaining the same complexity.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="space-y-3">
        {generatedLevels.map((level) => {
          const content = storyData.levelContent[level];
          const hasTranslation = content?.translatedText?.length > 0;
          const isTranslating = translatingLevels.has(level);
          const levelErrorList = chunkErrors[level] || [];
          const hasLevelErrors = levelErrorList.length > 0;
          const translationWarnings = hasTranslation ? scanContentWarnings(content.translatedText, level) : [];
          const sourceWarnings = content?.sourceText ? scanContentWarnings(content.sourceText, level) : [];
          const qualityWarnings = (hasTranslation && content?.sourceText)
            ? scanTranslationQuality(content.sourceText, content.translatedText, level)
            : [];
          const quoteWarnings = (hasTranslation && content?.sourceText)
            ? scanQuoteMismatches(content.sourceText, content.translatedText, level, { strict: true })
            : [];

          // Detect duplicate chapter markers (corrupted data)
          const detectDupeChapters = (text: string) => {
            const nums: number[] = [];
            for (const m of text.matchAll(/^---\s*(?:Chapter|Capítulo)\s+(\d+)/gim)) {
              nums.push(parseInt(m[1], 10));
            }
            const seen = new Set<number>();
            const dupes = new Set<number>();
            for (const n of nums) { if (seen.has(n)) dupes.add(n); seen.add(n); }
            return dupes.size > 0 ? Array.from(dupes) : null;
          };
          const sourceDupes = content?.sourceText ? detectDupeChapters(content.sourceText) : null;
          const transDupes = hasTranslation ? detectDupeChapters(content.translatedText) : null;
          const hasDupeChapters = sourceDupes || transDupes;

          return (
            <div
              key={level}
              className={`p-4 rounded-lg border-2 ${
                hasLevelErrors
                  ? "border-red-500 bg-red-50"
                  : hasTranslation
                  ? "border-green-500 bg-green-50"
                  : isTranslating
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                      hasLevelErrors
                        ? "bg-red-600 text-white"
                        : hasTranslation
                        ? "bg-green-600 text-white"
                        : isTranslating
                        ? "bg-blue-600 text-white animate-pulse"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {hasLevelErrors ? "!" : hasTranslation ? "✓" : `L${level}`}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 flex items-center gap-2">
                      Level {level}
                      {copiedFromLevel[level] && (
                        <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full font-normal">
                          Copied from L{copiedFromLevel[level]} ✓
                        </span>
                      )}
                      {hasLevelErrors && (
                        <span className="text-xs text-red-600 font-normal">
                          ({levelErrorList.length} failed chunk{levelErrorList.length > 1 ? 's' : ''})
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {isTranslating
                        ? levelProgress[level]
                          ? levelProgress[level].subChunk
                            ? `Translating chapter ${levelProgress[level].current} of ${levelProgress[level].total} (sub-chunk ${levelProgress[level].subChunk.current}/${levelProgress[level].subChunk.total})...`
                            : `Translating chapter ${levelProgress[level].current} of ${levelProgress[level].total}...`
                          : "Translating..."
                        : hasLevelErrors
                        ? "Translation incomplete - resolve errors below"
                        : hasTranslation
                        ? (() => {
                            // Use detectAlignmentIssues per chapter (same logic as ComparisonModal)
                            const chapterDivider = /^---\s*(Chapter|Capítulo)\s*(\d+)/gim;
                            const srcLines = (content.sourceText || "").split("\n");
                            const transLines = content.translatedText.split("\n");
                            const contentLineCount = transLines.filter(l => l.trim()).length;

                            // Split into per-chapter line arrays for alignment detection
                            const splitChapterLines = (lines: string[]) => {
                              const dividerPattern = /^---\s*(Chapter|Capítulo)\s*(\d+)/i;
                              const chapters: { num: number; lines: string[] }[] = [];
                              let current: string[] = [];
                              let currentNum = 0;
                              for (const line of lines) {
                                const m = line.match(dividerPattern);
                                if (m) {
                                  if (current.length > 0 || chapters.length > 0) chapters.push({ num: currentNum, lines: current });
                                  currentNum = parseInt(m[2], 10);
                                  current = [];
                                } else {
                                  current.push(line);
                                }
                              }
                              if (current.length > 0) chapters.push({ num: currentNum, lines: current });
                              return chapters;
                            };

                            const srcChapters = splitChapterLines(srcLines);
                            const transChapters = splitChapterLines(transLines);
                            let totalIssues = 0;
                            const mismatchedChapters: string[] = [];
                            for (let i = 0; i < srcChapters.length; i++) {
                              const tc = transChapters[i];
                              if (!tc) continue;
                              const result = detectAlignmentIssues(srcChapters[i].lines, tc.lines);
                              if (result.hasIssues) {
                                totalIssues += result.contentVsBlankIssues.length;
                                mismatchedChapters.push(`Ch ${srcChapters[i].num}`);
                              }
                            }

                            if (totalIssues === 0) return `${contentLineCount} lines translated ✓`;
                            const detail = mismatchedChapters.length > 0 ? ` — ${mismatchedChapters.join(', ')}` : '';
                            return `${totalIssues} alignment issue${totalIssues > 1 ? 's' : ''}${detail}`;
                          })()
                        : "Pending translation"}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!hasTranslation && !isTranslating && (
                    <button
                      onClick={() => translateSingleLevel(level)}
                      disabled={isProcessing}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      Translate
                    </button>
                  )}
                  {hasTranslation && !isTranslationComplete(level) && !isTranslating && (
                    <button
                      onClick={() => translateSingleLevel(level)}
                      disabled={isProcessing}
                      className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 disabled:opacity-50"
                    >
                      Resume Translation
                    </button>
                  )}
                  {hasTranslation && !isTranslating && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Reset Level ${level} translation? This will clear the translated text so you can re-translate.`)) {
                          resetTranslation(level);
                        }
                      }}
                      disabled={isProcessing}
                      className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Reset
                    </button>
                  )}
                  {isTranslating && (
                    <button
                      onClick={cancel}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* Alignment status (uses detectAlignmentIssues per chapter — same logic as ComparisonModal) */}
              {content?.translatedText?.length > 0 && (() => {
                const isBreakdownExpanded = expandedLineBreakdown === level;
                const dividerPattern = /^---\s*(Chapter|Capítulo)\s*(\d+)(?::\s*(.+?))?\s*---$/i;

                // Split text into per-chapter line arrays
                const splitChapterLines = (text: string) => {
                  const lines = text.split("\n");
                  const chapters: { num: number; title: string; lines: string[] }[] = [];
                  let current: string[] = [];
                  let currentNum = 0;
                  let currentTitle = "";
                  for (const line of lines) {
                    const m = line.match(dividerPattern);
                    if (m) {
                      if (current.length > 0 || chapters.length > 0) chapters.push({ num: currentNum, title: currentTitle, lines: current });
                      currentNum = parseInt(m[2], 10);
                      currentTitle = m[3] || "";
                      current = [];
                    } else {
                      current.push(line);
                    }
                  }
                  if (current.length > 0) chapters.push({ num: currentNum, title: currentTitle, lines: current });
                  return chapters;
                };

                const srcChapters = splitChapterLines(content.sourceText || "");
                const transChapters = splitChapterLines(content.translatedText);
                const hasMultipleChapters = srcChapters.length > 1;

                // Run detectAlignmentIssues per chapter
                const chapterResults: { num: number; title: string; result: ChapterAlignmentResult }[] = [];
                let totalAlignmentIssues = 0;
                for (let i = 0; i < srcChapters.length; i++) {
                  const tc = transChapters[i];
                  const result = tc
                    ? detectAlignmentIssues(srcChapters[i].lines, tc.lines)
                    : { hasIssues: true, issueCount: 1, lineCountMismatch: null, contentVsBlankIssues: [] };
                  chapterResults.push({ num: srcChapters[i].num, title: srcChapters[i].title, result });
                  totalAlignmentIssues += result.contentVsBlankIssues.length;
                }

                return (
                  <div className="mt-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {totalAlignmentIssues === 0 ? (
                          <span className="text-sm text-green-600 font-medium flex items-center gap-1.5">
                            <span className="text-green-500">&#10003;</span>
                            Alignment OK
                            {hasMultipleChapters && <span className="text-gray-400 font-normal text-xs">({srcChapters.length} chapters)</span>}
                          </span>
                        ) : (
                          <>
                            <span className="text-sm text-amber-600 font-medium flex items-center gap-1.5">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              {totalAlignmentIssues} alignment issue{totalAlignmentIssues > 1 ? "s" : ""}
                            </span>
                            {hasMultipleChapters && (
                              <button
                                onClick={() => setExpandedLineBreakdown(isBreakdownExpanded ? null : level)}
                                className="p-1 hover:bg-gray-200 rounded transition-colors"
                                title={isBreakdownExpanded ? "Hide chapter breakdown" : "Show chapter breakdown"}
                              >
                                <svg
                                  className={`w-4 h-4 text-gray-500 transition-transform ${isBreakdownExpanded ? 'rotate-90' : ''}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                      <button
                        onClick={() => openTranslationComparison(level)}
                        className="px-3 py-1.5 text-sm bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors flex items-center gap-1.5"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        View Full Text
                      </button>
                    </div>

                    {/* Per-chapter breakdown */}
                    {isBreakdownExpanded && hasMultipleChapters && (
                      <div className="mt-2 ml-6 bg-gray-50 rounded-lg p-3 text-xs space-y-1.5 max-h-48 overflow-y-auto">
                        {chapterResults.map((ch) => {
                          const issueCount = ch.result.contentVsBlankIssues.length;
                          const chapterOk = !ch.result.hasIssues;

                          return (
                            <div
                              key={ch.num}
                              className={`flex items-center justify-between px-2 py-1 rounded ${chapterOk ? 'bg-green-50' : 'bg-amber-50'}`}
                            >
                              <span className="text-gray-700 font-medium">
                                Ch. {ch.num}
                                {ch.title && <span className="font-normal text-gray-500 ml-1">({ch.title.slice(0, 20)}{ch.title.length > 20 ? '...' : ''})</span>}
                              </span>
                              <span className={chapterOk ? 'text-green-600' : 'text-amber-600'}>
                                {chapterOk ? (
                                  <span>&#10003;</span>
                                ) : (
                                  <span>{issueCount} issue{issueCount > 1 ? 's' : ''}</span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Content Warnings */}
              {(sourceWarnings.length > 0 || translationWarnings.length > 0 || qualityWarnings.length > 0) && (
                <div className="mt-3 bg-amber-50 border border-amber-300 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-amber-700 font-medium text-sm mb-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {sourceWarnings.length + translationWarnings.length + qualityWarnings.length} content warning{sourceWarnings.length + translationWarnings.length + qualityWarnings.length > 1 ? "s" : ""} detected
                  </div>
                  <ul className="space-y-1">
                    {sourceWarnings.map((w, i) => (
                      <li key={`src-${i}`} className="text-xs text-amber-600">
                        <span className="font-medium text-amber-700">Source</span> Ch {w.chapter}, line {w.line}: <span className="font-medium">{w.type === "error_marker" ? "Error marker" : w.type === "ai_refusal" ? "AI refusal" : "Translation failed"}</span>
                        {" — "}<code className="bg-amber-100 px-1 rounded">{w.text.slice(0, 80)}{w.text.length > 80 ? "..." : ""}</code>
                      </li>
                    ))}
                    {translationWarnings.map((w, i) => (
                      <li key={`trans-${i}`} className="text-xs text-amber-600">
                        <span className="font-medium text-amber-700">Translation</span> Ch {w.chapter}, line {w.line}: <span className="font-medium">{w.type === "error_marker" ? "Error marker" : w.type === "ai_refusal" ? "AI refusal" : "Translation failed"}</span>
                        {" — "}<code className="bg-amber-100 px-1 rounded">{w.text.slice(0, 80)}{w.text.length > 80 ? "..." : ""}</code>
                      </li>
                    ))}
                    {qualityWarnings.map((w, i) => (
                      <li key={`quality-${i}`} className="text-xs text-amber-600">
                        <span className="font-medium text-amber-700">Short translation</span> Ch {w.chapter}, line {w.line}
                        {" — "}<code className="bg-amber-100 px-1 rounded">{w.text.slice(0, 120)}{w.text.length > 120 ? "..." : ""}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {quoteWarnings.length > 0 && (
                <div className="mt-3 bg-yellow-50 border border-yellow-300 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-yellow-700 font-medium text-sm mb-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    {quoteWarnings.length} quote mismatch{quoteWarnings.length > 1 ? "es" : ""} in translation
                  </div>
                  <ul className="space-y-1">
                    {quoteWarnings.map((w, i) => (
                      <li key={`quote-${i}`} className="text-xs text-yellow-600">
                        Ch {w.chapter}, line {w.line}: <code className="bg-yellow-100 px-1 rounded">{w.text}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Duplicate chapter warning */}
              {hasDupeChapters && (
                <div className="mt-3 bg-red-50 border border-red-300 rounded-lg p-3 flex items-start gap-2">
                  <svg className="w-4 h-4 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="text-sm text-red-700">
                    <span className="font-medium">Corrupted data: duplicate chapters detected.</span>
                    {sourceDupes && <span> Source Ch {sourceDupes.join(', ')}.</span>}
                    {transDupes && <span> Translation Ch {transDupes.join(', ')}.</span>}
                    <span> Reset this level and retranslate.</span>
                  </div>
                </div>
              )}

              {/* Failed Chunks UI */}
              {hasLevelErrors && (
                <div className="mt-4 space-y-3">
                  <div className="text-sm font-medium text-red-700">Failed Chunks:</div>
                  {levelErrorList.map((chunkError) => {
                    const errorKey = `${level}-${chunkError.chapterIndex}-${chunkError.subChunkIndex ?? 'main'}`;
                    const isExpanded = expandedError === errorKey;

                    return (
                      <div
                        key={errorKey}
                        className="bg-white border border-red-200 rounded-lg overflow-hidden"
                      >
                        <div
                          className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-red-50"
                          onClick={() => setExpandedError(isExpanded ? null : errorKey)}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{getErrorIcon(chunkError.errorType)}</span>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                Chapter {chunkError.chapterIndex + 1}
                                {chunkError.subChunkIndex !== undefined && ` (Part ${chunkError.subChunkIndex + 1})`}
                              </div>
                              <div className="text-xs text-red-600">
                                {getErrorDisplayMessage(chunkError.errorType)}
                                {chunkError.retryCount > 0 && ` (${chunkError.retryCount} retries)`}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                retryChunk(level, chunkError);
                              }}
                              disabled={isProcessing}
                              className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                              Retry
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                applyOriginalAsFallback(level, chunkError);
                              }}
                              className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                            >
                              Keep Original
                            </button>
                            <span className="text-gray-400">{isExpanded ? '▲' : '▼'}</span>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-red-200 px-4 py-3 space-y-3">
                            <div>
                              <div className="text-xs font-medium text-gray-500 mb-1">Error Details:</div>
                              <div className="text-xs text-red-600 bg-red-50 p-2 rounded font-mono">
                                {chunkError.errorMessage}
                              </div>
                            </div>

                            <div>
                              <div className="text-xs font-medium text-gray-500 mb-1">
                                Original Text ({chunkError.originalText.length} chars):
                              </div>
                              <div className="text-xs text-gray-700 bg-gray-50 p-2 rounded max-h-32 overflow-y-auto font-mono whitespace-pre-wrap">
                                {chunkError.originalText.substring(0, 500)}
                                {chunkError.originalText.length > 500 && '...'}
                              </div>
                            </div>

                            <div>
                              <div className="text-xs font-medium text-gray-500 mb-1">
                                Manual Translation Override:
                              </div>
                              <textarea
                                value={manualOverrideText[errorKey] || ''}
                                onChange={(e) => setManualOverrideText(prev => ({
                                  ...prev,
                                  [errorKey]: e.target.value
                                }))}
                                placeholder="Paste your manual translation here..."
                                className="w-full h-24 text-xs border border-gray-300 rounded p-2 font-mono"
                              />
                              <button
                                onClick={() => applyManualOverride(level, chunkError)}
                                disabled={!manualOverrideText[errorKey]?.trim()}
                                className="mt-2 px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-default"
                              >
                                Apply Manual Translation
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!allTranslated && (
        <div className="text-center pt-4 space-y-3">
          {isProcessing && translatingLevels.size > 0 && (
            <div className="text-sm text-blue-600 font-medium">
              Translating {translatingLevels.size} level{translatingLevels.size > 1 ? 's' : ''} in parallel...
            </div>
          )}
          {isProcessing && hasErrors && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-lg text-sm">
              ⚠️ Some chunks failed during translation - you can retry them after translation completes
            </div>
          )}
          <div className="flex justify-center gap-3">
            <button
              onClick={translateAllLevels}
              disabled={isProcessing}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {isProcessing ? "Translating..." : "Translate All Levels"}
            </button>
            {isProcessing && (
              <button
                onClick={cancel}
                className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {allTranslated && hasErrors && !isProcessing && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-center">
          <div className="text-amber-800 font-medium mb-1">
            ⚠️ Translation Complete with Errors
          </div>
          <div className="text-sm text-amber-700">
            Some chunks failed to translate. Review the failed chunks above and retry or provide manual translations before saving.
          </div>
        </div>
      )}

      {/* Translation Comparison Modal */}
      {translationComparisonLevel !== null && (
        <ComparisonModal
          isOpen={translationComparisonLevel !== null}
          onClose={closeTranslationComparison}
          level={translationComparisonLevel}
          leftTitle={`Source (${storyData.sourceLanguage?.toUpperCase() || 'EN'})`}
          leftText={storyData.levelContent[translationComparisonLevel]?.sourceText || ""}
          rightTitle={`Translation (${storyData.sourceLanguage === 'en' ? 'ES' : 'EN'})`}
          rightText={storyData.levelContent[translationComparisonLevel]?.translatedText || ""}
          quoteWarningsByChapter={(() => {
            const src = storyData.levelContent[translationComparisonLevel]?.sourceText || "";
            const trans = storyData.levelContent[translationComparisonLevel]?.translatedText || "";
            if (!src || !trans) return undefined;
            const warnings = scanQuoteMismatches(src, trans, translationComparisonLevel, { strict: true });
            const byChapter: Record<number, number[]> = {};
            for (const w of warnings) {
              if (!byChapter[w.chapter]) byChapter[w.chapter] = [];
              byChapter[w.chapter].push(w.line - 1);
            }
            return Object.keys(byChapter).length > 0 ? byChapter : undefined;
          })()}
          onSave={saveTranslationFromModal}
          editableSide="both"
          headerGradient="bg-gradient-to-r from-blue-600 to-indigo-600"
          onRetranslateChapter={handleRetranslateChapter}
          isRetranslating={isRetranslatingChapter}
        />
      )}
    </div>
  );
}

export default Step5Translate;
