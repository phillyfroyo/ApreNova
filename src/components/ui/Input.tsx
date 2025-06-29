import React from 'react';
import clsx from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export default function Input({ label, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col mb-2">
      {label && <label className="mb-1 text-sm font-semibold text-black">{label}</label>}
      <input
        {...props}
        className={clsx(
          'rounded-full px-4 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all',
          className
        )}
      />
    </div>
  );
}
