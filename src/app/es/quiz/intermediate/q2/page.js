// src/app/es/quiz/intermediate/q2/page.js
'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export default function IntermediateQ2() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const count = parseInt(searchParams.get('count') || '1');
  const last = searchParams.get('last') || 'intermediate';
  const currentQ = parseInt(searchParams.get('q') || '1');

  const handleAnswer = (isCorrect) => {
    const newLast = isCorrect ? 'advanced' : last;
    if (count >= 4) {
      router.push(`/es/quiz/results?level=${newLast}`);
    } else {
      const nextLevel = isCorrect ? 'advanced' : 'intermediate';
      const nextQ = nextLevel === 'intermediate' ? currentQ + 1 : 1;
      router.push(`/es/quiz/${nextLevel}/q${nextQ}?count=${count + 1}&q=${nextQ}&last=${newLast}`);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>¿Cuál es el opuesto de &quot;caliente&quot;?</h1>
      <button onClick={() => handleAnswer(true)}>Frío</button>
      <button onClick={() => handleAnswer(false)}>Rojo</button>
      <button onClick={() => handleAnswer(false)}>Fácil</button>
    </div>
  );
}
