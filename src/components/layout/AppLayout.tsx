// src/components/layout/AppLayout.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import BottomNavigation from './BottomNavigation';
import type { Language } from '@/types/i18n';

interface AppLayoutProps {
  children: React.ReactNode;
  lang: Language;
  hideNavigation?: boolean; // For immersive pages like story reading
}

export default function AppLayout({ children, lang, hideNavigation = false }: AppLayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Initialize from localStorage synchronously to prevent flash
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebarCollapsed') === 'true';
    }
    return false;
  });

  const handleSidebarToggle = (collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
    localStorage.setItem('sidebarCollapsed', String(collapsed));
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/${lang}/auth/login`);
    }
  }, [status, router, lang]);

  // Show loading state while checking auth
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">
            {lang === 'es' ? 'Cargando...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (status === 'unauthenticated') {
    return null;
  }

  // If navigation is hidden (e.g., story reading mode)
  if (hideNavigation) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen">
      {/* Sidebar - Desktop only */}
      <Sidebar lang={lang} collapsed={sidebarCollapsed} onToggle={handleSidebarToggle} />

      {/* Main Content Area */}
      <main
        className={`
          transition-all duration-300 ease-in-out
          ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-56'}
          min-h-screen
          pb-20 md:pb-0
        `}
      >
        {children}
      </main>

      {/* Bottom Navigation - Mobile only */}
      <BottomNavigation lang={lang} />
    </div>
  );
}
