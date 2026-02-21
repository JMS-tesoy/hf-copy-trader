'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ChevronDown, ChevronUp, Plus, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/notifications/useToast';

export interface SubscriptionFull {
  id: number;
  user_id: number;
  master_id: number;
  master_name: string;
  master_status: string;
  lot_multiplier: number;
  status: string;
  paused_reason: string | null;
  daily_loss_limit: number | null;
  max_drawdown_percent: number | null;
  max_position_size: number | null;
  max_concurrent_positions: number | null;
  max_positions_per_day: number | null;
  allowed_symbols: string[] | null;
  blocked_symbols: string[] | null;
  subscription_tier: string;
  commission_percent: number;
  total_profit: number;
  total_trades: number;
  win_rate: number | null;
  roi_percent: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  paused_at: string | null;
  cancelled_at: string | null;
}

interface SubscriptionTier {
  name: string;
  max_concurrent_positions: number | null;
  commission_percent: number;
  features: string[];
  monthly_fee: number;
}

interface Performance {
  total_profit: number;
  total_trades: number;
  win_rate: number | null;
  roi_percent: number | null;
  peak_profit: number;
  open_positions: number;
}

interface ChangeEntry {
  id: number;
  change_type: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
  changed_by_name: string | null;
}

interface Props {
  subscription: SubscriptionFull | null;
  onClose: () => void;
  onSaved: () => void;
  onUnsubscribed: () => void;
  saveUrl: (id: number) => string;
  deleteUrl: (sub: SubscriptionFull) => string;
  perfUrl: (id: number) => string;
  historyUrl: (id: number) => string;
  extraHeaders?: Record<string, string>;  // e.g. admin API key headers
}

function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState('');

  const add = () => {
    const val = input.trim().toUpperCase();
    if (val && !tags.includes(val)) onChange([...tags, val]);
    setInput('');
  };

  return (
    <div className="flex flex-wrap gap-1.5 p-2 bg-slate-900 border border-slate-700 rounded-lg min-h-[40px]">
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-700 text-slate-200 text-xs rounded-full"
        >
          {t}
          <button
            type="button"
            onClick={() => onChange(tags.filter((x) => x !== t))}
            className="text-slate-400 hover:text-red-400"
          >
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
          if (e.key === 'Backspace' && !input && tags.length) onChange(tags.slice(0, -1));
        }}
        onBlur={add}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[80px] bg-transparent text-white text-xs outline-none placeholder-slate-500"
      />
    </div>
  );
}

