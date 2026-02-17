'use client';

import { cn } from '@/lib/cn';

const variants: Record<string, string> = {
  buy: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20',
  sell: 'bg-red-500/10 text-red-600 dark:text-red-400 ring-1 ring-red-500/20',
  active: 'bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20',
  paused: 'bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20',
  open: 'bg-blue-500/10 text-blue-500',
  closed: 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400',
  neutral: 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400',
  danger: 'bg-red-500/10 text-red-600 dark:text-red-400 ring-1 ring-red-500/20',
};

interface BadgeProps {
  variant: string;
  children: React.ReactNode;
  className?: string;
  size?: 'xs' | 'sm';
}

export function Badge({ variant, children, className, size = 'xs' }: BadgeProps) {
  const variantClass = variants[variant.toLowerCase()] || variants.neutral;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-bold uppercase tracking-wide',
        size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        variantClass,
        className
      )}
    >
      {children}
    </span>
  );
}
