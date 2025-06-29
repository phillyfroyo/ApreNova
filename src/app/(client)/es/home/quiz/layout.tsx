// src/app/es/home/quiz/layout.tsx
import type { ReactNode } from 'react';
import Logo from '@/components/Logo';

export default function QuizLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[url('/images/background3.png')] bg-cover bg-center text-black">
      {children}
    </main>
  );
}