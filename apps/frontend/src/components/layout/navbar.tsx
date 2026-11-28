'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import {
  AlertCircle,
  BarChart2,
  Bell,
  BookOpen,
  Bot,
  Box,
  Building,
  Building2,
  Check,
  CheckCheck,
  CheckCircle,
  ChevronDown,
  CreditCard,
  Eye,
  EyeOff,
  Home,
  Key,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  Sun,
  User as UserIcon,
  Users,
  CalendarDays,
  Landmark,
  Presentation,
  DoorOpen,
  PiggyBank,
  MessagesSquare,
  X,
} from 'lucide-react';
import { useAuth } from '../../app/providers/auth-context';
import { useTheme } from '../../app/providers/theme-context';
import { useSidebar } from '../../app/providers/sidebar-context';
import { apiClient } from '../../lib/api/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SocietySwitcher } from './society-switcher';
import { DefaultSocietyModal } from './default-society-modal';
import { SpotlightSearch } from './spotlight-search';

type Icon = React.ComponentType<{ className?: string }>;

interface NavItem {
  label: string;
  href: (slug: string) => string;
  icon: Icon;
  permission?: string;
  superAdminOnly?: boolean;
}

interface NavSection {
  id: string;
  title: string;
  items: NavItem[];
}

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  channel: string;
  status: string;
  createdAt: string;
}

// Menu grouped the CRM way: a handful of sections, each collapsible.
const NAV_SECTIONS: NavSection[] = [
  {
    id: 'overview',
    title: 'Overview',
    items: [{ label: 'Dashboard', href: (s) => `/${s}/dashboard`, icon: LayoutDashboard }],
  },
  {
    id: 'property',
    title: 'Property',
    items: [
      { label: 'Flats', href: (s) => `/${s}/flats`, icon: Building, permission: 'flat:read' },
      { label: 'Members', href: (s) => `/${s}/members`, icon: Users, permission: 'member:read' },
      { label: 'Committee', href: (s) => `/${s}/committee`, icon: Landmark },
      { label: 'Resident Portal', href: (s) => `/${s}/resident`, icon: Home, permission: 'resident:read' },
    ],
  },
  {
    id: 'finance',
    title: 'Finance',
    items: [
      { label: 'Maintenance', href: (s) => `/${s}/maintenance`, icon: CreditCard, permission: 'billing:read' },
      { label: 'Payments', href: (s) => `/${s}/payments`, icon: Receipt, permission: 'billing:read' },
      { label: 'Fund collection', href: (s) => `/${s}/funds`, icon: PiggyBank },
      { label: 'Accounting', href: (s) => `/${s}/accounting`, icon: BookOpen, permission: 'accounting:read' },
      { label: 'Reports', href: (s) => `/${s}/reports`, icon: BarChart2, permission: 'accounting:read' },
    ],
  },
  {
    id: 'operations',
    title: 'Operations',
    items: [
      { label: 'Chat', href: (s) => `/${s}/chat`, icon: MessagesSquare },
      { label: 'Complaints', href: (s) => `/${s}/complaints`, icon: MessageSquare },
      { label: 'Facilities', href: (s) => `/${s}/facilities`, icon: CalendarDays },
      { label: 'Meetings', href: (s) => `/${s}/meetings`, icon: Presentation },
      { label: 'Visitors', href: (s) => `/${s}/visitors`, icon: DoorOpen },
      { label: 'Assets', href: (s) => `/${s}/assets`, icon: Box, permission: 'society:read' },
      { label: 'AI Assistant', href: (s) => `/${s}/ai-assistant`, icon: Bot },
    ],
  },
  {
    id: 'admin',
    title: 'Administration',
    items: [
      { label: 'Society Settings', href: (s) => `/${s}/profile`, icon: Settings, permission: 'society:write' },
    ],
  },
];

const COLLAPSED_SECTIONS_KEY = 'housive_nav_sections';

