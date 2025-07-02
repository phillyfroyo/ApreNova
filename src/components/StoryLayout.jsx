"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import Dropdown from "@/components/ui/Dropdown";
import Button from "@/components/ui/Button";

export default function StoryLayout({ title, partTitle, imageSrc, sentences }) {
  const [currentLevel, setCurrentLevel] = useState("");
  const [currentPart, setCurrentPart] = useState("");

  console.log("👀 StoryLayout RENDERED");

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
    <div className="font-sans bg-cover bg-fixed bg-center text-gray-900 min-h-screen px-4 pt-6"
         style={{ backgroundImage: "url('/images/background2.jpg')" }}>

      {/* Top Nav with Part Buttons */}
      <div className="fixed top-5 left-5 z-50 flex flex-wrap gap-2">
        {[...Array(10)].map((_, i) => {
          const part = `part-${i + 1}`;
          const isActive = currentPart === part;
          const greenClass = [
            "bg-green-500", "bg-green-500", "bg-green-600", "bg-green-600", "bg-green-700",
            "bg-green-700", "bg-green-800", "bg-green-800", "bg-emerald-800", "bg-emerald-900"
          ][i];

          return (
            <Button
              key={part}
              variant="parts"
              onClick={() => {
              window.location.href = `/es/stories/aventura/${currentLevel}/${part}`;
             }}
              className={isActive ? "ring-2 ring-black scale-105" : ""}
            >
             PART {i + 1}
            </Button>
          );
        })}
      </div>

      {/* Prev/Next Buttons */}
      <div className="fixed top-[72px] left-5 z-50 flex gap-2">
        {(() => {
          const partNumber = parseInt(currentPart.replace('part-', ''));
          const prevDisabled = partNumber === 1;
          const nextDisabled = partNumber === 10;

          const buttonClass = (disabled, color) => `px-3 py-1 rounded text-sm font-semibold text-white transition transform ${color} ${disabled ? 'opacity-40 cursor-default' : 'hover:bg-green-300 hover:scale-105'}`;

          return (
            <>
              <a
                className={buttonClass(prevDisabled, 'bg-green-600')}
                href={prevDisabled ? undefined : `/es/stories/aventura/${currentLevel}/part-${partNumber - 1}`}
                onClick={e => prevDisabled && e.preventDefault()}
              >
                ⬅ Prev
              </a>
              <a
                className={buttonClass(nextDisabled, 'bg-green-700')}
                href={nextDisabled ? undefined : `/es/stories/aventura/${currentLevel}/part-${partNumber + 1}`}
                onClick={e => nextDisabled && e.preventDefault()}
              >
                Next ➡
              </a>
            </>
          );
        })()}
      </div>

      {/* Top Right Dropdowns */}
      <div className="fixed top-5 right-10 z-50 flex gap-6">
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
            window.location.href = `/es/stories/aventura/${level}/${part}`;
          }}
        />
      </div>

      {/* Story Layout */}
      <div className="flex justify-center mt-28 max-w-7xl mx-auto gap-10 flex-wrap lg:flex-nowrap">

        {/* Center Content */}
        <div className="flex flex-col items-center max-w-[700px] w-full">
          <h1 className="text-3xl font-bold text-center">{title}</h1>
          <h2 className="text-xl text-center mb-6">{partTitle}</h2>

          {sentences.map((s, i) => (
            <div key={i} className="my-16 text-center max-w-md relative mx-auto">
              {/* Audio/Translate icons */}
              <div className="absolute left-[-50px] top-0 flex flex-col gap-1">
                <button onClick={() => speak(s.en)} className="hover:scale-110 transition">🔊</button>
                <button
                  onClick={(e) => {
                    const t = e.target.closest('div').parentElement.querySelector('.translation');
                    t.style.display = t.style.display === 'block' ? 'none' : 'block';
                  }}
                  className="hover:scale-110 transition"
                >✍️</button>
              </div>
              {/* Sentence */}
              <div className="ml-4">{s.en}</div>
              <div className="translation hidden italic text-gray-600 mt-2">{s.es}</div>
            </div>
          ))}

        </div>
      </div>
    </div>
  );
}
