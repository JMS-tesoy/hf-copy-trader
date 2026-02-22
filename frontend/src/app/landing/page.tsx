'use client';

import Link from 'next/link';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { API } from '@/lib/api';
import { Crown, Users, BarChart3, Zap, CheckCircle2, ArrowRight, Sparkles, Activity, Clock3, Shield, TrendingUp, Globe, Lock, ChevronDown, Server } from 'lucide-react';

interface SubscriptionTier {
  id: number;
  name: string;
  max_concurrent_positions: number;
  commission_percent: number;
  features: string[];
  monthly_fee: number;
}

interface LeaderboardMaster {
  id: number;
  name: string;
  status: string;
  bio: string | null;
  subscriber_count: number | string;
  signal_count: number | string;
  avg_win_rate: number | string;
  last_signal_at: string | null;
  created_at: string;
}

interface PerformanceSeriesPoint {
  t: string;
  p: number;
  c: number;
}

interface PerformanceSeriesByMaster {
  master_id: number;
  series: PerformanceSeriesPoint[];
}

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return 0;
}

function formatTierName(name: string): string {
  if (!name) return 'Plan';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function formatCount(value: string | number): string {
  return new Intl.NumberFormat().format(toNumber(value));
}

function formatLastSignal(value: string | null): string {
  if (!value) return 'No signal yet';
  const dt = new Date(value);
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (!parts.length) return 'M';
  return parts.map((p) => p.charAt(0).toUpperCase()).join('');
}

function formatCompactUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}

function estimateAum(subscriberCount: string | number): number {
  const followers = toNumber(subscriberCount);
  const assumedCapitalPerFollower = 10000;
  return followers * assumedCapitalPerFollower;
}

