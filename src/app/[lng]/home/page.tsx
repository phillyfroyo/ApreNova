// src/app/[lng]/home/page.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { useRouter } from "next/navigation";
import { useTypedLang } from "@/hooks/useTypedLang";
import { t } from '@/lib/t';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import OnboardingProgress from '@/components/onboarding/OnboardingProgress';

type Level = 'l1' | 'l2' | 'l3' | 'l4' | 'l5';

const LEVELS: Level[] = ['l1', 'l2', 'l3', 'l4', 'l5'];

// Example sentences at each level — same concept, increasing complexity
const LEVEL_EXAMPLES: Record<Level, { es: string; en: string }> = {
  l1: {
    es: "Él dibujaba cuando era niño. Ahora es adulto. Ya no dibuja.",
    en: "He drew when he was a child. Now he is an adult. He doesn't draw anymore.",
  },
  l2: {
    es: "De niño solía dibujar, pero luego dejó de hacerlo. Ya lleva muchos años sin dibujar.",
    en: "He used to draw when he was a child, but then he stopped. He hasn't drawn now for many years.",
  },
  l3: {
    es: "De repente se dio cuenta de que llevaba años sin dibujar nada. La última vez que realmente se sentó a dibujar algo fue cuando era niño. Había pasado tanto tiempo que casi se había olvidado.",
    en: "He suddenly realized that he hadn't drawn anything in years. The last time he really sat down and drew something was when he was a kid. It had been such a long time that he had almost forgotten about it.",
  },
  l4: {
    es: "Le sorprendió darse cuenta de que no había cogido un lápiz para dibujar desde la infancia. En algún momento, entre crecer y seguir adelante con la vida, simplemente había dejado de hacerlo — y ni siquiera se había dado cuenta hasta ahora.",
    en: "It struck him that he hadn't so much as picked up a pencil to draw since childhood. Somewhere along the way, between growing up and getting on with life, he'd simply stopped — and hadn't even noticed until now.",
  },
  l5: {
    es: "Cayó en la cuenta, casi de pasada, de que no había hecho un solo dibujo desde que era niño. La revelación traía consigo un peso silencioso, como la pérdida de un viejo amor — de algún modo, toda una forma de expresión se había escurrido de su vida sin que él llegara a registrar su ausencia.",
    en: "It dawned on him, almost as an afterthought, that he hadn't produced a single drawing since he was a child. The realization carried a quiet weight, like the loss of an old love — somehow an entire form of expression had slipped out of his life without him ever registering its absence.",
  },
};

export default function OnboardingHome() {
  const typedLang = useTypedLang();
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<Level | null>(null);
  const [exampleOpen, setExampleOpen] = useState<Level | null>(null);
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

  // Handle level selection (Step 2)
  const handleLevelSelect = async (level: Level) => {
    setSelectedLevel(level);

    // Store in localStorage and sessionStorage for consistency
    localStorage.setItem('level', level);
    sessionStorage.setItem('quizLevel', level);

    // If user is logged in, save to database and refresh session
    if (session?.user?.id) {
      try {
        await fetch('/api/user-level', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: session.user.id, level }),
        });
        // Refresh JWT so session.user.quizLevel reflects the new level
        await updateSession();
      } catch (error) {
        console.error('Failed to save level:', error);
      }
    }

    // Navigate to confirmation page (not directly to stories)
    router.push(`/${typedLang}/home/ready`);
  };

  // Step 2: Level Selection
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
      <div ref={menuRef} className="fixed bottom-4 left-4 text-sm z-50">
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
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={{ duration: 0.15 }}
              className="mb-2 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-44 absolute bottom-full left-0"
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
          {/* Level selection prompt */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg p-6 mb-6 border border-white/50">
            <h2 className="text-xl font-bold text-gray-900 text-center">
              {t(typedLang, "onboarding", "selectYourLevel" as any) || (typedLang === "es" ? "Selecciona tu nivel" : "Select your level")}
            </h2>
            <p className="text-gray-600 text-sm mt-1 text-center">
              {typedLang === "es"
                ? "Puedes cambiarlo en cualquier momento en ajustes"
                : "You can change this anytime in settings"}
            </p>
          </div>

          {/* Level selection - single column, full width */}
          <div className="space-y-3">
            {LEVELS.map((level) => {
              const displayName = t(typedLang, "levels", level) || "";
              const isExampleOpen = exampleOpen === level;
              const example = LEVEL_EXAMPLES[level];
              // Show target language first (the one user is learning)
              const primaryText = typedLang === "en" ? example.es : example.en;
              const secondaryText = typedLang === "en" ? example.en : example.es;
              return (
                <div
                  key={level}
                  className="w-full bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl text-left hover:border-indigo-300 hover:bg-white transition-colors group"
                >
                  {/* Main card area — clicking selects the level */}
                  <button
                    onClick={() => handleLevelSelect(level)}
                    className="w-full p-5 text-left"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm font-bold text-indigo-600 bg-indigo-100 px-2.5 py-0.5 rounded">
                        {t(typedLang, "levels", `cefrLabels.${level}`)}
                      </span>
                      <h3 className="font-semibold text-base text-gray-900 group-hover:text-indigo-700 transition-colors">
                        {displayName}
                      </h3>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {t(typedLang, "levels", `cefrDescriptions.${level}`)}
                    </p>
                  </button>

                  {/* Example toggle — separate click target, does NOT select level */}
                  <div className="px-5 pb-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExampleOpen(isExampleOpen ? null : level);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-500 hover:text-indigo-700 transition-colors py-1 px-2 -ml-2 rounded-md hover:bg-indigo-50"
                    >
                      <svg className={`w-3.5 h-3.5 transition-transform ${isExampleOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      {typedLang === "es" ? "Ver ejemplo" : "See example"}
                    </button>

                    {isExampleOpen && (
                      <div className="mt-2 bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <p className="text-sm text-gray-800 italic leading-relaxed">
                          &ldquo;{primaryText}&rdquo;
                        </p>
                        <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                          &ldquo;{secondaryText}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
            <Logo variant="classic" size="text-[14px]" plain />
          </Link>
        </motion.div>
      </div>
    </motion.section>
  );
}
