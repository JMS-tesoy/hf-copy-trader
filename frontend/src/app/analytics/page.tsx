'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTradeSocket } from '@/lib/useTradeSocket';
import { API } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { MiniAreaChart } from '@/components/charts/MiniAreaChart';
import { TradeVolumeChart } from '@/components/charts/TradeVolumeChart';
import { SymbolDistChart } from '@/components/charts/SymbolDistChart';
import { PriceChart } from '@/components/charts/PriceChart';
import { Activity, TrendingUp, BarChart3, Clock, Filter } from 'lucide-react';

interface Trade {
  master_id: number;
  symbol: string;
  action: string;
  price: number;
  timestamp: Date;
}

export default function AnalyticsPage() {
  const [history, setHistory] = useState<Trade[]>([]);
  const [symbolFilter, setSymbolFilter] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('all');

  // Load historical trades on mount
  useEffect(() => {
    fetch(`${API}/trades/history?limit=500`)
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
      })
      .catch(() => {});
  }, []);

  // Live trades via WebSocket
  useTradeSocket((trade: any) => {
    const newTrade: Trade = { ...trade, timestamp: new Date() };
    setHistory((prev) => [newTrade, ...prev].slice(0, 500));
  });

  // Time-filtered trades
  const timeFiltered = useMemo(() => {
    if (timeRange === 'all') return history;
    const now = Date.now();
    const ranges: Record<string, number> = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
    };
    const cutoff = now - (ranges[timeRange] || 0);
    return history.filter((t) => t.timestamp.getTime() >= cutoff);
  }, [history, timeRange]);

  // Symbol + time filtered
  const filtered = useMemo(() => {
    if (symbolFilter === 'all') return timeFiltered;
    return timeFiltered.filter((t) => t.symbol === symbolFilter);
  }, [timeFiltered, symbolFilter]);

  const symbols = useMemo(() => [...new Set(history.map((t) => t.symbol))], [history]);

  // Stats
  const stats = useMemo(() => {
    const total = filtered.length;
    const buys = filtered.filter((t) => t.action === 'BUY').length;
    const sells = filtered.filter((t) => t.action === 'SELL').length;
    const masters = new Set(filtered.map((t) => t.master_id)).size;
    const avgPrice = total > 0 ? filtered.reduce((s, t) => s + t.price, 0) / total : 0;
    return { total, buys, sells, masters, avgPrice };
  }, [filtered]);

  // Signal frequency data (per-second buckets for area chart)
  const frequencyData = useMemo(() => {
    if (filtered.length === 0) return [];
    const buckets: Record<number, number> = {};
    filtered.forEach((t) => {
      const sec = Math.floor(t.timestamp.getTime() / 1000);
      buckets[sec] = (buckets[sec] || 0) + 1;
    });
    return Object.entries(buckets)
      .map(([sec, count]) => ({ time: Number(sec) as any, value: count }))
      .sort((a, b) => a.time - b.time);
  }, [filtered]);

  // Volume data (buy/sell histogram)
  const volumeData = useMemo(() => {
    if (filtered.length === 0) return [];
    const buckets: Record<number, { buys: number; sells: number }> = {};
    filtered.forEach((t) => {
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
  }, [filtered]);

  // Symbol distribution
  const symbolDist = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((t) => {
      counts[t.symbol] = (counts[t.symbol] || 0) + 1;
    });
    return Object.entries(counts).map(([symbol, count]) => ({ symbol, count }));
  }, [filtered]);

  // Price series (latest price per second)
  const priceData = useMemo(() => {
    if (filtered.length === 0) return [];
    const buckets: Record<number, number> = {};
    // Use reverse so later trades overwrite earlier (latest price per bucket)
    [...filtered].reverse().forEach((t) => {
      const sec = Math.floor(t.timestamp.getTime() / 1000);
      buckets[sec] = t.price;
    });
    return Object.entries(buckets)
      .map(([sec, price]) => ({ time: Number(sec) as any, value: price }))
      .sort((a, b) => a.time - b.time);
  }, [filtered]);

  function formatPrice(price: number) {
    return price > 100 ? price.toFixed(2) : price.toFixed(4);
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header + Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Real-time trade analysis &middot; {filtered.length} signals
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
            <select
              value={symbolFilter}
              onChange={(e) => setSymbolFilter(e.target.value)}
              className="text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="all">All Symbols</option>
              {symbols.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
            {['5m', '15m', '1h', '4h', 'all'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                }`}
              >
                {range === 'all' ? 'All' : range.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Signals" sub="Filtered" icon={Activity}>
          {stats.total}
        </StatCard>
        <StatCard label="BUY / SELL" sub={stats.total > 0 ? `${Math.round((stats.buys / stats.total) * 100)}% buy` : '--'} icon={BarChart3}>
          <span className="text-emerald-500">{stats.buys}</span>
          <span className="text-gray-300 dark:text-slate-600 mx-1">/</span>
          <span className="text-red-500">{stats.sells}</span>
        </StatCard>
        <StatCard label="Active Masters" sub="Unique senders" icon={TrendingUp}>
          {stats.masters}
        </StatCard>
        <StatCard label="Avg Price" sub="Filtered signals" icon={Clock}>
          <span className="font-mono">{stats.avgPrice > 0 ? formatPrice(stats.avgPrice) : '--'}</span>
        </StatCard>
      </div>

      {history.length === 0 ? (
        <EmptyState icon={BarChart3} title="No trade data yet" description="Charts will appear as signals arrive" />
      ) : (
        <>
          {/* Price Chart */}
          <Card>
            <PriceChart data={priceData} title="Price Timeline" />
          </Card>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <h3 className="text-sm font-semibold mb-3">Signal Frequency</h3>
              <MiniAreaChart data={frequencyData} color="#22c55e" height={180} />
            </Card>
            <Card>
              <h3 className="text-sm font-semibold mb-3">Trade Volume</h3>
              <TradeVolumeChart data={volumeData} height={180} />
            </Card>
            <Card>
              <h3 className="text-sm font-semibold mb-3">Symbol Distribution</h3>
              <SymbolDistChart data={symbolDist} />
            </Card>
          </div>

          {/* Trade Log Table */}
          <Card padding={false}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800">
              <div>
                <h2 className="text-sm font-semibold">Trade Log</h2>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{filtered.length} signals</p>
              </div>
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
                  {filtered.slice(0, 100).map((t, i) => (
                    <tr
                      key={`${t.timestamp.getTime()}-${i}`}
                      className="border-b border-gray-50 dark:border-slate-800/50 hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-6 py-3 text-gray-300 dark:text-slate-600 text-xs">{i + 1}</td>
                      <td className="px-6 py-3 text-gray-500 dark:text-slate-400 font-mono text-xs">
                        {t.timestamp.toLocaleTimeString()}
                      </td>
                      <td className="px-6 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-800 text-xs font-mono">
                          #{t.master_id}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-mono font-semibold">{t.symbol}</td>
                      <td className="px-6 py-3">
                        <Badge variant={t.action === 'BUY' ? 'buy' : 'sell'} size="sm">
                          {t.action}
                        </Badge>
                      </td>
                      <td className="px-6 py-3 text-right font-mono font-semibold">
                        {formatPrice(t.price)}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center text-gray-300 dark:text-slate-700 text-sm">
                        No trades match current filters
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
