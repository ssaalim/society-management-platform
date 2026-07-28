'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { useAuth } from '../../app/providers/auth-context';
import { SocietySwitcher } from './society-switcher';
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
  X
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

  // Notification state
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);
  const [isSweeping, setIsSweeping] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

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

  // Filter navigation items based on active society user permissions
  const visibleNavItems = navItems.filter((item) => {
    if (item.superAdminOnly) {
      return isSuperAdmin;
    }
    if (!item.permission) {
      return true;
    }
    return userPermissions.includes(item.permission);
  });

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/80 backdrop-blur-xl transition-colors">
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
            className="flex items-center justify-center p-2 rounded-lg border border-slate-200 dark:border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-amber-500 dark:text-amber-400 transition-all"
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
                className="relative flex items-center justify-center p-2 rounded-lg border border-slate-200 dark:border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all"
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
                <div className="notif-popover absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 dark:border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-4 z-50 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200">Notifications</h4>
                      {unreadCount > 0 && (
                        <span className="text-[10px] font-bold bg-indigo-950/60 text-indigo-400 border border-indigo-900/50 px-2 py-0.5 rounded-full">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllRead}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                        >
                          <CheckCheck className="h-3 w-3" /> Mark all read
                        </button>
                      )}
                      <button onClick={() => setIsNotifOpen(false)} className="text-slate-500 hover:text-slate-300">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Actions Bar for Board & Accountant */}
                  {isManagementRole && (
                    <button
                      onClick={handleRunSweep}
                      disabled={isSweeping}
                      className="w-full text-center py-1.5 px-3 rounded-lg border border-amber-900/50 bg-amber-950/30 text-amber-400 hover:bg-amber-900/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <RefreshCw className={`h-3 w-3 ${isSweeping ? 'animate-spin' : ''}`} />
                      Dispatch Defaulters Dues Sweep
                    </button>
                  )}

                  {/* Notifications Feed */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/40 space-y-1">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-6">No notifications</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`notif-tile p-2.5 rounded-lg transition-colors flex items-start justify-between gap-2 border ${
                            n.status !== 'READ' ? 'notif-unread bg-slate-800/30 border-l-4 border-indigo-500' : 'border-transparent opacity-75'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="notif-title text-xs font-semibold text-slate-900 dark:text-slate-200">{n.title || 'Notification'}</p>
                            <p className="notif-body text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{n.body}</p>
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

          {user && (
            <div className="flex items-center gap-3">
              {/* User Identity Pill */}
              <div className="hidden md:flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-200">{(user as any).name || user.email}</span>
                <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">
                  {userRole.replace('_', ' ')}
                </span>
              </div>

              {/* Sign Out Button */}
              <button
                onClick={signOut}
                title="Sign Out"
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-900/60 p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-200 hover:bg-slate-800 transition-all text-xs font-medium"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
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
              Welcome, {user ? ((user as any).name || user.email || 'User') : 'User'}
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
    </header>
  );
};
