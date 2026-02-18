'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { TrendingUp, Users, Zap } from 'lucide-react';

export default function MasterRegisterPage() {
  const { registerMaster } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await registerMaster(name, email, password);
      router.push('/master-portal');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Left — branding panel */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-r border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <span className="text-white text-sm font-black">HF</span>
          </div>
          <span className="text-white font-bold text-lg tracking-tight">HF Copy Trader</span>
        </div>

        <div>
          <h1 className="text-4xl font-bold text-white leading-snug mb-4">
            Become a master.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              Lead the market.
            </span>
          </h1>
          <p className="text-slate-400 text-base leading-relaxed mb-10">
            Register as a master trader and let thousands of copy traders automatically follow your positions in real time, across any broker.
          </p>

          <div className="space-y-4">
            {[
              { icon: Users, label: 'Build your following', desc: 'Traders subscribe to copy your every move automatically' },
              { icon: TrendingUp, label: 'Showcase your edge', desc: 'Your full trade history and stats, all in one place' },
              { icon: Zap, label: 'Instant broadcast', desc: 'Signals delivered in milliseconds via WebSocket' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <div className="text-white text-sm font-medium">{label}</div>
                  <div className="text-slate-500 text-xs mt-0.5">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-slate-600 text-xs">© 2026 HF Copy Trader. All rights reserved.</p>
      </div>

      {/* Right — register form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="flex items-center gap-2 mb-10 lg:hidden">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
            <span className="text-white text-xs font-black">HF</span>
          </div>
          <span className="text-white font-bold">HF Copy Trader</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white">Create master account</h2>
            <p className="text-slate-400 text-sm mt-1">Register as a master trader to start broadcasting signals</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Full name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                placeholder="John Smith"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                placeholder="Min. 6 characters"
                minLength={6}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50 text-white font-semibold rounded-xl py-2.5 text-sm transition-all shadow-lg shadow-emerald-500/20 mt-2"
            >
              {loading ? 'Creating account…' : 'Create master account'}
            </button>
          </form>

          <p className="text-center text-slate-500 text-sm mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
          <p className="text-center text-slate-600 text-xs mt-3">
            Want to copy trade instead?{' '}
            <Link href="/register" className="text-slate-500 hover:text-slate-400 transition-colors">
              Register as a trader
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
