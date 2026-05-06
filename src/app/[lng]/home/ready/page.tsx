// src/app/[lng]/home/ready/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Logo from "@/components/Logo";
import { usePathname, useRouter } from "next/navigation";
import type { Language } from "@/types/i18n";
import { motion } from "framer-motion";
import OnboardingProgress from "@/components/onboarding/OnboardingProgress";
import { t } from "@/lib/t";
import Link from "next/link";
import { trackCustomEventDeduped } from "@/lib/meta-pixel";

type Level = "l1" | "l2" | "l3" | "l4" | "l5";

export default function ReadyPage() {
  const pathname = usePathname();
  const typedLang = pathname.split("/")[1] as Language;
  const { data: session } = useSession();
  const router = useRouter();

  const [level, setLevel] = useState<Level>("l1");

  useEffect(() => {
    const quizLevel = (sessionStorage.getItem("quizLevel") || localStorage.getItem("level") || "l1") as Level;
    setLevel(quizLevel);
  }, []);

  const handleContinue = () => {
    router.push(`/${typedLang}/stories`);
  };

  const handleSkipAsGuest = () => {
    trackCustomEventDeduped('ContinuedAsGuest', {
      level,
      lang: typedLang,
    });
    router.push(`/${typedLang}/stories`);
  };

  const getLevelName = () => t(typedLang, "levels", level) || "Foundations";
  const getCefrLabel = () => t(typedLang, "levels", `cefrLabels.${level}`) || "A1";

  // If user is already logged in, skip the account creation prompt
  const isLoggedIn = !!session?.user;

  return (
    <motion.section
      className="min-h-screen flex flex-col bg-[url('/images/background3.png')] bg-cover bg-center text-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Progress indicator - step 3 (final) */}
      <OnboardingProgress currentStep={3} totalSteps={3} lang={typedLang} />

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
        {/* Logo */}
        <motion.div
          className="text-center mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          <Logo variant="storiesmain" />
        </motion.div>

        {/* Ready card */}
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.3 }}
        >
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg p-8 border border-white/50">
            {/* Title with inline checkmark */}
            <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center flex items-center justify-center gap-2">
              {t(typedLang, "onboarding", "allSetTitle")}
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </h1>

            {/* Level indicator */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6 text-center">
              <p className="text-sm text-gray-500 mb-1">
                {t(typedLang, "onboarding", "levelSetTo")}
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm font-bold text-indigo-600 bg-indigo-100 px-2.5 py-0.5 rounded">
                  {getCefrLabel()}
                </span>
                <span className="text-lg font-bold text-gray-900">
                  {getLevelName()}
                </span>
              </div>
            </div>

            {/* For logged in users - just show continue button */}
            {isLoggedIn ? (
              <button
                onClick={handleContinue}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3.5 px-6 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-colors shadow-md"
              >
                <span className="flex items-center justify-center gap-2">
                  {t(typedLang, "onboarding", "startReading")}
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </button>
            ) : (
              <>
                {/* Account creation prompt for non-logged-in users */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 text-center">
                    {t(typedLang, "onboarding", "createAccountTitle")}
                  </h3>
                  <ul className="space-y-2 mb-5">
                    <li className="flex items-center gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {t(typedLang, "onboarding", "createAccountBenefit1")}
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {t(typedLang, "onboarding", "createAccountBenefit2")}
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {t(typedLang, "onboarding", "createAccountBenefit3")}
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {t(typedLang, "onboarding", "createAccountBenefit4")}
                    </li>
                  </ul>

                  <Link
                    href={`/${typedLang}/auth/signup`}
                    className="block w-full text-center bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3.5 px-6 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-colors shadow-md"
                  >
                    {t(typedLang, "onboarding", "createAccountCta")}
                  </Link>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px bg-gray-200"></div>
                  <span className="text-xs text-gray-400">
                    {typedLang === "es" ? "o" : "or"}
                  </span>
                  <div className="flex-1 h-px bg-gray-200"></div>
                </div>

                {/* Skip for now option */}
                <button
                  onClick={handleSkipAsGuest}
                  className="w-full text-center text-gray-500 hover:text-gray-700 py-2 text-sm transition-colors"
                >
                  {t(typedLang, "onboarding", "skipForNow")} →
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}
