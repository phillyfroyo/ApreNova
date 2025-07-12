// /src/hooks/useQuizFlow.ts

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { quizL1_en } from '@/content/quiz/l1.en';
import { quizL1_es } from '@/content/quiz/l1.es';
import { quizL2_en } from '@/content/quiz/l2.en';
import { quizL2_es } from '@/content/quiz/l2.es';
import { quizL3_en } from '@/content/quiz/l3.en';
import { quizL3_es } from '@/content/quiz/l3.es';

type QuizQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
};

type QuizLevel = 'l1' | 'l2' | 'l3';

const getQuizSet = (lang: string) => ({
  l1: lang === 'es' ? quizL1_es : quizL1_en,
  l2: lang === 'es' ? quizL2_es : quizL2_en,
  l3: lang === 'es' ? quizL3_es : quizL3_en,
});

export function useQuizFlow(typedLang: string) {
  const router = useRouter();
  const [currentLevel, setCurrentLevel] = useState<QuizLevel>('l1');
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);

  const quizSets = getQuizSet(typedLang);

  useEffect(() => {
    // On mount: reset state
    sessionStorage.setItem('quizProgress', '0');
    sessionStorage.setItem('correctAnswers', '0');
    sessionStorage.setItem('l2Correct', '0');
    sessionStorage.setItem('usedQuestionIds', JSON.stringify([]));
    loadNewQuestion('l1');
  }, []);

  const loadNewQuestion = (level: QuizLevel) => {
    const used = JSON.parse(sessionStorage.getItem('usedQuestionIds') || '[]');
    const pool = quizSets[level].filter(q => !used.includes(q.id));

    if (pool.length === 0) {
      console.warn(`No available questions left for ${level}`);
      return;
    }

    const next = pool[Math.floor(Math.random() * pool.length)];
    const updated = [...used, next.id];
    sessionStorage.setItem('usedQuestionIds', JSON.stringify(updated));

    setCurrentQuestion(next);
  };

  const handleAnswer = (selectedIdx: number) => {
    if (!currentQuestion) return;

    const isCorrect = selectedIdx === currentQuestion.correctIndex;

    // Update score
    if (isCorrect) {
      const newCorrect = correctAnswers + 1;
      setCorrectAnswers(newCorrect);
      sessionStorage.setItem('correctAnswers', newCorrect.toString());
    }

    // Update question count
    const totalAnswered = Number(sessionStorage.getItem('quizProgress') || '0') + 1;
    sessionStorage.setItem('quizProgress', totalAnswered.toString());

    // Level progression logic
    if (isCorrect) {
      if (currentLevel === 'l1') {
        setCurrentLevel('l2');
        loadNewQuestion('l2');
        return;
      }

      if (currentLevel === 'l2') {
        const l2Correct = Number(sessionStorage.getItem('l2Correct') || '0') + 1;
        sessionStorage.setItem('l2Correct', l2Correct.toString());

        if (l2Correct >= 2) {
          setCurrentLevel('l3');
          loadNewQuestion('l3');
          return;
        }
      }

      if (currentLevel === 'l3') {
        sessionStorage.setItem('quizLevel', 'l4');
      }
    }

    // If incorrect, stay in current level and load a new question
    loadNewQuestion(currentLevel);

    // After 4 total questions, route to results
    if (totalAnswered >= 4) {
      const finalLevel =
        sessionStorage.getItem('quizLevel') ||
        (correctAnswers === 0 ? 'l1' : correctAnswers <= 2 ? 'l2' : 'l3');

      sessionStorage.setItem('quizLevel', finalLevel);
      router.push(`/${typedLang}/home/results`);
    }
  };

  return { currentQuestion, handleAnswer };
}
