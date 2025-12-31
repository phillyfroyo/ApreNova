// src/components/Flashcard.tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { QUALITY_RATINGS, type QualityRating, formatInterval, getIntervalPreview } from '@/lib/sm2';

interface FlashcardProps {
  word: string;
  translation: string;
  direction: 'es-en' | 'en-es';
  sourceSentence?: string | null;
  easeFactor: number;
  interval: number;
  repetitions: number;
  onRate: (quality: number) => void;
  lang?: 'en' | 'es';
}

const ratingLabels = {
  en: {
    AGAIN: 'Again',
    HARD: 'Hard',
    GOOD: 'Good',
    EASY: 'Easy',
  },
  es: {
    AGAIN: 'Otra vez',
    HARD: 'Difícil',
    GOOD: 'Bien',
    EASY: 'Fácil',
  },
};

const ratingColors = {
  AGAIN: 'bg-red-500 hover:bg-red-600',
  HARD: 'bg-amber-500 hover:bg-amber-600',
  GOOD: 'bg-green-500 hover:bg-green-600',
  EASY: 'bg-blue-500 hover:bg-blue-600',
};

export default function Flashcard({
  word,
  translation,
  direction,
  sourceSentence,
  easeFactor,
  interval,
  repetitions,
  onRate,
  lang = 'es',
}: FlashcardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const labels = ratingLabels[lang];

  // What shows on front vs back depends on direction
  const front = direction === 'es-en' ? word : translation;
  const back = direction === 'es-en' ? translation : word;
  const frontLabel = direction === 'es-en' ? 'ES' : 'EN';
  const backLabel = direction === 'es-en' ? 'EN' : 'ES';

  // Get interval previews for each rating
  const previews = getIntervalPreview({ repetitions, easeFactor, interval });

  const handleRate = (rating: QualityRating) => {
    onRate(QUALITY_RATINGS[rating]);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Card */}
      <div
        className="relative h-64 cursor-pointer perspective-1000"
        onClick={() => !isFlipped && setIsFlipped(true)}
      >
        <motion.div
          className="w-full h-full"
          initial={false}
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 bg-white rounded-2xl shadow-lg border border-gray-200 p-6 flex flex-col items-center justify-center backface-hidden"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <span className="absolute top-3 left-3 text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
              {frontLabel}
            </span>
            <p className="text-3xl font-bold text-gray-900 text-center">{front}</p>
            {sourceSentence && !isFlipped && (
              <p className="text-sm text-gray-400 text-center mt-4 line-clamp-2">
                {sourceSentence}
              </p>
            )}
            <p className="absolute bottom-4 text-sm text-gray-400">
              {lang === 'es' ? 'Toca para ver' : 'Tap to reveal'}
            </p>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl shadow-lg border border-indigo-200 p-6 flex flex-col items-center justify-center backface-hidden"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <span className="absolute top-3 left-3 text-xs font-medium text-indigo-500 bg-indigo-100 px-2 py-0.5 rounded">
              {backLabel}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsFlipped(false);
              }}
              className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-lg transition-colors"
              title={lang === 'es' ? 'Voltear' : 'Flip back'}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <p className="text-3xl font-bold text-indigo-900 text-center">{back}</p>
          </div>
        </motion.div>
      </div>

      {/* Rating Buttons - only show when flipped */}
      <AnimatePresence>
        {isFlipped && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="mt-6 grid grid-cols-4 gap-2"
          >
            {(['AGAIN', 'HARD', 'GOOD', 'EASY'] as QualityRating[]).map((rating) => (
              <button
                key={rating}
                onClick={() => handleRate(rating)}
                className={`${ratingColors[rating]} text-white py-3 px-2 rounded-xl font-medium transition-colors flex flex-col items-center gap-1`}
              >
                <span className="text-sm">{labels[rating]}</span>
                <span className="text-xs opacity-75">{formatInterval(previews[rating], lang)}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
