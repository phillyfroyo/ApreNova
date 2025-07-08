'use client';

import { useEffect, useState } from 'react';

type UserStats = {
  createdAt: string;
  totalMs: number;
  readingMs: number;
  storiesCompleted: number;
};

export default function UserStatsCard() {
  const [stats, setStats] = useState<UserStats | null>(null);

  useEffect(() => {
    fetch('/api/user-stats')
      .then((res) => res.json())
      .then(setStats)
      .catch((err) => console.error('Failed to load stats', err));
  }, []);

  if (!stats) return <div>Loading your stats...</div>;

  const formatMinutes = (ms: number) => {
    const mins = Math.round(ms / 60000);
    return mins < 1 ? '< 1 min' : `${mins} min`;
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow text-black max-w-sm">
      <h2 className="text-xl font-semibold mb-2">📊 Your Stats</h2>
      <p>🗓️ Member since: {new Date(stats.createdAt).toLocaleDateString()}</p>
      <p>⏱️ Time on app: {formatMinutes(stats.totalMs)}</p>
      <p>📖 Time reading: {formatMinutes(stats.readingMs)}</p>
      <p>🏁 Stories completed: {stats.storiesCompleted}</p>
    </div>
  );
}
