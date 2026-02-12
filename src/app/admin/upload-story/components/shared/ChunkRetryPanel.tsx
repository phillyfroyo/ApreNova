"use client";

import { useState } from "react";
import type { ChunkError, TranslationErrorType } from "../../types";
import type { ErrorGroup } from "../../hooks/useErrorRecovery";

// ============================================================================
// Types
// ============================================================================

export interface ChunkRetryPanelProps {
  /** Level number */
  level: number;
  /** Error groups for this level */
  errorGroups: ErrorGroup[];
  /** Total error count */
  totalErrors: number;
  /** Callback to retry a single error */
  onRetry: (error: ChunkError) => Promise<void>;
  /** Callback to retry all errors of a type */
  onRetryAll: (errorType: TranslationErrorType) => Promise<void>;
  /** Callback to use manual text for an error */
  onUseManualText: (error: ChunkError, text: string) => void;
  /** Callback to keep original (source) text */
  onKeepOriginal: (error: ChunkError) => void;
  /** Callback to dismiss/skip an error */
  onDismiss: (error: ChunkError) => void;
  /** Check if an error is currently being retried */
  isRetrying: (errorKey: string) => boolean;
  /** Get error key from error object */
  getErrorKey: (error: ChunkError) => string;
  /** Optional: Currently selected error for editing */
  selectedError?: ChunkError | null;
  /** Optional: Callback when error is selected for editing */
  onSelectError?: (error: ChunkError | null) => void;
  /** Optional: Manual override text */
  manualOverride?: string;
  /** Optional: Callback to update manual override */
  onManualOverrideChange?: (text: string) => void;
  /** Optional: Whether the panel is collapsed */
  collapsed?: boolean;
  /** Optional: Callback when collapse state changes */
  onCollapseChange?: (collapsed: boolean) => void;
}

// ============================================================================
// Sub-components
// ============================================================================

interface ErrorTypeIconProps {
  errorType: TranslationErrorType;
}

function ErrorTypeIcon({ errorType }: ErrorTypeIconProps) {
  const icons: Record<TranslationErrorType, string> = {
    rate_limit: "clock",
    content_refusal: "shield-x",
    network: "wifi-off",
    timeout: "hourglass",
    malformed: "file-warning",
    unknown: "alert-circle",
  };

  const colors: Record<TranslationErrorType, string> = {
    rate_limit: "text-yellow-600",
    content_refusal: "text-red-600",
    network: "text-orange-600",
    timeout: "text-yellow-600",
    malformed: "text-purple-600",
    unknown: "text-gray-600",
  };

  return (
    <span className={`text-sm ${colors[errorType]}`} title={icons[errorType]}>
      {errorType === "rate_limit" && "429"}
      {errorType === "content_refusal" && "X"}
      {errorType === "network" && "NET"}
      {errorType === "timeout" && "T/O"}
      {errorType === "malformed" && "ERR"}
      {errorType === "unknown" && "?"}
    </span>
  );
}

interface ErrorItemProps {
  error: ChunkError;
  errorKey: string;
  isRetrying: boolean;
  isSelected: boolean;
  onRetry: () => void;
  onSelect: () => void;
  onKeepOriginal: () => void;
  onDismiss: () => void;
}

