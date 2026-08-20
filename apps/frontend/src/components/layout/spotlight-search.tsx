'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { useAuth } from '../../app/providers/auth-context';
import { apiClient } from '../../lib/api/client';
import {
  Search,
  X,
  ArrowRight,
  Command,
  CornerDownLeft,
  Users,
  Home,
  Receipt,
  CreditCard,
  MessageSquare,
  Box,
  BookOpen,
  Code2,
  ShieldCheck,
  UserCheck,
  Sparkles,
  LayoutDashboard,
  BarChart3,
  Clock,
  PlusCircle,
  FileText,
  Building,
  Loader2,
  Trash2,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────
export interface SearchItem {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  badge?: string;
  badgeColor?: string;
  url: string;
  icon: string;
  metadata?: Record<string, any>;
}

export interface SearchCategory {
  category: string;
  icon: string;
  count: number;
  items: SearchItem[];
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: any;
  iconColor: string;
  url: (slug: string) => string;
  badge?: string;
  category: 'Quick Action' | 'Quick Navigation';
  isAllowed?: (isManagement: boolean, permissions: string[], role: string) => boolean;
}

interface RecentSearch {
  id: string;
  title: string;
  subtitle: string;
  url: string;
  type: string;
  timestamp: number;
}

const STORAGE_KEY_RECENTS = 'housive_spotlight_recents';

const MANAGEMENT_ROLES = [
  'SUPER_ADMIN',
  'PRESIDENT',
  'VICE_PRESIDENT',
  'SECRETARY',
  'JOINT_SECRETARY',
  'TREASURER',
  'ACCOUNTANT',
  'AUDITOR',
  'COMMITTEE_MEMBER',
  'ESTATE_MANAGER',
  'MAINTENANCE_INCHARGE',
  'SECURITY_SUPERVISOR',
  'CULTURAL_SECRETARY',
  'LEGAL_ADVISOR',
  'SOCIETY_ADMIN',
];

// ─────────────────────────────────────────────────────────────────
// Icon Resolver Helper
// ─────────────────────────────────────────────────────────────────
function getEntityIcon(iconName: string) {
  switch (iconName) {
    case 'Users':
    case 'User':
      return <Users className="h-4 w-4" />;
    case 'Home':
      return <Home className="h-4 w-4" />;
    case 'Receipt':
      return <Receipt className="h-4 w-4" />;
    case 'CreditCard':
      return <CreditCard className="h-4 w-4" />;
    case 'MessageSquare':
      return <MessageSquare className="h-4 w-4" />;
    case 'Box':
      return <Box className="h-4 w-4" />;
    case 'BookOpen':
      return <BookOpen className="h-4 w-4" />;
    case 'Code2':
      return <Code2 className="h-4 w-4" />;
    case 'ShieldCheck':
      return <ShieldCheck className="h-4 w-4" />;
    case 'UserCheck':
      return <UserCheck className="h-4 w-4" />;
    case 'BarChart3':
      return <BarChart3 className="h-4 w-4" />;
    case 'Sparkles':
      return <Sparkles className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

function getBadgeStyle(badgeColor?: string) {
  switch (badgeColor) {
    case 'emerald':
      return 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20';
    case 'rose':
      return 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20';
    case 'amber':
      return 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20';
    case 'indigo':
      return 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20';
    case 'cyan':
      return 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-500/20';
    case 'violet':
      return 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-500/20';
    case 'blue':
      return 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20';
    default:
      return 'bg-slate-100 dark:bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-500/20';
  }
}

// ─────────────────────────────────────────────────────────────────
// Master Quick Actions & Navigation Templates
// ─────────────────────────────────────────────────────────────────
const ALL_QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'add-member',
    title: 'Add New Member',
    description: 'Register owner or tenant with unit allocation',
    icon: Users,
    iconColor: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20',
    url: (slug) => `/${slug}/members`,
    badge: 'Members',
    category: 'Quick Action',
    isAllowed: (isMgmt, perms) => isMgmt || perms.includes('member:write'),
  },
  {
    id: 'new-invoice',
    title: 'Create Maintenance Invoice',
    description: 'Generate monthly society dues for units',
    icon: Receipt,
    iconColor: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
    url: (slug) => `/${slug}/maintenance`,
    badge: 'Billing',
    category: 'Quick Action',
    isAllowed: (isMgmt, perms) => isMgmt || perms.includes('billing:write'),
  },
  {
    id: 'record-payment-admin',
    title: 'Record Payment / Receipt',
    description: 'Post online, cheque, UPI or cash payment',
    icon: CreditCard,
    iconColor: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20',
    url: (slug) => `/${slug}/payments`,
    badge: 'Accounts',
    category: 'Quick Action',
    isAllowed: (isMgmt, perms) => isMgmt || perms.includes('payment:write'),
  },
  {
    id: 'pay-dues-resident',
    title: 'Pay Maintenance Dues',
    description: 'View outstanding invoices and pay online securely',
    icon: CreditCard,
    iconColor: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
    url: (slug) => `/${slug}/resident`,
    badge: 'Dues',
    category: 'Quick Action',
    isAllowed: (isMgmt, perms, role) => !isMgmt && !perms.includes('payment:write'),
  },
  {
    id: 'file-complaint',
    title: 'File Helpdesk Complaint',
    description: 'Report a maintenance or facility issue',
    icon: MessageSquare,
    iconColor: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
    url: (slug) => `/${slug}/complaints`,
    badge: 'Helpdesk',
    category: 'Quick Action',
    isAllowed: () => true,
  },
  {
    id: 'custom-reports',
    title: 'Custom SQL Reports',
    description: 'Write, favorite & execute parametrized SQL queries',
    icon: Code2,
    iconColor: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20',
    url: (slug) => `/${slug}/reports/custom`,
    badge: 'Reporting',
    category: 'Quick Action',
    isAllowed: (isMgmt, perms) => isMgmt || perms.includes('report:read') || perms.includes('report:write'),
  },
  {
    id: 'ai-assistant',
    title: 'Ask AI Assistant',
    description: 'Query society finances, rules, and analytics with AI',
    icon: Sparkles,
    iconColor: 'text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-50 dark:bg-fuchsia-500/10 border-fuchsia-200 dark:border-fuchsia-500/20',
    url: (slug) => `/${slug}/ai-assistant`,
    badge: 'Gemini AI',
    category: 'Quick Action',
    isAllowed: () => true,
  },
];

const ALL_QUICK_NAVIGATION: QuickAction[] = [
  {
    id: 'nav-dashboard',
    title: 'Dashboard Overview',
    description: 'Society KPIs, collections, occupancy & live feeds',
    icon: LayoutDashboard,
    iconColor: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20',
    url: (slug) => `/${slug}/dashboard`,
    category: 'Quick Navigation',
    isAllowed: () => true,
  },
  {
    id: 'nav-resident',
    title: 'Resident Portal',
    description: 'My flat details, family, vehicles & personal dues',
    icon: Home,
    iconColor: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
    url: (slug) => `/${slug}/resident`,
    category: 'Quick Navigation',
    isAllowed: () => true,
  },
  {
    id: 'nav-members',
    title: 'Members & Directory',
    description: 'Resident profiles, committee & ownership records',
    icon: Users,
    iconColor: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20',
    url: (slug) => `/${slug}/members`,
    category: 'Quick Navigation',
    isAllowed: (isMgmt, perms) => isMgmt || perms.includes('member:read'),
  },
  {
    id: 'nav-flats',
    title: 'Flats & Units Directory',
    description: 'Buildings, wings, floors, and occupancy tracking',
    icon: Building,
    iconColor: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20',
    url: (slug) => `/${slug}/flats`,
    category: 'Quick Navigation',
    isAllowed: (isMgmt, perms) => isMgmt || perms.includes('flat:read'),
  },
  {
    id: 'nav-maintenance',
    title: 'Maintenance Invoices',
    description: 'Generated bills, arrears & society billing register',
    icon: Receipt,
    iconColor: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
    url: (slug) => `/${slug}/maintenance`,
    category: 'Quick Navigation',
    isAllowed: (isMgmt, perms) => isMgmt || perms.includes('billing:read'),
  },
  {
    id: 'nav-payments',
    title: 'Payments & Receipts Register',
    description: 'Online, cheque, UPI collection records & approvals',
    icon: CreditCard,
    iconColor: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-500/20',
    url: (slug) => `/${slug}/payments`,
    category: 'Quick Navigation',
    isAllowed: (isMgmt, perms) => isMgmt || perms.includes('payment:read'),
  },
  {
    id: 'nav-complaints',
    title: 'Helpdesk & Complaints',
    description: 'Service requests, tracking, and staff assignments',
    icon: MessageSquare,
    iconColor: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20',
    url: (slug) => `/${slug}/complaints`,
    category: 'Quick Navigation',
    isAllowed: () => true,
  },
  {
    id: 'nav-accounting',
    title: 'Accounting & Ledger Vouchers',
    description: 'Chart of accounts, journals, expenses & financial books',
    icon: BookOpen,
    iconColor: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20',
    url: (slug) => `/${slug}/accounting`,
    category: 'Quick Navigation',
    isAllowed: (isMgmt, perms) => isMgmt || perms.includes('accounting:read'),
  },
  {
    id: 'nav-reports',
    title: 'Financial & Occupancy Reports',
    description: 'Collection summaries, defaulter lists & audit analytics',
    icon: BarChart3,
    iconColor: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
    url: (slug) => `/${slug}/reports`,
    category: 'Quick Navigation',
    isAllowed: (isMgmt, perms) => isMgmt || perms.includes('report:read') || perms.includes('accounting:read'),
  },
  {
    id: 'nav-assets',
    title: 'Assets & Capital Inventory',
    description: 'Lifts, pumps, generators, AMC warranties & maintenance',
    icon: Box,
    iconColor: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20',
    url: (slug) => `/${slug}/assets`,
    category: 'Quick Navigation',
    isAllowed: (isMgmt, perms) => isMgmt || perms.includes('asset:read'),
  },
];

// ─────────────────────────────────────────────────────────────────
// Spotlight Component Props
// ─────────────────────────────────────────────────────────────────
interface SpotlightSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SpotlightSearch: React.FC<SpotlightSearchProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const societySlug = (params?.society_slug as string) || '';

  const { activeSociety } = useAuth();
  const userRole = activeSociety?.role || '';
  const userPermissions = activeSociety?.permissions || [];
  const isManagementRole = MANAGEMENT_ROLES.includes(userRole);

  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState<SearchCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recents, setRecents] = useState<RecentSearch[]>([]);
  const [mounted, setMounted] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter Quick Actions and Navigation according to logged-in user permissions
  const visibleQuickActions = useMemo(() => {
    return ALL_QUICK_ACTIONS.filter((action) =>
      action.isAllowed ? action.isAllowed(isManagementRole, userPermissions, userRole) : true
    );
  }, [isManagementRole, userPermissions, userRole]);

  const visibleQuickNavigation = useMemo(() => {
    return ALL_QUICK_NAVIGATION.filter((nav) =>
      nav.isAllowed ? nav.isAllowed(isManagementRole, userPermissions, userRole) : true
    );
  }, [isManagementRole, userPermissions, userRole]);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY_RECENTS);
      if (stored) {
        setRecents(JSON.parse(stored));
      }
    } catch {
      // Ignore JSON parse errors
    }
  }, []);

  // Focus input when opened & reset state
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setCategories([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle global shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Debounced Search API call
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setCategories([]);
      setIsLoading(false);
      setSelectedIndex(0);
      return;
    }

    setIsLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        const res = await apiClient.get(`/search?q=${encodeURIComponent(trimmed)}`);
        if (res.data?.success && res.data.data) {
          setCategories(res.data.data.categories || []);
          setSelectedIndex(0);
        }
      } catch (err) {
        console.error('Search API error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [query, isOpen]);

  // Build flat list of all selectable items for keyboard arrow navigation
  const flatItems: Array<{
    id: string;
    title: string;
    subtitle?: string;
    url: string;
    type: string;
    badge?: string;
    badgeColor?: string;
    icon: any;
    isEntity?: boolean;
  }> = useMemo(() => {
    if (query.trim()) {
      const items: any[] = [];
      categories.forEach((cat) => {
        cat.items.forEach((item) => {
          items.push({
            id: item.id,
            title: item.title,
            subtitle: item.subtitle,
            url: item.url.startsWith('/') ? (societySlug ? `/${societySlug}${item.url}` : item.url) : item.url,
            type: item.type,
            badge: item.badge,
            badgeColor: item.badgeColor,
            icon: item.icon,
            isEntity: true,
          });
        });
      });
      return items;
    }

    // Zero-state list (Filtered by user permissions)
    const items: any[] = [];

    // Recents
    recents.forEach((r) => {
      items.push({
        id: `recent-${r.id}`,
        title: r.title,
        subtitle: r.subtitle,
        url: r.url,
        type: 'recent',
        badge: 'Recent',
        badgeColor: 'slate',
        icon: 'Clock',
        isEntity: true,
      });
    });

    // Permission-filtered Quick Actions
    visibleQuickActions.forEach((qa) => {
      items.push({
        id: qa.id,
        title: qa.title,
        subtitle: qa.description,
        url: qa.url(societySlug),
        type: 'action',
        badge: qa.badge,
        badgeColor: 'indigo',
        icon: qa.icon,
        isEntity: false,
      });
    });

    // Permission-filtered Quick Navigation
    visibleQuickNavigation.forEach((qn) => {
      items.push({
        id: qn.id,
        title: qn.title,
        subtitle: qn.description,
        url: qn.url(societySlug),
        type: 'navigation',
        badge: 'Page',
        badgeColor: 'slate',
        icon: qn.icon,
        isEntity: false,
      });
    });

    return items;
  }, [query, categories, recents, societySlug, visibleQuickActions, visibleQuickNavigation]);

  const saveToRecent = useCallback(
    (item: { id: string; title: string; subtitle?: string; url: string; type: string }) => {
      try {
        const newRecent: RecentSearch = {
          id: item.id,
          title: item.title,
          subtitle: item.subtitle || '',
          url: item.url,
          type: item.type,
          timestamp: Date.now(),
        };

        const updated = [newRecent, ...recents.filter((r) => r.url !== item.url)].slice(0, 6);
        setRecents(updated);
        localStorage.setItem(STORAGE_KEY_RECENTS, JSON.stringify(updated));
      } catch {
        // Ignore localStorage errors
      }
    },
    [recents]
  );

  const clearRecents = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecents([]);
    localStorage.removeItem(STORAGE_KEY_RECENTS);
  };

  const handleSelect = useCallback(
    (targetUrl: string, itemData?: any) => {
      if (itemData) {
        saveToRecent(itemData);
      }
      onClose();
      router.push(targetUrl);
    },
    [onClose, router, saveToRecent]
  );

  // Keyboard navigation inside list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (flatItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % flatItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + flatItems.length) % flatItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = flatItems[selectedIndex];
      if (selected) {
        handleSelect(selected.url, selected);
      }
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!mounted || !isOpen) return null;

  let currentFlatCounter = 0;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 select-none">
      {/* Backdrop with rich blur */}
      <div
        className="fixed inset-0 bg-slate-900/50 dark:bg-black/75 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Spotlight Window Card */}
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white/98 dark:bg-black/95 text-slate-900 dark:text-neutral-100 shadow-2xl shadow-slate-900/10 dark:shadow-black backdrop-blur-2xl transition-all animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Header Bar */}
        <div className="relative flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-neutral-800 bg-slate-50/50 dark:bg-black/40">
          <div className="flex items-center justify-center p-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mr-3 shrink-0">
            <Search className="h-5 w-5" />
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isManagementRole
                ? 'Search members, flats, invoices, receipts, complaints, reports...'
                : 'Search your flats, invoices, receipts, complaints, staff...'
            }
            className="flex-1 bg-transparent text-sm sm:text-base font-medium placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-slate-100 focus:outline-none"
          />

          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-500 shrink-0 ml-2" />
          ) : query ? (
            <button
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0 ml-2"
              title="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}

          <div className="flex items-center gap-1.5 ml-3 pl-3 border-l border-slate-200 dark:border-slate-800 text-[10px] font-semibold text-slate-400 dark:text-slate-500 shrink-0">
            <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-500 dark:text-slate-400 shadow-xs">
              ESC
            </kbd>
          </div>
        </div>

        {/* Scrollable Results & Shortcuts Body */}
        <div
          ref={listRef}
          className="max-h-[60vh] sm:max-h-[460px] overflow-y-auto overflow-x-hidden p-2 space-y-4 custom-scrollbar"
        >
          {/* ════════════════════════════════════════════════════════════ */}
          {/* SEARCH RESULTS VIEW (When query is active) */}
          {/* ════════════════════════════════════════════════════════════ */}
          {query.trim() ? (
            categories.length === 0 && !isLoading ? (
              <div className="py-16 text-center space-y-2">
                <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Search className="h-5 w-5" />
                </div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-300">
                  No matches found for &quot;{query}&quot;
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  {isManagementRole
                    ? 'Try searching by member name, phone number, flat number, invoice ID, or ticket title.'
                    : 'Search results are scoped to your assigned units, personal invoices, complaints, and staff.'}
                </p>
              </div>
            ) : (
              categories.map((cat) => (
                <div key={cat.category} className="space-y-1">
                  {/* Category Header */}
                  <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <span className="text-indigo-600 dark:text-indigo-400">{getEntityIcon(cat.icon)}</span>
                      <span>{cat.category}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-mono font-bold">
                      {cat.count}
                    </span>
                  </div>

                  {/* Category Items */}
                  {cat.items.map((item) => {
                    const itemIndex = currentFlatCounter++;
                    const isSelected = selectedIndex === itemIndex;
                    const targetUrl = item.url.startsWith('/')
                      ? societySlug
                        ? `/${societySlug}${item.url}`
                        : item.url
                      : item.url;

                    return (
                      <div
                        key={item.id}
                        data-index={itemIndex}
                        onClick={() => handleSelect(targetUrl, item)}
                        onMouseEnter={() => setSelectedIndex(itemIndex)}
                        className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                            : 'hover:bg-slate-100/90 dark:hover:bg-slate-900/80 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className={`p-2 rounded-xl border flex items-center justify-center shrink-0 transition ${
                              isSelected
                                ? 'bg-white/20 border-white/30 text-white'
                                : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/60 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {getEntityIcon(item.icon)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>
                                {item.title}
                              </span>
                              {item.badge && (
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border uppercase tracking-wider shrink-0 ${
                                    isSelected
                                      ? 'bg-white/20 text-white border-white/30'
                                      : getBadgeStyle(item.badgeColor)
                                  }`}
                                >
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            <p
                              className={`text-[11px] truncate mt-0.5 ${
                                isSelected ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {item.subtitle}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pl-3 shrink-0">
                          {isSelected && (
                            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold text-white/90 bg-white/20 px-2 py-0.5 rounded-md">
                              Jump to <CornerDownLeft className="h-2.5 w-2.5" />
                            </span>
                          )}
                          <ChevronRight
                            className={`h-4 w-4 transition ${
                              isSelected ? 'text-white translate-x-0.5' : 'text-slate-400 dark:text-slate-600 opacity-0 group-hover:opacity-100'
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )
          ) : (
            /* ════════════════════════════════════════════════════════════ */
            /* ZERO-STATE VIEW: Recents + Quick Actions + Navigation        */
            /* ════════════════════════════════════════════════════════════ */
            <div className="space-y-4 py-1">
              {/* Recent Searches */}
              {recents.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>Recent Searches</span>
                    </div>
                    <button
                      onClick={clearRecents}
                      className="text-[10px] font-bold text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {recents.map((recent) => {
                      const itemIndex = currentFlatCounter++;
                      const isSelected = selectedIndex === itemIndex;

                      return (
                        <div
                          key={recent.id}
                          data-index={itemIndex}
                          onClick={() => handleSelect(recent.url, recent)}
                          onMouseEnter={() => setSelectedIndex(itemIndex)}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                              : 'bg-slate-50/80 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-900/80 text-slate-800 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800/60 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <Clock
                              className={`h-3.5 w-3.5 shrink-0 ${
                                isSelected ? 'text-white' : 'text-slate-400'
                              }`}
                            />
                            <div className="min-w-0 flex-1">
                              <p className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>
                                {recent.title}
                              </p>
                              {recent.subtitle && (
                                <p className={`text-[10px] truncate ${isSelected ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}`}>
                                  {recent.subtitle}
                                </p>
                              )}
                            </div>
                          </div>
                          <ArrowRight
                            className={`h-3 w-3 shrink-0 ml-2 ${
                              isSelected ? 'text-white' : 'text-slate-400 dark:text-slate-600'
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quick Actions Group */}
              {visibleQuickActions.length > 0 && (
                <div className="space-y-1">
                  <div className="px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Quick Actions & Shortcuts</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {visibleQuickActions.map((action) => {
                      const itemIndex = currentFlatCounter++;
                      const isSelected = selectedIndex === itemIndex;
                      const Icon = action.icon;
                      const targetUrl = action.url(societySlug);

                      return (
                        <div
                          key={action.id}
                          data-index={itemIndex}
                          onClick={() => handleSelect(targetUrl)}
                          onMouseEnter={() => setSelectedIndex(itemIndex)}
                          className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                              : 'bg-slate-50/80 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-900/80 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800/60 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`p-2 rounded-xl border flex items-center justify-center shrink-0 transition ${
                                isSelected
                                  ? 'bg-white/20 border-white/30 text-white'
                                  : action.iconColor
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>
                                  {action.title}
                                </span>
                              </div>
                              <p className={`text-[10px] truncate ${isSelected ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}`}>
                                {action.description}
                              </p>
                            </div>
                          </div>
                          <ChevronRight
                            className={`h-3.5 w-3.5 shrink-0 ml-2 transition ${
                              isSelected ? 'text-white translate-x-0.5' : 'text-slate-400 dark:text-slate-600'
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quick Navigation Pages Group */}
              {visibleQuickNavigation.length > 0 && (
                <div className="space-y-1">
                  <div className="px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Building className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Modules & Navigation</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {visibleQuickNavigation.map((nav) => {
                      const itemIndex = currentFlatCounter++;
                      const isSelected = selectedIndex === itemIndex;
                      const Icon = nav.icon;
                      const targetUrl = nav.url(societySlug);

                      return (
                        <div
                          key={nav.id}
                          data-index={itemIndex}
                          onClick={() => handleSelect(targetUrl)}
                          onMouseEnter={() => setSelectedIndex(itemIndex)}
                          className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                              : 'bg-slate-50/80 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-900/80 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800/60 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`p-2 rounded-xl border flex items-center justify-center shrink-0 transition ${
                                isSelected
                                  ? 'bg-white/20 border-white/30 text-white'
                                  : nav.iconColor
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>
                                {nav.title}
                              </p>
                              <p className={`text-[10px] truncate ${isSelected ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}`}>
                                {nav.description}
                              </p>
                            </div>
                          </div>
                          <ChevronRight
                            className={`h-3.5 w-3.5 shrink-0 ml-2 transition ${
                              isSelected ? 'text-white translate-x-0.5' : 'text-slate-400 dark:text-slate-600'
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with macOS-style keyboard hints */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-black text-[11px] text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono text-[10px] shadow-xs">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono text-[10px] shadow-xs">
                ↓
              </kbd>
              <span className="hidden sm:inline font-medium">to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono text-[10px] shadow-xs">
                ↵
              </kbd>
              <span className="hidden sm:inline font-medium">to select</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
              Spotlight Search ({userRole.replace('_', ' ') || 'Resident'})
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
