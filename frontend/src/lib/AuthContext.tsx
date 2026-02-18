'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { API } from './api';

interface User {
  id: number;
  name: string;
  email: string;
  balance: number;
  created_at: string;
}

interface AuthState {
  user: User | null;
  role: 'user' | 'admin' | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<'admin' | 'user'>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, role: null, loading: true });

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch(`${API}/auth/me`, { credentials: 'include' });
      if (!res.ok) { setState({ user: null, role: null, loading: false }); return; }
      const { role } = await res.json();
      if (role === 'admin') {
        setState({ user: null, role: 'admin', loading: false });
      } else {
        const userRes = await fetch(`${API}/me`, { credentials: 'include' });
        const user = userRes.ok ? await userRes.json() : null;
        setState({ user, role: 'user', loading: false });
      }
    } catch {
      setState({ user: null, role: null, loading: false });
    }
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  // Unified login — backend auto-detects admin vs trader
  // Returns 'admin' or 'user' so the caller can redirect accordingly
  const login = async (email: string, password: string): Promise<'admin' | 'user'> => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
    const data = await res.json();
    if (data.role === 'admin') {
      setState({ user: null, role: 'admin', loading: false });
    } else {
      setState({ user: data.user, role: 'user', loading: false });
    }
    return data.role;
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
    const { user } = await res.json();
    setState({ user, role: 'user', loading: false });
  };

  const logout = async () => {
    await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' });
    setState({ user: null, role: null, loading: false });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
