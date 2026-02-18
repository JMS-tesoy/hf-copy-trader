'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { API } from '@/lib/api';

interface Subscription {
  id: number;
  master_id: number;
  master_name: string;
  master_status: string;
  lot_multiplier: number;
  status: string;
}

interface Trade {
  id: number;
  symbol: string;
  action: string;
  price: number;
  lot_size: number;
  sl: number;
  tp: number;
  status: string;
  copied_at: string;
}

interface Master {
  id: number;
  name: string;
}

const tabs = ['My Trades', 'Subscriptions', 'Settings'] as const;
type Tab = typeof tabs[number];

function apiMe(path = '', opts: RequestInit = {}) {
  return fetch(`${API}${path}`, { credentials: 'include', ...opts });
}

export default function PortalPage() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('My Trades');

  // Trades state
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradeTotal, setTradeTotal] = useState(0);
  const [tradeOffset, setTradeOffset] = useState(0);
  const [tradeStatus, setTradeStatus] = useState('all');
  const LIMIT = 20;

  // Subscriptions state
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [masters, setMasters] = useState<Master[]>([]);
  const [subMasterId, setSubMasterId] = useState('');
  const [subLot, setSubLot] = useState('1');

  // Settings state
  const [settingsName, setSettingsName] = useState('');
  const [settingsEmail, setSettingsEmail] = useState('');
  const [settingsPwd, setSettingsPwd] = useState('');
  const [settingsMsg, setSettingsMsg] = useState('');

  const loadTrades = useCallback(async (offset = 0, status = tradeStatus) => {
    const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
    const res = await apiMe(`/me/trades?${params}`);
    if (!res.ok) return;
    const data = await res.json();
    let filtered = data.trades;
    if (status !== 'all') filtered = filtered.filter((t: Trade) => t.status === status);
    setTrades(filtered);
    setTradeTotal(data.total);
    setTradeOffset(offset);
  }, [tradeStatus]);

  const loadSubs = useCallback(async () => {
    const res = await apiMe('/me');
    if (!res.ok) return;
    const data = await res.json();
    setSubs(data.subscriptions || []);
  }, []);

  const loadMasters = useCallback(async () => {
    const res = await apiMe('/masters/public');
    if (!res.ok) return;
    setMasters(await res.json());
  }, []);

  useEffect(() => {
    if (user) {
      setSettingsName(user.name);
      setSettingsEmail(user.email);
    }
  }, [user]);

  useEffect(() => { loadTrades(0, tradeStatus); }, [tradeStatus]);
  useEffect(() => { loadSubs(); loadMasters(); }, []);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const handleSubscribe = async () => {
    if (!subMasterId) return;
    const res = await apiMe('/me/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ master_id: Number(subMasterId), lot_multiplier: Number(subLot) }),
    });
    if (res.ok) { setSubMasterId(''); setSubLot('1'); loadSubs(); }
  };

  const handleUnsubscribe = async (masterId: number) => {
    await apiMe(`/me/subscribe/${masterId}`, { method: 'DELETE' });
    loadSubs();
  };

  const toggleSubStatus = async (sub: Subscription) => {
    const newStatus = sub.status === 'active' ? 'paused' : 'active';
    await apiMe(`/me/subscriptions/${sub.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    loadSubs();
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

  const actionColor: Record<string, string> = {
    BUY: 'text-green-400', SELL: 'text-red-400',
    CLOSE_BUY: 'text-emerald-400', CLOSE_SELL: 'text-rose-400', MODIFY: 'text-yellow-400',
  };

  return (
    <div className="min-h-screen bg-slate-950 text-gray-100">
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
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

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

        {/* My Trades */}
        {tab === 'My Trades' && (
          <div>
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
                  {trades.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No trades found</td></tr>
                  ) : trades.map(t => (
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
                    <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-4">
                      <div className="flex-1">
                        <div className="font-medium text-white">{s.master_name}</div>
                        <div className="text-xs text-slate-500">Lot ×{s.lot_multiplier}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>{s.status}</span>
                      <button
                        onClick={() => toggleSubStatus(s)}
                        className="text-xs text-slate-400 hover:text-white transition-colors"
                      >
                        {s.status === 'active' ? 'Pause' : 'Resume'}
                      </button>
                      <button
                        onClick={() => handleUnsubscribe(s.master_id)}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        Unsubscribe
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Subscribe to a master */}
            <div>
              <h2 className="text-sm font-medium text-slate-400 mb-3">Subscribe to a Master</h2>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-slate-400 mb-1">Master trader</label>
                  <select
                    value={subMasterId}
                    onChange={e => setSubMasterId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                  >
                    <option value="">Select a master…</option>
                    {masters.filter(m => !subs.find(s => s.master_id === m.id)).map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div className="w-28">
                  <label className="block text-xs text-slate-400 mb-1">Lot multiplier</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={subLot}
                    onChange={e => setSubLot(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                  />
                </div>
                <button
                  onClick={handleSubscribe}
                  disabled={!subMasterId}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Subscribe
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Settings */}
        {tab === 'Settings' && (
          <div className="max-w-md">
            <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <h2 className="text-sm font-medium text-white">Account Settings</h2>
              {settingsMsg && (
                <p className={`text-sm ${settingsMsg === 'Saved.' ? 'text-green-400' : 'text-red-400'}`}>
                  {settingsMsg}
                </p>
              )}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Name</label>
                <input
                  type="text"
                  value={settingsName}
                  onChange={e => setSettingsName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Email</label>
                <input
                  type="email"
                  value={settingsEmail}
                  onChange={e => setSettingsEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">New password <span className="text-slate-600">(leave blank to keep current)</span></label>
                <input
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
          </div>
        )}
      </div>
    </div>
  );
}
