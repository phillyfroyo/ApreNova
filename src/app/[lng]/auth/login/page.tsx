// src/app/[lng]/auth/login/page.tsx
'use client';

import { useParams } from 'next/navigation';
import type { Language } from '@/types/i18n';
import AuthForm from '@/components/auth/AuthForm';

export default function LoginPage() {
  const { lng } = useParams();
  const typedLang = lng as Language;

  return <AuthForm mode="login" lang={typedLang} />;
}
