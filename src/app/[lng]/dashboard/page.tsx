// src/app/[lng]/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout';
import { BookOpen, MessageCircle, TrendingUp, Clock, Award, ChevronRight, Flame, FileText, Layers } from 'lucide-react';
import type { Language } from '@/types/i18n';

type Bookmark = {
  storySlug: string;
  level: string;
  chapter: number;
  page: number;
  updatedAt: string;
};

type UserStats = {
  createdAt: string;
  totalMs: number;
  readingMs: number;
  storiesCompleted: number;
  wordsRead: number;
  pagesRead: number;
  chaptersVisited: number;
  currentStreak: number;
};

export default function DashboardPage() {
  const { lng } = useParams();
  const lang = (lng as Language) || 'es';
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/user-bookmarks').then(res => res.ok ? res.json() : null),
      fetch('/api/user-stats').then(res => res.ok ? res.json() : null),
    ])
      .then(([bookmarkData, statsData]) => {
        setBookmarks(bookmarkData?.bookmarks || []);
        setStats(statsData?.wordsRead !== undefined ? statsData : null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const formatMinutes = (ms: number) => {
    const mins = Math.round(ms / 60000);
    if (mins < 1) return lang === 'es' ? '<1 min' : '<1 min';
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  };

  const formatStorySlug = (slug: string) => {
    return slug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Greeting in target language (the language user is learning, opposite of native)
  const greeting = () => {
    const hour = new Date().getHours();
    const nativeLang = session?.user?.nativeLanguage;
    // Target language is opposite of native (if native is 'en', learning Spanish; if 'es', learning English)
    const targetLang = nativeLang === 'en' ? 'es' : 'en';

    if (targetLang === 'es') {
      if (hour < 12) return 'Buenos días';
      if (hour < 18) return 'Buenas tardes';
      return 'Buenas noches';
    }
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toString();
  };

  const content = {
    en: {
      continueReading: 'Continue Reading',
      noBookmarks: 'Start reading a story to track your progress!',
      browseStories: 'Browse Stories',
      quickActions: 'Quick Actions',
      exploreStories: 'Explore Stories',
      exploreStoriesDesc: 'Discover new stories at your level',
      aiTutor: 'AI Tutor',
      aiTutorDesc: 'Practice conversation and get help',
      yourProgress: 'Your Progress',
      storiesCompleted: 'Stories Completed',
      timeReading: 'Time Reading',
      memberSince: 'Member Since',
      chapter: 'Chapter',
      page: 'Page',
      wordsRead: 'Words Read',
      currentStreak: 'Day Streak',
      chaptersVisited: 'Chapters Read',
      pagesRead: 'Pages Read',
      days: 'days',
      signInToTrack: 'To track your progress,',
      signIn: 'sign in',
      or: 'or',
      createAccount: 'create a free account',
    },
    es: {
      continueReading: 'Continuar Leyendo',
      noBookmarks: '¡Empieza a leer una historia para seguir tu progreso!',
      browseStories: 'Ver Historias',
      quickActions: 'Acciones Rápidas',
      exploreStories: 'Explorar Historias',
      exploreStoriesDesc: 'Descubre nuevas historias a tu nivel',
      aiTutor: 'Tutor IA',
      aiTutorDesc: 'Practica conversación y obtén ayuda',
      yourProgress: 'Tu Progreso',
      storiesCompleted: 'Historias Completadas',
      timeReading: 'Tiempo Leyendo',
      memberSince: 'Miembro Desde',
      chapter: 'Capítulo',
      page: 'Página',
      wordsRead: 'Palabras Leídas',
      currentStreak: 'Racha de Días',
      chaptersVisited: 'Capítulos Leídos',
      pagesRead: 'Páginas Leídas',
      days: 'días',
      signInToTrack: 'Para ver tu progreso,',
      signIn: 'inicia sesión',
      or: 'o',
      createAccount: 'crea una cuenta gratis',
    },
  };

  const t = content[lang];

  const isAuthenticated = !!session?.user;
  const sessionLoaded = sessionStatus !== 'loading';

  return (
    <AppLayout lang={lang} requireAuth={false}>
      {/* Full-screen background that extends under sidebar */}
      <div
        className="fixed inset-0 bg-cover bg-center -z-10"
        style={{ backgroundImage: "url('/images/background6.png')" }}
      />
      <div className="min-h-screen">
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        {/* Welcome Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {greeting()}{isAuthenticated ? `, ${session?.user?.name?.split(' ')[0] || 'Reader'}` : ''}!
          </h1>
          <p className="text-gray-500 mt-1">
            {lang === 'es' ? '¿Qué quieres aprender hoy?' : 'What would you like to learn today?'}
          </p>
          {/* Auth Message for unauthenticated users - only after session loads */}
          {sessionLoaded && !isAuthenticated && (
            <div className="mt-3 bg-white/90 backdrop-blur-sm rounded-xl px-4 py-3 shadow-sm inline-block">
              <p className="text-gray-700">
                {t.signInToTrack}{" "}
                <Link href={`/${lang}/auth/login`} className="text-indigo-600 hover:underline font-medium">
                  {t.signIn}
                </Link>
                {" "}{t.or}{" "}
                <Link href={`/${lang}/auth/signup`} className="text-indigo-600 hover:underline font-medium">
                  {t.createAccount}
                </Link>
              </p>
            </div>
          )}
        </div>

        {/* Stats Section - Moved to top */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            {t.yourProgress}
          </h2>

          {loading && isAuthenticated ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 animate-pulse">
                  <div className="h-8 bg-gray-200 rounded w-12 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-20" />
                </div>
              ))}
            </div>
          ) : (stats || !isAuthenticated) ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Current Streak - highlighted */}
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 shadow-sm border border-orange-200">
                <div className="flex items-center gap-2 mb-1">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <span className="text-2xl font-bold text-gray-900">{isAuthenticated ? stats?.currentStreak : '–'}</span>
                </div>
                <p className="text-sm text-gray-600">{t.currentStreak}</p>
              </div>

              {/* Words Read */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-5 h-5 text-blue-500" />
                  <span className="text-2xl font-bold text-gray-900">{isAuthenticated ? formatNumber(stats?.wordsRead || 0) : '–'}</span>
                </div>
                <p className="text-sm text-gray-500">{t.wordsRead}</p>
              </div>

              {/* Chapters Visited */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <Layers className="w-5 h-5 text-purple-500" />
                  <span className="text-2xl font-bold text-gray-900">{isAuthenticated ? stats?.chaptersVisited : '–'}</span>
                </div>
                <p className="text-sm text-gray-500">{t.chaptersVisited}</p>
              </div>

              {/* Time Reading */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-5 h-5 text-indigo-500" />
                  <span className="text-2xl font-bold text-gray-900">{isAuthenticated ? formatMinutes(stats?.readingMs || 0) : '–'}</span>
                </div>
                <p className="text-sm text-gray-500">{t.timeReading}</p>
              </div>
            </div>
          ) : null}
        </section>

        {/* Continue Reading Section */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            {t.continueReading}
          </h2>

          {loading && isAuthenticated ? (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/4" />
            </div>
          ) : !isAuthenticated ? (
            /* Placeholder stories for unauthenticated users */
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-400">–</h3>
                      <p className="text-sm text-gray-300">
                        {t.chapter} –, {t.page} – • Level –
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300" />
                  </div>
                </div>
              ))}
            </div>
          ) : bookmarks.length > 0 ? (
            <div className="space-y-3">
              {bookmarks.slice(0, 3).map((bookmark) => (
                <Link
                  key={bookmark.storySlug}
                  href={`/${lang}/stories/${bookmark.storySlug}/${bookmark.level}/${bookmark.chapter}/${bookmark.page}`}
                  className="block bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900 group-hover:text-indigo-700 transition-colors">
                        {formatStorySlug(bookmark.storySlug)}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {t.chapter} {bookmark.chapter}, {t.page} {bookmark.page} • Level {bookmark.level.toUpperCase()}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center">
              <p className="text-gray-500 mb-4">{t.noBookmarks}</p>
              <Link
                href={`/${lang}/stories`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                {t.browseStories}
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </section>

        {/* Quick Actions */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">{t.quickActions}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href={`/${lang}/stories`}
              className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-5 text-white hover:shadow-lg transition-shadow group"
            >
              <BookOpen className="w-8 h-8 mb-3 opacity-90" />
              <h3 className="font-semibold text-lg">{t.exploreStories}</h3>
              <p className="text-sm text-white/80 mt-1">{t.exploreStoriesDesc}</p>
            </Link>

            <Link
              href={`/${lang}/tutor`}
              className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-5 text-white hover:shadow-lg transition-shadow group"
            >
              <MessageCircle className="w-8 h-8 mb-3 opacity-90" />
              <h3 className="font-semibold text-lg">{t.aiTutor}</h3>
              <p className="text-sm text-white/80 mt-1">{t.aiTutorDesc}</p>
            </Link>
          </div>
        </section>
      </div>
      </div>
    </AppLayout>
  );
}
