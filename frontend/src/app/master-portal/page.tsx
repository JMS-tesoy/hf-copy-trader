'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { API } from '@/lib/api';
import {
  LayoutDashboard, History, Key, Settings,
  Copy, Check, RefreshCw, TrendingUp, Users, Zap, AlertCircle,
  ChevronLeft, ChevronRight, Eye, EyeOff,
} from 'lucide-react';
import { PowerIcon } from '@/components/ui/PowerIcon';
import { SubscriberStack } from '@/components/SubscriberStack';
import { SubscriberProfileModal } from '@/components/SubscriberProfileModal';

const LIMIT = 20;

type Tab = 'Overview' | 'Trade History' | 'API Key' | 'Settings';

interface MasterStats {
  id: number;
  name: string;
  email: string;
  bio: string | null;
  status: string;
  api_key: string;
  created_at: string;
  signal_count: number;
  subscriber_count: number;
  last_signal_at: string | null;
}

interface Trade {
  id: number;
  symbol: string;
  action: string;
  price: number;
  received_at: string;
}

interface Subscriber {
  id: number;
  name: string;
}

function fmt(ts: string | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

function actionColor(action: string) {
  if (action === 'BUY') return 'text-emerald-400';
  if (action === 'SELL') return 'text-red-400';
  if (action.startsWith('CLOSE_')) return 'text-amber-400';
  if (action === 'MODIFY') return 'text-blue-400';
  return 'text-slate-400';
}

export default function MasterPortalPage() {
  const { master, role, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('Overview');

  // Stats
  const [stats, setStats] = useState<MasterStats | null>(null);
  const [statsError, setStatsError] = useState('');
  
  // Subscribers
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [selectedSubscriber, setSelectedSubscriber] = useState<Subscriber | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Trades
  const [trades, setTrades] = useState<Trade[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [tradesLoading, setTradesLoading] = useState(false);

  // API Key
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regen, setRegen] = useState(false);
  const [regenConfirm, setRegenConfirm] = useState(false);
  const [keyLoading, setKeyLoading] = useState(false);

  // Settings
  const [sName, setSName] = useState('');
  const [sEmail, setSEmail] = useState('');
  const [sBio, setSBio] = useState('');
  const [sPassword, setSPassword] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');
  const [settingsError, setSettingsError] = useState('');

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/master-me`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load stats');
      const data = await res.json();
      setStats(data);
      setSName(data.name);
      setSEmail(data.email ?? '');
      setSBio(data.bio ?? '');
    } catch (err: any) {
      setStatsError(err.message);
    }
  }, []);

  const loadSubscribers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/master-me/subscribers`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setSubscribers(Array.isArray(data) ? data : data.subscribers || []);
    } catch {
      // silently ignore
    }
  }, []);

  const loadTrades = useCallback(async (off = 0) => {
    setTradesLoading(true);
    try {
      const res = await fetch(`${API}/master-me/trades?limit=${LIMIT}&offset=${off}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load trades');
      const data = await res.json();
      setTrades(data.trades);
      setTotal(data.total);
      setOffset(off);
    } catch {
      // silently ignore
    } finally {
      setTradesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (role === null) return; // still loading
    if (role !== 'master') { router.replace('/login'); return; }
    loadStats();
    loadSubscribers();
  }, [role, router, loadStats, loadSubscribers]);

  useEffect(() => {
    if (tab === 'Trade History') loadTrades(0);
  }, [tab, loadTrades]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const copyKey = () => {
    if (!stats) return;
    navigator.clipboard.writeText(stats.api_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    if (!regenConfirm) { setRegenConfirm(true); return; }
    setKeyLoading(true);
    try {
      const res = await fetch(`${API}/master-me/regenerate-key`, { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to regenerate key');
      const data = await res.json();
      setStats(prev => prev ? { ...prev, api_key: data.api_key } : prev);
      setRegenConfirm(false);
      setShowKey(true);
    } catch {
      // ignore
    } finally {
      setKeyLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaving(true);
    setSettingsMsg('');
    setSettingsError('');
    try {
      const body: Record<string, string> = {};
      if (sName !== stats?.name) body.name = sName;
      if (sEmail !== (stats?.email ?? '')) body.email = sEmail;
      if (sBio !== (stats?.bio ?? '')) body.bio = sBio;
      if (sPassword) body.password = sPassword;
      if (Object.keys(body).length === 0) { setSettingsMsg('No changes to save.'); return; }
      const res = await fetch(`${API}/master-me/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStats(prev => prev ? { ...prev, ...data } : prev);
      setSPassword('');
      await refreshUser();
      setSettingsMsg('Settings saved successfully.');
    } catch (err: any) {
      setSettingsError(err.message);
    } finally {
      setSettingsSaving(false);
    }
  };

  const tabs: { id: Tab; icon: React.ReactNode }[] = [
    { id: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'Trade History', icon: <History className="w-4 h-4" /> },
    { id: 'API Key', icon: <Key className="w-4 h-4" /> },
    { id: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  const maskedKey = stats ? `${stats.api_key.slice(0, 8)}${'•'.repeat(48)}${stats.api_key.slice(-8)}` : '';

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
              <span className="text-white text-xs font-black">HF</span>
            </div>
            <div>
              <span className="text-white font-semibold text-sm">Master Portal</span>
              {stats && (
                <span className="text-slate-400 text-xs ml-2">{stats.name}</span>
              )}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-slate-400 hover:text-red-400 text-sm transition-colors"
          >
            <PowerIcon />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Tab nav */}
        <nav className="flex gap-1 mb-6 border-b border-slate-800 pb-0">
          {tabs.map(({ id, icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === id
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {icon}
              <span className="hidden sm:inline">{id}</span>
            </button>
          ))}
        </nav>

        {/* ── OVERVIEW ── */}
        {tab === 'Overview' && (
          <div>
            {statsError && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {statsError}
              </div>
            )}
            {stats ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  {/* Subscribers card with stacked avatars */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3"><Users className="w-5 h-5 text-emerald-400" /><span className="text-slate-400 text-xs">Subscribers</span></div>
                    <SubscriberStack
                      subscribers={subscribers}
                      onSubscriberClick={(sub) => {
                        setSelectedSubscriber(sub);
                        setShowProfileModal(true);
                      }}
                    />
                  </div>

                  {[
                    { icon: <Zap className="w-5 h-5 text-cyan-400" />, label: 'Signals Sent', value: stats.signal_count },
                    {
                      icon: <TrendingUp className="w-5 h-5 text-blue-400" />,
                      label: 'Last Signal',
                      value: stats.last_signal_at ? new Date(stats.last_signal_at).toLocaleDateString() : '—',
                    },
                    {
                      icon: (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                          stats.status === 'active'
                            ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                            : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                        }`}>
                          {stats.status.toUpperCase()}
                        </span>
                      ),
                      label: 'Status',
                      value: null,
                    },
                  ].map(({ icon, label, value }) => (
                    <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-slate-400 text-xs">{label}</span></div>
                      {value !== null && <div className="text-2xl font-bold text-white">{value}</div>}
                    </div>
                  ))}
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-slate-300 mb-3">Account Info</h3>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div><dt className="text-slate-500">Name</dt><dd className="text-white mt-0.5">{stats.name}</dd></div>
                    <div><dt className="text-slate-500">Email</dt><dd className="text-white mt-0.5">{stats.email ?? '—'}</dd></div>
                    <div><dt className="text-slate-500">Master ID</dt><dd className="text-white mt-0.5">#{stats.id}</dd></div>
                    <div><dt className="text-slate-500">Joined</dt><dd className="text-white mt-0.5">{fmt(stats.created_at)}</dd></div>
                  </dl>
                </div>
              </>
            ) : (
              !statsError && <div className="text-slate-500 text-sm">Loading…</div>
            )}
          </div>
        )}

        {/* ── TRADE HISTORY ── */}
        {tab === 'Trade History' && (
          <div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                    <th className="text-left px-4 py-3">Symbol</th>
                    <th className="text-left px-4 py-3">Action</th>
                    <th className="text-right px-4 py-3">Price</th>
                    <th className="text-right px-4 py-3 hidden sm:table-cell">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {tradesLoading ? (
                    <tr><td colSpan={4} className="text-center text-slate-500 py-8">Loading…</td></tr>
                  ) : trades.length === 0 ? (
                    <tr><td colSpan={4} className="text-center text-slate-500 py-8">No trades yet.</td></tr>
                  ) : trades.map(t => (
                    <tr key={t.id} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-white">{t.symbol}</td>
                      <td className={`px-4 py-3 font-semibold ${actionColor(t.action)}`}>{t.action}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{t.price.toFixed(5)}</td>
                      <td className="px-4 py-3 text-right text-slate-400 hidden sm:table-cell">{fmt(t.received_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {total > LIMIT && (
              <div className="flex items-center justify-between mt-4 text-sm text-slate-400">
                <span>{offset + 1}–{Math.min(offset + LIMIT, total)} of {total}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadTrades(offset - LIMIT)}
                    disabled={offset === 0}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" /> Prev
                  </button>
                  <button
                    onClick={() => loadTrades(offset + LIMIT)}
                    disabled={offset + LIMIT >= total}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── API KEY ── */}
        {tab === 'API Key' && stats && (
          <div className="max-w-lg space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-medium text-slate-300 mb-1">Your API Key</h3>
              <p className="text-slate-500 text-xs mb-4">
                Use this key in your MT5 TradeSender EA as the <code className="text-slate-300">x-api-key</code> header.
                Keep it secret — anyone with this key can broadcast trades as you.
              </p>

              <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 font-mono text-xs text-slate-300 break-all mb-4">
                {showKey ? stats.api_key : maskedKey}
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setShowKey(v => !v)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-300 text-sm transition-colors"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showKey ? 'Hide' : 'Reveal'}
                </button>

                <button
                  onClick={copyKey}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-300 text-sm transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>

                <button
                  onClick={handleRegenerate}
                  disabled={keyLoading}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                    regenConfirm
                      ? 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30'
                      : 'border border-slate-700 hover:border-slate-600 text-slate-300'
                  }`}
                >
                  <RefreshCw className={`w-4 h-4 ${keyLoading ? 'animate-spin' : ''}`} />
                  {regenConfirm ? 'Confirm regenerate?' : 'Regenerate'}
                </button>
                {regenConfirm && (
                  <button
                    onClick={() => setRegenConfirm(false)}
                    className="text-sm text-slate-500 hover:text-slate-300 px-2 transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {regenConfirm && (
                <p className="text-amber-400 text-xs mt-3">
                  Warning: regenerating will invalidate your current key. Your MT5 EA will stop working until you update it.
                </p>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-medium text-slate-300 mb-2">MT5 Setup</h3>
              <ol className="text-slate-400 text-xs space-y-1.5 list-decimal list-inside">
                <li>Copy your API key above</li>
                <li>Open TradeSender EA settings in your MT5</li>
                <li>Paste the key into the <code className="text-slate-300">ApiKey</code> input parameter</li>
                <li>Set <code className="text-slate-300">MasterId</code> to <strong className="text-white">#{stats.id}</strong></li>
                <li>Allow WebRequests to <code className="text-slate-300">http://&lt;your-backend&gt;:4000</code></li>
              </ol>
            </div>
          </div>
        )}

        {/* ── SETTINGS ── */}
        {tab === 'Settings' && (
          <div className="max-w-sm">
            <form onSubmit={handleSaveSettings} className="space-y-4">
              {settingsMsg && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm rounded-lg px-4 py-3">
                  {settingsMsg}
                </div>
              )}
              {settingsError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
                  {settingsError}
                </div>
              )}

              <div>
                <label htmlFor="m-name" className="block text-sm font-medium text-slate-300 mb-1.5">Full name</label>
                <input
                  id="m-name"
                  type="text"
                  value={sName}
                  onChange={e => setSName(e.target.value)}
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                  required
                />
              </div>

              <div>
                <label htmlFor="m-email" className="block text-sm font-medium text-slate-300 mb-1.5">Email address</label>
                <input
                  id="m-email"
                  type="email"
                  value={sEmail}
                  onChange={e => setSEmail(e.target.value)}
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                />
              </div>

              <div>
                <label htmlFor="m-bio" className="block text-sm font-medium text-slate-300 mb-1.5">
                  Bio <span className="text-slate-500 font-normal">(shown to potential subscribers)</span>
                </label>
                <textarea
                  id="m-bio"
                  value={sBio}
                  onChange={e => setSBio(e.target.value)}
                  rows={3}
                  maxLength={300}
                  placeholder="e.g. Scalping specialist focusing on EURUSD and GBPUSD. 5+ years experience."
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors resize-none"
                />
                <p className="text-[10px] text-slate-600 mt-1">{sBio.length}/300</p>
              </div>

              <div>
                <label htmlFor="m-pwd" className="block text-sm font-medium text-slate-300 mb-1.5">
                  New password <span className="text-slate-500 font-normal">(leave blank to keep current)</span>
                </label>
                <input
                  id="m-pwd"
                  type="password"
                  value={sPassword}
                  onChange={e => setSPassword(e.target.value)}
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                disabled={settingsSaving}
                className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50 text-white font-semibold rounded-xl py-2.5 text-sm transition-all shadow-lg shadow-emerald-500/20"
              >
                {settingsSaving ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          </div>
        )}

        {/* Subscriber Profile Modal */}
        <SubscriberProfileModal
          subscriber={selectedSubscriber}
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
        />
      </div>
    </div>
  );
}
