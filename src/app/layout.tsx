import './globals.css';
import type { ReactNode } from 'react';
import SessionWrapper from '@/components/SessionWrapper';

export const metadata = {
  title: 'ApreNova',
  description: 'Learn smarter, not harder. Learn with stories.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" translate="no">
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
          {children}
        </SessionWrapper>
      </body>
    </html>
  );
}
