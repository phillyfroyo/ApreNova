"use client";

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function Part9Content() {
  const searchParams = useSearchParams();
  const lang = searchParams.get('lang') || 'es';

  return (
    <div style={{ padding: '2rem' }}>
      <h1>{lang === 'es' ? 'Parte 9: La Decisión' : 'Part 9: The Decision'}</h1>
      <p>{lang === 'es'
        ? 'Pedro debe decidir entre confiar en el guardián o seguir su instinto y proteger a Ana por su cuenta.'
        : 'Pedro must decide whether to trust the guardian or follow his instinct and protect Ana on his own.'}
      </p>
    </div>
  );
}

export default function Part9() {
  return (
    <Suspense>
      <Part9Content />
    </Suspense>
  );
}
