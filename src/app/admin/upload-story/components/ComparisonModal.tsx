"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";

export interface ComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  level: number | null;
  leftTitle: string;
  leftText: string;
  rightTitle: string;
  rightText: string;
  onSave?: (edits: { left?: string; right?: string }) => void;
  editableSide?: 'left' | 'right' | 'both' | 'none';
  headerGradient?: string;
  /** Optional: allow retranslating a single chapter with configurable sub-chunks */
  onRetranslateChapter?: (chapterIndex: number, chapterText: string, numChunks: number) => Promise<void>;
  /** Whether a chapter retranslation is in progress */
  isRetranslating?: boolean;
}

// Parse chapter markers from text: "--- Chapter N ---" or "--- Chapter N: Title ---"
// Also handles Spanish "--- Capítulo N ---"
interface ParsedChapter {
  number: number;
  title: string;
  content: string;
  startLine: number;
}

function parseChaptersFromText(text: string): ParsedChapter[] {
  const lines = text.split('\n');
  const chapters: ParsedChapter[] = [];
  const chapterPattern = /^---\s*(?:Chapter|Capítulo)\s+(\d+)(?::\s*(.+?))?\s*---$/i;

  let currentChapter: ParsedChapter | null = null;
  let contentLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(chapterPattern);

    if (match) {
      // Save previous chapter if exists
      if (currentChapter) {
        currentChapter.content = contentLines.join('\n');
        chapters.push(currentChapter);
      }

      // Start new chapter
      currentChapter = {
        number: parseInt(match[1], 10),
        title: match[2]?.trim() || '',
        content: '',
        startLine: i,
      };
      contentLines = [];
    } else if (currentChapter) {
      contentLines.push(line);
    } else {
      // Content before first chapter marker - create "Chapter 0" for it
      if (chapters.length === 0 && !currentChapter && line.trim()) {
        currentChapter = {
          number: 0,
          title: 'Preamble',
          content: '',
          startLine: 0,
        };
      }
      if (currentChapter) {
        contentLines.push(line);
      }
    }
  }

  // Don't forget the last chapter
  if (currentChapter) {
    currentChapter.content = contentLines.join('\n');
    chapters.push(currentChapter);
  }

  // If no chapters found, return all text as one chapter
  if (chapters.length === 0) {
    return [{
      number: 1,
      title: '',
      content: text,
      startLine: 0,
    }];
  }

  return chapters;
}

