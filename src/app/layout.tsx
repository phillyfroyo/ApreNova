// /src/app/layout.tsx

import './globals.css';
import type { ReactNode } from 'react';
import SessionWrapper from '@/components/SessionWrapper';
import SessionTracker from '@/components/SessionTracker';
import StoryUploadWrapper from '@/components/user-stories/StoryUploadWrapper';
import { Alice, Open_Sans, Inter, Crimson_Text } from 'next/font/google';

export const metadata = {
  title: 'Cuentana',
  description: 'Learn language through stories.',
};

const alice = Alice({ subsets: ['latin'], weight: '400' });
const openSans = Open_Sans({ subsets: ['latin'], weight: ['400', '600'] });
const inter = Inter({ subsets: ['latin'] });
const crimsonText = Crimson_Text({ subsets: ['latin'], weight: '400', variable: '--font-crimson' });

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="es" className={`${inter.className} ${alice.className} ${openSans.className} ${crimsonText.variable}`} translate="no">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="google" content="notranslate" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron&family=Raleway&family=Fredoka&family=Baloo+2&family=Press+Start+2P&family=Playfair+Display&family=Quicksand&family=Exo+2&family=Lora&family=Merriweather&family=Changa+One&family=Audiowide&family=Oswald&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-foreground font-sans transition-none">
        <SessionWrapper>
          <StoryUploadWrapper>
            <SessionTracker />
            {children}
          </StoryUploadWrapper>
        </SessionWrapper>
      </body>
    </html>
  );
}


