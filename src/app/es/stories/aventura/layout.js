// src/app/es/stories/aventura/layout.js
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './aventura.css';

const storyParts = Array.from({ length: 10 }, (_, i) => `part-${i + 1}`);

export default function AventuraLayout({ children }) {
  const pathname = usePathname();

  // Extract current level from path (e.g., 'l1', 'l2', etc.)
  const pathParts = pathname.split('/');
  const currentLevel = pathParts[4] || 'l1'; // fallback just in case
  const currentPart = pathParts[5] || 'part-1';

  return (
    <div className="aventura-container">
      <div style={{
          position: "fixed",
          top: "20px",
          left: "30px",
          zIndex: 1000,
          display: "flex",
          gap: "8px",
          fontSize: "1rem"
        }}>
          {[...Array(10)].map((_, i) => {
            const partLabel = `part-${i + 1}`;
            return (
              <button
                key={partLabel}
                onClick={() => window.location.href = `/es/stories/aventura/${currentLevel}/part-${i + 1}`}
                style={{
                  backgroundColor: partLabel === currentPart ? "#333" : "#fff",
                  color: partLabel === currentPart ? "#fff" : "#000",
                  border: "1px solid #ccc",
                  padding: "4px 8px",
                  cursor: "pointer"
                }}
              >
                {`PART ${i + 1}`}
              </button>
            );
          })}
        </div>
      <div className="content">{children}</div>
    </div>
  );
}
