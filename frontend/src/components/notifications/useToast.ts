'use client';

import { createContext, useContext, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'trade';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

export interface ToastInput {
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

export interface ToastContextType {
  addToast: (toast: ToastInput) => void;
  removeToast: (id: string) => void;
  removeByType: (type: ToastType) => void;
  toasts: Toast[];
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  const toast = useCallback(
    (input: ToastInput) => {
      context.addToast(input);
    },
    [context]
  );

  const dismissByType = useCallback(
    (type: ToastType) => {
      context.removeByType(type);
    },
    [context]
  );

  return { toast, dismissByType, toasts: context.toasts };
}
