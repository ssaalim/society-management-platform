'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiClient } from '../../lib/api/client';

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  mobile?: string | null;
  avatarUrl?: string | null;
  defaultSocietyId?: string | null;
  role?: string | null;
  user_metadata?: any;
}

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
  user: AuthUser | null;
  session: any | null;
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
      resolvedActive: list[0],
      resolvedDefaultId: null,
      isAllExpired: true,
      needsDefaultSelection: false,
    };
  }

  const storedDefaultId = typeof window !== 'undefined' 
    ? (localStorage.getItem('default_society_id') || userProfileDefaultId) 
    : userProfileDefaultId;

  const savedActiveId = typeof window !== 'undefined' ? localStorage.getItem('active_society_id') : null;

  const activeSaved = activeList.find((m) => m.societyId === savedActiveId);
  const activeDefault = activeList.find((m) => m.societyId === storedDefaultId);

  let resolvedActive: Membership;
  let resolvedDefaultId: string | null = null;
  let needsDefaultSelection = false;

  if (activeDefault) {
    resolvedDefaultId = activeDefault.societyId;
    resolvedActive = activeSaved || activeDefault;
  } else if (activeSaved) {
    resolvedActive = activeSaved;
  } else {
    resolvedActive = activeList[0];
  }

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
// NATIVE JWT AUTH PROVIDER
// ============================================
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
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

  const refreshProfile = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('auth_token') || localStorage.getItem('dev_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await apiClient.get('/users/me');
      if (response.data?.success) {
        const profileUser = response.data.data.user;
        const newMemberships: Membership[] = response.data.data.memberships || [];
        
        setUser(profileUser);
        applyMemberships(newMemberships, profileUser?.defaultSocietyId);
      }
    } catch (e: any) {
      console.warn('Failed to load user profile:', e?.message || e);
      if (e?.response?.status === 401) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('dev_token');
        localStorage.removeItem('dev_session');
        setUser(null);
        setMemberships([]);
      }
    } finally {
      setLoading(false);
    }
  }, [applyMemberships]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

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
    localStorage.removeItem('auth_token');
    localStorage.removeItem('dev_token');
    localStorage.removeItem('dev_session');
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

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
