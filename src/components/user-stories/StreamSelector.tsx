"use client";

import { useState, useEffect, useRef } from "react";
import { useStoryUpload, StreamProgress } from "@/contexts/StoryUploadContext";
import { toCEFR } from "@/lib/cefr";

interface StreamSelectorProps {
  streams: StreamProgress[];
  lng: string;
  setShowProgressViewer: (show: boolean) => void;
  /**
   * When true, shows all complete streams regardless of chapters array
   * (for preview mode where data is fetched on-demand from the database)
   */
  isPreviewMode?: boolean;
  /**
   * Optional: source language and detected level for generating better labels
   */
  storyData?: {
    sourceLanguage?: string;
    detectedLevel?: string;
  };
}

/**
 * Shared dropdown component for viewing/previewing completed streams
 * Used in both FloatingProgressWidget (during upload) and StoryReviewModal (for preview)
 */
export function StreamSelector({
  streams,
  lng,
  setShowProgressViewer,
  isPreviewMode = false,
  storyData,
}: StreamSelectorProps) {
  const { setSelectedStreamId } = useStoryUpload();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Determine which streams are viewable
  // In preview mode, include all complete streams (data fetched on-demand)
  // In live mode, only include streams that have chapters data loaded
  const visibleStreams = isPreviewMode
    ? streams.filter((s) => s.status === "complete")
    : streams.filter(
        (s) => s.status !== "waiting" || (Array.isArray(s.chapters) && s.chapters.length > 0)
      );

  const streamsWithData = isPreviewMode
    ? streams.filter((s) => s.status === "complete")
    : streams.filter(
        (s) => Array.isArray(s.chapters) && s.chapters.length > 0
      );

  // Don't show if no viewable streams
  if (streamsWithData.length === 0) {
    return null;
  }

  const handleStreamClick = (stream: StreamProgress) => {
    // In preview mode, allow clicking on complete streams even without chapters loaded
    if (!isPreviewMode && stream.status === "waiting" && (!Array.isArray(stream.chapters) || stream.chapters.length === 0)) {
      return; // Can't view streams that haven't started in live mode
    }
    setSelectedStreamId(stream.id);
    setShowProgressViewer(true);
    setIsOpen(false);
  };

  const getStatusIcon = (status: StreamProgress["status"]) => {
    switch (status) {
      case "in-progress":
        return (
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        );
      case "complete":
        return (
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      default:
        return (
          <div className="w-2 h-2 rounded-full bg-gray-300" />
        );
    }
  };

  const getStreamTypeIcon = (type: StreamProgress["type"]) => {
    if (type === "rewriting") {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
    );
  };

  const getStreamLabel = (stream: StreamProgress) => {
    const level = toCEFR(stream.level);
    if (stream.type === "rewriting") {
      const fromLevel = stream.fromLevel ? toCEFR(stream.fromLevel) : "?";
      return lng === "es"
        ? `Reescritura ${fromLevel} → ${level}`
        : `Rewrite ${fromLevel} → ${level}`;
    } else {
      const isOriginal = storyData?.detectedLevel && stream.level === storyData.detectedLevel;
      if (isOriginal !== undefined) {
        return lng === "es"
          ? `Traducción ${level} (${isOriginal ? "Original" : "Reescrito"})`
          : `Translation ${level} (${isOriginal ? "Original" : "Rewritten"})`;
      }
      return stream.label || `Translation ${level}`;
    }
  };

  // Always show dropdown (even for single stream)
  return (
    <div ref={dropdownRef}>
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full py-2 px-4 bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors flex items-center gap-2 ${isOpen ? "rounded-t-lg border-b-0" : "rounded-lg"}`}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span className="flex-1 text-left">
            {isPreviewMode
              ? (lng === "es" ? "Vista previa de historia completada" : "Preview completed story")
              : (lng === "es" ? "Ver progreso" : "View Progress")}
          </span>
          <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full flex-shrink-0">
            {streamsWithData.length}
          </span>
          <svg
            className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown menu - expands inline to grow the container */}
        {isOpen && (
          <div className="border border-t-0 border-gray-200 rounded-b-lg bg-white overflow-hidden">
            {visibleStreams.map((stream) => {
              const hasData = isPreviewMode
                ? stream.status === "complete"
                : Array.isArray(stream.chapters) && stream.chapters.length > 0;
              const isDisabled = !isPreviewMode && stream.status === "waiting" && !hasData;

              return (
                <button
                  key={stream.id}
                  onClick={() => handleStreamClick(stream)}
                  disabled={isDisabled}
                  className={`w-full px-3 py-2 flex items-center gap-3 text-left transition-colors ${
                    isDisabled
                      ? "bg-gray-50 text-gray-400 cursor-not-allowed"
                      : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <span className={`flex-shrink-0 ${stream.type === "rewriting" ? "text-amber-500" : "text-blue-500"}`}>
                    {getStreamTypeIcon(stream.type)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">
                      {getStreamLabel(stream)}
                    </span>
                    {!isPreviewMode && hasData ? (
                      <span className="block text-xs text-gray-400">
                        {stream.chapters.length} / {stream.totalChapters} chapters completed
                      </span>
                    ) : stream.status === "waiting" ? (
                      <span className="block text-xs text-gray-400">
                        Waiting to start...
                      </span>
                    ) : null}
                  </span>
                  <span className="flex-shrink-0">
                    {getStatusIcon(stream.status)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
