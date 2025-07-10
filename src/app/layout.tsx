// /src/app/layout.tsx (root layout)

import './globals.css';
import type { ReactNode } from 'react';
import SessionWrapper from '@/components/SessionWrapper';
import SessionTracker from '@/components/SessionTracker';

export const metadata = {
  title: 'ApreNova',
  description: 'Learn smarter, not harder. Learn with stories.',
};

export default function RootLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { lang: string };
}) {
  const typedLang = params.lang === "en" || params.lang === "es" ? params.lang : "es";

  return (
    <html lang={typedLang} translate="no">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="google" content="notranslate" />
        <link
          href="https://fonts.googleapis.com/css2?family=Alice&family=Open+Sans:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-foreground font-sans transition-none">
        <SessionWrapper>
          <SessionTracker /> {/* ✅ Logging handled client-side */}
          {children}
        </SessionWrapper>
      </body>
    </html>
  );
}


