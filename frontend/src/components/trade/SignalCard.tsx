'use client';

import { cn } from '@/lib/cn';

interface Trade {
  master_id: number;
  symbol: string;
  action: string;
  price: number;
  timestamp: Date;
}

function formatPrice(price: number) {
  return price > 100 ? price.toFixed(2) : price.toFixed(4);
}

interface SignalCardProps {
  trade: Trade | null;
}

export function SignalCard({ trade }: SignalCardProps) {
  const isBuy = trade?.action === 'BUY';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 flex flex-col items-center justify-center py-16 transition-all duration-500',
        trade
          ? isBuy
            ? 'border-emerald-500/30 animate-glow-green'
            : 'border-red-500/30 animate-glow-red'
          : 'border-gray-200 dark:border-slate-800'
      )}
    >
      {trade && (
        <div className={cn('absolute inset-0 opacity-5', isBuy ? 'bg-emerald-500' : 'bg-red-500')} />
      )}

      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-6 relative">
        Latest Signal
      </p>

      {trade ? (
        <div className="text-center relative animate-fade-in-down">
          <div
            className={cn(
              'inline-block px-4 py-1 rounded-full text-xs font-bold tracking-wider mb-4',
              isBuy
                ? 'bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20'
                : 'bg-red-500/10 text-red-500 ring-1 ring-red-500/20'
            )}
          >
            {trade.action}
          </div>
          <div className="text-5xl font-black tracking-tight font-mono">{trade.symbol}</div>
          <div className={cn('text-4xl font-bold mt-3 font-mono', isBuy ? 'text-emerald-500' : 'text-red-500')}>
            {formatPrice(trade.price)}
          </div>
          <div className="mt-4 text-xs text-gray-400 dark:text-slate-500">
            Master #{trade.master_id} &middot; {trade.timestamp.toLocaleTimeString()}
          </div>
        </div>
      ) : (
        <div className="text-center relative">
          <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-200 dark:border-slate-700 mx-auto mb-4 flex items-center justify-center">
            <span className="text-gray-300 dark:text-slate-600 text-lg">&#x2197;</span>
          </div>
          <p className="text-sm text-gray-400 dark:text-slate-600">Waiting for signals...</p>
        </div>
      )}
    </div>
  );
}
