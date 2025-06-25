"use client";

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function Part3Content() {
  const searchParams = useSearchParams();
  const lang = searchParams.get('lang') || 'es';

  return (
    <div style={{ padding: '2rem' }}>
      <h1>{lang === 'es' ? 'Parte 3: El Mapa Antiguo' : 'Part 3: The Ancient Map'}</h1>
      <p>{lang === 'es' ? 'Ana encontró un mapa escondido en la cueva...' : 'Ana found a map hidden in the cave...'}</p>
    </div>
  );
}

export default function Part3() {
  return (
    <Suspense>
      <Part3Content />
    </Suspense>
  );
}
