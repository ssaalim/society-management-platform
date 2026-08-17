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
  Key,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  Mail,
  Phone
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

export const Navbar: React.FC = () => {
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

  // Notification state
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);
  const [isSweeping, setIsSweeping] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // User Profile Menu & Dialog States
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<boolean>(false);
  
  const userMenuRef = useRef<HTMLDivElement>(null);

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
  }, []);

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
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    if (!user || !activeSociety) return;
    try {
      const res = await apiClient.get('/notifications/my-notifications');
      if (res.data?.success) {
        setNotifications(res.data.data.list || []);
        setUnreadCount(res.data.data.unreadCount || 0);
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
        alert(`Dues reminder sweep dispatched to ${res.data.data.count} resident accounts!`);
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
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      label: 'Flats',
      href: (slug) => `/${slug}/flats`,
      icon: <Building className="h-4 w-4" />,
      permission: 'flat:read',
    },
    {
      label: 'Members',
      href: (slug) => `/${slug}/members`,
      icon: <Users className="h-4 w-4" />,
      permission: 'member:read',
    },
    {
      label: 'Maintenance',
      href: (slug) => `/${slug}/maintenance`,
      icon: <CreditCard className="h-4 w-4" />,
      permission: 'billing:read',
    },
    {
      label: 'Payments',
      href: (slug) => `/${slug}/payments`,
      icon: <Receipt className="h-4 w-4" />,
      permission: 'billing:read',
    },
    {
      label: 'Accounting',
      href: (slug) => `/${slug}/accounting`,
      icon: <BookOpen className="h-4 w-4" />,
      permission: 'accounting:read',
    },
    {
      label: 'Resident Portal',
      href: (slug) => `/${slug}/resident`,
      icon: <Home className="h-4 w-4" />,
      permission: 'resident:read',
    },
    {
      label: 'Complaints',
      href: (slug) => `/${slug}/complaints`,
      icon: <MessageSquare className="h-4 w-4" />,
    },
    {
      label: 'Assets',
      href: (slug) => `/${slug}/assets`,
      icon: <Box className="h-4 w-4" />,
      permission: 'society:read',
    },
    {
      label: 'Reports',
      href: (slug) => `/${slug}/reports`,
      icon: <BarChart2 className="h-4 w-4" />,
      permission: 'accounting:read',
    },
    {
      label: 'AI Assistant',
      href: (slug) => `/${slug}/ai-assistant`,
      icon: <Bot className="h-4 w-4" />,
    },
    {
      label: 'Society Settings',
      href: (slug) => `/${slug}/profile`,
      icon: <Settings className="h-4 w-4" />,
      permission: 'society:write',
    },
    {
      label: 'Platform Admin',
      href: () => '/admin',
      icon: <ShieldCheck className="h-4 w-4" />,
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

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/80 backdrop-blur-xl transition-colors">
        {/* Top Header Row */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between gap-4">
          
          {/* Brand & Society Switcher */}
          <div className="flex items-center gap-3 sm:gap-6">
            <Link href="/" className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-extrabold text-sm shrink-0">
                H
              </div>
              <span className="hidden lg:inline-block text-base tracking-tight">Housive</span>
            </Link>

            {/* Tenant Scope Dropdown */}
            <SocietySwitcher />
          </div>

          {/* User Info & Actions */}
          <div className="flex items-center gap-3">
            {/* Day / Night Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Day Mode' : 'Switch to Night Mode'}
              className="flex items-center justify-center p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-amber-500 dark:text-amber-400 transition-all"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-indigo-600" />
              )}
            </button>

            {/* Real-time Notification Bell */}
            {user && (
              <div className="relative">
                <button
                  onClick={() => setIsNotifOpen(!isNotifOpen)}
                  className="relative flex items-center justify-center p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all"
                  title="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-black text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Notification Popover Drawer */}
                {isNotifOpen && (
                  <div className="notif-popover absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-4 z-50 space-y-3">
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

                    <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                      {notifications.length === 0 ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">No notifications</p>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`p-3 rounded-lg border text-xs space-y-1 transition-all flex items-start justify-between gap-2 ${
                              n.status === 'READ'
                                ? 'border-slate-800/40 bg-slate-950/20 text-slate-400'
                                : 'border-indigo-500/30 bg-indigo-950/20 text-slate-200'
                            }`}
                          >
                            <div>
                              <p className="font-semibold text-slate-100">{n.title}</p>
                              <p className="text-[11px] text-slate-400 leading-relaxed">{n.body}</p>
                              <span className="notif-time text-[9px] text-slate-500 mt-1 block">
                                {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                            {n.status !== 'READ' && (
                              <button
                                onClick={() => handleMarkAsRead(n.id)}
                                title="Mark read"
                                className="text-slate-500 hover:text-emerald-400 p-1 shrink-0"
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

            {/* ========================================== */}
            {/* USER PROFILE DROPDOWN MENU TRIGGER         */}
            {/* ========================================== */}
            {user && (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-left group"
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
                    <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-bold uppercase tracking-wider">
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

        {/* Navigation Menu Bar */}
        {societySlug && (
          <div className="border-t border-slate-200 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-950/40 transition-colors">
            
            {/* Mobile Menu Toggle */}
            <div className="sm:hidden px-4 py-2.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800/60">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Welcome, {displayName}
              </span>
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>

            {/* Nav Items (Vertical on Mobile, Horizontal on Desktop) */}
            <div className={`${isMobileMenuOpen ? 'flex' : 'hidden'} sm:flex flex-col sm:flex-row sm:items-center sm:flex-wrap sm:gap-1 max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-2 sm:py-1`}>
              {visibleNavItems.map((item) => {
                const targetHref = item.href(societySlug);
                const isActive = pathname === targetHref || pathname?.startsWith(targetHref + '/');

                return (
                  <Link
                    key={item.label}
                    href={targetHref}
                    className={`flex items-center gap-3 sm:gap-2 px-4 sm:px-3 py-3 sm:py-2 rounded-lg text-sm sm:text-xs font-medium transition-all w-full sm:w-auto ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-600/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900/60 border border-transparent'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Default Society Selection Prompt Modal for multi-society users */}
        <DefaultSocietyModal />
      </header>

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
    </>
  );
};
