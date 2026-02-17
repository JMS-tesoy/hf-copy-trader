'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, className }: EmptyStateProps) {
  return (
    <div className={cn('text-center py-16', className)}>
      <div className="w-14 h-14 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700 mx-auto mb-4 flex items-center justify-center">
        {Icon ? (
          <Icon className="w-6 h-6 text-gray-300 dark:text-slate-600" />
        ) : (
          <span className="text-xl text-gray-300 dark:text-slate-600">&#x2197;</span>
        )}
      </div>
      <p className="text-sm text-gray-400 dark:text-slate-500 font-medium">{title}</p>
      {description && (
        <p className="text-xs text-gray-300 dark:text-slate-600 mt-1">{description}</p>
      )}
    </div>
  );
}
