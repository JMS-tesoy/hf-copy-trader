'use client';

import { cn } from '@/lib/cn';
import { AlertTriangle, X } from 'lucide-react';
import { useEffect } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning';
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 max-w-md w-full animate-scale-in">
          <div className="flex items-start justify-between p-5 border-b border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                variant === 'danger' ? 'bg-red-500/10' : 'bg-amber-500/10'
              )}>
                <AlertTriangle className={cn(
                  'w-5 h-5',
                  variant === 'danger' ? 'text-red-500' : 'text-amber-500'
                )} />
              </div>
              <h3 className="text-lg font-bold">{title}</h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5">
            <p className="text-sm text-gray-600 dark:text-slate-400">{message}</p>
          </div>

          <div className="flex gap-3 p-5 border-t border-gray-100 dark:border-slate-800">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={cn(
                'flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-50',
                variant === 'danger'
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-amber-500 hover:bg-amber-600',
                loading && 'cursor-wait'
              )}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {confirmText}...
                </span>
              ) : confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
