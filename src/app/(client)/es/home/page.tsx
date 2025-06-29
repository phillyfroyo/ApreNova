// src/app/es/home/page.tsx
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Logo from '@/components/Logo';

export default function QuizWelcomeES() {
  return (
    <motion.section
      layout
      className="min-h-screen flex flex-col items-center justify-center bg-[url('/images/background3.png')] bg-cover bg-center text-black px-6"
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Logo and subtitle */}
      <div className="text-center mb-12">
        <Logo variant="soft" />
        <p className="mt-4 text-[18px] font-[Alice]">
          Aprende más rápido. Aprende con historias.
        </p>
      </div>

      {/* Quiz / No Thanks Buttons */}
      <div className="flex flex-col md:flex-row items-center gap-10">
        {/* Quiz Option */}
        <div className="bg-[#fff5eb] p-8 rounded-3xl shadow-md max-w-xs text-center relative">
          <p className="text-[24px] font-bold mb-2">Haz el Quiz</p>
          <p className="text-[14px] mb-2">(recomendado)</p>
          <p className="mb-4">Déjanos determinar tu nivel</p>
          <Link href="/es/home/quiz/l1/q1">
            <button className="bg-[#1000c8] text-white px-6 py-2 rounded-full hover:opacity-90 transition">
              Empezar Quiz
            </button>
          </Link>
        </div>

        {/* No Gracias Option */}
        <div className="bg-[#fff5eb] p-8 rounded-3xl shadow-md max-w-xs text-center relative">
          <p className="text-[24px] font-bold mb-2">No Gracias</p>
          <p className="mb-4">Puedes elegir tu nivel después</p>
          <Link href="/es/stories">
            <button className="bg-[#1000c8] text-white px-6 py-2 rounded-full hover:opacity-90 transition">
              Comenzar Aprendizaje
            </button>
          </Link>
        </div>
      </div>

      {/* Sign-in link */}
      <p className="mt-6 text-[14px] font-['Open_Sans']">
        <span className="text-black">¿Ya tienes una cuenta? </span>
        <a href="/es/auth/login" className="text-[#1000c8] hover:underline">
          Inicia sesión
        </a>
      </p>

      {/* Why ApreNova Heading */}
      <h2 className="mt-12 text-[28px] font-[Alice] text-black text-center">
        ¿Por qué <span className="text-[#5ce1e6]">Apre</span>
        <span className="text-[#5100a2]">Nova</span>?
      </h2>

      {/* Placeholder Info Section */}
      <p className="mt-4 text-center text-[16px] font-[Open_Sans]">
        Put your additional information here 🚀
      </p>
    </motion.section>
  );
}
