// src/app/[lng]/vocabulary/review/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Loader2, CheckCircle, XCircle, Trophy } from 'lucide-react';
import Flashcard from '@/components/Flashcard';
import type { Language } from '@/types/i18n';

type SavedWord = {
  id: string;
  word: string;
  translation: string;
  sourceSentence: string | null;
  translatedSentence: string | null;
  easeFactor: number;
  interval: number;
  repetitions: number;
  stability: number;
  enrichedData?: any;
};

type ReviewResult = {
  wordId: string;
  quality: number;
  direction: 'es-en' | 'en-es';
};

const content = {
  en: {
    loading: 'Loading cards...',
    noCards: 'No cards due for review!',
    noCardsDesc: 'Come back later or save more words while reading.',
    backToVocab: 'Back to Vocabulary',
    card: 'Card',
    of: 'of',
    reviewComplete: 'Review Complete!',
    cardsReviewed: 'cards reviewed',
    greatJob: 'Great job! Keep learning.',
    correct: 'Correct',
    needsWork: 'Needs Work',
  },
  es: {
    loading: 'Cargando tarjetas...',
    noCards: 'No hay tarjetas para repasar',
    noCardsDesc: 'Vuelve más tarde o guarda más palabras mientras lees.',
    backToVocab: 'Volver a Vocabulario',
    card: 'Tarjeta',
    of: 'de',
    reviewComplete: 'Repaso Completado',
    cardsReviewed: 'tarjetas repasadas',
    greatJob: 'Buen trabajo. Sigue aprendiendo.',
    correct: 'Correctas',
    needsWork: 'Para Practicar',
  },
};

export default function VocabularyReviewPage() {
  const { lng } = useParams();
  const lang = (lng as Language) || 'es';
  const t = content[lang] || content.es;
  const { status } = useSession();
  const router = useRouter();

  const [cards, setCards] = useState<SavedWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<ReviewResult[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/${lang}/auth/login`);
      return;
    }

    if (status === 'authenticated') {
      fetch('/api/saved-words?due=true&limit=20')
        .then(res => res.json())
        .then(data => {
          setCards(data.words || []);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [status, router, lang]);

  const currentCard = cards[currentIndex];

  // Randomly choose direction for each card
  const getDirection = (index: number): 'es-en' | 'en-es' => {
    // Use card ID to make direction consistent for same card
    const hash = cards[index]?.id.charCodeAt(0) || 0;
    return hash % 2 === 0 ? 'es-en' : 'en-es';
  };

  const handleRate = async (quality: number) => {
    if (!currentCard || submitting) return;

    const direction = getDirection(currentIndex);
    setSubmitting(true);

    try {
      await fetch('/api/saved-words/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          savedWordId: currentCard.id,
          quality,
          direction,
        }),
      });

      setResults(prev => [...prev, { wordId: currentCard.id, quality, direction }]);

      if (currentIndex < cards.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setIsComplete(true);
      }
    } catch (error) {
      console.error('Error submitting review:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate stats
  const correctCount = results.filter(r => r.quality >= 2).length;
  const needsWorkCount = results.filter(r => r.quality < 2).length;

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="fixed inset-0 bg-cover bg-center -z-10" style={{ backgroundImage: "url('/images/background6.png')" }} />
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-500">{t.loading}</p>
        </div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-cover bg-center -z-10" style={{ backgroundImage: "url('/images/background6.png')" }} />
        <div className="fixed inset-0 bg-cover bg-center -z-10" style={{ backgroundImage: "url('/images/background6.png')" }} />
        <div className="text-center max-w-md">
          <Trophy className="w-16 h-16 text-amber-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t.noCards}</h1>
          <p className="text-gray-500 mb-6">{t.noCardsDesc}</p>
          <button
            onClick={() => router.push(`/${lang}/vocabulary`)}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t.backToVocab}
          </button>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center max-w-md"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
          >
            <Trophy className="w-20 h-20 text-amber-400 mx-auto mb-6" />
          </motion.div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t.reviewComplete}</h1>
          <p className="text-gray-500 mb-6">{t.greatJob}</p>

          <div className="flex justify-center gap-8 mb-8">
            <div className="text-center">
              <div className="flex items-center gap-2 text-green-600 mb-1">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">{t.correct}</span>
              </div>
              <p className="text-3xl font-bold text-green-600">{correctCount}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-2 text-amber-600 mb-1">
                <XCircle className="w-5 h-5" />
                <span className="font-medium">{t.needsWork}</span>
              </div>
              <p className="text-3xl font-bold text-amber-600">{needsWorkCount}</p>
            </div>
          </div>

          <p className="text-sm text-gray-400 mb-6">
            {results.length} {t.cardsReviewed}
          </p>

          <button
            onClick={() => router.push(`/${lang}/vocabulary`)}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t.backToVocab}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent p-4">
      <div className="fixed inset-0 bg-cover bg-center -z-10" style={{ backgroundImage: "url('/images/background6.png')" }} />
      {/* Header */}
      <div className="max-w-md mx-auto mb-8">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => router.push(`/${lang}/vocabulary`)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-gray-500">
            {t.card} {currentIndex + 1} {t.of} {cards.length}
          </span>
          <div className="w-9" /> {/* Spacer for centering */}
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-indigo-600"
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex) / cards.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentCard.id}
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -50, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Flashcard
            word={currentCard.word}
            translation={currentCard.translation}
            direction={getDirection(currentIndex)}
            sourceSentence={currentCard.sourceSentence}
            translatedSentence={currentCard.translatedSentence}
            easeFactor={currentCard.easeFactor}
            interval={currentCard.interval}
            repetitions={currentCard.repetitions}
            stability={currentCard.stability}
            enrichedData={currentCard.enrichedData}
            onRate={handleRate}
            lang={lang}
          />
        </motion.div>
      </AnimatePresence>

      {/* Loading overlay during submission */}
      {submitting && (
        <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      )}
    </div>
  );
}
