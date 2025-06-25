"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function BeginnerQ2Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const count = parseInt(searchParams.get("count") || "1");
  const last = searchParams.get("last") || "beginner";
  const currentQ = parseInt(searchParams.get("q") || "2");

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
      <h1>¿Qué significa &quot;perro&quot;?</h1>
      <button onClick={() => handleAnswer(true)}>Dog</button>
      <button onClick={() => handleAnswer(false)}>Cat</button>
      <button onClick={() => handleAnswer(false)}>Bird</button>
    </div>
  );
}

export default function BeginnerQ2() {
  return (
    <Suspense>
      <BeginnerQ2Content />
    </Suspense>
  );
}
