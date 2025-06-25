// src/app/es/quiz/results/page.js
"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ResultsContent() {
  const searchParams = useSearchParams();
  const level = searchParams.get("level") || "brandnew";

  const levelMap = {
    brandnew: "Principiante absoluto",
    beginner: "Principiante",
    intermediate: "Intermedio",
    advanced: "Avanzado",
    expert: "Experto",
  };

  const message = levelMap[level] || "Nivel desconocido";

  return (
    <div style={{ padding: "2rem" }}>
      <h1>¡Resultados del Quiz!</h1>
      <p>Tu nivel estimado de inglés es: <strong>{message}</strong></p>
      <a href="/es/stories">
        <button
          style={{
            backgroundColor: "#0074D9",
            color: "white",
            fontSize: "1rem",
            padding: "1rem 2rem",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            marginTop: "1rem",
          }}
        >
          Ver historias para tu nivel
        </button>
      </a>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense>
      <ResultsContent />
    </Suspense>
  );
}
