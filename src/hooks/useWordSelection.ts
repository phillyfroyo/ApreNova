// src/hooks/useWordSelection.ts
"use client";

import { useCallback } from "react";
import type { StoryLine } from "@/lib/story-processing/text-processing";
import type { Language } from "@/types/i18n";

interface UseWordSelectionParams {
  wordSelections: Record<number, { start: number; end: number } | null>;
  setWordSelections: React.Dispatch<React.SetStateAction<Record<number, { start: number; end: number } | null>>>;
  pendingStanzaSelection: { stanzaIdx: number; lineIndex: number; wordIndex: number } | null;
  setPendingStanzaSelection: React.Dispatch<React.SetStateAction<{ stanzaIdx: number; lineIndex: number; wordIndex: number } | null>>;
  setShowEmojiButtons: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  setShowStanzaEmojis: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  setManualTranslateFunctions: React.Dispatch<React.SetStateAction<Record<number, () => void>>>;
  setClearSelectionFunctions: React.Dispatch<React.SetStateAction<Record<number, () => void>>>;
  setTranslationData: React.Dispatch<React.SetStateAction<Record<number, { word: string; translation: string; enrichedData?: any } | null>>>;
  setActiveTranslations: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  clearSelectionFunctions: Record<number, () => void>;
  translationData: Record<number, { word: string; translation: string; enrichedData?: any } | null>;
  session: any;
  setSaveToast: React.Dispatch<React.SetStateAction<{ message: string; type: "success" | "error" | "exists" } | null>>;
  setSavingWord: React.Dispatch<React.SetStateAction<number | null>>;
  setSaveAuthLine: React.Dispatch<React.SetStateAction<number | null>>;
  storySlug: string;
  currentLevel: string;
  oppositeLang: Language;
}

