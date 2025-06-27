"use client";

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function Part8Content() {
  const searchParams = useSearchParams();
  const lang = searchParams.get('lang') || 'es';

  return (
    <div style={{ padding: '2rem' }}>
      <h1>{lang === 'es' ? 'Parte 8: El Enemigo Se Revela' : 'Part 8: The Enemy Reveals Himself'}</h1>
      <p>{lang === 'es'
        ? 'Un extraño aparece en la oscuridad, afirmando ser el guardián del secreto maya...'
        : 'A stranger appears in the darkness, claiming to be the guardian of the Mayan secret...'}
      </p>
    </div>
  );
}

export default function Part8() {
  return (
    <Suspense>
      <Part8Content />
    </Suspense>
  );
}
