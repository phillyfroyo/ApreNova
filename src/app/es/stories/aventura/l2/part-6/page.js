"use client";

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function Part6Content() {
  const searchParams = useSearchParams();
  const lang = searchParams.get('lang') || 'es';

  return (
    <div style={{ padding: '2rem' }}>
      <h1>{lang === 'es' ? 'Parte 6: El Río Secreto' : 'Part 6: The Secret River'}</h1>
      <p>{lang === 'es' ? 'Después de la tormenta, siguieron un río oculto entre las rocas...' : 'After the storm, they followed a hidden river between the rocks...'}</p>
    </div>
  );
}

export default function Part6() {
  return (
    <Suspense>
      <Part6Content />
    </Suspense>
  );
}
