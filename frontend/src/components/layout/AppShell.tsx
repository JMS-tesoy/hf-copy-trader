'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileNav } from './MobileNav';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { useTradeSocket, type ConnectionStatus } from '@/lib/useTradeSocket';
import { useToast } from '@/components/notifications/useToast';
import { useAuth } from '@/lib/AuthContext';

interface Notification {
  id: string;
  type: string;
  title: string;
  message?: string;
  timestamp: Date;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const prevStatusRef = useRef<ConnectionStatus>('connecting');
  const { toast, dismissByType } = useToast();
  const { role, loading } = useAuth();
  const router = useRouter();

  // Persist sidebar state
  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored === 'true') setCollapsed(true);
  }, []);

  const toggleSidebar = useCallback(() => {
    setCollapsed((prev) => {
      localStorage.setItem('sidebar-collapsed', String(!prev));
      return !prev;
    });
  }, []);

  // Global trade socket for connection status + notifications
  const { status } = useTradeSocket((trade: any) => {
    const notif: Notification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'trade',
      title: `${trade.action} ${trade.symbol}`,
      message: `Master #${trade.master_id} @ ${trade.price > 100 ? trade.price.toFixed(2) : trade.price.toFixed(4)}`,
      timestamp: new Date(),
    };
    setNotifications((prev) => [notif, ...prev].slice(0, 50));
  });

  // Connection status toast
  useEffect(() => {
    const prev = prevStatusRef.current;
    if (prev !== status) {
      if (status === 'connected' && prev !== 'connecting') {
        dismissByType('error');
        toast({ type: 'success', title: 'Connected to trading engine' });
      } else if (status === 'disconnected') {
        toast({ type: 'error', title: 'Disconnected from trading engine', message: 'Reconnecting...' });
      }
      prevStatusRef.current = status;
    }
  }, [status, toast]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-gray-100">
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="relative">
          <TopBar
            onMenuClick={() => setMobileOpen(true)}
            status={status}
            notificationCount={notifications.length}
            onBellClick={() => setNotifOpen(!notifOpen)}
          />
          <NotificationCenter
            open={notifOpen}
            onClose={() => setNotifOpen(false)}
            notifications={notifications}
            onClear={() => setNotifications([])}
          />
        </div>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
