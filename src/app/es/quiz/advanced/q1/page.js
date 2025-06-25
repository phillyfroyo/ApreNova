// src/app/es/quiz/advanced/q1/page.js
"use client";

import { useRouter, useSearchParams } from 'next/navigation';

export default function AdvancedQ1() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const count = parseInt(searchParams.get('count') || '1');
  const last = searchParams.get('last') || 'advanced';
  const currentQ = parseInt(searchParams.get('q') || '1');

  const handleAnswer = (isCorrect) => {
    const newLast = isCorrect ? 'expert' : last;
    if (count >= 4) {
      router.push(`/es/quiz/results?level=${newLast}`);
    } else {
      const nextLevel = isCorrect ? 'expert' : 'advanced';
      const nextQ = nextLevel === 'advanced' ? currentQ + 1 : 1;
      router.push(`/es/quiz/${nextLevel}/q${nextQ}?count=${count + 1}&q=${nextQ}&last=${newLast}`);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>¿Qué significa &quot;desarrollar&quot;?</h1>
      <button onClick={() => handleAnswer(true)}>To develop</button>
      <button onClick={() => handleAnswer(false)}>To delete</button>
      <button onClick={() => handleAnswer(false)}>To sing</button>
    </div>
  );
}
