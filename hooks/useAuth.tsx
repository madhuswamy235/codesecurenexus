'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import api, { setToken, clearToken, getToken as readToken } from '@/lib/api';

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'recruiter' | 'interviewer' | 'candidate';
  mobile?: string;
  profileImage?: string;
  isActive?: boolean;
}

export function canCreateInterviewsForRole(role?: string | null): boolean {
  return ['admin', 'recruiter', 'interviewer'].includes(role?.trim().toLowerCase() ?? '');
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (payload: { name: string; email: string; password: string; mobile?: string }) => Promise<AuthUser>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = readToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get<AuthUser>('/auth/me');
      setUser(res.data as AuthUser);
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(refreshTimer);
  }, [refresh]);

  async function login(email: string, password: string) {
    const res = await api.post<{ token: string; user: AuthUser }>(
      '/auth/login',
      { email, password },
      false
    );
    const data = res.data!;
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function register(payload: { name: string; email: string; password: string; mobile?: string }) {
    const res = await api.post<{ token: string; user: AuthUser }>(
      '/auth/register',
      payload,
      false
    );
    const data = res.data!;
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, isAuthenticated: Boolean(user), login, register, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Role-based home path for post-login redirects. */
export function homeForRole(_role: string) {
  void _role;
  return '/dashboard';
}

export default useAuth;
