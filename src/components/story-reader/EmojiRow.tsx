// src/components/story-reader/EmojiRow.tsx
"use client";

import { Volume2, Loader2, Turtle, BookmarkPlus, MessageCircle, Languages, PenLine, X } from "lucide-react";
import { useStoryReader } from "@/contexts/StoryReaderContext";

interface EmojiRowProps {
  lineIndex: number;
  sentenceText: string;
  translatedText: string;
  isVisible: boolean;
}

export default function EmojiRow({ lineIndex, sentenceText, translatedText, isVisible }: EmojiRowProps) {
  const {
    wordSelections, activeAudio, playbackState, savingWord,
    translationData, manualTranslateFunctions, skipGlobalClickRef,
    handlePlay, handleSaveWord, openStoryTutor, setTutorContext,
    stop, setActiveAudio, renderProgressBar,
  } = useStoryReader();

  const wordSelection = wordSelections[lineIndex] ?? null;
  const hasSelection = !!wordSelection;
  const lineTranslationData = translationData[lineIndex] ?? null;
  const isLoadingNormal = playbackState.isLoading && activeAudio?.index === lineIndex && !activeAudio?.isSlow;
  const isLoadingSlow = playbackState.isLoading && activeAudio?.index === lineIndex && activeAudio?.isSlow;
  const selBg = hasSelection ? "bg-blue-100" : "bg-transparent delay-500";
  const selText = hasSelection ? "text-blue-600" : "text-gray-700 delay-500";

  return (
    <div className={`absolute left-0 right-0 -top-8 flex items-center gap-1 justify-start px-2 transition-opacity duration-200 z-10 ${
      isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
    }`}>
      {/* Normal speed */}
      <button
        onClick={() => handlePlay(lineIndex, false, sentenceText)}
        className={`inline-flex items-center justify-center h-7 w-7 hover:scale-110 transition-all duration-200 ease-in-out relative rounded ${isLoadingNormal ? "opacity-50 cursor-default" : ""} ${selBg}`}
        data-audio-control="speaker"
        disabled={isLoadingNormal}
        title={hasSelection ? "Play selected words" : "Play full sentence"}
      >
        {isLoadingNormal ? <Loader2 className="animate-spin h-5 w-5" /> : <Volume2 className={`w-5 h-5 transition-colors duration-200 ease-in-out ${selText}`} strokeWidth={1.5} />}
      </button>

      {/* Slow speed */}
      <button
        onClick={() => handlePlay(lineIndex, true, sentenceText)}
        className={`inline-flex items-center justify-center h-7 w-7 hover:scale-110 transition-all duration-200 ease-in-out relative rounded ${isLoadingSlow ? "opacity-50 cursor-default" : ""} ${selBg}`}
        data-audio-control="turtle"
        disabled={isLoadingSlow}
        title={hasSelection ? "Play selected words slowly" : "Play full sentence slowly"}
      >
        {isLoadingSlow ? <Loader2 className="animate-spin h-5 w-5" /> : <Turtle className={`w-5 h-5 transition-colors duration-200 ease-in-out ${selText}`} strokeWidth={1.5} />}
      </button>

      {/* Save word */}
      <div className={`transition-all duration-200 ease-in-out overflow-hidden h-7 ${hasSelection ? "w-7" : "w-0 delay-500"}`}>
        <button
          onClick={() => handleSaveWord(lineIndex, sentenceText, translatedText)}
          onMouseDown={() => { skipGlobalClickRef.current = true; }}
          className={`inline-flex items-center justify-center w-7 h-7 transition-opacity duration-200 ease-in-out rounded ${
            hasSelection ? `opacity-100 ${savingWord === lineIndex ? "opacity-50" : ""}` : "opacity-0 pointer-events-none"
          } ${lineTranslationData ? "bg-green-100" : "bg-blue-50"}`}
          data-translation-control="save"
          title={lineTranslationData ? `Save "${lineTranslationData.word}" to vocabulary` : "Save selected word to vocabulary"}
          disabled={savingWord === lineIndex || !hasSelection}
        >
          {savingWord === lineIndex ? <Loader2 className="w-4 h-4 animate-spin text-green-600" /> : <BookmarkPlus className={`w-4 h-4 ${lineTranslationData ? "text-green-600" : "text-blue-600"}`} />}
        </button>
      </div>

      {/* Tutor */}
      <button
        onClick={() => {
          setTutorContext({
            lineIndex,
            fullLine: sentenceText,
            selectedText: wordSelection
              ? sentenceText.trimStart().split(/\s+/).filter(w => w).slice(wordSelection.start, wordSelection.end + 1).join(" ")
              : undefined,
          });
          openStoryTutor();
        }}
        className={`inline-flex items-center justify-center h-7 w-7 hover:scale-110 transition-all duration-200 ease-in-out relative rounded ${selBg}`}
        title={hasSelection ? "Ask tutor about selection" : "Ask tutor about this line"}
      >
        <MessageCircle className={`w-5 h-5 transition-colors duration-200 ease-in-out ${selText}`} strokeWidth={1.5} />
      </button>

      {/* Translate */}
      <button
        onClick={() => { if (manualTranslateFunctions[lineIndex]) manualTranslateFunctions[lineIndex](); }}
        className={`inline-flex items-center justify-center h-7 w-7 hover:scale-110 transition-all duration-200 ease-in-out relative rounded ${selBg}`}
        data-translation-control="gpt"
        title="Translate"
      >
        <Languages className={`w-5 h-5 transition-colors duration-200 ease-in-out ${selText}`} strokeWidth={1.5} />
      </button>

      {/* Pencil */}
      <button
        onClick={() => {
          const el = document.querySelector(`[data-static-translation="${lineIndex}"]`) as HTMLElement | null;
          if (el) requestAnimationFrame(() => el.classList.toggle("hidden"));
        }}
        className="inline-flex items-center justify-center h-7 w-7 hover:scale-110 transition rounded"
        data-translation-control="pencil"
        title="Toggle full line translation"
      >
        <PenLine className="w-5 h-5 text-gray-700" strokeWidth={1.5} />
      </button>

      {/* Progress bar */}
      <div className="relative flex-1 flex items-center h-[30px] ml-3">
        {activeAudio?.index === lineIndex ? (
          <>
            {renderProgressBar(activeAudio)}
            <button onClick={() => { stop(); setActiveAudio(null); }} className="ml-2 hover:scale-110 transition z-10" data-audio-control="close">
              <X className="w-5 h-5 text-gray-700" strokeWidth={1.5} />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
