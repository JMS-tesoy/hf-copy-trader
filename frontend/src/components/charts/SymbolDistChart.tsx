'use client';

interface SymbolData {
  symbol: string;
  count: number;
}

interface SymbolDistChartProps {
  data: SymbolData[];
  maxItems?: number;
}

export function SymbolDistChart({ data, maxItems = 6 }: SymbolDistChartProps) {
  const sorted = [...data].sort((a, b) => b.count - a.count).slice(0, maxItems);
  const max = sorted[0]?.count || 1;

  const colors = [
    'bg-emerald-500', 'bg-cyan-500', 'bg-violet-500',
    'bg-amber-500', 'bg-rose-500', 'bg-blue-500',
  ];

  return (
    <div className="space-y-2.5">
      {sorted.map((item, i) => (
        <div key={item.symbol} className="flex items-center gap-3">
          <span className="text-xs font-mono w-16 text-right text-gray-500 dark:text-slate-400 shrink-0">
            {item.symbol}
          </span>
          <div className="flex-1 h-5 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full ${colors[i % colors.length]} transition-all duration-500`}
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
          <span className="text-xs font-mono w-8 text-gray-400 dark:text-slate-500">
            {item.count}
          </span>
        </div>
      ))}
      {sorted.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-4">No data yet</p>
      )}
    </div>
  );
}
