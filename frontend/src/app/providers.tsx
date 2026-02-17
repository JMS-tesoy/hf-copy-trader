'use client';

import { ThemeProvider } from '@/lib/ThemeContext';
import { ToastProvider } from '@/components/notifications/ToastProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </ThemeProvider>
  );
}
