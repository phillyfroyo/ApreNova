'use client';

import { useEffect, useState, type ReactNode } from 'react';

type Lang = 'es' | 'en';

const COPY: Record<
  Lang,
  {
    headline: (cap: number) => ReactNode;
    liveCount: (n: number) => string;
    full: string;
  }
> = {
  es: {
    // Each half is nowrap; the <wbr> between them is the only legal break point.
    // Result: one line on wide screens, clean break at GRATIS on narrow.
    headline: (cap) => (
      <>
        <span className="whitespace-nowrap">Cuentana es GRATIS</span>
        <wbr />{' '}
        <span className="whitespace-nowrap">
          para los primeros {cap.toLocaleString('es-MX')} usuarios.
        </span>
      </>
    ),
    liveCount: (n) => `Usuarios en vivo: ${n.toLocaleString('es-MX')}`,
    full: 'Los cupos gratuitos se han agotado.',
  },
  en: {
    headline: (cap) => (
      <>
        <span className="whitespace-nowrap">Cuentana is FREE</span>
        <wbr />{' '}
        <span className="whitespace-nowrap">
          for the first {cap.toLocaleString('en-US')} users.
        </span>
      </>
    ),
    liveCount: (n) => `Live user count: ${n.toLocaleString('en-US')}`,
    full: 'Free spots have all been claimed.',
  },
};

export default function SpotsRemaining({ lang }: { lang: Lang }) {
  const [stats, setStats] = useState<{ userCount: number; cap: number } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch('/api/landing-stats')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setStats(data))
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;

  if (!stats) {
    // Skeleton — two short lines, matches final layout to avoid shift.
    return (
      <div className="flex flex-col items-center gap-1.5">
        <div className="h-3 w-64 bg-gray-200/60 rounded animate-pulse" />
        <div className="h-3 w-32 bg-gray-200/60 rounded animate-pulse" />
      </div>
    );
  }

  const { userCount, cap } = stats;
  const isFull = userCount >= cap;
  const copy = COPY[lang];

  if (isFull) {
    return (
      <p className="text-xs text-gray-600 text-center leading-snug">{copy.full}</p>
    );
  }

  return (
    <div className="text-center leading-snug">
      <p className="text-sm text-gray-800 font-medium">{copy.headline(cap)}</p>
      <p className="text-xs text-gray-600 mt-0.5">{copy.liveCount(userCount)}</p>
    </div>
  );
}
