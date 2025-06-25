// src/app/es/stories/aventura/layout.js
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './aventura.css';

const storyParts = Array.from({ length: 10 }, (_, i) => `part-${i + 1}`);

export default function AventuraLayout({ children }) {
  const pathname = usePathname();

  return (
    <div className="aventura-container">
      <div className="sidebar">
        {storyParts.map((part) => (
          <Link
            key={part}
            href={`/es/stories/aventura/${part}`}
            className={`tab ${pathname.includes(part) ? 'active' : ''}`}
          >
            {part.replace('-', ' ').toUpperCase()}
          </Link>
        ))}
      </div>
      <div className="content">{children}</div>
    </div>
  );
}
