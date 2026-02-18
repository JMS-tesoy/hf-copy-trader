'use client';

import { ThemeProvider } from '@/lib/ThemeContext';
import { ToastProvider } from '@/components/notifications/ToastProvider';
import { AuthProvider } from '@/lib/AuthContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
