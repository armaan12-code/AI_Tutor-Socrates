import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthOpen: boolean;
  openAuth: () => void;
  closeAuth: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong.');
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('socrates_token'));
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Verify token on mount
  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    apiFetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(u => setUser(u))
      .catch(() => {
        setToken(null);
        localStorage.removeItem('socrates_token');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const openAuth = useCallback(() => setIsAuthOpen(true), []);
  const closeAuth = useCallback(() => setIsAuthOpen(false), []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('socrates_token', data.token);
    setToken(data.token);
    setUser(data.user);
    setIsAuthOpen(false);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const data = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    localStorage.setItem('socrates_token', data.token);
    setToken(data.token);
    setUser(data.user);
    setIsAuthOpen(false);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('socrates_token');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isAuthOpen, openAuth, closeAuth, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
