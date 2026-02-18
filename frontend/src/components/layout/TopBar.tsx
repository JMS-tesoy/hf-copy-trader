'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from '@/lib/ThemeContext';
import { Menu, Bell, Sun, Moon, LogOut } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { ConnectionStatus } from '@/lib/useTradeSocket';
import { useAuth } from '@/lib/AuthContext';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/master': 'Master Traders',
  '/user': 'Users',
  '/analytics': 'Analytics',
};

interface TopBarProps {
  onMenuClick: () => void;
  status: ConnectionStatus;
  notificationCount?: number;
  onBellClick?: () => void;
}

export function TopBar({ onMenuClick, status, notificationCount = 0, onBellClick }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { logout } = useAuth();
  const title = pageTitles[pathname] || 'HF Copy Trader';

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <header className="h-14 flex items-center justify-between px-4 lg:px-6 border-b border-gray-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 glass sticky top-0 z-40 flex-shrink-0">
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={onMenuClick}
          className="lg:hidden w-9 h-9 rounded-xl border border-gray-200 dark:border-slate-700 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center">
            <span className="text-white text-xs font-black">HF</span>
          </div>
        </div>

        <h2 className="hidden lg:block text-lg font-bold tracking-tight">{title}</h2>
      </div>

      <div className="flex items-center gap-3">
        <StatusBadge status={status} />

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-9 h-9 rounded-xl border border-gray-200 dark:border-slate-700 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-gray-500 dark:text-slate-400"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notification bell */}
        <button
          onClick={onBellClick}
          className="relative w-9 h-9 rounded-xl border border-gray-200 dark:border-slate-700 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </button>

        {/* Admin logout */}
        <button
          onClick={handleLogout}
          className="w-9 h-9 rounded-xl border border-gray-200 dark:border-slate-700 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-800 transition-colors text-gray-500 dark:text-slate-400 hover:text-red-500"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
