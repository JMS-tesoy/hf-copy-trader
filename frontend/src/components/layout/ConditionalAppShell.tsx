'use client';

import { usePathname } from 'next/navigation';
import { AppShell } from './AppShell';

// Routes that render without the admin sidebar/shell
const BARE_ROUTES = ['/login', '/register', '/admin/login', '/portal'];

export function ConditionalAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isBare = BARE_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'));
  if (isBare) return <>{children}</>;
  return <AppShell>{children}</AppShell>;
}
