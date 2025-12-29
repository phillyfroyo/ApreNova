// src/app/[lng]/auth/forgot-password/page.tsx
'use client';

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Language } from '@/types/i18n';
import { t } from '@/lib/t';
import { Card, Input, Button, H1 } from '@/components/ui';
import Logo from '@/components/Logo';

type Step = 'email' | 'code' | 'password';

export default function ForgotPasswordPage() {
  const { lng } = useParams();
  const lang = lng as Language;
  const router = useRouter();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, lang }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to send code');
        return;
      }

      setStep('code');
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const code = otpCode.join('');
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid code');
        return;
      }

      // Code verified, move to password step
      setStep('password');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t(lang, 'auth', 'passwordMismatch'));
      return;
    }

    if (password.length < 6) {
      setError(lang === 'en' ? 'Password must be at least 6 characters' : 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to reset password');
        return;
      }

      setSuccess(t(lang, 'auth', 'passwordUpdated'));
      setTimeout(() => {
        router.push(`/${lang}/auth/login`);
      }, 2000);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otpCode];
    newOtp[index] = value.slice(-1);
    setOtpCode(newOtp);

    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length === 6) {
      setOtpCode(pastedData.split(''));
      otpInputRefs.current[5]?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    if (step === 'email') return handleSendCode(e);
    if (step === 'code') return handleVerifyCode(e);
    return handleResetPassword(e);
  };

  const getSubmitButtonText = () => {
    if (step === 'email') {
      return lang === 'en' ? 'Send Reset Code' : 'Enviar código';
    }
    if (step === 'code') {
      return lang === 'en' ? 'Verify Code' : 'Verificar código';
    }
    return t(lang, 'auth', 'setNewPassword');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[url('/images/background3.png')] bg-cover bg-center text-black">
      <div className="mb-6 text-center">
        <Logo variant="auth" />
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-md">
        <Card className="glass-card space-y-6">
          <H1 className="text-center text-xl">{t(lang, 'auth', 'resetPasswordTitle')}</H1>

          {step === 'email' && (
            <>
              <p className="text-sm text-center text-gray-600">
                {t(lang, 'auth', 'resetPasswordSubtitle')}
              </p>
              <Input
                type="email"
                placeholder={t(lang, 'auth', 'email')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </>
          )}

          {step === 'code' && (
            <div className="space-y-3">
              <p className="text-sm text-center text-gray-600">
                {lang === 'en'
                  ? `Enter the 6-digit code sent to ${email}`
                  : `Ingresa el código de 6 dígitos enviado a ${email}`}
              </p>

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

              <button
                type="button"
                onClick={() => { setStep('email'); setOtpCode(['', '', '', '', '', '']); }}
                disabled={isLoading}
                className="text-sm text-indigo-600 hover:underline mx-auto block"
              >
                {lang === 'en' ? 'Use different email' : 'Usar otro correo'}
              </button>
            </div>
          )}

          {step === 'password' && (
            <div className="space-y-4">
              <p className="text-sm text-center text-gray-600">
                {lang === 'en'
                  ? 'Enter your new password'
                  : 'Ingresa tu nueva contraseña'}
              </p>
              <Input
                type="password"
                placeholder={t(lang, 'auth', 'newPassword')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
              <Input
                type="password"
                placeholder={t(lang, 'auth', 'confirmNewPassword')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          )}

          {error && (
            <p className="text-red-600 text-sm text-center">{error}</p>
          )}

          {success && (
            <p className="text-green-600 text-sm text-center">{success}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            variant="button1"
            disabled={isLoading || !!success}
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
                {t(lang, 'auth', 'updating')}
              </span>
            ) : (
              getSubmitButtonText()
            )}
          </Button>

          <p className="text-center text-sm">
            <Link href={`/${lang}/auth/login`} className="text-indigo-600 hover:underline">
              {lang === 'en' ? 'Back to login' : 'Volver al inicio de sesión'}
            </Link>
          </p>
        </Card>
      </form>
    </div>
  );
}
