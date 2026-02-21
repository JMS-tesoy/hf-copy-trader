'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { API } from '@/lib/api';
import { PowerIcon } from '@/components/ui/PowerIcon';
import { SubscriptionSettingsPanel, type SubscriptionFull } from '@/components/SubscriptionSettingsPanel';
import { Activity, TrendingUp, DollarSign, BarChart3 } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { LiveFeed } from '@/components/trade/LiveFeed';
import { useTradeSocket } from '@/lib/useTradeSocket';
import { SymbolDistChart } from '@/components/charts/SymbolDistChart';
import { MiniAreaChart } from '@/components/charts/MiniAreaChart';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { MasterCard, type LeaderboardMaster } from '@/components/MasterCard';

type Subscription = SubscriptionFull;

interface Trade {
  id: number;
  master_id: number;
  symbol: string;
  action: string;
  price: number;
  lot_size: number;
  sl: number;
  tp: number;
  status: string;
  copied_at: string;
  profit_pips?: number;
  closed_at?: string;
}

interface LiveTrade {
  master_id: number;
  symbol: string;
  action: string;
  price: number;
  timestamp: Date;
}

const tabs = ['Overview', 'My Trades', 'Subscriptions', 'Settings'] as const;
type Tab = typeof tabs[number];

function apiMe(path = '', opts: RequestInit = {}) {
  return fetch(`${API}${path}`, { credentials: 'include', ...opts });
}

