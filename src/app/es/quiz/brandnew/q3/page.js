"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function BrandNewQ3Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const count = parseInt(searchParams.get("count") || "1");
  const last = searchParams.get("last") || "brandnew";
  const currentQ = parseInt(searchParams.get("q") || "3");

  const handleAnswer = (isCorrect) => {
    const newLast = isCorrect ? "beginner" : last;
    if (count >= 4) {
      router.push(`/es/quiz/results?level=${newLast}`);
    } else {
      const nextLevel = isCorrect ? "beginner" : "brandnew";
      const nextQ = nextLevel === "brandnew" ? currentQ + 1 : 1;
      router.push(
        `/es/quiz/${nextLevel}/q${nextQ}?count=${count + 1}&q=${nextQ}&last=${newLast}`
      );
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>¿Cómo se dice &quot;goodbye&quot; en español?</h1>
      <button onClick={() => handleAnswer(true)}>Adiós</button>
      <button onClick={() => handleAnswer(false)}>Hola</button>
      <button onClick={() => handleAnswer(false)}>Gracias</button>
    </div>
  );
}

export default function BrandNewQ3() {
  return (
    <Suspense>
      <BrandNewQ3Content />
    </Suspense>
  );
}
