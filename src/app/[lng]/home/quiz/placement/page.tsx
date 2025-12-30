// src/app/[lng]/home/quiz/placement/page.tsx
'use client';

import { useTypedLang } from '@/hooks/useTypedLang';
import { useQuizFlow } from '@/hooks/useQuizFlow';
import Logo from '@/components/Logo';
import { motion, AnimatePresence } from 'framer-motion';
import OnboardingProgress from '@/components/onboarding/OnboardingProgress';
import { t } from '@/lib/t';
import { useState } from 'react';

export default function PlacementQuiz() {
  const typedLang = useTypedLang();
  const { currentQuestion, handleAnswer, questionCount } = useQuizFlow(typedLang);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const onAnswerClick = (idx: number) => {
    if (isAnimating) return;

    setSelectedAnswer(idx);
    setIsAnimating(true);

    // Brief delay for visual feedback before transitioning
    setTimeout(() => {
      handleAnswer(idx);
      setSelectedAnswer(null);
      setIsAnimating(false);
    }, 300);
  };

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[url('/images/background3.png')] bg-cover bg-center">
        <div className="animate-pulse text-gray-600">Loading...</div>
      </div>
    );
  }

  const progressText = t(typedLang, 'onboarding', 'quizProgress' as any)
    ?.replace('{current}', questionCount.toString())
    ?.replace('{total}', '5') || `Question ${questionCount} of 5`;

  return (
    <motion.section
      className="min-h-screen flex flex-col bg-[url('/images/background3.png')] bg-cover bg-center text-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Progress indicator */}
      <OnboardingProgress currentStep={2} totalSteps={3} lang={typedLang} />

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
        {/* Logo */}
        <motion.div
          className="text-center mb-6"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <Logo variant="storiesmain" />
        </motion.div>

        {/* Quiz card */}
        <motion.div
          className="w-full max-w-lg"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg p-8 border border-white/50">
            {/* Question progress */}
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm font-medium text-gray-500">
                {progressText}
              </span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((num) => (
                  <div
                    key={num}
                    className={`w-6 h-1 rounded-full transition-colors ${
                      num <= questionCount
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-500'
                        : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Question */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestion.id}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">
                  {currentQuestion.prompt}
                </h2>

                {/* Answer choices */}
                <div className="flex flex-col gap-3">
                  {currentQuestion.choices.map((choice, idx) => (
                    <motion.button
                      key={idx}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => onAnswerClick(idx)}
                      disabled={isAnimating}
                      className={`
                        w-full px-5 py-4 rounded-xl text-left transition-all
                        border-2 font-medium
                        ${selectedAnswer === idx
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 bg-white hover:border-indigo-200 hover:bg-gray-50 text-gray-700'
                        }
                        ${isAnimating ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}
                      `}
                    >
                      <span className="flex items-center gap-3">
                        <span className={`
                          w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold
                          ${selectedAnswer === idx
                            ? 'bg-indigo-500 text-white'
                            : 'bg-gray-100 text-gray-500'
                          }
                        `}>
                          {String.fromCharCode(65 + idx)}
                        </span>
                        {choice}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Skip quiz option */}
          <motion.div
            className="text-center mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <a
              href={`/${typedLang}/home`}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              {t(typedLang, 'onboarding', 'knowYourLevel' as any)} →
            </a>
          </motion.div>
        </motion.div>
      </div>
    </motion.section>
  );
}
