// src/app/es/quiz/brandnew/q1/page.js
'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export default function BrandNewQ1() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const count = parseInt(searchParams.get('count') || '1');
  const last = searchParams.get('last') || 'brandnew';

  const handleAnswer = (isCorrect) => {
    const newLast = isCorrect ? 'beginner' : last;
    if (count >= 4) {
      router.push(`/es/quiz/results?level=${newLast}`);
    } else {
      const nextLevel = isCorrect ? 'beginner' : 'brandnew';
      const nextQ = nextLevel === last ? count + 1 : 1;
      router.push(`/es/quiz/${nextLevel}/q${nextQ}?count=${count + 1}&last=${newLast}`);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>¿Cómo se dice &quot;hello&quot; en español?</h1>
      <button onClick={() => handleAnswer(true)}>Hola</button>
      <button onClick={() => handleAnswer(false)}>Gracias</button>
      <button onClick={() => handleAnswer(false)}>Adiós</button>
    </div>
  );
}
