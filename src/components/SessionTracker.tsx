'use client';

import { useSessionLogger } from '@/hooks/useSessionLogger';

export default function SessionTracker() {
  useSessionLogger('general');
  return null;
}
