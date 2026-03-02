// src/app/[lng]/home/results/page.tsx
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

type Level = "l1" | "l2" | "l3" | "l4";

export default function ResultsPage() {
  const pathname = usePathname();
  const typedLang = pathname.split("/")[1] as Language;

  const { data: session, update: updateSession } = useSession();
  const router = useRouter();

  const [level, setLevel] = useState<Level>("l1");
  const [showConfetti, setShowConfetti] = useState(false);
  const [sessionSynced, setSessionSynced] = useState(false);

  useEffect(() => {
    const quizLevel = (sessionStorage.getItem("quizLevel") || "l1") as Level;
    setLevel(quizLevel);
    setShowConfetti(true);

    localStorage.setItem("level", quizLevel);

    if (session?.user?.id && !sessionSynced) {
      fetch("/api/user-level", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id, level: quizLevel }),
      })
        .then(async (res) => {
          if (res.ok) {
            await updateSession();
          }
        })
        .catch((err) => {
          console.error("Failed to save quiz level:", err);
        })
        .finally(() => {
          setSessionSynced(true);
        });
    } else if (!session?.user?.id) {
      // Not logged in — no session to sync
      setSessionSynced(true);
    }
  }, [session?.user?.id, updateSession, sessionSynced]);

  const handleContinue = () => {
    router.push(`/${typedLang}/stories`);
  };

  const getLevelName = () => t(typedLang, "levels", level) || "Foundations";
  const getCefrLabel = () => t(typedLang, "levels", `cefrLabels.${level}`) || "A1";
  const getCefrDescription = () => t(typedLang, "levels", `cefrDescriptions.${level}`) || "";

  // Check if user is logged in
  const isLoggedIn = !!session?.user;

  return (
    <motion.section
      className="min-h-screen flex flex-col bg-[url('/images/background3.png')] bg-cover bg-center text-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Progress indicator - step 3 (final) */}
      <OnboardingProgress currentStep={3} totalSteps={3} lang={typedLang} />

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
        {/* Logo */}
        <motion.div
          className="text-center mb-8"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <Logo variant="storiesmain" />
        </motion.div>

        {/* Results card */}
        <motion.div
          className="w-full max-w-md"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5, type: "spring" }}
        >
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg p-8 border border-white/50 text-center">
            {/* Success icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center"
            >
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </motion.div>

            {/* Result title */}
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
              {t(typedLang, "onboarding", "yourResult" as any)}
            </p>

            {/* Level display */}
            <div className="mb-6">
              <div className="inline-flex items-center gap-3 mb-2">
                <span className="text-sm font-bold text-indigo-600 bg-indigo-100 px-3 py-1 rounded-full">
                  {getCefrLabel()}
                </span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                {getLevelName()}
              </h1>
              <div className="bg-gray-50 rounded-xl p-4 text-left">
                <p className="text-sm text-gray-600 leading-relaxed">
                  {getCefrDescription()}
                </p>
              </div>
            </div>

            {/* For logged in users - just show continue button */}
            {isLoggedIn ? (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleContinue}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 px-6 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg"
              >
                <span className="flex items-center justify-center gap-2">
                  {t(typedLang, "onboarding", "startReading" as any)}
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </motion.button>
            ) : (
              <>
                {/* Account creation prompt for non-logged-in users */}
                <div className="mb-6 text-left">
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
                  onClick={handleContinue}
                  className="w-full text-center text-gray-500 hover:text-gray-700 py-2 text-sm transition-colors"
                >
                  {t(typedLang, "onboarding", "skipForNow")} →
                </button>
              </>
            )}
          </div>

          {/* Change level option */}
          <motion.p
            className="text-center mt-6 text-sm text-gray-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {typedLang === "es" ? "¿No es tu nivel?" : "Not your level?"}{" "}
            <a
              href={`/${typedLang}/home`}
              className="text-indigo-600 hover:text-indigo-800 font-medium"
            >
              {typedLang === "es" ? "Cambiar" : "Change"}
            </a>
          </motion.p>
        </motion.div>
      </div>
    </motion.section>
  );
}
