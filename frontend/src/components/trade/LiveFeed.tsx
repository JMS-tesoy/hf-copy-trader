'use client';

import { Badge } from '@/components/ui/Badge';

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

interface LiveFeedProps {
  trades: Trade[];
  maxItems?: number;
}

export function LiveFeed({ trades, maxItems = 10 }: LiveFeedProps) {
  const visible = trades.slice(0, maxItems);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-hidden h-full">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-500">
            Live Feed
          </h2>
          <span className="text-[10px] text-gray-300 dark:text-slate-600">Last {maxItems}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {visible.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-gray-300 dark:text-slate-700">No trades yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {visible.map((t, i) => (
              <div
                key={`feed-${t.timestamp.getTime()}-${i}`}
                className="animate-slide-in flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div
                  className={`w-1.5 h-8 rounded-full flex-shrink-0 ${
                    t.action === 'BUY' ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold font-mono">{t.symbol}</span>
                    <Badge variant={t.action === 'BUY' ? 'buy' : 'sell'} size="xs">
                      {t.action}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-gray-400 dark:text-slate-500">
                    #{t.master_id} &middot; {t.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <span className="text-sm font-mono font-semibold text-gray-700 dark:text-slate-300">
                  {formatPrice(t.price)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
