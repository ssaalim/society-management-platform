'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/auth-context';
import { apiClient } from '../../../lib/api/client';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Crown,
  Briefcase,
  UserCheck,
  Calculator,
  Users,
  Home,
  Shield,
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Receipt,
  BookOpen,
  MessageSquare,
  Box,
  Building,
  ArrowRight,
  IndianRupee,
  FileText,
  Calendar,
  Bell,
  ClipboardCheck,
  BarChart3,
  PieChart,
  Wallet,
  Eye,
  X,
  Clock,
  AlertCircle,
} from 'lucide-react';

// ============================================
// Role-specific dashboard configuration
// ============================================

const ROLE_CONFIG: Record<string, { label: string; tagline: string; accent: string; icon: React.ReactNode }> = {
  SUPER_ADMIN: {
    label: 'Platform Control Center',
    tagline: 'Full platform oversight and system administration',
    accent: 'from-red-500/20 to-red-600/5 border-red-500/20',
    icon: <Shield className="h-7 w-7 text-red-400" />,
  },
  PRESIDENT: {
    label: 'President Executive Dashboard',
    tagline: 'Strategic oversight, society governance, and financial approvals',
    accent: 'from-amber-500/20 to-orange-600/5 border-amber-500/20',
    icon: <Crown className="h-7 w-7 text-amber-400" />,
  },
  VICE_PRESIDENT: {
    label: 'Vice President Dashboard',
    tagline: 'Executive committee governance and management support',
    accent: 'from-amber-500/20 to-amber-600/5 border-amber-500/20',
    icon: <Crown className="h-7 w-7 text-amber-400" />,
  },
  SECRETARY: {
    label: 'Secretary Management Dashboard',
    tagline: 'Society operations, member records, and administration',
    accent: 'from-violet-500/20 to-violet-600/5 border-violet-500/20',
    icon: <Briefcase className="h-7 w-7 text-violet-400" />,
  },
  JOINT_SECRETARY: {
    label: 'Joint Secretary Dashboard',
    tagline: 'Society operations, member communication, and meetings',
    accent: 'from-violet-500/20 to-violet-600/5 border-violet-500/20',
    icon: <Briefcase className="h-7 w-7 text-violet-400" />,
  },
  TREASURER: {
    label: 'Treasurer Financial Dashboard',
    tagline: 'Billing, collections, cashflow, and bank accounts',
    accent: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/20',
    icon: <UserCheck className="h-7 w-7 text-emerald-400" />,
  },
  ACCOUNTANT: {
    label: 'Accountant Bookkeeping Center',
    tagline: 'Payment entries, vouchers, ledger reconciliation, and billing sweeps',
    accent: 'from-cyan-500/20 to-cyan-600/5 border-cyan-500/20',
    icon: <Calculator className="h-7 w-7 text-cyan-400" />,
  },
  AUDITOR: {
    label: 'Internal Auditor Portal',
    tagline: 'Financial audit, double-entry verification, and trial balances',
    accent: 'from-purple-500/20 to-purple-600/5 border-purple-500/20',
    icon: <ClipboardCheck className="h-7 w-7 text-purple-400" />,
  },
  COMMITTEE_MEMBER: {
    label: 'Committee Oversight Dashboard',
    tagline: 'Complaints tracking, member oversight, and society resolutions',
    accent: 'from-blue-500/20 to-blue-600/5 border-blue-500/20',
    icon: <Users className="h-7 w-7 text-blue-400" />,
  },
  ESTATE_MANAGER: {
    label: 'Estate & Facility Management',
    tagline: 'Infrastructure maintenance, assets, and service contracts',
    accent: 'from-orange-500/20 to-orange-600/5 border-orange-500/20',
    icon: <Building className="h-7 w-7 text-orange-400" />,
  },
  MAINTENANCE_INCHARGE: {
    label: 'Maintenance & Infrastructure Lead',
    tagline: 'AMC schedules, breakdowns, equipment health, and repairs',
    accent: 'from-yellow-500/20 to-yellow-600/5 border-yellow-500/20',
    icon: <Box className="h-7 w-7 text-yellow-400" />,
  },
  SECURITY_SUPERVISOR: {
    label: 'Security & Gate Operations',
    tagline: 'Visitor verification, access control, and incident reporting',
    accent: 'from-rose-500/20 to-rose-600/5 border-rose-500/20',
    icon: <Shield className="h-7 w-7 text-rose-400" />,
  },
  CULTURAL_SECRETARY: {
    label: 'Cultural & Events Portal',
    tagline: 'Community celebrations, sports tournaments, and club amenities',
    accent: 'from-pink-500/20 to-pink-600/5 border-pink-500/20',
    icon: <Users className="h-7 w-7 text-pink-400" />,
  },
  LEGAL_ADVISOR: {
    label: 'Legal & Compliance Portal',
    tagline: 'Society bye-laws, conveyance, notices, and compliance records',
    accent: 'from-teal-500/20 to-teal-600/5 border-teal-500/20',
    icon: <Briefcase className="h-7 w-7 text-teal-400" />,
  },
  OWNER: {
    label: 'Resident Home Dashboard',
    tagline: 'My flat dues, receipts, complaints, and society notices',
    accent: 'from-sky-500/20 to-sky-600/5 border-sky-500/20',
    icon: <Home className="h-7 w-7 text-sky-400" />,
  },
  CO_OWNER: {
    label: 'Resident Home Dashboard',
    tagline: 'My flat dues, receipts, complaints, and society notices',
    accent: 'from-teal-500/20 to-teal-600/5 border-teal-500/20',
    icon: <Home className="h-7 w-7 text-teal-400" />,
  },
  TENANT: {
    label: 'Tenant Resident Dashboard',
    tagline: 'Your rental unit, dues, complaints, and visitor approvals',
    accent: 'from-teal-500/20 to-teal-600/5 border-teal-500/20',
    icon: <Home className="h-7 w-7 text-teal-400" />,
  },
  FAMILY_MEMBER: {
    label: 'Resident Family Dashboard',
    tagline: 'Community activities, notices, and resident requests',
    accent: 'from-purple-500/20 to-purple-600/5 border-purple-500/20',
    icon: <Home className="h-7 w-7 text-purple-400" />,
  },
};

// ============================================
// KPI Stat Card component
// ============================================
interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  accent?: string;
  colorTheme?: 'emerald' | 'sky' | 'amber' | 'violet' | 'indigo' | 'red' | 'teal' | 'cyan' | 'slate';
}

