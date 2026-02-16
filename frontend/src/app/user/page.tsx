'use client';

import { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import { API } from '@/lib/api';

interface User {
  id: number;
  name: string;
  email: string;
  balance: number;
  created_at: string;
  subscriptions?: Subscription[];
}

interface Master {
  id: number;
  name: string;
  status: string;
  signal_count: number;
}

interface Subscription {
  id: number;
  user_id: number;
  master_id: number;
  lot_multiplier: number;
  status: string;
  master_name: string;
  master_status: string;
}

interface CopiedTrade {
  id: number;
  user_id: number;
  master_id: number;
  symbol: string;
  action: string;
  price: number;
  lot_size: number;
  status: string;
  copied_at: string;
}

type Tab = 'portfolio' | 'subscriptions' | 'settings';

export default function UserPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [masters, setMasters] = useState<Master[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [trades, setTrades] = useState<CopiedTrade[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('portfolio');
  const [loading, setLoading] = useState(true);

  // Create user form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // Settings form
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/users`);
      setUsers(await res.json());
    } catch {
      console.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMasters = useCallback(async () => {
    try {
      const res = await fetch(`${API}/masters`);
      setMasters(await res.json());
    } catch {
      console.error('Failed to fetch masters');
    }
  }, []);

  useEffect(() => { fetchUsers(); fetchMasters(); }, [fetchUsers, fetchMasters]);

  const selectUser = useCallback(async (userId: number) => {
    try {
      const [userRes, tradesRes] = await Promise.all([
        fetch(`${API}/users/${userId}`),
        fetch(`${API}/users/${userId}/trades`),
      ]);
      const userData = await userRes.json();
      const tradesData = await tradesRes.json();
      setSelectedUser(userData);
      setTrades(tradesData);
      setEditName(userData.name);
      setEditEmail(userData.email);
    } catch {
      console.error('Failed to fetch user details');
    }
  }, []);

  const createUser = async () => {
    if (!newName.trim() || !newEmail.trim()) return;
    try {
      const res = await fetch(`${API}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), email: newEmail.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error);
        return;
      }
      setNewName('');
      setNewEmail('');
      setShowCreate(false);
      fetchUsers();
    } catch {
      console.error('Failed to create user');
    }
  };

  const updateUser = async () => {
    if (!selectedUser) return;
    try {
      const res = await fetch(`${API}/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), email: editEmail.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error);
        return;
      }
      selectUser(selectedUser.id);
      fetchUsers();
    } catch {
      console.error('Failed to update user');
    }
  };

  const subscribe = async (masterId: number) => {
    if (!selectedUser) return;
    try {
      const res = await fetch(`${API}/users/${selectedUser.id}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ master_id: masterId }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error);
        return;
      }
      selectUser(selectedUser.id);
    } catch {
      console.error('Failed to subscribe');
    }
  };

  const unsubscribe = async (masterId: number) => {
    if (!selectedUser) return;
    try {
      await fetch(`${API}/users/${selectedUser.id}/subscribe/${masterId}`, {
        method: 'DELETE',
      });
      selectUser(selectedUser.id);
    } catch {
      console.error('Failed to unsubscribe');
    }
  };

  const formatPrice = (p: number) => (p > 100 ? p.toFixed(2) : p.toFixed(4));
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  const subscribedMasterIds = new Set(
    (selectedUser?.subscriptions || []).map((s) => s.master_id)
  );

  const openTrades = trades.filter((t) => t.status === 'open');
  const totalPnl = openTrades.length; // placeholder, real P&L needs live prices

  const tabs: { key: Tab; label: string }[] = [
    { key: 'portfolio', label: 'Portfolio' },
    { key: 'subscriptions', label: 'Subscriptions' },
    { key: 'settings', label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <Navbar />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Users</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              Manage copier accounts, subscriptions, and portfolios
            </p>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors"
          >
            {showCreate ? 'Cancel' : '+ Add User'}
          </button>
        </div>

        {/* Create User Form */}
        {showCreate && (
          <div className="mb-6 p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 animate-fade-in-down">
            <div className="flex gap-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Full name..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createUser()}
                placeholder="Email address..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <button
                onClick={createUser}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* User List Sidebar */}
          <div className="lg:col-span-4 xl:col-span-3">
            <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-500">
                  Accounts ({users.length})
                </h2>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : users.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <p className="text-sm text-gray-400 dark:text-slate-500">No users yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-slate-800/50">
                  {users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => selectUser(u.id)}
                      className={`w-full text-left px-5 py-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors ${
                        selectedUser?.id === u.id ? 'bg-emerald-500/5 border-l-2 border-l-emerald-500' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-400 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{u.name}</p>
                          <p className="text-[11px] text-gray-400 dark:text-slate-500 truncate">{u.email}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-400 dark:text-slate-500">
                        <span>Balance: <span className="font-mono font-medium text-gray-600 dark:text-slate-300">${u.balance.toLocaleString()}</span></span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* User Detail Panel */}
          <div className="lg:col-span-8 xl:col-span-9">
            {!selectedUser ? (
              <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center py-32">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700 mx-auto mb-4 flex items-center justify-center">
                    <span className="text-xl text-gray-300 dark:text-slate-600">←</span>
                  </div>
                  <p className="text-sm text-gray-400 dark:text-slate-500">Select a user to view details</p>
                </div>
              </div>
            ) : (
              <div>
                {/* User Header */}
                <div className="mb-6 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-400 flex items-center justify-center text-white font-bold text-lg">
                      {selectedUser.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold">{selectedUser.name}</h2>
                      <p className="text-sm text-gray-400 dark:text-slate-500">{selectedUser.email}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500">Balance</p>
                      <p className="text-2xl font-bold font-mono text-emerald-500">${selectedUser.balance.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-6 p-1 rounded-xl bg-gray-100 dark:bg-slate-800/50 w-fit">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === tab.key
                          ? 'bg-white dark:bg-slate-900 shadow-sm text-gray-900 dark:text-white'
                          : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Portfolio Tab */}
                {activeTab === 'portfolio' && (
                  <div className="space-y-4 animate-fade-in-down">
                    {/* Quick Stats */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1">Open Trades</p>
                        <p className="text-2xl font-bold font-mono">{openTrades.length}</p>
                      </div>
                      <div className="p-4 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1">Total Copied</p>
                        <p className="text-2xl font-bold font-mono">{trades.length}</p>
                      </div>
                      <div className="p-4 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1">Subscriptions</p>
                        <p className="text-2xl font-bold font-mono">{selectedUser.subscriptions?.length || 0}</p>
                      </div>
                    </div>

                    {/* Trades Table */}
                    <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800">
                        <h3 className="text-sm font-semibold">Copied Trades</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-slate-500 border-b border-gray-100 dark:border-slate-800">
                              <th className="px-6 py-3 text-left">Time</th>
                              <th className="px-6 py-3 text-left">Master</th>
                              <th className="px-6 py-3 text-left">Symbol</th>
                              <th className="px-6 py-3 text-left">Side</th>
                              <th className="px-6 py-3 text-right">Price</th>
                              <th className="px-6 py-3 text-right">Lot</th>
                              <th className="px-6 py-3 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="text-sm">
                            {trades.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="px-6 py-16 text-center text-gray-400 dark:text-slate-500 text-sm">
                                  No copied trades yet
                                </td>
                              </tr>
                            ) : (
                              trades.map((t) => (
                                <tr key={t.id} className="border-b border-gray-50 dark:border-slate-800/50 hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                                  <td className="px-6 py-3 text-xs font-mono text-gray-500 dark:text-slate-400">
                                    {formatDate(t.copied_at)}
                                  </td>
                                  <td className="px-6 py-3">
                                    <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-800 text-xs font-mono">#{t.master_id}</span>
                                  </td>
                                  <td className="px-6 py-3 font-mono font-semibold">{t.symbol}</td>
                                  <td className="px-6 py-3">
                                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                                      t.action === 'BUY'
                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                        : 'bg-red-500/10 text-red-600 dark:text-red-400'
                                    }`}>
                                      {t.action}
                                    </span>
                                  </td>
                                  <td className="px-6 py-3 text-right font-mono font-semibold">{formatPrice(t.price)}</td>
                                  <td className="px-6 py-3 text-right font-mono text-xs">{t.lot_size.toFixed(2)}</td>
                                  <td className="px-6 py-3 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                      t.status === 'open'
                                        ? 'bg-blue-500/10 text-blue-500'
                                        : 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                                    }`}>
                                      {t.status}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Subscriptions Tab */}
                {activeTab === 'subscriptions' && (
                  <div className="space-y-4 animate-fade-in-down">
                    {/* Active Subscriptions */}
                    {(selectedUser.subscriptions || []).length > 0 && (
                      <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800">
                          <h3 className="text-sm font-semibold">Active Subscriptions</h3>
                        </div>
                        <div className="divide-y divide-gray-50 dark:divide-slate-800/50">
                          {(selectedUser.subscriptions || []).map((sub) => (
                            <div key={sub.id} className="px-6 py-4 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center text-white font-bold text-xs">
                                  {sub.master_name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold">{sub.master_name}</p>
                                  <p className="text-[11px] text-gray-400 dark:text-slate-500">
                                    Lot multiplier: <span className="font-mono">{sub.lot_multiplier}x</span>
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  sub.master_status === 'active'
                                    ? 'bg-emerald-500/10 text-emerald-500'
                                    : 'bg-amber-500/10 text-amber-500'
                                }`}>
                                  {sub.master_status}
                                </span>
                                <button
                                  onClick={() => unsubscribe(sub.master_id)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                                >
                                  Unsubscribe
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Available Masters */}
                    <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800">
                        <h3 className="text-sm font-semibold">Available Masters</h3>
                      </div>
                      {masters.length === 0 ? (
                        <div className="px-6 py-12 text-center text-sm text-gray-400 dark:text-slate-500">
                          No masters available
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-50 dark:divide-slate-800/50">
                          {masters.map((m) => {
                            const isSubscribed = subscribedMasterIds.has(m.id);
                            return (
                              <div key={m.id} className="px-6 py-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center text-white font-bold text-xs">
                                    {m.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold">{m.name}</p>
                                    <p className="text-[11px] text-gray-400 dark:text-slate-500">
                                      {m.signal_count} signals sent
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    m.status === 'active'
                                      ? 'bg-emerald-500/10 text-emerald-500'
                                      : 'bg-amber-500/10 text-amber-500'
                                  }`}>
                                    {m.status}
                                  </span>
                                  {isSubscribed ? (
                                    <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400">
                                      Subscribed
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => subscribe(m.id)}
                                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                                    >
                                      Subscribe
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Settings Tab */}
                {activeTab === 'settings' && (
                  <div className="animate-fade-in-down">
                    <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
                      <h3 className="text-sm font-semibold mb-6">Account Settings</h3>
                      <div className="space-y-4 max-w-md">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Name</label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Email</label>
                          <input
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                          />
                        </div>
                        <button
                          onClick={updateUser}
                          className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors mt-2"
                        >
                          Save Changes
                        </button>
                      </div>

                      <hr className="my-8 border-gray-100 dark:border-slate-800" />

                      <h3 className="text-sm font-semibold mb-4">Account Info</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between py-2">
                          <span className="text-gray-500 dark:text-slate-400">User ID</span>
                          <span className="font-mono">#{selectedUser.id}</span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                          <span className="text-gray-500 dark:text-slate-400">Balance</span>
                          <span className="font-mono font-semibold text-emerald-500">${selectedUser.balance.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                          <span className="text-gray-500 dark:text-slate-400">Member Since</span>
                          <span className="text-xs">{formatDate(selectedUser.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
