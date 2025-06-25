'use client';

import { useEffect } from 'react';
import { redirect } from 'next/navigation';

export default function Home() {
  useEffect(() => {
    redirect('/es');
  }, []);

  return null; // Or add a loading spinner if you want
}
