"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import Dropdown from "@/components/ui/Dropdown";
import Button from "@/components/ui/Button";
import { useParams } from "next/navigation";
import { Menu, X } from "lucide-react";
import { STORY_THEMES } from "@/components/storyThemes";
import { useRef } from "react";

export default function StoryLayout({ title, partTitle, imageSrc, sentences, initialLevel, storySlug, }) {
  const [currentLevel, setCurrentLevel] = useState(initialLevel || "");
  const [currentPart, setCurrentPart] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const theme = STORY_THEMES[storySlug] || STORY_THEMES["aventura"];
  const audioRefs = useRef(new Map());
  const [activeAudio, setActiveAudio] = useState<null | {
  index: number;
  path: string;
}>(null);

  useEffect(() => {
    const pathParts = window.location.pathname.split("/");
    setCurrentLevel(pathParts[4] || "l1");
    setCurrentPart(pathParts[5] || "part-1");
  }, []);

  useLayoutEffect(() => {
    const possibleGhost = [...document.querySelectorAll("button")]
      .find(b => b.innerText === "PART 1");

    if (possibleGhost) {
      const ghostContainer = possibleGhost.closest("div");
      if (ghostContainer && ghostContainer.style.position === "fixed") {
        console.warn("💀 DELETING GHOST (layout effect):", ghostContainer);
        ghostContainer.remove();
      }
    }
  }, []);

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  };

  return (
    <div
  className={`min-h-screen px-4 sm:px-10 pt-6 pb-16 bg-cover bg-fixed bg-center ${theme.fontFamily} ${theme.textColor}`}
  style={{ backgroundImage: `url('${theme.backgroundImage}')` }}
>
      {/* Fixed Hamburger Button */}
      <header className="fixed top-4 left-4 z-50">
  <button
    className="p-2 rounded-md bg-white/80 border border-emerald-300 hover:bg-emerald-50 shadow-md"
    onClick={() => setMenuOpen(!menuOpen)}
  >
    {menuOpen ? <X size={20} /> : <Menu size={20} />}
  </button>
      </header>

      {/* Hamburger Menu Content */}
      {menuOpen && (
        <div className="fixed top-16 left-4 right-4 z-40 bg-white/90 backdrop-blur-md shadow-md rounded-xl p-4 space-y-4 border border-emerald-200">
          <div className="flex flex-wrap gap-4">
            <Dropdown
              label="Navigate ▾"
              variant="glass"
              options={["Home"]}
              onSelect={(option) => {
                if (option === "Home") {
                  window.location.href = "/es/stories";
                }
              }}
            />

            <Dropdown
              label={`Level Select ▾ ${currentLevel.toUpperCase()}`}
              variant="glass"
              options={["l1", "l2", "l3", "l4", "l5"]}
              onSelect={(level) => {
                const part = currentPart || "part-1";
                window.location.href = `/es/stories/${storySlug}/${level}/${part}`;
              }}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[...Array(10)].map((_, i) => {
              const part = `part-${i + 1}`;
              const isActive = currentPart === part;
              return (
                <Button
                  key={part}
                  variant="parts"
                  onClick={() => {
                    window.location.href = `/es/stories/${storySlug}/${currentLevel}/${part}`;
                  }}
                  className={`px-4 py-2 text-sm sm:text-base rounded-lg sm:rounded-xl hover:scale-105 transition ${isActive ? "ring-2 ring-black" : ""}`}
                >
                  PART {i + 1}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* Always visible Prev/Next navigation */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex justify-center gap-2">
        {(() => {
          const partNumber = parseInt(currentPart.replace('part-', ''));
          const prevDisabled = partNumber === 1;
          const nextDisabled = partNumber === 10;

          const buttonClass = (disabled, color) =>
  `px-4 py-2 rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold text-white transition transform ${color} ${
    disabled ? 'opacity-40 cursor-default' : `${theme.hoverAccentColor} hover:scale-105`
  }`;

          return (
            <>
              <a
                className={buttonClass(prevDisabled, 'bg-green-600')}
                href={
                  prevDisabled
                    ? undefined
                    : `/es/stories/${storySlug}/${currentLevel}/part-${partNumber - 1}`
                }
                onClick={(e) => prevDisabled && e.preventDefault()}
              >
                ⬅ Prev
              </a>
              <a
                className={buttonClass(nextDisabled, 'bg-green-700')}
                href={
                  nextDisabled
                    ? undefined
                    : `/es/stories/${storySlug}/${currentLevel}/part-${partNumber + 1}`
                }
                onClick={(e) => nextDisabled && e.preventDefault()}
              >
                Next ➡
              </a>
            </>
          );
        })()}
      </div>

      {/* Story Layout */}
      <div className="flex justify-center mt-16 sm:mt-28 max-w-7xl mx-auto gap-10 flex-wrap lg:flex-nowrap">
        {/* Center Content */}
        <div className="flex flex-col items-center w-full max-w-md sm:max-w-lg mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold text-center">{title}</h1>
          <h2 className="text-lg sm:text-xl text-center mb-6">{partTitle}</h2>

          {sentences.map((s, i) => (
  <div key={i} className="my-12 sm:my-16 text-center max-w-md relative mx-auto">
    {/* Audio/Translate icons */}
    <div className="sm:absolute sm:left-[-50px] top-0 flex sm:flex-col gap-5 justify-center mb-2 sm:mb-0">
      <button
        onClick={() => {
          const normalPath = `/audio/${storySlug}/${currentLevel}/${currentPart}/line${i + 1}.mp3`;
          setActiveAudio({ index: i, path: normalPath });
        }}
        className="hover:scale-110 transition"
      >
        🔊
      </button>

      <button
        onClick={() => {
          const slowPath = `/audio/${storySlug}/${currentLevel}/${currentPart}-slow/line${i + 1}.mp3`;
          setActiveAudio({ index: i, path: slowPath });
        }}
        className="hover:scale-110 transition"
      >
        🐢
      </button>

      <button
        onClick={(e) => {
          const t = e.target.closest("div").parentElement.querySelector(".translation");
          t.style.display = t.style.display === "block" ? "none" : "block";
        }}
        className="hover:scale-110 transition"
      >
        ✍️
      </button>
    </div>

    {/* Sentence */}
    <div className="ml-4 text-base sm:text-lg">{s.en}</div>
    <div className="translation hidden italic text-gray-600 mt-2 text-sm sm:text-base">{s.es}</div>

    {/* Audio bar - inside the sentence block now ✅ */}
{activeAudio?.index === i && (
  <audio
    key={activeAudio.path}
    controls
    autoPlay
    src={activeAudio.path}
    onEnded={() => setActiveAudio(null)}
    className="w-full mt-1"
  />
)}

</div> {/* end of .my-12 block inside map */}
))}

</div> {/* End of Center Content */}
</div> {/* End of Story Layout */}
</div> {/* End of main background wrapper */}
);
}

