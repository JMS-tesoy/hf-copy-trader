'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { API, adminHeaders } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SearchInput } from '@/components/ui/SearchInput';
import { useToast } from '@/components/notifications/useToast';
import { Crown, Signal, Clock, Users, Copy, Check, RefreshCw, History, X } from 'lucide-react';

interface Master {
  id: number;
  name: string;
  api_key: string;
  status: string;
  created_at: string;
  signal_count: number;
  last_signal_at: string | null;
  subscriber_count: number;
}

interface TradeHistoryEntry {
  master_id: number;
  symbol: string;
  action: string;
  price: number;
  received_at: string;
}

export default function MasterPage() {
  const [masters, setMasters] = useState<Master[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [revealedKeys, setRevealedKeys] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  // Confirm delete dialog state
  const [confirmDelete, setConfirmDelete] = useState<{ masterId: number; masterName: string } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Copy feedback state
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Regenerate key state
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);

  // Trade history modal state
  const [tradeHistoryModal, setTradeHistoryModal] = useState<{ masterId: number; masterName: string } | null>(null);
  const [tradeHistory, setTradeHistory] = useState<TradeHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchMasters = useCallback(async () => {
    try {
      const res = await fetch(`${API}/masters`, { headers: adminHeaders() });
      const data = await res.json();
      setMasters(data);
    } catch {
      toast({ type: 'error', title: 'Failed to fetch masters' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchMasters(); }, [fetchMasters]);

  const createMaster = async () => {
    if (!newName.trim()) return;
    try {
      await fetch(`${API}/masters`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ name: newName.trim() }),
      });
      setNewName('');
      setShowAdd(false);
      fetchMasters();
      toast({ type: 'success', title: 'Master created successfully' });
    } catch {
      toast({ type: 'error', title: 'Failed to create master' });
    }
  };

  const updateMaster = async (id: number, data: { name?: string; status?: string }) => {
    try {
      await fetch(`${API}/masters/${id}`, {
        method: 'PUT',
        headers: adminHeaders(),
        body: JSON.stringify(data),
      });
      setEditId(null);
      fetchMasters();
    } catch {
      toast({ type: 'error', title: 'Failed to update master' });
    }
  };

  const deleteMaster = async () => {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.masterId);
    try {
      await fetch(`${API}/masters/${confirmDelete.masterId}`, {
        method: 'DELETE',
        headers: adminHeaders(),
      });
      fetchMasters();
      toast({ type: 'success', title: `"${confirmDelete.masterName}" deleted` });
      setConfirmDelete(null);
    } catch {
      toast({ type: 'error', title: 'Failed to delete master' });
    } finally {
      setDeletingId(null);
    }
  };

  const copyApiKey = async (id: number, key: string, name: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({ type: 'success', title: `API key copied for ${name}` });
    } catch {
      toast({ type: 'error', title: 'Failed to copy API key' });
    }
  };

  const regenerateApiKey = async (id: number, name: string) => {
    setRegeneratingId(id);
    try {
      const res = await fetch(`${API}/masters/${id}/regenerate-key`, {
        method: 'PUT',
        headers: adminHeaders(),
      });
      if (!res.ok) throw new Error();
      fetchMasters();
      toast({ type: 'success', title: `API key regenerated for ${name}` });
      setRevealedKeys((prev) => new Set([...prev, id]));
    } catch {
      toast({ type: 'error', title: 'Failed to regenerate API key' });
    } finally {
      setRegeneratingId(null);
    }
  };

  const fetchTradeHistory = async (masterId: number, masterName: string) => {
    setTradeHistoryModal({ masterId, masterName });
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API}/masters/${masterId}/trades?limit=100`, {
        headers: adminHeaders(),
      });
      const data = await res.json();
      setTradeHistory(data);
    } catch {
      toast({ type: 'error', title: 'Failed to load trade history' });
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleReveal = (id: number) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const maskKey = (key: string) => key.slice(0, 8) + '...' + key.slice(-4);

  const formatDate = (d: string | null) => {
    if (!d) return 'Never';
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const formatPrice = (p: number) => (p > 100 ? p.toFixed(2) : p.toFixed(4));

  const filtered = useMemo(() => {
    if (!search.trim()) return masters;
    return masters.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));
  }, [masters, search]);

  const activeCount = masters.filter((m) => m.status === 'active').length;
  const totalSignals = masters.reduce((sum, m) => sum + m.signal_count, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Master Traders</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {masters.length} masters &middot; {activeCount} active &middot; {totalSignals} total signals
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors"
        >
          {showAdd ? 'Cancel' : '+ Add Master'}
        </button>
      </div>

      {/* Add Master Form */}
      {showAdd && (
        <div className="p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 animate-fade-in-down">
          <div className="flex gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createMaster()}
              placeholder="Master trader name..."
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              autoFocus
            />
            <button
              onClick={createMaster}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors"
            >
              Create
            </button>
          </div>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
            A unique API key will be generated automatically
          </p>
        </div>
      )}

      {/* Search */}
      {masters.length > 0 && (
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search masters..."
        />
      )}

      {/* Masters Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : masters.length === 0 ? (
        <EmptyState icon={Crown} title="No masters yet" description="Add one to get started" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((m) => (
            <Card key={m.id} className="hover:shadow-lg transition-all duration-300 group">
              {/* Card Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center text-white font-bold text-sm">
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    {editId === m.id ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') updateMaster(m.id, { name: editName });
                          if (e.key === 'Escape') setEditId(null);
                        }}
                        onBlur={() => updateMaster(m.id, { name: editName })}
                        className="text-sm font-bold px-2 py-1 rounded-lg border border-emerald-500/30 bg-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        autoFocus
                      />
                    ) : (
                      <h3 className="text-sm font-bold">{m.name}</h3>
                    )}
                    <p className="text-[10px] text-gray-400 dark:text-slate-500">ID #{m.id}</p>
                  </div>
                </div>
                <Badge variant={m.status}>{m.status}</Badge>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-1 mb-1">
                    <Signal className="w-3 h-3 text-gray-400 dark:text-slate-500" />
                    <p className="text-[9px] uppercase tracking-wider text-gray-400 dark:text-slate-500">Signals</p>
                  </div>
                  <p className="text-base font-bold font-mono">{m.signal_count}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-1 mb-1">
                    <Users className="w-3 h-3 text-gray-400 dark:text-slate-500" />
                    <p className="text-[9px] uppercase tracking-wider text-gray-400 dark:text-slate-500">Followers</p>
                  </div>
                  <p className="text-base font-bold font-mono">{m.subscriber_count}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-1 mb-1">
                    <Clock className="w-3 h-3 text-gray-400 dark:text-slate-500" />
                    <p className="text-[9px] uppercase tracking-wider text-gray-400 dark:text-slate-500">Last Active</p>
                  </div>
                  <p className="text-[10px] font-medium mt-1">{formatDate(m.last_signal_at)}</p>
                </div>
              </div>

              {/* API Key */}
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500">API Key</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleReveal(m.id)}
                      className="text-[10px] text-emerald-500 hover:text-emerald-400 font-medium"
                    >
                      {revealedKeys.has(m.id) ? 'Hide' : 'Reveal'}
                    </button>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <p className="text-xs font-mono text-gray-600 dark:text-slate-300 break-all flex-1">
                    {revealedKeys.has(m.id) ? m.api_key : maskKey(m.api_key)}
                  </p>
                  {revealedKeys.has(m.id) && (
                    <button
                      onClick={() => copyApiKey(m.id, m.api_key, m.name)}
                      className="flex-shrink-0 p-1 rounded-md transition-colors hover:bg-gray-200 dark:hover:bg-slate-700"
                      title="Copy API key"
                    >
                      {copiedId === m.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 hover:text-emerald-500 transition-colors" />
                      )}
                    </button>
                  )}
                </div>
                {revealedKeys.has(m.id) && (
                  <button
                    onClick={() => regenerateApiKey(m.id, m.name)}
                    disabled={regeneratingId === m.id}
                    className="mt-2 w-full px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-[10px] font-medium transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {regeneratingId === m.id ? (
                      <>
                        <span className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3 h-3" />
                        Regenerate Key
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditId(m.id); setEditName(m.name); }}
                  className="flex-1 px-3 py-2 rounded-xl text-xs font-medium border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => fetchTradeHistory(m.id, m.name)}
                  className="flex-1 px-3 py-2 rounded-xl text-xs font-medium border border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors flex items-center justify-center gap-1"
                >
                  <History className="w-3 h-3" />
                  Trades
                </button>
                <button
                  onClick={() => updateMaster(m.id, { status: m.status === 'active' ? 'paused' : 'active' })}
                  className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    m.status === 'active'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                  }`}
                >
                  {m.status === 'active' ? 'Pause' : 'Resume'}
                </button>
                <button
                  onClick={() => setConfirmDelete({ masterId: m.id, masterName: m.name })}
                  disabled={deletingId === m.id}
                  className="px-3 py-2 rounded-xl text-xs font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {deletingId === m.id ? (
                    <span className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Confirm Delete Dialog */}
      {confirmDelete && (
        <ConfirmDialog
          open={true}
          onClose={() => setConfirmDelete(null)}
          onConfirm={deleteMaster}
          title="Delete Master?"
          message={`This will permanently delete "${confirmDelete.masterName}" and remove all subscriptions. This action cannot be undone.`}
          confirmText="Delete Master"
          variant="danger"
          loading={deletingId === confirmDelete.masterId}
        />
      )}

      {/* Trade History Modal */}
      {tradeHistoryModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in"
            onClick={() => setTradeHistoryModal(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 max-w-4xl w-full max-h-[80vh] overflow-hidden animate-scale-in">
              <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <History className="w-5 h-5 text-emerald-500" />
                  <h3 className="text-lg font-bold">Trade History: {tradeHistoryModal.masterName}</h3>
                </div>
                <button
                  onClick={() => setTradeHistoryModal(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-auto max-h-[60vh]">
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : tradeHistory.length === 0 ? (
                  <div className="text-center py-16 text-sm text-gray-400 dark:text-slate-500">
                    No trade history yet
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="sticky top-0 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800">
                      <tr className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-slate-500">
                        <th className="px-6 py-3 text-left">Time</th>
                        <th className="px-6 py-3 text-left">Symbol</th>
                        <th className="px-6 py-3 text-left">Action</th>
                        <th className="px-6 py-3 text-right">Price</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {tradeHistory.map((t, idx) => (
                        <tr key={idx} className="border-b border-gray-50 dark:border-slate-800/50 hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-3 text-xs font-mono text-gray-500 dark:text-slate-400">
                            {new Date(t.received_at).toLocaleString()}
                          </td>
                          <td className="px-6 py-3 font-mono font-semibold">{t.symbol}</td>
                          <td className="px-6 py-3">
                            <Badge variant={t.action.includes('BUY') ? 'buy' : t.action.includes('SELL') ? 'sell' : 'neutral'} size="sm">
                              {t.action}
                            </Badge>
                          </td>
                          <td className="px-6 py-3 text-right font-mono font-semibold">
                            {formatPrice(t.price)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
