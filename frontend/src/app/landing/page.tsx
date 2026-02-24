'use client';

import Link from 'next/link';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { API } from '@/lib/api';
import { Crown, Users, BarChart3, Zap, CheckCircle2, ArrowRight, Sparkles, Shield, TrendingUp, Globe, Lock, ChevronDown, Server, X } from 'lucide-react';

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

function formatMasterAge(createdAt: string): string {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return 'New';
  const now = new Date();
  let months = (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth());
  if (now.getDate() < created.getDate()) months -= 1;
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (years > 0 && remMonths > 0) return `${years}y ${remMonths}mo`;
  if (years > 0) return `${years}y`;
  if (months > 0) return `${months}mo`;
  return 'New';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (!parts.length) return 'M';
  return parts.map((p) => p.charAt(0).toUpperCase()).join('');
}

function avatarUrl(masterId: number, name: string): string {
  const seed = encodeURIComponent(`${masterId}-${name || 'master'}`);
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${seed}&backgroundColor=0f172a,0b1220,1e293b`;
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
  return { label: 'AUM', className: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' };
}

function buildBarHeights(series: PerformanceSeriesPoint[]): number[] {
  if (!series.length) return [];
  const tail = series.slice(-8);
  const values = tail.map((s) => s.c);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map((value) => {
    const normalized = (value - min) / range;
    return Math.max(0.22, normalized);
  });
}

function seededUpSeries(masterId: number): PerformanceSeriesPoint[] {
  let seed = (masterId * 9301 + 49297) % 233280;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const base = 16 + rand() * 14;
  const slope = 0.8 + rand() * 1.6;
  const waveAmp = 0.3 + rand() * 1.4;
  const waveFreq = 0.8 + rand() * 2.2;
  return Array.from({ length: 10 }, (_, i) => {
    const x = i / 9;
    const bump = Math.sin(x * Math.PI * waveFreq) * waveAmp;
    const noise = (rand() - 0.5) * 0.9;
    return {
      t: `seed-${i}`,
      p: 0,
      c: Number((base + i * slope + bump + noise).toFixed(2)),
    };
  });
}

function resolveSeries(masterId: number, series: PerformanceSeriesPoint[]): PerformanceSeriesPoint[] {
  if (Array.isArray(series) && series.length >= 2) return series;
  return seededUpSeries(masterId);
}

function TiltCard({
  children,
  className,
  style,
  withGlow = false,
}: {
  children: React.ReactNode;
  className: string;
  style?: React.CSSProperties;
  withGlow?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const x = px - 0.5;
    const y = py - 0.5;
    const cornerX = `${(12 + px * 76).toFixed(2)}%`;
    const cornerY = `${(12 + py * 76).toFixed(2)}%`;
    const edgeProximity = Math.min(1, Math.sqrt(x * x + y * y) * Math.SQRT2);

    el.style.transform =
      `perspective(900px) rotateY(${x * 20}deg) rotateX(${-y * 16}deg) scale3d(1.045, 1.045, 1.045)`;
    el.style.setProperty('--tilt-corner-x', cornerX);
    el.style.setProperty('--tilt-corner-y', cornerY);
    el.style.setProperty('--tilt-glow-opacity', `${Math.min(0.62, 0.16 + edgeProximity * 0.46)}`);
  };

  const handleMouseLeave = () => {
    if (ref.current) {
      ref.current.style.transform =
        'perspective(900px) rotateY(0deg) rotateX(0deg) scale3d(1, 1, 1)';
      ref.current.style.setProperty('--tilt-glow-opacity', '0');
    }
  };

  return (
    <article
      ref={ref}
      className={`relative ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transition: 'transform 0.18s ease-out', willChange: 'transform', ...style }}
    >
      {withGlow && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{
            background:
              'radial-gradient(190px circle at var(--tilt-corner-x,50%) var(--tilt-corner-y,50%), rgba(56,189,248,0.35), rgba(16,185,129,0.24) 35%, rgba(15,23,42,0) 72%)',
            mixBlendMode: 'screen',
            opacity: 'var(--tilt-glow-opacity,0)',
            transition: 'opacity 0.24s ease-out, background 0.12s linear',
          }}
        />
      )}
      {children}
    </article>
  );
}