function getPerformanceStatus(avgWinRate: string | number): {
  label: string;
  className: string;
} {
  const rate = toNumber(avgWinRate);
  if (rate >= 70) {
    return { label: 'Excellent', className: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' };
  }
  if (rate >= 55) {
    return { label: 'Stable', className: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10' };
  }
  return { label: 'Watchlist', className: 'text-amber-300 border-amber-500/30 bg-amber-500/10' };
}

function buildSparklinePoints(series: PerformanceSeriesPoint[]): string {
  if (!series.length) return '';
  const width = 100;
  const height = 30;
  const values = series.map((s) => s.c);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values
    .map((value, idx) => {
      const x = (idx / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

function TiltCard({ children, className }: { children: React.ReactNode; className: string }) {
  const ref = useRef<HTMLElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top)  / rect.height - 0.5;
    el.style.transform =
      `perspective(800px) rotateY(${x * 14}deg) rotateX(${-y * 10}deg) scale3d(1.03, 1.03, 1.03)`;
  };

  const handleMouseLeave = () => {
    if (ref.current) {
      ref.current.style.transform =
        'perspective(800px) rotateY(0deg) rotateX(0deg) scale3d(1, 1, 1)';
    }
  };

  return (
    <article
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transition: 'transform 0.18s ease-out', willChange: 'transform' }}
    >
      {children}
    </article>
  );
}

// Rotations for up to 5 cards, matching the example's style
const DECK_ROTATIONS = [-20, -10, 0, 10, 20];

function StackedMasters({
  masters,
  performanceByMaster,
}: {
  masters: LeaderboardMaster[];
  performanceByMaster: Record<number, PerformanceSeriesPoint[]>;
}) {
  const [hovered, setHovered] = useState(false);
  const displayed = masters.slice(0, 5);
  const count = displayed.length;

  return (
    <div
      className="flex items-center justify-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {displayed.map((master, i) => {
        const r = DECK_ROTATIONS[i] ?? 0;
        const centerDist = Math.abs(i - Math.floor(count / 2));
        const zIndex = hovered ? i + 1 : count - centerDist;
        const performance = getPerformanceStatus(master.avg_win_rate);
        const series = performanceByMaster[master.id] || [];
        const points = series.length >= 2 ? buildSparklinePoints(series) : '';
        const positive = series.length >= 2 && series[series.length - 1].c >= series[0].c;

        return (
          <div
            key={master.id}
            style={{
              flexShrink: 0,
              width: 210,
              zIndex,
              transform: hovered ? 'rotate(0deg)' : `rotate(${r}deg)`,
              margin: hovered ? '0 10px' : '0 -52px',
              transition: 'transform 0.5s ease, margin 0.5s ease',
              transformOrigin: 'bottom center',
            }}
          >
            <TiltCard className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-transparent shadow-2xl shadow-black/50 backdrop-blur-md hover:border-emerald-500/40">
              <div className="p-4">
                {/* Header */}
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400/30 to-cyan-400/20 text-xs font-bold text-emerald-200 ring-1 ring-emerald-500/20">
                      {initials(master.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] uppercase tracking-widest text-slate-500">#{master.id}</p>
                      <h3 className="truncate text-sm font-semibold text-white">{master.name}</h3>
                    </div>
                  </div>
                  <span className="flex-shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-500/25">
                    #{i + 1}
                  </span>
                </div>

                {/* Win rate hero */}
                <div className="mb-3 text-center">
                  <p className="text-3xl font-bold text-white">{toNumber(master.avg_win_rate).toFixed(1)}%</p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Avg win rate</p>
                </div>

                {/* Sparkline */}
                {series.length >= 2 && (
                  <div className="mb-3 rounded-lg border border-white/5 bg-black/20 p-2">
                    <div className="mb-1 flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-500">
                      <span>Performance</span>
                      <span className={positive ? 'text-emerald-300' : 'text-rose-300'}>
                        {positive ? '+' : ''}{(series[series.length - 1].c - series[0].c).toFixed(1)} pips
                      </span>
                    </div>
                    <svg viewBox="0 0 100 24" className="h-6 w-full">
                      <polyline fill="none" stroke={positive ? '#34d399' : '#fb7185'} strokeWidth="2" points={points} vectorEffect="non-scaling-stroke" />
                    </svg>
                  </div>
                )}

                {/* Stats 2-col */}
                <div className="mb-3 grid grid-cols-2 gap-1.5 text-center">
                  <div className="rounded-lg border border-white/5 bg-black/20 px-2 py-1.5">
                    <p className="text-sm font-bold text-white">{formatCount(master.subscriber_count)}</p>
                    <p className="text-[9px] uppercase tracking-wider text-slate-500">Followers</p>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-black/20 px-2 py-1.5">
                    <p className="text-sm font-bold text-white">{formatCount(master.signal_count)}</p>
                    <p className="text-[9px] uppercase tracking-wider text-slate-500">Signals</p>
                  </div>
                </div>

                {/* Performance badge */}
                <div className="flex items-center justify-center">
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${performance.className}`}>
                    {performance.label}
                  </span>
                </div>
              </div>

              {/* data-text label at bottom — matches example's ::before */}
              <div className="flex h-10 items-center justify-center border-t border-white/5 bg-white/5 text-xs font-medium text-white/80">
                {master.name}
              </div>
            </TiltCard>
          </div>
        );
      })}
    </div>
  );
}

export default function LandingPage() {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [masters, setMasters] = useState<LeaderboardMaster[]>([]);
  const [performanceByMaster, setPerformanceByMaster] = useState<Record<number, PerformanceSeriesPoint[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setLoadError('');
      try {
        const [tiersRes, mastersRes] = await Promise.all([
          fetch(`${API}/subscription-tiers`),
          fetch(`${API}/masters/leaderboard?sort=followers`),
        ]);

        if (!tiersRes.ok || !mastersRes.ok) {
          throw new Error('Failed to load landing page data');
        }

        const [tiersData, mastersData] = await Promise.all([tiersRes.json(), mastersRes.json()]);
        const mastersList = Array.isArray(mastersData) ? mastersData : [];
        const topMasterIds = [...mastersList]
          .sort((a, b) => toNumber(b.subscriber_count) - toNumber(a.subscriber_count))
          .slice(0, 10)
          .map((m) => m.id)
          .filter((id) => Number.isInteger(id));

        let performanceList: PerformanceSeriesByMaster[] = [];
        if (topMasterIds.length > 0) {
          const perfRes = await fetch(`${API}/masters/performance-series?master_ids=${topMasterIds.join(',')}&limit=20`);
          if (perfRes.ok) {
            const perfData = await perfRes.json();
            performanceList = Array.isArray(perfData) ? perfData : [];
          }
        }

        if (!cancelled) {
          setTiers(Array.isArray(tiersData) ? tiersData : []);
          setMasters(mastersList);
          const map: Record<number, PerformanceSeriesPoint[]> = {};
          for (const row of performanceList) {
            if (row && Number.isInteger(row.master_id) && Array.isArray(row.series)) {
              map[row.master_id] = row.series;
            }
          }
          setPerformanceByMaster(map);
        }
      } catch (err: any) {
        if (!cancelled) setLoadError(err?.message || 'Failed to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, []);

  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const topMasters = useMemo(() => {
    return [...masters]
      .sort((a, b) => toNumber(b.subscriber_count) - toNumber(a.subscriber_count))
      .slice(0, 10);
  }, [masters]);

  const platformStats = useMemo(() => ({
    totalMasters: masters.length,
    totalFollowers: masters.reduce((s, m) => s + toNumber(m.subscriber_count), 0),
    totalSignals: masters.reduce((s, m) => s + toNumber(m.signal_count), 0),
    avgWinRate: masters.length
      ? masters.reduce((s, m) => s + toNumber(m.avg_win_rate), 0) / masters.length
      : 0,
  }), [masters]);

  const TICKER_SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD', 'AUDUSD', 'USDCAD', 'GBPJPY'];
  const tickerItems = useMemo(() => {
    if (!masters.length) return [];
    return Array.from({ length: 14 }, (_, i) => {
      const master = masters[i % masters.length];
      return `User #${1000 + i * 43} copied ${i % 2 === 0 ? 'BUY' : 'SELL'} ${TICKER_SYMBOLS[i % TICKER_SYMBOLS.length]} from ${master.name.split(' ')[0]} · ${(i * 7 + 5) % 58}s ago`;
    });
  }, [masters]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-20 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute top-24 -right-24 h-[28rem] w-[28rem] rounded-full bg-cyan-500/20 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-10 md:py-14">
        <section className="grid gap-8 md:grid-cols-2 md:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs uppercase tracking-wider text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              Live Copy Trading Platform
            </div>
            <h1 className="text-4xl font-bold leading-tight text-white md:text-5xl">
              Follow elite masters.
              <span className="block bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
                Automate your execution.
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300 md:text-base">
              Subscribe to proven traders, mirror positions in real-time, and control your risk from a single portal.
              Transparent tiers, measurable performance, and low-latency delivery.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white hover:from-emerald-400 hover:to-cyan-400 transition-all">
                Start as Copy Trader <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/master-register" className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 hover:border-slate-500 hover:text-white transition-colors">
                Become a Master
              </Link>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              Already have an account?{' '}
              <Link href="/login" className="text-slate-300 hover:text-white transition-colors">
                Sign in
              </Link>
            </p>
          </div>

          <style>{`
            .hf-hero-card {
              background: #111827;
              border-radius: 1rem;
              padding: 1rem;
              border: 1px solid rgba(255,255,255,0.07);
              box-shadow: 0 4px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.07);
              transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
              cursor: default;
            }
            .hf-hero-card:hover { transform: translateY(-7px); }
            .hf-hero-emerald:hover {
              box-shadow: 0 18px 48px rgba(52,211,153,0.28), 0 4px 12px rgba(52,211,153,0.14), inset 0 1px 0 rgba(255,255,255,0.09);
              border-color: rgba(52,211,153,0.35);
            }
            .hf-hero-cyan:hover {
              box-shadow: 0 18px 48px rgba(34,211,238,0.28), 0 4px 12px rgba(34,211,238,0.14), inset 0 1px 0 rgba(255,255,255,0.09);
              border-color: rgba(34,211,238,0.35);
            }
            .hf-hero-yellow:hover {
              box-shadow: 0 18px 48px rgba(253,224,71,0.22), 0 4px 12px rgba(253,224,71,0.12), inset 0 1px 0 rgba(255,255,255,0.09);
              border-color: rgba(253,224,71,0.32);
            }
          `}</style>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Tracked Masters', value: topMasters.length, icon: Crown, card: 'hf-hero-emerald', iconClass: 'text-emerald-300 bg-emerald-400/10' },
              { label: 'Total Followers', value: topMasters.reduce((sum, m) => sum + toNumber(m.subscriber_count), 0), icon: Users, card: 'hf-hero-cyan', iconClass: 'text-cyan-300 bg-cyan-400/10' },
              { label: 'Live Signals', value: topMasters.reduce((sum, m) => sum + toNumber(m.signal_count), 0), icon: Zap, card: 'hf-hero-yellow', iconClass: 'text-yellow-300 bg-yellow-400/10' },
            ].map(({ label, value, icon: Icon, card, iconClass }) => (
              <div key={label} className={`hf-hero-card ${card}`}>
                <div className={`inline-flex rounded-xl p-2 ${iconClass}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-3 text-2xl font-bold text-white">{value.toLocaleString()}</p>
                <p className="mt-1 text-xs uppercase tracking-widest text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* PLATFORM STATS */}
        {!loading && !loadError && (
          <section className="mt-14 grid grid-cols-2 gap-4 md:grid-cols-4">
            <style>{`
              .hf-stat-card {
                background: #111827;
                border-radius: 1rem;
                padding: 1.25rem;
                text-align: center;
                border: 1px solid rgba(255,255,255,0.07);
                box-shadow: 0 4px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.07);
                transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
                cursor: default;
              }
              .hf-stat-card:hover { transform: translateY(-7px); }
              .hf-stat-emerald:hover {
                box-shadow: 0 18px 48px rgba(52,211,153,0.28), 0 4px 12px rgba(52,211,153,0.14), inset 0 1px 0 rgba(255,255,255,0.09);
                border-color: rgba(52,211,153,0.35);
              }
              .hf-stat-violet:hover {
                box-shadow: 0 18px 48px rgba(167,139,250,0.25), 0 4px 12px rgba(167,139,250,0.13), inset 0 1px 0 rgba(255,255,255,0.09);
                border-color: rgba(167,139,250,0.32);
              }
              .hf-stat-cyan:hover {
                box-shadow: 0 18px 48px rgba(34,211,238,0.25), 0 4px 12px rgba(34,211,238,0.13), inset 0 1px 0 rgba(255,255,255,0.09);
                border-color: rgba(34,211,238,0.32);
              }
              .hf-stat-rose:hover {
                box-shadow: 0 18px 48px rgba(251,113,133,0.25), 0 4px 12px rgba(251,113,133,0.13), inset 0 1px 0 rgba(255,255,255,0.09);
                border-color: rgba(251,113,133,0.32);
              }
            `}</style>
            {[
              { label: 'Active Masters',    value: platformStats.totalMasters.toLocaleString(),              card: 'hf-stat-emerald', valueColor: 'text-emerald-300' },
              { label: 'Total Followers',   value: platformStats.totalFollowers.toLocaleString(),            card: 'hf-stat-violet',  valueColor: 'text-violet-300' },
              { label: 'Signals Delivered', value: platformStats.totalSignals.toLocaleString(),              card: 'hf-stat-cyan',    valueColor: 'text-cyan-300' },
              { label: 'Avg Win Rate',      value: `${platformStats.avgWinRate.toFixed(1)}%`,               card: 'hf-stat-rose',    valueColor: 'text-rose-300' },
            ].map(({ label, value, card, valueColor }) => (
              <div key={label} className={`hf-stat-card ${card}`}>
                <p className={`text-3xl font-bold ${valueColor}`}>{value}</p>
                <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">{label}</p>
              </div>
            ))}
          </section>
        )}

        {/* HOW IT WORKS */}
        <section className="mt-16">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-white md:text-3xl">How it works</h2>
            <p className="mt-2 text-sm text-slate-400">Up and running in under 5 minutes.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { step: '01', title: 'Create your account', desc: 'Register in seconds. Install the MT5 Expert Advisor on your broker terminal — no coding required.', dot: 'bg-emerald-400', glow: 'shadow-emerald-950' },
              { step: '02', title: 'Follow a master trader', desc: 'Browse the leaderboard, review real verified performance, and subscribe to a tier that fits your risk appetite.', dot: 'bg-cyan-400', glow: 'shadow-cyan-950' },
              { step: '03', title: 'Trades copy automatically', desc: 'Every signal is mirrored to your broker in real-time — zero manual input, full transparency.', dot: 'bg-purple-400', glow: 'shadow-purple-950' },
            ].map(({ step, title, desc, dot }) => (
              <div
                key={step}
                className="relative rounded-3xl p-6 transition-transform duration-300 hover:-translate-y-1.5"
                style={{ background: '#111827', boxShadow: '0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className={`mb-5 h-8 w-8 rounded-full ${dot} shadow-lg`} />
                <p className="mb-2 text-6xl font-black" style={{ color: 'rgba(255,255,255,0.04)' }}>{step}</p>
                <h3 className="text-base font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* WHY HF */}
        <section className="mt-16">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-white md:text-3xl">Why choose HF Copy Trader?</h2>
            <p className="mt-2 text-sm text-slate-400">Built for speed, transparency, and control.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Zap, title: 'Sub-millisecond signals', desc: 'Protocol Buffer binary encoding over WebSocket delivers trades faster than any REST-based alternative.', iconColor: 'text-yellow-300', iconBg: 'bg-yellow-400/10' },
              { icon: TrendingUp, title: 'Verified performance', desc: "Every master's track record is built from real closed trades — not backtests or hypotheticals.", iconColor: 'text-emerald-300', iconBg: 'bg-emerald-400/10' },
              { icon: Shield, title: 'Risk controls', desc: 'Set symbol whitelists, max position sizes, daily loss limits, and concurrent position caps per subscription.', iconColor: 'text-cyan-300', iconBg: 'bg-cyan-400/10' },
              { icon: Globe, title: 'Multi-broker support', desc: 'Works with any MT5 broker worldwide. Automatic symbol suffix detection handles broker-specific naming.', iconColor: 'text-blue-300', iconBg: 'bg-blue-400/10' },
              { icon: Server, title: 'Built to scale', desc: 'PM2 cluster mode, Redis pub/sub, and Nginx sharding handle thousands of simultaneous connections.', iconColor: 'text-purple-300', iconBg: 'bg-purple-400/10' },
              { icon: Lock, title: 'Secure by default', desc: 'Per-master API keys, JWT httpOnly cookies, bcrypt hashing, and role-based access control throughout.', iconColor: 'text-rose-300', iconBg: 'bg-rose-400/10' },
            ].map(({ icon: Icon, title, desc, iconColor, iconBg }) => (
              <div
                key={title}
                className="rounded-3xl p-5 transition-transform duration-300 hover:-translate-y-1.5"
                style={{ background: '#111827', boxShadow: '0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className={`mb-3 inline-flex rounded-xl p-2.5 ${iconBg}`}>
                  <Icon className={`h-5 w-5 ${iconColor}`} />
                </div>
                <h3 className="mb-1.5 text-sm font-semibold text-white">{title}</h3>
                <p className="text-xs leading-relaxed text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white md:text-3xl">Subscription Plans</h2>
              <p className="mt-1 text-sm text-slate-400">Pick your risk capacity and automation depth.</p>
            </div>
          </div>

          <style>{`
            .hf-plan-card {
              position: relative;
              border-radius: 1rem;
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .hf-plan-glow,
            .hf-plan-white,
            .hf-plan-border,
            .hf-plan-darkbg {
              position: absolute;
              inset: 0;
              overflow: hidden;
              z-index: 0;
              border-radius: 1rem;
            }
            .hf-plan-glow {
              inset: -6px;
              border-radius: 1.4rem;
              filter: blur(28px);
              opacity: 0.38;
            }
            .hf-plan-glow::before {
              content: "";
              position: absolute;
              top: 50%; left: 50%;
              transform: translate(-50%, -50%) rotate(60deg);
              width: 800px; height: 800px;
              background: conic-gradient(#000, #402fb5 5%, #000 38%, #000 50%, #cf30aa 60%, #000 87%);
              transition: transform 2s;
            }
            .hf-plan-darkbg::before {
              content: "";
              position: absolute;
              top: 50%; left: 50%;
              transform: translate(-50%, -50%) rotate(82deg);
              width: 800px; height: 800px;
              background: conic-gradient(rgba(0,0,0,0), #18116a, rgba(0,0,0,0) 10%, rgba(0,0,0,0) 50%, #6e1b60, rgba(0,0,0,0) 60%);
              transition: transform 2s;
            }
            .hf-plan-white {
              inset: 2px;
              border-radius: calc(1rem - 2px);
              filter: blur(2px);
            }
            .hf-plan-white::before {
              content: "";
              position: absolute;
              top: 50%; left: 50%;
              transform: translate(-50%, -50%) rotate(83deg);
              width: 800px; height: 800px;
              filter: brightness(1.4);
              background: conic-gradient(rgba(0,0,0,0) 0%, #a099d8, rgba(0,0,0,0) 8%, rgba(0,0,0,0) 50%, #dfa2da, rgba(0,0,0,0) 58%);
              transition: transform 2s;
            }
            .hf-plan-border {
              inset: 3.5px;
              border-radius: calc(1rem - 3.5px);
              filter: blur(0.5px);
            }
            .hf-plan-border::before {
              content: "";
              position: absolute;
              top: 50%; left: 50%;
              transform: translate(-50%, -50%) rotate(70deg);
              width: 800px; height: 800px;
              filter: brightness(1.3);
              background: conic-gradient(#1c191c, #402fb5 5%, #1c191c 14%, #1c191c 50%, #cf30aa 60%, #1c191c 64%);
              transition: transform 2s;
            }
            .hf-plan-inner {
              position: relative;
              z-index: 10;
              margin: 4px;
              background: #0c1222;
              border-radius: calc(1rem - 4px);
              width: calc(100% - 8px);
              padding: 1.25rem;
              flex: 1;
            }
            .hf-plan-card:hover > .hf-plan-darkbg::before {
              transform: translate(-50%, -50%) rotate(-98deg);
            }
            .hf-plan-card:hover > .hf-plan-glow::before {
              transform: translate(-50%, -50%) rotate(-120deg);
            }
            .hf-plan-card:hover > .hf-plan-white::before {
              transform: translate(-50%, -50%) rotate(-97deg);
            }
            .hf-plan-card:hover > .hf-plan-border::before {
              transform: translate(-50%, -50%) rotate(-110deg);
            }
          `}</style>
          {loading ? (
            <p className="text-sm text-slate-400">Loading plans...</p>
          ) : loadError ? (
            <p className="text-sm text-red-400">{loadError}</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              {tiers.map((tier) => {
                const isPremium = tier.name === 'premium';
                return (
                  <div key={tier.id} className="hf-plan-card shadow-2xl shadow-black/60">
                    <div className="hf-plan-glow" />
                    <div className="hf-plan-darkbg" />
                    <div className="hf-plan-darkbg" />
                    <div className="hf-plan-darkbg" />
                    <div className="hf-plan-white" />
                    <div className="hf-plan-border" />
                    <div className="hf-plan-inner">
                      {isPremium && (
                        <div className="absolute -top-px left-1/2 -translate-x-1/2">
                          <span className="inline-block rounded-b-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg">
                            Most Popular
                          </span>
                        </div>
                      )}
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white">{formatTierName(tier.name)}</h3>
                        <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-300">
                          {tier.commission_percent}% commission
                        </span>
                      </div>
                      <p className="text-3xl font-bold text-white">
                        ${toNumber(tier.monthly_fee)}
                        <span className="ml-1 text-sm font-medium text-slate-400">/ month</span>
                      </p>
                      <p className="mt-2 text-sm text-slate-300">
                        Up to <span className="font-semibold text-white">{tier.max_concurrent_positions}</span> concurrent positions.
                      </p>
                      <ul className="mt-4 space-y-2 text-sm text-slate-300">
                        {(Array.isArray(tier.features) ? tier.features : []).map((feature) => (
                          <li key={`${tier.id}-${feature}`} className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400" />
                            <span>{feature.replace(/_/g, ' ')}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-14">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white md:text-3xl">Top 10 Most Followed Masters</h2>
              <p className="mt-1 text-sm text-slate-400">Ranked by active follower count.</p>
            </div>
            <div className="hidden items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 md:flex">
              <BarChart3 className="h-4 w-4 text-emerald-300" />
              Live leaderboard
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-slate-400">Loading masters...</p>
          ) : loadError ? (
            <p className="text-sm text-red-400">{loadError}</p>
          ) : topMasters.length === 0 ? (
            <p className="text-sm text-slate-400">No active masters available yet.</p>
          ) : (
            <>
              <StackedMasters masters={topMasters} performanceByMaster={performanceByMaster} />
              <p className="mt-6 text-center text-[11px] uppercase tracking-widest text-slate-600">
                hover to reveal top 5 masters
              </p>
            </>
          )}
        </section>

        {/* FAQ */}
        <section className="mt-16">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-white md:text-3xl">Frequently asked questions</h2>
          </div>
          <div className="mx-auto max-w-2xl space-y-2">
            {[
              { q: 'Do I need programming skills?', a: 'No. Install the MT5 Expert Advisor on your broker terminal and everything else — subscriptions, copying, risk controls — is managed from your web portal.' },
              { q: 'Which brokers are supported?', a: 'Any MetaTrader 5 (MT5) broker worldwide. The EA automatically detects broker-specific symbol suffixes (e.g. EURUSD.m, EURUSDpro) so no manual configuration is needed.' },
              { q: 'How quickly are trades copied?', a: 'Signal delivery uses Protocol Buffer binary encoding over WebSocket, typically reaching your terminal in under 100ms after the master opens a position.' },
              { q: 'Can I control my risk?', a: 'Yes. Each subscription supports: symbol whitelists/blacklists, max position size, max concurrent positions, max positions per day, and a daily loss limit with automatic suspension.' },
              { q: 'What happens if I cancel my subscription?', a: 'Cancelling stops new signals from being copied. Any positions already open on your account remain open and must be closed manually.' },
              { q: 'How are master rankings calculated?', a: 'Masters are ranked by active follower count. All performance data (win rate, trade history, signals) is derived entirely from real closed trades recorded on the platform.' },
            ].map((item, i) => (
              <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/60">
                <button
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-white"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  {item.q}
                  <ChevronDown className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="border-t border-slate-800 px-5 py-4 text-sm leading-relaxed text-slate-400">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ACTIVITY TICKER — full width */}
      {tickerItems.length > 0 && (
        <div className="relative z-10 mt-16 overflow-hidden border-y border-slate-800/60 bg-slate-900/40 py-3">
          <style>{`
            @keyframes hf-ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
            .hf-ticker-track { animation: hf-ticker 45s linear infinite; white-space: nowrap; display: inline-flex; }
            .hf-ticker-track:hover { animation-play-state: paused; }
          `}</style>
          <div className="hf-ticker-track">
            {[...tickerItems, ...tickerItems].map((item, i) => (
              <span key={i} className="inline-flex items-center gap-2 px-6 text-xs text-slate-500">
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* CTA BANNER — full width */}
      <div className="relative z-10 bg-gradient-to-r from-emerald-900/40 via-slate-900 to-cyan-900/40 px-4 py-16 text-center">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/4 top-0 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute right-1/4 bottom-0 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl" />
        </div>
        <h2 className="relative text-2xl font-bold text-white md:text-3xl">Start copy trading today</h2>
        <p className="relative mt-3 text-sm text-slate-400">Join traders already automating their execution in real-time.</p>
        <div className="relative mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white transition-all hover:from-emerald-400 hover:to-cyan-400">
            Create free account <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/master-register" className="rounded-xl border border-slate-700 px-6 py-3 text-sm font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white">
            Become a Master Trader
          </Link>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-slate-800/60 bg-slate-950 px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-semibold text-white">HF Copy Trader</span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500">
            <Link href="/landing" className="transition-colors hover:text-slate-300">Home</Link>
            <Link href="/login" className="transition-colors hover:text-slate-300">Sign In</Link>
            <Link href="/register" className="transition-colors hover:text-slate-300">Register</Link>
            <Link href="/master-register" className="transition-colors hover:text-slate-300">Become a Master</Link>
          </nav>
          <p className="text-xs text-slate-600">&copy; {new Date().getFullYear()} HF Copy Trader. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
