'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';

export default function QuizQuestion() {
  const router = useRouter();
  const [selectedAnswer, setSelectedAnswer] = useState(null);

  const internalLevel = 'intermediate';
  const question = 'q2';

  const flow = {
    brandnew: {
      q1: { correct: '/es/home/quiz/l2/q1', incorrect: '/es/home/quiz/l1/q2' },
      q2: { correct: '/es/home/quiz/l2/q1', incorrect: '/es/home/quiz/l1/q3' },
      q3: { correct: '/es/home/quiz/l2/q1', incorrect: '/es/home/quiz/l1/q4' },
      q4: { correct: '/es/home/quiz/l2/q1', incorrect: '/es/home/results?level=brandnew' },
    },
    beginner: {
      q1: { correct: '/es/home/quiz/l3/q1', incorrect: '/es/home/quiz/l2/q2' },
      q2: { correct: '/es/home/quiz/l3/q1', incorrect: '/es/home/quiz/l2/q3' },
      q3: { correct: '/es/home/quiz/l3/q1', incorrect: '/es/home/results?level=beginner' },
    },
    intermediate: {
      q1: { correct: '/es/home/quiz/l4/q1', incorrect: '/es/home/quiz/l3/q2' },
      q2: { correct: '/es/home/results?level=advanced', incorrect: '/es/home/results?level=intermediate' },
    },
    advanced: {
      q1: { correct: '/es/home/results?level=advanced', incorrect: '/es/home/results?level=advanced' },
    }
  };

  const getNextRoute = () => {
    const routeObj = flow[internalLevel]?.[question];
    if (!routeObj) {
      console.error('No route found for:', internalLevel, question);
      return '/es/home/results';
    }
    return selectedAnswer === 0 ? routeObj.correct : routeObj.incorrect;
  };

  const isFinalStep = flow[internalLevel]?.[question]?.correct?.includes('/results') ||
      flow[internalLevel]?.[question]?.incorrect?.includes('/results');

const handleNext = () => {
    if (selectedAnswer === null) return;

    if (selectedAnswer === 0) {
  const correct = Number(sessionStorage.getItem('correctAnswers') || 0)
  sessionStorage.setItem('correctAnswers', correct + 1)
}

    const answeredCount = Number(sessionStorage.getItem('quizProgress') || 0);
    const currentLevel = 'l3';

    const newCount = answeredCount + 1;
    sessionStorage.setItem('quizProgress', newCount);

    if (newCount >= 4) {
      router.push('/es/home/results');
      return;
    }

    const next = getNextRoute();
    router.push(next);
  };

  return (
    <section className="min-h-screen flex flex-col items-center justify-center bg-[url('/images/background3.png')] bg-cover bg-center text-black px-6">
      <div className="text-center mb-12">
        <Logo variant="quiz" />
      </div>

      <div className="bg-[#fff5eb] p-8 rounded-3xl shadow-md max-w-md text-center w-full">
        <p className="text-[24px] font-bold mb-6">Intermediate Question 2</p>

        <div className="flex flex-col gap-4">
          {['Correct', 'Incorrect', 'Incorrect', 'Incorrect'].map((option, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedAnswer(idx)}
              className={`px-6 py-2 rounded-full transition border ${selectedAnswer === idx ? 'font-bold bg-[#d3d3ff]' : 'bg-white hover:bg-gray-100'}`}
            >
              {option}
            </button>
          ))}
        </div>

        <button
          onClick={handleNext}
          className="bg-[#1000c8] text-white px-6 py-2 rounded-full hover:opacity-90 transition mt-6"
          disabled={selectedAnswer === null}
        >
          Next Question
        </button>
      </div>
    </section>
  );
}
