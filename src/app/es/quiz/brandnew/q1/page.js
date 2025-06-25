"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function BrandNewQ1Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const count = parseInt(searchParams.get("count") || "1");
  const last = searchParams.get("last") || "brandnew";
  const currentQ = parseInt(searchParams.get("q") || "1");

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
      <h1>¿Qué quiere decir &quot;hola&quot;?</h1>
      <button onClick={() => handleAnswer(true)}>Hello</button>
      <button onClick={() => handleAnswer(false)}>Goodbye</button>
      <button onClick={() => handleAnswer(false)}>Please</button>
    </div>
  );
}

export default function BrandNewQ1() {
  return (
    <Suspense>
      <BrandNewQ1Content />
    </Suspense>
  );
}
