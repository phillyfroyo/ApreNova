"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

function StoriesPageContent() {
  const searchParams = useSearchParams();
  const [selectedLevel, setSelectedLevel] = useState("all");

  useEffect(() => {
    const level = searchParams.get("level");
    if (level && level !== selectedLevel) {
      setSelectedLevel(level);
    }
  }, [searchParams, selectedLevel]);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Historias ({selectedLevel})</h1>
      {/* Render your story list here based on selectedLevel */}
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
