'use client';

import { ThemeProvider } from '@/lib/ThemeContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
