// src/app/admin/upload-story/components/dev-tools/TestFileViewer.tsx
// Full viewer for a test file with Raw/Output tabs and results history

import { useState } from "react";
import type { FileType, StoryType, ProcessingResult } from "@/lib/text-processing";
import { AlgorithmResultViewer } from "./AlgorithmResultViewer";

interface TestResult {
  id: string;
  result: ProcessingResult & { processingTimeMs?: number };
  processingTimeMs: number | null;
  createdAt: string;
}

interface TestFile {
  id: string;
  fileType: string;
  storyType: string;
  fileName: string;
  rawContent: string;
  fileSizeBytes: number;
  notes: string | null;
  createdAt: string;
  results: TestResult[];
}

interface TestFileViewerProps {
  file: TestFile;
  onBack: () => void;
  onBackToFileTypes: () => void;
  onBackToStoryTypes: () => void;
  onRunAlgorithm: () => Promise<void>;
  onDelete: () => Promise<void>;
  onRename: (newName: string) => Promise<void>;
  isProcessing: boolean;
}

type ViewTab = "raw" | "output";

const FILE_TYPE_LABELS: Record<FileType, string> = {
  html: "HTML",
  txt: "TXT",
  rtf: "RTF",
  md: "Markdown",
};

const STORY_TYPE_LABELS: Record<StoryType, string> = {
  anthology: "Anthology",
  prose: "Prose",
  epic: "Epic",
  script: "Script",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    timeZone: "America/Mexico_City",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }) + " CST";
}

