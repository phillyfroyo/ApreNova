// src/components/layout/Sidebar.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import {
  Home,
  BookOpen,
  MessageCircle,
  Settings,
  ChevronLeft,
  ChevronRight,
  Crown,
  ChevronUp,
  Gem,
} from 'lucide-react';
import type { Language } from '@/types/i18n';

interface SidebarProps {
  lang: Language;
  collapsed: boolean;
  onToggle: (collapsed: boolean) => void;
}

interface NavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
  labelEs: string;
}

export default function Sidebar({ lang, collapsed, onToggle }: SidebarProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }

    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen]);

  const navItems: NavItem[] = [
    {
      href: `/${lang}/dashboard`,
      icon: <Home className="w-5 h-5" />,
      label: 'Home',
      labelEs: 'Inicio',
    },
    {
      href: `/${lang}/stories`,
      icon: <BookOpen className="w-5 h-5" />,
      label: 'Stories',
      labelEs: 'Historias',
    },
    {
      href: `/${lang}/tutor`,
      icon: <MessageCircle className="w-5 h-5" />,
      label: 'AI Tutor',
      labelEs: 'Tutor IA',
    },
  ];

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/');
  };

  const getLabel = (item: NavItem) => {
    return lang === 'es' ? item.labelEs : item.label;
  };

  return (
    <div className="hidden md:block fixed left-0 top-0 z-40 h-screen">
      {/* Collapse Toggle - outside aside to avoid overflow clipping */}
      <button
        onClick={() => onToggle(!collapsed)}
        className={`
          absolute top-20 z-50
          ${collapsed ? 'left-[52px]' : 'left-[212px]'}
          w-6 h-6 rounded-full
          bg-white border border-gray-200 shadow-md
          flex items-center justify-center
          text-gray-500 hover:text-indigo-600
          transition-all duration-300 ease-in-out
        `}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>

      <aside
        className={`
          flex flex-col
          ${collapsed ? 'w-16' : 'w-56'}
          h-screen
          border-r border-white/10
          bg-white/30 backdrop-blur-md shadow-md
          transition-[width] duration-300 ease-in-out
          overflow-hidden
        `}
      >
      {/* Logo Area */}
      <div className="p-4 border-b border-white/20">
        <Link href={`/${lang}/dashboard`} className="flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-indigo-600 flex-shrink-0" />
          <span
            className={`text-xl font-bold font-crimson drop-shadow-sm whitespace-nowrap transition-opacity ${collapsed ? 'opacity-0 duration-100' : 'opacity-100 duration-200 delay-150'}`}
          >
            <span className="text-indigo-700">
              {session?.user ? (lang === 'es' ? 'miCuent' : 'myCuent') : 'Cuent'}
            </span>
            <span className="text-purple-800">ana</span>
          </span>
        </Link>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg
                    transition-colors duration-200
                    ${active
                      ? 'bg-indigo-600/90 text-white font-medium shadow-sm'
                      : 'text-gray-800 hover:bg-white/50 hover:text-gray-900'
                    }
                  `}
                  title={collapsed ? getLabel(item) : undefined}
                >
                  <span className={`flex-shrink-0 ${active ? 'text-white' : 'text-gray-700'}`}>{item.icon}</span>
                  <span
                    className={`whitespace-nowrap transition-opacity ${collapsed ? 'opacity-0 duration-100' : 'opacity-100 duration-200 delay-150'}`}
                  >
                    {getLabel(item)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Section */}
      {session?.user && (
        <div ref={userMenuRef} className="relative p-3 border-t border-white/20 bg-white/30 backdrop-blur-sm">
          {/* User Menu Dropdown - appears above the user section */}
          {userMenuOpen && !collapsed && (
            <div className="absolute bottom-full left-0 right-0 mb-1 mx-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
              {/* Email display */}
              <div className="px-3 py-2 border-b border-gray-100">
                <p className="text-xs text-gray-500 truncate">{session.user.email}</p>
              </div>

              {/* Menu Items */}
              <div className="py-1">
                <Link
                  href={`/${lang}/settings`}
                  onClick={() => setUserMenuOpen(false)}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Settings className="w-4 h-4 text-gray-500" />
                  {lang === 'es' ? 'Ajustes' : 'Settings'}
                </Link>

                {!session.user.isPremium && (
                  <Link
                    href={`/${lang}/premium`}
                    onClick={() => setUserMenuOpen(false)}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Gem className="w-4 h-4 text-indigo-500" />
                    {lang === 'es' ? 'Hazte Premium' : 'Go Premium'}
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Clickable User Info */}
          <button
            onClick={() => !collapsed && setUserMenuOpen(!userMenuOpen)}
            className="w-full flex items-center gap-3 hover:bg-white/30 rounded-lg transition-colors p-1 -m-1"
          >
            {session.user.image ? (
              <Image
                src={session.user.image}
                alt="Profile"
                width={36}
                height={36}
                className="rounded-full ring-2 ring-white/50 flex-shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-medium text-sm ring-2 ring-white/50 flex-shrink-0">
                {session.user.name?.[0] || session.user.email?.[0] || '?'}
              </div>
            )}
            <div
              className={`flex-1 min-w-0 text-left transition-opacity ${collapsed ? 'opacity-0 duration-100' : 'opacity-100 duration-200 delay-150'}`}
            >
              <p className="text-sm font-medium text-gray-900 truncate">
                {session.user.name || 'User'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {/* Level badge with crown - orange */}
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium">
                  <Crown className="w-2.5 h-2.5" />
                  {session.user.quizLevel || 'Level 2'}
                </span>
                {/* Premium badge with gem - silver/gray */}
                {session.user.isPremium && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-700 text-[10px] font-medium">
                    <Gem className="w-2.5 h-2.5" />
                    PRO
                  </span>
                )}
              </div>
            </div>
            <ChevronUp
              className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-all ${collapsed ? 'opacity-0' : 'opacity-100'} ${userMenuOpen ? '' : 'rotate-180'}`}
            />
          </button>
        </div>
      )}

      </aside>
    </div>
  );
}
