"use client";

import { useStoryUpload } from "@/contexts/StoryUploadContext";
import { useParams } from "next/navigation";

export default function FloatingProgressWidget() {
  const { lng } = useParams();
  const {
    isUploading,
    isMinimized,
    progress,
    toggleMinimized,
    cancelUpload,
    setShowReviewModal,
  } = useStoryUpload();

  // Don't render if not uploading
  if (!isUploading && progress.stage === "idle") {
    return null;
  }

  // Show success message briefly after completion
  if (progress.stage === "complete") {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
        <div className="bg-green-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-medium">Story uploaded successfully!</span>
        </div>
      </div>
    );
  }

  // Error state
  if (progress.stage === "error") {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-red-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <div>
            <span className="font-medium">Upload failed</span>
            {progress.error && (
              <p className="text-sm text-red-200">{progress.error}</p>
            )}
          </div>
          <button
            onClick={cancelUpload}
            className="ml-2 text-red-200 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // Minimized state - thin horizontal bar at top
  if (isMinimized) {
    return (
      <div
        className="fixed top-0 left-0 right-0 z-50 cursor-pointer"
        onClick={toggleMinimized}
      >
        <div className="h-1 bg-gray-200">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
            style={{ width: `${progress.overallProgress}%` }}
          />
        </div>
        <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-white shadow-md rounded-full px-3 py-1 text-xs text-gray-600 flex items-center gap-2 hover:shadow-lg transition-shadow">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          <span>{progress.overallProgress}%</span>
          <span className="text-gray-400">|</span>
          <span>{progress.message}</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    );
  }

  // Expanded state - floating card
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="font-medium">Uploading Story</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMinimized}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              title="Minimize"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <button
              onClick={cancelUpload}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              title="Cancel"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Progress content */}
        <div className="p-4">
          {/* Stage indicator */}
          <div className="flex items-center gap-3 mb-3">
            <div className="relative">
              <svg className="w-10 h-10 -rotate-90">
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="4"
                />
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${progress.overallProgress} 100`}
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-700">
                {progress.overallProgress}%
              </span>
            </div>
            <div>
              <p className="font-medium text-gray-800">{progress.message}</p>
              {progress.currentLevel && (
                <p className="text-sm text-gray-500">
                  Level {progress.currentLevel.replace("l", "")} of 5
                </p>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 ease-out"
              style={{ width: `${progress.overallProgress}%` }}
            />
          </div>

          {/* Stage steps */}
          <div className="mt-4 flex justify-between text-xs text-gray-400">
            <StageStep
              label="Detect"
              active={["detecting-language", "detecting-level"].includes(progress.stage)}
              complete={progress.overallProgress > 20}
            />
            <StageStep
              label="Adapt"
              active={progress.stage === "rewriting-levels"}
              complete={progress.overallProgress > 70}
            />
            <StageStep
              label="Translate"
              active={progress.stage === "translating"}
              complete={progress.overallProgress > 90}
            />
            <StageStep
              label="Done"
              active={progress.stage === "review" || progress.stage === "complete"}
              complete={progress.stage === "complete"}
            />
          </div>
        </div>

        {/* Review prompt */}
        {progress.stage === "review" && (
          <div className="px-4 pb-4">
            <button
              onClick={() => setShowReviewModal(true)}
              className="w-full py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Review Your Story
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StageStep({ label, active, complete }: { label: string; active: boolean; complete: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-1 ${active ? "text-blue-500" : complete ? "text-green-500" : ""}`}>
      <div className={`w-2 h-2 rounded-full ${
        active ? "bg-blue-500 animate-pulse" :
        complete ? "bg-green-500" :
        "bg-gray-300"
      }`} />
      <span>{label}</span>
    </div>
  );
}
