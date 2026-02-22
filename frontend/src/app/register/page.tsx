'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { TrendingUp, Users, BarChart2, Zap, Eye, EyeOff, ShieldCheck, Mail } from 'lucide-react';

type Role = 'user' | 'master';

const CONTENT = {
  user: {
    tagline: <>Start copying.<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Start growing.</span></>,
    desc: 'Join thousands of copy traders automatically mirroring positions from top master traders — in real time, across any broker.',
    features: [
      { icon: TrendingUp, label: 'Follow top traders', desc: 'Subscribe to master traders and copy every move' },
      { icon: Users, label: 'Multi-broker support', desc: 'Works with ICMarkets, Deriv, and more' },
      { icon: BarChart2, label: 'Track performance', desc: 'Full trade history and P&L at a glance' },
    ],
    heading: 'Create Account',
    sub: 'Join the platform and start copy trading',
    btn: 'Create Account',
    btnLoading: 'Creating account…',
  },
  master: {
    tagline: <>Become a master.<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Lead the market.</span></>,
    desc: 'Register as a master trader and let thousands of copy traders automatically follow your positions in real time, across any broker.',
    features: [
      { icon: Users, label: 'Build your following', desc: 'Traders subscribe to copy your every move automatically' },
      { icon: TrendingUp, label: 'Showcase your edge', desc: 'Your full trade history and stats, all in one place' },
      { icon: Zap, label: 'Instant broadcast', desc: 'Signals delivered in milliseconds via WebSocket' },
    ],
    heading: 'Create Account',
    sub: 'Register as a master trader to start broadcasting signals',
    btn: 'Create Account',
    btnLoading: 'Creating account…',
  },
};

export default function RegisterPage() {
  const { register, registerMaster } = useAuth();
  const router = useRouter();
  const [role, setRole] = useState<Role>('user');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeRisk, setAgreeRisk] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const c = CONTENT[role];

  const passwordComplexity = useMemo(() => {
    if (!password) return null;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    const isLongEnough = password.length >= 8;

    const score = [hasUpper, hasLower, hasNumber, hasSpecial, isLongEnough].filter(Boolean).length;
    
    if (score < 3) return { label: 'Weak', color: 'text-red-400', width: 'w-1/3', bg: 'bg-red-500' };
    if (score < 5) return { label: 'Medium', color: 'text-yellow-400', width: 'w-2/3', bg: 'bg-yellow-500' };
    return { label: 'Strong', color: 'text-emerald-400', width: 'w-full', bg: 'bg-emerald-500' };
  }, [password]);

  const isEmailValid = useMemo(() => {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }, [email]);

  const canSubmit = useMemo(() => {
    return name.length > 0 && 
           email.length > 0 && 
           isEmailValid &&
           password.length >= 8 && 
           agreeTerms && 
           agreeRisk && 
           !loading;
  }, [name, email, isEmailValid, password, agreeTerms, agreeRisk, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    
    setError('');
    setLoading(true);
    try {
      if (role === 'master') {
        await registerMaster(name, email, password);
        router.push('/master-portal');
      } else {
        await register(name, email, password);
        router.push('/portal');
      }
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

        <div key={role} className="animate-fade-in">
          <h1 className="text-4xl font-bold text-white leading-snug mb-4">{c.tagline}</h1>
          <p className="text-slate-400 text-base leading-relaxed mb-10">{c.desc}</p>

          <div className="space-y-4">
            {c.features.map(({ icon: Icon, label, desc }, idx) => (
              <div 
                key={label} 
                className="flex items-start gap-3 animate-fade-in-down"
                style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}
              >
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
          <div key={role} className="mb-6 animate-fade-in">
            <h2 className="text-2xl font-bold text-white">{c.heading}</h2>
            <p className="text-slate-400 text-sm mt-1">{c.sub}</p>
          </div>

          {/* Role toggle */}
          <div className="flex rounded-xl bg-slate-800/60 border border-slate-700 p-1 mb-6">
            {(['user', 'master'] as Role[]).map(r => (
              <button
                key={r}
                type="button"
                onClick={() => { setRole(r); setError(''); }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  role === r
                    ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {r === 'user' ? 'Copy Trader' : 'Master Trader'}
              </button>
            ))}
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
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={`w-full bg-slate-800/60 border ${!isEmailValid ? 'border-red-500' : 'border-slate-700'} rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors`}
                  placeholder="you@example.com"
                  required
                />
                {!isEmailValid && (
                  <p className="text-red-400 text-xs mt-1 absolute -bottom-5">Please enter a valid email address</p>
                )}
              </div>
            </div>

            <div className="pt-1">
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 pr-11 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                  placeholder="Min. 8 characters"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              
              {passwordComplexity && (
                <div className="mt-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Security Strength</span>
                    <span className={`text-[10px] font-bold ${passwordComplexity.color}`}>{passwordComplexity.label}</span>
                  </div>
                  <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${passwordComplexity.bg} ${passwordComplexity.width} transition-all duration-500`} />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center mt-0.5">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={e => setAgreeTerms(e.target.checked)}
                    className="peer appearance-none w-4 h-4 rounded border border-slate-700 bg-slate-800/60 checked:bg-emerald-500 checked:border-emerald-500 transition-all cursor-pointer"
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <span className="text-xs text-slate-400 leading-tight group-hover:text-slate-300 transition-colors">
                  I agree to the <Link href="/terms" className="text-emerald-400 hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-emerald-400 hover:underline">Privacy Policy</Link>.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center mt-0.5">
                  <input
                    type="checkbox"
                    checked={agreeRisk}
                    onChange={e => setAgreeRisk(e.target.checked)}
                    className="peer appearance-none w-4 h-4 rounded border border-slate-700 bg-slate-800/60 checked:bg-emerald-500 checked:border-emerald-500 transition-all cursor-pointer"
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <span className="text-xs text-slate-400 leading-tight group-hover:text-slate-300 transition-colors">
                  I acknowledge and accept the <Link href="/risk" className="text-emerald-400 hover:underline">Risk Disclaimer</Link>. Trading involves significant risk of loss.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed text-white font-semibold rounded-xl py-2.5 text-sm transition-all shadow-lg shadow-emerald-500/20 mt-4"
            >
              {loading ? c.btnLoading : c.btn}
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-950 px-2 text-slate-500">Or continue with</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className="flex items-center justify-center gap-2 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl py-2 text-xs font-medium text-slate-300 transition-all"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-2 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl py-2 text-xs font-medium text-slate-300 transition-all"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Passkey
              </button>
            </div>
          </form>

          <p className="text-center text-slate-500 text-sm mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
          <p className="text-center text-slate-600 text-xs mt-3">
            Want to compare plans first?{' '}
            <Link href="/landing" className="text-slate-400 hover:text-slate-300 transition-colors">
              View pricing & top masters
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
