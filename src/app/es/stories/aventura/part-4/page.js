"use client";

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function Part4Content() {
  const searchParams = useSearchParams();
  const lang = searchParams.get('lang') || 'es';

  return (
    <div style={{ padding: '2rem' }}>
      <h1>{lang === 'es' ? 'Parte 4: El Desafío' : 'Part 4: The Challenge'}</h1>
      <p>{lang === 'es' ? 'Pedro y Ana tuvieron que cruzar un río peligroso...' : 'Pedro and Ana had to cross a dangerous river...'}</p>
    </div>
  );
}

export default function Part4() {
  return (
    <Suspense>
      <Part4Content />
    </Suspense>
  );
}
