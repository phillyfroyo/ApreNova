"use client";

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function Part5Content() {
  const searchParams = useSearchParams();
  const lang = searchParams.get('lang') || 'es';

  return (
    <div style={{ padding: '2rem' }}>
      <h1>{lang === 'es' ? 'Parte 5: La Tormenta' : 'Part 5: The Storm'}</h1>
      <p>{lang === 'es' ? 'Una fuerte tormenta sorprendió al grupo en la selva...' : 'A strong storm caught the group in the jungle...'}</p>
    </div>
  );
}

export default function Part5() {
  return (
    <Suspense>
      <Part5Content />
    </Suspense>
  );
}
