// src/components/ui/Badge.tsx
import React from 'react';
import clsx from 'clsx';

interface BadgeProps {
  level?: 'level1' | 'level2' | 'level3' | 'level4' | 'level5';
  children: React.ReactNode;
}

const Badge: React.FC<BadgeProps> = ({ level = 'level1', children }) => {
  const levelClasses = {
    level1: 'bg-badge-level1',
    level2: 'bg-badge-level2',
    level3: 'bg-badge-level3',
    level4: 'bg-badge-level4',
    level5: 'bg-badge-level5',
  };

  return (
    <span className={clsx('text-xs px-3 py-1 rounded-full', levelClasses[level])}>
      {children}
    </span>
  );
};

export default Badge;