/** Which menu entries a role sees (unchanged from the previous navbar). */
function canSee(item: NavItem, role: string, permissions: string[]) {
  if (item.superAdminOnly) return role === 'SUPER_ADMIN';
  if (['SUPER_ADMIN', 'PRESIDENT', 'SECRETARY', 'SOCIETY_ADMIN'].includes(role)) return true;
  const allow = (labels: string[]) => labels.includes(item.label);
  if (role === 'ACCOUNTANT' || role === 'TREASURER') {
    return allow(['Dashboard', 'Maintenance', 'Payments', 'Accounting', 'Reports', 'Flats', 'Members', 'Complaints', 'Facilities', 'AI Assistant', 'Committee', 'Meetings', 'Visitors', 'Fund collection', 'Chat']);
  }
  if (role === 'AUDITOR') return allow(['Dashboard', 'Accounting', 'Reports', 'Flats', 'Members', 'Complaints', 'Committee', 'Meetings', 'Visitors', 'Fund collection', 'Chat']);
  if (['ESTATE_MANAGER', 'MAINTENANCE_INCHARGE'].includes(role)) {
    return allow(['Dashboard', 'Assets', 'Complaints', 'Facilities', 'Flats', 'Maintenance', 'Reports', 'AI Assistant', 'Committee', 'Meetings', 'Visitors', 'Fund collection', 'Chat']);
  }
  if (role === 'SECURITY_SUPERVISOR') return allow(['Dashboard', 'Flats', 'Resident Portal', 'Complaints', 'Committee', 'Meetings', 'Visitors', 'Chat']);
  if (['COMMITTEE_MEMBER', 'VICE_PRESIDENT', 'JOINT_SECRETARY', 'CULTURAL_SECRETARY', 'LEGAL_ADVISOR'].includes(role)) {
    return allow(['Dashboard', 'Members', 'Flats', 'Maintenance', 'Payments', 'Assets', 'Complaints', 'Facilities', 'Reports', 'AI Assistant', 'Committee', 'Meetings', 'Visitors', 'Fund collection', 'Chat']);
  }
  if (['OWNER', 'CO_OWNER', 'TENANT', 'FAMILY_MEMBER', 'MEMBER'].includes(role) || !role) {
    return allow(['Dashboard', 'Resident Portal', 'Maintenance', 'Payments', 'Complaints', 'Facilities', 'AI Assistant', 'Committee', 'Meetings', 'Visitors', 'Fund collection', 'Chat']);
  }
  if (!item.permission) return true;
  return permissions.includes(item.permission);
}

const formatRole = (role: string) => (role ? role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : 'Resident');

interface AppLayoutProps {
  children?: React.ReactNode;
}