function ErrorItem({
  error,
  errorKey,
  isRetrying,
  isSelected,
  onRetry,
  onSelect,
  onKeepOriginal,
  onDismiss,
}: ErrorItemProps) {
  const chapterLabel = error.subChunkIndex !== undefined
    ? `Ch ${error.chapterIndex + 1}, Part ${error.subChunkIndex + 1}`
    : `Chapter ${error.chapterIndex + 1}`;

  const previewText = error.originalText.slice(0, 100).replace(/\n/g, " ");

  return (
    <div
      className={`border rounded-lg p-3 transition-colors ${
        isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-gray-900">{chapterLabel}</span>
            <span className="text-xs text-gray-500">
              (retry #{error.retryCount})
            </span>
          </div>
          <p className="text-xs text-gray-600 truncate" title={previewText}>
            {previewText}...
          </p>
          <p className="text-xs text-red-600 mt-1">{error.errorMessage}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-default"
            title="Retry this chunk"
          >
            {isRetrying ? "..." : "Retry"}
          </button>
          <button
            onClick={onSelect}
            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            title="Edit manually"
          >
            Edit
          </button>
          <button
            onClick={onKeepOriginal}
            className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
            title="Keep source text (skip translation)"
          >
            Keep
          </button>
          <button
            onClick={onDismiss}
            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
            title="Dismiss error"
          >
            X
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ChunkRetryPanel({
  level,
  errorGroups,
  totalErrors,
  onRetry,
  onRetryAll,
  onUseManualText,
  onKeepOriginal,
  onDismiss,
  isRetrying,
  getErrorKey,
  selectedError,
  onSelectError,
  manualOverride,
  onManualOverrideChange,
  collapsed: controlledCollapsed,
  onCollapseChange,
}: ChunkRetryPanelProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed ?? internalCollapsed;

  const toggleCollapsed = () => {
    const newValue = !collapsed;
    setInternalCollapsed(newValue);
    onCollapseChange?.(newValue);
  };

  if (totalErrors === 0) {
    return null;
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={toggleCollapsed}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-red-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-red-600 font-medium">
            Level {level} Errors
          </span>
          <span className="px-2 py-0.5 bg-red-200 text-red-800 text-xs rounded-full">
            {totalErrors} {totalErrors === 1 ? "chunk" : "chunks"} failed
          </span>
        </div>
        <span className="text-red-400">
          {collapsed ? "+" : "-"}
        </span>
      </button>

      {/* Content */}
      {!collapsed && (
        <div className="px-4 pb-4 space-y-4">
          {/* Error Groups */}
          {errorGroups.map((group) => (
            <div key={group.errorType} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ErrorTypeIcon errorType={group.errorType} />
                  <span className="text-sm font-medium text-gray-900">
                    {group.label}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({group.errors.length})
                  </span>
                </div>
                {group.canBatchRetry && group.errors.length > 1 && (
                  <button
                    onClick={() => onRetryAll(group.errorType)}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Retry All {group.errors.length}
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-600 mb-2">{group.description}</p>

              {/* Error Items */}
              <div className="space-y-2">
                {group.errors.map((error) => {
                  const errorKey = getErrorKey(error);
                  return (
                    <ErrorItem
                      key={errorKey}
                      error={error}
                      errorKey={errorKey}
                      isRetrying={isRetrying(errorKey)}
                      isSelected={selectedError ? getErrorKey(selectedError) === errorKey : false}
                      onRetry={() => onRetry(error)}
                      onSelect={() => onSelectError?.(error)}
                      onKeepOriginal={() => onKeepOriginal(error)}
                      onDismiss={() => onDismiss(error)}
                    />
                  );
                })}
              </div>
            </div>
          ))}

          {/* Manual Edit Panel */}
          {selectedError && onSelectError && (
            <div className="border-t border-red-200 pt-4 mt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-900">
                  Manual Edit - {selectedError.subChunkIndex !== undefined
                    ? `Ch ${selectedError.chapterIndex + 1}, Part ${selectedError.subChunkIndex + 1}`
                    : `Chapter ${selectedError.chapterIndex + 1}`}
                </h4>
                <button
                  onClick={() => onSelectError(null)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Close
                </button>
              </div>
              <p className="text-xs text-gray-600 mb-2">
                Edit the text below and click &quot;Use This Text&quot; to manually provide the translation.
              </p>
              <textarea
                value={manualOverride ?? selectedError.originalText}
                onChange={(e) => onManualOverrideChange?.(e.target.value)}
                className="w-full h-48 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none font-mono"
                placeholder="Enter translated text..."
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => {
                    onUseManualText(selectedError, manualOverride ?? selectedError.originalText);
                    onSelectError(null);
                  }}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Use This Text
                </button>
              </div>
            </div>
          )}

          {/* Batch Actions */}
          <div className="border-t border-red-200 pt-4 flex items-center justify-between">
            <p className="text-xs text-gray-600">
              Tip: &quot;Keep&quot; uses source text. &quot;Edit&quot; allows manual translation.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  errorGroups.forEach(group => {
                    group.errors.forEach(error => onKeepOriginal(error));
                  });
                }}
                className="px-3 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200"
              >
                Keep All Original
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChunkRetryPanel;
