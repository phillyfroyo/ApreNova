// src/components/auth/AuthForm.tsx
'use client';

import { useState, FormEvent, useRef, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Logo from '@/components/Logo';
import { Card, Input, Button, H1 } from '@/components/ui';
import Link from 'next/link';
import Image from 'next/image';
import { t } from '@/lib/t';
import LanguageDropdown from '@/components/LanguageDropdown';
import type { Language } from '@/types/i18n';
import { AUTH_ERROR_CODES, getAuthErrorMessage, type AuthErrorCode } from '@/lib/auth-errors';

interface AuthFormProps {
  mode: 'login' | 'signup';
  lang: Language;
}

type LoginMode = 'password' | 'otp';
type OtpStep = 'email' | 'code';

export default function AuthForm({ mode, lang }: AuthFormProps) {
  const searchParams = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [googleAuthError, setGoogleAuthError] = useState(false);

  // Login-specific state
  const [loginMode, setLoginMode] = useState<LoginMode>('password');
  const [otpStep, setOtpStep] = useState<OtpStep>('email');

  // OTP input refs for auto-focus
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const isLogin = mode === 'login';
  const isOtpMode = isLogin && loginMode === 'otp';

  // Detect Google OAuth callback error from URL
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'Callback' || errorParam === 'OAuthCallback') {
      // Check if we need to redirect to correct language
      if (typeof window !== 'undefined') {
        const storedLang = localStorage.getItem('oauth_lang');
        if (storedLang && storedLang !== lang) {
          // Redirect to the correct language version with the error preserved
          localStorage.removeItem('oauth_lang');
          window.location.href = `/${storedLang}/auth/login?error=${errorParam}`;
          return;
        }
        localStorage.removeItem('oauth_lang');
      }

      setGoogleAuthError(true);
      // Notify admin about the issue
      fetch('/api/auth/notify-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: errorParam, timestamp: new Date().toISOString() }),
      }).catch(() => {}); // Silent fail - don't block user
    }
  }, [searchParams, lang]);

  // Auto-focus first OTP input when entering code step
  useEffect(() => {
    if (otpStep === 'code' && otpInputRefs.current[0]) {
      otpInputRefs.current[0].focus();
    }
  }, [otpStep]);

  // Handle OTP input with auto-advance
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits

    const newCode = otpCode.split('');
    newCode[index] = value.slice(-1); // Take only last character
    const updatedCode = newCode.join('').slice(0, 6);
    setOtpCode(updatedCode);

    // Auto-advance to next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace in OTP inputs
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste in OTP inputs
  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    setOtpCode(pastedData);

    // Focus the next empty input or last input
    const nextIndex = Math.min(pastedData.length, 5);
    otpInputRefs.current[nextIndex]?.focus();
  };

  const handleSendOtp = async () => {
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, lang }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorCode = data.code as AuthErrorCode;
        setError(getAuthErrorMessage(errorCode, lang));
        setIsLoading(false);
        return;
      }

      // Success - move to code entry step
      setSuccess(lang === 'en' ? 'Code sent! Check your email.' : 'Código enviado. Revisa tu correo.');
      setOtpStep('code');
      setOtpCode('');
    } catch (err) {
      setError(getAuthErrorMessage(AUTH_ERROR_CODES.NETWORK_ERROR, lang));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      setError(lang === 'en' ? 'Please enter the 6-digit code.' : 'Ingresa el código de 6 dígitos.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otpCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || getAuthErrorMessage(AUTH_ERROR_CODES.INVALID_CREDENTIALS, lang));
        setIsLoading(false);
        return;
      }

      // Success - redirect to dashboard
      const userLang = data.user?.nativeLanguage || lang;
      window.location.href = `/${userLang}/dashboard`;
    } catch (err) {
      setError(getAuthErrorMessage(AUTH_ERROR_CODES.NETWORK_ERROR, lang));
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Handle OTP mode separately
    if (isOtpMode) {
      if (otpStep === 'email') {
        await handleSendOtp();
      } else {
        await handleVerifyOtp();
      }
      return;
    }

    setIsLoading(true);

    try {
      if (isLogin) {
        // Password login flow
        const validateRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const validateData = await validateRes.json();

        if (!validateRes.ok) {
          const errorCode = validateData.code as AuthErrorCode;
          setError(getAuthErrorMessage(errorCode, lang));
          setIsLoading(false);
          return;
        }

        const result = await signIn('credentials', {
          redirect: false,
          email,
          password,
        });

        if (result?.ok) {
          const userLang = validateData.user?.nativeLanguage || lang;
          window.location.href = `/${userLang}/dashboard`;
        } else {
          setError(getAuthErrorMessage(AUTH_ERROR_CODES.INTERNAL_ERROR, lang));
          setIsLoading(false);
        }
      } else {
        // Signup flow
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, nativeLanguage: lang, name }),
        });

        const data = await res.json();

        if (!res.ok) {
          const errorCode = data.code as AuthErrorCode;
          setError(getAuthErrorMessage(errorCode, lang));
          setIsLoading(false);
          return;
        }

        const result = await signIn('credentials', {
          redirect: false,
          email,
          password,
        });

        if (result?.ok) {
          window.location.href = `/${lang}/home`;
        } else {
          setError(getAuthErrorMessage(AUTH_ERROR_CODES.INTERNAL_ERROR, lang));
          setIsLoading(false);
        }
      }
    } catch (err) {
      setError(getAuthErrorMessage(AUTH_ERROR_CODES.NETWORK_ERROR, lang));
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setIsLoading(true);
    // Store language preference before OAuth redirect so we can restore it on error
    if (typeof window !== 'undefined') {
      localStorage.setItem('oauth_lang', lang);
    }
    signIn('google', {
      callbackUrl: `${window.location.origin}/api/post-login?lang=${lang}`,
    });
  };

  const toggleLoginMode = () => {
    setLoginMode(loginMode === 'password' ? 'otp' : 'password');
    setOtpStep('email');
    setOtpCode('');
    setError('');
    setSuccess('');
  };

  const resetOtpFlow = () => {
    setOtpStep('email');
    setOtpCode('');
    setError('');
    setSuccess('');
  };

  // Text content
  const title = isLogin
    ? t(lang, 'auth', 'login')
    : t(lang, 'auth', 'createAccountCard');

  const getSubmitButtonText = () => {
    if (isOtpMode) {
      if (otpStep === 'email') {
        return lang === 'en' ? 'Send Code' : 'Enviar Código';
      }
      return lang === 'en' ? 'Verify & Log In' : 'Verificar e Ingresar';
    }
    return isLogin ? t(lang, 'auth', 'login') : t(lang, 'auth', 'signup');
  };

  const getLoadingText = () => {
    if (isOtpMode) {
      if (otpStep === 'email') {
        return lang === 'en' ? 'Sending...' : 'Enviando...';
      }
      return lang === 'en' ? 'Verifying...' : 'Verificando...';
    }
    return isLogin ? t(lang, 'auth', 'loggingIn') : t(lang, 'auth', 'creatingAccount');
  };

  const googleButtonText = isLogin
    ? t(lang, 'auth', 'googleLogin')
    : t(lang, 'auth', 'signupGoogle');

  const switchText = isLogin
    ? t(lang, 'auth', 'newHere')
    : t(lang, 'auth', 'alreadyHaveAccount');

  const switchLinkText = isLogin
    ? t(lang, 'auth', 'createAccountCard')
    : t(lang, 'auth', 'login');

  const switchHref = isLogin
    ? `/${lang}/auth/signup`
    : `/${lang}/auth/login`;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[url('/images/background3.png')] bg-cover bg-center text-black">
      <div className="mb-6 text-center">
        <Logo variant="storiesmain" />
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-md">
        <Card className="glass-card space-y-6">
          <H1 className="text-center text-xl">{title}</H1>

          <LanguageDropdown
            currentLang={lang}
            redirectPath={isLogin ? '/auth/login' : '/auth/signup'}
          />

          {/* Name field - signup only */}
          {!isLogin && (
            <Input
              type="text"
              placeholder={t(lang, 'auth', 'name')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isLoading}
            />
          )}

          {/* Email field - always shown */}
          <Input
            type="email"
            placeholder={t(lang, 'auth', 'email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading || (isOtpMode && otpStep === 'code')}
          />

          {/* Password field - hidden in OTP mode */}
          {!isOtpMode && (
            <div className="space-y-1">
              <Input
                type="password"
                placeholder={t(lang, 'auth', 'password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
              {isLogin && (
                <Link
                  href={`/${lang}/auth/forgot-password`}
                  className="block text-sm text-indigo-600 hover:text-indigo-800 hover:underline text-right"
                >
                  {t(lang, 'auth', 'forgotPassword')}
                </Link>
              )}
            </div>
          )}

          {/* OTP Code input - shown in OTP mode, code step */}
          {isOtpMode && otpStep === 'code' && (
            <div className="space-y-3">
              <p className="text-sm text-center text-gray-600">
                {lang === 'en'
                  ? `Enter the 6-digit code sent to ${email}`
                  : `Ingresa el código de 6 dígitos enviado a ${email}`}
              </p>

              {/* OTP Input boxes */}
              <div className="flex justify-center gap-2">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <input
                    key={index}
                    ref={(el) => { otpInputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={otpCode[index] || ''}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={index === 0 ? handleOtpPaste : undefined}
                    disabled={isLoading}
                    className="w-11 h-12 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none disabled:opacity-50"
                  />
                ))}
              </div>

              {/* Change email link */}
              <button
                type="button"
                onClick={resetOtpFlow}
                disabled={isLoading}
                className="text-sm text-indigo-600 hover:underline mx-auto block"
              >
                {lang === 'en' ? 'Use different email' : 'Usar otro correo'}
              </button>
            </div>
          )}

          {/* Error message */}
          {error && (
            <p className="text-red-600 text-sm text-center">{error}</p>
          )}

          {/* Success message */}
          {success && (
            <p className="text-green-600 text-sm text-center">{success}</p>
          )}

          {/* Submit button */}
          <Button
            type="submit"
            className="w-full"
            variant="button1"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                {getLoadingText()}
              </span>
            ) : (
              getSubmitButtonText()
            )}
          </Button>

          {/* Toggle between password and OTP login - login only */}
          {isLogin && (
            <button
              type="button"
              onClick={toggleLoginMode}
              disabled={isLoading}
              className="w-full text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              {loginMode === 'password'
                ? t(lang, 'auth', 'sendOneTimeCode')
                : t(lang, 'auth', 'usePassword')}
            </button>
          )}

          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-300" />
            <div className="flex-1 h-px bg-gray-300" />
          </div>

          {googleAuthError ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center space-y-2">
              <p className="text-amber-800 text-sm font-medium">
                {lang === 'en'
                  ? 'Google sign-in is temporarily unavailable'
                  : 'El inicio de sesión con Google no está disponible temporalmente'}
              </p>
              <p className="text-amber-700 text-xs">
                {lang === 'en'
                  ? 'Please use the email login option above, or try the one-time code option.'
                  : 'Por favor usa el inicio de sesión con correo arriba, o prueba la opción de código único.'}
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="group w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg py-2 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Image
                src="https://www.svgrepo.com/show/475656/google-color.svg"
                alt="Google"
                width={20}
                height={20}
                className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-0.5"
              />
              <span className="text-sm text-gray-700 font-medium">
                {googleButtonText}
              </span>
            </button>
          )}

          <p className="mt-4 text-center text-sm">
            <span className="text-black">{switchText} </span>
            <Link href={switchHref} className="text-[#1000c8] hover:underline">
              {switchLinkText}
            </Link>
          </p>
        </Card>
      </form>
    </div>
  );
}
