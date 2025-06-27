"use client";

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function Part10Content() {
  const searchParams = useSearchParams();
  const lang = searchParams.get('lang') || 'es';

  return (
    <div style={{ padding: '2rem' }}>
      <h1>{lang === 'es' ? 'Parte 10: El Comienzo de Algo Nuevo' : 'Part 10: The Start of Something New'}</h1>
      <p>{lang === 'es'
        ? 'Con el secreto a salvo y el amor entre Pedro y Ana creciendo, una nueva aventura comienza.'
        : 'With the secret safe and the love between Pedro and Ana growing, a new adventure begins.'}
      </p>
    </div>
  );
}

export default function Part10() {
  return (
    <Suspense>
      <Part10Content />
    </Suspense>
  );
}
