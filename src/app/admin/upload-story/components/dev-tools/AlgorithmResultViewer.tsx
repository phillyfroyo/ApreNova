// src/app/admin/upload-story/components/dev-tools/AlgorithmResultViewer.tsx
// Display algorithm processing results with stats, chapters, and extracted text

import type { ProcessingResult } from "@/lib/story-processing/text-processors";

interface AlgorithmResultViewerProps {
  result: ProcessingResult & { processingTimeMs?: number };
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            {chapters.map((chapter) => (
              <div
                key={chapter.number}
                className="bg-indigo-50 rounded-lg p-3 flex items-start justify-between"
              >
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
                <div className="text-xs text-gray-500 ml-4 whitespace-nowrap">
                  {chapter.rawText.length.toLocaleString()} chars
                </div>
              </div>
            ))}
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
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-3">
          Cleaned Full Text (First 5000 chars)
        </h4>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs font-mono whitespace-pre-wrap max-h-96 overflow-auto">
          {preprocessed.cleanedFullText.slice(0, 5000)}
          {preprocessed.cleanedFullText.length > 5000 && (
            <span className="text-yellow-500">
              {"\n\n"}... truncated ({(preprocessed.cleanedFullText.length - 5000).toLocaleString()} more chars) ...
            </span>
          )}
        </pre>
      </div>
    </div>
  );
}
