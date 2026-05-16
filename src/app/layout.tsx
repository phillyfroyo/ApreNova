// /src/app/layout.tsx

import './globals.css';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import SessionWrapper from '@/components/SessionWrapper';
import SessionTracker from '@/components/SessionTracker';
import StoryUploadWrapper from '@/components/user-stories/StoryUploadWrapper';
import AudioPlayerWrapper from '@/components/AudioPlayerWrapper';
import { TourProvider } from '@/components/tour/TourProvider';
import MetaPixel from '@/components/MetaPixel';
import NewUserPixelEvent from '@/components/NewUserPixelEvent';
import { Suspense } from 'react';
import { Alice, Open_Sans, Inter, Crimson_Text } from 'next/font/google';
import JsonLd from '@/components/JsonLd';

// Base URL drives canonical + OG absolute URLs across the app.
const SITE_URL = 'https://cuentana.app';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Cuentana — Learn Spanish through stories',
    template: '%s | Cuentana',
  },
  description:
    'Read curated stories in Spanish at every CEFR level (A1–C1). Built-in translation, audio, and bilingual reading mode. Upload your own content too.',
  applicationName: 'Cuentana',
  keywords: [
    'learn Spanish',
    'Spanish reading practice',
    'CEFR Spanish',
    'A1 Spanish stories',
    'A2 Spanish stories',
    'B1 Spanish stories',
    'B2 Spanish stories',
    'language learning through reading',
    'bilingual reading',
  ],
  openGraph: {
    type: 'website',
    siteName: 'Cuentana',
    title: 'Cuentana — Learn Spanish through stories',
    description:
      'Read curated stories in Spanish at every CEFR level (A1–C1). Translation, audio, and bilingual reading built in.',
    images: ['/images/og-default.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cuentana — Learn Spanish through stories',
    description:
      'Read curated stories in Spanish at every CEFR level (A1–C1). Translation, audio, and bilingual reading built in.',
    images: ['/images/og-default.png'],
  },
  robots: { index: true, follow: true },
  // GOOGLE_SITE_VERIFICATION is set in Vercel env vars (Production only) once
  // Search Console gives you the verification code. When unset, the meta tag
  // is omitted entirely; when set, it's emitted so Search Console can verify
  // ownership on the next deploy. See dev/SEO_PLAN.md for the playbook.
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
};

const alice = Alice({ subsets: ['latin'], weight: '400' });
const openSans = Open_Sans({ subsets: ['latin'], weight: ['400', '600'] });
const inter = Inter({ subsets: ['latin'] });
const crimsonText = Crimson_Text({ subsets: ['latin'], weight: '400', variable: '--font-crimson' });

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Read the language set by middleware.ts — keeps <html lang> in sync with /[lng]/ route.
  const h = await headers();
  const lang = h.get('x-cuentana-lang') ?? 'en';

  return (
    <html lang={lang} className={`${inter.className} ${alice.className} ${openSans.className} ${crimsonText.variable}`} translate="no">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="google" content="notranslate" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron&family=Raleway&family=Fredoka&family=Baloo+2&family=Press+Start+2P&family=Playfair+Display&family=Quicksand&family=Exo+2&family=Lora&family=Merriweather&family=Changa+One&family=Audiowide&family=Oswald&display=swap"
          rel="stylesheet"
        />
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'WebSite',
                '@id': `${SITE_URL}/#website`,
                url: SITE_URL,
                name: 'Cuentana',
                description: 'Learn Spanish through curated stories at every CEFR level.',
                inLanguage: ['en', 'es'],
                potentialAction: {
                  '@type': 'SearchAction',
                  target: {
                    '@type': 'EntryPoint',
                    urlTemplate: `${SITE_URL}/${lang}/stories?q={search_term_string}`,
                  },
                  'query-input': 'required name=search_term_string',
                },
              },
              {
                '@type': 'Organization',
                '@id': `${SITE_URL}/#organization`,
                name: 'Cuentana',
                url: SITE_URL,
                logo: `${SITE_URL}/images/logo.png`,
              },
            ],
          }}
        />
      </head>
      <body className="bg-background text-foreground font-sans transition-none">
        <MetaPixel />
        <Suspense fallback={null}>
          <NewUserPixelEvent />
        </Suspense>
        <SessionWrapper>
          <TourProvider>
            <StoryUploadWrapper>
              <AudioPlayerWrapper>
                <SessionTracker />
                {children}
              </AudioPlayerWrapper>
            </StoryUploadWrapper>
          </TourProvider>
        </SessionWrapper>
      </body>
    </html>
  );
}


