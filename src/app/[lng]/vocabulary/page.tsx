// src/app/[lng]/vocabulary/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AppLayout } from '@/components/layout';
import { BookMarked, Play, Trash2, Loader2, BookOpen, GraduationCap, Brain, Calendar } from 'lucide-react';
import type { Language } from '@/types/i18n';
import { useCallback } from 'react';

type SavedWord = {
  id: string;
  word: string;
  translation: string;
  sourceSentence: string | null;
  storySlug: string | null;
  easeFactor: number;
  interval: number;
  repetitions: number;
  stability: number;
  nextReviewDate: string;
  createdAt: string;
};

type VocabStats = {
  totalSaved: number;
  dueToday: number;
  newCount: number;
  learningCount: number;
  masteredCount: number;
  reviewsToday: number;
};

const content = {
  en: {
    title: 'My Vocabulary',
    startReview: 'Start Review',
    dueForReview: 'due for review',
    noWordsSaved: 'No words saved yet',
    noWordsSavedDesc: 'Save words while reading stories by clicking the bookmark icon after selecting and translating a word.',
    word: 'Word',
    translation: 'Translation',
    nextReview: 'Next Review',
    delete: 'Delete',
    confirmDelete: 'Remove this word?',
    stats: {
      total: 'Total Saved',
      new: 'New',
      learning: 'Learning',
      mastered: 'Mastered',
    },
    overdue: 'Overdue',
    now: 'Now',
    minutes: (n: number) => `${n} minute${n === 1 ? '' : 's'}`,
    hours: (n: number) => `${n} hour${n === 1 ? '' : 's'}`,
    tomorrow: 'Tomorrow',
    days: (n: number) => `${n} day${n === 1 ? '' : 's'}`,
    weeks: (n: number) => `${n} week${n === 1 ? '' : 's'}`,
    months: (n: number) => `${n} month${n === 1 ? '' : 's'}`,
  },
  es: {
    title: 'Mi Vocabulario',
    startReview: 'Empezar Repaso',
    dueForReview: 'para repasar',
    noWordsSaved: 'No hay palabras guardadas',
    noWordsSavedDesc: 'Guarda palabras mientras lees historias haciendo clic en el icono de marcador después de seleccionar y traducir una palabra.',
    word: 'Palabra',
    translation: 'Traducción',
    nextReview: 'Próximo Repaso',
    delete: 'Eliminar',
    confirmDelete: '¿Eliminar esta palabra?',
    stats: {
      total: 'Total Guardadas',
      new: 'Nuevas',
      learning: 'Aprendiendo',
      mastered: 'Dominadas',
    },
    overdue: 'Atrasado',
    now: 'Ahora',
    minutes: (n: number) => `${n} minuto${n === 1 ? '' : 's'}`,
    hours: (n: number) => `${n} hora${n === 1 ? '' : 's'}`,
    tomorrow: 'Mañana',
    days: (n: number) => `${n} día${n === 1 ? '' : 's'}`,
    weeks: (n: number) => `${n} semana${n === 1 ? '' : 's'}`,
    months: (n: number) => `${n} mes${n === 1 ? '' : 'es'}`,
  },
};

/**
 * Extract just the sentence containing the target word from a longer passage.
 * Splits on sentence-ending punctuation (.!?), finds the matching sentence,
 * and caps at maxLen characters with ellipsis as a safety net.
 */
function extractSentence(text: string, word: string, maxLen = 80): string {
  // Split on sentence boundaries, keeping the delimiter attached
  const sentences = text.match(/[^.!?]*[.!?]+/g) || [text];
  const wordLower = word.toLowerCase();
  const match = sentences.find(s => s.toLowerCase().includes(wordLower));
  const sentence = (match || sentences[0]).trim();
  if (sentence.length <= maxLen) return sentence;
  return sentence.slice(0, maxLen).trimEnd() + '...';
}

