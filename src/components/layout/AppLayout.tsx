// src/components/layout/AppLayout.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Sidebar from './Sidebar';
import BottomNavigation from './BottomNavigation';
import { BookOpen, Crown, Gem, Settings } from 'lucide-react';
import type { Language } from '@/types/i18n';
import { t } from '@/lib/t';
import { toCEFR } from '@/lib/cefr';

interface AppLayoutProps {
  children: React.ReactNode;
  lang: Language;
  hideNavigation?: boolean; // For immersive pages like story reading
  hideBottomNav?: boolean; // Hide mobile bottom nav (e.g., tutor page with its own input)
  requireAuth?: boolean; // Whether to require authentication (default: true)
}

export default function AppLayout({ children, lang, hideNavigation = false, hideBottomNav = false, requireAuth = true }: AppLayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

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

  // Close mobile menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    }
    if (mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen]);

  // Redirect to login if not authenticated (only when requireAuth is true)
  useEffect(() => {
    if (requireAuth && status === 'unauthenticated') {
      router.push(`/${lang}/auth/login`);
    }
  }, [requireAuth, status, router, lang]);

  // Show loading state while checking auth (only when auth is required)
  if (requireAuth && status === 'loading') {
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

  // Don't render if not authenticated (only when auth is required)
  if (requireAuth && status === 'unauthenticated') {
    return null;
  }

  // If navigation is hidden (e.g., story reading mode)
  if (hideNavigation) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen">
      {/* Mobile Header - Mobile only */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href={`/${lang}/dashboard`} className="flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-indigo-600" />
          <span className="text-lg font-bold font-crimson">
            <span className="text-indigo-700">
              {session?.user ? (lang === 'es' ? 'miCuent' : 'myCuent') : 'Cuent'}
            </span>
            <span className="text-purple-800">ana</span>
          </span>
          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded-full uppercase tracking-wide leading-none">
            beta
          </span>
        </Link>

        {/* User Profile */}
        {session?.user && (
          <div ref={mobileMenuRef} className="relative">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex items-center gap-2"
            >
              <div className="flex flex-col items-end">
                <p className="text-sm font-medium text-gray-900">
                  {session.user.name?.split(' ')[0] || 'User'}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium">
                    <Crown className="w-2.5 h-2.5" />
                    {toCEFR(session.user.quizLevel)}
                  </span>
                  {session.user.isPremium && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-700 text-[10px] font-medium">
                      <Gem className="w-2.5 h-2.5" />
                      PRO
                    </span>
                  )}
                </div>
              </div>
              {session.user.image ? (
                <Image
                  src={session.user.image}
                  alt="Profile"
                  width={36}
                  height={36}
                  className="rounded-full ring-2 ring-indigo-200"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-medium text-sm ring-2 ring-indigo-200">
                  {session.user.name?.[0] || session.user.email?.[0] || '?'}
                </div>
              )}
            </button>

            {/* Dropdown Menu */}
            {mobileMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900 truncate">{session.user.name}</p>
                  <p className="text-xs text-gray-500 truncate">{session.user.email}</p>
                </div>
                <Link
                  href={`/${lang}/settings`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Settings className="w-4 h-4 text-gray-500" />
                  {lang === 'es' ? 'Ajustes' : 'Settings'}
                </Link>
                {!session.user.isPremium && (
                  <Link
                    href={`/${lang}/premium`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Gem className="w-4 h-4 text-indigo-500" />
                    {t(lang, "sidebar", "goPremium")}
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Sidebar - Desktop only */}
      <Sidebar lang={lang} collapsed={sidebarCollapsed} onToggle={handleSidebarToggle} />

      {/* Main Content Area */}
      <main
        className={`
          transition-all duration-300 ease-in-out
          ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-56'}
          min-h-screen
          pt-16 md:pt-0
          ${hideBottomNav ? 'pb-0' : 'pb-20 md:pb-0'}
        `}
      >
        {children}
      </main>

      {/* Bottom Navigation - Mobile only */}
      {!hideBottomNav && <BottomNavigation lang={lang} />}
    </div>
  );
}