export function TestFileViewer({
  file,
  onBack,
  onBackToFileTypes,
  onBackToStoryTypes,
  onRunAlgorithm,
  onDelete,
  onRename,
  isProcessing,
}: TestFileViewerProps) {
  const [activeTab, setActiveTab] = useState<ViewTab>("raw");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newFileName, setNewFileName] = useState(file.fileName);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(
    file.results[0]?.id || null
  );
  const [showResultsHistory, setShowResultsHistory] = useState(false);

  const selectedResult = file.results.find((r) => r.id === selectedResultId);
  const hasResults = file.results.length > 0;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleRunAlgorithm = async () => {
    await onRunAlgorithm();
    setActiveTab("output");
  };

  const handleRename = async () => {
    if (!newFileName.trim() || newFileName === file.fileName) {
      setIsRenaming(false);
      setNewFileName(file.fileName);
      return;
    }
    setRenameError(null);
    try {
      await onRename(newFileName.trim());
      setIsRenaming(false);
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : "Rename failed");
    }
  };

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <button onClick={onBackToFileTypes} className="hover:text-blue-600 hover:underline">
          SU TP Algorithms
        </button>
        <span>/</span>
        <button onClick={onBackToStoryTypes} className="hover:text-blue-600 hover:underline">
          {FILE_TYPE_LABELS[file.fileType as FileType]}
        </button>
        <span>/</span>
        <button onClick={onBack} className="hover:text-blue-600 hover:underline">
          {STORY_TYPE_LABELS[file.storyType as StoryType]}
        </button>
        <span>/</span>
        <span className="text-gray-900 font-medium">{file.fileName}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          {isRenaming ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                  if (e.key === "Escape") {
                    setIsRenaming(false);
                    setNewFileName(file.fileName);
                  }
                }}
                className="text-xl font-semibold text-gray-900 border border-blue-500 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <button
                onClick={handleRename}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsRenaming(false);
                  setNewFileName(file.fileName);
                  setRenameError(null);
                }}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-semibold text-gray-900">{file.fileName}</h3>
              <button
                onClick={() => setIsRenaming(true)}
                className="text-gray-400 hover:text-blue-600 text-sm"
                title="Rename file"
              >
                ✏️
              </button>
            </div>
          )}
          {renameError && (
            <p className="text-sm text-red-600 mt-1">{renameError}</p>
          )}
          <div className="text-sm text-gray-500 mt-1 flex items-center gap-4">
            <span>{formatBytes(file.fileSizeBytes)}</span>
            <span>
              {FILE_TYPE_LABELS[file.fileType as FileType]} /{" "}
              {STORY_TYPE_LABELS[file.storyType as StoryType]}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {showDeleteConfirm ? (
            <>
              <span className="text-sm text-red-600 mr-2">Delete this file?</span>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-3 py-1 text-sm text-red-600 hover:text-red-700"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setActiveTab("raw")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "raw"
              ? "bg-gray-800 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Raw Source
        </button>
        <button
          onClick={() => setActiveTab("output")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "output"
              ? "bg-blue-600 text-white"
              : "bg-blue-100 text-blue-700 hover:bg-blue-200"
          }`}
        >
          Algorithm Output
        </button>
      </div>

      {/* Raw Source Tab */}
      {activeTab === "raw" && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900">Raw Source</h4>
            <span className="text-sm text-gray-500">
              {file.rawContent.length.toLocaleString()} characters
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            This is the full, untruncated file content.
          </p>

          {/* Quick stats for HTML */}
          {file.fileType === "html" && (
            <div className="flex gap-4 mb-4 text-sm">
              <span className="text-blue-600">
                {(file.rawContent.match(/<pre[\s>]/gi) || []).length} &lt;pre&gt; tags
              </span>
              <span className="text-green-600">
                {(file.rawContent.match(/<p[\s>]/gi) || []).length} &lt;p&gt; tags
              </span>
              <span className="text-yellow-600">
                {(file.rawContent.match(/<table[\s>]/gi) || []).length} &lt;table&gt; tags
              </span>
              <span className="text-purple-600">
                {(file.rawContent.match(/<h[1-6][\s>]/gi) || []).length} header tags
              </span>
            </div>
          )}

          <div className="bg-gray-900 rounded-lg p-4 max-h-[600px] overflow-auto">
            <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap">
              {file.rawContent}
            </pre>
          </div>
        </div>
      )}

      {/* Algorithm Output Tab */}
      {activeTab === "output" && (
        <div className="space-y-4">
          {/* Run/Re-run button */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleRunAlgorithm}
              disabled={isProcessing}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isProcessing ? "Processing..." : hasResults ? "Re-run Algorithm" : "Run Algorithm"}
            </button>
            {isProcessing && (
              <span className="text-sm text-gray-500">Running algorithm...</span>
            )}
          </div>

          {/* Results History */}
          {hasResults && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <button
                onClick={() => setShowResultsHistory(!showResultsHistory)}
                className="flex items-center justify-between w-full text-left"
              >
                <span className="text-sm font-medium text-gray-700">
                  Previous Results ({file.results.length})
                </span>
                <span className="text-gray-400">{showResultsHistory ? "▲" : "▼"}</span>
              </button>

              {showResultsHistory && (
                <div className="mt-3 space-y-1">
                  {file.results.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => setSelectedResultId(result.id)}
                      className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                        selectedResultId === result.id
                          ? "bg-blue-100 text-blue-800"
                          : "hover:bg-gray-100 text-gray-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{formatDate(result.createdAt)}</span>
                        <span className="text-xs text-gray-500">
                          {result.processingTimeMs}ms
                        </span>
                      </div>
                      {selectedResultId === result.id && (
                        <span className="text-xs text-blue-600">← viewing</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {!showResultsHistory && selectedResult && (
                <div className="mt-2 text-sm text-gray-500">
                  Viewing: {formatDate(selectedResult.createdAt)}
                  {selectedResult.processingTimeMs && (
                    <span className="ml-2">({selectedResult.processingTimeMs}ms)</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Result Display */}
          {selectedResult ? (
            <AlgorithmResultViewer result={selectedResult.result} />
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center text-gray-500">
              <p className="text-lg mb-2">No results yet</p>
              <p className="text-sm">Click "Run Algorithm" to process this file</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
