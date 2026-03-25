// src/components/story-reader/StanzaEmojiRow.tsx
"use client";

import { Volume2, Loader2, Turtle, BookmarkPlus, MessageCircle, Languages, PenLine, X } from "lucide-react";
import { useStoryReader } from "@/contexts/StoryReaderContext";
import type { StoryLine } from "@/lib/story-processing/text-processing";

interface StanzaEmojiRowProps {
  stanzaIdx: number;
  stanza: StoryLine[];
  linesInStanza: { line: StoryLine; lineIndex: number }[];
}

export default function StanzaEmojiRow({ stanzaIdx, stanza, linesInStanza }: StanzaEmojiRowProps) {
  const {
    typedLang, oppositeLang, currentLevel,
    wordSelections, activeAudio, activeStanzaLine, playbackState,
    savingWord, translationData, skipGlobalClickRef,
    showStanzaEmojis, stanzaTranslationRefs,
    stanzaAITranslation, setStanzaAITranslation,
    handlePlay, handleSaveWord, handleTranslationData, openStoryTutor, setTutorContext,
    stop, setActiveAudio, renderProgressBar,
  } = useStoryReader();

  const isOpen = !!showStanzaEmojis[stanzaIdx];
  const linesWithSelection = linesInStanza.filter(({ lineIndex }) => wordSelections[lineIndex]);
  const hasSelection = linesWithSelection.length > 0;
  const targetLineIndex = activeStanzaLine[stanzaIdx] ?? linesInStanza[0]?.lineIndex ?? 0;
  const stanzaHasAudio = linesInStanza.some(({ lineIndex }) => activeAudio?.index === lineIndex);

  const getSelectedText = (): string => {
    const parts: string[] = [];
    for (const { line, lineIndex } of linesWithSelection) {
      const sel = wordSelections[lineIndex];
      if (sel) {
        const words = (line[oppositeLang] || "").trimStart().split(/\s+/).filter(w => w);
        parts.push(words.slice(sel.start, sel.end + 1).join(" "));
      }
    }
    return parts.join(" ");
  };

  const handleStanzaPlay = (isSlow: boolean) => {
    if (hasSelection) {
      handlePlay(linesWithSelection[0].lineIndex, isSlow, getSelectedText(), true);
    } else {
      const text = stanza.filter(l => !l.isStanzaBreak && l[oppositeLang]?.trim()).map(l => l[oppositeLang]).join(". ");
      handlePlay(linesInStanza[0].lineIndex, isSlow, text, true);
    }
  };

  const handleStanzaTranslate = async () => {
    const isLineFullySelected = (line: StoryLine, li: number): boolean => {
      const sel = wordSelections[li];
      if (!sel) return false;
      const words = (line[oppositeLang] || "").trimStart().split(/\s+/).filter(w => w);
      return sel.start === 0 && sel.end === words.length - 1;
    };

    const getStaticTranslation = () =>
      linesWithSelection.filter(({ line, lineIndex: li }) => isLineFullySelected(line, li)).map(({ line }) => line[typedLang] || "").join("\n");

    const allFullySelected = hasSelection && linesWithSelection.every(({ line, lineIndex: li }) => isLineFullySelected(line, li));

    const getTextToTranslate = () => {
      if (!hasSelection) return stanza.filter(l => !l.isStanzaBreak && l[typedLang]?.trim()).map(l => l[typedLang]).join("\n");
      if (allFullySelected) return getStaticTranslation();
      return getSelectedText().replace(/[.,!?;:()"]+/g, "");
    };

    // Toggle off if same translation showing
    const existing = stanzaAITranslation[stanzaIdx];
    if (existing && !existing.loading) {
      const text = getTextToTranslate();
      const isStatic = !hasSelection || allFullySelected;
      const same = isStatic ? existing.isStatic && existing.text === text : !existing.isStatic && existing.selectedWord === text;
      if (same) { setStanzaAITranslation(prev => { const n = { ...prev }; delete n[stanzaIdx]; return n; }); return; }
    }

    if (!hasSelection) {
      const st = stanza.filter(l => !l.isStanzaBreak && l[typedLang]?.trim()).map(l => l[typedLang]).join("\n");
      setStanzaAITranslation(prev => ({ ...prev, [stanzaIdx]: { text: st, loading: false, isStatic: true } }));
    } else if (allFullySelected) {
      setStanzaAITranslation(prev => ({ ...prev, [stanzaIdx]: { text: getStaticTranslation(), loading: false, isStatic: true } }));
    } else {
      const selectedText = getSelectedText();
      const cleanText = selectedText.replace(/[.,!?;:()"]+/g, "");
      const wordCount = cleanText.split(/\s+/).filter(w => w).length;
      const isSingleWord = wordCount === 1;

      setStanzaAITranslation(prev => ({ ...prev, [stanzaIdx]: { text: "", loading: true, selectedWord: cleanText } }));
      const ctx = stanza.filter(l => !l.isStanzaBreak && l[oppositeLang]?.trim()).map(l => l[oppositeLang]).join(" ");
      const targetLang = oppositeLang === "es" ? "en" : "es";

      try {
        if (isSingleWord) {
          const res = await fetch(`/api/translate-word?lang=${targetLang}`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ word: cleanText, sentence: ctx, level: currentLevel, context: { previous: "", current: ctx, next: "" } }),
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          const translation = data.contextTranslation || data.translations?.[0] || "";
          const enrichedData = data.contextTranslation ? {
            contextTranslation: data.contextTranslation, isDerivative: data.isDerivative, rootWord: data.rootWord,
            rootTranslation: data.rootTranslation, otherCommonTranslations: data.otherCommonTranslations,
            partOfSpeech: data.partOfSpeech, subject: data.subject, subjectTranslation: data.subjectTranslation,
            derivatives: data.derivatives, verbChart: data.verbChart,
          } : undefined;
          setStanzaAITranslation(prev => ({ ...prev, [stanzaIdx]: {
            text: translation, loading: false, isStatic: false, selectedWord: cleanText,
            enhancedTranslation: enrichedData,
          } }));
          if (linesWithSelection.length > 0) {
            handleTranslationData(linesWithSelection[0].lineIndex, { word: cleanText, translation, enrichedData });
          }
        } else {
          const res = await fetch(`/api/translate-phrase?lang=${targetLang}`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phrase: cleanText, sentence: ctx, level: currentLevel, context: { previous: "", current: ctx, next: "" } }),
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          const primary = data.translations?.primary || data.translations?.[0] || "";
          const others = data.translations?.otherCommonTranslations || (Array.isArray(data.translations) ? data.translations.slice(1) : []);
          setStanzaAITranslation(prev => ({ ...prev, [stanzaIdx]: {
            text: primary, loading: false, isStatic: false, selectedWord: cleanText,
            otherTranslations: others.length > 0 ? others : undefined,
          } }));
          if (linesWithSelection.length > 0) {
            handleTranslationData(linesWithSelection[0].lineIndex, { word: cleanText, translation: primary });
          }
        }
      } catch (err) {
        const isAuth = err instanceof Error && err.message.includes("Authentication required");
        if (!isAuth) console.error("[StanzaTranslate] GPT error:", err);
        setStanzaAITranslation(prev => ({ ...prev, [stanzaIdx]: { text: isAuth ? "" : "Translation failed", loading: false, authError: isAuth } }));
      }
    }
  };

  const selBg = hasSelection ? "bg-blue-100" : "bg-transparent delay-500";
  const selText = hasSelection ? "text-blue-600" : "text-gray-700 delay-500";

  return (
    <div>
      <div className={`absolute left-0 right-0 -top-8 flex items-center gap-1 justify-start px-2 transition-opacity duration-200 z-10 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <button onClick={() => handleStanzaPlay(false)} className={`inline-flex items-center justify-center h-7 w-7 hover:scale-110 transition relative rounded ${playbackState.isLoading && stanzaHasAudio && !activeAudio?.isSlow ? "opacity-50 cursor-default" : ""} ${selBg}`} data-audio-control="speaker" disabled={playbackState.isLoading && stanzaHasAudio && !activeAudio?.isSlow} title={hasSelection ? "Play selected words" : "Play full stanza"}>
          {playbackState.isLoading && stanzaHasAudio && !activeAudio?.isSlow ? <Loader2 className="animate-spin h-5 w-5" /> : <Volume2 className={`w-5 h-5 transition-colors duration-200 ease-in-out ${selText}`} strokeWidth={1.5} />}
        </button>
        <button onClick={() => handleStanzaPlay(true)} className={`inline-flex items-center justify-center h-7 w-7 hover:scale-110 transition-all duration-200 ease-in-out relative rounded ${playbackState.isLoading && stanzaHasAudio && activeAudio?.isSlow ? "opacity-50 cursor-default" : ""} ${selBg}`} data-audio-control="turtle" disabled={playbackState.isLoading && stanzaHasAudio && activeAudio?.isSlow} title={hasSelection ? "Play selected words slowly" : "Play full stanza slowly"}>
          {playbackState.isLoading && stanzaHasAudio && activeAudio?.isSlow ? <Loader2 className="animate-spin h-5 w-5" /> : <Turtle className={`w-5 h-5 transition-colors duration-200 ease-in-out ${selText}`} strokeWidth={1.5} />}
        </button>
        <div className={`transition-all duration-200 ease-in-out overflow-hidden h-7 ${hasSelection ? "w-7" : "w-0 delay-500"}`}>
          <button
            onClick={() => { if (linesWithSelection.length > 0) { const { line, lineIndex } = linesWithSelection[0]; handleSaveWord(lineIndex, line[oppositeLang], line[typedLang]); } }}
            onMouseDown={() => { skipGlobalClickRef.current = true; }}
            className={`inline-flex items-center justify-center w-7 h-7 transition-opacity duration-200 ease-in-out rounded ${hasSelection ? `opacity-100 ${savingWord !== null ? "opacity-50" : ""}` : "opacity-0 pointer-events-none"} ${linesWithSelection.length > 0 && translationData[linesWithSelection[0].lineIndex] ? "bg-green-100" : "bg-blue-50"}`}
            data-translation-control="save" title="Save selected word to vocabulary" disabled={!hasSelection || savingWord !== null}
          >
            {savingWord !== null && linesWithSelection.some(l => l.lineIndex === savingWord) ? <Loader2 className="w-4 h-4 animate-spin text-green-600" /> : <BookmarkPlus className={`w-4 h-4 ${linesWithSelection.length > 0 && translationData[linesWithSelection[0].lineIndex] ? "text-green-600" : "text-blue-600"}`} />}
          </button>
        </div>
        <button onClick={() => { const text = stanza.filter(l => !l.isStanzaBreak && l[oppositeLang]?.trim()).map(l => l[oppositeLang]).join("\n"); setTutorContext({ lineIndex: targetLineIndex, fullLine: text, selectedText: hasSelection ? getSelectedText() : undefined }); openStoryTutor(); }} className={`inline-flex items-center justify-center h-7 w-7 hover:scale-110 transition-all duration-200 ease-in-out relative rounded ${selBg}`} title={hasSelection ? "Ask tutor about selection" : "Ask tutor about this stanza"}>
          <MessageCircle className={`w-5 h-5 transition-colors duration-200 ease-in-out ${selText}`} strokeWidth={1.5} />
        </button>
        <button onClick={handleStanzaTranslate} className={`inline-flex items-center justify-center h-7 w-7 hover:scale-110 transition-all duration-200 ease-in-out relative rounded ${selBg}`} data-translation-control="translate" title={hasSelection ? "Translate selection" : "Translate full stanza"}>
          <Languages className={`w-5 h-5 transition-colors duration-200 ease-in-out ${selText}`} strokeWidth={1.5} />
        </button>
        <button onClick={() => { const el = stanzaTranslationRefs.current[stanzaIdx]; if (el) requestAnimationFrame(() => el.classList.toggle("hidden")); }} className="inline-flex items-center justify-center h-7 w-7 hover:scale-110 transition rounded" data-translation-control="pencil" title="Toggle stanza translation">
          <PenLine className="w-5 h-5 text-gray-700" strokeWidth={1.5} />
        </button>
        <div className="relative flex-1 flex items-center h-[30px] ml-3">
          {stanzaHasAudio && activeAudio ? (
            <>
              {renderProgressBar(activeAudio)}
              <button onClick={() => { stop(); setActiveAudio(null); }} className="ml-2 hover:scale-110 transition z-10" data-audio-control="close">
                <X className="w-5 h-5 text-gray-700" strokeWidth={1.5} />
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
