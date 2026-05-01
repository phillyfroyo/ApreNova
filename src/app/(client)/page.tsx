// src/app/(client)/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Logo from "@/components/Logo";
import { motion } from "framer-motion";
import OnboardingProgress from "@/components/onboarding/OnboardingProgress";
import { updateNativeLanguage } from "@/lib/updateLanguage";

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

  // If logged in AND has completed onboarding (has quizLevel), send to dashboard
  // Otherwise, let them go through onboarding
  useEffect(() => {
    if (status === 'authenticated' && session) {
      const hasCompletedOnboarding = !!session.user?.quizLevel;

      if (hasCompletedOnboarding) {
        const lng = session.user?.nativeLanguage;
        if (lng === 'en' || lng === 'es') {
          router.replace(`/${lng}/dashboard`);
        } else {
          router.replace('/es/dashboard');
        }
      }
      // If not completed onboarding, stay on this page to select language
    }
  }, [session, status, router]);

  const handleLanguageSelect = (lang: 'en' | 'es') => {
    // If authenticated, update native language in DB
    if (status === 'authenticated') {
      updateNativeLanguage(lang);
    }
    router.push(`/${lang}/home`);
  };

  // Dynamic content based on detected language preference
  const content = {
    es: {
      question: "¿Cuál es tu lengua materna?",
      questionSecondary: "What is your native language?",
      loginText: "¿Ya tienes una cuenta? Inicia sesión",
      tagline: "Aprende idiomas con historias.",
      heroPromise:
        "Lee lo que quieras, a tu nivel, en el idioma que estás aprendiendo — y aprende de ello.",
      // Hero / demo video caption
      videoCaption: "Mira cómo funciona",
      // Section 2 — CEFR
      cefrHeadline: "¿Cansado de leer al nivel equivocado?",
      cefrBody:
        "Los libros para niños pueden ser poco interesantes para adultos. La novela que en verdad quieres leer es demasiado difícil. Así que dejas de leer. Reescribimos cualquier historia para tu nivel CEFR — de A1 a C1 — sin perder la trama.",
      cefrLabelA: "A1 — principiante",
      cefrLabelB: "B2 — intermedio",
      // Section 3 — Upload
      uploadHeadline: "¿No ves lo que quieres leer? Súbelo.",
      uploadBody:
        "Pega un artículo. Sube un PDF. Sube un capítulo de tu novela favorita. Lo reescribiremos a tu nivel, lo traduciremos línea por línea, y lo convertiremos en un lector con audio en menos de un minuto.",
      uploadCaption: "De pegar a leer en menos de un minuto",
      // Section 4 — Audio
      audioHeadline: "Entrena tu oído con audiolibros completos a tu nivel.",
      audioBody:
        "Cada historia se reproduce como un audiolibro real — narrado, sincronizado por oración, con palabras resaltadas mientras se hablan. Escucha en el camino. Lee al mismo tiempo. Pausa para buscar una palabra.",
      audioCaption: "El Mago de Oz, Nivel A1 (Principiante) — narración lenta",
      // Section 5 — Vocab
      vocabHeadline:
        "Las palabras que guardas regresan justo antes de que las olvides.",
      vocabBody:
        "Esto es repetición espaciada — la forma comprobada para fijar el vocabulario. Cada palabra que guardas vuelve en el momento correcto, ni antes ni después.",
      vocabCaption: "Repasa en menos de un minuto al día",
      // Founder section
      founderHeadline: "El discurso del fundador, desde un pesero en CDMX",
      founderBody:
        "Así fue como conseguí los primeros 94 usuarios — subiéndome a peseros con micrófono en mano. Si me viste, gracias por estar aquí.",
      // Section 6 — Final CTA
      finalHeadline: "¿Listo para leer lo que en verdad quieres?",
      finalBody: "Gratis para empezar. Elige tu nivel. Toca una palabra. Eso es todo.",
      finalCta: "Empieza gratis",
      // Footer
      footerMade: "Hecho en CDMX",
      footerPrivacy: "Privacidad",
      footerTerms: "Términos",
      footerAbout: "Acerca de",
    },
    en: {
      question: "What is your native language?",
      questionSecondary: "¿Cuál es tu lengua materna?",
      loginText: "Already have an account? Log in",
      tagline: "Learn language through stories.",
      heroPromise:
        "Read anything you want, at your level, in your target language — and learn from it.",
      videoCaption: "See how it works",
      cefrHeadline: "Tired of reading at the wrong level?",
      cefrBody:
        "Children's books can be unappealing to adults. The novel you actually want to read is too hard. So you stop reading. We rewrite any story to match your CEFR level — A1 through C1 — without losing the plot.",
      cefrLabelA: "A1 — beginner",
      cefrLabelB: "B2 — intermediate",
      uploadHeadline: "Don't see what you want to read? Upload it.",
      uploadBody:
        "Paste an article. Drop in a PDF. Upload a chapter from your favorite novel. We'll rewrite it to your level, translate every line, and turn it into a reader with audio in under a minute.",
      uploadCaption: "From paste to reading in under a minute",
      audioHeadline: "Train your ear with full audiobooks at your level.",
      audioBody:
        "Every story plays as a real audiobook — narrated, sentence-synced, with words highlighted as they're spoken. Listen on your commute. Read along. Pause to look up a word.",
      audioCaption: "The Wizard of Oz, Level A1 (Beginner)",
      vocabHeadline: "The words you save come back the day before you'd forget them.",
      vocabBody:
        "That's spaced repetition — the science-backed way to make vocabulary stick. Every word you save returns at the right moment, not before, not after.",
      vocabCaption: "Review in under a minute a day",
      founderHeadline: "Founder's pitch, from a pesero in CDMX",
      founderBody:
        "This is how I got the first 94 users — climbing onto peseros with a mic in hand. If you saw me, thanks for being here.",
      finalHeadline: "Ready to read what you actually want?",
      finalBody: "Free to start. Pick your level. Tap a word. That's it.",
      finalCta: "Start free",
      footerMade: "Made in Mexico City",
      footerPrivacy: "Privacy",
      footerTerms: "Terms",
      footerAbout: "About",
    },
  };

  // These are always in the native language of the button
  const buttonContent = {
    spanish: {
      label: "Español",
      desc: "Estoy aprendiendo inglés",
    },
    english: {
      label: "English",
      desc: "I am learning Spanish",
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
      {/* Logo and tagline at top */}
      <div className="text-center pt-5 pb-1 px-6">
        <Logo variant="classic" showBeta />
        <p className="text-sm text-gray-600 mt-1 font-[Alice]">
          {t.tagline}
        </p>
      </div>

      {/* Progress indicator below logo */}
      <OnboardingProgress currentStep={1} totalSteps={3} lang={preferredLang} />

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-start px-6 pb-12">
        {/* Welcome card */}
        <motion.div
          className="w-full max-w-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          {/* Main selection card - glass effect */}
          <div className="glass-card rounded-2xl shadow-lg px-5 py-6">
            {/* Question - primary language first */}
            <h1 className="text-xl font-bold text-center text-gray-900 mb-1 leading-tight">
              {t.question}
            </h1>
            <p className="text-center text-gray-500 text-sm mb-5">
              {t.questionSecondary}
            </p>

            {/* Language buttons - order based on preference */}
            <div className="space-y-3">
              {preferredLang === 'es' ? (
                <>
                  {/* Spanish first when Spanish is preferred */}
                  <button
                    onClick={() => handleLanguageSelect('es')}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-yellow-500 flex items-center justify-center shadow-sm">
                      <span className="text-white text-sm font-bold">ES</span>
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
                    className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-red-500 flex items-center justify-center shadow-sm">
                      <span className="text-white text-sm font-bold">EN</span>
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
                    className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-red-500 flex items-center justify-center shadow-sm">
                      <span className="text-white text-sm font-bold">EN</span>
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
                    className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-yellow-500 flex items-center justify-center shadow-sm">
                      <span className="text-white text-sm font-bold">ES</span>
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

            {/* Loading spinner only when redirecting (authenticated + completed onboarding) */}
            {status === 'authenticated' && session?.user?.quizLevel ? (
              <div className="flex justify-center mt-6">
                <svg className="animate-spin h-5 w-5 text-indigo-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            ) : status !== 'authenticated' ? (
              <>
                <div className="flex items-center gap-4 my-6">
                  <div className="flex-1 h-px bg-gray-300"></div>
                  <div className="flex-1 h-px bg-gray-300"></div>
                </div>
                <div className="text-center">
                  <a
                    href={`/${preferredLang}/auth/login`}
                    onClick={() => {
                      // Clear onboarding state — user is skipping onboarding to log in
                      sessionStorage.removeItem('quizLevel');
                    }}
                    className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                  >
                    {t.loginText}
                  </a>
                </div>
              </>
            ) : null}
          </div>
        </motion.div>

        {/* Language toggle — small segmented control under the card */}
        <motion.div
          className="mt-4 w-full max-w-sm flex justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          <div
            role="tablist"
            aria-label="Page language"
            className="inline-flex items-center bg-white/40 backdrop-blur-sm border border-white/30 rounded-full p-1 shadow-sm"
          >
            <button
              role="tab"
              aria-selected={preferredLang === "es"}
              onClick={() => setPreferredLang("es")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                preferredLang === "es"
                  ? "bg-white text-indigo-700 shadow"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Español
            </button>
            <button
              role="tab"
              aria-selected={preferredLang === "en"}
              onClick={() => setPreferredLang("en")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                preferredLang === "en"
                  ? "bg-white text-indigo-700 shadow"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              English
            </button>
          </div>
        </motion.div>

        {/* Hero promise — sits below the language toggle, above the demo
            video. Crimson Text for an editorial/literary feel that matches
            the brand; line-height tight so the line wraps tastefully. */}
        <motion.p
          className="mt-6 max-w-md mx-auto text-center text-[1.35rem] sm:text-2xl font-medium leading-[1.25] tracking-tight text-gray-900 font-crimson"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          {t.heroPromise}
        </motion.p>

        {/* Demo video — captioned and framed to read as a phone screen */}
        <motion.div
          className="mt-8 w-full max-w-sm flex flex-col items-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <p className="text-center text-sm font-medium text-gray-700 mb-3">
            {t.videoCaption}
          </p>
          <DemoVideoFrame lang={preferredLang} />
        </motion.div>

        {/* ─────────────────────────────────────────────────────────────
           Section 2 — The level problem (the core differentiator)
           ───────────────────────────────────────────────────────────── */}
        <SectionBlock>
          <SectionHeadline>{t.cefrHeadline}</SectionHeadline>
          <SectionBody>{t.cefrBody}</SectionBody>
          <div className="mt-6 grid grid-cols-2 gap-2 sm:gap-4 w-full">
            <CefrLevelComparison
              label={t.cefrLabelA}
              src={
                preferredLang === "en"
                  ? "/landing/cefr-en-a1.mp4"
                  : "/landing/cefr-es-a1.mp4"
              }
            />
            <CefrLevelComparison
              label={t.cefrLabelB}
              src={
                preferredLang === "en"
                  ? "/landing/cefr-en-b2.mp4"
                  : "/landing/cefr-es-b2.mp4"
              }
            />
          </div>
        </SectionBlock>

        {/* ─────────────────────────────────────────────────────────────
           Section 3 — Bring your own content
           ───────────────────────────────────────────────────────────── */}
        <SectionBlock>
          <SectionHeadline>{t.uploadHeadline}</SectionHeadline>
          <SectionBody>{t.uploadBody}</SectionBody>
          <p className="mt-6 text-center text-sm font-medium text-gray-700 mb-3">
            {t.uploadCaption}
          </p>
          <DemoFeatureFrame
            videoSrc={
              preferredLang === "en"
                ? "/landing/upload-flow-en.mp4"
                : "/landing/upload-flow-es.mp4"
            }
            placeholderLabel={preferredLang === "en" ? "Coming soon" : "Próximamente"}
            lang={preferredLang}
          />
        </SectionBlock>

        {/* ─────────────────────────────────────────────────────────────
           Section 4 — Audio
           ───────────────────────────────────────────────────────────── */}
        <SectionBlock>
          <SectionHeadline>{t.audioHeadline}</SectionHeadline>
          <SectionBody>{t.audioBody}</SectionBody>
          <p className="mt-6 text-center text-sm font-medium text-gray-700 mb-3">
            {t.audioCaption}
          </p>
          <ScrubberVideo
            key={preferredLang}
            src={
              preferredLang === "en"
                ? "/landing/audiobook-en.mp4"
                : "/landing/audiobook-es-slow.mp4"
            }
          />
        </SectionBlock>

        {/* ─────────────────────────────────────────────────────────────
           Section 5 — Vocab
           ───────────────────────────────────────────────────────────── */}
        <SectionBlock>
          <SectionHeadline>{t.vocabHeadline}</SectionHeadline>
          <SectionBody>{t.vocabBody}</SectionBody>
          <p className="mt-6 text-center text-sm font-medium text-gray-700 mb-3">
            {t.vocabCaption}
          </p>
          <DemoFeatureFrame
            videoSrc={
              preferredLang === "en"
                ? "/landing/flashcard-en.mp4"
                : "/landing/flashcard-es.mp4"
            }
            placeholderLabel={preferredLang === "en" ? "Coming soon" : "Próximamente"}
            lang={preferredLang}
          />
        </SectionBlock>

        {/* ─────────────────────────────────────────────────────────────
           Founder section — pesero pitch video
           ───────────────────────────────────────────────────────────── */}
        <SectionBlock>
          <SectionHeadline>{t.founderHeadline}</SectionHeadline>
          <SectionBody>{t.founderBody}</SectionBody>
          <div className="mt-6">
            <FounderVideo key={preferredLang} lang={preferredLang} />
          </div>
        </SectionBlock>

        {/* ─────────────────────────────────────────────────────────────
           Section 6 — Final CTA
           ───────────────────────────────────────────────────────────── */}
        <SectionBlock>
          <SectionHeadline>{t.finalHeadline}</SectionHeadline>
          <SectionBody>{t.finalBody}</SectionBody>
          <button
            onClick={() => handleLanguageSelect(preferredLang)}
            className="mt-6 px-8 py-3 rounded-full bg-indigo-600 text-white font-semibold shadow-md hover:scale-105 hover:shadow-lg transition-transform duration-200 ease-out"
          >
            {t.finalCta}
          </button>
          {status !== "authenticated" && (
            <a
              href={`/${preferredLang}/auth/login`}
              className="mt-4 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
            >
              {t.loginText}
            </a>
          )}
        </SectionBlock>

        {/* ─────────────────────────────────────────────────────────────
           Section 7 — Footer
           ───────────────────────────────────────────────────────────── */}
        <footer className="mt-16 mb-4 w-full max-w-sm flex flex-col items-center text-xs text-gray-500 gap-2">
          <p>{t.footerMade}</p>
          <div className="flex items-center gap-3">
            <a href={`/${preferredLang}/about`} className="hover:text-gray-700">
              {t.footerAbout}
            </a>
            <span className="text-gray-300">·</span>
            <a href="/privacy" className="hover:text-gray-700">
              {t.footerPrivacy}
            </a>
          </div>
        </footer>
      </div>
    </motion.section>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Section primitives
// ───────────────────────────────────────────────────────────────────────

function SectionBlock({ children }: { children: React.ReactNode }) {
  return (
    <motion.section
      className="mt-20 w-full max-w-sm flex flex-col items-center text-center"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {children}
    </motion.section>
  );
}

function SectionHeadline({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-crimson text-2xl sm:text-3xl font-semibold text-gray-900 leading-[1.2] mb-3 tracking-tight">
      {children}
    </h2>
  );
}

function SectionBody({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-base text-gray-700 leading-relaxed max-w-md">
      {children}
    </p>
  );
}

interface CefrLevelComparisonProps {
  label: string;
  src: string;
}

function CefrLevelComparison({ label, src }: CefrLevelComparisonProps) {
  // Renders either a static image or a looping silent video, picked from
  // the file extension. If the asset isn't present yet (recording not
  // captured), the gray placeholder + caption keep the layout intact.
  const isVideo = /\.(mp4|webm|mov)$/i.test(src);

  return (
    <figure className="flex flex-col items-center">
      <div className="w-full aspect-[2/3] rounded-2xl bg-gray-100 overflow-hidden shadow-md">
        {isVideo ? (
          <video
            src={src}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="w-full h-full object-cover"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={label}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        )}
      </div>
      <figcaption className="mt-2 text-xs font-semibold text-gray-700">
        {label}
      </figcaption>
    </figure>
  );
}

interface DemoFeatureFrameProps {
  videoSrc: string | null;
  placeholderLabel: string;
  lang: PreferredLanguage;
}

function DemoFeatureFrame({
  videoSrc,
  placeholderLabel,
  lang,
}: DemoFeatureFrameProps) {
  return (
    <div
      className="relative rounded-[28px] bg-gray-900 p-2 shadow-[0_20px_50px_-15px_rgba(99,102,241,0.35),0_8px_16px_-8px_rgba(0,0,0,0.25)]"
      style={{ width: "260px" }}
    >
      <div
        className="relative overflow-hidden rounded-[20px] bg-gray-800"
        style={{ aspectRatio: "344 / 610" }}
      >
        {videoSrc ? (
          <video
            key={`${videoSrc}-${lang}`}
            src={videoSrc}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-center px-6 bg-gradient-to-br from-indigo-100 to-purple-100">
            <div className="w-12 h-12 rounded-full bg-white/70 flex items-center justify-center mb-3 shadow-sm">
              <svg
                className="w-6 h-6 text-indigo-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-800">
              {placeholderLabel}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Founder video — thin wrapper that picks the right localized source and
// hands it to ScrubberVideo. Remount via `key` at call site on lang change.
interface FounderVideoProps {
  lang: PreferredLanguage;
}

function FounderVideo({ lang }: FounderVideoProps) {
  const videoSrc =
    lang === "en"
      ? "/landing/pesero-speech-en.mp4"
      : "/landing/pesero-speech-es.mp4";
  return <ScrubberVideo src={videoSrc} />;
}

// Phone-framed video player with a draggable scrubber, play/pause on tap,
// and a mute toggle. Autoplays muted on mount; IntersectionObserver pauses
// + re-mutes when scrolled out of view so audio doesn't bleed across
// off-screen videos.
interface ScrubberVideoProps {
  src: string;
}

function ScrubberVideo({ src }: ScrubberVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const draggingRef = useRef(false);

  // Auto-pause + auto-mute when out of view.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
          video.muted = true;
          setMuted(true);
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  // Wire up timeupdate / loadedmetadata so the scrubber reflects playback.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTime = () => {
      if (draggingRef.current) return;
      setCurrentTime(video.currentTime);
      if (video.duration > 0) setProgress(video.currentTime / video.duration);
    };
    const onMeta = () => setDuration(video.duration || 0);
    const onPlay = () => setPaused(false);
    const onPause = () => setPaused(true);

    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    if (video.readyState >= 1) onMeta();
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, []);

  const toggleMuted = () => {
    const video = videoRef.current;
    if (!video) return;
    const next = !muted;
    video.muted = next;
    setMuted(next);
    if (!next) video.play().catch(() => {});
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  // Compute a 0..1 ratio from a pointer X coordinate within the track.
  const ratioFromPointer = (clientX: number): number => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const seekTo = (ratio: number) => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const t = ratio * video.duration;
    video.currentTime = t;
    setProgress(ratio);
    setCurrentTime(t);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    seekTo(ratioFromPointer(e.clientX));
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    seekTo(ratioFromPointer(e.clientX));
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const fmt = (s: number) => {
    if (!isFinite(s) || s < 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className="relative rounded-[28px] bg-gray-900 p-2 shadow-[0_20px_50px_-15px_rgba(99,102,241,0.35),0_8px_16px_-8px_rgba(0,0,0,0.25)]"
      style={{ width: "260px" }}
    >
      <div
        className="relative overflow-hidden rounded-[20px] bg-gray-800"
        style={{ aspectRatio: "9 / 16" }}
      >
        <video
          ref={videoRef}
          src={src}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onClick={togglePlay}
          className="w-full h-full object-cover cursor-pointer"
        />

        {/* Center play indicator: only visible when paused. Pointer-events
            disabled so the video's onClick still receives the tap. */}
        {paused && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}

        {/* Mute / unmute toggle in the top-right corner of the frame */}
        <button
          type="button"
          onClick={toggleMuted}
          aria-label={muted ? "Unmute" : "Mute"}
          className="absolute top-2 right-2 w-9 h-9 flex items-center justify-center rounded-full bg-black/55 backdrop-blur-sm text-white shadow-md hover:bg-black/75 transition-colors"
        >
          {muted ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 9l4 4M21 9l-4 4" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          )}
        </button>

        {/* Scrubber overlaid at the bottom of the video frame. The track
            sits inside a gradient pad so it stays legible no matter the
            video's underlying brightness at that moment. */}
        <div className="absolute left-0 right-0 bottom-0 px-3 pt-6 pb-2 bg-gradient-to-t from-black/65 to-transparent">
          <div
            ref={trackRef}
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(currentTime)}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="relative h-1.5 w-full rounded-full bg-white/30 cursor-pointer touch-none"
          >
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-white"
              style={{ width: `${progress * 100}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white shadow"
              style={{ left: `${progress * 100}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] font-medium text-white/85 tabular-nums">
            <span>{fmt(currentTime)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DemoVideoFrameProps {
  lang: PreferredLanguage;
}

function DemoVideoFrame({ lang }: DemoVideoFrameProps) {
  const videoSrc =
    lang === "en"
      ? "/landing/tap-translate-save-en.mp4"
      : "/landing/tap-translate-save-es.mp4";

  return (
    <div
      className="relative rounded-[28px] bg-gray-900 p-2 shadow-[0_20px_50px_-15px_rgba(99,102,241,0.35),0_8px_16px_-8px_rgba(0,0,0,0.25)]"
      style={{ width: "260px" }}
    >
      <div className="relative overflow-hidden rounded-[20px] bg-gray-800" style={{ aspectRatio: "344 / 610" }}>
        <video
          // `key` forces remount on lang change so a fresh video loads
          // instead of the browser hanging on the old <video> element.
          key={lang}
          src={videoSrc}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
}
