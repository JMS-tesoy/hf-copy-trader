'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ToastContext, type Toast, type ToastInput } from './useToast';
import { ToastItem } from './Toast';

const MAX_TOASTS = 5;
const DEFAULT_DURATION = 5000;
const TRADE_DURATION = 3000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    setMounted(true);
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const removeToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const removeByType = useCallback((type: string) => {
    setToasts((prev) => {
      const remaining = prev.filter((t) => {
        if (t.type === type) {
          const timer = timersRef.current.get(t.id);
          if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(t.id);
          }
          return false;
        }
        return true;
      });
      return remaining;
    });
  }, []);

  const addToast = useCallback(
    (input: ToastInput) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const duration = input.duration ?? (input.type === 'trade' ? TRADE_DURATION : DEFAULT_DURATION);

      const toast: Toast = { ...input, id };

      setToasts((prev) => {
        const next = [...prev, toast];
        // Keep only the latest MAX_TOASTS
        if (next.length > MAX_TOASTS) {
          const removed = next.shift();
          if (removed) {
            const timer = timersRef.current.get(removed.id);
            if (timer) {
              clearTimeout(timer);
              timersRef.current.delete(removed.id);
            }
          }
        }
        return next;
      });

      const timer = setTimeout(() => {
        removeToast(id);
      }, duration);
      timersRef.current.set(id, timer);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, removeByType }}>
      {children}
      {mounted &&
        createPortal(
          <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80 max-sm:left-4 max-sm:right-4 max-sm:w-auto">
            {toasts.map((t) => (
              <ToastItem key={t.id} toast={t} onDismiss={() => removeToast(t.id)} />
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}
