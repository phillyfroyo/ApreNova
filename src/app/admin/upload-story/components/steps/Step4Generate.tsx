"use client";

import type { StoryData } from "../../types";
import { useRewritePipeline } from "../../hooks/useRewritePipeline";
import { ComparisonModal } from "../ComparisonModal";

interface Step4GenerateProps {
  storyData: StoryData;
  updateStoryData: (updates: Partial<StoryData>) => void;
  isProcessing: boolean;
  setIsProcessing: (v: boolean) => void;
}

export function Step4Generate({
  storyData,
  updateStoryData,
  isProcessing,
  setIsProcessing,
}: Step4GenerateProps) {
  const pipeline = useRewritePipeline({
    storyData,
    updateStoryData,
    setIsProcessing,
  });

  const {
    chapterProgress,
    error,
    getLevelMode,
    setLevelMode,
    processSingleLevel,
    processAllLevels,
    cancel,
    resetLevel,
    comparisonLevel,
    isEditing,
    editedText,
    setEditedText,
    setIsEditing,
    openComparison,
    closeComparison,
    saveEditedText,
  } = pipeline;

  const allDone = [1, 2, 3, 4, 5].every((l) => {
    const mode = getLevelMode(l);
    return mode === "omit" || storyData.levelContent[l]?.status === "done";
  });

  const originalText = storyData.rawText;
  const comparisonContent = comparisonLevel !== null ? storyData.levelContent[comparisonLevel] : null;

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Generate Level Variations</h2>
            <p className="text-gray-500 text-sm">
              Choose whether to use the original text or have AI generate a CEFR-appropriate version for each level.
            </p>
          </div>
          <button
            onClick={() => openComparison(-1)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Review Original Text
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((level) => {
            const content = storyData.levelContent[level];
            const isSource = level === storyData.detectedLevel;
            const mode = getLevelMode(level);
            const isOmitted = mode === "omit";

            return (
              <div
                key={level}
                className={`p-4 rounded-lg border-2 transition-all ${
                  isOmitted
                    ? "border-gray-200 bg-gray-50 opacity-60"
                    : content?.status === "done"
                    ? "border-green-500 bg-green-50"
                    : content?.status === "generating"
                    ? "border-blue-500 bg-blue-50"
                    : content?.status === "error"
                    ? "border-red-500 bg-red-50"
                    : "border-gray-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        isOmitted
                          ? "bg-gray-300 text-gray-500"
                          : content?.status === "done"
                          ? "bg-green-600 text-white"
                          : content?.status === "generating"
                          ? "bg-blue-600 text-white animate-pulse"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {isOmitted ? "—" : content?.status === "done" ? "✓" : `L${level}`}
                    </div>
                    <div>
                      <div className={`font-medium ${isOmitted ? "text-gray-400" : "text-gray-900"}`}>
                        Level {level} {isSource && <span className="text-amber-600">(Source)</span>}
                        {isOmitted && <span className="text-gray-400 ml-2">— Omitted</span>}
                      </div>
                      <div className="text-sm text-gray-500">
                        {isOmitted
                          ? "This level will not be generated"
                          : content?.status === "generating"
                          ? mode === "use-original"
                            ? "Copying original..."
                            : chapterProgress
                              ? chapterProgress.subChunk
                                ? `Chapters ${chapterProgress.current}-${chapterProgress.batchEnd}/${chapterProgress.total} (part ${chapterProgress.subChunk.current}/${chapterProgress.subChunk.total})...`
                                : `Generating chapters ${chapterProgress.current}-${chapterProgress.batchEnd} of ${chapterProgress.total}...`
                              : "Generating..."
                          : content?.status === "done"
                          ? `${content.sourceText.split("\n").filter((l) => l.trim()).length} lines • ${content.mode === "use-original" ? "Original text" : "AI generated"}`
                          : content?.status === "error"
                          ? "Error - click to retry"
                          : "Pending"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {content?.status !== "done" && content?.status !== "generating" && (
                      <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
                        <button
                          onClick={() => setLevelMode(level, "generate")}
                          className={`w-20 py-1.5 text-center ${
                            mode === "generate"
                              ? "bg-blue-600 text-white"
                              : "bg-white text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          Generate
                        </button>
                        <button
                          onClick={() => setLevelMode(level, "use-original")}
                          className={`w-24 py-1.5 text-center border-l border-gray-300 ${
                            mode === "use-original"
                              ? "bg-amber-600 text-white"
                              : "bg-white text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          Use Original
                        </button>
                        <button
                          onClick={() => setLevelMode(level, "omit")}
                          className={`w-14 py-1.5 text-center border-l border-gray-300 ${
                            mode === "omit"
                              ? "bg-gray-500 text-white"
                              : "bg-white text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          Omit
                        </button>
                      </div>
                    )}

                    {content?.status !== "done" && content?.status !== "generating" && (
                      <div className="w-24">
                        {!isOmitted && (
                          <button
                            onClick={() => processSingleLevel(level)}
                            disabled={isProcessing}
                            className={`w-full py-2 text-white rounded-lg text-sm disabled:opacity-50 ${
                              mode === "use-original"
                                ? "bg-amber-600 hover:bg-amber-700"
                                : "bg-blue-600 hover:bg-blue-700"
                            }`}
                          >
                            {mode === "use-original" ? "Copy" : "Generate"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {content?.status === "done" && (
                  <div className="mt-3 flex items-start gap-4">
                    <details className="flex-1">
                      <summary className="text-sm text-gray-600 cursor-pointer">Preview text</summary>
                      <pre className="mt-2 text-xs bg-white p-3 rounded border max-h-40 overflow-auto whitespace-pre-wrap">
                        {content.sourceText.slice(0, 500)}
                        {content.sourceText.length > 500 && "..."}
                      </pre>
                    </details>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openComparison(level)}
                        className="px-3 py-1.5 text-sm bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors flex items-center gap-1.5"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        View Full Text
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Reset Level ${level}? This will clear the generated content and allow you to change the mode (Generate/Use Original/Omit).`)) {
                            resetLevel(level);
                          }
                        }}
                        disabled={isProcessing}
                        className="px-3 py-1.5 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Reset
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!allDone && (
          <div className="text-center pt-4 flex justify-center gap-3">
            <button
              onClick={processAllLevels}
              disabled={isProcessing}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {isProcessing
                ? chapterProgress
                  ? chapterProgress.subChunk
                    ? `Ch ${chapterProgress.current}-${chapterProgress.batchEnd}/${chapterProgress.total} part ${chapterProgress.subChunk.current}/${chapterProgress.subChunk.total}...`
                    : `Processing chapters ${chapterProgress.current}-${chapterProgress.batchEnd}/${chapterProgress.total}...`
                  : "Processing..."
                : "Process All Levels"}
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
        )}
      </div>

      {/* Comparison Modal for levels 1-5 */}
      {comparisonLevel !== null && comparisonLevel > 0 && comparisonContent && (
        <ComparisonModal
          isOpen={true}
          onClose={closeComparison}
          level={comparisonLevel}
          leftTitle={`Original (L${storyData.detectedLevel})`}
          leftText={originalText}
          rightTitle={`Rewritten (L${comparisonLevel})`}
          rightText={comparisonContent.sourceText}
          onSave={(text) => {
            const current = storyData.levelContent[comparisonLevel];
            updateStoryData({
              levelContent: {
                ...storyData.levelContent,
                [comparisonLevel]: { ...current, sourceText: text },
              },
            });
          }}
          editableSide="right"
        />
      )}

      {/* Original Text Review Modal (level -1) */}
      {comparisonLevel === -1 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeComparison} />
          <div className="relative w-[95vw] h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <span className="text-lg font-semibold">Review Original Text</span>
                <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
                  {originalText.split("\n").filter(l => l.trim()).length} lines • {storyData.parsedResult?.chapters.length || 1} chapters
                </span>
              </div>
              <div className="flex items-center gap-3">
                {isEditing ? (
                  <>
                    <button onClick={saveEditedText} className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg text-sm font-medium transition-colors">
                      Save Changes
                    </button>
                    <button onClick={() => { setEditedText(originalText); setIsEditing(false); }} className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm transition-colors">
                      Cancel
                    </button>
                  </>
                ) : (
                  <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm transition-colors">
                    Edit Text
                  </button>
                )}
                <button onClick={closeComparison} className="p-2 hover:bg-white/20 rounded-lg transition-colors" title="Close (Esc)">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="bg-amber-50 px-6 py-3 text-sm font-medium text-amber-700 border-b flex items-center justify-between shrink-0">
                <span>Original Text (L{storyData.detectedLevel}) - Review before generation</span>
                <span className="text-amber-500">{(isEditing ? editedText : originalText).split("\n").filter(l => l.trim()).length} lines</span>
              </div>
              <div className="flex-1 overflow-auto p-6">
                {isEditing ? (
                  <textarea value={editedText} onChange={(e) => setEditedText(e.target.value)} className="w-full h-full text-sm whitespace-pre-wrap font-mono text-gray-700 leading-relaxed border border-gray-300 rounded-lg p-4 focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none" spellCheck={false} />
                ) : (
                  <div className="grid gap-3">
                    {storyData.parsedResult?.chapters.map((chapter, idx) => (
                      <details key={idx} className="border border-amber-200 rounded-xl overflow-hidden bg-white shadow-sm">
                        <summary className="bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 cursor-pointer hover:from-amber-100 hover:to-orange-100 transition-colors flex items-center justify-between">
                          <span className="text-sm font-semibold text-amber-800">Chapter {chapter.number}: {chapter.title}</span>
                          <span className="text-xs text-gray-500 bg-white px-3 py-1 rounded-full">{chapter.rawText.split("\n").filter(l => l.trim()).length} lines • {chapter.rawText.length.toLocaleString()} chars</span>
                        </summary>
                        <div className="p-4 bg-white border-t border-amber-100 max-h-[50vh] overflow-auto">
                          <pre className="text-sm whitespace-pre-wrap font-mono text-gray-700 leading-relaxed">{chapter.rawText}</pre>
                        </div>
                      </details>
                    )) || (
                      <pre className="text-sm whitespace-pre-wrap font-mono text-gray-700 leading-relaxed">{originalText}</pre>
                    )}
                  </div>
                )}
              </div>
              {!isEditing && (
                <div className="bg-amber-50 px-6 py-3 text-sm text-amber-600 border-t shrink-0 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Review the text above. Look for non-story content like license text, advertisements, or metadata that should be removed before generation.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Step4Generate;
