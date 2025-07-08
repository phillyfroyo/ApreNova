// src/hooks/useSessionLogger.ts
'use client';

import { useEffect } from 'react';

export function useSessionLogger(type: 'general' | 'reading') {
  useEffect(() => {
    const start = Date.now();

    const logTime = () => {
      const ms = Date.now() - start;
      fetch('/api/log-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ms, type }),
      });
    };

    window.addEventListener('beforeunload', logTime);
    return () => {
      logTime();
      window.removeEventListener('beforeunload', logTime);
    };
  }, [type]);
}
