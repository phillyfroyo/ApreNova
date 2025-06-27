"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

function StoriesPageContent() {
  const searchParams = useSearchParams();
  const [selectedLevel, setSelectedLevel] = useState("all");

  useEffect(() => {
    sessionStorage.removeItem("activeLevel"); // reset dropdown override

    const levelFromURL = searchParams.get("level");
    const levelFromStorage = localStorage.getItem("quizLevel");

    if (levelFromURL && levelFromURL !== selectedLevel) {
      setSelectedLevel(levelFromURL);
    } else if (!levelFromURL && levelFromStorage && levelFromStorage !== selectedLevel) {
      setSelectedLevel(levelFromStorage);
    }

    const level = searchParams.get("level");
    if (level && level !== selectedLevel) {
      setSelectedLevel(level);
    }
  }, [searchParams, selectedLevel]);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Historias ({selectedLevel})</h1>
      <div style={{ display: "flex", gap: "1rem", overflowX: "auto", paddingTop: "1rem" }}>
        {[
  { title: "La Aventura", image: "/images/aventura-thumbnail.png" },
  { title: "El Bosque Perdido", image: "/images/placeholder1.png" },
  { title: "Misterio en la Selva", image: "/images/placeholder2.png" },
  { title: "El Viaje Mágico", image: "/images/placeholder3.png" },
  { title: "Secretos del Desierto", image: "/images/placeholder4.png" },
].map((story, i) => (
  <div
    key={i}
    style={{
      minWidth: "200px",
      textAlign: "center",
      cursor: i === 0 ? "pointer" : "default",
    }}
    onClick={() => {
      if (i === 0) {
        const level = localStorage.getItem("quizLevel") || "l1";
        window.location.href = `/es/stories/aventura/${level}/part-1`;
      }
    }}
  >
    <img
      src={story.image}
      alt={story.title}
      style={{
        width: "100%",
        height: "auto",
        aspectRatio: "2 / 3",
        borderRadius: "8px",
        boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
        objectFit: "cover",
      }}
    />
    <p style={{ marginTop: "0.5rem", fontWeight: "bold" }}>{story.title}</p>
  </div>
))}
      </div>
    </div>
  );
}

export default function StoriesPage() {
  return (
    <Suspense>
      <StoriesPageContent />
    </Suspense>
  );
}
