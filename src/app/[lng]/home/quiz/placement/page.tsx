'use client';
import { useTypedLang } from '@/hooks/useTypedLang';
import { useQuizFlow } from '@/hooks/useQuizFlow';
import Logo from '@/components/Logo';

export default function PlacementQuiz() {
  const typedLang = useTypedLang();
  const { currentQuestion, handleAnswer } = useQuizFlow(typedLang);

  if (!currentQuestion) {
  return <p className="text-center mt-10">Loading question...</p>;
}

  return (
    <section className="min-h-screen flex flex-col items-center justify-center bg-[url('/images/background3.png')] bg-cover bg-center text-black px-6">
      <div className="text-center mb-12">
        <Logo variant="quiz" />
      </div>

      <div className="bg-[#fff5eb] p-8 rounded-3xl shadow-md max-w-md text-center w-full">
        <p className="text-[24px] font-bold mb-6">{currentQuestion.prompt}</p>

        <div className="flex flex-col gap-4">
          {currentQuestion.choices.map((choice, idx) => (
            <button
              key={idx}
              onClick={() => handleAnswer(idx)}
              className="px-6 py-2 rounded-full transition border bg-white hover:bg-gray-100"
            >
              {choice}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
