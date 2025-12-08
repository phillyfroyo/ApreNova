"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

export interface ComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  level: number | null;
  leftTitle: string;
  leftText: string;
  rightTitle: string;
  rightText: string;
  onSave?: (editedText: string, side: 'left' | 'right') => void;
  editableSide?: 'left' | 'right' | 'none';
  headerGradient?: string;
}

export function ComparisonModal({
  isOpen,
  onClose,
  level,
  leftTitle,
  leftText,
  rightTitle,
  rightText,
  onSave,
  editableSide = 'right',
  headerGradient = "bg-gradient-to-r from-indigo-600 to-purple-600",
}: ComparisonModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [splitPosition, setSplitPosition] = useState(50);

  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize edited text when opening
  useEffect(() => {
    if (isOpen) {
      setEditedText(editableSide === 'left' ? leftText : rightText);
      setIsEditing(false);
    }
  }, [isOpen, leftText, rightText, editableSide]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Divider drag handlers
  const handleDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleDividerMouseMove);
    document.addEventListener("mouseup", handleDividerMouseUp);
  };

  const handleDividerMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const newPosition = ((e.clientX - rect.left) / rect.width) * 100;
    const clampedPosition = Math.min(80, Math.max(20, newPosition));
    containerRef.current.style.setProperty("--split-pos", `${clampedPosition}%`);
  }, []);

  const handleDividerMouseUp = useCallback(() => {
    isDragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    if (containerRef.current) {
      const finalPos = containerRef.current.style.getPropertyValue("--split-pos");
      if (finalPos) {
        setSplitPosition(parseFloat(finalPos));
      }
    }
    document.removeEventListener("mousemove", handleDividerMouseMove);
    document.removeEventListener("mouseup", handleDividerMouseUp);
  }, [handleDividerMouseMove]);

  const handleSave = () => {
    if (onSave && editableSide !== 'none') {
      onSave(editedText, editableSide);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedText(editableSide === 'left' ? leftText : rightText);
    setIsEditing(false);
  };

  // Render side-by-side lines with locked line numbers
  const renderSideBySideLines = (left: string, right: string) => {
    const leftLines = left.split("\n");
    const rightLines = right.split("\n");
    const maxLines = Math.max(leftLines.length, rightLines.length);

    return (
      <div className="font-mono text-sm leading-relaxed">
        {Array.from({ length: maxLines }, (_, idx) => (
          <div key={idx} className="flex border-b border-gray-100 hover:bg-gray-50">
            {/* Line number */}
            <div
              className="select-none text-gray-400 text-right pr-3 shrink-0 py-1 bg-gray-50 border-r border-gray-200"
              style={{ width: "3.5rem" }}
            >
              {idx + 1}
            </div>
            {/* Left text */}
            <div
              className="py-1 px-3 text-gray-700 whitespace-pre-wrap break-words border-r border-gray-200"
              style={{ width: `calc(var(--split-pos, ${splitPosition}%) - 1.75rem)` }}
            >
              {leftLines[idx] || "\u00A0"}
            </div>
            {/* Right text */}
            <div className="py-1 px-3 text-gray-700 whitespace-pre-wrap break-words flex-1">
              {rightLines[idx] || "\u00A0"}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!isOpen || level === null) return null;

  const leftLineCount = leftText.split("\n").length;
  const rightLineCount = rightText.split("\n").length;
  const displayText = isEditing ? editedText : (editableSide === 'left' ? leftText : rightText);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-[95vw] h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`${headerGradient} text-white px-6 py-4 flex items-center justify-between shrink-0`}>
          <div className="flex items-center gap-4">
            <span className="text-lg font-semibold">
              Level {level} Comparison
            </span>
            <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
              {leftLineCount} → {rightLineCount} lines
            </span>
          </div>
          <div className="flex items-center gap-3">
            {editableSide !== 'none' && (
              isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg text-sm font-medium transition-colors"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm transition-colors"
                >
                  Edit Text
                </button>
              )
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              title="Close (Esc)"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          ref={containerRef}
          className="flex-1 flex flex-col overflow-hidden"
          style={{ "--split-pos": `${splitPosition}%` } as React.CSSProperties}
        >
          {/* Column Headers */}
          <div className="flex shrink-0 border-b border-gray-300">
            {/* Line number header */}
            <div className="bg-gray-100 text-gray-500 text-xs font-medium py-2 text-center border-r border-gray-200" style={{ width: "3.5rem" }}>
              #
            </div>
            {/* Left header */}
            <div
              className="bg-gray-100 px-3 py-2 text-sm font-medium text-gray-600 border-r border-gray-200 flex items-center justify-between"
              style={{ width: `calc(var(--split-pos, ${splitPosition}%) - 1.75rem)` }}
            >
              <span>{leftTitle}</span>
              <span className="text-gray-400 text-xs">{leftLineCount} lines</span>
            </div>
            {/* Draggable divider */}
            <div
              onMouseDown={handleDividerMouseDown}
              className="w-2 bg-gray-200 hover:bg-blue-400 cursor-col-resize flex items-center justify-center shrink-0 transition-colors"
            />
            {/* Right header */}
            <div className="bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 flex-1 flex items-center justify-between">
              <span>{rightTitle}</span>
              <span className="text-indigo-400 text-xs">{rightLineCount} lines</span>
            </div>
          </div>

          {/* Scrollable content */}
          {isEditing ? (
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 overflow-auto p-4">
                <textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="w-full h-full text-sm whitespace-pre-wrap font-mono text-gray-700 leading-relaxed border border-gray-300 rounded p-3 focus:ring-2 focus:ring-blue-500 resize-none"
                  spellCheck={false}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              {renderSideBySideLines(leftText, rightText)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-3 text-sm text-gray-500 border-t flex items-center justify-center gap-4 shrink-0">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Line-locked comparison
          </span>
          <span className="text-gray-300">|</span>
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Drag header divider to resize
          </span>
          <span className="text-gray-300">|</span>
          <span className="flex items-center gap-2">
            Press <kbd className="px-2 py-0.5 bg-gray-200 rounded text-xs">Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
}

export default ComparisonModal;