function StackedMasters({
  masters,
  performanceByMaster,
}: {
  masters: LeaderboardMaster[];
  performanceByMaster: Record<number, PerformanceSeriesPoint[]>;
}) {
  const [paused, setPaused] = useState(false);
  const displayed = masters.slice(0, 10);
  const looped = [...displayed, ...displayed];

  return (
    <div className="w-full overflow-hidden px-1 pb-2">
      <style>{`
        .hf-masters-marquee-track {
          display: flex;
          width: max-content;
          animation: hf-masters-marquee 52s linear infinite;
        }
        .hf-masters-marquee-track.is-paused {
          animation-play-state: paused;
        }
        @keyframes hf-masters-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
      <div
        className={`hf-masters-marquee-track items-stretch gap-4 ${paused ? 'is-paused' : ''}`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {looped.map((master, i) => {
          const rank = (i % displayed.length) + 1;
          const performance = getPerformanceStatus(master.avg_win_rate);
          const aumValue = formatCompactUsd(estimateAum(master.subscriber_count));
          const series = resolveSeries(master.id, performanceByMaster[master.id] || []);
          const bars = buildBarHeights(series);
          const positive = series[series.length - 1].c >= series[0].c;

          return (
            <div
              key={`${master.id}-${i}`}
              style={{
                flexShrink: 0,
                width: 248,
              }}
            >
              <TiltCard className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-transparent shadow-2xl shadow-black/50 backdrop-blur-md hover:border-emerald-500/40">
                <div className="p-5">
                  {/* Header */}
                  <div className="mb-4 flex items-center justify-between gap-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-emerald-400/30 to-cyan-400/20 text-xs font-bold text-emerald-200 ring-1 ring-emerald-500/20">
                        {initials(master.name)}
                        <img
                          src={avatarUrl(master.id, master.name)}
                          alt={`${master.name} avatar`}
                          className="absolute inset-0 h-full w-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-[15px] font-semibold text-white">{master.name}</h3>
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">Age: {formatMasterAge(master.created_at)}</p>
                      </div>
                    </div>
                    <span className="flex-shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-500/25">
                      #{rank}
                    </span>
                  </div>

                  {/* Win rate hero */}
                  <div className="mb-4 text-center">
                    <p className="text-4xl font-bold text-white">{toNumber(master.avg_win_rate).toFixed(1)}%</p>
                    <p className="text-[11px] uppercase tracking-wider text-slate-500">Avg win rate</p>
                  </div>

                  {/* Stats 2-col */}
                  <div className="mb-4 grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-lg border border-white/5 bg-black/20 px-2.5 py-2">
                      <p className="text-base font-bold text-white">{formatCount(master.subscriber_count)}</p>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Followers</p>
                    </div>
                    <div className="rounded-lg border border-white/5 bg-black/20 px-2.5 py-2">
                      {bars.length > 0 ? (
                        <svg viewBox="0 0 100 20" className="mx-auto h-[20px] w-full">
                          {bars.map((h, idx) => {
                            const count = bars.length;
                            const gap = 2;
                            const barW = (100 - gap * (count - 1)) / count;
                            const x = idx * (barW + gap);
                            const barH = Math.max(3, h * 18);
                            const y = 20 - barH;
                            return (
                              <rect
                                key={idx}
                                x={x}
                                y={y}
                                width={barW}
                                height={barH}
                                rx={0.8}
                                fill={positive ? '#4f5dff' : '#8b5cf6'}
                                opacity={0.95}
                              />
                            );
                          })}
                        </svg>
                      ) : (
                        <p className="text-base font-bold text-white">-</p>
                      )}
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Performance</p>
                    </div>
                  </div>

                  {/* Performance badge */}
                  <div className="flex items-center justify-center">
                    {performance.label === 'AUM' ? (
                      <span className={`inline-flex min-w-[112px] items-center justify-between rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${performance.className}`}>
                        <span>AUM</span>
                        <span className="ml-2 font-bold text-cyan-300 normal-case tracking-normal">{aumValue}</span>
                      </span>
                    ) : (
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${performance.className}`}>
                        {performance.label}
                      </span>
                    )}
                  </div>
                </div>
              </TiltCard>
            </div>
          );
        })}
      </div>
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

  const [openFaqModal, setOpenFaqModal] = useState<number | null>(null);
  const faqItems = [
    { q: 'Do I need programming skills?', a: 'No. Install the MT5 Expert Advisor on your broker terminal and everything else - subscriptions, copying, risk controls - is managed from your web portal.' },
    { q: 'Which brokers are supported?', a: 'Any MetaTrader 5 (MT5) broker worldwide. The EA automatically detects broker-specific symbol suffixes (e.g. EURUSD.m, EURUSDpro) so no manual configuration is needed.' },
    { q: 'How quickly are trades copied?', a: 'Signal delivery uses Protocol Buffer binary encoding over WebSocket, typically reaching your terminal in under 100ms after the master opens a position.' },
    { q: 'Can I control my risk?', a: 'Yes. Each subscription supports: symbol whitelists/blacklists, max position size, max concurrent positions, max positions per day, and a daily loss limit with automatic suspension.' },
    { q: 'What happens if I cancel my subscription?', a: 'Cancelling stops new signals from being copied. Any positions already open on your account remain open and must be closed manually.' },
    { q: 'How are master rankings calculated?', a: 'Masters are ranked by active follower count. All performance data (win rate, trade history, signals) is derived entirely from real closed trades recorded on the platform.' },
  ];

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

  const joinSeedItems = useMemo(() => {
    if (!masters.length) return [];
    const countries = ['Singapore', 'London', 'Tokyo', 'New York', 'Sydney', 'Dubai', 'Berlin', 'Toronto'];
    return Array.from({ length: 24 }, (_, i) => {
      const master = masters[i % masters.length];
      return `User #${1200 + i * 37} joined and followed ${master.name.split(' ')[0]} from ${countries[i % countries.length]}`;
    });
  }, [masters]);

  const [joinToasts, setJoinToasts] = useState<Array<{ id: number; text: string; leaving?: boolean }>>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastChimeAtRef = useRef(0);

  const ensureAudioContext = () => {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioCtx();
    }
    return audioCtxRef.current;
  };

  const playJoinChime = () => {
    if (typeof window === 'undefined') return;

    const nowMs = Date.now();
    if (nowMs - lastChimeAtRef.current < 600) return;
    lastChimeAtRef.current = nowMs;

    const ctx = ensureAudioContext();
    if (!ctx) return;
    if (ctx.state !== 'running') {
      ctx.resume().catch(() => {});
      return;
    }

    const t0 = ctx.currentTime + 0.01;
    const master = ctx.createGain();
    const lowpass = ctx.createBiquadFilter();
    const highpass = ctx.createBiquadFilter();
    const delay = ctx.createDelay(0.5);
    const feedback = ctx.createGain();
    const wet = ctx.createGain();

    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(2600, t0);
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(240, t0);

    master.gain.setValueAtTime(0.0001, t0);
    master.gain.linearRampToValueAtTime(0.0432, t0 + 0.04);
    master.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.62);

    delay.delayTime.setValueAtTime(0.16, t0);
    feedback.gain.setValueAtTime(0.3, t0);
    wet.gain.setValueAtTime(0.3, t0);

    master.connect(lowpass);
    lowpass.connect(highpass);
    highpass.connect(ctx.destination); // dry

    highpass.connect(delay);
    delay.connect(wet);
    wet.connect(ctx.destination); // wet
    delay.connect(feedback);
    feedback.connect(delay);

    // Onboarding-style: soft, ascending two-note cue.
    const noteA = ctx.createOscillator();
    const noteAGain = ctx.createGain();
    noteA.type = 'sine';
    noteA.frequency.setValueAtTime(587.33, t0); // D5
    noteAGain.gain.setValueAtTime(0.0001, t0);
    noteAGain.gain.linearRampToValueAtTime(0.9, t0 + 0.05);
    noteAGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34);
    noteA.connect(noteAGain);
    noteAGain.connect(master);

    const noteB = ctx.createOscillator();
    const noteBGain = ctx.createGain();
    noteB.type = 'sine';
    noteB.frequency.setValueAtTime(739.99, t0 + 0.14); // F#5
    noteBGain.gain.setValueAtTime(0.0001, t0 + 0.14);
    noteBGain.gain.linearRampToValueAtTime(0.8, t0 + 0.2);
    noteBGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.58);
    noteB.connect(noteBGain);
    noteBGain.connect(master);

    noteA.start(t0);
    noteB.start(t0 + 0.14);
    noteA.stop(t0 + 0.36);
    noteB.stop(t0 + 0.6);
  };

  useEffect(() => {
    if (!joinSeedItems.length) return;
    let idx = 0;
    const timeoutIds: number[] = [];
    const maxToasts = 3;
    const fadeMs = 760;

    const intervalId = window.setInterval(() => {
      const id = Date.now() + idx;
      const text = joinSeedItems[idx % joinSeedItems.length];
      idx += 1;
      playJoinChime();

      setJoinToasts((prev) => {
        let next = [...prev];
        if (next.length >= maxToasts) {
          const oldest = next.find((item) => !item.leaving);
          if (oldest) {
            next = next.map((item) => (item.id === oldest.id ? { ...item, leaving: true } : item));
            const removeId = window.setTimeout(() => {
              setJoinToasts((curr) => curr.filter((item) => item.id !== oldest.id));
            }, fadeMs);
            timeoutIds.push(removeId);
          }
        }
        next.push({ id, text });
        return next;
      });
    }, 2400);

    return () => {
      window.clearInterval(intervalId);
      timeoutIds.forEach((id) => window.clearTimeout(id));
    };
  }, [joinSeedItems]);

  useEffect(() => {
    const unlock = () => {
      const ctx = ensureAudioContext();
      if (!ctx) return;
      ctx.resume().then(() => {
        // Prime with a silent tick on user gesture for stricter browsers.
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.00001, ctx.currentTime);
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(440, ctx.currentTime);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(ctx.currentTime);
        o.stop(ctx.currentTime + 0.01);
      }).catch(() => {});
    };

    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
    };
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-20 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute top-24 -right-24 h-[28rem] w-[28rem] rounded-full bg-cyan-500/20 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(148,163,184,0.45) 1px, transparent 0)',
            backgroundSize: '3px 3px',
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, rgba(148,163,184,0.24) 0, rgba(148,163,184,0.24) 1px, transparent 1px, transparent 9px)',
          }}
        />
      </div>

      <div className="relative z-10 mx-auto w-full px-4 py-10 sm:px-6 md:py-14 lg:w-[85%] lg:px-0">
        <section className="grid gap-8 md:grid-cols-2 md:items-center">
          <div>
            <div className="hf-text-behavior mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs uppercase tracking-wider text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              Live Copy Trading Platform
            </div>
            <h1 className="text-4xl font-bold leading-tight text-white md:text-5xl">
              <span className="hf-text-behavior hf-text-inline block w-fit">Follow top-performing masters.</span>
              <span className="hf-text-behavior hf-text-inline block w-fit bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
                Automate your
              </span>
              <span className="hf-text-behavior hf-text-inline block w-fit bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
                execution.
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300 md:text-base">
              <span className="hf-text-behavior hf-text-block block w-fit">Mirror trades in real time, control risk from one portal,</span>
              <span className="hf-text-behavior hf-text-block block w-fit">and get transparent tiers with measurable performance</span>
              <span className="hf-text-behavior hf-text-block block w-fit">plus low-latency delivery.</span>
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/register"
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl border border-cyan-300/30 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-[0_10px_28px_rgba(16,185,129,0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(34,211,238,0.38)] active:translate-y-0"
              >
                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-white/0 via-white/35 to-white/0 transition-transform duration-700 group-hover:translate-x-full" />
                Get Started <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              <span className="hf-text-behavior hf-text-inline">Already have an account?</span>{' '}
              <Link href="/login" className="hf-text-behavior hf-text-inline text-slate-300 hover:text-white transition-colors">
                Sign in
              </Link>
            </p>
          </div>

          <style>{`
            .hf-text-behavior {
              transition: all 0.3s ease-out;
              border-radius: 8px;
            }
            .hf-text-behavior:hover {
              background-color: rgba(83, 83, 255, 0.22);
              transform: translate(1px, -1px);
            }
            .hf-text-behavior:active {
              transform: scale(0.99);
            }
            .hf-text-inline {
              display: inline-block;
              padding: 2px 6px;
            }
            .hf-text-block {
              display: inline-block;
              padding: 2px 2px;
            }
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
              { step: '01', title: 'Create your account', desc: 'Register in seconds. Install the MT5 Expert Advisor on your broker terminal - no coding required.', dot: 'bg-emerald-400' },
              { step: '02', title: 'Follow a master trader', desc: 'Browse the leaderboard, review real verified performance, and subscribe to a tier that fits your risk appetite.', dot: 'bg-cyan-400' },
              { step: '03', title: 'Trades copy automatically', desc: 'Every signal is mirrored to your broker in real-time - zero manual input, full transparency.', dot: 'bg-purple-400' },
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

        {/* MT5 + EA ILLUSTRATION */}
        <section className="mt-16 rounded-3xl border border-slate-800/80 bg-slate-900/70 p-5 md:p-7">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-white md:text-3xl">MT5 + EA Workflow</h2>
            <p className="mt-2 text-sm text-slate-400">From master signal to execution on your MetaTrader 5 terminal.</p>
          </div>

          <style>{`
            .hf-pipe-beam {
              animation: hf-pipe-flow 2.6s linear infinite;
            }
            .hf-node-hit {
              animation: hf-node-hit 2.6s linear infinite;
            }
            .hf-node-bg {
              animation: hf-node-bg-pulse 2.6s linear infinite;
            }
            @keyframes hf-pipe-flow {
              0% { left: 2%; opacity: 0; }
              12% { opacity: 1; }
              92% { opacity: 1; }
              100% { left: 95%; opacity: 0; }
            }
            @keyframes hf-node-hit {
              0%, 6%, 100% {
                transform: scale(1);
                box-shadow: 0 0 0 rgba(45,212,191,0);
              }
              10% {
                transform: scale(1.5);
                box-shadow: 0 0 20px rgba(45,212,191,0.45);
              }
              15% {
                transform: scale(1);
                box-shadow: 0 0 0 rgba(45,212,191,0);
              }
            }
            @keyframes hf-node-bg-pulse {
              0%, 6%, 100% {
                transform: scale(0.82);
                opacity: 0;
              }
              10% {
                transform: scale(1.45);
                opacity: 0.55;
              }
              15% {
                transform: scale(1);
                opacity: 0.08;
              }
            }
          `}</style>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-700/70 bg-slate-950/75 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Signal Pipeline</p>
                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                  Avg latency 27ms
                </span>
              </div>
              <div className="relative overflow-hidden rounded-xl border border-cyan-900/40 bg-gradient-to-b from-slate-900 to-slate-950 px-3 py-4 sm:px-4">
                <div className="absolute inset-x-8 top-[38px] z-0 hidden h-px bg-slate-700 sm:block" />
                <div className="absolute inset-x-8 top-[38px] z-0 hidden h-px bg-gradient-to-r from-cyan-500/0 via-cyan-300/60 to-emerald-300/0 sm:block" />
                <div className="hf-pipe-beam absolute top-[38px] z-0 hidden h-1 w-14 -translate-y-1/2 rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300 blur-[1px] sm:block" />

                <div className="relative z-20 grid grid-cols-2 gap-3 text-[11px] sm:grid-cols-4 sm:gap-2 sm:text-center">
                  {[
                    { icon: TrendingUp, label: 'Master Signal' },
                    { icon: Server, label: 'HF Engine' },
                    { icon: Zap, label: 'EA in MT5' },
                    { icon: CheckCircle2, label: 'Trade Opened' },
                  ].map(({ icon: Icon, label }, idx) => (
                    <div key={label} className="relative z-20 flex items-center gap-2 sm:flex-col sm:items-center sm:gap-2">
                      <span
                        aria-hidden="true"
                        className={`hf-node-bg pointer-events-none absolute left-1 top-1 h-8 w-8 rounded-lg blur-md sm:left-1/2 sm:top-0 sm:-translate-x-1/2 ${idx === 3 ? 'bg-emerald-300/60' : 'bg-cyan-300/55'}`}
                        style={{ animationDelay: `${idx * 0.65}s` }}
                      />
                      <div
                        className={`hf-node-hit rounded-lg border p-2 ${idx === 3 ? 'border-emerald-400/60 bg-slate-800/90' : 'border-slate-600 bg-slate-800/90'}`}
                        style={{ animationDelay: `${idx * 0.65}s` }}
                      >
                        <Icon className={`h-4 w-4 ${idx === 3 ? 'text-emerald-300' : 'text-cyan-300'}`} />
                      </div>
                      <span className="text-slate-300">{label}</span>
                      <span className="ml-auto text-[10px] text-slate-500 sm:ml-0">0{idx + 1}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-lg border border-slate-700/80 bg-slate-900/70 px-3 py-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>Signal status</span>
                    <span className="text-emerald-300">EXECUTED</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-800">
                    <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-300" />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {['Auto lot sizing', 'Max DD guard', 'Symbol mapping', 'Slippage cap', 'Session filter'].map((item) => (
                  <span key={item} className="rounded-full border border-slate-600 bg-slate-800/70 px-3 py-1 text-[11px] text-slate-300">
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-700/70 bg-slate-950/75 p-5">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">MT5 Terminal Mock</p>
              <div className="overflow-hidden rounded-xl border border-slate-700 bg-[#0f172a]">
                <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800/80 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-rose-400/80" />
                    <span className="h-2 w-2 rounded-full bg-amber-400/80" />
                    <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
                    <span className="ml-1 text-[10px] font-medium uppercase tracking-wider text-slate-300">MetaTrader 5 - HF Bridge</span>
                  </div>
                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                    Get connected
                  </span>
                </div>

                <div className="grid gap-3 p-3 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-lg border border-slate-700/80 bg-slate-900/80 p-3">
                    <div className="mb-2 flex items-center justify-between text-[10px] text-slate-400">
                      <span>EURUSD.r - M5</span>
                      <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-cyan-300">Live feed</span>
                    </div>
                    <div className="relative h-28 overflow-hidden rounded-md border border-slate-700/70 bg-slate-950/80">
                      <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.16) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
                      <svg viewBox="0 0 320 112" className="absolute inset-0 h-full w-full">
                        <polyline fill="none" stroke="#22d3ee" strokeWidth="2.5" points="0,82 26,74 48,77 70,64 95,68 124,52 148,56 176,44 202,48 228,33 254,38 282,25 320,30" />
                        <polyline fill="none" stroke="#34d399" strokeWidth="1.6" opacity="0.8" points="0,92 22,90 50,82 76,86 108,76 136,80 168,67 198,70 230,58 258,60 292,48 320,52" />
                      </svg>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                      {[
                        ['Spread', '0.4 pips'],
                        ['Slippage', '0.1'],
                        ['RTT', '27 ms'],
                      ].map(([k, v]) => (
                        <div key={k} className="rounded-md border border-slate-700/70 bg-slate-900/80 px-2 py-1.5 text-center">
                          <p className="text-slate-400">{k}</p>
                          <p className="font-semibold text-slate-100">{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-700/80 bg-slate-900/80 p-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Order Ticket</p>
                    <div className="space-y-1.5 text-[10px]">
                      {[
                        ['Symbol', 'EURUSD.r'],
                        ['Direction', 'BUY'],
                        ['Lot', '0.30'],
                        ['TP / SL', '35 / 20 pips'],
                      ].map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between rounded-md border border-slate-700/70 bg-slate-950/80 px-2 py-1.5">
                          <span className="text-slate-400">{k}</span>
                          <span className="font-semibold text-slate-100">{v}</span>
                        </div>
                      ))}
                    </div>
                    <button className="mt-3 w-full rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                      Execute via EA
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {[
                  { title: '01 Install EA', desc: 'Attach bridge to one MT5 chart.' },
                  { title: '02 Paste API Key', desc: 'Link your account securely.' },
                  { title: '03 Enable AutoTrading', desc: 'Execution starts automatically.' },
                ].map((step) => (
                  <div key={step.title} className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
                    <p className="text-xs font-semibold text-white">{step.title}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>
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
              { icon: TrendingUp, title: 'Verified performance', desc: "Every master's track record is built from real closed trades - not backtests or hypotheticals.", iconColor: 'text-emerald-300', iconBg: 'bg-emerald-400/10' },
              { icon: Shield, title: 'Risk controls', desc: 'Set symbol whitelists, max position sizes, daily loss limits, and concurrent position caps per subscription.', iconColor: 'text-cyan-300', iconBg: 'bg-cyan-400/10' },
              { icon: Globe, title: 'Multi-broker support', desc: 'Works with any MT5 broker worldwide. Automatic symbol suffix detection handles broker-specific naming.', iconColor: 'text-blue-300', iconBg: 'bg-blue-400/10' },
              { icon: Server, title: 'Built to scale', desc: 'PM2 cluster mode, Redis pub/sub, and Nginx sharding handle thousands of simultaneous connections.', iconColor: 'text-purple-300', iconBg: 'bg-purple-400/10' },
              { icon: Lock, title: 'Secure by default', desc: 'Per-master API keys, JWT httpOnly cookies, bcrypt hashing, and role-based access control throughout.', iconColor: 'text-rose-300', iconBg: 'bg-rose-400/10' },
            ].map(({ icon: Icon, title, desc, iconColor, iconBg }) => (
              <TiltCard
                key={title}
                className="rounded-[30px] p-5"
                withGlow
                style={{
                  background: '#111827',
                  boxShadow: '15px 15px 30px rgba(2, 6, 23, 0.72), -15px -15px 30px rgba(30, 41, 59, 0.62)',
                  border: '1px solid rgba(148, 163, 184, 0.14)',
                }}
              >
                <div className={`mb-3 inline-flex rounded-xl p-2.5 ${iconBg}`}>
                  <Icon className={`h-5 w-5 ${iconColor}`} />
                </div>
                <h3 className="mb-1.5 text-sm font-semibold text-white">{title}</h3>
                <p className="text-xs leading-relaxed text-slate-400">{desc}</p>
              </TiltCard>
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
          <div className="relative mb-5">
            <div className="w-full text-center">
              <h2 className="text-2xl font-bold text-white md:text-3xl">Top 10 Most Followed Masters</h2>
            </div>
            <div className="absolute right-0 top-1/2 hidden -translate-y-1/2 items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 md:flex">
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
            </>
          )}
        </section>

        {/* FAQ */}
        <section className="mt-16">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-white md:text-3xl">Frequently asked questions</h2>
          </div>
          <style>{`
            @keyframes faq-bump {
              0% { transform: translateY(0) scale(1); }
              65% { transform: translateY(-12px) scale(1.048); }
              100% { transform: translateY(-10px) scale(1.04); }
            }
            .faq-card {
              transition: box-shadow 240ms ease, transform 240ms ease;
            }
            .faq-card:hover {
              animation: faq-bump 320ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
              box-shadow: 0 0 28px rgba(16, 185, 129, 0.22);
            }
            .faq-card:hover button {
              color: #67e8f9;
            }
            .faq-card:hover button svg {
              color: #67e8f9;
            }
            .faq-card-active {
              box-shadow: 0 0 32px rgba(34, 211, 238, 0.2);
            }
          `}</style>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {faqItems.map((item, i) => (
              <div key={i} className={`faq-card h-fit rounded-xl bg-slate-900/60 ${openFaqModal === i ? 'faq-card-active' : ''}`}>
                <button
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-white"
                  onClick={() => setOpenFaqModal(i)}
                >
                  {item.q}
                  <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-400" />
                </button>
              </div>
            ))}
          </div>
          {openFaqModal !== null && (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 px-4"
              onClick={() => setOpenFaqModal(null)}
            >
              <div
                className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl shadow-black/60"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-3 flex items-start justify-between gap-4">
                  <h3 className="text-lg font-semibold text-white">{faqItems[openFaqModal].q}</h3>
                  <button
                    className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:border-slate-500 hover:text-white"
                    onClick={() => setOpenFaqModal(null)}
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-sm leading-relaxed text-slate-300">{faqItems[openFaqModal].a}</p>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* JOIN POP OUT FEED */}
      {joinToasts.length > 0 && (
        <div className="pointer-events-none fixed bottom-5 right-4 z-50 flex w-[min(92vw,360px)] flex-col gap-2 [perspective:900px]">
          <style>{`
            @keyframes join-pop-in {
              0% { opacity: 0; filter: blur(1.2px); }
              100% { opacity: 1; filter: blur(0); }
            }
            @keyframes join-pop-out {
              0% { opacity: 1; transform: translateY(0); filter: blur(0); }
              100% { opacity: 0; transform: translateY(-18px); filter: blur(2px); }
            }
            .join-pop-card {
              transform-origin: center bottom;
              transition: transform 760ms cubic-bezier(0.16, 1, 0.3, 1);
              will-change: transform, opacity, filter;
              backface-visibility: hidden;
            }
            .join-pop-card.is-leaving {
              animation: join-pop-out 760ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
            }
            .join-pop-card .join-pop-inner {
              opacity: calc(1 - (var(--stack-depth, 0) * 0.08));
              filter: saturate(calc(1 - (var(--stack-depth, 0) * 0.08)));
              transition: opacity 560ms cubic-bezier(0.16, 1, 0.3, 1), filter 560ms cubic-bezier(0.16, 1, 0.3, 1);
              animation: join-pop-in 920ms cubic-bezier(0.16, 1, 0.3, 1);
            }
          `}</style>
          {joinToasts.map((item, idx) => {
            const depth = Math.max(0, joinToasts.length - idx - 1);
            return (
              <div
              key={item.id}
              className={`join-pop-card rounded-xl bg-slate-900/90 px-3 py-2 text-xs text-slate-200 backdrop-blur-sm ${item.leaving ? 'is-leaving' : ''}`}
              style={{ transform: `translateY(-${depth * 12}px) rotateX(${depth * 12}deg)` }}
            >
              <span className="join-pop-inner inline-flex items-center gap-2" style={{ ['--stack-depth' as '--stack-depth']: depth }}>
                <span className="h-2 w-2 rounded-full bg-emerald-400/95" />
                {item.text}
              </span>
              </div>
            );
          })}
        </div>
      )}

      {/* CTA BANNER - full width */}
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
        </div>
      </div>

      {/* FOOTER */}
      <footer className="relative z-10 bg-slate-950 px-4 py-7">
        <style>{`
          .hf-footer-fade {
            animation: hf-footer-fade 7.5s ease-in-out infinite;
          }
          @keyframes hf-footer-fade {
            0%, 100% { transform: translateX(-16%) translateY(-10px) scaleX(0.88); opacity: 0.08; }
            50% { transform: translateX(16%) translateY(0) scaleX(1); opacity: 0.26; }
          }
        `}</style>
        <div className="pointer-events-none absolute inset-x-0 -top-10 h-16 overflow-hidden">
          <div className="hf-footer-fade mx-auto h-full w-[42%] bg-gradient-to-b from-cyan-300/30 via-cyan-300/12 to-transparent blur-xl" />
        </div>
        <div className="mx-auto flex w-full flex-col items-center justify-between gap-3 sm:px-2 md:flex-row lg:w-[85%] lg:px-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1.5">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-semibold tracking-wide text-slate-200">HF Copy Trader</span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-5 text-[11px] uppercase tracking-wider text-slate-500">
            <Link href="/landing" className="transition-colors hover:text-slate-300">Home</Link>
            <Link href="/login" className="transition-colors hover:text-slate-300">Sign In</Link>
            <Link href="/register" className="transition-colors hover:text-slate-300">Register</Link>
            <Link href="/master-register" className="transition-colors hover:text-slate-300">Master</Link>
          </nav>
          <p className="text-[11px] text-slate-600">&copy; {new Date().getFullYear()} HF Copy Trader</p>
        </div>
      </footer>
    </div>
  );
}
