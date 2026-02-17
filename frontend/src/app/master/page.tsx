'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { API, adminHeaders } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/notifications/useToast';
import { Crown, Search, Signal, Clock } from 'lucide-react';

interface Master {
  id: number;
  name: string;
  api_key: string;
  status: string;
  created_at: string;
  signal_count: number;
  last_signal_at: string | null;
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

  const fetchMasters = useCallback(async () => {
    try {
      const res = await fetch(`${API}/masters`);
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

  const deleteMaster = async (id: number) => {
    if (!confirm('Delete this master? All subscriptions will be removed.')) return;
    try {
      await fetch(`${API}/masters/${id}`, {
        method: 'DELETE',
        headers: adminHeaders(),
      });
      fetchMasters();
      toast({ type: 'warning', title: 'Master deleted' });
    } catch {
      toast({ type: 'error', title: 'Failed to delete master' });
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
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search masters..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
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
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Signal className="w-3 h-3 text-gray-400 dark:text-slate-500" />
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500">Signals</p>
                  </div>
                  <p className="text-lg font-bold font-mono">{m.signal_count}</p>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Clock className="w-3 h-3 text-gray-400 dark:text-slate-500" />
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500">Last Active</p>
                  </div>
                  <p className="text-xs font-medium mt-1">{formatDate(m.last_signal_at)}</p>
                </div>
              </div>

              {/* API Key */}
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 mb-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500">API Key</p>
                  <button
                    onClick={() => toggleReveal(m.id)}
                    className="text-[10px] text-emerald-500 hover:text-emerald-400 font-medium"
                  >
                    {revealedKeys.has(m.id) ? 'Hide' : 'Reveal'}
                  </button>
                </div>
                <p className="text-xs font-mono mt-1 text-gray-600 dark:text-slate-300 break-all">
                  {revealedKeys.has(m.id) ? m.api_key : maskKey(m.api_key)}
                </p>
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
                  onClick={() => deleteMaster(m.id)}
                  className="px-3 py-2 rounded-xl text-xs font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                >
                  Delete
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