interface EditingCell {
  lineIndex: number;
  side: 'left' | 'right';
  initialValue: string;
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
  onRetranslateChapter,
  isRetranslating = false,
}: ComparisonModalProps) {
  // Chapter parsing
  const leftChapters = useMemo(() => parseChaptersFromText(leftText), [leftText]);
  const rightChapters = useMemo(() => parseChaptersFromText(rightText), [rightText]);
  const hasMultipleChapters = leftChapters.length > 1 || rightChapters.length > 1;
  const maxChapters = Math.max(leftChapters.length, rightChapters.length);

  // Detect duplicate chapter numbers (corrupted data)
  const duplicateWarning = useMemo(() => {
    const check = (chapters: ParsedChapter[], label: string) => {
      const seen = new Map<number, number>();
      const dupes: number[] = [];
      for (const ch of chapters) {
        const count = (seen.get(ch.number) || 0) + 1;
        seen.set(ch.number, count);
        if (count === 2) dupes.push(ch.number);
      }
      return dupes.length > 0 ? `${label}: duplicate chapter${dupes.length > 1 ? 's' : ''} ${dupes.join(', ')}` : null;
    };
    const warnings = [check(leftChapters, 'Source'), check(rightChapters, 'Translation')].filter(Boolean);
    return warnings.length > 0 ? warnings.join(' | ') : null;
  }, [leftChapters, rightChapters]);

  // Chapter selection state
  const [selectedChapter, setSelectedChapter] = useState(0);
  const [viewMode, setViewMode] = useState<'chapter' | 'all'>('chapter');

  // Retranslate state
  const [showRetranslatePopover, setShowRetranslatePopover] = useState(false);
  const [retranslateChunks, setRetranslateChunks] = useState(2);

  // Lines state for editing
  const [leftLines, setLeftLines] = useState<string[]>([]);
  const [rightLines, setRightLines] = useState<string[]>([]);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [splitPosition, setSplitPosition] = useState(50);

  // Track per-chapter edits so switching chapters doesn't lose changes
  const editedChaptersRef = useRef<Record<number, { left: string[]; right: string[] }>>({});

  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  // Save current chapter lines to editedChaptersRef before switching
  // Also commits any in-progress cell edit so it isn't lost
  const saveCurrentChapterToRef = useCallback(() => {
    if (viewMode === 'chapter' && hasMultipleChapters) {
      let savedLeft = [...leftLines];
      let savedRight = [...rightLines];

      // Commit any pending cell edit from the textarea ref
      if (editingCell && editInputRef.current) {
        const { lineIndex, side } = editingCell;
        const value = editInputRef.current.value;
        if (side === 'left') {
          savedLeft[lineIndex] = value;
        } else {
          savedRight[lineIndex] = value;
        }
      }

      editedChaptersRef.current[selectedChapter] = {
        left: savedLeft,
        right: savedRight,
      };
    }
  }, [viewMode, hasMultipleChapters, selectedChapter, leftLines, rightLines, editingCell]);

  // Initialize lines when opening or chapter changes
  useEffect(() => {
    if (isOpen) {
      if (viewMode === 'all' || !hasMultipleChapters) {
        // In 'all' mode, reconstruct full text with any per-chapter edits applied
        if (Object.keys(editedChaptersRef.current).length > 0 && hasMultipleChapters) {
          const rebuildFullLines = (chapters: ParsedChapter[], originalText: string, side: 'left' | 'right') => {
            const fullLines = originalText.split('\n');
            // Apply edits in reverse order to preserve line indices
            const sortedIndices = Object.keys(editedChaptersRef.current)
              .map(Number)
              .sort((a, b) => b - a);
            for (const idx of sortedIndices) {
              const edited = editedChaptersRef.current[idx]?.[side];
              const chapter = chapters[idx];
              if (edited && chapter) {
                const nextChapter = chapters[idx + 1];
                const start = chapter.startLine + 1;
                const end = nextChapter ? nextChapter.startLine : fullLines.length;
                fullLines.splice(start, end - start, ...edited);
              }
            }
            return fullLines;
          };
          setLeftLines(rebuildFullLines(leftChapters, leftText, 'left'));
          setRightLines(rebuildFullLines(rightChapters, rightText, 'right'));
        } else {
          setLeftLines(leftText.split("\n"));
          setRightLines(rightText.split("\n"));
        }
      } else {
        // In chapter view, check for saved edits first
        const savedEdits = editedChaptersRef.current[selectedChapter];
        if (savedEdits) {
          setLeftLines(savedEdits.left);
          setRightLines(savedEdits.right);
        } else {
          const leftChapter = leftChapters[selectedChapter];
          const rightChapter = rightChapters[selectedChapter];
          setLeftLines(leftChapter?.content.split("\n") || []);
          setRightLines(rightChapter?.content.split("\n") || []);
        }
      }
      setEditingCell(null);
    }
  }, [isOpen, leftText, rightText, selectedChapter, viewMode, hasMultipleChapters, leftChapters, rightChapters]);

  // Reset chapter selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedChapter(0);
      setViewMode('chapter');
      setHasUnsavedChanges(false);
      editedChaptersRef.current = {};
    }
  }, [isOpen]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editingCell) {
          setEditingCell(null);
        } else if (isOpen) {
          onClose();
        }
      }
      // Arrow key navigation for chapters (only when not editing)
      if (!editingCell && hasMultipleChapters && viewMode === 'chapter') {
        if (e.key === "ArrowLeft" && selectedChapter > 0) {
          e.preventDefault();
          saveCurrentChapterToRef();
          setSelectedChapter(prev => prev - 1);
        }
        if (e.key === "ArrowRight" && selectedChapter < maxChapters - 1) {
          e.preventDefault();
          saveCurrentChapterToRef();
          setSelectedChapter(prev => prev + 1);
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, editingCell, hasMultipleChapters, viewMode, selectedChapter, maxChapters, saveCurrentChapterToRef]);

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
  const canEditSide = (side: 'left' | 'right') =>
    editableSide === 'both' || editableSide === side;

  const handleCellClick = (lineIndex: number, side: 'left' | 'right') => {
    if (!canEditSide(side)) return;

    const lines = side === 'left' ? leftLines : rightLines;
    const currentValue = lines[lineIndex] || '';

    setEditingCell({
      lineIndex,
      side,
      initialValue: currentValue,
    });
  };

  const handleCellSave = () => {
    if (!editingCell || !editInputRef.current) return;

    const { lineIndex, side } = editingCell;
    const value = editInputRef.current.value;

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

  const handleAddRow = (lineIndex: number, position: 'above' | 'below', side: 'both' | 'left' | 'right') => {
    const scrollTop = scrollContainerRef.current?.scrollTop || 0;
    const insertAt = position === 'above' ? lineIndex : lineIndex + 1;

    if (side === 'both' || side === 'left') {
      setLeftLines(prev => [...prev.slice(0, insertAt), '', ...prev.slice(insertAt)]);
    }
    if (side === 'both' || side === 'right') {
      setRightLines(prev => [...prev.slice(0, insertAt), '', ...prev.slice(insertAt)]);
    }
    setHasUnsavedChanges(true);

    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollTop;
      }
    });
  };

  const handleSaveAll = () => {
    if (onSave && editableSide !== 'none') {
      // First: commit any in-progress cell edit into the lines arrays
      let currentLeft = [...leftLines];
      let currentRight = [...rightLines];
      if (editingCell && editInputRef.current) {
        const { lineIndex, side: editSide } = editingCell;
        const value = editInputRef.current.value;
        if (editSide === 'left') {
          currentLeft[lineIndex] = value;
          setLeftLines(currentLeft);
        } else {
          currentRight[lineIndex] = value;
          setRightLines(currentRight);
        }
        setEditingCell(null);
      }

      // Save current chapter's edits to ref
      if (viewMode === 'chapter' && hasMultipleChapters) {
        editedChaptersRef.current[selectedChapter] = {
          left: [...currentLeft],
          right: [...currentRight],
        };
      }

      // Reconstruct full text for a given side
      const reconstructText = (side: 'left' | 'right') => {
        const linesNow = side === 'left' ? currentLeft : currentRight;
        if (viewMode === 'all' || !hasMultipleChapters) {
          return linesNow.join('\n');
        }
        // Chapter view: assemble dividers + chapter content
        const fullChapters = side === 'left' ? leftChapters : rightChapters;
        const originalFullText = side === 'left' ? leftText : rightText;
        const originalLines = originalFullText.split('\n');
        const outputParts: string[] = [];

        // Content before first chapter divider (if any)
        if (fullChapters.length > 0 && fullChapters[0].startLine > 0) {
          for (let i = 0; i < fullChapters[0].startLine; i++) {
            outputParts.push(originalLines[i]);
          }
        }

        for (let chIdx = 0; chIdx < fullChapters.length; chIdx++) {
          const chapter = fullChapters[chIdx];
          outputParts.push(originalLines[chapter.startLine]); // divider line
          const edited = editedChaptersRef.current[chIdx]?.[side];
          if (edited) {
            outputParts.push(...edited);
          } else {
            outputParts.push(...chapter.content.split('\n'));
          }
        }
        return outputParts.join('\n');
      };

      // Safety: check for duplicate chapter markers in reconstructed text
      const hasDuplicateChapters = (text: string) => {
        const nums: number[] = [];
        for (const m of text.matchAll(/^---\s*(?:Chapter|Capítulo)\s+(\d+)/gim)) {
          nums.push(parseInt(m[1], 10));
        }
        const seen = new Set<number>();
        for (const n of nums) {
          if (seen.has(n)) return true;
          seen.add(n);
        }
        return false;
      };

      // Build edits object and save in a single call
      const edits: { left?: string; right?: string } = {};
      if (editableSide === 'both' || editableSide === 'left') {
        edits.left = reconstructText('left');
      }
      if (editableSide === 'both' || editableSide === 'right') {
        edits.right = reconstructText('right');
      }

      // Abort save if reconstruction produced corrupted data
      if ((edits.left && hasDuplicateChapters(edits.left)) ||
          (edits.right && hasDuplicateChapters(edits.right))) {
        console.error('[ComparisonModal] Reconstruction produced duplicate chapters — aborting save');
        alert('Save aborted: chapter reconstruction produced duplicate chapters. Please try saving in "View All" mode instead.');
        return;
      }

      onSave(edits);

      editedChaptersRef.current = {};
    }
    setHasUnsavedChanges(false);
  };

  const handleRevert = () => {
    setLeftLines(leftText.split("\n"));
    setRightLines(rightText.split("\n"));
    setEditingCell(null);
    editedChaptersRef.current = {};
    setHasUnsavedChanges(false);
  };

  // Render a single row
  const renderRow = (idx: number) => {
    const leftLine = leftLines[idx] ?? '';
    const rightLine = rightLines[idx] ?? '';
    const isEditingLeft = editingCell?.lineIndex === idx && editingCell?.side === 'left';
    const isEditingRight = editingCell?.lineIndex === idx && editingCell?.side === 'right';
    const isEditing = isEditingLeft || isEditingRight;
    const canEditLeft = canEditSide('left');
    const canEditRight = canEditSide('right');

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

          {/* Row actions - hover: L R (add left/right), l r (delete left/right), ^ (add both), x (delete both) */}
          <div className="hidden group-hover:flex items-center justify-end gap-0 absolute inset-0 bg-gray-50 pr-0.5">
            <button
              onClick={() => handleAddRow(idx, 'below', 'left')}
              className="px-0.5 text-[10px] text-gray-400 hover:text-green-600 hover:bg-green-50 rounded font-bold leading-none"
              title="Add row to left side only"
            >L</button>
            <button
              onClick={() => handleAddRow(idx, 'below', 'right')}
              className="px-0.5 text-[10px] text-gray-400 hover:text-green-600 hover:bg-green-50 rounded font-bold leading-none"
              title="Add row to right side only"
            >R</button>
            <button
              onClick={() => handleDeleteRow(idx, 'left')}
              className="px-0.5 text-[10px] text-gray-400 hover:text-red-600 hover:bg-red-50 rounded font-bold leading-none"
              title="Delete left cell only"
            >l</button>
            <button
              onClick={() => handleDeleteRow(idx, 'right')}
              className="px-0.5 text-[10px] text-gray-400 hover:text-red-600 hover:bg-red-50 rounded font-bold leading-none"
              title="Delete right cell only"
            >r</button>
            <button
              onClick={() => handleAddRow(idx, 'above', 'both')}
              className="p-0.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
              title="Add row above (both sides)"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button
              onClick={() => handleDeleteRow(idx, 'both')}
              className="p-0.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
              title="Delete row (both sides)"
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
                defaultValue={editingCell.initialValue}
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
                rows={Math.max(1, editingCell.initialValue.split('\n').length)}
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
                defaultValue={editingCell.initialValue}
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
                rows={Math.max(1, editingCell.initialValue.split('\n').length)}
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

        {/* Duplicate chapter warning */}
        {duplicateWarning && (
          <div className="px-6 py-2 bg-red-50 border-b border-red-200 flex items-center gap-2 text-red-700 text-sm shrink-0">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-medium">Corrupted data detected:</span> {duplicateWarning}. Reset this level and retranslate.
          </div>
        )}

        {/* Chapter selector - only show if multiple chapters */}
        {hasMultipleChapters && (
          <div className="px-4 md:px-6 py-3 bg-gray-50 border-b flex items-center gap-3 overflow-x-auto shrink-0">
            <span className="text-sm text-gray-500 shrink-0">Chapters:</span>
            <div className="flex gap-2">
              {Array.from({ length: maxChapters }, (_, idx) => {
                const leftChapter = leftChapters[idx];
                const rightChapter = rightChapters[idx];
                const chapterNum = leftChapter?.number || rightChapter?.number || idx + 1;
                const chapterTitle = leftChapter?.title || rightChapter?.title || '';
                const isSelected = selectedChapter === idx && viewMode === 'chapter';

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      saveCurrentChapterToRef();
                      setSelectedChapter(idx);
                      setViewMode('chapter');
                    }}
                    className={`px-3 py-1 text-sm rounded-full transition-colors whitespace-nowrap ${
                      isSelected
                        ? "bg-indigo-500 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                    }`}
                    title={chapterTitle || `Chapter ${chapterNum}`}
                  >
                    {chapterNum === 0 ? 'Pre' : chapterNum}
                    {chapterTitle && <span className="ml-1 text-xs opacity-75 hidden sm:inline">({chapterTitle.slice(0, 15)}{chapterTitle.length > 15 ? '...' : ''})</span>}
                  </button>
                );
              })}
            </div>
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <button
                onClick={() => setViewMode(viewMode === 'all' ? 'chapter' : 'all')}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  viewMode === 'all'
                    ? "bg-gray-700 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                {viewMode === 'all' ? 'Viewing All' : 'View All'}
              </button>
            </div>
          </div>
        )}

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
        <div className="bg-gray-50 px-6 py-3 text-sm text-gray-500 border-t flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            {hasMultipleChapters && viewMode === 'chapter' && (
              <>
                <span className="font-medium text-gray-700">
                  Chapter {leftChapters[selectedChapter]?.number || selectedChapter + 1}
                  {leftChapters[selectedChapter]?.title && `: ${leftChapters[selectedChapter].title}`}
                </span>
                <span className="text-gray-300">|</span>
              </>
            )}
            <span>{leftLines.length} left → {rightLines.length} right lines</span>
            {leftLines.length !== rightLines.length && (
              <span className="text-amber-600 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="hidden sm:inline">Line mismatch</span>
              </span>
            )}
            {/* Retranslate chapter button */}
            {onRetranslateChapter && viewMode === 'chapter' && hasMultipleChapters && (
              <div className="relative">
                <button
                  onClick={() => setShowRetranslatePopover(!showRetranslatePopover)}
                  disabled={isRetranslating}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                    isRetranslating
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  }`}
                >
                  {isRetranslating ? (
                    <>
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Retranslating...
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Retranslate Chapter
                    </>
                  )}
                </button>
                {showRetranslatePopover && !isRetranslating && (
                  <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-10 w-56">
                    <div className="text-xs font-medium text-gray-700 mb-2">
                      Split into sub-chunks:
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      {[1, 2, 3, 4, 5, 6].map(n => (
                        <button
                          key={n}
                          onClick={() => setRetranslateChunks(n)}
                          className={`w-7 h-7 text-xs rounded-md font-medium transition-colors ${
                            retranslateChunks === n
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <div className="text-xs text-gray-500 mb-2">
                      {leftLines.length} source lines {retranslateChunks > 1 ? `(~${Math.ceil(leftLines.length / retranslateChunks)} lines/chunk)` : '(no splitting)'}
                    </div>
                    <button
                      onClick={() => {
                        const sourceChapter = leftChapters[selectedChapter];
                        if (sourceChapter) {
                          setShowRetranslatePopover(false);
                          onRetranslateChapter(selectedChapter, sourceChapter.content, retranslateChunks);
                        }
                      }}
                      className="w-full px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                    >
                      Retranslate with {retranslateChunks} chunk{retranslateChunks > 1 ? 's' : ''}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 flex-wrap text-xs">
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Click to edit
            </span>
            <span className="text-gray-300">|</span>
            <span className="hidden md:flex items-center gap-1">
              Hover #:
              <span className="text-green-600">L R</span>add
              <span className="text-red-600">l r</span>del
              <span className="text-green-600">^</span>
              <span className="text-red-600">✕</span>
            </span>
            <span className="hidden md:inline text-gray-300">|</span>
            {hasMultipleChapters && viewMode === 'chapter' && (
              <>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-gray-200 rounded">←</kbd>
                  <kbd className="px-1 py-0.5 bg-gray-200 rounded">→</kbd>
                  chapters
                </span>
                <span className="text-gray-300">|</span>
              </>
            )}
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-gray-200 rounded">Esc</kbd> close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ComparisonModal;
