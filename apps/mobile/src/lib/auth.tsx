import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setSession, setUnauthorizedHandler } from './api';
import { storage } from './storage';

export interface Membership {
  societyId: string;
  societyName: string;
  societySlug: string;
  role: string;
  isExpired?: boolean;
}
export interface User {
  id: string;
  email: string;
  name: string | null;
  mobile: string | null;
  avatarUrl: string | null;
}

interface AuthState {
  ready: boolean;
  user: User | null;
  memberships: Membership[];
  society: Membership | null;
  signIn: (email: string, password: string) => Promise<void>;
  /** Use a session the server already issued (invite activation). */
  adoptSession: (session: { token: string; user: User; memberships: Membership[] }) => Promise<void>;
  signOut: () => Promise<void>;
  switchSociety: (id: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);
const TOKEN = 'housive.token';
const SOCIETY = 'housive.society';

/** Strips the "(Owner)" style suffix the seed data puts on names. */
export const cleanName = (n?: string | null) => (n || '').replace(/\s*\(.*\)$/, '').trim();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [society, setSociety] = useState<Membership | null>(null);

  const reset = useCallback(async () => {
    setSession(null, null);
    setUser(null);
    setMemberships([]);
    setSociety(null);
    await storage.remove(TOKEN);
  }, []);

  const adopt = useCallback(async (token: string, me: { user: User; memberships: Membership[] }, preferred: string | null) => {
    const usable = me.memberships.filter((m) => !m.isExpired);
    const chosen = usable.find((m) => m.societyId === preferred) || usable[0] || null;
    if (!chosen) throw new Error('Your account is not linked to an active society yet. Please contact your society office.');
    setSession(token, chosen.societyId);
    setUser(me.user);
    setMemberships(usable);
    setSociety(chosen);
    await storage.set(TOKEN, token);
    await storage.set(SOCIETY, chosen.societyId);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      reset();
    });
    (async () => {
      try {
        const token = await storage.get(TOKEN);
        if (token) {
          setSession(token, null);
          const me = await api<{ user: User; memberships: Membership[] }>('/users/me');
          await adopt(token, me, await storage.get(SOCIETY));
        }
      } catch {
        await reset();
      } finally {
        setReady(true);
      }
    })();
  }, [adopt, reset]);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      user,
      memberships,
      society,
      signIn: async (email, password) => {
        setSession(null, null);
        const res = await api<{ token: string; user: User; memberships: Membership[] }>('/auth/login', { method: 'POST', body: { email: email.trim(), password } });
        await adopt(res.token, res, await storage.get(SOCIETY));
      },
      adoptSession: async (session) => {
        await adopt(session.token, session, await storage.get(SOCIETY));
      },
      signOut: reset,
      switchSociety: async (id) => {
        const m = memberships.find((x) => x.societyId === id);
        if (!m) return;
        const token = await storage.get(TOKEN);
        setSession(token, m.societyId);
        setSociety(m);
        await storage.set(SOCIETY, m.societyId);
      },
    }),
    [ready, user, memberships, society, adopt, reset],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
