// src/app/admin/upload-story/components/dev-tools/TestFileList.tsx
// List of test files with drag-drop upload

import { useState, useCallback } from "react";
import type { FileType, StoryType } from "@/lib/story-processing/text-processors";

export interface TestFile {
  id: string;
  fileType?: string;
  storyType?: string;
  fileName: string;
  fileSizeBytes: number;
  lastProcessedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt?: string;
}

interface TestFileListProps {
  fileType: FileType;
  storyType: StoryType;
  files: TestFile[];
  onSelectFile: (file: TestFile) => void;
  onBack: () => void;
  onUpload: (file: File) => Promise<void>;
  onRefresh: () => void;
  isLoading: boolean;
}

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
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function TestFileList({
  fileType,
  storyType,
  files,
  onSelectFile,
  onBack,
  onUpload,
  onRefresh,
  isLoading,
}: TestFileListProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      setUploadError(null);

      const file = e.dataTransfer.files?.[0];
      if (!file) return;

      setIsUploading(true);
      try {
        await onUpload(file);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsUploading(false);
      }
    },
    [onUpload]
  );

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      setUploadError(null);
      try {
        await onUpload(file);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsUploading(false);
      }
    },
    [onUpload]
  );

  return (
    <div>
      {/* Back button */}
      <button
        onClick={onBack}
        className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-2"
      >
        <span>←</span>
        <span>Back to Story Types</span>
      </button>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {FILE_TYPE_LABELS[fileType]} / {STORY_TYPE_LABELS[storyType]}
          </h3>
          <p className="text-sm text-gray-500">
            {files.length} test file{files.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
        >
          {isLoading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Upload zone */}
      <label className="block mb-6">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 hover:border-blue-500"
          } ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            onChange={handleFileInput}
            className="hidden"
            disabled={isUploading}
          />
          {isUploading ? (
            <p className="text-gray-600">Uploading...</p>
          ) : isDragging ? (
            <p className="text-blue-600">Drop file here...</p>
          ) : (
            <>
              <p className="text-gray-700 mb-1">
                Drop a file here or click to upload
              </p>
              <p className="text-gray-400 text-sm">
                Add a test file to {FILE_TYPE_LABELS[fileType]} /{" "}
                {STORY_TYPE_LABELS[storyType]}
              </p>
            </>
          )}
        </div>
      </label>

      {uploadError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {uploadError}
        </div>
      )}

      {/* File list */}
      {files.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No test files yet</p>
          <p className="text-sm">
            Upload a file above to start testing algorithms
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <button
              key={file.id}
              onClick={() => onSelectFile(file)}
              className="w-full bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-500 hover:shadow-sm transition-all text-left flex items-center justify-between group"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 group-hover:text-blue-600 truncate">
                  {file.fileName}
                </div>
                <div className="text-sm text-gray-500 flex items-center gap-3 mt-1">
                  <span>{formatBytes(file.fileSizeBytes)}</span>
                  <span>Created {formatDate(file.createdAt)}</span>
                  {file.lastProcessedAt && (
                    <span className="text-green-600">
                      Processed {formatDate(file.lastProcessedAt)}
                    </span>
                  )}
                </div>
                {file.notes && (
                  <div className="text-sm text-gray-400 mt-1 truncate">
                    {file.notes}
                  </div>
                )}
              </div>
              <div className="text-gray-400 group-hover:text-blue-500 ml-4">
                →
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
