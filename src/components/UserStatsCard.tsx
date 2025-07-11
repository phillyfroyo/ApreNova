'use client';

import { useEffect, useState } from 'react';
import { useTypedLang } from '@/hooks/useTypedLang';
import { t } from '@/lib/t';

type UserStats = {
  createdAt: string;
  totalMs: number;
  readingMs: number;
  storiesCompleted: number;
};

export default function UserStatsCard() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const lang = useTypedLang();

  useEffect(() => {
    fetch('/api/user-stats')
      .then((res) => res.json())
      .then(setStats)
      .catch((err) => console.error('Failed to load stats', err));
  }, []);

  if (!stats) return (
    <div className="text-sm text-gray-600">
      {t(lang, 'stats', 'loading')}
    </div>
  );

  const formatMinutes = (ms: number) => {
    const mins = Math.round(ms / 60000);
    return mins < 1 ? t(lang, 'stats', 'lessThanOneMinute') : `${mins} ${t(lang, 'stats', 'minutes')}`;
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow text-black max-w-sm">
      <h2 className="text-xl font-semibold mb-2">📊 {t(lang, 'stats', 'title')}</h2>
      <p>🗓️ {t(lang, 'stats', 'memberSince')}: {new Date(stats.createdAt).toLocaleDateString()}</p>
      <p>⏱️ {t(lang, 'stats', 'timeOnApp')}: {formatMinutes(stats.totalMs)}</p>
      <p>📖 {t(lang, 'stats', 'timeReading')}: {formatMinutes(stats.readingMs)}</p>
      <p>🏁 {t(lang, 'stats', 'storiesCompleted')}: {stats.storiesCompleted}</p>
    </div>
  );
}
