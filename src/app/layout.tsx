// /src/app/layout.tsx

import './globals.css';
import type { ReactNode } from 'react';
import SessionWrapper from '@/components/SessionWrapper';
import SessionTracker from '@/components/SessionTracker';
import { Alice, Open_Sans, Inter } from 'next/font/google';

export const metadata = {
  title: 'ApreNova',
  description: 'Learn smarter, not harder. Learn with stories.',
};

const alice = Alice({ subsets: ['latin'], weight: '400' });
const openSans = Open_Sans({ subsets: ['latin'], weight: ['400', '600'] });
const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="es" className={`${inter.className} ${alice.className} ${openSans.className}`} translate="no">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="google" content="notranslate" />
      </head>
      <body className="bg-background text-foreground font-sans transition-none">
        <SessionWrapper>
          <SessionTracker />
          {children}
        </SessionWrapper>
      </body>
    </html>
  );
}


