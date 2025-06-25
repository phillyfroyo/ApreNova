"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function BeginnerQ3Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const count = parseInt(searchParams.get("count") || "1");
  const last = searchParams.get("last") || "beginner";
  const currentQ = parseInt(searchParams.get("q") || "3");

  const handleAnswer = (isCorrect) => {
    const newLast = isCorrect ? "intermediate" : last;
    if (count >= 4) {
      router.push(`/es/quiz/results?level=${newLast}`);
    } else {
      const nextLevel = isCorrect ? "intermediate" : "beginner";
      const nextQ = nextLevel === "beginner" ? currentQ + 1 : 1;
      router.push(
        `/es/quiz/${nextLevel}/q${nextQ}?count=${count + 1}&q=${nextQ}&last=${newLast}`
      );
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>¿Cómo se dice &quot;house&quot; en español?</h1>
      <button onClick={() => handleAnswer(true)}>Casa</button>
      <button onClick={() => handleAnswer(false)}>Perro</button>
      <button onClick={() => handleAnswer(false)}>Cielo</button>
    </div>
  );
}

export default function BeginnerQ3() {
  return (
    <Suspense>
      <BeginnerQ3Content />
    </Suspense>
  );
}
