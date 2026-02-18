"use client";

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";

interface OriginalTextModalProps {
  originalText: string;
  detectedLevel: number | null;
  onSave: (newText: string) => void;
  onClose: () => void;
}

interface ParsedChapter {
  number: number;
  title: string;
  content: string;
  dividerLine: string; // The "--- Chapter N: Title ---" line
}

function parseChapters(text: string): ParsedChapter[] {
  const lines = text.split("\n");
  const chapters: ParsedChapter[] = [];
  const chapterPattern = /^---\s*(?:Chapter|Capítulo)\s+(\d+)(?::\s*(.+?))?\s*---$/i;

  let currentChapter: { number: number; title: string; dividerLine: string; startContentIdx: number } | null = null;
  let contentLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(chapterPattern);
    if (match) {
      if (currentChapter) {
        chapters.push({
          number: currentChapter.number,
          title: currentChapter.title,
          dividerLine: currentChapter.dividerLine,
          content: contentLines.join("\n"),
        });
      }
      currentChapter = {
        number: parseInt(match[1], 10),
        title: match[2]?.trim() || "",
        dividerLine: lines[i],
        startContentIdx: i + 1,
      };
      contentLines = [];
    } else if (currentChapter) {
      contentLines.push(lines[i]);
    }
  }

  if (currentChapter) {
    chapters.push({
      number: currentChapter.number,
      title: currentChapter.title,
      dividerLine: currentChapter.dividerLine,
      content: contentLines.join("\n"),
    });
  }

  // If no chapter markers found, treat entire text as single chapter
  if (chapters.length === 0) {
    return [{ number: 1, title: "", dividerLine: "", content: text }];
  }

  return chapters;
}

function reassembleText(chapters: ParsedChapter[]): string {
  // Single chapter with no divider line = raw text, return as-is
  if (chapters.length === 1 && !chapters[0].dividerLine) {
    return chapters[0].content;
  }

  return chapters
    .map((ch) => (ch.dividerLine ? ch.dividerLine + "\n" + ch.content : ch.content))
    .join("\n");
}

export function OriginalTextModal({
  originalText,
  detectedLevel,
  onSave,
  onClose,
}: OriginalTextModalProps) {
  // Parse chapters from the live originalText prop
  const chapters = useMemo(() => parseChapters(originalText), [originalText]);
  const hasMultipleChapters = chapters.length > 1;

  // Per-chapter edited content (only stores edits, falls back to parsed content)
  const [editedChapters, setEditedChapters] = useState<Record<number, string>>({});
  // Which chapters are expanded
  const [openChapters, setOpenChapters] = useState<Set<number>>(() => new Set([0]));
  // Track unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Scroll container ref for preserving scroll position
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get the current content for a chapter (edited or original)
  const getChapterContent = useCallback(
    (idx: number) => editedChapters[idx] ?? chapters[idx]?.content ?? "",
    [editedChapters, chapters]
  );

  // Toggle chapter open/closed
  const toggleChapter = useCallback((idx: number) => {
    setOpenChapters((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }, []);

  // Handle text change in a chapter textarea
  const handleChapterEdit = useCallback(
    (idx: number, value: string) => {
      setEditedChapters((prev) => ({ ...prev, [idx]: value }));
      setHasUnsavedChanges(true);
    },
    []
  );

  // Save all changes
  const handleSave = useCallback(() => {
    // Preserve scroll position
    const scrollTop = scrollRef.current?.scrollTop ?? 0;

    // Build updated chapters array
    const updatedChapters = chapters.map((ch, idx) => ({
      ...ch,
      content: editedChapters[idx] ?? ch.content,
    }));

    const newText = reassembleText(updatedChapters);
    onSave(newText);

    // Clear edit state since the parent now has the new text
    // The chapters will re-parse from the updated originalText prop
    setEditedChapters({});
    setHasUnsavedChanges(false);

    // Restore scroll position after React re-renders
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollTop;
      }
    });
  }, [chapters, editedChapters, onSave]);

  // Revert all edits
  const handleRevert = useCallback(() => {
    setEditedChapters({});
    setHasUnsavedChanges(false);
  }, []);

  // Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Stats
  const totalLines = originalText.split("\n").length;
  const totalContentLines = originalText.split("\n").filter((l) => l.trim()).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-[90vw] max-w-5xl h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-700 to-gray-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-lg font-semibold">
              Original Text (L{detectedLevel})
            </span>
            <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
              {totalContentLines} lines &bull; {chapters.length} chapter{chapters.length !== 1 ? "s" : ""}
            </span>
            {hasUnsavedChanges && (
              <span className="text-sm bg-yellow-500/80 px-3 py-1 rounded-full animate-pulse">
                Unsaved changes
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {hasUnsavedChanges && (
              <>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg text-sm font-medium transition-colors"
                >
                  Save Changes
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

        {/* Scrollable content */}
        <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-3">
          {chapters.map((chapter, idx) => {
            const isOpen = openChapters.has(idx);
            const content = getChapterContent(idx);
            const lineCount = content.split("\n").filter((l) => l.trim()).length;

            return (
              <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Chapter header - clickable to toggle */}
                <button
                  onClick={() => toggleChapter(idx)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <svg
                      className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? "rotate-90" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="font-medium text-gray-900">
                      {hasMultipleChapters
                        ? `Chapter ${chapter.number}${chapter.title ? `: ${chapter.title}` : ""}`
                        : "Full Text"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{lineCount} lines</span>
                    {editedChapters[idx] !== undefined && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                        edited
                      </span>
                    )}
                  </div>
                </button>

                {/* Chapter content - textarea */}
                {isOpen && (
                  <div className="border-t border-gray-200">
                    <textarea
                      value={content}
                      onChange={(e) => handleChapterEdit(idx, e.target.value)}
                      className="w-full p-4 font-mono text-sm text-gray-800 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-300"
                      style={{
                        minHeight: Math.min(600, Math.max(200, lineCount * 22)) + "px",
                      }}
                      spellCheck={false}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-3 text-sm text-gray-500 border-t flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <span>{totalLines} total lines</span>
            <span className="text-gray-300">|</span>
            <span>{chapters.length} chapter{chapters.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span>Edit directly in the textareas above</span>
            <span className="text-gray-300">|</span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-gray-200 rounded">Esc</kbd> close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OriginalTextModal;
