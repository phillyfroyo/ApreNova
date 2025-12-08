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

interface EditingCell {
  lineIndex: number;
  side: 'left' | 'right';
  value: string;
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
  // Lines state for editing
  const [leftLines, setLeftLines] = useState<string[]>([]);
  const [rightLines, setRightLines] = useState<string[]>([]);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [splitPosition, setSplitPosition] = useState(50);

  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize lines when opening
  useEffect(() => {
    if (isOpen) {
      setLeftLines(leftText.split("\n"));
      setRightLines(rightText.split("\n"));
      setEditingCell(null);
      setHasUnsavedChanges(false);
    }
  }, [isOpen, leftText, rightText]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editingCell) {
          setEditingCell(null);
        } else if (isOpen) {
          onClose();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, editingCell]);

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

  // Cell editing handlers
  const handleCellClick = (lineIndex: number, side: 'left' | 'right') => {
    if (editableSide === 'none') return;
    if (editableSide !== side && editableSide !== 'left' && editableSide !== 'right') return;

    // Only allow editing the editable side
    if (side !== editableSide) return;

    const lines = side === 'left' ? leftLines : rightLines;
    const currentValue = lines[lineIndex] || '';

    setEditingCell({
      lineIndex,
      side,
      value: currentValue,
    });
  };

  const handleCellSave = () => {
    if (!editingCell) return;

    const { lineIndex, side, value } = editingCell;

    if (side === 'left') {
      const newLines = [...leftLines];
      newLines[lineIndex] = value;
      setLeftLines(newLines);
    } else {
      const newLines = [...rightLines];
      newLines[lineIndex] = value;
      setRightLines(newLines);
    }

    setHasUnsavedChanges(true);
    setEditingCell(null);
  };

  const handleCellCancel = () => {
    setEditingCell(null);
  };

  const handleDeleteRow = (lineIndex: number, side: 'both' | 'left' | 'right') => {
    // Store scroll position
    const scrollTop = scrollContainerRef.current?.scrollTop || 0;

    if (side === 'both' || side === 'left') {
      setLeftLines(prev => prev.filter((_, i) => i !== lineIndex));
    }
    if (side === 'both' || side === 'right') {
      setRightLines(prev => prev.filter((_, i) => i !== lineIndex));
    }
    setHasUnsavedChanges(true);
    setEditingCell(null);

    // Restore scroll position after state update
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollTop;
      }
    });
  };

  const handleAddRowAbove = (lineIndex: number) => {
    // Store scroll position
    const scrollTop = scrollContainerRef.current?.scrollTop || 0;

    // Add empty row to both sides
    setLeftLines(prev => [...prev.slice(0, lineIndex), '', ...prev.slice(lineIndex)]);
    setRightLines(prev => [...prev.slice(0, lineIndex), '', ...prev.slice(lineIndex)]);
    setHasUnsavedChanges(true);

    // Restore scroll position after state update
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollTop;
      }
    });
  };

  const handleAddRowBelow = (lineIndex: number) => {
    // Store scroll position
    const scrollTop = scrollContainerRef.current?.scrollTop || 0;

    // Add empty row to both sides
    setLeftLines(prev => [...prev.slice(0, lineIndex + 1), '', ...prev.slice(lineIndex + 1)]);
    setRightLines(prev => [...prev.slice(0, lineIndex + 1), '', ...prev.slice(lineIndex + 1)]);
    setHasUnsavedChanges(true);

    // Restore scroll position after state update
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollTop;
      }
    });
  };

  const handleSaveAll = () => {
    if (onSave && editableSide !== 'none') {
      const textToSave = editableSide === 'left' ? leftLines.join('\n') : rightLines.join('\n');
      onSave(textToSave, editableSide);
    }
    setHasUnsavedChanges(false);
  };

  const handleRevert = () => {
    setLeftLines(leftText.split("\n"));
    setRightLines(rightText.split("\n"));
    setEditingCell(null);
    setHasUnsavedChanges(false);
  };

  // Render a single row
  const renderRow = (idx: number) => {
    const leftLine = leftLines[idx] ?? '';
    const rightLine = rightLines[idx] ?? '';
    const isEditingLeft = editingCell?.lineIndex === idx && editingCell?.side === 'left';
    const isEditingRight = editingCell?.lineIndex === idx && editingCell?.side === 'right';
    const isEditing = isEditingLeft || isEditingRight;
    const canEditLeft = editableSide === 'left';
    const canEditRight = editableSide === 'right';

    return (
      <div
        key={idx}
        className={`flex border-b border-gray-100 group ${isEditing ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
      >
        {/* Line number + row actions */}
        <div
          className="select-none text-gray-400 text-right pr-2 shrink-0 py-1 bg-gray-50 border-r border-gray-200 relative"
          style={{ width: "5.5rem" }}
        >
          <span className="group-hover:hidden">{idx + 1}</span>

          {/* Row actions - show on hover */}
          <div className="hidden group-hover:flex items-center justify-end gap-0.5 absolute inset-0 bg-gray-50 pr-1">
            <button
              onClick={() => handleAddRowAbove(idx)}
              className="p-0.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
              title="Add row above (both sides)"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button
              onClick={() => handleAddRowBelow(idx)}
              className="p-0.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
              title="Add row below (both sides)"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {/* Delete buttons: L = left only, R = right only, X = both */}
            <button
              onClick={() => handleDeleteRow(idx, 'left')}
              className="px-0.5 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 rounded font-medium"
              title="Delete left cell only"
            >
              L
            </button>
            <button
              onClick={() => handleDeleteRow(idx, 'right')}
              className="px-0.5 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 rounded font-medium"
              title="Delete right cell only"
            >
              R
            </button>
            <button
              onClick={() => handleDeleteRow(idx, 'both')}
              className="p-0.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
              title="Delete entire row (both sides)"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Left cell */}
        <div
          className={`py-1 px-3 border-r border-gray-200 ${
            canEditLeft ? 'cursor-pointer hover:bg-blue-50' : ''
          } ${isEditingLeft ? 'p-0' : ''}`}
          style={{ width: `calc(var(--split-pos, ${splitPosition}%) - 2.75rem)` }}
          onClick={() => !isEditingLeft && handleCellClick(idx, 'left')}
        >
          {isEditingLeft ? (
            <div className="flex flex-col h-full">
              <textarea
                ref={editInputRef}
                value={editingCell.value}
                onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleCellSave();
                  }
                  if (e.key === 'Escape') {
                    handleCellCancel();
                  }
                }}
                className="w-full min-h-[2rem] p-1 text-sm font-mono border-2 border-blue-400 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={Math.max(1, editingCell.value.split('\n').length)}
              />
              <div className="flex gap-1 p-1 bg-gray-100 border-t">
                <button
                  onClick={handleCellSave}
                  className="px-2 py-0.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Save
                </button>
                <button
                  onClick={handleCellCancel}
                  className="px-2 py-0.5 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <span className="text-sm font-mono text-gray-700 whitespace-pre-wrap break-words">
              {leftLine || '\u00A0'}
            </span>
          )}
        </div>

        {/* Right cell */}
        <div
          className={`py-1 px-3 flex-1 ${
            canEditRight ? 'cursor-pointer hover:bg-blue-50' : ''
          } ${isEditingRight ? 'p-0' : ''}`}
          onClick={() => !isEditingRight && handleCellClick(idx, 'right')}
        >
          {isEditingRight ? (
            <div className="flex flex-col h-full">
              <textarea
                ref={editInputRef}
                value={editingCell.value}
                onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleCellSave();
                  }
                  if (e.key === 'Escape') {
                    handleCellCancel();
                  }
                }}
                className="w-full min-h-[2rem] p-1 text-sm font-mono border-2 border-blue-400 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={Math.max(1, editingCell.value.split('\n').length)}
              />
              <div className="flex gap-1 p-1 bg-gray-100 border-t">
                <button
                  onClick={handleCellSave}
                  className="px-2 py-0.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Save
                </button>
                <button
                  onClick={handleCellCancel}
                  className="px-2 py-0.5 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <span className="text-sm font-mono text-gray-700 whitespace-pre-wrap break-words">
              {rightLine || '\u00A0'}
            </span>
          )}
        </div>
      </div>
    );
  };

  if (!isOpen || level === null) return null;

  const maxLines = Math.max(leftLines.length, rightLines.length);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => {
          if (editingCell) {
            setEditingCell(null);
          } else {
            onClose();
          }
        }}
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
              {leftLines.length} → {rightLines.length} lines
            </span>
            {hasUnsavedChanges && (
              <span className="text-sm bg-yellow-500/80 px-3 py-1 rounded-full animate-pulse">
                Unsaved changes
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {editableSide !== 'none' && hasUnsavedChanges && (
              <>
                <button
                  onClick={handleSaveAll}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg text-sm font-medium transition-colors"
                >
                  Save All Changes
                </button>
                <button
                  onClick={handleRevert}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm transition-colors"
                >
                  Revert
                </button>
              </>
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
            <div className="bg-gray-100 text-gray-500 text-xs font-medium py-2 text-center border-r border-gray-200" style={{ width: "5.5rem" }}>
              #
            </div>
            {/* Left header */}
            <div
              className="bg-gray-100 px-3 py-2 text-sm font-medium text-gray-600 border-r border-gray-200 flex items-center justify-between"
              style={{ width: `calc(var(--split-pos, ${splitPosition}%) - 2.75rem)` }}
            >
              <span>{leftTitle}</span>
              <span className="text-gray-400 text-xs">{leftLines.length} lines</span>
            </div>
            {/* Draggable divider */}
            <div
              onMouseDown={handleDividerMouseDown}
              className="w-2 bg-gray-200 hover:bg-blue-400 cursor-col-resize flex items-center justify-center shrink-0 transition-colors"
            />
            {/* Right header */}
            <div className="bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 flex-1 flex items-center justify-between">
              <span>{rightTitle}</span>
              <span className="text-indigo-400 text-xs">{rightLines.length} lines</span>
            </div>
          </div>

          {/* Scrollable content */}
          <div ref={scrollContainerRef} className="flex-1 overflow-auto">
            <div className="font-mono text-sm leading-relaxed">
              {Array.from({ length: maxLines }, (_, idx) => renderRow(idx))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-3 text-sm text-gray-500 border-t flex items-center justify-center gap-4 shrink-0 flex-wrap">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Click cell to edit
          </span>
          <span className="text-gray-300">|</span>
          <span className="flex items-center gap-2">
            Hover # for:
            <span className="text-green-600">↑↓</span> add row
            <span className="text-red-600">L/R/✕</span> delete left/right/both
          </span>
          <span className="text-gray-300">|</span>
          <span className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">Enter</kbd> save
            <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">Esc</kbd> cancel
          </span>
        </div>
      </div>
    </div>
  );
}

export default ComparisonModal;
