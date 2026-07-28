'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase/client';
import { apiClient } from '../../lib/api/client';

export interface Membership {
  societyId: string;
  societyName: string;
  societySlug: string;
  role: string;
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  memberships: Membership[];
  activeSociety: Membership | null;
  switchSociety: (societyId: string) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const IS_DEV_AUTH = process.env.NEXT_PUBLIC_DEV_AUTH === 'true';

// ============================================
// DEV MODE AUTH PROVIDER
// ============================================
const DevAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeSociety, setActiveSociety] = useState<Membership | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshProfile = async () => {
    const token = localStorage.getItem('dev_token');
    if (!token) return;
    try {
      const response = await apiClient.get('/users/me');
      if (response.data?.success) {
        const newMemberships = response.data.data.memberships;
        setMemberships(newMemberships);
        
        // Update dev_session in localStorage
        const stored = localStorage.getItem('dev_session');
        if (stored) {
          try {
            const session = JSON.parse(stored);
            session.memberships = newMemberships;
            localStorage.setItem('dev_session', JSON.stringify(session));
          } catch(e){}
        }
      }
    } catch (e) {
      console.error('Failed to refresh dev profile:', e);
    }
  };

  useEffect(() => {
    // Restore dev session from localStorage
    const stored = localStorage.getItem('dev_session');
    if (stored) {
      try {
        const session = JSON.parse(stored);
        setUser(session.user as any);
        setMemberships(session.memberships);

        const savedId = localStorage.getItem('active_society_id');
        const resolved = session.memberships.find((m: Membership) => m.societyId === savedId) || session.memberships[0] || null;
        if (resolved) {
          localStorage.setItem('active_society_id', resolved.societyId);
          setActiveSociety(resolved);
        }
        
        // Async sync with backend on mount
        refreshProfile();
      } catch (e) {
        localStorage.removeItem('dev_session');
      }
    }
    setLoading(false);
  }, []);

  const switchSociety = (societyId: string) => {
    const selected = memberships.find((m) => m.societyId === societyId);
    if (selected) {
      localStorage.setItem('active_society_id', selected.societyId);
      setActiveSociety(selected);
      window.location.reload();
    }
  };

  const signOut = async () => {
    setLoading(true);
    localStorage.removeItem('dev_session');
    localStorage.removeItem('dev_token');
    localStorage.removeItem('active_society_id');
    setUser(null);
    setMemberships([]);
    setActiveSociety(null);
    setLoading(false);
  };
  // refreshProfile is moved above useEffect
  return (
    <AuthContext.Provider
      value={{
        user,
        session: null,
        loading,
        memberships,
        activeSociety,
        switchSociety,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// ============================================
// PRODUCTION AUTH PROVIDER (Supabase)
// ============================================
const SupabaseAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeSociety, setActiveSociety] = useState<Membership | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = async (currentUser: User) => {
    try {
      const response = await apiClient.get('/users/me');
      if (response.data?.success) {
        const list: Membership[] = response.data.data.memberships;
        setMemberships(list);

        // Resolve active society from localStorage, default to first membership
        const savedId = localStorage.getItem('active_society_id');
        const resolved = list.find((m) => m.societyId === savedId) || list[0] || null;
        
        if (resolved) {
          localStorage.setItem('active_society_id', resolved.societyId);
          setActiveSociety(resolved);
        } else {
          localStorage.removeItem('active_society_id');
          setActiveSociety(null);
        }
      }
    } catch (err) {
      console.error('Failed to sync profile memberships with backend:', err);
    }
  };

  useEffect(() => {
    // 1. Fetch initial session state
    supabase.auth.getSession().then(({ data: { session: activeSession } }) => {
      setSession(activeSession);
      setUser(activeSession?.user ?? null);
      if (activeSession?.user) {
        fetchProfile(activeSession.user).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // 2. Subscribe to auth state transitions
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      
      if (newSession?.user) {
        setLoading(true);
        await fetchProfile(newSession.user);
        setLoading(false);
      } else {
        setMemberships([]);
        setActiveSociety(null);
        localStorage.removeItem('active_society_id');
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const switchSociety = (societyId: string) => {
    const selected = memberships.find((m) => m.societyId === societyId);
    if (selected) {
      localStorage.setItem('active_society_id', selected.societyId);
      setActiveSociety(selected);
      // Hard refresh context to reload query scopes
      window.location.reload();
    }
  };

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    localStorage.removeItem('active_society_id');
    setSession(null);
    setUser(null);
    setMemberships([]);
    setActiveSociety(null);
    setLoading(false);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        memberships,
        activeSociety,
        switchSociety,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// ============================================
// EXPORTED PROVIDER (auto-selects dev vs prod)
// ============================================
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (IS_DEV_AUTH) {
    return <DevAuthProvider>{children}</DevAuthProvider>;
  }
  return <SupabaseAuthProvider>{children}</SupabaseAuthProvider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be utilized inside an AuthProvider scope.');
  }
  return context;
};
