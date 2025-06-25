"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function Part1Content() {
  const searchParams = useSearchParams();
  const storyMode = searchParams.get("mode") || "read";

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Parte 1: La carta misteriosa</h1>
      <p>
  Pedro vivía en un pequeño pueblo en las montañas de Guatemala. Un día, recibió una carta sin remitente. La carta decía: &quot;Sigue el mapa. El secreto te espera.&quot;
</p>
      <p>
        {storyMode === "read"
          ? "Pedro miró el mapa con curiosidad y decidió seguirlo."
          : "Traduce: Pedro looked at the map with curiosity and decided to follow it."}
      </p>
    </div>
  );
}

export default function Part1() {
  return (
    <Suspense>
      <Part1Content />
    </Suspense>
  );
}
