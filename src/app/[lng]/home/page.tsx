// src/app/[lng]/home/page.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { useParams, useRouter } from "next/navigation";
import type { Language } from "@/types/i18n";
import { useTypedLang } from "@/hooks/useTypedLang";
import { t } from '@/lib/t';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import OnboardingProgress from '@/components/onboarding/OnboardingProgress';

type Level = 'l1' | 'l2' | 'l3' | 'l4' | 'l5';

const LEVELS: Level[] = ['l1', 'l2', 'l3', 'l4', 'l5'];

export default function QuizWelcome() {
  const { lng } = useParams();
  const typedLang = useTypedLang();
  const router = useRouter();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<Level | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  const handleLevelSelect = async (level: Level) => {
    setSelectedLevel(level);

    // Store in localStorage and sessionStorage for consistency
    localStorage.setItem('level', level);
    sessionStorage.setItem('quizLevel', level);

    // If user is logged in, save to database
    if (session?.user?.id) {
      try {
        await fetch('/api/user-level', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: session.user.id, level }),
        });
      } catch (error) {
        console.error('Failed to save level:', error);
      }
    }

    // Navigate to confirmation page (not directly to stories)
    router.push(`/${typedLang}/home/ready`);
  };

  const handleStartQuiz = () => {
    router.push(`/${typedLang}/home/quiz/placement`);
  };

  return (
    <motion.section
      className="min-h-screen flex flex-col bg-[url('/images/background3.png')] bg-cover bg-center text-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Progress indicator */}
      <OnboardingProgress currentStep={2} totalSteps={3} lang={typedLang} />

      {/* Avatar Menu for Unauthenticated Users */}
      <div ref={menuRef} className="absolute top-4 right-4 text-sm z-50">
        <div
          className="cursor-pointer rounded-full overflow-hidden w-8 h-8 border-2 border-white/50 shadow-sm"
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          <Image
            src={session?.user?.image || "/images/default-avatar.png"}
            alt="Account"
            width={100}
            height={100}
            style={{ objectFit: 'cover' }}
          />
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
              className="mt-2 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-44 absolute right-0"
            >
              {session?.user ? (
                <div className="text-sm text-gray-600 mb-2 truncate">
                  {session.user.email}
                </div>
              ) : (
                <>
                  <Link
                    href={`/${typedLang}/auth/login`}
                    className="block text-blue-800 hover:text-blue-900 py-1.5"
                  >
                    {t(typedLang, "auth", "login")}
                  </Link>
                  <Link
                    href={`/${typedLang}/auth/signup`}
                    className="block text-blue-800 hover:text-blue-900 py-1.5"
                  >
                    {t(typedLang, "stories", "createAccount")}
                  </Link>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8 pt-20">
        {/* Logo and subtitle */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          <Logo variant="soft" />
          <p className="mt-3 text-lg font-[Alice] text-gray-700">
            {t(typedLang, "onboarding", "welcomeSubtitle")}
          </p>
        </motion.div>

        {/* Main card */}
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.3 }}
        >
          {/* Quiz option - prominent */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg p-6 mb-6 border border-white/50">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900">
                  {t(typedLang, "onboarding", "findYourLevel")}
                </h2>
                <p className="text-gray-600 text-sm mt-1">
                  {t(typedLang, "onboarding", "findYourLevelDesc")}
                </p>
              </div>
            </div>

            <button
              onClick={handleStartQuiz}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3.5 px-6 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-colors shadow-md"
            >
              <span className="flex items-center justify-center gap-2">
                {t(typedLang, "home", "startQuiz")}
                <span className="text-white/80 text-sm font-normal">
                  ({t(typedLang, "onboarding", "quizDuration")})
                </span>
              </span>
            </button>
          </div>

          {/* Divider with "or" */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-gray-300"></div>
            <span className="text-gray-500 text-sm font-medium">
              {t(typedLang, "onboarding", "knowYourLevel")}
            </span>
            <div className="flex-1 h-px bg-gray-300"></div>
          </div>

          {/* Level selection grid - 2x2 for first 4, then 1 below */}
          <div className="grid grid-cols-2 gap-3">
            {LEVELS.slice(0, 4).map((level) => (
              <button
                key={level}
                onClick={() => handleLevelSelect(level)}
                className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl p-4 text-left hover:border-indigo-300 hover:bg-white transition-colors group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded">
                    {t(typedLang, "levels", `cefrLabels.${level}`)}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
                  {t(typedLang, "levels", level)}
                </h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                  {t(typedLang, "levels", `cefrDescriptions.${level}`)}
                </p>
              </button>
            ))}
          </div>

          {/* Level 5 (C1) - full width at bottom */}
          <button
            onClick={() => handleLevelSelect('l5')}
            className="w-full mt-3 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl p-4 text-left hover:border-indigo-300 hover:bg-white transition-colors group"
          >
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded">
                {t(typedLang, "levels", "cefrLabels.l5")}
              </span>
              <h3 className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
                {t(typedLang, "levels", "l5")}
              </h3>
              <span className="text-xs text-gray-500">
                {t(typedLang, "levels", "cefrDescriptions.l5")}
              </span>
            </div>
          </button>
        </motion.div>

        {/* About link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.3 }}
          className="mt-8"
        >
          <Link
            href={`/${typedLang}/about`}
            className="text-sm text-gray-600 hover:text-gray-900 inline-flex items-center gap-1 transition-colors"
          >
            <span>{t(typedLang, "home", "aboutPrefix")}</span>
            <Logo variant="classic" size="text-[14px]" />
          </Link>
        </motion.div>
      </div>
    </motion.section>
  );
}
