// src/app/[lng]/auth/signup/page.tsx
'use client';

import { useParams } from 'next/navigation';
import type { Language } from '@/types/i18n';
import AuthForm from '@/components/auth/AuthForm';

export default function SignupPage() {
  const { lng } = useParams();
  const typedLang = lng as Language;

  return <AuthForm mode="signup" lang={typedLang} />;
}
