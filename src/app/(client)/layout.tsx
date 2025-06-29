'use client';

import { ReactNode } from 'react';
import SessionWrapper from '@/components/SessionWrapper';

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <SessionWrapper>
      {children}
    </SessionWrapper>
  );
}
