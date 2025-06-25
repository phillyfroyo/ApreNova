'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';

export default function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const handleLanguageChange = (lang) => {
    const pathParts = pathname.split('/');
    pathParts[1] = lang;
    const newPath = pathParts.join('/') || '/';
    startTransition(() => {
      router.push(newPath);
    });
  };

  return (
    <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
      <label style={{ marginRight: '0.5rem' }}>Site Language</label>
      <select
        onChange={(e) => handleLanguageChange(e.target.value)}
        defaultValue={pathname.split('/')[1]}
        disabled={isPending}
      >
        <option value="es">Español 🇲🇽</option>
        <option value="en">English 🇺🇸</option>
      </select>
    </div>
  );
}
