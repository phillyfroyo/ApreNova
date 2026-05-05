// src/app/[lng]/auth/signup/page.tsx
'use client';

import { useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import type { Language } from '@/types/i18n';
import AuthForm from '@/components/auth/AuthForm';
import { trackEventDeduped } from '@/lib/meta-pixel';

export default function SignupPage() {
  const { lng } = useParams();
  const typedLang = lng as Language;
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackEventDeduped('ViewContent', { content_name: 'signup_page', content_category: 'auth' });
  }, []);

  return <AuthForm mode="signup" lang={typedLang} />;
}
