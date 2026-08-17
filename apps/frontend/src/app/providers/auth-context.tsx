'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase/client';
import { apiClient } from '../../lib/api/client';

export interface Membership {
  societyId: string;
  societyName: string;
  societySlug: string;
  role: string;
  permissions: string[];
  subscriptionStatus?: 'ACTIVE' | 'EXPIRED' | 'NO_PLAN' | string;
  isExpired?: boolean;
  planName?: string | null;
  endDate?: string | null;
  daysLeft?: number | null;
  isDefault?: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  memberships: Membership[];
  activeSociety: Membership | null;
  defaultSocietyId: string | null;
  allSocietiesExpired: boolean;
  requiresDefaultSelection: boolean;
  switchSociety: (societyId: string) => boolean;
  setDefaultSociety: (societyId: string) => Promise<boolean>;
  dismissDefaultSelection: () => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const IS_DEV_AUTH = process.env.NEXT_PUBLIC_DEV_AUTH === 'true';

// ============================================
// SOCIETY SELECTION & RESOLUTION HELPER
// ============================================
function resolveSocieties(
  list: Membership[],
  userProfileDefaultId?: string | null
): {
  resolvedActive: Membership | null;
  resolvedDefaultId: string | null;
  isAllExpired: boolean;
  needsDefaultSelection: boolean;
} {
  if (!list || list.length === 0) {
    return {
      resolvedActive: null,
      resolvedDefaultId: null,
      isAllExpired: false,
      needsDefaultSelection: false,
    };
  }

  const activeList = list.filter((m) => !m.isExpired);
  const isAllExpired = list.length > 0 && activeList.length === 0;

  if (isAllExpired) {
    return {
      resolvedActive: list[0], // fallback reference even though expired
      resolvedDefaultId: null,
      isAllExpired: true,
      needsDefaultSelection: false,
    };
  }

  const storedDefaultId = typeof window !== 'undefined' 
    ? (localStorage.getItem('default_society_id') || userProfileDefaultId) 
    : userProfileDefaultId;

  const savedActiveId = typeof window !== 'undefined' ? localStorage.getItem('active_society_id') : null;

  // 1. Check if the saved active society is active
  const activeSaved = activeList.find((m) => m.societyId === savedActiveId);
  // 2. Check if the saved default society is active
  const activeDefault = activeList.find((m) => m.societyId === storedDefaultId);

  // If previous default/active was in the expired list, auto-switch to first ACTIVE society!
  let resolvedActive: Membership;
  let resolvedDefaultId: string | null = null;
  let needsDefaultSelection = false;

  if (activeDefault) {
    resolvedDefaultId = activeDefault.societyId;
    resolvedActive = activeSaved || activeDefault;
  } else if (activeSaved) {
    resolvedActive = activeSaved;
  } else {
    // No valid active saved default - switch to first active society
    resolvedActive = activeList[0];
  }

  // If user has multiple active societies and no default society has ever been explicitly confirmed
  if (
    activeList.length > 1 &&
    !storedDefaultId &&
    typeof window !== 'undefined' &&
    !sessionStorage.getItem('default_selection_dismissed')
  ) {
    needsDefaultSelection = true;
  } else if (activeList.length === 1 && !storedDefaultId) {
    resolvedDefaultId = activeList[0].societyId;
    if (typeof window !== 'undefined') {
      localStorage.setItem('default_society_id', activeList[0].societyId);
    }
  } else if (activeDefault) {
    resolvedDefaultId = activeDefault.societyId;
  }

  if (typeof window !== 'undefined' && resolvedActive) {
    localStorage.setItem('active_society_id', resolvedActive.societyId);
  }

  return {
    resolvedActive,
    resolvedDefaultId,
    isAllExpired: false,
    needsDefaultSelection,
  };
}

// ============================================
// DEV MODE AUTH PROVIDER
// ============================================
const DevAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeSociety, setActiveSociety] = useState<Membership | null>(null);
  const [defaultSocietyId, setDefaultSocietyId] = useState<string | null>(null);
  const [allSocietiesExpired, setAllSocietiesExpired] = useState<boolean>(false);
  const [requiresDefaultSelection, setRequiresDefaultSelection] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const applyMemberships = useCallback((newList: Membership[], userProfileDefault?: string | null) => {
    setMemberships(newList);
    const { resolvedActive, resolvedDefaultId, isAllExpired, needsDefaultSelection } = resolveSocieties(
      newList,
      userProfileDefault
    );

    setActiveSociety(resolvedActive);
    setDefaultSocietyId(resolvedDefaultId);
    setAllSocietiesExpired(isAllExpired);
    setRequiresDefaultSelection(needsDefaultSelection);
  }, []);

  const refreshProfile = async () => {
    const token = localStorage.getItem('dev_token');
    if (!token) return;
    try {
      const response = await apiClient.get('/users/me');
      if (response.data?.success) {
        const newMemberships: Membership[] = response.data.data.memberships;
        const profileUser = response.data.data.user;
        applyMemberships(newMemberships, profileUser?.defaultSocietyId);

        // Update dev_session in localStorage
        const stored = localStorage.getItem('dev_session');
        if (stored) {
          try {
            const session = JSON.parse(stored);
            session.memberships = newMemberships;
            if (profileUser) session.user = profileUser;
            localStorage.setItem('dev_session', JSON.stringify(session));
          } catch {}
        }
      }
    } catch (e) {
      console.error('Failed to refresh dev profile:', e);
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem('dev_session');
    if (stored) {
      try {
        const session = JSON.parse(stored);
        setUser(session.user as any);
        applyMemberships(session.memberships, session.user?.defaultSocietyId);
        refreshProfile();
      } catch {
        localStorage.removeItem('dev_session');
      }
    }
    setLoading(false);
  }, [applyMemberships]);

  const switchSociety = (societyId: string): boolean => {
    const selected = memberships.find((m) => m.societyId === societyId);
    if (!selected) return false;

    if (selected.isExpired) {
      alert(`Cannot switch to "${selected.societyName}". This society's subscription has expired. Please contact your society administration.`);
      return false;
    }

    localStorage.setItem('active_society_id', selected.societyId);
    setActiveSociety(selected);
    window.location.href = `/${selected.societySlug}/dashboard`;
    return true;
  };

  const setDefaultSociety = async (societyId: string): Promise<boolean> => {
    const selected = memberships.find((m) => m.societyId === societyId);
    if (!selected || selected.isExpired) return false;

    localStorage.setItem('default_society_id', societyId);
    localStorage.setItem('active_society_id', societyId);
    setDefaultSocietyId(societyId);
    setActiveSociety(selected);
    setRequiresDefaultSelection(false);

    try {
      await apiClient.patch('/users/me/default-society', { societyId });
    } catch {}

    window.location.href = `/${selected.societySlug}/dashboard`;
    return true;
  };

  const dismissDefaultSelection = () => {
    sessionStorage.setItem('default_selection_dismissed', 'true');
    setRequiresDefaultSelection(false);
  };

  const signOut = async () => {
    setLoading(true);
    localStorage.removeItem('dev_session');
    localStorage.removeItem('dev_token');
    localStorage.removeItem('active_society_id');
    localStorage.removeItem('default_society_id');
    sessionStorage.removeItem('default_selection_dismissed');
    setUser(null);
    setMemberships([]);
    setActiveSociety(null);
    setDefaultSocietyId(null);
    setLoading(false);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session: null,
        loading,
        memberships,
        activeSociety,
        defaultSocietyId,
        allSocietiesExpired,
        requiresDefaultSelection,
        switchSociety,
        setDefaultSociety,
        dismissDefaultSelection,
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
  const [defaultSocietyId, setDefaultSocietyId] = useState<string | null>(null);
  const [allSocietiesExpired, setAllSocietiesExpired] = useState<boolean>(false);
  const [requiresDefaultSelection, setRequiresDefaultSelection] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const applyMemberships = useCallback((newList: Membership[], userProfileDefault?: string | null) => {
    setMemberships(newList);
    const { resolvedActive, resolvedDefaultId, isAllExpired, needsDefaultSelection } = resolveSocieties(
      newList,
      userProfileDefault
    );

    setActiveSociety(resolvedActive);
    setDefaultSocietyId(resolvedDefaultId);
    setAllSocietiesExpired(isAllExpired);
    setRequiresDefaultSelection(needsDefaultSelection);
  }, []);

  const fetchProfile = async (currentUser: User) => {
    try {
      const response = await apiClient.get('/users/me');
      if (response.data?.success) {
        const list: Membership[] = response.data.data.memberships;
        const profileUser = response.data.data.user;
        applyMemberships(list, profileUser?.defaultSocietyId);
      }
    } catch (err) {
      console.error('Failed to sync profile memberships with backend:', err);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: activeSession } }) => {
      setSession(activeSession);
      setUser(activeSession?.user ?? null);
      if (activeSession?.user) {
        fetchProfile(activeSession.user).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

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
        setDefaultSocietyId(null);
        localStorage.removeItem('active_society_id');
        localStorage.removeItem('default_society_id');
        sessionStorage.removeItem('default_selection_dismissed');
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const switchSociety = (societyId: string): boolean => {
    const selected = memberships.find((m) => m.societyId === societyId);
    if (!selected) return false;

    if (selected.isExpired) {
      alert(`Cannot switch to "${selected.societyName}". This society's subscription has expired. Please contact your society administration.`);
      return false;
    }

    localStorage.setItem('active_society_id', selected.societyId);
    setActiveSociety(selected);
    window.location.href = `/${selected.societySlug}/dashboard`;
    return true;
  };

  const setDefaultSociety = async (societyId: string): Promise<boolean> => {
    const selected = memberships.find((m) => m.societyId === societyId);
    if (!selected || selected.isExpired) return false;

    localStorage.setItem('default_society_id', societyId);
    localStorage.setItem('active_society_id', societyId);
    setDefaultSocietyId(societyId);
    setActiveSociety(selected);
    setRequiresDefaultSelection(false);

    try {
      await apiClient.patch('/users/me/default-society', { societyId });
    } catch {}

    window.location.href = `/${selected.societySlug}/dashboard`;
    return true;
  };

  const dismissDefaultSelection = () => {
    sessionStorage.setItem('default_selection_dismissed', 'true');
    setRequiresDefaultSelection(false);
  };

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    localStorage.removeItem('active_society_id');
    localStorage.removeItem('default_society_id');
    sessionStorage.removeItem('default_selection_dismissed');
    setSession(null);
    setUser(null);
    setMemberships([]);
    setActiveSociety(null);
    setDefaultSocietyId(null);
    setLoading(false);
    window.location.href = '/login';
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
        defaultSocietyId,
        allSocietiesExpired,
        requiresDefaultSelection,
        switchSociety,
        setDefaultSociety,
        dismissDefaultSelection,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

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
