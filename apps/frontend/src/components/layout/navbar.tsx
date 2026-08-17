'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { useAuth } from '../../app/providers/auth-context';
import { SocietySwitcher } from './society-switcher';
import { DefaultSocietyModal } from './default-society-modal';
import { apiClient } from '../../lib/api/client';
import { 
  Building, 
  Users, 
  CreditCard, 
  Receipt, 
  BookOpen, 
  Home, 
  MessageSquare, 
  Box, 
  BarChart2, 
  Bot,
  Menu, 
  Settings, 
  ShieldCheck, 
  LogOut,
  User as UserIcon,
  Sun,
  Moon,
  LayoutDashboard,
  Bell,
  Check,
  CheckCheck,
  RefreshCw,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Key,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  Mail,
  Phone,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles
} from 'lucide-react';
import { useTheme } from '../../app/providers/theme-context';

interface NavItem {
  label: string;
  href: (slug: string) => string;
  icon: React.ReactNode;
  permission?: string;
  superAdminOnly?: boolean;
}

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  channel: string;
  status: string;
  createdAt: string;
}

interface AppLayoutProps {
  children?: React.ReactNode;
}

export const Navbar: React.FC<AppLayoutProps> = ({ children }) => {
  const { user, activeSociety, memberships, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const params = useParams();
  const pathname = usePathname();
  const societySlug = (params?.society_slug as string) || activeSociety?.societySlug || '';

  const userPermissions = activeSociety?.permissions || [];
  const userRole = activeSociety?.role || '';
  const isSuperAdmin = userRole === 'SUPER_ADMIN';
  const isManagementRole = ['SUPER_ADMIN', 'PRESIDENT', 'SECRETARY', 'TREASURER', 'ACCOUNTANT'].includes(userRole);

  const [mounted, setMounted] = useState<boolean>(false);

  // Left Sidebar Collapsed state (persisted in localStorage)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Tooltip hover states for collapsed sidebar
  const [hoveredNavItem, setHoveredNavItem] = useState<{ label: string; top: number } | null>(null);
  const [hoveredSociety, setHoveredSociety] = useState<{ name: string; role: string; top: number } | null>(null);

  // Notification state
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);
  const [isSweeping, setIsSweeping] = useState<boolean>(false);

  // User Profile Menu & Dialog States
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<boolean>(false);
  
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  // Profile Form State
  const [profileName, setProfileName] = useState<string>((user as any)?.name || '');
  const [profileMobile, setProfileMobile] = useState<string>((user as any)?.mobile || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState<boolean>(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password Form State
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState<boolean>(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setMounted(true);
    // Load persisted collapse state
    try {
      const savedState = localStorage.getItem('housive_sidebar_collapsed');
      if (savedState !== null) {
        setIsCollapsed(savedState === 'true');
      }
    } catch (e) {
      // localStorage may not be available
    }
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('housive_sidebar_collapsed', String(next));
      } catch (e) {}
      return next;
    });
  };

  // Update profile form state on user change
  useEffect(() => {
    if (user) {
      setProfileName((user as any)?.name || '');
      setProfileMobile((user as any)?.mobile || '');
    }
  }, [user]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    } catch (err) {
      alert('Failed to dispatch dues reminder sweep.');
    } finally {
      setIsSweeping(false);
    }
  };

  // Handle Profile Update
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    setProfileMessage(null);

    try {
      const res = await apiClient.patch('/users/me/profile', {
        name: profileName,
        mobile: profileMobile,
      });

      if (res.data?.success) {
        setProfileMessage({ type: 'success', text: 'Profile details updated successfully.' });
        setTimeout(() => {
          setIsProfileModalOpen(false);
          setProfileMessage(null);
        }, 1200);
      }
    } catch (err: any) {
      setProfileMessage({ 
        type: 'error', 
        text: err.response?.data?.message || 'Failed to update profile.' 
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Handle Change Password
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
      const res = await apiClient.post('/users/me/change-password', {
        newPassword,
      });

      if (res.data?.success) {
        setPasswordMessage({ type: 'success', text: 'Password changed successfully.' });
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          setIsPasswordModalOpen(false);
          setPasswordMessage(null);
        }, 1500);
      }
    } catch (err: any) {
      setPasswordMessage({ 
        type: 'error', 
        text: err.response?.data?.message || 'Failed to change password.' 
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Navigation Items defined with required permission check
  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      href: (slug) => `/${slug}/dashboard`,
      icon: <LayoutDashboard className="h-4 w-4 shrink-0" />,
    },
    {
      label: 'Flats',
      href: (slug) => `/${slug}/flats`,
      icon: <Building className="h-4 w-4 shrink-0" />,
      permission: 'flat:read',
    },
    {
      label: 'Members',
      href: (slug) => `/${slug}/members`,
      icon: <Users className="h-4 w-4 shrink-0" />,
      permission: 'member:read',
    },
    {
      label: 'Maintenance',
      href: (slug) => `/${slug}/maintenance`,
      icon: <CreditCard className="h-4 w-4 shrink-0" />,
      permission: 'billing:read',
    },
    {
      label: 'Payments',
      href: (slug) => `/${slug}/payments`,
      icon: <Receipt className="h-4 w-4 shrink-0" />,
      permission: 'billing:read',
    },
    {
      label: 'Accounting',
      href: (slug) => `/${slug}/accounting`,
      icon: <BookOpen className="h-4 w-4 shrink-0" />,
      permission: 'accounting:read',
    },
    {
      label: 'Resident Portal',
      href: (slug) => `/${slug}/resident`,
      icon: <Home className="h-4 w-4 shrink-0" />,
      permission: 'resident:read',
    },
    {
      label: 'Complaints',
      href: (slug) => `/${slug}/complaints`,
      icon: <MessageSquare className="h-4 w-4 shrink-0" />,
    },
    {
      label: 'Assets',
      href: (slug) => `/${slug}/assets`,
      icon: <Box className="h-4 w-4 shrink-0" />,
      permission: 'society:read',
    },
    {
      label: 'Reports',
      href: (slug) => `/${slug}/reports`,
      icon: <BarChart2 className="h-4 w-4 shrink-0" />,
      permission: 'accounting:read',
    },
    {
      label: 'AI Assistant',
      href: (slug) => `/${slug}/ai-assistant`,
      icon: <Bot className="h-4 w-4 shrink-0" />,
    },
    {
      label: 'Society Settings',
      href: (slug) => `/${slug}/profile`,
      icon: <Settings className="h-4 w-4 shrink-0" />,
      permission: 'society:write',
    },
    {
      label: 'Platform Admin',
      href: () => '/admin',
      icon: <ShieldCheck className="h-4 w-4 shrink-0" />,
      superAdminOnly: true,
    },
  ];

  // Filter navigation items based on active society user role & permissions
  const visibleNavItems = navItems.filter((item) => {
    if (item.superAdminOnly) {
      return isSuperAdmin;
    }
    // Super Admin, President, Secretary have complete visibility
    if (['SUPER_ADMIN', 'PRESIDENT', 'SECRETARY', 'SOCIETY_ADMIN'].includes(userRole)) {
      return true;
    }
    // Accountant: financial and operational bookkeeping scope
    if (userRole === 'ACCOUNTANT') {
      return ['Dashboard', 'Maintenance', 'Payments', 'Accounting', 'Reports', 'Flats', 'Members', 'Complaints', 'AI Assistant'].includes(item.label);
    }
    // Treasurer: finance and budget management
    if (userRole === 'TREASURER') {
      return ['Dashboard', 'Maintenance', 'Payments', 'Accounting', 'Reports', 'Flats', 'Members', 'Complaints', 'AI Assistant'].includes(item.label);
    }
    // Auditor: audit books, reports, registers
    if (userRole === 'AUDITOR') {
      return ['Dashboard', 'Accounting', 'Reports', 'Flats', 'Members', 'Complaints'].includes(item.label);
    }
    // Facility & Maintenance Leads
    if (['ESTATE_MANAGER', 'MAINTENANCE_INCHARGE'].includes(userRole)) {
      return ['Dashboard', 'Assets', 'Complaints', 'Flats', 'Maintenance', 'Reports', 'AI Assistant'].includes(item.label);
    }
    // Security Head
    if (userRole === 'SECURITY_SUPERVISOR') {
      return ['Dashboard', 'Flats', 'Resident Portal', 'Complaints'].includes(item.label);
    }
    // Committee Members
    if (['COMMITTEE_MEMBER', 'VICE_PRESIDENT', 'JOINT_SECRETARY', 'CULTURAL_SECRETARY', 'LEGAL_ADVISOR'].includes(userRole)) {
      return ['Dashboard', 'Members', 'Flats', 'Maintenance', 'Payments', 'Assets', 'Complaints', 'Reports', 'AI Assistant'].includes(item.label);
    }
    // Non-Committee General Residents (Owner, Tenant, Family)
    if (['OWNER', 'CO_OWNER', 'TENANT', 'FAMILY_MEMBER', 'MEMBER'].includes(userRole) || !userRole) {
      return ['Dashboard', 'Resident Portal', 'Maintenance', 'Payments', 'Complaints', 'AI Assistant'].includes(item.label);
    }
    if (!item.permission) {
      return true;
    }
    return userPermissions.includes(item.permission);
  });

  const displayName = (user as any)?.name || user?.email?.split('@')[0] || 'User';
  const displayInitial = (displayName[0] || 'U').toUpperCase();

  // Find active nav item title for top bar display
  const activeNavItem = visibleNavItems.find((item) => {
    const targetHref = item.href(societySlug);
    return pathname === targetHref || (targetHref !== `/${societySlug}` && pathname?.startsWith(targetHref + '/'));
  });

  const sidebarContent = (
    <div className="flex flex-col h-full select-none">
      {/* Sidebar Header: Brand & Collapse Toggle */}
      <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} h-16 px-4 border-b border-slate-200 dark:border-slate-800/80 shrink-0 transition-all`}>
        <Link 
          href={societySlug ? `/${societySlug}/dashboard` : '/'} 
          className="flex items-center gap-3 overflow-hidden group focus:outline-none"
          title="Housive Home"
        >
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-black text-base flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform">
            H
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                Housive
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate -mt-0.5">
                Society Platform
              </span>
            </div>
          )}
        </Link>

        {!isCollapsed && (
          <button
            onClick={toggleSidebar}
            title="Collapse sidebar to icons"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors focus:outline-none"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Society Mini Info (When expanded) */}
      {!isCollapsed && activeSociety && (
        <div className="px-3 pt-3 pb-1 shrink-0">
          <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/40">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Building className="h-3.5 w-3.5" />
              </div>
              <div className="overflow-hidden min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {activeSociety.societyName}
                </p>
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold uppercase tracking-wider truncate">
                  {userRole.replace('_', ' ') || 'Resident'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed Society Icon */}
      {isCollapsed && activeSociety && (
        <div className="py-2.5 px-2 flex justify-center shrink-0">
          <div 
            onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setHoveredSociety({ 
                name: activeSociety.societyName, 
                role: userRole.replace('_', ' ') || 'Resident', 
                top: rect.top + rect.height / 2 
              });
            }}
            onMouseLeave={() => setHoveredSociety(null)}
            className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Building className="h-4 w-4" />
          </div>
        </div>
      )}

      {/* Navigation Items - Scrollable List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-1.5 custom-scrollbar">
        {visibleNavItems.map((item) => {
          const targetHref = item.href(societySlug);
          const isActive = pathname === targetHref || pathname?.startsWith(targetHref + '/');

          return (
            <div key={item.label} className="relative">
              <Link
                href={targetHref}
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setHoveredNavItem(null);
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  if (isCollapsed) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoveredNavItem({ label: item.label, top: rect.top + rect.height / 2 });
                  }
                }}
                onMouseLeave={() => setHoveredNavItem(null)}
                className={`flex items-center ${isCollapsed ? 'justify-center h-10 w-10 mx-auto' : 'px-3 py-2.5 gap-3 w-full'} rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 dark:bg-indigo-600 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900/70 border border-transparent'
                }`}
              >
                <div className={`${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'} transition-colors`}>
                  {item.icon}
                </div>

                {!isCollapsed && (
                  <span className="truncate flex-1 tracking-tight text-left">
                    {item.label}
                  </span>
                )}
              </Link>
            </div>
          );
        })}
      </div>

      {/* Sidebar Footer: Expand button (when collapsed) or collapse toggle footer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 shrink-0">
        {isCollapsed ? (
          <button
            onClick={toggleSidebar}
            title="Expand sidebar"
            className="h-10 w-10 mx-auto flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 transition-colors focus:outline-none"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900/60 border border-transparent transition-colors focus:outline-none"
          >
            <span className="flex items-center gap-2">
              <PanelLeftClose className="h-4 w-4 text-slate-400" />
              <span>Collapse Menu</span>
            </span>
            <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded font-mono">
              Icons
            </span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-row">
      {/* ========================================================================= */}
      {/* 1. DESKTOP LEFT SIDEBAR (STICKY, COLLAPSIBLE TO ICONS ONLY)              */}
      {/* ========================================================================= */}
      <aside 
        className={`hidden lg:flex flex-col sticky top-0 h-screen z-30 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#030712] backdrop-blur-xl transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* ========================================================================= */}
      {/* 2. MOBILE DRAWER OVERLAY (SLIDE-OUT FROM LEFT)                           */}
      {/* ========================================================================= */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity animate-in fade-in"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-72 max-w-[80vw] h-full bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 z-10 flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            {/* Header with Close button */}
            <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200 dark:border-slate-800">
              <Link 
                href={societySlug ? `/${societySlug}/dashboard` : '/'} 
                className="flex items-center gap-3 overflow-hidden"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white font-black text-base flex items-center justify-center shrink-0">
                  H
                </div>
                <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                  Housive
                </span>
              </Link>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Mobile Nav Links */}
            <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
              {visibleNavItems.map((item) => {
                const targetHref = item.href(societySlug);
                const isActive = pathname === targetHref || pathname?.startsWith(targetHref + '/');

                return (
                  <Link
                    key={item.label}
                    href={targetHref}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900'
                    }`}
                  >
                    <div className={isActive ? 'text-white' : 'text-slate-400'}>
                      {item.icon}
                    </div>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Mobile Footer */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-900">
                <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {displayInitial}
                </div>
                <div className="overflow-hidden min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{displayName}</p>
                  <p className="text-[10px] text-indigo-500 uppercase font-semibold">{userRole.replace('_', ' ') || 'Resident'}</p>
                </div>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    signOut();
                  }}
                  title="Sign out"
                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MAIN AREA: STICKY TOP HEADER BAR + PAGE CONTENT                       */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 w-full border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-[#030712]/90 backdrop-blur-xl transition-colors">
          <div className="w-full px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between gap-4">
            
            {/* Left: Mobile Toggle & Society Switcher & Active Section */}
            <div className="flex items-center gap-3">
              {/* Mobile Drawer Trigger (visible < lg) */}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all focus:outline-none"
                title="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
              </button>

              {/* Society Switcher Dropdown */}
              <SocietySwitcher />

              {/* Breadcrumb / Active Page Title */}
              {activeNavItem && (
                <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span>/</span>
                  <span className="text-slate-800 dark:text-slate-200 font-bold">{activeNavItem.label}</span>
                </div>
              )}
            </div>

            {/* Right: Theme Toggle, Notifications, User Profile Menu */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              {/* Day / Night Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Switch to Day Mode' : 'Switch to Night Mode'}
                className="flex items-center justify-center p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-amber-500 dark:text-amber-400 transition-all focus:outline-none"
              >
                {theme === 'dark' ? (
                  <Sun className="h-4 w-4 text-amber-400" />
                ) : (
                  <Moon className="h-4 w-4 text-indigo-600" />
                )}
              </button>

              {/* Real-time Notification Bell */}
              {user && (
                <div className="relative" ref={notifMenuRef}>
                  <button
                    onClick={() => setIsNotifOpen(!isNotifOpen)}
                    className="relative flex items-center justify-center p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all focus:outline-none"
                    title="Notifications"
                  >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-black text-white shadow-sm">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notification Popover Drawer */}
                  {isNotifOpen && (
                    <div className="notif-popover absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl p-4 z-50 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                        <div className="flex items-center gap-2">
                          <Bell className="h-4 w-4 text-indigo-400" />
                          <span className="font-bold text-sm text-slate-900 dark:text-slate-100">Notifications</span>
                          {unreadCount > 0 && (
                            <span className="bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                              {unreadCount} new
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {isManagementRole && (
                            <button
                              onClick={handleRunSweep}
                              disabled={isSweeping}
                              title="Run Dues Reminder Sweep"
                              className="p-1 rounded text-slate-400 hover:text-indigo-400 transition-colors"
                            >
                              <RefreshCw className={`h-3.5 w-3.5 ${isSweeping ? 'animate-spin' : ''}`} />
                            </button>
                          )}
                          <button
                            onClick={handleMarkAllRead}
                            title="Mark all as read"
                            className="p-1 rounded text-slate-400 hover:text-emerald-400 transition-colors"
                          >
                            <CheckCheck className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                        {notifications.length === 0 ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">No notifications</p>
                        ) : (
                          notifications.map((n) => (
                            <div
                              key={n.id}
                              className={`p-3 rounded-xl border text-xs space-y-1 transition-all flex items-start justify-between gap-2 ${
                                n.status === 'READ'
                                  ? 'border-slate-200 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/30 text-slate-400'
                                  : 'border-indigo-500/30 bg-indigo-50/40 dark:bg-indigo-950/20 text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              <div>
                                <p className="font-semibold text-slate-900 dark:text-slate-100">{n.title}</p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{n.body}</p>
                                <span className="notif-time text-[9px] text-slate-400 mt-1 block">
                                  {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                </span>
                              </div>
                              {n.status !== 'READ' && (
                                <button
                                  onClick={() => handleMarkAsRead(n.id)}
                                  title="Mark read"
                                  className="text-slate-400 hover:text-emerald-500 p-1 shrink-0"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* User Profile Dropdown Menu Trigger */}
              {user && (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                    className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-left group focus:outline-none"
                  >
                    {/* Avatar Badge */}
                    <div className="h-7 w-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                      {displayInitial}
                    </div>

                    {/* Name & Role Text */}
                    <div className="hidden md:flex flex-col pr-1">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[130px]">
                        {displayName}
                      </span>
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">
                        {userRole.replace('_', ' ') || 'Resident'}
                      </span>
                    </div>

                    <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Profile Submenu Dropdown */}
                  {isProfileMenuOpen && (
                    <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl p-2 z-50 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
                      
                      {/* User Profile Header Card */}
                      <div className="px-3 py-2.5 bg-slate-50 dark:bg-slate-900/70 border border-slate-100 dark:border-slate-800/80 rounded-xl mb-1 space-y-1">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {displayInitial}
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{displayName}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                          </div>
                        </div>
                        <div className="pt-1 flex items-center gap-1.5">
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 uppercase">
                            {userRole.replace('_', ' ') || 'Resident'}
                          </span>
                        </div>
                      </div>

                      {/* Option 1: Profile Option */}
                      <button
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          setIsProfileModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg transition-colors text-left"
                      >
                        <UserIcon className="h-4 w-4 text-indigo-400" />
                        <span>My Profile</span>
                      </button>

                      {/* Option 2: Change Password Option */}
                      <button
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          setIsPasswordModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg transition-colors text-left"
                      >
                        <Key className="h-4 w-4 text-amber-400" />
                        <span>Change Password</span>
                      </button>

                      <div className="border-t border-slate-100 dark:border-slate-800 my-1" />

                      {/* Option 3: Logout Button */}
                      <button
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          signOut();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors text-left"
                      >
                        <LogOut className="h-4 w-4 text-red-500" />
                        <span>Sign Out / Log Out</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Default Society Selection Prompt Modal for multi-society users */}
          <DefaultSocietyModal />
        </header>

        {/* Children (Page Content Area) */}
        <div className="flex-1 w-full">
          {children}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PORTALED MODAL 1: MY PROFILE DIALOG (MOUNTED DIRECTLY TO DOCUMENT.BODY)  */}
      {/* ========================================================================= */}
      {mounted && isProfileModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity" 
            onClick={() => {
              setIsProfileModalOpen(false);
              setProfileMessage(null);
            }}
          />

          {/* Dialog Container */}
          <div className="relative w-full max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto z-10 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-indigo-500" /> User Profile & Details
              </h3>
              <button
                onClick={() => {
                  setIsProfileModalOpen(false);
                  setProfileMessage(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {profileMessage && (
              <div
                className={`rounded-lg border p-3 text-xs flex items-center gap-2 ${
                  profileMessage.type === 'success'
                    ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400'
                    : 'bg-red-950/30 border-red-900/50 text-red-400'
                }`}
              >
                {profileMessage.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                {profileMessage.text}
              </div>
            )}

            <form onSubmit={handleProfileSubmit} className="space-y-4 text-xs">
              {/* User Avatar Circle Card */}
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
                <div className="h-12 w-12 rounded-xl bg-indigo-600 text-white font-black text-lg flex items-center justify-center shadow">
                  {displayInitial}
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{displayName}</p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {user?.email}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold">Full Name *</label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full mt-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2.5 px-3.5 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold">Mobile Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210"
                  value={profileMobile}
                  onChange={(e) => setProfileMobile(e.target.value)}
                  className="w-full mt-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2.5 px-3.5 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold">Active Society & Role</label>
                <div className="mt-1 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 flex items-center justify-between text-xs font-mono">
                  <span>{activeSociety?.societyName || 'Active Society'}</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                    {userRole.replace('_', ' ') || 'Resident'}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileModalOpen(false);
                    setProfileMessage(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 font-medium"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold disabled:opacity-50 transition-all shadow"
                >
                  {isUpdatingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* PORTALED MODAL 2: CHANGE PASSWORD (MOUNTED DIRECTLY TO DOCUMENT.BODY)    */}
      {/* ========================================================================= */}
      {mounted && isPasswordModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity" 
            onClick={() => {
              setIsPasswordModalOpen(false);
              setPasswordMessage(null);
              setNewPassword('');
              setConfirmPassword('');
            }}
          />

          {/* Dialog Container */}
          <div className="relative w-full max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto z-10 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Key className="h-5 w-5 text-amber-500" /> Change Login Password
              </h3>
              <button
                onClick={() => {
                  setIsPasswordModalOpen(false);
                  setPasswordMessage(null);
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {passwordMessage && (
              <div
                className={`rounded-lg border p-3 text-xs flex items-center gap-2 ${
                  passwordMessage.type === 'success'
                    ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400'
                    : 'bg-red-950/30 border-red-900/50 text-red-400'
                }`}
              >
                {passwordMessage.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                {passwordMessage.text}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4 text-xs">
              <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                Set a secure password of at least 6 characters for your account (<strong>{user?.email}</strong>).
              </p>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold">New Password *</label>
                <div className="relative mt-1">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2.5 pl-3.5 pr-10 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold">Confirm New Password *</label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full mt-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2.5 px-3.5 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsPasswordModalOpen(false);
                    setPasswordMessage(null);
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold disabled:opacity-50 transition-all shadow"
                >
                  {isUpdatingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      {/* ========================================================================= */}
      {/* PORTALED TOOLTIPS FOR COLLAPSED SIDEBAR (NEVER CLIPPED BY SCROLLBARS)   */}
      {/* ========================================================================= */}
      {mounted && isCollapsed && hoveredNavItem && createPortal(
        <div 
          className="fixed z-[99999] pointer-events-none px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold shadow-2xl border border-slate-700/80 whitespace-nowrap flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-75"
          style={{
            left: '84px',
            top: `${hoveredNavItem.top}px`,
            transform: 'translateY(-50%)'
          }}
        >
          <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-900 border-l border-b border-slate-700/80 rotate-45" />
          <span>{hoveredNavItem.label}</span>
        </div>,
        document.body
      )}

      {mounted && isCollapsed && hoveredSociety && createPortal(
        <div 
          className="fixed z-[99999] pointer-events-none px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs shadow-2xl border border-slate-700/80 whitespace-nowrap space-y-0.5 animate-in fade-in zoom-in-95 duration-75"
          style={{
            left: '84px',
            top: `${hoveredSociety.top}px`,
            transform: 'translateY(-50%)'
          }}
        >
          <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-900 border-l border-b border-slate-700/80 rotate-45" />
          <p className="font-bold text-slate-100">{hoveredSociety.name}</p>
          <p className="text-[10px] text-indigo-400 font-semibold uppercase">{hoveredSociety.role}</p>
        </div>,
        document.body
      )}
    </div>
  );
};

export const AppLayout = Navbar;
