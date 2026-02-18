'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTradeSocket } from '@/lib/useTradeSocket';
import { API } from '@/lib/api';
import { StatCard } from '@/components/ui/StatCard';
import { SignalCard } from '@/components/trade/SignalCard';
import { LiveFeed } from '@/components/trade/LiveFeed';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { MiniAreaChart } from '@/components/charts/MiniAreaChart';
import { TradeVolumeChart } from '@/components/charts/TradeVolumeChart';
import { SymbolDistChart } from '@/components/charts/SymbolDistChart';
import { Activity, Crown, TrendingUp, BarChart3 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

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

export default function Home() {
  const { role, loading } = useAuth();
  const router = useRouter();
  const [lastTrade, setLastTrade] = useState<Trade | null>(null);

  // Redirect unauthenticated users to register by default
  useEffect(() => {
    if (!loading && !role) {
      router.push('/register');
    }
  }, [role, loading, router]);
  const [history, setHistory] = useState<Trade[]>([]);
  const [symbolFilter, setSymbolFilter] = useState<string>('all');

  // Load historical trades on mount
  useEffect(() => {
    fetch(`${API}/trades/history?limit=50`)
      .then((res) => res.json())
      .then((data) => {
        const trades: Trade[] = data.map((t: any) => ({
          master_id: t.master_id,
          symbol: t.symbol,
          action: t.action,
          price: t.price,
          timestamp: new Date(t.received_at),
        }));
        setHistory(trades);
        if (trades.length > 0) setLastTrade(trades[0]);
      })
      .catch(() => {});
  }, []);

  // Live trades via WebSocket
  useTradeSocket((trade: any) => {
    const newTrade: Trade = { ...trade, timestamp: new Date() };
    setLastTrade(newTrade);
    setHistory((prev) => [newTrade, ...prev].slice(0, 200));
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

  // Chart data: signal frequency per second
  const frequencyData = useMemo(() => {
    if (history.length === 0) return [];
    const buckets: Record<number, number> = {};
    history.forEach((t) => {
      const sec = Math.floor(t.timestamp.getTime() / 1000);
      buckets[sec] = (buckets[sec] || 0) + 1;
    });
    return Object.entries(buckets)
      .map(([sec, count]) => ({ time: Number(sec) as any, value: count }))
      .sort((a, b) => a.time - b.time);
  }, [history]);

  // Chart data: buy/sell volume histogram
  const volumeData = useMemo(() => {
    if (history.length === 0) return [];
    const buckets: Record<number, { buys: number; sells: number }> = {};
    history.forEach((t) => {
      const sec = Math.floor(t.timestamp.getTime() / 1000);
      if (!buckets[sec]) buckets[sec] = { buys: 0, sells: 0 };
      if (t.action === 'BUY') buckets[sec].buys++;
      else buckets[sec].sells++;
    });
    return Object.entries(buckets)
      .map(([sec, { buys, sells }]) => ({
        time: Number(sec) as any,
        value: buys + sells,
        color: buys >= sells ? '#22c55e80' : '#ef444480',
      }))
      .sort((a, b) => a.time - b.time);
  }, [history]);

  // Chart data: symbol distribution
  const symbolDist = useMemo(() => {
    const counts: Record<string, number> = {};
    history.forEach((t) => { counts[t.symbol] = (counts[t.symbol] || 0) + 1; });
    return Object.entries(counts).map(([symbol, count]) => ({ symbol, count }));
  }, [history]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Trades" sub="Historical + live" icon={Activity}>
          {stats.totalTrades}
        </StatCard>
        <StatCard label="Active Masters" sub="Unique senders" icon={Crown}>
          {stats.activeMasters}
        </StatCard>
        <StatCard label="Top Symbol" sub="Most traded" icon={TrendingUp}>
          <span className="font-mono">{stats.topSymbol}</span>
        </StatCard>
        <StatCard
          label="BUY / SELL"
          sub={stats.totalTrades > 0 ? `${Math.round((stats.buyCount / stats.totalTrades) * 100)}% buy ratio` : 'No data'}
          icon={BarChart3}
        >
          <span className="text-emerald-500">{stats.buyCount}</span>
          <span className="text-gray-300 dark:text-slate-600 mx-1">/</span>
          <span className="text-red-500">{stats.sellCount}</span>
        </StatCard>
      </div>

      {/* Main Grid: Signal + Live Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <SignalCard trade={lastTrade} />
        </div>
        <div className="lg:col-span-2">
          <LiveFeed trades={history} />
        </div>
      </div>

      {/* Mini Analytics Row */}
      {history.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <h3 className="text-sm font-semibold mb-3">Signal Frequency</h3>
            <MiniAreaChart data={frequencyData} color="#22c55e" />
          </Card>
          <Card>
            <h3 className="text-sm font-semibold mb-3">Trade Volume</h3>
            <TradeVolumeChart data={volumeData} />
          </Card>
          <Card>
            <h3 className="text-sm font-semibold mb-3">Symbol Distribution</h3>
            <SymbolDistChart data={symbolDist} />
          </Card>
        </div>
      )}

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
                    <Badge variant={t.action === 'BUY' ? 'buy' : 'sell'} size="sm">
                      {t.action}
                    </Badge>
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
    </div>
  );
}
