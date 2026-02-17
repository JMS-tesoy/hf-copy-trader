'use client';

import { cn } from '@/lib/cn';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ children, className, padding = true }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900',
        padding && 'p-5',
        className
      )}
    >
      {children}
    </div>
  );
}
