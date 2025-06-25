// src/app/es/quiz/results/page.js
'use client';

import { useSearchParams, useRouter } from 'next/navigation';

export default function QuizResults() {
  const searchParams = useSearchParams();
  const level = searchParams.get('level') || 'beginner';
  const router = useRouter();

  const handleContinue = () => {
    router.push(`/es/stories?level=${level}`);
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>¡Felicidades!</h1>
      <p>Tu nivel actual es: <strong>{level}</strong></p>
      <button onClick={handleContinue}>Continuar</button>
    </div>
  );
}
