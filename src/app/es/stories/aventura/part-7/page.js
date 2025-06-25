"use client";

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function Part7Content() {
  const searchParams = useSearchParams();
  const lang = searchParams.get('lang') || 'es';

  return (
    <div style={{ padding: '2rem' }}>
      <h1>{lang === 'es' ? 'Parte 7: La Cueva de los Secretos' : 'Part 7: The Cave of Secrets'}</h1>
      <p>{lang === 'es' ? 'Dentro de la cueva, los amigos descubren antiguos símbolos en las paredes...' : 'Inside the cave, the friends discover ancient symbols on the walls...'}</p>
    </div>
  );
}

export default function Part7() {
  return (
    <Suspense>
      <Part7Content />
    </Suspense>
  );
}
