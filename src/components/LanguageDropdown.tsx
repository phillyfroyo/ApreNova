// src/components/LanguageDropdown.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Language } from '@/types/i18n';
import { t } from '@/lib/t';

interface LanguageDropdownProps {
  currentLang: Language;
  redirectPath: string; // e.g., '/auth/login' - will be prefixed with language
}

export default function LanguageDropdown({ currentLang, redirectPath }: LanguageDropdownProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = (lang: Language) => {
    setIsOpen(false);
    router.push(`/${lang}${redirectPath}`);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-left flex items-center justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{t(currentLang, 'language', currentLang)}</span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-md z-10 overflow-hidden">
          {currentLang !== 'en' && (
            <button
              type="button"
              onClick={() => handleLanguageChange('en')}
              className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors"
            >
              {t(currentLang, 'language', 'en')}
            </button>
          )}
          {currentLang !== 'es' && (
            <button
              type="button"
              onClick={() => handleLanguageChange('es')}
              className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors"
            >
              {t(currentLang, 'language', 'es')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
