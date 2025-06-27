"use client";

import { useEffect, useState } from "react";

const sentences = [
  { en: "My name is Pedro, and I live in a quiet town in Guatemala.", es: "Mi nombre es Pedro y vivo en un pueblo tranquilo de Guatemala." },
  { en: "One afternoon, my friend Juan came over with something in his hand. It was a map.", es: "Una tarde, mi amigo Juan vino con algo en la mano. Era un mapa." },
  { en: "The paper looked old, like it had been hidden for a long time.", es: "El papel parecía viejo, como si hubiera estado escondido por mucho tiempo." },
  { en: "Faded lines ran across it, leading into the forest.", es: "Líneas desvanecidas lo cruzaban, conduciendo al bosque." },
  { en: "We studied it together, trying to understand what it meant.", es: "Lo estudiamos juntos, tratando de entender qué significaba." },
  { en: "\"Maybe it leads to something important,\" Juan said. I agreed.", es: "\"Tal vez conduce a algo importante,\" dijo Juan. Yo estuve de acuerdo." },
  { en: "The next morning, we packed a few things and left before the sun was high.", es: "A la mañana siguiente, empacamos algunas cosas y salimos antes de que el sol estuviera alto." },
  { en: "The road was long and hot. We passed trees, birds, and small rivers.", es: "El camino era largo y caluroso. Pasamos árboles, pájaros y pequeños ríos." },
  { en: "Most of the time, the only sounds were our steps and the wind.", es: "La mayoría del tiempo, los únicos sonidos eran nuestros pasos y el viento." },
  { en: "Still, I felt something in the air.", es: "Aun así, sentía algo en el aire." }
];

export default function Part1Page() {
  const [showNav, setShowNav] = useState(false);
  const [showLevel, setShowLevel] = useState(false);
  const [currentLevel, setCurrentLevel] = useState("");
  const [currentPart, setCurrentPart] = useState("");

  useEffect(() => {
    window.scrollTo(0, 0);

    const pathParts = window.location.pathname.split("/");
    setCurrentLevel(pathParts[4] || "l1");
    setCurrentPart(pathParts[5] || "part-1");
    console.log("Routing Info:", pathParts[4], pathParts[5]);
  }, []);

  const levels = ["l1", "l2", "l3", "l4", "l5"];

  const goToLevel = (level) => {
    const part = currentPart || "part-1";
    window.location.href = `/es/stories/aventura/${level}/${part}`;
  };

  return (
    <div style={{
      fontFamily: "Arial, sans-serif",
      backgroundImage: "url('/images/background2.jpg')",
      backgroundSize: "cover",
      backgroundRepeat: "no-repeat",
      backgroundAttachment: "fixed",
      backgroundPosition: "center",
      color: "#111",
      margin: 0,
      padding: 0,
      fontSize: "1.5em",
      minHeight: "100vh"
    }}>
      {/* Top right dropdowns */}
      <div style={{ position: "fixed", top: "20px", right: "30px", zIndex: 1000, display: "flex", gap: "20px" }}>
        {/* Navigate dropdown */}
        <div
          onMouseEnter={() => setShowNav(true)}
          onMouseLeave={() => setShowNav(false)}
          style={{ position: "relative", cursor: "pointer" }}
        >
          <div>Navigate ▾</div>
          {showNav && (
            <div style={{
              position: "absolute",
              top: "100%",
              right: 0,
              backgroundColor: "#fff",
              color: "#000",
              border: "1px solid #ccc",
              padding: "8px",
              minWidth: "120px"
            }}>
              <div onClick={() => window.location.href = "/es/stories"} style={{ padding: "4px 0", cursor: "pointer" }}>Home</div>
            </div>
          )}
        </div>

        {/* Level select dropdown */}
        <div
          onMouseEnter={() => setShowLevel(true)}
          onMouseLeave={() => setShowLevel(false)}
          style={{ position: "relative", cursor: "pointer" }}
        >
          <div onClick={() => setShowLevel((prev) => !prev)}>Level Select ▾ <span style={{ fontWeight: "bold" }}>{currentLevel.toUpperCase()}</span></div>
          {showLevel && (
            <div style={{
              position: "absolute",
              top: "100%",
              right: 0,
              backgroundColor: "#fff",
              color: "#000",
              border: "1px solid #ccc",
              padding: "8px",
              minWidth: "140px"
            }}>
              {levels.map((level) => (
                <div key={level} onClick={() => goToLevel(level)} style={{ padding: "4px 0", cursor: "pointer" }}>
                  {level.toUpperCase()}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", marginTop: "80px", padding: "0 40px" }}>
<div style={{ flex: "0 0 250px", display: "flex", justifyContent: "center" }}>
          <img
            src="/images/master_pedro.png"
            alt="Pedro in his town"
            style={{
              width: "100%",
              height: "auto",
              WebkitMaskImage: "radial-gradient(circle, rgba(0,0,0,1) 20%, rgba(0,0,0,0) 70%)",
              maskImage: "radial-gradient(circle, rgba(0,0,0,1) 20%, rgba(0,0,0,0) 70%)",
              maskSize: "contain",
              WebkitMaskSize: "contain",
              maskRepeat: "no-repeat",
              WebkitMaskRepeat: "no-repeat",
              maskPosition: "center",
              WebkitMaskPosition: "center"
            }}
          />
        </div>

        <div style={{ flex: "0 0 700px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ textAlign: "center", fontSize: "2em", fontWeight: "bold" }}>Adventure in Guatemala</div>
          <div style={{ textAlign: "center", fontSize: "1.5em", marginBottom: "20px" }}>Part 1</div>

          {sentences.map((s, i) => (
            <div key={i} style={{ margin: "60px auto", textAlign: "center", maxWidth: "500px", position: "relative" }}>
              <div style={{ position: "absolute", left: "-80px", top: 0 }}>
                <span
                  onClick={() => speak(s.en)}
                  style={{ display: "inline-block", margin: "0 2px", cursor: "pointer" }}
                >🔊</span>
                <span
                  onClick={(e) => {
                    const t = e.target.closest('div').parentElement.querySelector('.translation');
                    t.style.display = t.style.display === 'block' ? 'none' : 'block';
                  }}
                  style={{ display: "inline-block", margin: "0 2px", cursor: "pointer" }}
                >✍️</span>
              </div>
              <div>
                <div className="sentence-text" style={{ marginLeft: "10px", transition: "opacity 0.3s ease" }}>{s.en}</div>
                <div className="translation" style={{ display: "none", fontStyle: "italic", color: "#444", marginTop: "8px" }}>{s.es}</div>
              </div>
            </div>
          ))}
        </div>

        <div>{/* Right side reserved */}</div>
      
        {/* Navigation Controls */}
        <div style={{ textAlign: "center", marginTop: "60px", fontSize: "1rem" }}>
          {parseInt(currentPart.split("-")[1]) > 1 && (
            <a
              href={`/es/stories/aventura/${currentLevel}/part-${parseInt(currentPart.split("-")[1]) - 1}`}
              style={{ marginRight: "20px", cursor: "pointer", textDecoration: "underline" }}
            >
              ← Previous
            </a>
          )}
          {currentPart !== "part-10" && (
  <a
    href={`/es/stories/aventura/${currentLevel}/part-${parseInt(currentPart.split("-")[1]) + 1}`}
    style={{ cursor: "pointer", textDecoration: "underline" }}
  >
    Next →
  </a>
)}
        </div>
      </div>
    </div>
  );

}

function speak(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}
