import React from 'react';
import clsx from 'clsx';

interface CardProps {
  className?: string;
  children: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ children, className }) => {
  return (
    <div
      className={clsx(
        // 🌈 Default glassmorphism style
        'bg-white/30 backdrop-blur-md border border-white/10 text-black shadow-md hover:shadow-lg rounded-xl p-6 max-w-md mx-auto transition-shadow duration-300',
        className
      )}
    >
      {children}
    </div>
  );
};

export default Card;
