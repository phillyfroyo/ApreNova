// src/components/onboarding/OnboardingProgress.tsx
'use client';

import { motion } from 'framer-motion';
import type { Language } from '@/types/i18n';
import { t } from '@/lib/t';

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
  lang: Language;
}

const STEP_KEYS = ['stepLanguage', 'stepLevel', 'stepStart'] as const;

export default function OnboardingProgress({
  currentStep,
  totalSteps,
  lang,
}: OnboardingProgressProps) {
  return (
    <div className="w-full px-4 sm:px-6 pt-4 pb-2">
      <div className="max-w-xs sm:max-w-md mx-auto">
        {/* Step indicators */}
        <div className="flex justify-between mb-3">
          {STEP_KEYS.slice(0, totalSteps).map((stepKey, index) => {
            const stepNumber = index + 1;
            const isCompleted = stepNumber < currentStep;
            const isCurrent = stepNumber === currentStep;

            return (
              <div
                key={stepKey}
                className="flex flex-col items-center"
              >
                {/* Step circle */}
                <div
                  className={`
                    w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-semibold
                    transition-colors duration-300
                    ${isCompleted
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white'
                      : isCurrent
                        ? 'bg-white border-2 border-indigo-500 text-indigo-600 shadow-sm'
                        : 'bg-gray-100 text-gray-400 border border-gray-200'
                    }
                  `}
                >
                  {isCompleted ? (
                    <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    stepNumber
                  )}
                </div>

                {/* Step label */}
                <span
                  className={`
                    text-[10px] sm:text-xs mt-1 sm:mt-1.5 font-medium transition-colors duration-300
                    ${isCurrent ? 'text-indigo-600' : isCompleted ? 'text-gray-600' : 'text-gray-400'}
                  `}
                >
                  {t(lang, 'onboarding', stepKey as any)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress bar - now below the steps */}
        <div className="h-1 bg-gray-200/60 rounded-full overflow-hidden backdrop-blur-sm">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(currentStep / totalSteps) * 100}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
      </div>
    </div>
  );
}
