import React from 'react';
import clsx from 'clsx';

interface CardProps {
  className?: string;
  children: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ children, className }) => {
  return (
    <div className={clsx('bg-white rounded-xl shadow-strong p-6 max-w-md mx-auto', className)}>
      {children}
    </div>
  );
};

export default Card;