export const Navbar: React.FC<AppLayoutProps> = ({ children }) => {
  const { user, activeSociety, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const params = useParams();
  const pathname = usePathname();
  const societySlug = (params?.society_slug as string) || activeSociety?.societySlug || '';

  const userPermissions = activeSociety?.permissions || [];
  const userRole = activeSociety?.role || '';
  const isManagementRole = ['SUPER_ADMIN', 'PRESIDENT', 'SECRETARY', 'TREASURER', 'ACCOUNTANT'].includes(userRole);

  const [mounted, setMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<string[]>([]);

  // Notifications
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSweeping, setIsSweeping] = useState(false);

  // Profile & password dialogs
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [profileName, setProfileName] = useState<string>((user as any)?.name || '');
  const [profileMobile, setProfileMobile] = useState<string>((user as any)?.mobile || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = JSON.parse(localStorage.getItem(COLLAPSED_SECTIONS_KEY) || '[]');
      if (Array.isArray(saved)) setCollapsedSections(saved);
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    if (user) {
      setProfileName((user as any)?.name || '');
      setProfileMobile((user as any)?.mobile || '');
    }
  }, [user]);

  // ⌘B / Ctrl+B toggles the sidebar, as in DealCust.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleSidebar]);

  const fetchNotifications = async () => {
    if (!user || !activeSociety) return;
    try {
      const res = await apiClient.get('/notifications/my-notifications');
      if (res.data?.success) {
        setNotifications(res.data.list || res.data.data?.list || []);
        setUnreadCount(res.data.unreadCount || res.data.data?.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeSociety]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await apiClient.patch(`/notifications/${id}/read`);
      fetchNotifications();
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiClient.patch('/notifications/mark-all-read');
      fetchNotifications();
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  const handleRunSweep = async () => {
    setIsSweeping(true);
    try {
      const res = await apiClient.post('/notifications/sweep');
      if (res.data?.success) {
        alert(`Dues reminder sweep dispatched to ${res.data.data?.count || res.data.count || 0} resident accounts!`);
        fetchNotifications();
      }
    } catch {
      alert('Failed to dispatch dues reminder sweep.');
    } finally {
      setIsSweeping(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    setProfileMessage(null);
    try {
      const res = await apiClient.patch('/users/me/profile', { name: profileName, mobile: profileMobile });
      if (res.data?.success) {
        setProfileMessage({ type: 'success', text: 'Profile details updated successfully.' });
        setTimeout(() => {
          setIsProfileModalOpen(false);
          setProfileMessage(null);
        }, 1200);
      }
    } catch (err: any) {
      setProfileMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update profile.' });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const closePasswordModal = () => {
    setIsPasswordModalOpen(false);
    setPasswordMessage(null);
    setNewPassword('');
    setConfirmPassword('');
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New password and confirm password do not match.' });
      return;
    }
    setIsUpdatingPassword(true);
    setPasswordMessage(null);
    try {
      const res = await apiClient.post('/users/me/change-password', { newPassword });
      if (res.data?.success) {
        setPasswordMessage({ type: 'success', text: 'Password changed successfully.' });
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(closePasswordModal, 1500);
      }
    } catch (err: any) {
      setPasswordMessage({ type: 'error', text: err.response?.data?.message || 'Failed to change password.' });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const visibleSections = useMemo(
    () =>
      NAV_SECTIONS.map((sec) => ({ ...sec, items: sec.items.filter((i) => canSee(i, userRole, userPermissions)) })).filter(
        (sec) => sec.items.length > 0,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userRole, userPermissions.join(',')],
  );

  const isItemActive = (item: NavItem) => {
    const href = item.href(societySlug);
    return pathname === href || !!pathname?.startsWith(href + '/');
  };

  const activeItem = visibleSections.flatMap((s) => s.items).find(isItemActive);

  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(COLLAPSED_SECTIONS_KEY, JSON.stringify(next));
      } catch {
        /* private mode */
      }
      return next;
    });
  };

  const displayName = (user as any)?.name || user?.email?.split('@')[0] || 'User';
  const initials =
    displayName
      .split(/\s+/)
      .filter((w: string) => /^[a-z]/i.test(w))
      .slice(0, 2)
      .map((w: string) => w[0].toUpperCase())
      .join('') || 'U';
  const isMac = mounted && /Mac|iPhone|iPad/i.test(navigator.platform);
  const homeHref = societySlug ? `/${societySlug}/dashboard` : '/';

  const brand = (compact: boolean) => (
    <Link href={homeHref} className="flex min-w-0 items-center gap-2.5" title="Housive home" onClick={() => setIsMobileMenuOpen(false)}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white">
        <Building2 className="h-[17px] w-[17px]" />
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold leading-tight tracking-tight text-slate-900 dark:text-slate-100" title={activeSociety?.societyName}>
            {activeSociety?.societyName || 'Housive'}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-slate-500">
            <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            Housive · {formatRole(userRole)}
          </span>
        </span>
      )}
    </Link>
  );

  const nav = (compact: boolean) => (
    <nav className={cn('flex select-none flex-col py-2', compact ? 'gap-2 px-2' : 'px-2')}>
      {visibleSections.map((sec, idx) => {
        const hasActive = sec.items.some(isItemActive);
        const sectionCollapsed = !hasActive && collapsedSections.includes(sec.id);

        if (compact) {
          return (
            <div key={sec.id} className="flex flex-col gap-0.5">
              {idx > 0 && <div className="mx-2 my-1.5 border-t border-sidebar-border" />}
              {sec.items.map((item) => {
                const active = isItemActive(item);
                const Icon = item.icon;
                return (
                  <Tooltip key={item.label}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href(societySlug)}
                        aria-label={item.label}
                        className={cn(
                          'flex items-center justify-center rounded-md py-2 transition-colors',
                          active
                            ? 'bg-sidebar-active text-slate-900 dark:text-slate-100'
                            : 'text-slate-500 hover:bg-sidebar-hover hover:text-slate-900 dark:hover:text-slate-100',
                        )}
                      >
                        <Icon className={cn('h-[17px] w-[17px]', active && 'text-brand-500')} />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          );
        }

        return (
          <div key={sec.id} className="flex flex-col">
            <button
              type="button"
              onClick={() => toggleSection(sec.id)}
              aria-expanded={!sectionCollapsed}
              className="group flex items-center justify-between rounded-md px-3 pb-1 pt-2.5 text-left text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-300"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-[13px]">{sec.title}</span>
                {hasActive && sectionCollapsed && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />}
              </span>
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 shrink-0 transition-all duration-200',
                  sectionCollapsed ? '-rotate-90 opacity-100' : 'opacity-0 group-hover:opacity-100',
                )}
              />
            </button>
            {!sectionCollapsed && (
              <div className="mb-1 flex flex-col">
                {sec.items.map((item) => {
                  const active = isItemActive(item);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.label}
                      href={item.href(societySlug)}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        'group flex items-center gap-3 rounded-md px-3 py-[7px] text-[14px] font-medium transition-colors',
                        active
                          ? 'bg-sidebar-active text-slate-900 dark:text-slate-100'
                          : 'text-slate-800 hover:bg-sidebar-hover dark:text-slate-300 dark:hover:text-slate-100',
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-[17px] w-[17px] shrink-0 transition-colors',
                          active ? 'text-brand-500' : 'text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-200',
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  const sidebarFooter = (compact: boolean) => (
    <div className={cn('border-t border-sidebar-border p-2', compact && 'px-2')}>
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
        title={`${compact ? 'Expand' : 'Collapse'} sidebar (${isMac ? '⌘B' : 'Ctrl+B'})`}
        className={cn(
          'flex w-full items-center rounded-md py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-sidebar-hover hover:text-slate-900 dark:hover:text-slate-100',
          compact ? 'justify-center' : 'gap-2 px-3',
        )}
      >
        {compact ? (
          <PanelLeftOpen className="h-[15px] w-[15px]" />
        ) : (
          <>
            <PanelLeftClose className="h-[15px] w-[15px]" />
            <span className="truncate">Collapse sidebar</span>
            <kbd className="ml-auto rounded border border-sidebar-border bg-background px-1 text-[10px] text-slate-500">{isMac ? '⌘B' : 'Ctrl+B'}</kbd>
          </>
        )}
      </button>
    </div>
  );

  const message = (m: { type: 'success' | 'error'; text: string } | null) =>
    m && (
      <div
        className={cn(
          'flex items-center gap-2.5 rounded-md border p-3 text-sm',
          m.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
            : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300',
        )}
      >
        {m.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
        <span>{m.text}</span>
      </div>
    );

  return (
    <TooltipProvider>
      <div className="flex min-h-screen bg-background text-foreground">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            'sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex',
            mounted && 'transition-[width] duration-200 ease-in-out',
            isCollapsed ? 'w-16' : 'w-60',
          )}
        >
          <div className={cn('flex h-12 shrink-0 items-center border-b border-sidebar-border', isCollapsed ? 'justify-center px-2' : 'px-4')}>
            {brand(isCollapsed)}
          </div>
          <div className="custom-scrollbar flex-1 overflow-y-auto overflow-x-hidden">{nav(isCollapsed)}</div>
          {sidebarFooter(isCollapsed)}
        </aside>

        {/* Mobile drawer */}
        {isMobileMenuOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-sidebar-border bg-sidebar shadow-2xl transition-transform duration-200 lg:hidden',
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-sidebar-border px-4">
            {brand(false)}
            <Button variant="ghost" size="icon-sm" aria-label="Close menu" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-500">
              <X />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">{nav(false)}</div>
        </aside>

        {/* Main column */}
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-1.5 border-b border-sidebar-border bg-sidebar px-3 sm:px-4">
            <Button variant="ghost" size="icon-sm" aria-label="Open menu" onClick={() => setIsMobileMenuOpen(true)} className="text-muted-foreground lg:hidden">
              <Menu />
            </Button>

            <div className="min-w-0 shrink">
              <SocietySwitcher />
            </div>

            {activeItem && (
              <div className="hidden min-w-0 items-center gap-1.5 pl-1 text-sm text-slate-500 sm:flex">
                <span className="text-slate-300 dark:text-slate-600">/</span>
                <span className="truncate text-slate-800 dark:text-slate-200">{activeItem.label}</span>
              </div>
            )}

            {/* Search opens the spotlight palette */}
            <button
              type="button"
              onClick={() => setIsSpotlightOpen(true)}
              aria-label="Search"
              title="Search members, flats, invoices, complaints"
              className="ml-auto hidden h-8 w-full min-w-0 max-w-sm cursor-text items-center gap-2 rounded-md border border-transparent bg-background px-3 text-left text-sm text-muted-foreground transition-colors hover:border-input md:flex"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">Search</span>
              <kbd className="shrink-0 rounded border bg-muted px-1.5 text-[10px] text-muted-foreground">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
            </button>
            <Button variant="ghost" size="icon-sm" aria-label="Search" onClick={() => setIsSpotlightOpen(true)} className="ml-auto shrink-0 text-muted-foreground md:ml-0 md:hidden">
              <Search />
            </Button>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              className="hidden text-muted-foreground sm:inline-flex"
            >
              {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>

            {/* Notifications */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Notifications" title="Notifications" className="relative text-muted-foreground">
                    <Bell />
                    {unreadCount > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-semibold text-white">
                        {unreadCount}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[22rem] max-w-[calc(100vw-1rem)] p-0">
                  <div className="flex items-center justify-between border-b px-3 py-2">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      Notifications
                      {unreadCount > 0 && <span className="rounded-sm bg-red-50 px-1.5 text-[11px] text-red-700 dark:bg-red-950/50 dark:text-red-300">{unreadCount} new</span>}
                    </span>
                    <span className="flex items-center gap-0.5">
                      {isManagementRole && (
                        <Button variant="ghost" size="icon-xs" onClick={handleRunSweep} disabled={isSweeping} title="Run dues reminder sweep" className="text-muted-foreground">
                          <RefreshCw className={cn(isSweeping && 'animate-spin')} />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon-xs" onClick={handleMarkAllRead} title="Mark all as read" className="text-muted-foreground">
                        <CheckCheck />
                      </Button>
                    </span>
                  </div>
                  <div className="custom-scrollbar max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">No notifications</p>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className={cn('flex items-start gap-2 border-b px-3 py-2.5 last:border-b-0', n.status !== 'READ' && 'bg-brand-50/60 dark:bg-brand-950/30')}>
                          <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', n.status === 'READ' ? 'bg-transparent' : 'bg-brand-500')} />
                          <div className="min-w-0 flex-1">
                            <p className={cn('text-sm', n.status === 'READ' ? 'text-slate-500' : 'font-medium text-slate-900 dark:text-slate-100')}>{n.title}</p>
                            <p className="text-xs leading-relaxed text-slate-500">{n.body}</p>
                            <span className="mt-0.5 block text-[11px] text-slate-400">
                              {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                          {n.status !== 'READ' && (
                            <Button variant="ghost" size="icon-xs" onClick={() => handleMarkAsRead(n.id)} title="Mark read" className="text-muted-foreground hover:text-emerald-600">
                              <Check />
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Signed-in user */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Account menu for ${displayName}`}
                    title={displayName}
                    className="ml-1 rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">{initials}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="flex items-center gap-2.5 font-normal">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">{initials}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-900 dark:text-slate-100">{displayName}</span>
                      <span className="block truncate text-xs text-slate-500">{formatRole(userRole)}</span>
                      {user.email && <span className="block truncate text-xs text-slate-400">{user.email}</span>}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setIsProfileModalOpen(true)}>
                    <UserIcon />
                    My profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setIsPasswordModalOpen(true)}>
                    <Key />
                    Change password
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={toggleTheme}>
                    {theme === 'dark' ? <Sun /> : <Moon />}
                    {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => signOut()}>
                    <LogOut />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <DefaultSocietyModal />
          </header>

          <div className="w-full flex-1">{children}</div>
        </div>

        {/* My profile */}
        <Dialog
          open={isProfileModalOpen}
          onOpenChange={(open: boolean) => {
            setIsProfileModalOpen(open);
            if (!open) setProfileMessage(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>My profile</DialogTitle>
              <DialogDescription>Your name and phone number as shown to the society.</DialogDescription>
            </DialogHeader>
            {message(profileMessage)}
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="flex items-center gap-3 rounded-md border bg-muted/40 p-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white">{initials}</span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{displayName}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" /> {user?.email}
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-name">Full name *</Label>
                <Input id="profile-name" required value={profileName} onChange={(e) => setProfileName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-mobile">Mobile phone</Label>
                <Input id="profile-mobile" placeholder="e.g. 9876543210" value={profileMobile} onChange={(e) => setProfileMobile(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Active society and role</Label>
                <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  <span>{activeSociety?.societyName || 'Active society'}</span>
                  <span className="text-muted-foreground">{formatRole(userRole)}</span>
                </div>
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setIsProfileModalOpen(false)}>
                  Close
                </Button>
                <Button type="submit" disabled={isUpdatingProfile}>
                  {isUpdatingProfile ? 'Saving…' : 'Save profile'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Change password */}
        <Dialog open={isPasswordModalOpen} onOpenChange={(open: boolean) => (open ? setIsPasswordModalOpen(true) : closePasswordModal())}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Change password</DialogTitle>
              <DialogDescription>
                At least 6 characters, for <span className="text-foreground">{user?.email}</span>.
              </DialogDescription>
            </DialogHeader>
            {message(passwordMessage)}
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New password *</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm new password *</Label>
                <Input
                  id="confirm-password"
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={closePasswordModal}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isUpdatingPassword}>
                  {isUpdatingPassword ? 'Updating…' : 'Update password'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <SpotlightSearch isOpen={isSpotlightOpen} onClose={() => setIsSpotlightOpen(false)} />
      </div>
    </TooltipProvider>
  );
};

export const AppLayout = Navbar;
