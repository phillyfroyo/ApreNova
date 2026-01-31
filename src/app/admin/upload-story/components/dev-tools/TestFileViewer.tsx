// src/app/admin/upload-story/components/dev-tools/TestFileViewer.tsx
// Full viewer for a test file with Raw/Output tabs

import { useState } from "react";
import type { FileType, StoryType, ProcessingResult } from "@/lib/story-processing/text-processors";
import { AlgorithmResultViewer } from "./AlgorithmResultViewer";

interface TestFile {
  id: string;
  fileType: string;
  storyType: string;
  fileName: string;
  rawContent: string;
  fileSizeBytes: number;
  lastProcessedAt: string | null;
  processingResult: (ProcessingResult & { processingTimeMs?: number }) | null;
  notes: string | null;
  createdAt: string;
}

interface TestFileViewerProps {
  file: TestFile;
  onBack: () => void;
  onRunAlgorithm: () => Promise<void>;
  onDelete: () => Promise<void>;
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

export function TestFileViewer({
  file,
  onBack,
  onRunAlgorithm,
  onDelete,
  isProcessing,
}: TestFileViewerProps) {
  const [activeTab, setActiveTab] = useState<ViewTab>("raw");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <button onClick={onBack} className="hover:text-gray-700">
          SU TP Algorithms
        </button>
        <span>/</span>
        <span>{FILE_TYPE_LABELS[file.fileType as FileType]}</span>
        <span>/</span>
        <span>{STORY_TYPE_LABELS[file.storyType as StoryType]}</span>
        <span>/</span>
        <span className="text-gray-900 font-medium">{file.fileName}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">{file.fileName}</h3>
          <div className="text-sm text-gray-500 mt-1 flex items-center gap-4">
            <span>{formatBytes(file.fileSizeBytes)}</span>
            <span>
              {FILE_TYPE_LABELS[file.fileType as FileType]} /{" "}
              {STORY_TYPE_LABELS[file.storyType as StoryType]}
            </span>
            {file.lastProcessedAt && (
              <span className="text-green-600">
                Last processed: {new Date(file.lastProcessedAt).toLocaleString()}
              </span>
            )}
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
      <div className="flex items-center gap-4 mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("raw")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "raw"
                ? "bg-gray-800 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            1. Raw Source
          </button>
          <button
            onClick={() => (file.processingResult ? setActiveTab("output") : handleRunAlgorithm())}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "output"
                ? "bg-blue-600 text-white"
                : "bg-blue-100 text-blue-700 hover:bg-blue-200"
            } ${isProcessing ? "opacity-50 cursor-wait" : ""}`}
          >
            {isProcessing
              ? "Processing..."
              : file.processingResult
              ? "2. Algorithm Output"
              : "2. Run Algorithm →"}
          </button>
        </div>
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
            This is the full, untruncated file content. Review the source before running the
            algorithm.
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

          <button
            onClick={handleRunAlgorithm}
            disabled={isProcessing}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isProcessing ? "Processing..." : "Run Algorithm →"}
          </button>
        </div>
      )}

      {/* Algorithm Output Tab */}
      {activeTab === "output" && (
        <>
          {file.processingResult ? (
            <AlgorithmResultViewer result={file.processingResult} />
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg mb-4">No processing result yet</p>
              <button
                onClick={handleRunAlgorithm}
                disabled={isProcessing}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isProcessing ? "Processing..." : "Run Algorithm"}
              </button>
            </div>
          )}

          {file.processingResult && (
            <div className="mt-6">
              <button
                onClick={handleRunAlgorithm}
                disabled={isProcessing}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isProcessing ? "Processing..." : "Re-run Algorithm"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
