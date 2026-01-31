// src/app/admin/upload-story/components/dev-tools/SUTPAlgorithms.tsx
// Main container for SU TP Algorithms testing system

"use client";

import { useState, useEffect, useCallback } from "react";
import type { FileType, StoryType } from "@/lib/story-processing/text-processors";
import { FileTypePicker } from "./FileTypePicker";
import { StoryTypePicker } from "./StoryTypePicker";
import { TestFileList, type TestFile } from "./TestFileList";
import { TestFileViewer } from "./TestFileViewer";

// Navigation state
type NavState =
  | { level: "fileType" }
  | { level: "storyType"; fileType: FileType }
  | { level: "fileList"; fileType: FileType; storyType: StoryType }
  | { level: "fileView"; fileType: FileType; storyType: StoryType; fileId: string };

// API response types
interface TestFileFull {
  id: string;
  fileType: string;
  storyType: string;
  fileName: string;
  fileSizeBytes: number;
  lastProcessedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  rawContent: string;
  processingResult: unknown;
}

export function SUTPAlgorithms() {
  const [navState, setNavState] = useState<NavState>({ level: "fileType" });
  const [files, setFiles] = useState<TestFile[]>([]);
  const [currentFile, setCurrentFile] = useState<TestFileFull | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch files for current fileType/storyType
  const fetchFiles = useCallback(async (fileType?: FileType, storyType?: StoryType) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (fileType) params.set("fileType", fileType);
      if (storyType) params.set("storyType", storyType);

      const res = await fetch(`/api/admin/algorithm-test-files?${params}`);
      if (!res.ok) throw new Error("Failed to fetch files");

      const data = await res.json();
      setFiles(data.files);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch single file
  const fetchFile = useCallback(async (fileId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/algorithm-test-files/${fileId}`);
      if (!res.ok) throw new Error("Failed to fetch file");

      const data = await res.json();
      setCurrentFile(data.file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load file");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load files when navigating to file list
  useEffect(() => {
    if (navState.level === "fileList") {
      fetchFiles(navState.fileType, navState.storyType);
    } else if (navState.level === "fileView") {
      fetchFile(navState.fileId);
    }
  }, [navState, fetchFiles, fetchFile]);

  // Navigation handlers
  const handleSelectFileType = (fileType: FileType) => {
    setNavState({ level: "storyType", fileType });
  };

  const handleSelectStoryType = (storyType: StoryType) => {
    if (navState.level === "storyType") {
      setNavState({ level: "fileList", fileType: navState.fileType, storyType });
    }
  };

  const handleSelectFile = (file: TestFile) => {
    if (navState.level === "fileList") {
      setNavState({
        level: "fileView",
        fileType: navState.fileType,
        storyType: navState.storyType,
        fileId: file.id,
      });
    }
  };

  const handleBackToFileTypes = () => {
    setNavState({ level: "fileType" });
    setFiles([]);
  };

  const handleBackToStoryTypes = () => {
    if (navState.level === "fileList" || navState.level === "fileView") {
      setNavState({ level: "storyType", fileType: navState.fileType });
      setFiles([]);
    }
  };

  const handleBackToFileList = () => {
    if (navState.level === "fileView") {
      setNavState({
        level: "fileList",
        fileType: navState.fileType,
        storyType: navState.storyType,
      });
      setCurrentFile(null);
    }
  };

  // Upload handler
  const handleUpload = async (file: File) => {
    if (navState.level !== "fileList") return;

    const content = await file.text();
    const res = await fetch("/api/admin/algorithm-test-files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileType: navState.fileType,
        storyType: navState.storyType,
        fileName: file.name,
        rawContent: content,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Upload failed");
    }

    // Refresh file list
    await fetchFiles(navState.fileType, navState.storyType);
  };

  // Run algorithm handler
  const handleRunAlgorithm = async () => {
    if (!currentFile) return;

    setIsProcessing(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/algorithm-test-files/${currentFile.id}/process`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Processing failed");
      }

      // Refresh file to get new results
      await fetchFile(currentFile.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed");
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (!currentFile || navState.level !== "fileView") return;

    const res = await fetch(`/api/admin/algorithm-test-files/${currentFile.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Delete failed");
    }

    // Go back to file list
    handleBackToFileList();
    // Refresh
    await fetchFiles(navState.fileType, navState.storyType);
  };

  // Get file counts for pickers
  const getFileTypeCounts = () => {
    const counts: Record<FileType, number> = { html: 0, txt: 0, rtf: 0, md: 0 };
    files.forEach((f) => {
      const ft = f.fileType as FileType;
      if (ft in counts) counts[ft]++;
    });
    return counts;
  };

  const getStoryTypeCounts = () => {
    const counts: Record<StoryType, number> = { anthology: 0, prose: 0, epic: 0, script: 0 };
    files.forEach((f) => {
      const st = f.storyType as StoryType;
      if (st in counts) counts[st]++;
    });
    return counts;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          SU TP Algorithms Testing
        </h2>
        <p className="text-sm text-gray-500">
          Test Story Upload Text Processing algorithms with persistent test files.
          Changes to algorithms in <code className="bg-gray-100 px-1 py-0.5 rounded">text-processors.ts</code> will
          affect both the upload pipeline and tests here.
        </p>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-4 text-red-500 hover:text-red-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {navState.level === "fileType" && (
          <FileTypePicker onSelect={handleSelectFileType} fileCounts={getFileTypeCounts()} />
        )}

        {navState.level === "storyType" && (
          <StoryTypePicker
            fileType={navState.fileType}
            onSelect={handleSelectStoryType}
            onBack={handleBackToFileTypes}
            fileCounts={getStoryTypeCounts()}
          />
        )}

        {navState.level === "fileList" && (
          <TestFileList
            fileType={navState.fileType}
            storyType={navState.storyType}
            files={files}
            onSelectFile={handleSelectFile}
            onBack={handleBackToStoryTypes}
            onUpload={handleUpload}
            onRefresh={() => fetchFiles(navState.fileType, navState.storyType)}
            isLoading={isLoading}
          />
        )}

        {navState.level === "fileView" && currentFile && (
          <TestFileViewer
            file={currentFile as never}
            onBack={handleBackToFileList}
            onRunAlgorithm={handleRunAlgorithm}
            onDelete={handleDelete}
            isProcessing={isProcessing}
          />
        )}

        {navState.level === "fileView" && !currentFile && isLoading && (
          <div className="text-center py-12 text-gray-500">Loading file...</div>
        )}
      </div>
    </div>
  );
}
