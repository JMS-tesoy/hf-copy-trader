'use client';

import { cn } from '@/lib/cn';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  children: React.ReactNode;
  sub?: string;
  icon?: LucideIcon;
  className?: string;
}

export function StatCard({ label, children, sub, icon: Icon, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'p-5 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-lg transition-all duration-300',
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-slate-500">
          {label}
        </p>
        {Icon && <Icon className="w-4 h-4 text-gray-300 dark:text-slate-600" />}
      </div>
      <p className="text-3xl font-bold tracking-tight">{children}</p>
      {sub && (
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{sub}</p>
      )}
    </div>
  );
}
