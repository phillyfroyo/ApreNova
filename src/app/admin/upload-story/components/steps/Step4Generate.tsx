"use client";

import { useState, useMemo } from "react";
import type { StoryData } from "../../types";
import { useRewritePipeline, scanLineAlignment, scanQuoteMismatches } from "../../hooks/useRewritePipeline";
import { ComparisonModal } from "@/components/ComparisonModal";
import { OriginalTextModal } from "../OriginalTextModal";
import { cleanText } from "@/lib/admin/text-utils";

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
    retryStatus,
    error,
    getLevelMode,
    setLevelMode,
    processSingleLevel,
    processAllLevels,
    cancel,
    resetLevel,
    getContentWarnings,
    comparisonLevel,
    openComparison,
    closeComparison,
  } = pipeline;

  const allDone = [1, 2, 3, 4, 5, 6].every((l) => {
    const mode = getLevelMode(l);
    return mode === "omit" || storyData.levelContent[l]?.status === "done";
  });

  const originalText = cleanText(storyData.rawText);
  const comparisonContent = comparisonLevel !== null ? storyData.levelContent[comparisonLevel] : null;

  // Line breakdown expansion state
  const [expandedLineBreakdown, setExpandedLineBreakdown] = useState<number | null>(null);

  // Detect duplicate chapter markers in text
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
          {[1, 2, 3, 4, 5, 6].map((level) => {
            const content = storyData.levelContent[level];
            const isSource = level === storyData.detectedLevel;
            const mode = getLevelMode(level);
            const isOmitted = mode === "omit";
            const warnings = content?.status === "done" ? getContentWarnings(level) : [];

            // Duplicate chapter detection
            const dupeChapters = content?.status === "done" && content?.sourceText
              ? detectDupeChapters(content.sourceText)
              : null;

            // Line alignment detection (original vs rewrite)
            const alignmentWarnings = content?.status === "done" && content.mode !== "use-original" && content?.sourceText
              ? scanLineAlignment(originalText, content.sourceText)
              : [];

            // Quote mismatch detection (original vs rewrite)
            const quoteMismatches = content?.status === "done" && content.mode !== "use-original" && content?.sourceText
              ? scanQuoteMismatches(originalText, content.sourceText, level)
              : [];

            // Quick line mismatch check for card border coloring
            const hasLineMismatch = content?.status === "done" && content.mode !== "use-original" && content?.sourceText && (() => {
              const origLines = originalText.split("\n");
              const rewriteLines = content.sourceText.split("\n");
              const origContent = origLines.filter(l => l.trim()).length;
              const rewriteContent = rewriteLines.filter(l => l.trim()).length;
              return origLines.length !== rewriteLines.length || origContent !== rewriteContent;
            })();

            return (
              <div
                key={level}
                className={`p-4 rounded-lg border-2 transition-all ${
                  dupeChapters
                    ? "border-red-500 bg-red-50"
                    : isOmitted
                    ? "border-gray-200 bg-gray-50 opacity-60"
                    : content?.status === "done" && hasLineMismatch
                    ? "border-amber-500 bg-amber-50"
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
                        dupeChapters
                          ? "bg-red-600 text-white"
                          : isOmitted
                          ? "bg-gray-300 text-gray-500"
                          : content?.status === "done" && hasLineMismatch
                          ? "bg-amber-500 text-white"
                          : content?.status === "done"
                          ? "bg-green-600 text-white"
                          : content?.status === "generating"
                          ? "bg-blue-600 text-white animate-pulse"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {dupeChapters ? "!" : isOmitted ? "—" : content?.status === "done" && hasLineMismatch ? "⚠" : content?.status === "done" ? "✓" : `L${level}`}
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
                            : retryStatus
                              ? retryStatus
                              : chapterProgress
                                ? chapterProgress.subChunk
                                  ? `Chapters ${chapterProgress.current}-${chapterProgress.batchEnd}/${chapterProgress.total} (part ${chapterProgress.subChunk.current}/${chapterProgress.subChunk.total})...`
                                  : `Generating chapters ${chapterProgress.current}-${chapterProgress.batchEnd} of ${chapterProgress.total}...`
                                : "Generating..."
                          : content?.status === "done"
                          ? `${content.sourceText.split("\n").filter((l) => l.trim()).length} lines • ${content.mode === "use-original" ? "Original text" : "AI generated"}${hasLineMismatch ? " • line mismatch" : ""}`
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
                        onClick={() => openComparison(isSource ? -1 : level)}
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

                {/* Line count comparison (original vs rewrite) */}
                {content?.status === "done" && content.mode !== "use-original" && (() => {
                  const isBreakdownExpanded = expandedLineBreakdown === level;
                  const chapterPattern = /^---\s*(Chapter|Capítulo)\s*(\d+)(?::\s*(.+?))?\s*---$/i;

                  const parseChapters = (lines: string[]) => {
                    type ChapterInfo = { number: number; title: string; startLine: number };
                    const chapters: { number: number; title: string; startLine: number; totalLines: number; contentLines: number }[] = [];
                    let currentChapter: ChapterInfo | null = null;

                    lines.forEach((line, idx) => {
                      const match = line.match(chapterPattern);
                      if (match) {
                        if (currentChapter) {
                          const slice = lines.slice(currentChapter.startLine + 1, idx);
                          chapters.push({
                            number: currentChapter.number, title: currentChapter.title, startLine: currentChapter.startLine,
                            totalLines: slice.length,
                            contentLines: slice.filter(l => l.trim()).length,
                          });
                        }
                        currentChapter = { number: parseInt(match[2], 10), title: match[3] || "", startLine: idx };
                      }
                    });
                    if (currentChapter) {
                      const chap = currentChapter as ChapterInfo;
                      const slice = lines.slice(chap.startLine + 1);
                      chapters.push({
                        number: chap.number, title: chap.title, startLine: chap.startLine,
                        totalLines: slice.length,
                        contentLines: slice.filter(l => l.trim()).length,
                      });
                    }
                    return chapters;
                  };

                  const origLines = originalText.split("\n");
                  const rewriteLines = content.sourceText.split("\n");
                  const origChapters = parseChapters(origLines);
                  const rewriteChapters = parseChapters(rewriteLines);
                  const hasChapters = origChapters.length > 1 || rewriteChapters.length > 1;

                  // Total lines (content + blank) — catches alignment/spacing issues
                  const origTotal = hasChapters ? origChapters.reduce((s, c) => s + c.totalLines, 0) : origLines.length;
                  const rewriteTotal = hasChapters ? rewriteChapters.reduce((s, c) => s + c.totalLines, 0) : rewriteLines.length;
                  const totalMatch = origTotal === rewriteTotal;

                  // Content lines only — catches missing/extra content
                  const origContent = hasChapters ? origChapters.reduce((s, c) => s + c.contentLines, 0) : origLines.filter(l => l.trim()).length;
                  const rewriteContent = hasChapters ? rewriteChapters.reduce((s, c) => s + c.contentLines, 0) : rewriteLines.filter(l => l.trim()).length;
                  const contentMatch = origContent === rewriteContent;

                  const allGood = totalMatch && contentMatch;

                  // Find mismatched chapters for each metric
                  const totalMismatched = hasChapters ? origChapters
                    .filter(sc => { const rc = rewriteChapters.find(c => c.number === sc.number); return rc ? rc.totalLines !== sc.totalLines : true; })
                    .map(sc => `Ch ${sc.number}`) : [];
                  const contentMismatched = hasChapters ? origChapters
                    .filter(sc => { const rc = rewriteChapters.find(c => c.number === sc.number); return rc ? rc.contentLines !== sc.contentLines : true; })
                    .map(sc => `Ch ${sc.number}`) : [];

                  const LineRow = ({ label, src, trans, match, mismatched }: { label: string; src: number; trans: number; match: boolean; mismatched: string[] }) => (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-xs w-20">{label}:</span>
                      <span className={`text-sm font-medium ${match ? 'text-green-600' : 'text-amber-600'}`}>
                        {src} <span className="text-gray-400 mx-0.5">{"→"}</span> {trans}
                        {match ? (
                          <span className="text-green-500 ml-1">&#10003;</span>
                        ) : (
                          <span className="text-amber-500 ml-1">
                            ({trans - src > 0 ? '+' : ''}{trans - src})
                            {mismatched.length > 0 && <span className="text-xs ml-1">{mismatched.join(', ')}</span>}
                          </span>
                        )}
                      </span>
                    </div>
                  );

                  return (
                    <div className="mt-3">
                      {!allGood && (
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span className="text-xs font-medium text-amber-600">Line mismatch — may affect translation alignment</span>
                        </div>
                      )}
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
                          <div className="flex flex-col gap-0.5">
                            <LineRow label="total lines" src={origTotal} trans={rewriteTotal} match={totalMatch} mismatched={totalMismatched} />
                            <LineRow label="content lines" src={origContent} trans={rewriteContent} match={contentMatch} mismatched={contentMismatched} />
                          </div>
                        </div>
                      </div>
                      {isBreakdownExpanded && hasChapters && (
                        <div className="mt-2 ml-6 bg-gray-50 rounded-lg p-3 text-xs space-y-1.5 max-h-48 overflow-y-auto">
                          {origChapters.map((origCh) => {
                            const rwCh = rewriteChapters.find(c => c.number === origCh.number);
                            const chTotalOk = rwCh ? rwCh.totalLines === origCh.totalLines : false;
                            const chContentOk = rwCh ? rwCh.contentLines === origCh.contentLines : false;
                            const chapterOk = chTotalOk && chContentOk;

                            return (
                              <div
                                key={origCh.number}
                                className={`flex items-center justify-between px-2 py-1 rounded ${chapterOk ? 'bg-green-50' : 'bg-amber-50'}`}
                              >
                                <span className="text-gray-700 font-medium">
                                  Ch. {origCh.number}
                                  {origCh.title && <span className="font-normal text-gray-500 ml-1">({origCh.title.slice(0, 20)}{origCh.title.length > 20 ? '...' : ''})</span>}
                                </span>
                                <div className="flex gap-3 text-xs">
                                  <span className={chTotalOk ? 'text-green-600' : 'text-amber-600'}>
                                    {origCh.totalLines}{rwCh ? ` → ${rwCh.totalLines}` : ''}
                                    {!chTotalOk && rwCh && <span className="ml-0.5 opacity-75">({(rwCh.totalLines - origCh.totalLines) > 0 ? '+' : ''}{rwCh.totalLines - origCh.totalLines})</span>}
                                  </span>
                                  <span className="text-gray-300">|</span>
                                  <span className={chContentOk ? 'text-green-600' : 'text-amber-600'}>
                                    {origCh.contentLines}{rwCh ? ` → ${rwCh.contentLines}` : ''}
                                    {!chContentOk && rwCh && <span className="ml-0.5 opacity-75">({(rwCh.contentLines - origCh.contentLines) > 0 ? '+' : ''}{rwCh.contentLines - origCh.contentLines})</span>}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Duplicate chapter warning */}
                {dupeChapters && (
                  <div className="mt-3 bg-red-50 border border-red-300 rounded-lg p-3 flex items-start gap-2">
                    <svg className="w-4 h-4 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="text-sm text-red-700">
                      <span className="font-medium">Corrupted data: duplicate chapters detected.</span>
                      <span> Chapters {dupeChapters.join(', ')}.</span>
                      <span> Reset this level and regenerate.</span>
                    </div>
                  </div>
                )}

                {/* Line alignment warnings */}
                {alignmentWarnings.length > 0 && (
                  <div className="mt-3 bg-orange-50 border border-orange-300 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-orange-700 font-medium text-sm mb-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      {alignmentWarnings.length} line alignment issue{alignmentWarnings.length > 1 ? "s" : ""} — may affect translation step
                    </div>
                    <ul className="space-y-1">
                      {alignmentWarnings.map((w, i) => (
                        <li key={i} className="text-xs text-orange-600">
                          Ch {w.chapter}, line {w.line}: {w.type === 'left_blank' ? 'original blank, rewrite has content' : 'original has content, rewrite blank'}
                          {" — "}<code className="bg-orange-100 px-1 rounded">
                            {w.type === 'left_blank'
                              ? `"" ↔ "${w.rightContent}"`
                              : `"${w.leftContent}" ↔ ""`}
                          </code>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {warnings.length > 0 && (
                  <div className="mt-3 bg-amber-50 border border-amber-300 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-amber-700 font-medium text-sm mb-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      {warnings.length} content warning{warnings.length > 1 ? "s" : ""} detected
                    </div>
                    <ul className="space-y-1">
                      {warnings.map((w, i) => (
                        <li key={i} className="text-xs text-amber-600">
                          Ch {w.chapter}, line {w.line}: <span className="font-medium">{w.type === "error_marker" ? "Error marker" : w.type === "ai_refusal" ? "AI refusal" : "Translation failed"}</span>
                          {" — "}<code className="bg-amber-100 px-1 rounded">{w.text.slice(0, 80)}{w.text.length > 80 ? "..." : ""}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {quoteMismatches.length > 0 && (
                  <div className="mt-3 bg-yellow-50 border border-yellow-300 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-yellow-700 font-medium text-sm mb-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                      {quoteMismatches.length} quote mismatch{quoteMismatches.length > 1 ? "es" : ""} in rewrite
                    </div>
                    <ul className="space-y-1">
                      {quoteMismatches.map((w, i) => (
                        <li key={i} className="text-xs text-yellow-600">
                          Ch {w.chapter}, line {w.line}: <code className="bg-yellow-100 px-1 rounded">{w.text}</code>
                        </li>
                      ))}
                    </ul>
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
                ? retryStatus
                  ? retryStatus
                  : chapterProgress
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
          quoteWarningsByChapter={(() => {
            const warnings = scanQuoteMismatches(originalText, comparisonContent.sourceText, comparisonLevel);
            const byChapter: Record<number, number[]> = {};
            for (const w of warnings) {
              if (!byChapter[w.chapter]) byChapter[w.chapter] = [];
              byChapter[w.chapter].push(w.line - 1); // convert to 0-indexed
            }
            return Object.keys(byChapter).length > 0 ? byChapter : undefined;
          })()}
          onSave={(edits) => {
            if (comparisonLevel === null) return;
            const current = storyData.levelContent[comparisonLevel];
            if (!current) return;
            updateStoryData({
              levelContent: {
                ...storyData.levelContent,
                [comparisonLevel]: {
                  ...current,
                  ...(edits.right !== undefined && { sourceText: edits.right }),
                },
              },
            });
          }}
          editableSide="right"
        />
      )}

      {/* Original Text Review Modal (level -1) */}
      {comparisonLevel === -1 && (
        <OriginalTextModal
          originalText={originalText}
          detectedLevel={storyData.detectedLevel}
          onSave={(newText) => {
            // Update rawText and sync source level's sourceText
            const updates: Partial<StoryData> = { rawText: newText };
            const sourceLevel = storyData.detectedLevel;
            if (sourceLevel && storyData.levelContent[sourceLevel]?.status === "done") {
              updates.levelContent = {
                ...storyData.levelContent,
                [sourceLevel]: {
                  ...storyData.levelContent[sourceLevel],
                  sourceText: newText,
                },
              };
            }
            updateStoryData(updates);
          }}
          onClose={closeComparison}
        />
      )}
    </>
  );
}

export default Step4Generate;
