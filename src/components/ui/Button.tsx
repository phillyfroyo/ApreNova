// src/components/ui/Button.tsx
import React from 'react';
import clsx from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'accent' | 'muted' | 'button1';
  className?: string;
}

const baseStyles = 'px-6 py-2 rounded-full font-semibold transition-all duration-200';
const variants: Record<string, string> = {
  primary: 'bg-blue-500 text-white',
  accent: 'bg-purple-600 text-white',
  muted: 'bg-gray-300 text-black',
  button1: 'bg-[#1000c8] text-white drop-shadow-md hover:opacity-90 hover:scale-105',
};

export default function Button({ children, variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button className={clsx(baseStyles, variants[variant], className)} {...props}>
      {children}
    </button>
  );
}
