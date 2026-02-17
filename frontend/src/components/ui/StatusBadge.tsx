'use client';

import type { ConnectionStatus } from '@/lib/useTradeSocket';

const config: Record<ConnectionStatus, { dot: string; ring: string; text: string; label: string }> = {
  connected: {
    dot: 'bg-emerald-400',
    ring: 'bg-emerald-500/10 ring-1 ring-emerald-500/20',
    text: 'text-emerald-500',
    label: 'Live',
  },
  connecting: {
    dot: 'bg-amber-400 animate-pulse',
    ring: 'bg-amber-500/10 ring-1 ring-amber-500/20',
    text: 'text-amber-500',
    label: 'Connecting',
  },
  disconnected: {
    dot: 'bg-red-400',
    ring: 'bg-red-500/10 ring-1 ring-red-500/20',
    text: 'text-red-500',
    label: 'Offline',
  },
};

export function StatusBadge({ status }: { status: ConnectionStatus }) {
  const c = config[status];
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${c.ring}`}>
      <span className={`w-2 h-2 rounded-full ${c.dot}`} />
      <span className={`text-xs font-semibold tracking-wide uppercase ${c.text}`}>
        {c.label}
      </span>
    </div>
  );
}
