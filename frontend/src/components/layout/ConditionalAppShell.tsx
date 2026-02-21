'use client';

import { usePathname } from 'next/navigation';
import { AppShell } from './AppShell';

// Only admin dashboard routes should render with the admin sidebar/shell
const ADMIN_SHELL_ROUTES = ['/', '/master', '/user', '/analytics'];

export function ConditionalAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showAdminShell = ADMIN_SHELL_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'));
  if (!showAdminShell) return <>{children}</>;
  return <AppShell>{children}</AppShell>;
}
