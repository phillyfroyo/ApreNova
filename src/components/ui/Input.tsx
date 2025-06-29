import React from 'react';
import clsx from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

const Input: React.FC<InputProps> = ({ className, ...props }) => {
  return (
    <input
      className={clsx(
        'w-full px-4 py-2 rounded-xl border border-muted bg-muted/20 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary transition',
        className
      )}
      {...props}
    />
  );
};

export default Input;