function StatCard({ label, value, icon, trend, trendLabel, accent, colorTheme = 'slate' }: StatCardProps) {
  const themeClasses: Record<string, { bg: string, text: string, border: string, iconBg: string, label: string }> = {
    emerald: { bg: 'bg-white hover:bg-slate-50 dark:bg-slate-950/30 dark:hover:bg-slate-950/50', border: 'border-emerald-200 dark:border-emerald-900/30', text: 'text-emerald-950 dark:text-slate-100', label: 'text-emerald-700 dark:text-slate-400', iconBg: 'bg-white dark:bg-slate-900/60 border-emerald-200 dark:border-slate-800/40' },
    sky: { bg: 'bg-white hover:bg-slate-50 dark:bg-slate-950/30 dark:hover:bg-slate-950/50', border: 'border-sky-200 dark:border-sky-900/30', text: 'text-sky-950 dark:text-slate-100', label: 'text-sky-700 dark:text-slate-400', iconBg: 'bg-white dark:bg-slate-900/60 border-sky-200 dark:border-slate-800/40' },
    amber: { bg: 'bg-white hover:bg-slate-50 dark:bg-slate-950/30 dark:hover:bg-slate-950/50', border: 'border-amber-200 dark:border-amber-900/30', text: 'text-amber-950 dark:text-slate-100', label: 'text-amber-700 dark:text-slate-400', iconBg: 'bg-white dark:bg-slate-900/60 border-amber-200 dark:border-slate-800/40' },
    violet: { bg: 'bg-white hover:bg-slate-50 dark:bg-slate-950/30 dark:hover:bg-slate-950/50', border: 'border-violet-200 dark:border-violet-900/30', text: 'text-violet-950 dark:text-slate-100', label: 'text-violet-700 dark:text-slate-400', iconBg: 'bg-white dark:bg-slate-900/60 border-violet-200 dark:border-slate-800/40' },
    indigo: { bg: 'bg-white hover:bg-slate-50 dark:bg-slate-950/30 dark:hover:bg-slate-950/50', border: 'border-indigo-200 dark:border-indigo-900/30', text: 'text-indigo-950 dark:text-slate-100', label: 'text-indigo-700 dark:text-slate-400', iconBg: 'bg-white dark:bg-slate-900/60 border-indigo-200 dark:border-slate-800/40' },
    red: { bg: 'bg-white hover:bg-slate-50 dark:bg-slate-950/30 dark:hover:bg-slate-950/50', border: 'border-red-200 dark:border-red-900/30', text: 'text-red-950 dark:text-slate-100', label: 'text-red-700 dark:text-slate-400', iconBg: 'bg-white dark:bg-slate-900/60 border-red-200 dark:border-slate-800/40' },
    cyan: { bg: 'bg-white hover:bg-slate-50 dark:bg-slate-950/30 dark:hover:bg-slate-950/50', border: 'border-cyan-200 dark:border-cyan-900/30', text: 'text-cyan-950 dark:text-slate-100', label: 'text-cyan-700 dark:text-slate-400', iconBg: 'bg-white dark:bg-slate-900/60 border-cyan-200 dark:border-slate-800/40' },
    slate: { bg: 'bg-white hover:bg-slate-50 dark:bg-slate-950/30 dark:hover:bg-slate-950/50', border: 'border-slate-200 dark:border-slate-800', text: 'text-slate-900 dark:text-slate-100', label: 'text-slate-500 dark:text-slate-400', iconBg: 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800/40' },
  };

  const t = themeClasses[colorTheme] || themeClasses.slate;
  const resolvedBorder = accent || t.border;

  return (
    <div className={`rounded-xl border ${resolvedBorder} ${t.bg} shadow-md dark:shadow-none p-5 space-y-3 transition-all hover:shadow-lg`}>
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-bold uppercase tracking-wider ${t.label}`}>{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${t.iconBg}`}>
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-black ${t.text}`}>{value}</span>
        {trend && trendLabel && (
          <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-slate-500'
            }`}>
            {trend === 'up' ? <TrendingUp className="h-3 w-3" /> : trend === 'down' ? <TrendingDown className="h-3 w-3" /> : null}
            {trendLabel}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================
// Quick Action Link component
// ============================================
interface QuickActionProps {
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  accent?: string;
  colorTheme?: 'emerald' | 'sky' | 'amber' | 'violet' | 'indigo' | 'red' | 'teal' | 'cyan' | 'slate';
}

function QuickAction({ label, description, href, icon, accent, colorTheme = 'slate' }: QuickActionProps) {
  const themeClasses: Record<string, { bg: string, text: string, desc: string, border: string, iconBg: string }> = {
    emerald: { bg: 'bg-white hover:bg-slate-50 dark:bg-slate-950/40 dark:hover:bg-slate-950/60', border: 'border-emerald-200 dark:border-emerald-900/30', text: 'text-emerald-950 dark:text-slate-200', desc: 'text-emerald-700/70 dark:text-slate-400', iconBg: 'bg-white dark:bg-slate-900/80 border-emerald-200 dark:border-slate-800/60' },
    sky: { bg: 'bg-white hover:bg-slate-50 dark:bg-slate-950/40 dark:hover:bg-slate-950/60', border: 'border-sky-200 dark:border-sky-900/30', text: 'text-sky-950 dark:text-slate-200', desc: 'text-sky-700/70 dark:text-slate-400', iconBg: 'bg-white dark:bg-slate-900/80 border-sky-200 dark:border-slate-800/60' },
    amber: { bg: 'bg-white hover:bg-slate-50 dark:bg-slate-950/40 dark:hover:bg-slate-950/60', border: 'border-amber-200 dark:border-amber-900/30', text: 'text-amber-950 dark:text-slate-200', desc: 'text-amber-700/70 dark:text-slate-400', iconBg: 'bg-white dark:bg-slate-900/80 border-amber-200 dark:border-slate-800/60' },
    violet: { bg: 'bg-white hover:bg-slate-50 dark:bg-slate-950/40 dark:hover:bg-slate-950/60', border: 'border-violet-200 dark:border-violet-900/30', text: 'text-violet-950 dark:text-slate-200', desc: 'text-violet-700/70 dark:text-slate-400', iconBg: 'bg-white dark:bg-slate-900/80 border-violet-200 dark:border-slate-800/60' },
    indigo: { bg: 'bg-white hover:bg-slate-50 dark:bg-slate-950/40 dark:hover:bg-slate-950/60', border: 'border-indigo-200 dark:border-indigo-900/30', text: 'text-indigo-950 dark:text-slate-200', desc: 'text-indigo-700/70 dark:text-slate-400', iconBg: 'bg-white dark:bg-slate-900/80 border-indigo-200 dark:border-slate-800/60' },
    cyan: { bg: 'bg-white hover:bg-slate-50 dark:bg-slate-950/40 dark:hover:bg-slate-950/60', border: 'border-cyan-200 dark:border-cyan-900/30', text: 'text-cyan-950 dark:text-slate-200', desc: 'text-cyan-700/70 dark:text-slate-400', iconBg: 'bg-white dark:bg-slate-900/80 border-cyan-200 dark:border-slate-800/60' },
    slate: { bg: 'bg-white hover:bg-slate-50 dark:bg-slate-950/40 dark:hover:bg-slate-950/60', border: 'border-slate-200 dark:border-slate-800', text: 'text-slate-900 dark:text-slate-200', desc: 'text-slate-500 dark:text-slate-400', iconBg: 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800/60' },
  };

  const t = themeClasses[colorTheme] || themeClasses.slate;
  const resolvedBorder = accent || t.border;

  return (
    <Link
      href={href}
      className={`group flex items-center gap-4 rounded-xl border ${resolvedBorder} ${t.bg} p-4 transition-all hover:scale-[1.02] shadow-sm hover:shadow-md dark:shadow-none dark:hover:shadow-lg quick-action-tile`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${t.iconBg} quick-action-icon`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className={`text-sm font-semibold transition-colors quick-action-title ${t.text}`}>{label}</h4>
        <p className={`text-[11px] truncate quick-action-desc ${t.desc}`}>{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors shrink-0" />
    </Link>
  );
}

// ============================================
// Recent Activity Item
// ============================================
interface ActivityItem {
  id: string;
  type: string;
  title: string;
  timestamp: string;
  status?: string;
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const statusColors: Record<string, string> = {
    PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50',
    UNPAID: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50',
    OPEN: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50',
    ASSIGNED: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-900/50',
    RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50',
    CLOSED: 'bg-white text-slate-700 border-slate-300 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700/50',
    CLEARED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50',
    OVERDUE: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50',
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-all shadow-sm dark:shadow-none">
      <div className="flex flex-col gap-1 overflow-hidden">
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-200 truncate pr-2">{item.title}</span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400">{item.timestamp}</span>
      </div>
      {item.status && (
        <span className={`text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-wider ${statusColors[item.status.toUpperCase()] || statusColors.OPEN}`}>
          {item.status}
        </span>
      )}
    </div>
  );
}

// ============================================
// Main Dashboard Page
// ============================================
export default function DashboardPage() {
  const { society_slug } = useParams();
  const router = useRouter();
  const { activeSociety, user } = useAuth();
  const userRole = activeSociety?.role || '';
  const slug = society_slug as string;

  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<any>({});
  const [recentBills, setRecentBills] = useState<any[]>([]);
  const [recentComplaints, setRecentComplaints] = useState<any[]>([]);
  const [recentReceipts, setRecentReceipts] = useState<any[]>([]);
  const [societyDuesList, setSocietyDuesList] = useState<any[]>([]);
  const [subscriptionInfo, setSubscriptionInfo] = useState<{
    status?: string;
    planName?: string;
    endDate?: string;
    daysLeft?: number;
  } | null>(null);
  const [registrationExpiry, setRegistrationExpiry] = useState<{
    renewalDate?: string | null;
    daysLeft?: number | null;
    isExpired?: boolean;
    isNearExpiry?: boolean;
    status?: string;
  } | null>(null);

  const config = ROLE_CONFIG[userRole] || ROLE_CONFIG.OWNER;

  useEffect(() => {
    if (!slug) return;
    loadDashboardData();
  }, [slug, userRole]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      // Fetch data in parallel based on role permissions
      const promises: Promise<any>[] = [];
      const permissionSet = new Set(activeSociety?.permissions || []);

      // Bills (billing:read)
      if (permissionSet.has('billing:read')) {
        promises.push(
          apiClient.get('/maintenance').then(r => r.data?.data || []).catch(() => [])
        );
      } else {
        promises.push(Promise.resolve([]));
      }

      // Complaints (member:read or resident:read)
      if (permissionSet.has('member:read') || permissionSet.has('resident:read')) {
        promises.push(
          apiClient.get('/complaints').then(r => r.data?.data || []).catch(() => [])
        );
      } else {
        promises.push(Promise.resolve([]));
      }

      // Receipts (billing:read)
      if (permissionSet.has('billing:read')) {
        promises.push(
          apiClient.get('/payments/receipts').then(r => r.data?.data || []).catch(() => [])
        );
      } else {
        promises.push(Promise.resolve([]));
      }

      // Members (member:read)
      let membersCount = 0;
      if (permissionSet.has('member:read')) {
        promises.push(
          apiClient.get('/members').then(r => { membersCount = (r.data?.data || []).length; return r.data?.data || []; }).catch(() => [])
        );
      } else {
        promises.push(Promise.resolve([]));
      }

      // Flats (flat:read)
      let flatsCount = 0;
      if (permissionSet.has('flat:read')) {
        promises.push(
          apiClient.get('/flats').then(r => { flatsCount = (r.data?.data || []).length; return r.data?.data || []; }).catch(() => [])
        );
      } else {
        promises.push(Promise.resolve([]));
      }

      // Society Dues Transparency (available to all authenticated members)
      promises.push(
        apiClient.get('/maintenance/society-dues').then(r => r.data?.data || []).catch(() => [])
      );

      // Subscription status check for management roles
      if (activeSociety?.societyId) {
        apiClient.get(`/societies/${activeSociety.societyId}/subscription`)
          .then(r => {
            if (r.data?.success && r.data?.data) {
              setSubscriptionInfo(r.data.data);
            }
          })
          .catch(() => {});

        apiClient.get(`/societies/${activeSociety.societyId}/registration-expiry`)
          .then(r => {
            if (r.data?.success && r.data?.data) {
              setRegistrationExpiry(r.data.data);
            }
          })
          .catch(() => {});
      }

      const [bills, complaints, receipts, members, flats, dues] = await Promise.all(promises);
      setSocietyDuesList(dues || []);

      // Compute stats
      const totalBilled = bills.reduce((sum: number, b: any) => sum + parseFloat(b.amount || '0'), 0);
      const paidBills = bills.filter((b: any) => b.status === 'PAID');
      const unpaidBills = bills.filter((b: any) => b.status === 'UNPAID');
      const overdueBills = bills.filter((b: any) => b.status === 'OVERDUE');

      
      const unpaidAmount = unpaidBills.reduce((sum: number, b: any) => sum + parseFloat(b.amount || '0'), 0);
      const overdueAmount = overdueBills.reduce((sum: number, b: any) => sum + parseFloat(b.amount || '0'), 0);
      
      const personalOverdueBills = overdueBills.filter((b: any) => b.isMine);
      const personalOverdueCount = personalOverdueBills.length;
      const personalOverdueAmount = personalOverdueBills.reduce((sum: number, b: any) => sum + parseFloat(b.amount || '0'), 0);
      const totalCollected = receipts.reduce((sum: number, r: any) => sum + parseFloat(r.amountPaid || r.amount_paid || '0'), 0);
      const openComplaints = complaints.filter((c: any) => c.status === 'OPEN' || c.status === 'ASSIGNED');
      const resolvedComplaints = complaints.filter((c: any) => c.status === 'RESOLVED' || c.status === 'CLOSED');

      setStats({
        totalBilled,
        totalCollected,
        outstanding: totalBilled - totalCollected,
        paidCount: paidBills.length,
        unpaidCount: unpaidBills.length,
        unpaidAmount,
        overdueCount: overdueBills.length,
        overdueAmount,

        personalOverdueCount,
        personalOverdueAmount,
        openComplaints: openComplaints.length,

        resolvedComplaints: resolvedComplaints.length,
        totalComplaints: complaints.length,
        membersCount: members.length,
        flatsCount: flats.length,
        collectionRate: totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0,
        pendingReviewsCount: receipts.filter((r: any) => r.status === 'REVIEW').length,
      });

      setRecentBills(bills.slice(0, 5).map((b: any) => ({
        id: b.id,
        type: 'bill',
        title: `${b.billNumber || 'Bill'} — Flat ${b.flatNumber || '?'}`,
        timestamp: b.dueDate || b.periodEnd || '',
        status: b.status,
      })));

      setRecentComplaints(complaints.slice(0, 5).map((c: any) => ({
        id: c.id,
        type: 'complaint',
        title: c.title || 'Untitled Complaint',
        timestamp: c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN') : '',
        status: c.status,
      })));

      setRecentReceipts(receipts.slice(0, 5).map((r: any) => ({
        id: r.id,
        type: 'receipt',
        title: `${r.receiptNumber || r.receipt_number || 'Receipt'} — ₹${parseFloat(r.amountPaid || r.amount_paid || '0').toLocaleString('en-IN')}`,
        timestamp: r.paymentDate || r.payment_date || '',
        status: r.status,
      })));

    } catch (err) {
      console.error('Dashboard data fetch failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
          <span className="text-xs text-slate-500">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: Management Roles (PRESIDENT, SECRETARY, SUPER_ADMIN)
  // ============================================
  const renderManagementDashboard = () => (
    <>
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          label="Total Billed"
          value={`₹${stats.totalBilled?.toLocaleString('en-IN') || '0'}`}
          icon={<IndianRupee className="h-4 w-4 text-emerald-400" />}
          accent="border-emerald-200 dark:border-emerald-900/30"
        />
        <StatCard
          label="Total Collected"
          value={`₹${stats.totalCollected?.toLocaleString('en-IN') || '0'}`}
          icon={<Wallet className="h-4 w-4 text-sky-400" />}
          trend={stats.collectionRate >= 80 ? 'up' : 'down'}
          trendLabel={`${stats.collectionRate}% rate`}
          accent="border-sky-200 dark:border-sky-900/30"
        />
        <StatCard
          label="Open Complaints"
          value={stats.openComplaints || 0}
          icon={<MessageSquare className="h-4 w-4 text-amber-400" />}
          trend={stats.openComplaints > 3 ? 'down' : 'up'}
          trendLabel={stats.openComplaints > 3 ? 'Needs attention' : 'Under control'}
          accent="border-amber-200 dark:border-amber-900/30"
        />
        <StatCard
          label="Pending Reviews"
          value={stats.pendingReviewsCount || 0}
          icon={<Receipt className="h-4 w-4 text-blue-400" />}
          trend={stats.pendingReviewsCount > 0 ? 'down' : 'neutral'}
          trendLabel={stats.pendingReviewsCount > 0 ? 'Action required' : 'All clear'}
          accent="border-blue-200 dark:border-blue-900/30"
          colorTheme="sky"
        />
        <StatCard
          label="Active Members"
          value={stats.membersCount || 0}
          icon={<Users className="h-4 w-4 text-violet-400" />}
          accent="border-violet-200 dark:border-violet-900/30"
        />
      </div>

            {/* Second Row KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Flats"
          value={stats.flatsCount || 0}
          icon={<Building className="h-4 w-4 text-indigo-400" />}
          accent="border-indigo-200 dark:border-indigo-900/30"
        />
        <StatCard
          label="Paid Invoices"
          value={stats.paidCount || 0}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
          accent="border-emerald-200 dark:border-emerald-900/30"
        />
        <StatCard
          label="Unpaid Invoices"
          value={stats.unpaidCount || 0}
          icon={<CreditCard className="h-4 w-4 text-amber-400" />}
          trend={stats.unpaidCount > 0 ? 'down' : 'up'}
          trendLabel={stats.unpaidCount > 0 ? 'Pending' : 'All clear'}
          accent="border-amber-200 dark:border-amber-900/30"
        />
        <StatCard
          label="Overdue Invoices"
          value={stats.overdueCount || 0}
          icon={<AlertTriangle className="h-4 w-4 text-red-400" />}
          trend={stats.residentOverdueCount > 0 ? 'down' : 'up'}
          trendLabel={stats.residentOverdueCount > 0 ? `₹${stats.overdueAmount?.toLocaleString('en-IN') || '0'} Due` : 'All clear'}
          accent="border-red-200 dark:border-red-900/30"
        />
      </div>

      {/* Activity Feeds + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Bills */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/20 shadow-sm dark:shadow-none p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Recent Bills</h3>
            <Link href={`/${slug}/maintenance`} className="text-[10px] text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold">View All →</Link>
          </div>
          {recentBills.length === 0 ? (
            <p className="text-xs text-slate-600 py-4 text-center">No bills found</p>
          ) : (
            recentBills.map(b => <ActivityRow key={b.id} item={b} />)
          )}
        </div>

        {/* Recent Complaints */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/20 shadow-sm dark:shadow-none p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Complaints</h3>
            <Link href={`/${slug}/complaints`} className="text-[10px] text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold">View All →</Link>
          </div>
          {recentComplaints.length === 0 ? (
            <p className="text-xs text-slate-600 py-4 text-center">No complaints</p>
          ) : (
            recentComplaints.map(c => <ActivityRow key={c.id} item={c} />)
          )}
        </div>

        {/* Recent Receipts */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/20 shadow-sm dark:shadow-none p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Recent Payments</h3>
            <Link href={`/${slug}/payments`} className="text-[10px] text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold">View All →</Link>
          </div>
          {recentReceipts.length === 0 ? (
            <p className="text-xs text-slate-600 py-4 text-center">No receipts</p>
          ) : (
            recentReceipts.map(r => <ActivityRow key={r.id} item={r} />)
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <QuickAction label="Manage Members" description="View and manage society members" href={`/${slug}/members`} icon={<Users className="h-4 w-4 text-violet-400" />} colorTheme="violet" accent="border-violet-200 dark:border-violet-900/30" />
          <QuickAction label="Generate Bills" description="Create maintenance bills" href={`/${slug}/maintenance`} icon={<CreditCard className="h-4 w-4 text-emerald-400" />} colorTheme="emerald" accent="border-emerald-200 dark:border-emerald-900/30" />
          <QuickAction label="View Complaints" description="Track and resolve complaints" href={`/${slug}/complaints`} icon={<MessageSquare className="h-4 w-4 text-amber-400" />} colorTheme="amber" accent="border-amber-200 dark:border-amber-900/30" />
          <QuickAction label="Accounting" description="Ledgers, vouchers, and statements" href={`/${slug}/accounting`} icon={<BookOpen className="h-4 w-4 text-cyan-400" />} colorTheme="cyan" accent="border-cyan-200 dark:border-cyan-900/30" />
          <QuickAction label="Society Assets" description="View and manage capital assets" href={`/${slug}/assets`} icon={<Box className="h-4 w-4 text-sky-400" />} colorTheme="sky" accent="border-sky-200 dark:border-sky-900/30" />
          <QuickAction label="Reports" description="Financial and operational reports" href={`/${slug}/reports`} icon={<BarChart3 className="h-4 w-4 text-indigo-400" />} colorTheme="indigo" accent="border-indigo-200 dark:border-indigo-900/30" />
        </div>
      </div>
    </>
  );

  // ============================================
  // RENDER: Treasurer Dashboard
  // ============================================
  const renderTreasurerDashboard = () => (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Billed"
          value={`₹${stats.totalBilled?.toLocaleString('en-IN') || '0'}`}
          icon={<IndianRupee className="h-4 w-4 text-emerald-400" />}
          accent="border-emerald-200 dark:border-emerald-900/30"
        />
        <StatCard
          label="Total Collected"
          value={`₹${stats.totalCollected?.toLocaleString('en-IN') || '0'}`}
          icon={<Wallet className="h-4 w-4 text-sky-400" />}
          trend={stats.collectionRate >= 80 ? 'up' : 'down'}
          trendLabel={`${stats.collectionRate}% collection`}
          accent="border-sky-200 dark:border-sky-900/30"
        />
        <StatCard
          label="Outstanding"
          value={`₹${stats.outstanding?.toLocaleString('en-IN') || '0'}`}
          icon={<AlertTriangle className="h-4 w-4 text-red-400" />}
          trend={stats.outstanding > 0 ? 'down' : 'up'}
          trendLabel={stats.outstanding > 0 ? 'Pending recovery' : 'All clear'}
          accent="border-red-200 dark:border-red-900/30"
        />
        <StatCard
          label="Collection Rate"
          value={`${stats.collectionRate || 0}%`}
          icon={<PieChart className="h-4 w-4 text-indigo-400" />}
          accent="border-indigo-200 dark:border-indigo-900/30"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Paid Invoices" value={stats.paidCount || 0} icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} accent="border-emerald-200 dark:border-emerald-900/30" />
        <StatCard label="Unpaid Invoices" value={stats.unpaidCount || 0} icon={<AlertTriangle className="h-4 w-4 text-red-400" />} accent="border-red-200 dark:border-red-900/30" />
        <StatCard label="Total Flats" value={stats.flatsCount || 0} icon={<Building className="h-4 w-4 text-violet-400" />} accent="border-violet-200 dark:border-violet-900/30" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/20 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Recent Bills</h3>
            <Link href={`/${slug}/maintenance`} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold">View All →</Link>
          </div>
          {recentBills.length === 0 ? (
            <p className="text-xs text-slate-600 py-4 text-center">No bills found</p>
          ) : (
            recentBills.map(b => <ActivityRow key={b.id} item={b} />)
          )}
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/20 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Recent Payments</h3>
            <Link href={`/${slug}/payments`} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold">View All →</Link>
          </div>
          {recentReceipts.length === 0 ? (
            <p className="text-xs text-slate-600 py-4 text-center">No receipts</p>
          ) : (
            recentReceipts.map(r => <ActivityRow key={r.id} item={r} />)
          )}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <QuickAction label="Generate Bills" description="Create and manage maintenance bills" href={`/${slug}/maintenance`} icon={<CreditCard className="h-4 w-4 text-emerald-400" />} colorTheme="emerald" accent="border-emerald-200 dark:border-emerald-900/30" />
          <QuickAction label="Record Payments" description="Log payment receipts" href={`/${slug}/payments`} icon={<Receipt className="h-4 w-4 text-sky-400" />} colorTheme="sky" accent="border-sky-200 dark:border-sky-900/30" />
          <QuickAction label="Accounting" description="Ledgers and financial statements" href={`/${slug}/accounting`} icon={<BookOpen className="h-4 w-4 text-cyan-400" />} colorTheme="cyan" accent="border-cyan-200 dark:border-cyan-900/30" />
          <QuickAction label="Financial Reports" description="Collection and defaulter reports" href={`/${slug}/reports`} icon={<BarChart3 className="h-4 w-4 text-indigo-400" />} colorTheme="indigo" accent="border-indigo-200 dark:border-indigo-900/30" />
          <QuickAction label="Society Assets" description="Capital equipment and AMC tracking" href={`/${slug}/assets`} icon={<Box className="h-4 w-4 text-amber-400" />} colorTheme="amber" accent="border-amber-200 dark:border-amber-900/30" />
        </div>
      </div>
    </>
  );

  // ============================================
  // RENDER: Accountant Dashboard
  // ============================================
  const renderAccountantDashboard = () => (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Billed"
          value={`₹${stats.totalBilled?.toLocaleString('en-IN') || '0'}`}
          icon={<IndianRupee className="h-4 w-4 text-emerald-400" />}
          accent="border-emerald-200 dark:border-emerald-900/30"
        />
        <StatCard
          label="Total Collected"
          value={`₹${stats.totalCollected?.toLocaleString('en-IN') || '0'}`}
          icon={<Wallet className="h-4 w-4 text-sky-400" />}
          accent="border-sky-200 dark:border-sky-900/30"
        />
        <StatCard
          label="Outstanding Dues"
          value={`₹${stats.outstanding?.toLocaleString('en-IN') || '0'}`}
          icon={<AlertTriangle className="h-4 w-4 text-red-400" />}
          accent="border-red-200 dark:border-red-900/30"
        />
        <StatCard
          label="Pending Review Slips"
          value={stats.pendingReviewsCount || 0}
          icon={<Receipt className="h-4 w-4 text-amber-400" />}
          trend={stats.pendingReviewsCount > 0 ? 'down' : 'neutral'}
          trendLabel={stats.pendingReviewsCount > 0 ? 'Needs verification' : 'All clear'}
          accent="border-amber-200 dark:border-amber-900/30"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/20 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Recent Invoices</h3>
            <Link href={`/${slug}/maintenance`} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold">View All →</Link>
          </div>
          {recentBills.length === 0 ? (
            <p className="text-xs text-slate-600 py-4 text-center">No bills found</p>
          ) : (
            recentBills.map(b => <ActivityRow key={b.id} item={b} />)
          )}
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/20 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Recent Payments & Receipts</h3>
            <Link href={`/${slug}/payments`} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold">View All →</Link>
          </div>
          {recentReceipts.length === 0 ? (
            <p className="text-xs text-slate-600 py-4 text-center">No receipts</p>
          ) : (
            recentReceipts.map(r => <ActivityRow key={r.id} item={r} />)
          )}
        </div>
      </div>

      {/* Accountant Specific Quick Actions */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Accountant Operational Tools</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <QuickAction label="Record Payment" description="Post cash, cheque, or bank receipt" href={`/${slug}/payments`} icon={<Receipt className="h-4 w-4 text-sky-400" />} colorTheme="sky" accent="border-sky-200 dark:border-sky-900/30" />
          <QuickAction label="Generate Monthly Bills" description="Execute batch maintenance billing sweep" href={`/${slug}/maintenance`} icon={<CreditCard className="h-4 w-4 text-emerald-400" />} colorTheme="emerald" accent="border-emerald-200 dark:border-emerald-900/30" />
          <QuickAction label="Accounting & Vouchers" description="Manage ledgers, journal entries, vouchers" href={`/${slug}/accounting`} icon={<BookOpen className="h-4 w-4 text-cyan-400" />} colorTheme="cyan" accent="border-cyan-200 dark:border-cyan-900/30" />
          <QuickAction label="Financial Reports" description="Balance sheet, trial balance, collections" href={`/${slug}/reports`} icon={<BarChart3 className="h-4 w-4 text-indigo-400" />} colorTheme="indigo" accent="border-indigo-200 dark:border-indigo-900/30" />
          <QuickAction label="Member Accounts" description="Audit member directory and balances" href={`/${slug}/members`} icon={<Users className="h-4 w-4 text-violet-400" />} colorTheme="violet" accent="border-violet-200 dark:border-violet-900/30" />
          <QuickAction label="Society Asset AMC" description="Track maintenance contracts and equipment" href={`/${slug}/assets`} icon={<Box className="h-4 w-4 text-amber-400" />} colorTheme="amber" accent="border-amber-200 dark:border-amber-900/30" />
        </div>
      </div>
    </>
  );

  // ============================================
  // RENDER: Committee Member Dashboard
  // ============================================
  const renderCommitteeDashboard = () => (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Open Complaints" value={stats.openComplaints || 0} icon={<MessageSquare className="h-4 w-4 text-amber-400" />} accent="border-amber-200 dark:border-amber-900/30" />
        <StatCard label="Resolved Tickets" value={stats.resolvedComplaints || 0} icon={<ClipboardCheck className="h-4 w-4 text-emerald-400" />} accent="border-emerald-200 dark:border-emerald-900/30" />
        <StatCard label="Active Members" value={stats.membersCount || 0} icon={<Users className="h-4 w-4 text-violet-400" />} accent="border-violet-200 dark:border-violet-900/30" />
        <StatCard label="Total Flats" value={stats.flatsCount || 0} icon={<Building className="h-4 w-4 text-indigo-400" />} accent="border-indigo-200 dark:border-indigo-900/30" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/20 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Active Complaints</h3>
            <Link href={`/${slug}/complaints`} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold">View All →</Link>
          </div>
          {recentComplaints.length === 0 ? (
            <p className="text-xs text-slate-600 py-4 text-center">No complaints</p>
          ) : (
            recentComplaints.map(c => <ActivityRow key={c.id} item={c} />)
          )}
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/20 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Recent Bills</h3>
            <Link href={`/${slug}/maintenance`} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold">View All →</Link>
          </div>
          {recentBills.length === 0 ? (
            <p className="text-xs text-slate-600 py-4 text-center">No bills found</p>
          ) : (
            recentBills.map(b => <ActivityRow key={b.id} item={b} />)
          )}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <QuickAction label="View Complaints" description="Track and escalate tickets" href={`/${slug}/complaints`} icon={<MessageSquare className="h-4 w-4 text-amber-400" />} colorTheme="amber" accent="border-amber-200 dark:border-amber-900/30" />
          <QuickAction label="Member Directory" description="View and manage members" href={`/${slug}/members`} icon={<Users className="h-4 w-4 text-violet-400" />} colorTheme="violet" accent="border-violet-200 dark:border-violet-900/30" />
          <QuickAction label="Flat Units" description="Browse society flat units" href={`/${slug}/flats`} icon={<Building className="h-4 w-4 text-indigo-400" />} colorTheme="indigo" accent="border-indigo-200 dark:border-indigo-900/30" />
        </div>
      </div>
    </>
  );

  // ============================================
  // RENDER: Owner / Tenant Dashboard
  // ============================================
  const renderResidentDashboard = () => (
    <>
      {stats.overdueCount > 0 && (
        <div className="mb-6 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-4 shadow-sm">
          <div className="flex gap-3 items-start">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-red-800 dark:text-red-400">Payment Overdue Alert</h3>
              <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                You have {stats.overdueCount} overdue maintenance {stats.overdueCount === 1 ? 'bill' : 'bills'} totaling <strong>₹{stats.overdueAmount?.toLocaleString('en-IN')}</strong>. 
                Please clear your dues at the earliest to avoid late fees.
              </p>
              <div className="mt-3">
                <Link href={`/${slug}/maintenance`} className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-500">
                  Pay Now
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Outstanding Dues"
          value={`₹${stats.outstanding?.toLocaleString('en-IN') || '0'}`}
          icon={<IndianRupee className="h-4 w-4 text-red-400" />}
          trend={stats.outstanding > 0 ? 'down' : 'up'}
          trendLabel={stats.outstanding > 0 ? 'Due' : 'No dues'}
          accent="border-red-200 dark:border-red-900/30"
        />
        <StatCard
          label="My Bills"
          value={recentBills.length}
          icon={<CreditCard className="h-4 w-4 text-emerald-400" />}
          accent="border-emerald-200 dark:border-emerald-900/30"
        />
        <StatCard
          label="My Complaints"
          value={stats.totalComplaints || 0}
          icon={<MessageSquare className="h-4 w-4 text-amber-400" />}
          accent="border-amber-200 dark:border-amber-900/30"
        />
        <StatCard
          label="Payments Made"
          value={recentReceipts.length}
          icon={<Receipt className="h-4 w-4 text-sky-400" />}
          accent="border-sky-200 dark:border-sky-900/30"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/20 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">My Bills</h3>
            <Link href={`/${slug}/maintenance`} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold">View All →</Link>
          </div>
          {recentBills.length === 0 ? (
            <p className="text-xs text-slate-600 py-4 text-center">No bills found</p>
          ) : (
            recentBills.map(b => <ActivityRow key={b.id} item={b} />)
          )}
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/20 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">My Complaints</h3>
            <Link href={`/${slug}/complaints`} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold">View All →</Link>
          </div>
          {recentComplaints.length === 0 ? (
            <p className="text-xs text-slate-600 py-4 text-center">No complaints filed</p>
          ) : (
            recentComplaints.map(c => <ActivityRow key={c.id} item={c} />)
          )}
        </div>
      </div>

      {/* Statutory Flat Dues Transparency Section for Residents */}
      <div className="rounded-xl border border-indigo-900/40 bg-gradient-to-r from-indigo-950/20 to-slate-950/40 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-indigo-400" />
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Society Outstanding Dues by Flat
              </h3>
              <span className="text-[10px] text-indigo-400 font-medium">
                Statutory Transparency (MCS & Housing Society Act Compliant)
              </span>
            </div>
          </div>
          <Link
            href={`/${slug}/maintenance`}
            className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
          >
            View Full Society Dues Roster →
          </Link>
        </div>

        {societyDuesList.length === 0 ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-1" />
            <p className="text-xs font-semibold text-slate-300">All Society Accounts Cleared</p>
            <p className="text-[10px] text-slate-500">No flats currently have overdue maintenance payments.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="pb-2 font-semibold">Flat & Tower</th>
                  <th className="pb-2 font-semibold">Type</th>
                  <th className="pb-2 font-semibold">Unpaid Bills</th>
                  <th className="pb-2 font-semibold">Pending Amount (₹)</th>
                  <th className="pb-2 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/30">
                {societyDuesList.slice(0, 5).map((d: any) => (
                  <tr key={d.flatId} className="text-slate-300">
                    <td className="py-2.5 font-bold text-slate-200">
                      Flat {d.flatNumber} <span className="text-[10px] text-slate-500 font-normal">({d.buildingName} • {d.wingName})</span>
                    </td>
                    <td className="py-2.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                        {d.flatType}
                      </span>
                    </td>
                    <td className="py-2.5 font-mono text-slate-300">
                      {d.unpaidInvoicesCount} invoice{d.unpaidInvoicesCount > 1 ? 's' : ''}
                    </td>
                    <td className="py-2.5 font-bold font-mono text-amber-400">
                      ₹ {Number(d.totalPendingAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 text-right">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                        d.status === 'OVERDUE'
                          ? 'bg-red-950/60 border-red-800 text-red-400'
                          : 'bg-amber-950/60 border-amber-800 text-amber-400'
                      }`}>
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <QuickAction label="Resident Portal" description="Gate approvals, polls, and services" href={`/${slug}/resident`} icon={<Home className="h-4 w-4 text-sky-400" />} colorTheme="sky" accent="border-sky-200 dark:border-sky-900/30" />
          <QuickAction label="My Maintenance Invoices" description="View invoices and pay dues" href={`/${slug}/maintenance`} icon={<CreditCard className="h-4 w-4 text-emerald-400" />} colorTheme="emerald" accent="border-emerald-200 dark:border-emerald-900/30" />
          <QuickAction label="File Complaint" description="Raise a new maintenance ticket" href={`/${slug}/complaints`} icon={<MessageSquare className="h-4 w-4 text-amber-400" />} colorTheme="amber" accent="border-amber-200 dark:border-amber-900/30" />
          <QuickAction label="Member Directory" description="View society member contacts" href={`/${slug}/members`} icon={<Users className="h-4 w-4 text-violet-400" />} colorTheme="violet" accent="border-violet-200 dark:border-violet-900/30" />
          <QuickAction label="Society Assets" description="View common area equipment" href={`/${slug}/assets`} icon={<Box className="h-4 w-4 text-indigo-400" />} colorTheme="indigo" accent="border-indigo-200 dark:border-indigo-900/30" />
        </div>
      </div>
    </>
  );

  // ============================================
  // Router: select dashboard by role
  // ============================================
  const renderDashboardContent = () => {
    switch (userRole) {
      case 'SUPER_ADMIN':
      case 'PRESIDENT':
      case 'VICE_PRESIDENT':
      case 'SECRETARY':
      case 'JOINT_SECRETARY':
      case 'SOCIETY_ADMIN':
        return renderManagementDashboard();
      case 'TREASURER':
        return renderTreasurerDashboard();
      case 'ACCOUNTANT':
        return renderAccountantDashboard();
      case 'AUDITOR':
        return renderTreasurerDashboard(); // comprehensive audit/financial metrics
      case 'COMMITTEE_MEMBER':
      case 'CULTURAL_SECRETARY':
      case 'LEGAL_ADVISOR':
        return renderCommitteeDashboard();
      case 'ESTATE_MANAGER':
      case 'MAINTENANCE_INCHARGE':
        return renderManagementDashboard();
      case 'SECURITY_SUPERVISOR':
      case 'OWNER':
      case 'CO_OWNER':
      case 'TENANT':
      case 'FAMILY_MEMBER':
      default:
        return renderResidentDashboard();
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-start overflow-x-hidden w-full py-8 px-4 sm:px-6 md:px-8 lg:px-10">
      {/* Background Grid */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="w-full max-w-[1450px] z-10 space-y-8">
        {/* Dashboard Header */}
        <div className={`rounded-2xl border bg-gradient-to-r ${config.accent} backdrop-blur-xl p-6 sm:p-8 shadow-sm dark:shadow-none`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/80 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/50 shadow-sm dark:shadow-none">
                {config.icon}
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{config.label}</h1>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{config.tagline}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{(user as any)?.name || user?.email || ''}</span>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">{userRole.replace('_', ' ')}</span>
              </div>
              <div className="h-10 w-10 rounded-full bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/50 flex items-center justify-center text-sm font-bold text-slate-700 dark:text-slate-300 shadow-sm dark:shadow-none">
                {((user as any)?.name || user?.email || '?')[0].toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* Subscription Expiry Alert Notice for Management Roles */}
        {['PRESIDENT', 'SECRETARY', 'TREASURER', 'SUPER_ADMIN', 'ACCOUNTANT'].includes(userRole) && subscriptionInfo && (
          <>
            {/* Expired alert banner */}
            {(subscriptionInfo.status === 'EXPIRED' || (subscriptionInfo.daysLeft !== undefined && subscriptionInfo.daysLeft < 0)) && (
              <div className="rounded-xl border border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-4 shadow-sm">
                <div className="flex gap-3 items-start">
                  <div className="mt-0.5 rounded-full bg-red-100 dark:bg-red-900/50 p-1.5 flex items-center justify-center border border-red-300 dark:border-red-800">
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-red-900 dark:text-red-300">
                      Subscription Plan Expired
                    </h3>
                    <p className="text-xs text-red-800 dark:text-red-400 mt-1">
                      Your society's <span className="font-bold">{subscriptionInfo.planName || 'Society'}</span> subscription expired on <span className="font-bold">{subscriptionInfo.endDate}</span>. Member operations and logins are restricted. Please contact platform administration to renew.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Expiring soon alert banner (<= 30 days) */}
            {subscriptionInfo.status !== 'EXPIRED' && subscriptionInfo.daysLeft !== undefined && subscriptionInfo.daysLeft >= 0 && subscriptionInfo.daysLeft <= 30 && (
              <div className="rounded-xl border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-4 shadow-sm">
                <div className="flex gap-3 items-start">
                  <div className="mt-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 p-1.5 flex items-center justify-center border border-amber-300 dark:border-amber-800">
                    <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-amber-900 dark:text-amber-300">
                      Subscription Plan Renewal Notice
                    </h3>
                    <p className="text-xs text-amber-800 dark:text-amber-400 mt-1">
                      Your society's <span className="font-bold">{subscriptionInfo.planName || 'Standard'}</span> subscription plan will expire in <span className="font-black text-amber-900 dark:text-amber-200">{subscriptionInfo.daysLeft} days</span> ({subscriptionInfo.endDate}). Please contact platform administration to renew the plan in advance to avoid member lockout.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Statutory Registration Expiry Alert for Management Roles */}
        {['PRESIDENT', 'SECRETARY', 'TREASURER', 'SUPER_ADMIN'].includes(userRole) && registrationExpiry && (
          <>
            {registrationExpiry.status === 'EXPIRED' && (
              <div className="rounded-xl border border-red-300 dark:border-red-900/80 bg-red-50 dark:bg-red-950/40 p-4 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex gap-3 items-start">
                    <div className="mt-0.5 rounded-full bg-red-100 dark:bg-red-900/50 p-1.5 flex items-center justify-center border border-red-300 dark:border-red-800">
                      <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-red-900 dark:text-red-300">
                        Statutory Society Registration Expired
                      </h3>
                      <p className="text-xs text-red-800 dark:text-red-400 mt-1">
                        Society legal registration renewal was due on <span className="font-bold">{registrationExpiry.renewalDate}</span> ({Math.abs(registrationExpiry.daysLeft || 0)} days overdue). Please initiate renewal with the Registrar of Co-operative Societies.
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/${slug}/profile`}
                    className="shrink-0 text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    View Registration Profile
                  </Link>
                </div>
              </div>
            )}

            {registrationExpiry.status === 'NEAR_EXPIRY' && (
              <div className="rounded-xl border border-amber-300 dark:border-amber-900/80 bg-amber-50 dark:bg-amber-950/40 p-4 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex gap-3 items-start">
                    <div className="mt-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 p-1.5 flex items-center justify-center border border-amber-300 dark:border-amber-800">
                      <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-amber-900 dark:text-amber-300">
                        Statutory Society Registration Renewal Due Soon
                      </h3>
                      <p className="text-xs text-amber-800 dark:text-amber-400 mt-1">
                        Registration renewal is due in <span className="font-black text-amber-900 dark:text-amber-200">{registrationExpiry.daysLeft} days</span> (Due Date: {registrationExpiry.renewalDate}). Prepare renewal filings for the Registrar.
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/${slug}/profile`}
                    className="shrink-0 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Manage Profile & Renewal
                  </Link>
                </div>
              </div>
            )}
          </>
        )}

        {stats.personalOverdueCount > 0 && (
          <div className="mb-6 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex gap-3 items-start">
                <div className="mt-0.5 rounded-full bg-red-100 dark:bg-red-900/50 p-1.5 flex items-center justify-center border border-red-200 dark:border-red-800">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-red-800 dark:text-red-300">Action Required: Overdue Maintenance</h3>
                  <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                    You have <span className="font-bold">{stats.personalOverdueCount}</span> unpaid invoice(s) totaling <span className="font-bold">₹{stats.personalOverdueAmount.toLocaleString('en-IN')}</span>. Please clear your dues immediately to avoid late payment penalties.
                  </p>
                </div>
              </div>
              <Link 
                href={`/${slug}/maintenance?mine=true`} 
                className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-red-700 transition-colors"
              >
                Pay Now <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}

        {/* Role-Specific Content */}
        {renderDashboardContent()}
      </div>
    </main>
  );
}
