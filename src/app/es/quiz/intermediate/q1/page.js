"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function IntermediateQ1Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const count = parseInt(searchParams.get("count") || "1");
  const last = searchParams.get("last") || "intermediate";
  const currentQ = parseInt(searchParams.get("q") || "1");

  const handleAnswer = (isCorrect) => {
    const newLast = isCorrect ? "advanced" : last;
    if (count >= 4) {
      router.push(`/es/quiz/results?level=${newLast}`);
    } else {
      const nextLevel = isCorrect ? "advanced" : "intermediate";
      const nextQ = nextLevel === "intermediate" ? currentQ + 1 : 1;
      router.push(
        `/es/quiz/${nextLevel}/q${nextQ}?count=${count + 1}&q=${nextQ}&last=${newLast}`
      );
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>¿Qué significa &quot;ventana&quot;?</h1>
      <button onClick={() => handleAnswer(true)}>Window</button>
      <button onClick={() => handleAnswer(false)}>Chair</button>
      <button onClick={() => handleAnswer(false)}>Car</button>
    </div>
  );
}

export default function IntermediateQ1() {
  return (
    <Suspense>
      <IntermediateQ1Content />
    </Suspense>
  );
}
