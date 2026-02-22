'use client';

import { useState } from 'react';
import { Users, Zap, TrendingUp, CheckCircle2 } from 'lucide-react';

export interface LeaderboardMaster {
  id: number;
  name: string;
  status: string;
  bio: string | null;
  subscriber_count: number;
  signal_count: number;
  avg_win_rate: number;
  last_signal_at: string | null;
  created_at: string;
}

interface MasterCardProps {
  master: LeaderboardMaster;
  isSubscribed: boolean;
  onSubscribe: (masterId: number, lotMultiplier: number) => Promise<void>;
}

function WinRateBadge({ rate }: { rate: number }) {
  const color = rate >= 60
    ? 'text-emerald-400 bg-emerald-500/10 ring-emerald-500/20'
    : rate >= 40
    ? 'text-amber-400 bg-amber-500/10 ring-amber-500/20'
    : 'text-red-400 bg-red-500/10 ring-red-500/20';
  if (!rate) return <span className="text-slate-500 text-sm font-medium">—</span>;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ring-1 ${color}`}>
      {rate}%
    </span>
  );
}

export function MasterCard({ master, isSubscribed, onSubscribe }: MasterCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [lot, setLot] = useState('1');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onSubscribe(master.id, parseFloat(lot) || 1);
      setExpanded(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col gap-3 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${master.status === 'active' ? 'bg-emerald-500' : 'bg-slate-600'}`} />
            <h3 className="font-semibold text-white truncate">{master.name}</h3>
          </div>
          <p className="text-xs italic text-slate-500 mt-1 line-clamp-2">
            {master.bio || 'No bio provided.'}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-slate-800/60 rounded-lg px-2 py-2">
          <div className="flex items-center justify-center mb-1">
            <TrendingUp className="w-3 h-3 text-slate-500" />
          </div>
          <WinRateBadge rate={master.avg_win_rate} />
          <p className="text-[9px] uppercase tracking-wider text-slate-600 mt-1">Win Rate</p>
        </div>
        <div className="bg-slate-800/60 rounded-lg px-2 py-2">
          <div className="flex items-center justify-center mb-1">
            <Users className="w-3 h-3 text-slate-500" />
          </div>
          <p className="text-sm font-bold text-white">{master.subscriber_count}</p>
          <p className="text-[9px] uppercase tracking-wider text-slate-600 mt-1">Followers</p>
        </div>
        <div className="bg-slate-800/60 rounded-lg px-2 py-2">
          <div className="flex items-center justify-center mb-1">
            <Zap className="w-3 h-3 text-slate-500" />
          </div>
          <p className="text-sm font-bold text-white">{master.signal_count}</p>
          <p className="text-[9px] uppercase tracking-wider text-slate-600 mt-1">Signals</p>
        </div>
      </div>

      {/* Subscribe section */}
      {isSubscribed ? (
        <button disabled className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm font-medium cursor-default">
          <CheckCircle2 className="w-4 h-4" />
          Subscribed
        </button>
      ) : !expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="w-full px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          Subscribe
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 shrink-0">Lot ×</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={lot}
              onChange={e => setLot(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500 min-w-0"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setExpanded(false)}
              className="flex-1 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 text-xs font-medium hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium transition-colors"
            >
              {loading ? 'Subscribing…' : 'Confirm'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
