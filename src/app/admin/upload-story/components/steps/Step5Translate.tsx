"use client";

import { useState, useCallback } from "react";
import type { StoryData, ChunkError, TranslationErrorType } from "../../types";
import { useTranslationPipeline } from "../../hooks/useTranslationPipeline";
import { ComparisonModal } from "../ComparisonModal";

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
    truncationRetryStatus,
    translateSingleLevel,
    translateAllLevels,
    cancel,
    isTranslationComplete,
  } = pipeline;

  // Local UI state for error management
  const [expandedError, setExpandedError] = useState<string | null>(null);
  const [manualOverrideText, setManualOverrideText] = useState<Record<string, string>>({});
  const [expandedLineBreakdown, setExpandedLineBreakdown] = useState<number | null>(null);

  // Translation comparison modal state
  const [translationComparisonLevel, setTranslationComparisonLevel] = useState<number | null>(null);
  const [translationModalEditing, setTranslationModalEditing] = useState(false);
  const [translationModalEditText, setTranslationModalEditText] = useState("");

  const openTranslationComparison = useCallback((level: number) => {
    const content = storyData.levelContent[level];
    if (content?.translatedText) {
      setTranslationComparisonLevel(level);
      setTranslationModalEditText(content.translatedText);
      setTranslationModalEditing(false);
    }
  }, [storyData.levelContent]);

  const closeTranslationComparison = useCallback(() => {
    setTranslationComparisonLevel(null);
    setTranslationModalEditing(false);
  }, []);

  const saveTranslationFromModal = useCallback((editedText: string) => {
    if (translationComparisonLevel !== null) {
      const content = storyData.levelContent[translationComparisonLevel];
      if (content) {
        updateStoryData({
          levelContent: {
            ...storyData.levelContent,
            [translationComparisonLevel]: {
              ...content,
              translatedText: editedText,
            },
          },
        });
      }
    }
  }, [translationComparisonLevel, storyData.levelContent, updateStoryData]);

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
          sourceLanguage: storyData.sourceLanguage,
          targetLanguage: storyData.sourceLanguage === "en" ? "es" : "en",
          targetLevel: level,
          slug: storyData.slug || undefined,  // For cost tracking
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

  const generatedLevels = [1, 2, 3, 4, 5].filter(
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
                            ? `Translating chapters ${levelProgress[level].current}-${levelProgress[level].batchEnd}/${levelProgress[level].total} (part ${levelProgress[level].subChunk!.current}/${levelProgress[level].subChunk!.total})...`
                            : `Translating chapters ${levelProgress[level].current}-${levelProgress[level].batchEnd} of ${levelProgress[level].total}...`
                          : "Translating..."
                        : hasLevelErrors
                        ? "Translation incomplete - resolve errors below"
                        : hasTranslation
                        ? (() => {
                            const sourceLines = content.sourceText?.split("\n").filter((l: string) => l.trim()).length || 0;
                            const transLines = content.translatedText.split("\n").filter((l: string) => l.trim()).length;
                            const isComplete = transLines >= sourceLines;
                            return isComplete
                              ? `${transLines} lines translated ✓`
                              : `${transLines}/${sourceLines} lines translated (partial)`;
                          })()
                        : "Pending translation"}
                    </div>
                    {isTranslating && truncationRetryStatus && (
                      <div className="mt-1 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span>
                          Truncation detected in Chapter {truncationRetryStatus.chapter + 1} -
                          Auto-retry {truncationRetryStatus.attempt}/{truncationRetryStatus.maxAttempts}
                        </span>
                        <span className="text-amber-500 text-xs opacity-75">
                          ({truncationRetryStatus.reasons.join(", ")})
                        </span>
                      </div>
                    )}
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

              {/* Line count comparison */}
              {content?.translatedText?.length > 0 && (() => {
                const sourceLines = content.sourceText?.split("\n").filter((l: string) => l.trim()).length || 0;
                const translatedLines = content.translatedText.split("\n").filter((l: string) => l.trim()).length;
                const linesMatch = sourceLines === translatedLines;
                const isBreakdownExpanded = expandedLineBreakdown === level;

                const chapterPattern = /^---\s*(Chapter|Capítulo)\s*(\d+)(?::\s*(.+?))?\s*---$/i;
                const sourceTextLines = (content.sourceText || "").split("\n");
                const translatedTextLines = content.translatedText.split("\n");

                const parseChapters = (lines: string[]) => {
                  type ChapterInfo = { number: number; title: string; startLine: number };
                  const chapters: { number: number; title: string; startLine: number; lineCount: number }[] = [];
                  let currentChapter: ChapterInfo | null = null;

                  lines.forEach((line, idx) => {
                    const match = line.match(chapterPattern);
                    if (match) {
                      if (currentChapter) {
                        const contentLines = lines.slice(currentChapter.startLine + 1, idx).filter(l => l.trim()).length;
                        chapters.push({ number: currentChapter.number, title: currentChapter.title, startLine: currentChapter.startLine, lineCount: contentLines });
                      }
                      currentChapter = { number: parseInt(match[2], 10), title: match[3] || "", startLine: idx };
                    }
                  });

                  if (currentChapter) {
                    const chap = currentChapter as ChapterInfo;
                    const contentLines = lines.slice(chap.startLine + 1).filter(l => l.trim()).length;
                    chapters.push({ number: chap.number, title: chap.title, startLine: chap.startLine, lineCount: contentLines });
                  }

                  return chapters;
                };

                const sourceChapters = parseChapters(sourceTextLines);
                const translatedChapters = parseChapters(translatedTextLines);
                const hasChapters = sourceChapters.length > 1 || translatedChapters.length > 1;

                return (
                  <div className="mt-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {hasChapters && (
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
                        <div className={`text-sm font-medium flex items-center gap-2 ${linesMatch ? 'text-green-600' : 'text-amber-600'}`}>
                          <span>{sourceLines} lines</span>
                          <span className="text-gray-400">{"<-->"}</span>
                          <span>{translatedLines} lines</span>
                          {linesMatch ? (
                            <span className="text-green-500 ml-1">&#10003;</span>
                          ) : (
                            <span className="text-amber-500 ml-1">({translatedLines - sourceLines > 0 ? '+' : ''}{translatedLines - sourceLines})</span>
                          )}
                        </div>
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
                    {isBreakdownExpanded && hasChapters && (
                      <div className="mt-2 ml-6 bg-gray-50 rounded-lg p-3 text-xs space-y-1.5 max-h-48 overflow-y-auto">
                        {sourceChapters.map((srcChapter) => {
                          const transChapter = translatedChapters.find(c => c.number === srcChapter.number);
                          const srcLines = srcChapter.lineCount;
                          const transLines = transChapter?.lineCount || 0;
                          const chapterMatch = srcLines === transLines;
                          const diff = transLines - srcLines;

                          return (
                            <div
                              key={srcChapter.number}
                              className={`flex items-center justify-between px-2 py-1 rounded ${chapterMatch ? 'bg-green-50' : 'bg-amber-50'}`}
                            >
                              <span className="text-gray-700 font-medium">
                                Ch. {srcChapter.number}
                                {srcChapter.title && <span className="font-normal text-gray-500 ml-1">({srcChapter.title.slice(0, 20)}{srcChapter.title.length > 20 ? '...' : ''})</span>}
                              </span>
                              <span className={chapterMatch ? 'text-green-600' : 'text-amber-600'}>
                                {srcLines} <span className="text-gray-400 mx-1">→</span> {transLines}
                                {!chapterMatch && (
                                  <span className="ml-1 opacity-75">({diff > 0 ? '+' : ''}{diff})</span>
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
          onSave={saveTranslationFromModal}
          editableSide="right"
          headerGradient="bg-gradient-to-r from-blue-600 to-indigo-600"
        />
      )}
    </div>
  );
}

export default Step5Translate;
