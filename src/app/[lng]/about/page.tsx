// src/app/[lng]/about/page.tsx
'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from '@/components/Logo';
import { t } from '@/lib/t';
import type { Language } from '@/types/i18n';

export default function AboutPage() {
  const pathname = usePathname();
  const typedLang = pathname.split('/')[1] as Language;

  const features = [
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      titleKey: 'aboutFeature1Title',
      descKey: 'aboutFeature1Desc',
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      titleKey: 'aboutFeature2Title',
      descKey: 'aboutFeature2Desc',
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      titleKey: 'aboutFeature3Title',
      descKey: 'aboutFeature3Desc',
    },
  ];

  return (
    <motion.div
      className="min-h-screen bg-[url('/images/background3.png')] bg-cover bg-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <Logo variant="storiesmain" size="text-[48px]" plain />
          <p className="mt-4 text-xl text-gray-700 font-[Alice]">
            {t(typedLang, 'about', 'tagline')}
          </p>
        </motion.div>

        {/* Main content card */}
        <motion.div
          className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg p-8 border border-white/50 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {t(typedLang, 'about', 'whatIs')}
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            {t(typedLang, 'stories', 'storyLandingIntro')}
          </p>
          <p className="text-gray-700 leading-relaxed mb-6">
            {t(typedLang, 'stories', 'storyLandingSubtagline')}
          </p>

          {/* Features grid */}
          <div className="grid md:grid-cols-3 gap-6 mt-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.titleKey}
                className="text-center p-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1, duration: 0.4 }}
              >
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
                  {feature.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  {t(typedLang, 'about', feature.titleKey as any)}
                </h3>
                <p className="text-sm text-gray-600">
                  {t(typedLang, 'about', feature.descKey as any)}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CTA section */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <Link
            href={`/${typedLang}/home`}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-8 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-colors shadow-md"
          >
            {t(typedLang, 'about', 'getStarted')}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </motion.div>

        {/* Back link */}
        <motion.div
          className="text-center mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          <Link
            href={`/${typedLang}/home`}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            {t(typedLang, 'about', 'backToHome')}
          </Link>
        </motion.div>
      </div>
    </motion.div>
  );
}
