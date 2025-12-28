// src/app/[lng]/auth/login/page.tsx
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Logo from '@/components/Logo';
import { Card, Input, Button, H1, Small } from '@/components/ui';
import { useRouter, useParams } from 'next/navigation';
import type { Language } from '@/types/i18n';
import Link from 'next/link';
import Image from 'next/image';
import { t } from '@/lib/t';
import LanguageDropdown from '@/components/LanguageDropdown';

export default function LoginPage() {
  const router = useRouter();
  const { lng } = useParams();
  const typedLang = lng as Language;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });

      if (result?.ok) {
        // Small delay to ensure session cookie is set
        await new Promise(resolve => setTimeout(resolve, 100));

        // Fetch user's native language from the session
        const response = await fetch('/api/auth/session');
        const session = await response.json();
        const userLang = session?.user?.nativeLanguage || typedLang;

        // Force a hard navigation to ensure session is picked up
        // Keep loading state true during redirect
        window.location.href = `/${userLang}/stories`;
      } else {
        setError(t(typedLang, 'auth', 'error'));
        setIsLoading(false);
      }
    } catch (err) {
      setError(t(typedLang, 'auth', 'error'));
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setIsLoading(true);
    signIn('google', {
      callbackUrl: `${window.location.origin}/api/post-login?lang=${typedLang}`,
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[url('/images/background3.png')] bg-cover bg-center text-black">
      <div className="mb-6 text-center">
        <Logo variant="auth" />
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-md">
        <Card className="glass-card space-y-6">
          <H1 className="text-center text-xl">{t(typedLang, 'auth', 'login')}</H1>

          <div className="flex flex-col gap-1">
            <p className="text-sm text-black/70">
              {t(typedLang, 'auth', 'languagePrompt')}
            </p>
            <LanguageDropdown currentLang={typedLang} redirectPath="/auth/login" />
          </div>

          <Input
            type="email"
            placeholder={t(typedLang, 'auth', 'email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />

          <Input
            type="password"
            placeholder={t(typedLang, 'auth', 'password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />

          {error && (
            <p className="text-sm text-center text-red-600">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            variant="button1"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t(typedLang, 'auth', 'loggingIn')}
              </span>
            ) : (
              t(typedLang, 'auth', 'login')
            )}
          </Button>

          <div className="flex items-center justify-center">
            <Small className="!text-black text-center">{t(typedLang, 'auth', 'or')}</Small>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg py-2 bg-white hover:bg-gray-100 transition group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Image
              src="https://www.svgrepo.com/show/475656/google-color.svg"
              alt="Google"
              width={20}
              height={20}
              className="w-5 h-5 transform transition-transform duration-300 group-hover:translate-x-1"
            />
            <span className="text-sm text-gray-700 font-medium">
              {t(typedLang, 'auth', 'googleLogin')}
            </span>
          </button>

          <p className="mt-4 text-center text-sm">
            <span className="text-black">{t(typedLang, 'auth', 'newHere')} </span>
            <Link href={`/${typedLang}/auth/signup`} className="text-[#1000c8] hover:underline">
              {t(typedLang, 'auth', 'createAccountCard')}
            </Link>
          </p>
        </Card>
      </form>
    </div>
  );
}
