// src/components/layout/BottomNavigation.tsx
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, BookOpen, MessageCircle, User } from 'lucide-react';
import type { Language } from '@/types/i18n';

interface BottomNavigationProps {
  lang: Language;
}

interface NavItem {
  href: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
  label: string;
  labelEs: string;
}

export default function BottomNavigation({ lang }: BottomNavigationProps) {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    {
      href: `/${lang}/dashboard`,
      icon: <Home className="w-6 h-6" strokeWidth={1.5} />,
      activeIcon: <Home className="w-6 h-6" strokeWidth={2} />,
      label: 'Home',
      labelEs: 'Inicio',
    },
    {
      href: `/${lang}/stories`,
      icon: <BookOpen className="w-6 h-6" strokeWidth={1.5} />,
      activeIcon: <BookOpen className="w-6 h-6" strokeWidth={2} />,
      label: 'Stories',
      labelEs: 'Historias',
    },
    {
      href: `/${lang}/tutor`,
      icon: <MessageCircle className="w-6 h-6" strokeWidth={1.5} />,
      activeIcon: <MessageCircle className="w-6 h-6" strokeWidth={2} />,
      label: 'Tutor',
      labelEs: 'Tutor',
    },
    {
      href: `/${lang}/settings`,
      icon: <User className="w-6 h-6" strokeWidth={1.5} />,
      activeIcon: <User className="w-6 h-6" strokeWidth={2} />,
      label: 'Profile',
      labelEs: 'Perfil',
    },
  ];

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/');
  };

  const getLabel = (item: NavItem) => {
    return lang === 'es' ? item.labelEs : item.label;
  };

  return (
    <nav
      className="
        md:hidden fixed bottom-0 left-0 right-0 z-50
        bg-white/95 backdrop-blur-md
        border-t border-gray-200
        safe-area-bottom
      "
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex flex-col items-center justify-center
                flex-1 h-full py-1
                transition-colors duration-200
                ${active ? 'text-indigo-600' : 'text-gray-500'}
              `}
            >
              <span className="mb-0.5">
                {active ? item.activeIcon : item.icon}
              </span>
              <span className={`text-[10px] ${active ? 'font-medium' : ''}`}>
                {getLabel(item)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