export default function PortalPage() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('Overview');

  // Trades state
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradeTotal, setTradeTotal] = useState(0);
  const [tradeOffset, setTradeOffset] = useState(0);
  const [tradeStatus, setTradeStatus] = useState('all');
  const LIMIT = 20;

  // Filter state
  const [symbolFilter, setSymbolFilter] = useState('');
  const [masterFilter, setMasterFilter] = useState('');

  // Subscriptions state
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<LeaderboardMaster[]>([]);
  const [lbSort, setLbSort] = useState<'win_rate' | 'followers' | 'signals'>('win_rate');

  // Settings state — initialized from user once it loads
  const [settingsName, setSettingsName] = useState('');
  const [settingsEmail, setSettingsEmail] = useState('');
  const [settingsPwd, setSettingsPwd] = useState('');
  const [settingsMsg, setSettingsMsg] = useState('');
  const [prevUser, setPrevUser] = useState(user);
  if (prevUser !== user && user) {
    setPrevUser(user);
    setSettingsName(user.name);
    setSettingsEmail(user.email);
  }

  // Danger zone
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Live feed
  const [liveTrades, setLiveTrades] = useState<LiveTrade[]>([]);
  const subsRef = useRef(subs);
  subsRef.current = subs;

  const { status: wsStatus } = useTradeSocket(useCallback((trade: any) => {
    const subMasterIds = new Set(subsRef.current.map(s => s.master_id));
    if (!subMasterIds.has(trade.master_id)) return;
    setLiveTrades(prev => [{ ...trade, timestamp: new Date() }, ...prev].slice(0, 50));
  }, []));

  const loadTrades = useCallback(async (offset = 0, status = tradeStatus) => {
    const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
    if (symbolFilter) params.set('symbol', symbolFilter);
    if (masterFilter) params.set('master_id', masterFilter);
    const res = await apiMe(`/me/trades?${params}`);
    if (!res.ok) return;
    const data = await res.json();
    let filtered = data.trades;
    if (status !== 'all') filtered = filtered.filter((t: Trade) => t.status === status);
    setTrades(filtered);
    setTradeTotal(data.total);
    setTradeOffset(offset);
  }, [tradeStatus, symbolFilter, masterFilter]);

  const loadSubs = useCallback(async () => {
    const res = await apiMe('/me');
    if (!res.ok) return;
    const data = await res.json();
    setSubs(data.subscriptions || []);
  }, []);

  const loadLeaderboard = useCallback(async (sort: string = lbSort) => {
    const res = await fetch(`${API}/masters/leaderboard?sort=${sort}`);
    if (res.ok) setLeaderboard(await res.json());
  }, [lbSort]);

  useEffect(() => { loadTrades(0, tradeStatus); }, [tradeStatus]);
  useEffect(() => { loadSubs(); loadLeaderboard(); }, []);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const handleSubscribe = async (masterId: number, lotMultiplier: number) => {
    const res = await apiMe('/me/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ master_id: masterId, lot_multiplier: lotMultiplier }),
    });
    if (res.ok) { loadSubs(); loadLeaderboard(); }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsMsg('');
    const body: Record<string, string> = {};
    if (settingsName !== user?.name) body.name = settingsName;
    if (settingsEmail !== user?.email) body.email = settingsEmail;
    if (settingsPwd) body.password = settingsPwd;
    if (!Object.keys(body).length) { setSettingsMsg('Nothing changed.'); return; }
    const res = await apiMe('/me/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setSettingsPwd('');
      setSettingsMsg('Saved.');
      refreshUser();
    } else {
      const e = await res.json();
      setSettingsMsg(e.error);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const res = await apiMe('/me', { method: 'DELETE' });
      if (res.ok) {
        await logout();
        router.push('/login');
      }
    } finally {
      setDeletingAccount(false);
    }
  };

  // Derived data for Overview tab
  const openPositions = trades.filter(t => t.status === 'open').length;
  const activeSubs = subs.filter(s => s.status === 'active').length;
  const avgWinRate = useMemo(() => {
    const rates = subs.filter(s => s.win_rate != null).map(s => s.win_rate as number);
    if (!rates.length) return null;
    return Math.round(rates.reduce((a, b) => a + b, 0) / rates.length);
  }, [subs]);

  const symbolData = useMemo(() => {
    const counts: Record<string, number> = {};
    trades.forEach(t => { counts[t.symbol] = (counts[t.symbol] || 0) + 1; });
    return Object.entries(counts).map(([symbol, count]) => ({ symbol, count }));
  }, [trades]);

  const plData = useMemo(() => {
    const closed = trades.filter(t => t.status === 'closed' && t.profit_pips != null && t.closed_at);
    if (!closed.length) return [];
    const byDay: Record<string, number> = {};
    closed.forEach(t => {
      const day = new Date(t.closed_at!).toISOString().slice(0, 10);
      byDay[day] = (byDay[day] || 0) + (t.profit_pips || 0);
    });
    const days = Object.keys(byDay).sort();
    let cumulative = 0;
    return days.map(day => {
      cumulative += byDay[day];
      return { time: day, value: Math.round(cumulative * 10) / 10 };
    });
  }, [trades]);

  // Client-side filter for My Trades display
  const displayedTrades = useMemo(() => {
    return trades
      .filter(t => !symbolFilter || t.symbol.toLowerCase().includes(symbolFilter.toLowerCase()))
      .filter(t => !masterFilter || t.master_id === Number(masterFilter));
  }, [trades, symbolFilter, masterFilter]);

  const actionColor: Record<string, string> = {
    BUY: 'text-green-400', SELL: 'text-red-400',
    CLOSE_BUY: 'text-emerald-400', CLOSE_SELL: 'text-rose-400', MODIFY: 'text-yellow-400',
  };

  const wsStatusColor = wsStatus === 'connected' ? 'text-emerald-400' : wsStatus === 'connecting' ? 'text-amber-400' : 'text-red-400';
  const wsStatusLabel = wsStatus === 'connected' ? 'Live' : wsStatus === 'connecting' ? 'Connecting...' : 'Disconnected';

  return (
    <div className="min-h-screen bg-slate-950 text-gray-100">
      {selectedSub && (
        <SubscriptionSettingsPanel
          subscription={selectedSub}
          onClose={() => setSelectedSub(null)}
          onSaved={() => { setSelectedSub(null); loadSubs(); }}
          onUnsubscribed={() => { setSelectedSub(null); loadSubs(); }}
          saveUrl={(id) => `${API}/me/subscriptions/${id}`}
          deleteUrl={(sub) => `${API}/me/subscribe/${sub.master_id}`}
          perfUrl={(id) => `${API}/me/subscriptions/${id}/performance`}
          historyUrl={(id) => `${API}/me/subscriptions/${id}/history`}
        />
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteAccount}
        title="Delete Account"
        message="This will permanently delete your account, all subscriptions, and trade history. This cannot be undone."
        confirmText="Delete permanently"
        loading={deletingAccount}
      />

      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">My Portfolio</h1>
          <p className="text-xs text-slate-400">{user?.email}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400">
            Balance: <span className="text-white font-medium">${user?.balance?.toLocaleString()}</span>
          </span>
          <button
            onClick={handleLogout}
            className="text-slate-400 hover:text-red-400 transition-colors"
            title="Sign out"
          >
            <PowerIcon />
          </button>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-slate-900/60 border-b border-slate-800">
        <div className="max-w-5xl mx-auto grid grid-cols-4 divide-x divide-slate-800">
          {[
            { label: 'Open Positions', value: openPositions },
            { label: 'Active Subs', value: activeSubs },
            { label: 'Total Trades', value: tradeTotal },
            { label: 'Balance', value: `$${user?.balance?.toLocaleString() ?? '—'}` },
          ].map(({ label, value }) => (
            <div key={label} className="px-5 py-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
              <p className="text-base font-semibold text-white mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-slate-800">
          {tabs.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {tab === 'Overview' && (
          <div className="space-y-6">
            {/* StatCards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Account Balance" sub="current" icon={DollarSign}>
                ${user?.balance?.toLocaleString() ?? '—'}
              </StatCard>
              <StatCard label="Open Positions" sub={`from ${activeSubs} master${activeSubs !== 1 ? 's' : ''}`} icon={Activity}>
                {openPositions}
              </StatCard>
              <StatCard label="Total Trades" sub="all time" icon={TrendingUp}>
                {tradeTotal}
              </StatCard>
              <StatCard label="Avg Win Rate" sub="across subscriptions" icon={BarChart3}>
                {avgWinRate != null ? `${avgWinRate}%` : '—'}
              </StatCard>
            </div>

            {/* Live feed + Symbol exposure */}
            <div className="grid md:grid-cols-5 gap-4">
              {/* Live Signals (60%) */}
              <div className="md:col-span-3 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col" style={{ minHeight: 320 }}>
                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Live Signals</h2>
                  <span className={`flex items-center gap-1.5 text-xs font-medium ${wsStatusColor}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {wsStatusLabel}
                  </span>
                </div>
                <div className="flex-1 overflow-hidden">
                  {liveTrades.length === 0 ? (
                    <div className="flex items-center justify-center h-full py-16">
                      <p className="text-sm text-slate-600">Waiting for signals from your masters...</p>
                    </div>
                  ) : (
                    <LiveFeed trades={liveTrades} maxItems={15} />
                  )}
                </div>
              </div>

              {/* Symbol Exposure (40%) */}
              <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">Your Symbol Exposure</h2>
                <SymbolDistChart data={symbolData} maxItems={6} />
              </div>
            </div>

            {/* P&L Mini Chart */}
            {plData.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Cumulative P&L (pips)</h2>
                <MiniAreaChart data={plData} color="#22c55e" height={120} />
              </div>
            )}
          </div>
        )}

        {/* My Trades */}
        {tab === 'My Trades' && (
          <div>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <input
                type="text"
                placeholder="Symbol…"
                value={symbolFilter}
                onChange={e => setSymbolFilter(e.target.value)}
                className="w-32 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500 placeholder-slate-600"
              />
              <select
                value={masterFilter}
                onChange={e => setMasterFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="">All Masters</option>
                {subs.map(s => (
                  <option key={s.master_id} value={s.master_id}>{s.master_name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm text-slate-400">Status:</span>
              {['all', 'open', 'closed'].map(s => (
                <button
                  key={s}
                  onClick={() => setTradeStatus(s)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    tradeStatus === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
              <span className="ml-auto text-xs text-slate-500">{tradeTotal} total</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs">
                    <th className="px-4 py-3 text-left">Symbol</th>
                    <th className="px-4 py-3 text-left">Action</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-right">Lots</th>
                    <th className="px-4 py-3 text-right">SL</th>
                    <th className="px-4 py-3 text-right">TP</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedTrades.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No trades found</td></tr>
                  ) : displayedTrades.map(t => (
                    <tr key={t.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-medium text-white">{t.symbol}</td>
                      <td className={`px-4 py-3 font-medium ${actionColor[t.action] || ''}`}>{t.action}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{t.price > 100 ? t.price.toFixed(2) : t.price.toFixed(5)}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{t.lot_size}</td>
                      <td className="px-4 py-3 text-right text-slate-400">{t.sl || '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-400">{t.tp || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          t.status === 'open' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'
                        }`}>{t.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 text-xs">
                        {new Date(t.copied_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {tradeTotal > LIMIT && (
              <div className="flex justify-between items-center mt-4">
                <button
                  disabled={tradeOffset === 0}
                  onClick={() => loadTrades(tradeOffset - LIMIT)}
                  className="px-3 py-1 text-sm bg-slate-800 rounded-lg disabled:opacity-40 hover:bg-slate-700"
                >
                  Previous
                </button>
                <span className="text-xs text-slate-500">
                  {tradeOffset + 1}–{Math.min(tradeOffset + LIMIT, tradeTotal)} of {tradeTotal}
                </span>
                <button
                  disabled={tradeOffset + LIMIT >= tradeTotal}
                  onClick={() => loadTrades(tradeOffset + LIMIT)}
                  className="px-3 py-1 text-sm bg-slate-800 rounded-lg disabled:opacity-40 hover:bg-slate-700"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {/* Subscriptions */}
        {tab === 'Subscriptions' && (
          <div className="space-y-6">
            {/* Active subscriptions */}
            <div>
              <h2 className="text-sm font-medium text-slate-400 mb-3">Active Subscriptions</h2>
              {subs.length === 0 ? (
                <p className="text-slate-500 text-sm">No subscriptions yet.</p>
              ) : (
                <div className="space-y-2">
                  {subs.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSub(s)}
                      className="w-full bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-xl px-4 py-3 flex items-center gap-4 text-left transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white truncate">{s.master_name}</div>
                        <div className="text-xs text-slate-500">
                          Lot ×{s.lot_multiplier}
                          {s.total_trades > 0 && ` · ${s.total_trades} trades`}
                          {s.win_rate != null && ` · ${s.win_rate.toFixed(0)}% win`}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                        s.status === 'active' ? 'bg-green-500/20 text-green-400' :
                        s.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' :
                        s.status === 'suspended' ? 'bg-red-500/20 text-red-400' :
                        'bg-slate-700 text-slate-400'
                      }`}>{s.status}</span>
                      <span className="text-slate-600 text-sm shrink-0">›</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Master discovery grid */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-slate-400">Browse Masters</h2>
                <div className="flex gap-1">
                  {(['win_rate', 'followers', 'signals'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => { setLbSort(s); loadLeaderboard(s); }}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        lbSort === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {s === 'win_rate' ? 'Win Rate' : s === 'followers' ? 'Followers' : 'Signals'}
                    </button>
                  ))}
                </div>
              </div>
              {leaderboard.length === 0 ? (
                <p className="text-slate-500 text-sm">No masters available.</p>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {leaderboard.map(m => (
                    <MasterCard
                      key={m.id}
                      master={m}
                      isSubscribed={subs.some(s => s.master_id === m.id)}
                      onSubscribe={handleSubscribe}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Settings */}
        {tab === 'Settings' && (
          <div className="max-w-md space-y-6">
            <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <h2 className="text-sm font-medium text-white">Account Settings</h2>
              {settingsMsg && (
                <p className={`text-sm ${settingsMsg === 'Saved.' ? 'text-green-400' : 'text-red-400'}`}>
                  {settingsMsg}
                </p>
              )}
              <div>
                <label htmlFor="settings-name" className="block text-xs text-slate-400 mb-1">Name</label>
                <input
                  id="settings-name"
                  type="text"
                  value={settingsName}
                  onChange={e => setSettingsName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="settings-email" className="block text-xs text-slate-400 mb-1">Email</label>
                <input
                  id="settings-email"
                  type="email"
                  value={settingsEmail}
                  onChange={e => setSettingsEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="settings-pwd" className="block text-xs text-slate-400 mb-1">New password <span className="text-slate-600">(leave blank to keep current)</span></label>
                <input
                  id="settings-pwd"
                  type="password"
                  value={settingsPwd}
                  onChange={e => setSettingsPwd(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>
              <div className="pt-1 flex items-center gap-4">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Save changes
                </button>
                <div className="text-xs text-slate-500">
                  Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                </div>
              </div>
            </form>

            {/* Danger Zone */}
            <div className="border border-red-500/30 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-red-400 mb-1">Danger Zone</h2>
              <div className="flex items-start justify-between gap-4 mt-3">
                <div>
                  <p className="text-sm font-medium text-white">Delete Account</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Permanently delete your account and all associated data. This cannot be undone.
                  </p>
                </div>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="shrink-0 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs font-medium rounded-lg border border-red-500/30 transition-colors"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
