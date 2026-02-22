'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { API, adminHeaders } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SearchInput } from '@/components/ui/SearchInput';
import { useToast } from '@/components/notifications/useToast';
import { Users, Briefcase, Link2, Settings, Trash2, Edit2, Filter, X } from 'lucide-react';
import { SubscriptionSettingsPanel, type SubscriptionFull } from '@/components/SubscriptionSettingsPanel';

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

type Subscription = SubscriptionFull;

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
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const { toast } = useToast();

  // Search
  const [userSearch, setUserSearch] = useState('');

  // Trade filters + pagination
  const [tradeStatusFilter, setTradeStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [symbolFilter, setSymbolFilter] = useState('');
  const [tradesPage, setTradesPage] = useState(0);
  const [tradesTotal, setTradesTotal] = useState(0);

  // Delete user
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<{ userId: number; userName: string } | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);

  // Edit subscription (panel)
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);
  const [newSubLotMultiplier, setNewSubLotMultiplier] = useState('1.0');

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/users`, { headers: adminHeaders() });
      setUsers(await res.json());
    } catch {
      toast({ type: 'error', title: 'Failed to fetch users' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchMasters = useCallback(async () => {
    try {
      const res = await fetch(`${API}/masters`, { headers: adminHeaders() });
      setMasters(await res.json());
    } catch {
      toast({ type: 'error', title: 'Failed to fetch masters' });
    }
  }, [toast]);

  useEffect(() => { fetchUsers(); fetchMasters(); }, [fetchUsers, fetchMasters]);

  const selectUser = useCallback(async (userId: number, resetPage = true) => {
    const page = resetPage ? 0 : tradesPage;
    if (resetPage) setTradesPage(0);
    const limit = 50;

    try {
      const [userRes, tradesRes] = await Promise.all([
        fetch(`${API}/users/${userId}`, { headers: adminHeaders() }),
        fetch(`${API}/users/${userId}/trades?limit=${limit}&offset=${page * limit}`, { headers: adminHeaders() }),
      ]);
      const [userData, tradesData] = await Promise.all([userRes.json(), tradesRes.json()]);

      setSelectedUser(userData);
      setTrades(tradesData.trades || tradesData);
      setTradesTotal(tradesData.total ?? (Array.isArray(tradesData) ? tradesData.length : 0));
      setEditName(userData.name);
      setEditEmail(userData.email);
    } catch {
      toast({ type: 'error', title: 'Failed to fetch user details' });
    }
  }, [toast, tradesPage]);

  const createUser = async () => {
    if (!newName.trim() || !newEmail.trim()) return;
    try {
      const res = await fetch(`${API}/users`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ name: newName.trim(), email: newEmail.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ type: 'error', title: err.error || 'Failed to create user' });
        return;
      }
      setNewName('');
      setNewEmail('');
      setShowCreate(false);
      fetchUsers();
      toast({ type: 'success', title: 'User created successfully' });
    } catch {
      toast({ type: 'error', title: 'Failed to create user' });
    }
  };

  const updateUser = async () => {
    if (!selectedUser) return;
    try {
      const res = await fetch(`${API}/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: adminHeaders(),
        body: JSON.stringify({ name: editName.trim(), email: editEmail.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ type: 'error', title: err.error || 'Failed to update user' });
        return;
      }
      selectUser(selectedUser.id);
      fetchUsers();
      toast({ type: 'success', title: 'User updated' });
    } catch {
      toast({ type: 'error', title: 'Failed to update user' });
    }
  };

  const deleteUser = async () => {
    if (!confirmDeleteUser) return;
    const userId = confirmDeleteUser.userId;
    setDeletingUserId(userId);
    try {
      const res = await fetch(`${API}/users/${userId}`, {
        method: 'DELETE',
        headers: adminHeaders(),
      });
      if (!res.ok) throw new Error();
      if (selectedUser?.id === userId) setSelectedUser(null);
      fetchUsers();
      toast({ type: 'success', title: `"${confirmDeleteUser.userName}" deleted` });
      setConfirmDeleteUser(null);
    } catch {
      toast({ type: 'error', title: 'Failed to delete user' });
    } finally {
      setDeletingUserId(null);
    }
  };

  const subscribe = async (masterId: number) => {
    if (!selectedUser) return;
    const multiplier = parseFloat(newSubLotMultiplier);
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      toast({ type: 'error', title: 'Invalid lot multiplier' });
      return;
    }
    try {
      const res = await fetch(`${API}/users/${selectedUser.id}/subscribe`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ master_id: masterId, lot_multiplier: multiplier }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ type: 'error', title: err.error || 'Failed to subscribe' });
        return;
      }
      selectUser(selectedUser.id);
      toast({ type: 'success', title: 'Subscribed successfully' });
      setNewSubLotMultiplier('1.0');
    } catch {
      toast({ type: 'error', title: 'Failed to subscribe' });
    }
  };

  const unsubscribe = async (masterId: number) => {
    if (!selectedUser) return;
    try {
      await fetch(`${API}/users/${selectedUser.id}/subscribe/${masterId}`, {
        method: 'DELETE',
        headers: adminHeaders(),
      });
      selectUser(selectedUser.id);
      toast({ type: 'warning', title: 'Unsubscribed' });
    } catch {
      toast({ type: 'error', title: 'Failed to unsubscribe' });
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

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const query = userSearch.toLowerCase();
    return users.filter((u) =>
      u.name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query)
    );
  }, [users, userSearch]);

  const filteredTrades = useMemo(() => {
    let result = trades;
    if (tradeStatusFilter !== 'all') {
      result = result.filter((t) => t.status === tradeStatusFilter);
    }
    if (symbolFilter.trim()) {
      result = result.filter((t) =>
        t.symbol.toLowerCase().includes(symbolFilter.toLowerCase())
      );
    }
    return result;
  }, [trades, tradeStatusFilter, symbolFilter]);

  const tabs = [
    { key: 'portfolio', label: 'Portfolio', icon: Briefcase },
    { key: 'subscriptions', label: 'Subscriptions', icon: Link2 },
    { key: 'settings', label: 'Settings', icon: Settings },
  ];

  const PAGE_SIZE = 50;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
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
        <div className="p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 animate-fade-in-down">
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
          <Card padding={false} className="overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-500">
                Accounts ({filteredUsers.length})
              </h2>
            </div>

            {/* Search */}
            {users.length > 0 && (
              <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800">
                <SearchInput
                  value={userSearch}
                  onChange={setUserSearch}
                  placeholder="Search users..."
                />
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm text-gray-400 dark:text-slate-500">
                  {userSearch ? 'No users match your search' : 'No users yet'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-slate-800/50 max-h-[calc(100vh-280px)] overflow-y-auto">
                {filteredUsers.map((u) => (
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
          </Card>
        </div>

        {/* User Detail Panel */}
        <div className="lg:col-span-8 xl:col-span-9">
          {!selectedUser ? (
            <Card className="flex items-center justify-center py-32">
              <EmptyState icon={Users} title="Select a user to view details" />
            </Card>
          ) : (
            <div className="space-y-6">
              {/* User Header */}
              <Card>
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
                  <button
                    onClick={() => setConfirmDeleteUser({ userId: selectedUser.id, userName: selectedUser.name })}
                    disabled={deletingUserId === selectedUser.id}
                    className="ml-4 px-4 py-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {deletingUserId === selectedUser.id ? (
                      <>
                        <span className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </>
                    )}
                  </button>
                </div>
              </Card>

              {/* Tabs */}
              <Tabs
                tabs={tabs}
                activeTab={activeTab}
                onChange={(key) => setActiveTab(key as Tab)}
              />

              {/* Portfolio Tab */}
              {activeTab === 'portfolio' && (
                <div className="space-y-4 animate-fade-in-down">
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1">Open Trades</p>
                      <p className="text-2xl font-bold font-mono">{openTrades.length}</p>
                    </Card>
                    <Card>
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1">Total Copied</p>
                      <p className="text-2xl font-bold font-mono">{tradesTotal}</p>
                    </Card>
                    <Card>
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1">Subscriptions</p>
                      <p className="text-2xl font-bold font-mono">{selectedUser.subscriptions?.length || 0}</p>
                    </Card>
                  </div>

                  {/* Trade Filters */}
                  <Card>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                        <span className="text-sm font-medium text-gray-500 dark:text-slate-400">Filters:</span>
                      </div>
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex gap-1 p-1 rounded-lg bg-gray-100 dark:bg-slate-800">
                          {(['all', 'open', 'closed'] as const).map((status) => (
                            <button
                              key={status}
                              onClick={() => setTradeStatusFilter(status)}
                              className={cn(
                                'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                                tradeStatusFilter === status
                                  ? 'bg-white dark:bg-slate-900 shadow-sm'
                                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                              )}
                            >
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={symbolFilter}
                          onChange={(e) => setSymbolFilter(e.target.value)}
                          placeholder="Filter by symbol..."
                          className="flex-1 max-w-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                        {(tradeStatusFilter !== 'all' || symbolFilter) && (
                          <button
                            onClick={() => { setTradeStatusFilter('all'); setSymbolFilter(''); }}
                            className="text-xs text-red-500 hover:text-red-400 font-medium"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  </Card>

                  <Card padding={false} className="overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800">
                      <h3 className="text-sm font-semibold">Copied Trades</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-slate-500 border-b border-gray-100 dark:border-slate-800">
                            <th className="px-6 py-3 text-left">Time</th>
                            <th className="px-6 py-3 text-left">Master ID#</th>
                            <th className="px-6 py-3 text-left">Symbol</th>
                            <th className="px-6 py-3 text-left">Side</th>
                            <th className="px-6 py-3 text-right">Price</th>
                            <th className="px-6 py-3 text-right">Lot</th>
                            <th className="px-6 py-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {filteredTrades.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-6 py-16 text-center text-gray-400 dark:text-slate-500 text-sm">
                                {trades.length === 0 ? 'No copied trades yet' : 'No trades match your filters'}
                              </td>
                            </tr>
                          ) : (
                            filteredTrades.map((t) => (
                              <tr key={t.id} className="border-b border-gray-50 dark:border-slate-800/50 hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="px-6 py-3 text-xs font-mono text-gray-500 dark:text-slate-400">{formatDate(t.copied_at)}</td>
                                <td className="px-6 py-3">
                                  <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-800 text-xs font-mono">#{t.master_id}</span>
                                </td>
                                <td className="px-6 py-3 font-mono font-semibold">{t.symbol}</td>
                                <td className="px-6 py-3">
                                  <Badge variant={t.action === 'BUY' ? 'buy' : 'sell'} size="sm">{t.action}</Badge>
                                </td>
                                <td className="px-6 py-3 text-right font-mono font-semibold">{formatPrice(t.price)}</td>
                                <td className="px-6 py-3 text-right font-mono text-xs">{t.lot_size.toFixed(2)}</td>
                                <td className="px-6 py-3 text-center">
                                  <Badge variant={t.status}>{t.status}</Badge>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>

                      {/* Pagination */}
                      {tradesTotal > PAGE_SIZE && (
                        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-slate-800">
                          <p className="text-xs text-gray-500 dark:text-slate-400">
                            Showing {tradesPage * PAGE_SIZE + 1} - {Math.min((tradesPage + 1) * PAGE_SIZE, tradesTotal)} of {tradesTotal} trades
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const newPage = tradesPage - 1;
                                setTradesPage(newPage);
                                if (selectedUser) selectUser(selectedUser.id, false);
                              }}
                              disabled={tradesPage === 0}
                              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                            >
                              Previous
                            </button>
                            <button
                              onClick={() => {
                                const newPage = tradesPage + 1;
                                setTradesPage(newPage);
                                if (selectedUser) selectUser(selectedUser.id, false);
                              }}
                              disabled={(tradesPage + 1) * PAGE_SIZE >= tradesTotal}
                              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              )}

              {/* Subscriptions Tab */}
              {activeTab === 'subscriptions' && (
                <div className="space-y-4 animate-fade-in-down">
                  {(selectedUser.subscriptions || []).length > 0 && (
                    <Card padding={false} className="overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800">
                        <h3 className="text-sm font-semibold">Active Subscriptions</h3>
                      </div>
                      <div className="divide-y divide-gray-50 dark:divide-slate-800/50">
                        {(selectedUser.subscriptions || []).map((sub) => (
                          <button
                            key={sub.id}
                            onClick={() => setSelectedSub(sub)}
                            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center text-white font-bold text-xs">
                                {sub.master_name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-semibold">{sub.master_name}</p>
                                <p className="text-[11px] text-gray-400 dark:text-slate-500">
                                  Lot: <span className="font-mono">{sub.lot_multiplier}x</span>
                                  {sub.total_trades > 0 && ` · ${sub.total_trades} trades`}
                                  {' · '}
                                  <Badge variant={sub.status}>{sub.status}</Badge>
                                </p>
                              </div>
                            </div>
                            <Edit2 className="w-4 h-4 text-slate-400" />
                          </button>
                        ))}
                      </div>
                    </Card>
                  )}

                  <Card padding={false} className="overflow-hidden">
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
                                <Badge variant={m.status}>{m.status}</Badge>
                                {isSubscribed ? (
                                  <Badge variant="neutral">Subscribed</Badge>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-2">
                                      <label htmlFor={`lot-${m.id}`} className="text-xs text-gray-500 dark:text-slate-400">Lot:</label>
                                      <input
                                        id={`lot-${m.id}`}
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        value={newSubLotMultiplier}
                                        onChange={(e) => setNewSubLotMultiplier(e.target.value)}
                                        className="w-20 px-2 py-1 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                      />
                                      <span className="text-xs text-gray-400">x</span>
                                    </div>
                                    <button
                                      onClick={() => subscribe(m.id)}
                                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                                    >
                                      Subscribe
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                </div>
              )}

              {/* Settings Tab */}
              {activeTab === 'settings' && (
                <div className="animate-fade-in-down">
                  <Card>
                    <h3 className="text-sm font-semibold mb-6">Account Settings</h3>
                    <div className="space-y-4 max-w-md">
                      <div>
                        <label htmlFor="edit-name" className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Name</label>
                        <input
                          id="edit-name"
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                        />
                      </div>
                      <div>
                        <label htmlFor="edit-email" className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Email</label>
                        <input
                          id="edit-email"
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
                  </Card>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirm Delete User Dialog */}
      {confirmDeleteUser && (
        <ConfirmDialog
          open={true}
          onClose={() => setConfirmDeleteUser(null)}
          onConfirm={deleteUser}
          title="Delete User?"
          message={`This will permanently delete "${confirmDeleteUser.userName}" and all their subscriptions and trade history. This action cannot be undone.`}
          confirmText="Delete User"
          variant="danger"
          loading={deletingUserId === confirmDeleteUser.userId}
        />
      )}

      {/* Subscription Settings Panel */}
      {selectedSub && (
        <SubscriptionSettingsPanel
          subscription={selectedSub}
          onClose={() => setSelectedSub(null)}
          onSaved={() => {
            setSelectedSub(null);
            if (selectedUser) selectUser(selectedUser.id);
          }}
          onUnsubscribed={() => {
            setSelectedSub(null);
            if (selectedUser) selectUser(selectedUser.id);
          }}
          saveUrl={(id) => `${API}/subscriptions/${id}`}
          deleteUrl={(sub) => `${API}/users/${sub.user_id}/subscribe/${sub.master_id}`}
          perfUrl={(id) => `${API}/subscriptions/${id}/performance`}
          historyUrl={(id) => `${API}/subscriptions/${id}/history`}
          extraHeaders={adminHeaders()}
        />
      )}
    </div>
  );
}
