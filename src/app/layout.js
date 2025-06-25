// src/app/layout.js
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
      <body>
        <SessionWrapper>
          <LanguageSwitcher />
          {children}
        </SessionWrapper>
      </body>
    </html>
  );
}
