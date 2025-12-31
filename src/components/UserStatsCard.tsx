'use client';

import { useEffect, useState } from 'react';
import { useTypedLang } from '@/hooks/useTypedLang';
import { t } from '@/lib/t';
import { Calendar, Clock, BookOpen, Trophy, Loader2 } from 'lucide-react';

type UserStats = {
  createdAt: string;
  totalMs: number;
  readingMs: number;
  storiesCompleted: number;
};

export default function UserStatsCard() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const lang = useTypedLang();

  useEffect(() => {
    fetch('/api/user-stats')
      .then((res) => res.json())
      .then(setStats)
      .catch((err) => console.error('Failed to load stats', err))
      .finally(() => setLoading(false));
  }, []);

  const formatMinutes = (ms: number) => {
    const mins = Math.round(ms / 60000);
    return mins < 1 ? t(lang, 'stats', 'lessThanOneMinute') : `${mins} ${t(lang, 'stats', 'minutes')}`;
  };

  const content = {
    en: {
      title: 'Your Stats',
      memberSince: 'Member Since',
      timeOnApp: 'Time on App',
      timeReading: 'Time Reading',
      storiesCompleted: 'Stories Completed',
    },
    es: {
      title: 'Tus Estadísticas',
      memberSince: 'Miembro Desde',
      timeOnApp: 'Tiempo en App',
      timeReading: 'Tiempo Leyendo',
      storiesCompleted: 'Historias Completadas',
    },
  };

  const txt = content[lang];

  if (loading) {
    return (
      <div className="glass-card flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="glass-card">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        {txt.title}
      </h2>

      <div className="grid grid-cols-2 gap-4">
        {/* Member Since */}
        <div className="flex items-center gap-3 p-3 bg-white/50 rounded-lg">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">{txt.memberSince}</p>
            <p className="text-sm font-semibold text-gray-900">
              {new Date(stats.createdAt).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>

        {/* Time on App */}
        <div className="flex items-center gap-3 p-3 bg-white/50 rounded-lg">
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
            <Clock className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">{txt.timeOnApp}</p>
            <p className="text-sm font-semibold text-gray-900">
              {formatMinutes(stats.totalMs)}
            </p>
          </div>
        </div>

        {/* Time Reading */}
        <div className="flex items-center gap-3 p-3 bg-white/50 rounded-lg">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">{txt.timeReading}</p>
            <p className="text-sm font-semibold text-gray-900">
              {formatMinutes(stats.readingMs)}
            </p>
          </div>
        </div>

        {/* Stories Completed */}
        <div className="flex items-center gap-3 p-3 bg-white/50 rounded-lg">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">{txt.storiesCompleted}</p>
            <p className="text-sm font-semibold text-gray-900">
              {stats.storiesCompleted}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
