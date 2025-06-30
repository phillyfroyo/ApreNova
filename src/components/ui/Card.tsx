// src/components/ui/Card.tsx
import React from 'react';
import clsx from 'clsx';
import { cardPresets } from '@/styles/cardPresets';

interface CardProps {
  className?: string;
  children: React.ReactNode;
  variant?: keyof typeof cardPresets; // 👈 new
}

const Card: React.FC<CardProps> = ({ children, className, variant }) => {
  const presetClass = variant ? cardPresets[variant] : '';
  return (
    <div
      className={clsx(
        'transition-shadow duration-300 max-w-md mx-auto', // base
        presetClass,
        className
      )}
    >
      {children}
    </div>
  );
};

export default Card;
