import './globals.css';
import LanguageSwitcher from '../components/LanguageSwitcher';
import SessionWrapper from '../components/SessionWrapper';

export const metadata = {
  title: 'ApreNova',
  description: 'Learn smarter, not harder. Learn with stories.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Alice&family=Open+Sans:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-foreground font-sans">
        <SessionWrapper>
          <LanguageSwitcher />
          {children}
        </SessionWrapper>
      </body>
    </html>
  );
}
