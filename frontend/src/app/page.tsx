'use client';

import { useState, useMemo } from 'react';
import { useTradeSocket, ConnectionStatus } from '@/lib/useTradeSocket';
import Navbar from '@/components/Navbar';

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

/* Connection Status Badge */
function StatusBadge({ status }: { status: ConnectionStatus }) {
  if (status === 'connected') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        <span className="text-xs font-semibold tracking-wide uppercase text-emerald-500">Live</span>
      </div>
    );
  }
  if (status === 'connecting') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 ring-1 ring-amber-500/20">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-xs font-semibold tracking-wide uppercase text-amber-500">Connecting</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 ring-1 ring-red-500/20">
      <span className="w-2 h-2 rounded-full bg-red-400" />
      <span className="text-xs font-semibold tracking-wide uppercase text-red-500">Offline</span>
    </div>
  );
}

/* Stat Card */
function StatCard({ label, children, sub }: { label: string; children: React.ReactNode; sub?: string }) {
  return (
    <div className="p-5 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-lg transition-all duration-300">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-2">{label}</p>
      <p className="text-3xl font-bold tracking-tight">{children}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function Home() {
  const [lastTrade, setLastTrade] = useState<Trade | null>(null);
  const [history, setHistory] = useState<Trade[]>([]);
  const [symbolFilter, setSymbolFilter] = useState<string>('all');

  const { status } = useTradeSocket((trade: any) => {
    const newTrade: Trade = { ...trade, timestamp: new Date() };
    setLastTrade(newTrade);
    setHistory((prev) => [newTrade, ...prev].slice(0, 50));
  });

  const stats = useMemo(() => {
    const totalTrades = history.length;
    const activeMasters = new Set(history.map((t) => t.master_id)).size;
    const buyCount = history.filter((t) => t.action === 'BUY').length;
    const sellCount = history.filter((t) => t.action === 'SELL').length;

    const symbolCounts: Record<string, number> = {};
    history.forEach((t) => {
      symbolCounts[t.symbol] = (symbolCounts[t.symbol] || 0) + 1;
    });
    const topSymbol = Object.entries(symbolCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '--';

    return { totalTrades, activeMasters, buyCount, sellCount, topSymbol };
  }, [history]);

  const symbols = useMemo(() => [...new Set(history.map((t) => t.symbol))], [history]);

  const filteredHistory = useMemo(() => {
    if (symbolFilter === 'all') return history;
    return history.filter((t) => t.symbol === symbolFilter);
  }, [history, symbolFilter]);

  const isBuy = lastTrade?.action === 'BUY';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-gray-100 transition-colors duration-300">

      <Navbar />

      {/* Connection Status */}
      <div className="max-w-7xl mx-auto px-6 pt-4">
        <StatusBadge status={status} />
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Trades" sub="Last 50 signals">
            {stats.totalTrades}
          </StatCard>
          <StatCard label="Active Masters" sub="Unique senders">
            {stats.activeMasters}
          </StatCard>
          <StatCard label="Top Symbol" sub="Most traded">
            <span className="font-mono">{stats.topSymbol}</span>
          </StatCard>
          <StatCard
            label="BUY / SELL"
            sub={stats.totalTrades > 0 ? `${Math.round((stats.buyCount / stats.totalTrades) * 100)}% buy ratio` : 'No data'}
          >
            <span className="text-emerald-500">{stats.buyCount}</span>
            <span className="text-gray-300 dark:text-slate-600 mx-1">/</span>
            <span className="text-red-500">{stats.sellCount}</span>
          </StatCard>
        </div>

        {/* Main Grid: Signal + Live Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">

          {/* Latest Signal — 3 cols */}
          <div className={`lg:col-span-3 relative overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 flex flex-col items-center justify-center py-16 transition-all duration-500 ${
            lastTrade
              ? isBuy
                ? 'border-emerald-500/30 animate-glow-green'
                : 'border-red-500/30 animate-glow-red'
              : 'border-gray-200 dark:border-slate-800'
          }`}>
            {lastTrade && (
              <div className={`absolute inset-0 ${isBuy ? 'bg-emerald-500' : 'bg-red-500'} opacity-5`} />
            )}

            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-6 relative">Latest Signal</p>

            {lastTrade ? (
              <div className="text-center relative animate-fade-in-down">
                <div className={`inline-block px-4 py-1 rounded-full text-xs font-bold tracking-wider mb-4 ${
                  isBuy
                    ? 'bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20'
                    : 'bg-red-500/10 text-red-500 ring-1 ring-red-500/20'
                }`}>
                  {lastTrade.action}
                </div>
                <div className="text-5xl font-black tracking-tight font-mono">
                  {lastTrade.symbol}
                </div>
                <div className={`text-4xl font-bold mt-3 font-mono ${isBuy ? 'text-emerald-500' : 'text-red-500'}`}>
                  {formatPrice(lastTrade.price)}
                </div>
                <div className="mt-4 text-xs text-gray-400 dark:text-slate-500">
                  Master #{lastTrade.master_id} · {lastTrade.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ) : (
              <div className="text-center relative">
                <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-200 dark:border-slate-700 mx-auto mb-4 flex items-center justify-center">
                  <span className="text-gray-300 dark:text-slate-600 text-lg">↗</span>
                </div>
                <p className="text-sm text-gray-400 dark:text-slate-600">Waiting for signals...</p>
              </div>
            )}
          </div>

          {/* Live Feed — 2 cols */}
          <div className="lg:col-span-2 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-500">Live Feed</h2>
                <span className="text-[10px] text-gray-300 dark:text-slate-600">Last 10</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-2">
              {history.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <p className="text-sm text-gray-300 dark:text-slate-700">No trades yet</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {history.slice(0, 10).map((t, i) => (
                    <div
                      key={`feed-${t.timestamp.getTime()}-${i}`}
                      className="animate-slide-in flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${t.action === 'BUY' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold font-mono">{t.symbol}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            t.action === 'BUY'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-red-500/10 text-red-500'
                          }`}>
                            {t.action}
                          </span>
                        </div>
                        <span className="text-[11px] text-gray-400 dark:text-slate-500">
                          #{t.master_id} · {t.timestamp.toLocaleTimeString()}
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
        </div>

        {/* Trade History Table */}
        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-semibold">Trade History</h2>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{filteredHistory.length} trades</p>
            </div>
            <select
              value={symbolFilter}
              onChange={(e) => setSymbolFilter(e.target.value)}
              className="text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all cursor-pointer"
            >
              <option value="all">All Symbols</option>
              {symbols.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-slate-500 border-b border-gray-100 dark:border-slate-800">
                  <th className="px-6 py-3 text-left">#</th>
                  <th className="px-6 py-3 text-left">Time</th>
                  <th className="px-6 py-3 text-left">Master</th>
                  <th className="px-6 py-3 text-left">Symbol</th>
                  <th className="px-6 py-3 text-left">Side</th>
                  <th className="px-6 py-3 text-right">Price</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {filteredHistory.map((t, i) => (
                  <tr
                    key={`row-${t.timestamp.getTime()}-${i}`}
                    className="border-b border-gray-50 dark:border-slate-800/50 hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-6 py-3.5 text-gray-300 dark:text-slate-600 text-xs">{i + 1}</td>
                    <td className="px-6 py-3.5 text-gray-500 dark:text-slate-400 font-mono text-xs">
                      {t.timestamp.toLocaleTimeString()}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-800 text-xs font-mono">
                        #{t.master_id}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-mono font-semibold">{t.symbol}</td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${
                        t.action === 'BUY'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-red-500/10 text-red-600 dark:text-red-400'
                      }`}>
                        {t.action}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-semibold">
                      {formatPrice(t.price)}
                    </td>
                  </tr>
                ))}
                {filteredHistory.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <p className="text-gray-300 dark:text-slate-700 text-sm">
                        {history.length === 0 ? 'Waiting for trades...' : 'No trades match this filter'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
