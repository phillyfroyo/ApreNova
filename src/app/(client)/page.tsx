// src/app/(client)/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Logo from "@/components/Logo";
import { motion } from "framer-motion";
import OnboardingProgress from "@/components/onboarding/OnboardingProgress";

type PreferredLanguage = 'es' | 'en';

function detectBrowserLanguage(): PreferredLanguage {
  if (typeof window === 'undefined') return 'es';

  // Get browser language(s)
  const browserLang = navigator.language || (navigator as any).userLanguage || '';
  const browserLangs = navigator.languages || [browserLang];

  // Check if any browser language starts with 'en'
  const prefersEnglish = browserLangs.some(lang =>
    lang.toLowerCase().startsWith('en')
  );

  // Default to Spanish unless browser clearly prefers English
  return prefersEnglish ? 'en' : 'es';
}

export default function LanguageSelectPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [preferredLang, setPreferredLang] = useState<PreferredLanguage>('es');

  // Detect browser language on mount
  useEffect(() => {
    setPreferredLang(detectBrowserLanguage());
  }, []);

  // If logged in, send to their nativeLanguage
  useEffect(() => {
    if (status === 'authenticated' && session) {
      const lng = session.user?.nativeLanguage;
      if (lng === 'en' || lng === 'es') {
        router.replace(`/${lng}/stories`);
      } else {
        router.replace('/es/stories');
      }
    }
  }, [session, status, router]);

  const handleLanguageSelect = (lang: 'en' | 'es') => {
    router.push(`/${lang}/home`);
  };

  // Dynamic content based on detected language preference
  const content = {
    es: {
      question: "¿Cuál es tu lengua materna?",
      questionSecondary: "What is your native language?",
      loginText: "¿Ya tienes una cuenta? Inicia sesión",
      tagline: "Aprende más rápido. Aprende con historias.",
    },
    en: {
      question: "What is your native language?",
      questionSecondary: "¿Cuál es tu lengua materna?",
      loginText: "Already have an account? Log in",
      tagline: "Learn faster. Learn with stories.",
    },
  };

  // These are always in the native language of the button
  const buttonContent = {
    spanish: {
      label: "Español",
      desc: "Quiero aprender inglés",
    },
    english: {
      label: "English",
      desc: "I want to learn Spanish",
    },
  };

  const t = content[preferredLang];

  return (
    <motion.section
      className="min-h-screen flex flex-col bg-[url('/images/background3.png')] bg-cover bg-center text-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Progress indicator */}
      <OnboardingProgress currentStep={1} totalSteps={3} lang={preferredLang} />

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
        {/* Welcome card */}
        <motion.div
          className="w-full max-w-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          {/* Logo */}
          <div className="text-center mb-8">
            <Logo variant="classic" />
          </div>

          {/* Main selection card */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg p-8 border border-white/50">
            {/* Question - primary language first */}
            <h1 className="text-xl font-bold text-center text-gray-900 mb-2">
              {t.question}
            </h1>
            <p className="text-center text-gray-500 text-sm mb-6">
              {t.questionSecondary}
            </p>

            {/* Language buttons - order based on preference */}
            <div className="space-y-3">
              {preferredLang === 'es' ? (
                <>
                  {/* Spanish first when Spanish is preferred */}
                  <button
                    onClick={() => handleLanguageSelect('es')}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 via-yellow-400 to-red-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                      ES
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
                        {buttonContent.spanish.label}
                      </p>
                      <p className="text-xs text-gray-500">
                        {buttonContent.spanish.desc}
                      </p>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  <button
                    onClick={() => handleLanguageSelect('en')}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 via-white to-red-500 flex items-center justify-center text-blue-800 font-bold text-sm shadow-sm">
                      EN
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
                        {buttonContent.english.label}
                      </p>
                      <p className="text-xs text-gray-500">
                        {buttonContent.english.desc}
                      </p>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              ) : (
                <>
                  {/* English first when English is preferred */}
                  <button
                    onClick={() => handleLanguageSelect('en')}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 via-white to-red-500 flex items-center justify-center text-blue-800 font-bold text-sm shadow-sm">
                      EN
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
                        {buttonContent.english.label}
                      </p>
                      <p className="text-xs text-gray-500">
                        {buttonContent.english.desc}
                      </p>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  <button
                    onClick={() => handleLanguageSelect('es')}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 via-yellow-400 to-red-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                      ES
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
                        {buttonContent.spanish.label}
                      </p>
                      <p className="text-xs text-gray-500">
                        {buttonContent.spanish.desc}
                      </p>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              )}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-gray-200"></div>
              <span className="text-xs text-gray-400">{preferredLang === 'es' ? 'o' : 'or'}</span>
              <div className="flex-1 h-px bg-gray-200"></div>
            </div>

            {/* Login link */}
            <div className="text-center">
              <a
                href={`/${preferredLang}/auth/login`}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
              >
                {t.loginText}
              </a>
            </div>
          </div>

          {/* Tagline below card */}
          <p className="text-center text-sm text-gray-600 mt-6 font-[Alice]">
            {t.tagline}
          </p>
        </motion.div>
      </div>
    </motion.section>
  );
}
