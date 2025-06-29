// src/components/ui/Typography.tsx
import React from 'react';
import clsx from 'clsx';

export const H1: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <h1 className={clsx('text-h1', className)}>{children}</h1>
);

export const H2: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <h2 className={clsx('text-h2', className)}>{children}</h2>
);

export const Body: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <p className={clsx('text-body', className)}>{children}</p>
);

export const Small: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <p className={clsx('text-small text-muted', className)}>{children}</p>
);