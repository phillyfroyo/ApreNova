// src/app/admin/upload-story/components/dev-tools/AlgorithmResultViewer.tsx
// Display algorithm processing results with stats, chapters, and extracted text

import type { ProcessingResult, DetectedChapter } from "@/lib/text-processing";
import { countPoems, detectPoemBoundaries, type DetectedPoem } from "@/lib/text-processing";
import { useState } from "react";

interface AlgorithmResultViewerProps {
  result: ProcessingResult & { processingTimeMs?: number };
}

// Expandable chapter card showing poem titles
function ChapterCard({
  chapter,
  poemCount,
  poems
}: {
  chapter: DetectedChapter;
  poemCount: number;
  poems: DetectedPoem[];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-indigo-50 rounded-lg p-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-indigo-800">
              Chapter {chapter.number}
            </span>
            {chapter.title && chapter.title !== `Chapter ${chapter.number}` && (
              <span className="text-indigo-600">{chapter.title}</span>
            )}
          </div>
          {chapter.subtitle && (
            <div className="text-sm text-indigo-500">{chapter.subtitle}</div>
          )}
          <div className="text-xs text-gray-600 mt-1 truncate">
            {chapter.rawText.slice(0, 100)}...
          </div>
        </div>
        <div className="text-xs text-gray-500 ml-4 whitespace-nowrap text-right">
          <div>{chapter.rawText.length.toLocaleString()} chars</div>
          {poemCount > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-green-600 font-medium hover:text-green-800 hover:underline"
            >
              {poemCount} poem{poemCount !== 1 ? 's' : ''} {expanded ? '▼' : '▶'}
            </button>
          )}
        </div>
      </div>

      {/* Expandable poem list */}
      {expanded && poems.length > 0 && (
        <div className="mt-3 pl-4 border-l-2 border-indigo-200">
          <div className="text-xs text-gray-600 space-y-1 max-h-48 overflow-auto">
            {poems.map((poem, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-indigo-400 font-mono">{idx + 1}.</span>
                <span className="truncate" title={poem.title || '(untitled)'}>
                  {poem.title || '(untitled)'}
                </span>
                <span className="text-gray-400 text-[10px]">
                  ({poem.lines.length} lines)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AlgorithmResultViewer({ result }: AlgorithmResultViewerProps) {
  const { extractionStats, preprocessed, errors, processedAt, processingTimeMs } = result;
  const { stats, chapters, frontMatter, backMatter } = preprocessed;

  return (
    <div className="space-y-6">
      {/* Processing Info */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <div className="flex items-center justify-between">
          <span className="text-blue-800 font-medium">Algorithm Run</span>
          <span className="text-blue-600 text-sm">
            {processedAt && new Date(processedAt).toLocaleString()}
          </span>
        </div>
        {processingTimeMs && (
          <div className="text-blue-600 text-sm mt-1">
            Completed in {processingTimeMs}ms
          </div>
        )}
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <h4 className="text-red-800 font-medium mb-2">Errors</h4>
          <ul className="list-disc list-inside text-red-700 text-sm space-y-1">
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Stats Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-gray-700">
              {extractionStats.originalLength.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">Original Length</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-gray-700">
              {extractionStats.extractedLength.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">Extracted Length</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.chaptersDetected}</div>
            <div className="text-xs text-gray-500">Chapters Detected</div>
          </div>
          {stats.poemCount !== undefined && stats.poemCount > 0 && (
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.poemCount}</div>
              <div className="text-xs text-gray-500">Poems Detected</div>
            </div>
          )}
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {stats.structureType.toUpperCase()}
            </div>
            <div className="text-xs text-gray-500">Structure Type</div>
          </div>
        </div>

        {/* Additional stats */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          <div className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
            <span className="text-gray-500">Line Numbers:</span>
            <span className="font-medium">{stats.lineNumbersRemoved}</span>
          </div>
          <div className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
            <span className="text-gray-500">Page Markers:</span>
            <span className="font-medium">{stats.pageMarkersRemoved}</span>
          </div>
          <div className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
            <span className="text-gray-500">Footnotes:</span>
            <span className="font-medium">{stats.footnoteIndicatorsRemoved}</span>
          </div>
          <div className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
            <span className="text-gray-500">Asterisks:</span>
            <span className="font-medium">{stats.asteriskDividersRemoved}</span>
          </div>
          <div className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
            <span className="text-gray-500">Line Style:</span>
            <span className="font-medium">{stats.lineBreakStyle}</span>
          </div>
        </div>

        {extractionStats.annotationsExtracted !== undefined && (
          <div className="mt-3 text-sm text-amber-600">
            {extractionStats.annotationsExtracted} annotations extracted
          </div>
        )}

        {stats.backMatterRemoved && (
          <div className="mt-3 text-sm text-green-600">
            Back matter was detected and removed
          </div>
        )}
      </div>

      {/* Chapters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h4 className="text-lg font-semibold text-indigo-600 mb-4">
          Detected Chapters ({chapters.length})
        </h4>
        {chapters.length === 0 ? (
          <p className="text-sm text-gray-500">No chapters detected</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-auto">
            {chapters.map((chapter) => {
              // Detect poems in this chapter (only for anthology type)
              const chapterLines = chapter.rawText.split('\n');
              const detectedPoems = stats.structureType === 'anthology'
                ? detectPoemBoundaries(chapterLines)
                : [];
              const chapterPoemCount = detectedPoems.length;

              return (
                <ChapterCard
                  key={chapter.number}
                  chapter={chapter}
                  poemCount={chapterPoemCount}
                  poems={detectedPoems}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Front Matter */}
      {frontMatter && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h4 className="text-lg font-semibold text-amber-600 mb-3">
            Front Matter (Removed)
          </h4>
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs font-mono whitespace-pre-wrap max-h-40 overflow-auto">
            {frontMatter.slice(0, 2000)}
            {frontMatter.length > 2000 && "\n\n... truncated ..."}
          </pre>
        </div>
      )}

      {/* Back Matter */}
      {backMatter && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h4 className="text-lg font-semibold text-amber-600 mb-3">
            Back Matter (Removed)
          </h4>
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs font-mono whitespace-pre-wrap max-h-40 overflow-auto">
            {backMatter.slice(0, 2000)}
            {backMatter.length > 2000 && "\n\n... truncated ..."}
          </pre>
        </div>
      )}

      {/* Cleaned Full Text */}
      <CleanedTextViewer text={preprocessed.cleanedFullText} />
    </div>
  );
}

// Searchable cleaned text viewer
function CleanedTextViewer({ text }: { text: string }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAll, setShowAll] = useState(false);

  // Find matches and their positions
  const matches: number[] = [];
  if (searchTerm.length >= 2) {
    const searchLower = searchTerm.toLowerCase();
    let pos = 0;
    while ((pos = text.toLowerCase().indexOf(searchLower, pos)) !== -1) {
      matches.push(pos);
      pos += 1;
    }
  }

  // Get display text - either first 5000 chars or context around first match
  let displayText = text;
  let startOffset = 0;

  if (!showAll) {
    if (matches.length > 0) {
      // Show context around first match
      const matchPos = matches[0];
      startOffset = Math.max(0, matchPos - 500);
      const endOffset = Math.min(text.length, matchPos + 2000);
      displayText = text.slice(startOffset, endOffset);
    } else {
      displayText = text.slice(0, 5000);
    }
  }

  // Highlight search term in display
  const highlightText = (content: string) => {
    if (!searchTerm || searchTerm.length < 2) return content;

    const parts = content.split(new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === searchTerm.toLowerCase()
        ? <mark key={i} className="bg-yellow-300 text-black">{part}</mark>
        : part
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-lg font-semibold text-gray-900">
          Cleaned Full Text {!showAll && `(${showAll ? 'Full' : 'Preview'})`}
        </h4>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search text..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-1 text-sm border border-gray-300 rounded-md w-48"
          />
          {matches.length > 0 && (
            <span className="text-sm text-green-600">{matches.length} matches</span>
          )}
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-sm text-blue-600 hover:underline"
          >
            {showAll ? 'Show Preview' : 'Show All'}
          </button>
        </div>
      </div>

      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs font-mono whitespace-pre-wrap max-h-96 overflow-auto">
        {startOffset > 0 && (
          <span className="text-yellow-500">... ({startOffset.toLocaleString()} chars before) ...{"\n\n"}</span>
        )}
        {highlightText(displayText)}
        {!showAll && displayText.length < text.length && (
          <span className="text-yellow-500">
            {"\n\n"}... truncated ({(text.length - displayText.length - startOffset).toLocaleString()} more chars) ...
          </span>
        )}
      </pre>
    </div>
  );
}
