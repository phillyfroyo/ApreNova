// src/app/[lng]/vocabulary/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AppLayout } from '@/components/layout';
import { BookMarked, Play, Trash2, Loader2, BookOpen, GraduationCap, Brain, Calendar } from 'lucide-react';
import type { Language } from '@/types/i18n';
import { formatInterval } from '@/lib/sm2';

type SavedWord = {
  id: string;
  word: string;
  translation: string;
  sourceSentence: string | null;
  storySlug: string | null;
  easeFactor: number;
  interval: number;
  repetitions: number;
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
    today: 'Today',
    tomorrow: 'Tomorrow',
    overdue: 'Overdue',
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
    today: 'Hoy',
    tomorrow: 'Mañana',
    overdue: 'Atrasado',
  },
};

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

  const getReviewStatus = (nextReviewDate: string) => {
    const now = new Date();
    const review = new Date(nextReviewDate);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const reviewDay = new Date(review.getFullYear(), review.getMonth(), review.getDate());

    if (reviewDay < today) return { label: t.overdue, className: 'text-red-600 bg-red-50' };
    if (reviewDay.getTime() === today.getTime()) return { label: t.today, className: 'text-amber-600 bg-amber-50' };
    if (reviewDay.getTime() === tomorrow.getTime()) return { label: t.tomorrow, className: 'text-blue-600 bg-blue-50' };

    const days = Math.ceil((reviewDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return { label: formatInterval(days, lang), className: 'text-gray-600 bg-gray-50' };
  };

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
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BookMarked className="w-8 h-8 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
          </div>

          {stats && stats.dueToday > 0 && (
            <button
              onClick={() => router.push(`/${lang}/vocabulary/review`)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 p-4 bg-gray-50 border-b border-gray-100 text-sm font-medium text-gray-500">
              <div>{t.word}</div>
              <div>{t.translation}</div>
              <div className="text-center">{t.nextReview}</div>
              <div></div>
            </div>
            <div className="divide-y divide-gray-100">
              {words.map((word) => {
                const reviewStatus = getReviewStatus(word.nextReviewDate);
                return (
                  <div
                    key={word.id}
                    className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 p-4 items-center hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{word.word}</p>
                      {word.sourceSentence && (
                        <p className="text-xs text-gray-400 truncate mt-0.5" title={word.sourceSentence}>
                          {word.sourceSentence}
                        </p>
                      )}
                    </div>
                    <p className="text-gray-600">{word.translation}</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${reviewStatus.className}`}>
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
        )}
      </div>
    </AppLayout>
  );
}
