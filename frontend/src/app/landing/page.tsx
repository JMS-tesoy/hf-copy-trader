'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { API } from '@/lib/api';
import { Crown, Users, BarChart3, Zap, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';

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

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return 0;
}

function formatTierName(name: string): string {
  if (!name) return 'Plan';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export default function LandingPage() {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [masters, setMasters] = useState<LeaderboardMaster[]>([]);
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

        if (!cancelled) {
          setTiers(Array.isArray(tiersData) ? tiersData : []);
          setMasters(Array.isArray(mastersData) ? mastersData : []);
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

  const topMasters = useMemo(() => {
    return [...masters]
      .sort((a, b) => toNumber(b.subscriber_count) - toNumber(a.subscriber_count))
      .slice(0, 10);
  }, [masters]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-20 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute top-24 -right-24 h-[28rem] w-[28rem] rounded-full bg-cyan-500/20 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-10 md:py-14">
        <header className="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-900/70 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500">
              <span className="text-sm font-black text-white">HF</span>
            </div>
            <span className="text-sm font-semibold tracking-wide text-white">HF Copy Trader</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-slate-300 hover:text-white transition-colors">Sign in</Link>
            <Link href="/register" className="rounded-lg bg-emerald-500 px-3 py-1.5 font-medium text-white hover:bg-emerald-400 transition-colors">
              Get Started
            </Link>
          </div>
        </header>

        <section className="mt-10 grid gap-8 md:grid-cols-2 md:items-center">
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
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Tracked Masters', value: topMasters.length, icon: Crown },
              { label: 'Total Followers', value: topMasters.reduce((sum, m) => sum + toNumber(m.subscriber_count), 0), icon: Users },
              { label: 'Live Signals', value: topMasters.reduce((sum, m) => sum + toNumber(m.signal_count), 0), icon: Zap },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 backdrop-blur">
                <Icon className="h-5 w-5 text-emerald-300" />
                <p className="mt-2 text-2xl font-bold text-white">{value}</p>
                <p className="mt-1 text-xs uppercase tracking-widest text-slate-400">{label}</p>
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

          {loading ? (
            <p className="text-sm text-slate-400">Loading plans...</p>
          ) : loadError ? (
            <p className="text-sm text-red-400">{loadError}</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {tiers.map((tier) => (
                <article key={tier.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-slate-900/40">
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
                </article>
              ))}
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
            <div className="grid gap-3 md:grid-cols-2">
              {topMasters.map((master, index) => (
                <article key={master.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wider text-slate-500">Rank #{index + 1}</p>
                      <h3 className="mt-1 truncate text-base font-semibold text-white">{master.name}</h3>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-400">{master.bio || 'No bio provided.'}</p>
                    </div>
                    <span className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-300">
                      {master.status}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-slate-800/70 px-2 py-2">
                      <p className="text-sm font-bold text-white">{toNumber(master.subscriber_count)}</p>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Followers</p>
                    </div>
                    <div className="rounded-lg bg-slate-800/70 px-2 py-2">
                      <p className="text-sm font-bold text-white">{toNumber(master.signal_count)}</p>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Signals</p>
                    </div>
                    <div className="rounded-lg bg-slate-800/70 px-2 py-2">
                      <p className="text-sm font-bold text-white">{toNumber(master.avg_win_rate).toFixed(1)}%</p>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Avg Win</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
