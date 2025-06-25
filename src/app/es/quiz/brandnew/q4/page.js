// src/app/es/quiz/brandnew/q4/page.js
'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export default function BrandNewQ4() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const count = parseInt(searchParams.get('count') || '1');
  const last = searchParams.get('last') || 'brandnew';

  const handleAnswer = (isCorrect) => {
    const newLast = isCorrect ? 'beginner' : last;
    router.push(`/es/quiz/results?level=${newLast}`);
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>¿Cuál es una palabra en español?</h1>
      <button onClick={() => handleAnswer(false)}>Apple</button>
      <button onClick={() => handleAnswer(true)}>Casa</button>
      <button onClick={() => handleAnswer(false)}>Dog</button>
    </div>
  );
}
