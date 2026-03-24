// src/components/story-reader/StoryLine.tsx
"use client";

import Link from "next/link";
import UnifiedTranslator from "@/components/UnifiedTranslator";
import EmojiRow from "./EmojiRow";
import { useStoryReader } from "@/contexts/StoryReaderContext";
import { t } from "@/lib/t";
import type { StoryLine as StoryLineType } from "@/lib/story-processing/text-processing";

interface StoryLineProps {
  sentence: StoryLineType;
  lineIndex: number;
  isInsideStanza?: boolean;
  stanzaContext?: {
    stanzaIdx: number;
    linesInStanza: { line: StoryLineType; lineIndex: number }[];
  };
  isPoemType: boolean;
  isScriptType: boolean;
}

export default function StoryLine({
  sentence: s,
  lineIndex,
  isInsideStanza = false,
  stanzaContext,
  isPoemType,
  isScriptType,
}: StoryLineProps) {
  const {
    typedLang, oppositeLang, audioPlayer,
    showEmojiButtons, wordSelections, activeAudio, playbackState,
    savingWord, translationData, manualTranslateFunctions, skipGlobalClickRef,
    saveAuthLine, setSaveAuthLine,
    isAnyDropdownOpen, menuOpen, translationMode, premiumTriggers,
    sentences, sentenceRefs,
    handlePlay, handleSaveWord,
    handleTranslationStateChange, handleWordSelectionChange,
    handleManualTranslate, handleClearSelection,
    handleTranslationData, handleStanzaWordClick,
    openStoryTutor, setTutorContext,
    stop, setActiveAudio, renderProgressBar,
  } = useStoryReader();

  // Stanza break
  if (s.isStanzaBreak) {
    return <div className="w-full h-6" data-stanza-break={s.stanzaNumber} aria-hidden="true" />;
  }

  // Empty line
  if (!s.es?.trim() && !s.en?.trim()) {
    return <div className="w-full h-4" data-empty-line="true" aria-hidden="true" />;
  }

  const stageDirectionText = oppositeLang === "es"
    ? (s.stageDirectionEs || s.stageDirection)
    : (s.stageDirectionEn || s.stageDirection);

  // Stage-direction-only
  if (s.isStageDirectionOnly && stageDirectionText) {
    return (
      <div className="my-4 w-full px-2 text-center" data-sentence-index={lineIndex}>
        <span className="italic text-gray-500 text-sm">({stageDirectionText})</span>
      </div>
    );
  }

  // Editorial note
  if (s.isEditorialNote) {
    return (
      <div className="my-4 w-full px-2" data-sentence-index={lineIndex}>
        <p className="italic text-gray-500 text-sm leading-relaxed">{s[oppositeLang] || s.es || s.en}</p>
      </div>
    );
  }

  const lineSpacing = isPoemType || isInsideStanza ? "my-0" : "my-6";
  const isHighlighted = audioPlayer.state.highlightedSentenceIndex === lineIndex;

  return (
    <div
      ref={(el) => { sentenceRefs.current[lineIndex] = el; }}
      className={`${lineSpacing} w-full relative transition-colors duration-300 ${isHighlighted ? "bg-indigo-50 rounded-xl" : ""}`}
      data-sentence-index={lineIndex}
    >
      {/* Speaker name (scripts) */}
      {isScriptType && s.speaker && (
        <div className="px-2 mb-1">
          <span className="font-bold text-amber-700 text-sm uppercase tracking-wide">{s.speaker}</span>
          {s.speakerAnnotation && <span className="font-normal text-gray-500 text-xs ml-1">{s.speakerAnnotation}</span>}
        </div>
      )}

      {/* Inline stage direction (scripts) */}
      {isScriptType && stageDirectionText && !s.isStageDirectionOnly && (
        <div className="px-2 mb-1">
          <span className="italic text-gray-500 text-sm">({stageDirectionText})</span>
        </div>
      )}

      {/* Emoji row (skip for stanza poems) */}
      {!isInsideStanza && (
        <EmojiRow
          lineIndex={lineIndex}
          sentenceText={s[oppositeLang]}
          translatedText={s[typedLang]}
          isVisible={!!showEmojiButtons[lineIndex]}
        />
      )}

      {/* Text content */}
      <div className={`w-full px-2 relative ${isScriptType && s.speaker ? "pl-4" : ""}`} data-text-content={lineIndex}>
        <UnifiedTranslator
          sentence={s[oppositeLang]}
          staticTranslation={s[typedLang]}
          enabled={!isAnyDropdownOpen && !menuOpen}
          readOnlyMode={translationMode === "free"}
          autoTriggerAll={premiumTriggers[lineIndex] || false}
          onTranslationStateChange={(hasActive) => handleTranslationStateChange(lineIndex, hasActive)}
          onSelectionChange={(selection) => handleWordSelectionChange(lineIndex, selection)}
          onManualTranslate={(translateFn) => handleManualTranslate(lineIndex, translateFn)}
          onClearSelection={(clearFn) => handleClearSelection(lineIndex, clearFn)}
          onTranslationData={(data) => handleTranslationData(lineIndex, data)}
          sentenceIndex={lineIndex}
          contextSentences={sentences}
          parentHasSelection={!!wordSelections[lineIndex]}
          externalSelection={stanzaContext ? wordSelections[lineIndex] : undefined}
          onWordClick={stanzaContext ? (wordIdx) => handleStanzaWordClick(stanzaContext.stanzaIdx, lineIndex, wordIdx, stanzaContext.linesInStanza) : undefined}
        />

        {/* Save auth prompt */}
        {saveAuthLine === lineIndex && (
          <div className="mt-1 -ml-2 w-[calc(100%+16px)] bg-white text-black px-4 pt-3 pb-3 rounded-xl shadow z-50 relative" data-tooltip>
            <button onClick={() => setSaveAuthLine(null)} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-sm" data-translation-control="close">✕</button>
            <div className="text-sm pr-6">
              <span className="text-gray-700">{t(typedLang, "translator", "saveSignInRequired")} </span>
              <Link href={`/${typedLang}/auth/login`} className="text-indigo-600 hover:underline font-medium">{t(typedLang, "translator", "signIn")}</Link>
              <span className="text-gray-700"> {t(typedLang, "translator", "or")} </span>
              <Link href={`/${typedLang}/auth/signup`} className="text-indigo-600 hover:underline font-medium">{t(typedLang, "translator", "createAccount")}</Link>
            </div>
          </div>
        )}

        {/* Per-line static translation (skip for stanza poems) */}
        {!isInsideStanza && (
          <div data-static-translation={lineIndex} className="translation hidden bg-white text-black px-4 pt-3 pb-3 rounded-xl shadow z-50 mt-1 -ml-2 w-[calc(100%+16px)] relative">
            <button onClick={() => { const el = document.querySelector(`[data-static-translation="${lineIndex}"]`) as HTMLElement | null; if (el) el.classList.add("hidden"); }} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-sm" data-translation-control="close">✕</button>
            <span className="text-lg font-medium text-gray-900 pr-6" style={{ wordSpacing: "0.15em" }}>{s[typedLang]}</span>
          </div>
        )}
      </div>
    </div>
  );
}
