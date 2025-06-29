import React from 'react';
import clsx from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export default function Input({ label, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col mb-3">
      {label && (
        <label className="mb-1 text-sm font-semibold text-black">{label}</label>
      )}
      <input
        {...props}
        className={clsx(
          'rounded-lg px-4 py-2 border border-gray-300 bg-white text-black shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200 ease-in-out',
          className
        )}
      />
    </div>
  );
}
