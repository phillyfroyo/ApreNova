'use client';
import { useEffect, useState } from 'react';

export default function ResultsPage() {
  const [levelLabel, setLevelLabel] = useState('');

  useEffect(() => {
    // Read stored level (defaults to l1 if empty or invalid)
    const storedLevel = sessionStorage.getItem('quizLevel') || 'l1';

    // Map to user-friendly label
    const levelMap = {
      l1: 'Brand New',
      l2: 'Beginner',
      l3: 'Intermediate',
      l4: 'Advanced',
    };

    const label = levelMap[storedLevel] || 'Brand New';
    setLevelLabel(label);
  }, []);

  return (
    <section className="min-h-screen flex flex-col items-center justify-center bg-[url('/images/background3.png')] bg-cover bg-center text-black px-6">
      <div className="text-center bg-[#fff5eb] p-10 rounded-3xl shadow-md max-w-md w-full">
        <h1 className="text-[40px] font-bold mb-4 font-[Alice] text-[#5100a2]">Your Level</h1>
        <p className="text-[28px] font-bold mb-8">{levelLabel}</p>
        <p className="text-lg text-gray-700 mb-4">Based on your answers, this is your current level.</p>
        <button
          className="bg-[#1000c8] text-white px-6 py-2 rounded-full hover:opacity-90 transition mt-6"
          onClick={() => {
            sessionStorage.removeItem('quizProgress');
            sessionStorage.removeItem('quizLevel');
            window.location.href = '/es'; // or /es/home or restart path
          }}
        >
          Go to Homepage
        </button>
      </div>
    </section>
  );
}
