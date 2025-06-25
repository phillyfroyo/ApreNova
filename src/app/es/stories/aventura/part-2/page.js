"use client";

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function Part2Content() {
  const searchParams = useSearchParams();
  const lang = searchParams.get('lang') || 'es';

  return (
    <div style={{ padding: '2rem' }}>
      <h1>{lang === 'es' ? 'Parte 2: La Cueva Misteriosa' : 'Part 2: The Mysterious Cave'}</h1>
      <p>{lang === 'es' ? 'Pedro y Ana entraron con cuidado...' : 'Pedro and Ana carefully entered...'}</p>
    </div>
  );
}

export default function Part2() {
  return (
    <Suspense>
      <Part2Content />
    </Suspense>
  );
}
