'use client';

import { ReactNode, useState, useEffect } from 'react';
import SessionWrapper from '@/components/SessionWrapper';
import { SessionProvider } from 'next-auth/react';
import FeedbackWidget from '@/components/FeedbackWidget';

function detectBrowserLanguage(): "en" | "es" {
  if (typeof window === 'undefined') return 'es';
  const browserLangs = navigator.languages || [navigator.language || ''];
  return browserLangs.some(lang => lang.toLowerCase().startsWith('en')) ? 'en' : 'es';
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [lng, setLng] = useState<"en" | "es">("es");

  useEffect(() => {
    setLng(detectBrowserLanguage());
  }, []);

  return (
    <SessionProvider>
      {children}
      <FeedbackWidget lng={lng} />
    </SessionProvider>
  );
}