export default function VocabularyPage() {
  const { lng } = useParams();
  const lang = (lng as Language) || 'es';
  const t = content[lang] || content.es;
  const { data: session, status } = useSession();
  const router = useRouter();

  const [words, setWords] = useState<SavedWord[]>([]);
  const [stats, setStats] = useState<VocabStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/${lang}/auth/login`);
      return;
    }

    if (status === 'authenticated') {
      Promise.all([
        fetch('/api/saved-words').then(res => res.json()),
        fetch('/api/saved-words/stats').then(res => res.json()),
      ])
        .then(([wordsData, statsData]) => {
          setWords(wordsData.words || []);
          setStats(statsData);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [status, router, lang]);

  // Re-render every 60s so time-based badges stay current
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm(t.confirmDelete)) return;

    setDeleting(id);
    try {
      const res = await fetch(`/api/saved-words?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setWords(prev => prev.filter(w => w.id !== id));
        // Update stats
        if (stats) {
          setStats({ ...stats, totalSaved: stats.totalSaved - 1 });
        }
      }
    } catch (error) {
      console.error('Error deleting word:', error);
    } finally {
      setDeleting(null);
    }
  };

  const getReviewStatus = useCallback((nextReviewDate: string) => {
    const now = new Date();
    const review = new Date(nextReviewDate);
    const diffMs = review.getTime() - now.getTime();

    // Overdue or due now
    if (diffMs <= 0) {
      return { label: t.overdue, className: 'text-red-600 bg-red-50 border border-red-200' };
    }

    const diffMinutes = Math.round(diffMs / 60_000);
    const diffHours = Math.round(diffMs / 3_600_000);
    const diffDays = Math.ceil(diffMs / 86_400_000);

    // Within 1 hour → show minutes
    if (diffMinutes < 60) {
      return { label: t.minutes(diffMinutes), className: 'text-orange-600 bg-orange-50 border border-orange-200' };
    }

    // Within 24 hours → show hours
    if (diffHours < 24) {
      return { label: t.hours(diffHours), className: 'text-amber-600 bg-amber-50 border border-amber-200' };
    }

    // Tomorrow (24-48h)
    if (diffDays <= 2) {
      return { label: t.tomorrow, className: 'text-blue-600 bg-blue-50 border border-blue-200' };
    }

    // Days (up to 2 weeks)
    if (diffDays < 14) {
      return { label: t.days(diffDays), className: 'text-sky-600 bg-sky-50 border border-sky-200' };
    }

    // Weeks (up to ~2 months)
    if (diffDays < 60) {
      const weeks = Math.round(diffDays / 7);
      return { label: t.weeks(weeks), className: 'text-violet-600 bg-violet-50 border border-violet-200' };
    }

    // Months
    const months = Math.round(diffDays / 30);
    return { label: t.months(months), className: 'text-emerald-600 bg-emerald-50 border border-emerald-200' };
  }, [t]);

  if (status === 'loading' || loading) {
    return (
      <AppLayout lang={lang}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout lang={lang}>
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage: "url('/images/background3.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          zIndex: -1,
        }}
      />
      <div className="relative max-w-4xl mx-auto px-4 py-6">
        {/* Header — stacked on mobile, inline on desktop */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <BookMarked className="w-8 h-8 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
          </div>

          {stats && stats.dueToday > 0 && (
            <button
              onClick={() => router.push(`/${lang}/vocabulary/review`)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors w-full md:w-auto justify-center"
            >
              <Play className="w-4 h-4" />
              <span>{t.startReview}</span>
              <span className="bg-white/20 px-2 py-0.5 rounded text-sm">
                {stats.dueToday}
              </span>
            </button>
          )}
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <BookOpen className="w-4 h-4" />
                <span className="text-sm">{t.stats.total}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalSaved}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 text-blue-500 mb-1">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">{t.stats.new}</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{stats.newCount}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 text-amber-500 mb-1">
                <Brain className="w-4 h-4" />
                <span className="text-sm">{t.stats.learning}</span>
              </div>
              <p className="text-2xl font-bold text-amber-600">{stats.learningCount}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 text-green-500 mb-1">
                <GraduationCap className="w-4 h-4" />
                <span className="text-sm">{t.stats.mastered}</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{stats.masteredCount}</p>
            </div>
          </div>
        )}

        {/* Word List */}
        {words.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
            <BookMarked className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t.noWordsSaved}</h3>
            <p className="text-gray-500 max-w-md mx-auto">{t.noWordsSavedDesc}</p>
          </div>
        ) : (
          <>
          {/* Mobile: stacked cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {words.map((word) => {
              const reviewStatus = getReviewStatus(word.nextReviewDate);
              const snippet = word.sourceSentence
                ? extractSentence(word.sourceSentence, word.word)
                : null;
              return (
                <div
                  key={word.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-4"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-semibold text-gray-900 text-lg">{word.word}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${reviewStatus.className}`}>
                        {reviewStatus.label}
                      </span>
                      <button
                        onClick={() => handleDelete(word.id)}
                        disabled={deleting === word.id}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title={t.delete}
                      >
                        {deleting === word.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-600 mb-1">{word.translation}</p>
                  {snippet && (
                    <p className="text-xs text-gray-400 break-words line-clamp-2" title={word.sourceSentence!}>
                      {snippet}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop: table layout */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(6rem,auto)_2.5rem] gap-4 p-4 bg-gray-50 border-b border-gray-100 text-sm font-medium text-gray-500">
              <div>{t.word}</div>
              <div>{t.translation}</div>
              <div className="text-center">{t.nextReview}</div>
              <div></div>
            </div>
            <div className="divide-y divide-gray-100">
              {words.map((word) => {
                const reviewStatus = getReviewStatus(word.nextReviewDate);
                const snippet = word.sourceSentence
                  ? extractSentence(word.sourceSentence, word.word)
                  : null;
                return (
                  <div
                    key={word.id}
                    className="grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(6rem,auto)_2.5rem] gap-4 p-4 items-center hover:bg-gray-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 break-words">{word.word}</p>
                      {snippet && (
                        <p className="text-xs text-gray-400 mt-0.5 break-words line-clamp-2" title={word.sourceSentence!}>
                          {snippet}
                        </p>
                      )}
                    </div>
                    <p className="text-gray-600 min-w-0 break-words">{word.translation}</p>
                    <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap text-center ${reviewStatus.className}`}>
                      {reviewStatus.label}
                    </span>
                    <button
                      onClick={() => handleDelete(word.id)}
                      disabled={deleting === word.id}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title={t.delete}
                    >
                      {deleting === word.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