export function useWordSelection({
  wordSelections,
  setWordSelections,
  pendingStanzaSelection,
  setPendingStanzaSelection,
  setShowEmojiButtons,
  setShowStanzaEmojis,
  setManualTranslateFunctions,
  setClearSelectionFunctions,
  setTranslationData,
  setActiveTranslations,
  clearSelectionFunctions,
  translationData,
  session,
  setSaveToast,
  setSavingWord,
  setSaveAuthLine,
  storySlug,
  currentLevel,
  oppositeLang,
}: UseWordSelectionParams) {
  // --- handleWordSelectionChange ---
  const handleWordSelectionChange = useCallback(
    (index: number, selection: { start: number; end: number } | null) => {
      setWordSelections((prev) => ({ ...prev, [index]: selection }));
      if (selection) {
        setShowEmojiButtons((prev) => ({ ...prev, [index]: true }));
      }
    },
    [],
  );

  // --- handleStanzaWordClick ---
  // Cross-line stanza selection with nuanced highlight behaviour
  const handleStanzaWordClick = useCallback(
    (
      stanzaIdx: number,
      lineIndex: number,
      wordIndex: number,
      linesInStanza: { line: StoryLine; lineIndex: number }[],
    ) => {
      // Helper: convert (lineIdx, wordIdx) to global word index within stanza
      const toGlobalIdx = (lineIdx: number, wordIdx: number): number => {
        let globalIdx = 0;
        for (const { line, lineIndex: li } of linesInStanza) {
          const lineText = line[oppositeLang] || "";
          const words = lineText.trimStart().split(/\s+/).filter((w) => w);
          if (li === lineIdx) return globalIdx + wordIdx;
          globalIdx += words.length;
        }
        return globalIdx;
      };

      // Helper: get word count for a line
      const getWordCount = (line: StoryLine): number => {
        const lineText = line[oppositeLang] || "";
        return lineText.trimStart().split(/\s+/).filter((w) => w).length;
      };

      // Helper: build per-line selections from global range
      const buildSelectionsFromGlobalRange = (
        globalStart: number,
        globalEnd: number,
      ): Record<number, { start: number; end: number } | null> => {
        const newSelections: Record<number, { start: number; end: number } | null> = {};
        let cumulative = 0;
        for (const { line, lineIndex: li } of linesInStanza) {
          const wordCount = getWordCount(line);
          const lineStart = cumulative;
          const lineEnd = cumulative + wordCount - 1;
          if (globalEnd < lineStart || globalStart > lineEnd) {
            newSelections[li] = null;
          } else {
            const localStart = Math.max(0, globalStart - lineStart);
            const localEnd = Math.min(wordCount - 1, globalEnd - lineStart);
            newSelections[li] = { start: localStart, end: localEnd };
          }
          cumulative += wordCount;
        }
        return newSelections;
      };

      // Helper: get current global selection range from wordSelections state
      const getCurrentGlobalRange = (): { start: number; end: number } | null => {
        let globalStart: number | null = null;
        let globalEnd: number | null = null;
        let cumulative = 0;
        for (const { line, lineIndex: li } of linesInStanza) {
          const wordCount = getWordCount(line);
          const sel = wordSelections[li];
          if (sel) {
            const lineGlobalStart = cumulative + sel.start;
            const lineGlobalEnd = cumulative + sel.end;
            if (globalStart === null || lineGlobalStart < globalStart) globalStart = lineGlobalStart;
            if (globalEnd === null || lineGlobalEnd > globalEnd) globalEnd = lineGlobalEnd;
          }
          cumulative += wordCount;
        }
        return globalStart !== null && globalEnd !== null ? { start: globalStart, end: globalEnd } : null;
      };

      // If clicking in a different stanza, reset and start new selection
      if (pendingStanzaSelection && pendingStanzaSelection.stanzaIdx !== stanzaIdx) {
        const clearedSelections: Record<number, { start: number; end: number } | null> = {};
        linesInStanza.forEach(({ lineIndex: li }) => { clearedSelections[li] = null; });
        setPendingStanzaSelection({ stanzaIdx, lineIndex, wordIndex });
        setWordSelections({ ...clearedSelections, [lineIndex]: { start: wordIndex, end: wordIndex } });
        setShowStanzaEmojis({ [stanzaIdx]: true });
        return;
      }

      const currentRange = getCurrentGlobalRange();
      const clickedGlobalIdx = toGlobalIdx(lineIndex, wordIndex);

      // No current selection -> start one
      if (!currentRange) {
        setPendingStanzaSelection({ stanzaIdx, lineIndex, wordIndex });
        setWordSelections((prev) => ({ ...prev, [lineIndex]: { start: wordIndex, end: wordIndex } }));
        setShowStanzaEmojis({ [stanzaIdx]: true });
        return;
      }

      const { start: globalStart, end: globalEnd } = currentRange;

      // Same single word clicked again -> deselect
      if (globalStart === clickedGlobalIdx && globalEnd === clickedGlobalIdx) {
        const clearedSelections: Record<number, { start: number; end: number } | null> = {};
        linesInStanza.forEach(({ lineIndex: li }) => { clearedSelections[li] = null; });
        setWordSelections((prev) => ({ ...prev, ...clearedSelections }));
        setPendingStanzaSelection(null);
        setShowStanzaEmojis({});
        return;
      }

      // Click outside current selection -> expand
      if (clickedGlobalIdx < globalStart || clickedGlobalIdx > globalEnd) {
        const newStart = Math.min(globalStart, clickedGlobalIdx);
        const newEnd = Math.max(globalEnd, clickedGlobalIdx);
        const newSelections = buildSelectionsFromGlobalRange(newStart, newEnd);
        setWordSelections((prev) => ({ ...prev, ...newSelections }));
        setPendingStanzaSelection(null);
        return;
      }

      // Click inside selection (not at edges) -> shrink from right
      if (clickedGlobalIdx > globalStart && clickedGlobalIdx < globalEnd) {
        const newSelections = buildSelectionsFromGlobalRange(globalStart, clickedGlobalIdx);
        setWordSelections((prev) => ({ ...prev, ...newSelections }));
        setPendingStanzaSelection(null);
        return;
      }

      // Click at start edge when multi-word -> shrink from left
      if (clickedGlobalIdx === globalStart && globalStart !== globalEnd) {
        const newSelections = buildSelectionsFromGlobalRange(globalStart + 1, globalEnd);
        setWordSelections((prev) => ({ ...prev, ...newSelections }));
        setPendingStanzaSelection(null);
        return;
      }

      // Fallback: deselect
      const clearedSelections: Record<number, { start: number; end: number } | null> = {};
      linesInStanza.forEach(({ lineIndex: li }) => { clearedSelections[li] = null; });
      setWordSelections((prev) => ({ ...prev, ...clearedSelections }));
      setPendingStanzaSelection(null);
    },
    [pendingStanzaSelection, oppositeLang, wordSelections],
  );

  // --- handleManualTranslate ---
  const handleManualTranslate = useCallback(
    (index: number, translateFn: () => void) => {
      setManualTranslateFunctions((prev) => ({ ...prev, [index]: translateFn }));
    },
    [],
  );

  // --- handleClearSelection ---
  const handleClearSelection = useCallback(
    (index: number, clearFn: () => void) => {
      setClearSelectionFunctions((prev) => ({ ...prev, [index]: clearFn }));
    },
    [],
  );

  // --- handleTranslationData ---
  const handleTranslationData = useCallback(
    (index: number, data: { word: string; translation: string; enrichedData?: any } | null) => {
      setTranslationData((prev) => ({ ...prev, [index]: data }));
    },
    [],
  );

  // --- handleTranslationStateChange ---
  const handleTranslationStateChange = useCallback(
    (index: number, hasActive: boolean) => {
      setActiveTranslations((prev) => ({ ...prev, [index]: hasActive }));
    },
    [],
  );

  // --- hasSelectedWords ---
  const hasSelectedWords = useCallback(() => {
    return Object.values(wordSelections).some((selection) => selection !== null);
  }, [wordSelections]);

  // --- clearAllWordSelections ---
  const clearAllWordSelections = useCallback(() => {
    setWordSelections({});
    Object.values(clearSelectionFunctions).forEach((clearFn) => clearFn());
  }, [clearSelectionFunctions]);

  // --- handleSaveWord ---
  const handleSaveWord = useCallback(
    async (lineIndex: number, sentence: string, translatedSentence?: string) => {
      if (!session?.user) {
        setSaveAuthLine(lineIndex);
        return;
      }

      const selection = wordSelections[lineIndex];
      if (!selection) {
        setSaveToast({ message: "Select a word first", type: "error" });
        setTimeout(() => setSaveToast(null), 3000);
        return;
      }

      setSavingWord(lineIndex);

      try {
        let word: string;
        let translation: string;
        let enrichedData: any = null;

        const existingData = translationData[lineIndex];

        if (existingData?.word && existingData?.translation && existingData.word !== existingData.translation) {
          word = existingData.word;
          translation = existingData.translation;
          enrichedData = existingData.enrichedData || null;
        } else {
          const words = sentence.trimStart().split(" ");
          const selectedWords = words.slice(selection.start, selection.end + 1);
          word = selectedWords
            .join(" ")
            .replace(/[.,!?;:"\u201C\u201D\u2018\u2019()\u00BF\u00A1\u00AB\u00BB\u2026\u2014\u2013\-]/g, "")
            .trim();

          if (!word) {
            setSaveToast({ message: "No word selected", type: "error" });
            setSavingWord(null);
            setTimeout(() => setSaveToast(null), 3000);
            return;
          }

          const isSingleWord = selectedWords.length === 1;
          const targetLang = oppositeLang === "es" ? "en" : "es";
          const endpoint = isSingleWord
            ? `/api/translate-word?lang=${targetLang}`
            : `/api/translate-phrase?lang=${targetLang}`;

          const translateRes = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              isSingleWord
                ? { word, sentence, level: currentLevel }
                : { phrase: word, sentence, level: currentLevel },
            ),
          });

          if (!translateRes.ok) throw new Error("Failed to translate");

          const translateData = await translateRes.json();
          if (isSingleWord) {
            const ctx = translateData.contextTranslation;
            if (ctx && ctx.toLowerCase() !== word.toLowerCase()) {
              translation = ctx;
            } else if (translateData.rootWord) {
              translation = translateData.rootWord;
            } else {
              translation = translateData.translation || ctx || word;
            }
          } else {
            translation = translateData.translations?.primary || translateData.translation || "";
          }

          if (!translation) throw new Error("Failed to get translation");

          if (isSingleWord && translateData) {
            enrichedData = {
              partOfSpeech: translateData.partOfSpeech,
              derivatives: translateData.derivatives,
              verbChart: translateData.verbChart,
              isDerivative: translateData.isDerivative,
              rootWord: translateData.rootWord,
              rootTranslation: translateData.rootTranslation,
              otherCommonTranslations: translateData.otherCommonTranslations,
              subject: translateData.subject,
              subjectTranslation: translateData.subjectTranslation,
            };
          }
        }

        const res = await fetch("/api/saved-words", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            word,
            translation,
            sourceSentence: sentence,
            translatedSentence: translatedSentence || null,
            storySlug,
            enrichedData,
          }),
        });

        const result = await res.json();

        if (!res.ok) {
          throw new Error(result.error || "Failed to save");
        } else if (result.alreadySaved) {
          setSaveToast({ message: "Already saved!", type: "exists" });
        } else {
          setSaveToast({ message: "Word saved!", type: "success" });
        }
      } catch (error) {
        console.error("Error saving word:", error);
        setSaveToast({ message: "Failed to save word", type: "error" });
      } finally {
        setSavingWord(null);
        setTimeout(() => setSaveToast(null), 2500);
      }
    },
    [translationData, wordSelections, storySlug, currentLevel, oppositeLang, session],
  );

  return {
    handleWordSelectionChange,
    handleStanzaWordClick,
    handleManualTranslate,
    handleClearSelection,
    handleTranslationData,
    handleTranslationStateChange,
    hasSelectedWords,
    clearAllWordSelections,
    handleSaveWord,
  };
}
