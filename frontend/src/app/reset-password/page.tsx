'use client';

import { useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { API, jsonHeaders } from '@/lib/api';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Complexity logic from register page
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

  const passwordsMatch = password === confirmPassword && confirmPassword !== '';
  const canSubmit = password.length >= 8 && passwordsMatch && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ token, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reset password');
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Password reset complete</h2>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            Your password has been successfully updated. You can now sign in with your new password.
          </p>
          <Link 
            href="/login" 
            className="w-full inline-flex items-center justify-center bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-semibold rounded-xl py-2.5 text-sm transition-all shadow-lg shadow-emerald-500/20"
          >
            Sign in to your account
          </Link>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-6 text-center">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-white mb-4">Invalid or expired link</h2>
          <p className="text-slate-400 mb-8">This password reset link is invalid or has expired. Please request a new one.</p>
          <Link href="/forgot-password" className="text-emerald-400 hover:underline">Request new link</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400/10 to-cyan-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Create New Password</h1>
          <p className="text-slate-400 text-sm">Please enter a new, strong password for your account.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 text-center">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">New Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 pr-11 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                placeholder="Min. 8 characters"
                required
                autoFocus
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
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Strength</span>
                  <span className={`text-[10px] font-bold ${passwordComplexity.color}`}>{passwordComplexity.label}</span>
                </div>
                <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full ${passwordComplexity.bg} ${passwordComplexity.width} transition-all duration-500`} />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className={`w-full bg-slate-800/60 border ${confirmPassword && !passwordsMatch ? 'border-red-500' : 'border-slate-700'} rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors`}
              placeholder="Confirm new password"
              required
            />
            {confirmPassword && !passwordsMatch && (
              <p className="text-red-400 text-[10px] mt-1">Passwords do not match</p>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50 text-white font-semibold rounded-xl py-2.5 text-sm transition-all shadow-lg shadow-emerald-500/20 mt-2"
          >
            {loading ? 'Updating password...' : 'Reset password'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-500"></div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
