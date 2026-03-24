// src/components/story-reader/StoryContent.tsx
"use client";

import { useStoryReader } from "@/contexts/StoryReaderContext";
import { t } from "@/lib/t";
import StoryLine from "./StoryLine";
import StanzaEmojiRow from "./StanzaEmojiRow";
import StanzaTranslationCard from "./StanzaTranslationCard";

export default function StoryContent() {
  const {
    sentences, stanzas, storyType, title, dynamicPageTitle,
    typedLang, isStoryTutorOpen, isFinalPage,
    storySlug, currentLevel, chapterNumber, pageNumber,
  } = useStoryReader();

  const isPoemType = storyType === "poem" || storyType === "song-lyrics" || storyType === "epic";
  const isScriptType = storyType === "movie-script" || storyType === "tv-script" || storyType === "dialogue";

  return (
    <div className={`flex flex-col items-start w-full max-w-md sm:max-w-lg px-4 transition-transform duration-300 ${
      isStoryTutorOpen ? "-translate-x-full lg:-translate-x-[50%]" : "translate-x-0 lg:translate-x-0 mx-auto"
    }`}>
      <h1 className="text-2xl sm:text-3xl font-bold text-center w-full">{title}</h1>
      <h2 className="text-lg sm:text-xl text-center mb-2 w-full">{dynamicPageTitle}</h2>

      {/* Render stanzas or flat sentences */}
      {stanzas && stanzas.length > 0 && isPoemType ? (
        (() => {
          let globalLineIndex = 0;
          return stanzas.map((stanza, stanzaIdx) => {
            const stanzaStartIndex = globalLineIndex;
            const linesInStanza = stanza.map((line) => {
              const currentIndex = globalLineIndex;
              globalLineIndex++;
              return { line, lineIndex: currentIndex };
            });
            return (
              <div
                key={`stanza-${stanzaIdx}`}
                className="w-full mb-6 relative"
                data-stanza-number={stanzaIdx + 1}
                data-stanza-start={stanzaStartIndex}
                data-stanza-end={globalLineIndex - 1}
              >
                <StanzaEmojiRow stanzaIdx={stanzaIdx} stanza={stanza} linesInStanza={linesInStanza} />
                {linesInStanza.map(({ line, lineIndex }) => (
                  <StoryLine
                    key={lineIndex}
                    sentence={line}
                    lineIndex={lineIndex}
                    isInsideStanza
                    stanzaContext={{ stanzaIdx, linesInStanza }}
                    isPoemType={isPoemType}
                    isScriptType={isScriptType}
                  />
                ))}
                <StanzaTranslationCard stanzaIdx={stanzaIdx} stanza={stanza} />
              </div>
            );
          });
        })()
      ) : (
        sentences.map((s, i) => (
          <StoryLine
            key={i}
            sentence={s}
            lineIndex={i}
            isPoemType={isPoemType}
            isScriptType={isScriptType}
          />
        ))
      )}

      {/* Mark story as complete */}
      {isFinalPage && (
        <div className="flex justify-center w-full mt-8 mb-4">
          <button
            className="text-sm text-green-700 hover:underline"
            onClick={() => {
              fetch("/api/mark-complete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ storySlug, level: currentLevel, chapter: chapterNumber, page: pageNumber }),
              }).then(() => alert(t(typedLang, "story", "markedComplete")));
            }}
          >
            ✅ {t(typedLang, "story", "markComplete")}
          </button>
        </div>
      )}
    </div>
  );
}
