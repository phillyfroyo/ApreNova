// /src/hooks/useQuizFlow.ts

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { quizL1_en, quizL1_es } from '@/content/quiz/l1';
import { quizL2_en, quizL2_es } from '@/content/quiz/l2';
import { quizL3_en, quizL3_es } from '@/content/quiz/l3';
import { quizL4_en, quizL4_es } from '@/content/quiz/l4';
import { quizL5_en, quizL5_es } from '@/content/quiz/l5';

type QuizQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
};

// Quiz levels map to CEFR: l1=A1, l2=A2, l3=B1, l4=B2, l5=C1
type QuizLevel = 'l1' | 'l2' | 'l3' | 'l4' | 'l5';

// Question sets based on user's native language (route language)
// /en route = English speakers learning Spanish → English prompts (_en)
// /es route = Spanish speakers learning English → Spanish prompts (_es)
const QUIZ_QUESTIONS_EN: Record<QuizLevel, QuizQuestion[]> = {
  l1: quizL1_en,
  l2: quizL2_en,
  l3: quizL3_en,
  l4: quizL4_en,
  l5: quizL5_en,
};

const QUIZ_QUESTIONS_ES: Record<QuizLevel, QuizQuestion[]> = {
  l1: quizL1_es,
  l2: quizL2_es,
  l3: quizL3_es,
  l4: quizL4_es,
  l5: quizL5_es,
};

const LEVEL_ORDER: QuizLevel[] = ['l1', 'l2', 'l3', 'l4', 'l5'];
const MAX_QUESTIONS = 5; // One question per level

type AssignedLevel = 'l1' | 'l2' | 'l3' | 'l4' | 'l5';

export function useQuizFlow(typedLang: string) {
  const router = useRouter();
  const [currentLevel, setCurrentLevel] = useState<QuizLevel>('l1');
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [usedQuestionIds, setUsedQuestionIds] = useState<string[]>([]);
  const [highestLevelPassed, setHighestLevelPassed] = useState<QuizLevel | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  // Select question set based on user's native language (the route language)
  // /en route = English speakers learning Spanish → English prompts (_en)
  // /es route = Spanish speakers learning English → Spanish prompts (_es)
  const quizQuestions = useMemo(() => {
    return typedLang === 'en' ? QUIZ_QUESTIONS_EN : QUIZ_QUESTIONS_ES;
  }, [typedLang]);

  // Load a question from the specified level
  const loadQuestion = useCallback((level: QuizLevel, usedIds: string[]) => {
    const pool = quizQuestions[level].filter(q => !usedIds.includes(q.id));

    if (pool.length === 0) {
      // If we've exhausted questions at this level, try to use any unused question
      const allUnused = quizQuestions[level].filter(q => !usedIds.includes(q.id));
      if (allUnused.length > 0) {
        return allUnused[Math.floor(Math.random() * allUnused.length)];
      }
      // Fallback: reuse a question (shouldn't happen with 6 questions per level and max 4 total)
      return quizQuestions[level][Math.floor(Math.random() * quizQuestions[level].length)];
    }

    return pool[Math.floor(Math.random() * pool.length)];
  }, [quizQuestions]);

  // Initialize quiz on mount
  useEffect(() => {
    const firstQuestion = loadQuestion('l1', []);
    setCurrentQuestion(firstQuestion);
    setUsedQuestionIds([firstQuestion.id]);
    setQuestionCount(1);

    // Clear any previous quiz state
    sessionStorage.removeItem('quizLevel');
    sessionStorage.setItem('quizProgress', '1');
  }, [loadQuestion]);

  // Calculate final level based on highest level passed
  // Assign the same level as the highest they passed (not one above)
  // This ensures they demonstrated ability at that level during the quiz
  const calculateFinalLevel = useCallback((highest: QuizLevel | null): AssignedLevel => {
    if (highest === null) {
      // Got everything wrong - assign L1
      return 'l1';
    }

    // Assign the level they demonstrated
    // If they passed L3 questions, they're B1 (L3)
    // If they passed L2 questions, they're A2 (L2)
    // If they only passed L1, they're A1 (L1)
    return highest;
  }, []);

  // Complete the quiz and navigate to results
  const completeQuiz = useCallback((highest: QuizLevel | null) => {
    const finalLevel = calculateFinalLevel(highest);
    sessionStorage.setItem('quizLevel', finalLevel);
    localStorage.setItem('level', finalLevel);
    setIsComplete(true);
    router.push(`/${typedLang}/home/results`);
  }, [calculateFinalLevel, router, typedLang]);

  const handleAnswer = useCallback((selectedIdx: number) => {
    if (!currentQuestion || isComplete) return;

    const isCorrect = selectedIdx === currentQuestion.correctIndex;
    const newQuestionCount = questionCount + 1;

    // Determine next state based on answer
    let nextLevel = currentLevel;
    let newHighestPassed = highestLevelPassed;

    if (isCorrect) {
      // Update highest level passed
      const currentLevelIndex = LEVEL_ORDER.indexOf(currentLevel);
      const highestIndex = highestLevelPassed ? LEVEL_ORDER.indexOf(highestLevelPassed) : -1;

      if (currentLevelIndex > highestIndex) {
        newHighestPassed = currentLevel;
        setHighestLevelPassed(currentLevel);
      }

      // Move to next level if not at max
      const nextLevelIndex = currentLevelIndex + 1;
      if (nextLevelIndex < LEVEL_ORDER.length) {
        nextLevel = LEVEL_ORDER[nextLevelIndex];
      }
      // If already at L5 (C1) and got it right, stay at L5
    }
    // If incorrect, stay at current level (nextLevel unchanged)

    // Check if quiz is complete BEFORE loading next question
    if (newQuestionCount > MAX_QUESTIONS) {
      completeQuiz(newHighestPassed);
      return;
    }

    // Load next question
    const newUsedIds = [...usedQuestionIds, currentQuestion.id];
    const nextQuestion = loadQuestion(nextLevel, newUsedIds);

    setCurrentLevel(nextLevel);
    setCurrentQuestion(nextQuestion);
    setUsedQuestionIds([...newUsedIds, nextQuestion.id]);
    setQuestionCount(newQuestionCount);
    sessionStorage.setItem('quizProgress', newQuestionCount.toString());
  }, [
    currentQuestion,
    currentLevel,
    questionCount,
    highestLevelPassed,
    usedQuestionIds,
    isComplete,
    loadQuestion,
    completeQuiz
  ]);

  return { currentQuestion, handleAnswer, questionCount };
}