function Section({
  title,
  collapsible = false,
  children,
}: {
  title: string;
  collapsible?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-slate-700/60 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => collapsible && setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-4 py-2.5 bg-slate-800/60 text-sm font-semibold text-slate-300 ${collapsible ? 'cursor-pointer hover:bg-slate-800' : 'cursor-default'}`}
      >
        {title}
        {collapsible && (open ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
      </button>
      {open && <div className="px-4 py-3 space-y-3">{children}</div>}
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-44 shrink-0 text-xs text-slate-400">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

const numInput = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-cyan-500';

export function SubscriptionSettingsPanel({
  subscription,
  onClose,
  onSaved,
  onUnsubscribed,
  saveUrl,
  deleteUrl,
  perfUrl,
  historyUrl,
  extraHeaders,
}: Props) {
  const { toast } = useToast();

  // Form state
  const [lotMultiplier, setLotMultiplier] = useState('1');
  const [tier, setTier] = useState('standard');
  const [dailyLossLimit, setDailyLossLimit] = useState('');
  const [maxDrawdown, setMaxDrawdown] = useState('');
  const [maxPositionsPerDay, setMaxPositionsPerDay] = useState('');
  const [maxConcurrent, setMaxConcurrent] = useState('');
  const [maxPositionSize, setMaxPositionSize] = useState('');
  const [allowedSymbols, setAllowedSymbols] = useState<string[]>([]);
  const [blockedSymbols, setBlockedSymbols] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [pausedReason, setPausedReason] = useState('');

  // UI state
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [perf, setPerf] = useState<Performance | null>(null);
  const [history, setHistory] = useState<ChangeEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const baseHeaders = useCallback((): Record<string, string> => ({
    ...extraHeaders,
  }), [extraHeaders]);

  const apiFetch = useCallback((url: string, init?: RequestInit) =>
    fetch(url, { credentials: 'include', ...init, headers: { ...baseHeaders(), ...(init?.headers as Record<string, string> | undefined) } }),
  [baseHeaders]);

  // Populate form when subscription changes
  useEffect(() => {
    if (!subscription) return;
    setLotMultiplier(String(subscription.lot_multiplier));
    setTier(subscription.subscription_tier || 'standard');
    setDailyLossLimit(subscription.daily_loss_limit != null ? String(subscription.daily_loss_limit) : '');
    setMaxDrawdown(subscription.max_drawdown_percent != null ? String(subscription.max_drawdown_percent) : '');
    setMaxPositionsPerDay(subscription.max_positions_per_day != null ? String(subscription.max_positions_per_day) : '');
    setMaxConcurrent(subscription.max_concurrent_positions != null ? String(subscription.max_concurrent_positions) : '');
    setMaxPositionSize(subscription.max_position_size != null ? String(subscription.max_position_size) : '');
    setAllowedSymbols(subscription.allowed_symbols ?? []);
    setBlockedSymbols(subscription.blocked_symbols ?? []);
    setNotes(subscription.notes ?? '');
    setPausedReason(subscription.paused_reason ?? '');
    setPerf(null);
    setShowHistory(false);
  }, [subscription]);

  // Load tiers + performance on mount
  useEffect(() => {
    if (!subscription) return;
    apiFetch('/api/subscription-tiers')
      .then((r) => r.json())
      .then(setTiers)
      .catch(() => {});
    apiFetch(perfUrl(subscription.id))
      .then((r) => r.json())
      .then(setPerf)
      .catch(() => {});
  }, [subscription, apiFetch, perfUrl]);

  const loadHistory = useCallback(async () => {
    if (!subscription) return;
    try {
      const r = await apiFetch(historyUrl(subscription.id));
      const data = await r.json();
      setHistory(data);
      setShowHistory(true);
    } catch {
      toast({ type: 'error', title: 'Failed to load history' });
    }
  }, [subscription, apiFetch, historyUrl, toast]);

  const handleSave = async () => {
    if (!subscription) return;
    const lm = parseFloat(lotMultiplier);
    if (!Number.isFinite(lm) || lm <= 0) {
      toast({ type: 'error', title: 'Lot multiplier must be a positive number' });
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        lot_multiplier: lm,
        subscription_tier: tier,
        daily_loss_limit: dailyLossLimit ? Number(dailyLossLimit) : null,
        max_drawdown_percent: maxDrawdown ? Number(maxDrawdown) : null,
        max_positions_per_day: maxPositionsPerDay ? parseInt(maxPositionsPerDay) : null,
        max_concurrent_positions: maxConcurrent ? parseInt(maxConcurrent) : null,
        max_position_size: maxPositionSize ? Number(maxPositionSize) : null,
        allowed_symbols: allowedSymbols.length ? allowedSymbols : null,
        blocked_symbols: blockedSymbols.length ? blockedSymbols : null,
        notes: notes || null,
      };
      if (pausedReason !== subscription.paused_reason) body.paused_reason = pausedReason;

      const r = await apiFetch(saveUrl(subscription.id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json();
        toast({ type: 'error', title: err.error || 'Save failed' });
        return;
      }
      toast({ type: 'success', title: 'Subscription updated' });
      onSaved();
    } catch {
      toast({ type: 'error', title: 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!subscription) return;
    const newStatus = subscription.status === 'active' ? 'paused' : 'active';
    setSaving(true);
    try {
      const r = await apiFetch(saveUrl(subscription.id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!r.ok) throw new Error();
      toast({ type: 'success', title: `Subscription ${newStatus}` });
      onSaved();
    } catch {
      toast({ type: 'error', title: 'Status update failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!subscription) return;
    setDeleting(true);
    try {
      const r = await apiFetch(deleteUrl(subscription), { method: 'DELETE' });
      if (!r.ok) throw new Error();
      toast({ type: 'success', title: 'Unsubscribed' });
      onUnsubscribed();
      onClose();
    } catch {
      toast({ type: 'error', title: 'Unsubscribe failed' });
    } finally {
      setDeleting(false);
    }
  };

  if (!subscription) return null;

  const statusVariant =
    subscription.status === 'active' ? 'active' :
    subscription.status === 'paused' ? 'paused' :
    subscription.status === 'suspended' ? 'danger' : 'neutral';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-slate-900 border-l border-slate-700 shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Subscription to</p>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">{subscription.master_name}</h2>
              <Badge variant={statusVariant}>{subscription.status}</Badge>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Status control */}
          <Section title="Status">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">
                  {subscription.status === 'active' ? 'Copying trades from this master' : 'Not copying trades'}
                </p>
                {subscription.paused_at && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Paused {new Date(subscription.paused_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              <button
                onClick={handleToggleStatus}
                disabled={saving || ['cancelled', 'suspended'].includes(subscription.status)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                  subscription.status === 'active'
                    ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                }`}
              >
                {subscription.status === 'active' ? 'Pause' : 'Resume'}
              </button>
            </div>
            <button
              onClick={showHistory ? () => setShowHistory(false) : loadHistory}
              className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300"
            >
              <Clock size={12} />
              {showHistory ? 'Hide history' : 'View change history'}
            </button>
            {showHistory && (
              <div className="mt-2 max-h-48 overflow-y-auto space-y-1.5">
                {history.length === 0 ? (
                  <p className="text-xs text-slate-500">No history yet</p>
                ) : (
                  history.map((h) => (
                    <div key={h.id} className="text-xs bg-slate-800 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-slate-300 font-medium">{h.change_type.replace(/_/g, ' ')}</span>
                        <span className="text-slate-500">{new Date(h.created_at).toLocaleDateString()}</span>
                      </div>
                      {h.reason && <p className="text-slate-400">{h.reason}</p>}
                      {h.changed_by_name && <p className="text-slate-500">by {h.changed_by_name}</p>}
                    </div>
                  ))
                )}
              </div>
            )}
          </Section>

          {/* Trade Settings */}
          <Section title="Trade Settings">
            <FieldRow label="Lot Multiplier">
              <input
                type="number"
                value={lotMultiplier}
                onChange={(e) => setLotMultiplier(e.target.value)}
                min="0.01"
                step="0.01"
                className={numInput}
              />
            </FieldRow>
            <FieldRow label="Subscription Tier">
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                className={numInput}
              >
                {tiers.length === 0 && <option value="standard">Standard</option>}
                {tiers.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name.charAt(0).toUpperCase() + t.name.slice(1)}
                    {t.monthly_fee > 0 ? ` — $${t.monthly_fee}/mo` : ''}
                  </option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label="Notes">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes..."
                className={numInput}
              />
            </FieldRow>
          </Section>

          {/* Risk Management */}
          <Section title="Risk Management" collapsible>
            <FieldRow label="Max Daily Loss">
              <div className="flex items-center gap-2">
                <input type="number" value={dailyLossLimit} onChange={(e) => setDailyLossLimit(e.target.value)} min="0" step="1" placeholder="No limit" className={numInput} />
                <span className="text-xs text-slate-400 shrink-0">pips</span>
              </div>
            </FieldRow>
            <FieldRow label="Max Drawdown">
              <div className="flex items-center gap-2">
                <input type="number" value={maxDrawdown} onChange={(e) => setMaxDrawdown(e.target.value)} min="0" max="100" step="0.5" placeholder="No limit" className={numInput} />
                <span className="text-xs text-slate-400 shrink-0">%</span>
              </div>
            </FieldRow>
            <FieldRow label="Max Positions/Day">
              <input type="number" value={maxPositionsPerDay} onChange={(e) => setMaxPositionsPerDay(e.target.value)} min="1" step="1" placeholder="No limit" className={numInput} />
            </FieldRow>
            <FieldRow label="Max Concurrent">
              <input type="number" value={maxConcurrent} onChange={(e) => setMaxConcurrent(e.target.value)} min="1" step="1" placeholder="No limit" className={numInput} />
            </FieldRow>
            <FieldRow label="Max Position Size">
              <div className="flex items-center gap-2">
                <input type="number" value={maxPositionSize} onChange={(e) => setMaxPositionSize(e.target.value)} min="0" step="0.01" placeholder="No limit" className={numInput} />
                <span className="text-xs text-slate-400 shrink-0">lots</span>
              </div>
            </FieldRow>
            {subscription.status === 'paused' && (
              <FieldRow label="Pause Reason">
                <input type="text" value={pausedReason} onChange={(e) => setPausedReason(e.target.value)} placeholder="Why paused?" className={numInput} />
              </FieldRow>
            )}
          </Section>

          {/* Symbol Control */}
          <Section title="Symbol Control" collapsible>
            <div>
              <p className="text-xs text-slate-400 mb-1.5">
                Allowed Symbols <span className="text-slate-500">(empty = all)</span>
              </p>
              <TagInput
                tags={allowedSymbols}
                onChange={setAllowedSymbols}
                placeholder="Type symbol + Enter (e.g. EURUSD)"
              />
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1.5">Blocked Symbols</p>
              <TagInput
                tags={blockedSymbols}
                onChange={setBlockedSymbols}
                placeholder="Type symbol + Enter to block"
              />
            </div>
          </Section>

          {/* Performance */}
          <Section title="Performance">
            {perf ? (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total Trades', value: perf.total_trades },
                  { label: 'Win Rate', value: perf.win_rate != null ? `${perf.win_rate.toFixed(1)}%` : '—' },
                  { label: 'Total Profit', value: perf.total_profit != null ? `${perf.total_profit > 0 ? '+' : ''}${perf.total_profit.toFixed(1)}` : '—' },
                  { label: 'Peak Profit', value: perf.peak_profit != null ? perf.peak_profit.toFixed(1) : '—' },
                  { label: 'Open Positions', value: perf.open_positions },
                  { label: 'ROI', value: perf.roi_percent != null ? `${perf.roi_percent.toFixed(2)}%` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-800 rounded-lg p-2.5 text-center">
                    <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                    <p className="text-sm font-bold text-white">{value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Loading performance data...</p>
            )}
            <p className="text-xs text-slate-500 mt-1">Profit shown in pips (price difference × lot size)</p>
          </Section>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-4 border-t border-slate-700 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-semibold rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUnsubscribe}
            disabled={deleting}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            {deleting ? '...' : 'Unsubscribe'}
          </button>
        </div>
      </div>
    </>
  );
}
