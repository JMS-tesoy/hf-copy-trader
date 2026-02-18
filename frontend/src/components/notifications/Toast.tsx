'use client';

import { cn } from '@/lib/cn';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  TrendingUp,
  X,
} from 'lucide-react';
import type { Toast as ToastData } from './useToast';

const typeConfig: Record<string, { icon: typeof CheckCircle; colors: string }> = {
  success: { icon: CheckCircle, colors: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400' },
  error: { icon: XCircle, colors: 'border-red-500/20 bg-red-500/5 text-red-600 dark:text-red-400' },
  warning: { icon: AlertTriangle, colors: 'border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400' },
  info: { icon: Info, colors: 'border-blue-500/20 bg-blue-500/5 text-blue-600 dark:text-blue-400' },
  trade: { icon: TrendingUp, colors: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400' },
};

interface ToastProps {
  toast: ToastData;
  onDismiss: () => void;
}

export function ToastItem({ toast, onDismiss }: ToastProps) {
  const config = typeConfig[toast.type] || typeConfig.info;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm animate-toast-in',
        'bg-white dark:bg-slate-900',
        config.colors
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{toast.title}</p>
        {toast.message && (
          <p className="text-xs mt-0.5 opacity-80">{toast.message}</p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
