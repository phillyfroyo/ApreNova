"use client";

import { useEffect, useState } from "react";

export default function StoryLayout({ title, partTitle, imageSrc, sentences }) {
  const [currentLevel, setCurrentLevel] = useState("");
  const [currentPart, setCurrentPart] = useState("");

  useEffect(() => {
    const pathParts = window.location.pathname.split("/");
    setCurrentLevel(pathParts[4] || "l1");
    setCurrentPart(pathParts[5] || "part-1");
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
            "bg-green-300", "bg-green-400", "bg-green-500", "bg-green-500", "bg-green-600",
            "bg-green-600", "bg-green-700", "bg-green-800", "bg-green-900", "bg-emerald-900"
          ][i];

          return (
            <a
              key={part}
              href={`/es/stories/aventura/${currentLevel}/${part}`}
              aria-current={isActive ? "page" : undefined}
              className={`px-3 py-1 rounded text-sm font-semibold text-white transition transform
                ${greenClass} hover:bg-green-300 hover:scale-105
                ${isActive ? "ring-2 ring-black scale-105" : ""}`}
            >
              PART {i + 1}
            </a>
          );
        })}
      </div>

      <div className="fixed top-5 right-10 z-50 flex gap-6">
        <div className="relative group cursor-pointer">
          <div>Navigate ▾</div>
          <div className="absolute top-full right-0 hidden group-hover:block bg-white text-black border border-gray-300 p-2 w-32">
            <div onClick={() => window.location.href = "/es/stories"} className="hover:underline cursor-pointer">Home</div>
          </div>
        </div>

        {/* Level Select Dropdown */}
        <div className="relative group cursor-pointer">
          <div>Level Select ▾ <span className="font-bold uppercase">{currentLevel}</span></div>
          <div className="absolute top-full right-0 hidden group-hover:block bg-white text-black border border-gray-300 p-2 w-36">
            {["l1", "l2", "l3", "l4", "l5"].map((level) => (
              <div
                key={level}
                onClick={() => {
                  const part = currentPart || "part-1";
                  window.location.href = `/es/stories/aventura/${level}/${part}`;
                }}
                className="hover:underline cursor-pointer py-1"
              >
                {level.toUpperCase()}
              </div>
            ))}
          </div>
        </div>
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
