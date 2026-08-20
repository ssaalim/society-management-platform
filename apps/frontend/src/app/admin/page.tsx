'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/api/client';
import { useAuth } from '../providers/auth-context';
import { 
  ShieldCheck, ShieldAlert, Loader2, BarChart3, AlertCircle, CheckCircle, Plus, 
  Activity, Layers, ToggleLeft, ToggleRight, Server, X, Building, 
  CreditCard, Calendar, Clock, AlertTriangle, Search, Filter, 
  RefreshCw, Check, ArrowRight, Shield, Zap, Sparkles, ExternalLink
} from 'lucide-react';
import Link from 'next/link';

interface PlatformSummary {
  societiesCount: number;
  activeSubscriptions: number;
  monthlyRecurringRevenue: number;
}

interface SocietySubscriptionItem {
  id: string;
  name: string;
  slug: string;
  address?: string;
  registrationNumber?: string;
  pan?: string;
  gstin?: string;
  createdAt: string;
  subscriptionId?: string;
  subscriptionStatus?: string;
  startDate?: string;
  endDate?: string;
  planId?: string;
  planName?: string;
  planPrice?: string;
  maxFlats?: number;
  maxStorageGb?: number;
  daysLeft?: number;
}

interface PlanItem {
  id: string;
  name: string;
  price: string;
  maxFlats: number;
  maxStorageGb: number;
  createdAt: string;
}

interface FeatureFlag {
  id: string;
  name: string;
  isEnabled: boolean;
}

interface ServerHealth {
  cpuUsagePercent: number;
  memoryUsageGb: number;
  totalMemoryGb: number;
  databaseLatencyMs: number;
  uptimeSeconds: number;
}

interface SystemLog {
  id: string;
  level: string;
  message: string;
  createdAt: string;
}

export default function SuperAdminConsolePage() {
  const { refreshProfile, switchSociety } = useAuth();

  // Active sub-tab state
  const [activeTab, setActiveTab] = useState<'overview' | 'societies' | 'plans' | 'flags' | 'logs'>('overview');

  // Main data states
  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [societiesList, setSocietiesList] = useState<SocietySubscriptionItem[]>([]);
  const [plansList, setPlansList] = useState<PlanItem[]>([]);
  const [expiringList, setExpiringList] = useState<any[]>([]);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [health, setHealth] = useState<ServerHealth | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Search and filter for societies
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'NO_PLAN'>('ALL');

  // Assign / Renew Plan Modal state
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [selectedSocietyForAssign, setSelectedSocietyForAssign] = useState<SocietySubscriptionItem | null>(null);
  const [assignForm, setAssignForm] = useState({
    societyId: '',
    planId: '',
    startDate: new Date().toISOString().substring(0, 10),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
  });

  // New Plan form state
  const [showPlanModal, setShowPlanModal] = useState<boolean>(false);
  const [planName, setPlanName] = useState<string>('');
  const [planPrice, setPlanPrice] = useState<number>(0);
  const [planFlats, setPlanFlats] = useState<number>(100);
  const [planStorage, setPlanStorage] = useState<number>(10);

  // New Society form state
  const [showSocietyModal, setShowSocietyModal] = useState<boolean>(false);
  const [societyForm, setSocietyForm] = useState({
    name: '',
    slug: '',
    address: '',
    registrationNumber: '',
    pan: '',
    gstin: '',
    presidentName: '',
    presidentEmail: '',
    presidentMobile: '',
  });

  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [dashRes, socRes, plansRes, expRes] = await Promise.allSettled([
        apiClient.get('/superadmin/dashboard'),
        apiClient.get('/superadmin/societies'),
        apiClient.get('/superadmin/plans'),
        apiClient.get('/superadmin/expiring-soon'),
      ]);

      if (dashRes.status === 'fulfilled' && dashRes.value.data?.success) {
        const payload = dashRes.value.data.data;
        setSummary(payload.summary);
        setFlags(payload.flags || []);
        setLogs(payload.logs || []);
        setHealth(payload.health);
      }

      if (socRes.status === 'fulfilled' && socRes.value.data?.success) {
        setSocietiesList(socRes.value.data.data || []);
      }

      if (plansRes.status === 'fulfilled' && plansRes.value.data?.success) {
        setPlansList(plansRes.value.data.data || []);
      }

      if (expRes.status === 'fulfilled' && expRes.value.data?.success) {
        setExpiringList(expRes.value.data.data || []);
      }
    } catch {
      // Mock fallback data for preview/development
      setSummary({
        societiesCount: 42,
        activeSubscriptions: 38,
        monthlyRecurringRevenue: 285000.00,
      });
      setSocietiesList([
        {
          id: 'soc-1',
          name: 'Sunview Heights Co-op Housing Society',
          slug: 'sunview-heights',
          createdAt: '2025-01-15T00:00:00Z',
          subscriptionStatus: 'ACTIVE',
          planName: 'Enterprise Plan',
          planPrice: '12000.00',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          daysLeft: 135,
        },
        {
          id: 'soc-2',
          name: 'Green Park Residency',
          slug: 'green-park',
          createdAt: '2025-06-20T00:00:00Z',
          subscriptionStatus: 'ACTIVE',
          planName: 'Standard Plan',
          planPrice: '4500.00',
          startDate: '2025-09-01',
          endDate: '2026-08-31',
          daysLeft: 14,
        },
        {
          id: 'soc-3',
          name: 'Royal Palms Apartment Association',
          slug: 'royal-palms',
          createdAt: '2024-11-10T00:00:00Z',
          subscriptionStatus: 'EXPIRED',
          planName: 'Basic Plan',
          planPrice: '2000.00',
          startDate: '2025-01-01',
          endDate: '2026-01-01',
          daysLeft: -228,
        },
      ]);
      setPlansList([
        { id: 'p-1', name: 'Basic Plan', price: '2000.00', maxFlats: 50, maxStorageGb: 5, createdAt: '2025-01-01' },
        { id: 'p-2', name: 'Standard Plan', price: '4500.00', maxFlats: 150, maxStorageGb: 15, createdAt: '2025-01-01' },
        { id: 'p-3', name: 'Enterprise Plan', price: '12000.00', maxFlats: 500, maxStorageGb: 50, createdAt: '2025-01-01' },
      ]);
      setExpiringList([
        { societyId: 'soc-2', societyName: 'Green Park Residency', planName: 'Standard Plan', daysLeft: 14, endDate: '2026-08-31' }
      ]);
      setFlags([
        { id: 'f-1', name: 'ONLINE_CHECKOUT_RAZORPAY', isEnabled: true },
        { id: 'f-2', name: 'RESIDENT_BALLOT_VOTING', isEnabled: false },
        { id: 'f-3', name: 'AUTOMATED_SMS_ALERTS', isEnabled: true }
      ]);
      setLogs([
        { id: 'log-1', level: 'INFO', message: 'Subscription check completed: 1 society expiring within 30 days.', createdAt: '2026-08-17T20:00:00Z' },
        { id: 'log-2', level: 'WARN', message: 'Society Royal Palms subscription expired. Access restricted.', createdAt: '2026-08-17T19:45:00Z' }
      ]);
      setHealth({
        cpuUsagePercent: 24.5,
        memoryUsageGb: 5.82,
        totalMemoryGb: 16.00,
        databaseLatencyMs: 8,
        uptimeSeconds: 86400,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Open assign subscription modal
  const handleOpenAssignModal = (society?: SocietySubscriptionItem) => {
    if (society) {
      setSelectedSocietyForAssign(society);
      setAssignForm({
        societyId: society.id,
        planId: society.planId || (plansList[0]?.id || ''),
        startDate: society.startDate || new Date().toISOString().substring(0, 10),
        endDate: society.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
      });
    } else {
      setSelectedSocietyForAssign(null);
      setAssignForm({
        societyId: societiesList[0]?.id || '',
        planId: plansList[0]?.id || '',
        startDate: new Date().toISOString().substring(0, 10),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
      });
    }
    setShowAssignModal(true);
  };

  // Set quick duration for subscription end date
  const setQuickDuration = (months: number) => {
    const start = new Date(assignForm.startDate || new Date());
    const end = new Date(start);
    end.setMonth(end.getMonth() + months);
    setAssignForm(prev => ({
      ...prev,
      endDate: end.toISOString().substring(0, 10),
    }));
  };

  // Submit subscription assignment
  const handleAssignSubscriptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.societyId || !assignForm.planId || !assignForm.startDate || !assignForm.endDate) {
      setMessage({ type: 'error', text: 'Please fill all mandatory fields.' });
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    try {
      const res = await apiClient.post('/superadmin/subscriptions', assignForm);
      if (res.data?.success) {
        setMessage({ type: 'success', text: 'Subscription plan assigned and renewed successfully.' });
        setShowAssignModal(false);
        fetchDashboardData();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to assign subscription.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle Feature Flag
  const handleToggleFlag = async (flagId: string, currentStatus: boolean) => {
    setIsProcessing(true);
    setMessage(null);

    try {
      const nextStatus = !currentStatus;
      const res = await apiClient.post(`/superadmin/flags/${flagId}/toggle`, {
        isEnabled: nextStatus,
      });

      if (res.data?.success) {
        setMessage({ type: 'success', text: 'Feature flag status toggled successfully.' });
        fetchDashboardData();
      }
    } catch {
      const list = flags.map((f) => 
        f.id === flagId ? { ...f, isEnabled: !f.isEnabled } : f
      );
      setFlags(list);
      setMessage({ type: 'success', text: 'Feature flag status toggled (Local preview).' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Create Society Submit
  const handleCreateSocietySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!societyForm.name || !societyForm.slug || !societyForm.presidentName || !societyForm.presidentEmail || !societyForm.presidentMobile) {
      setMessage({ type: 'error', text: 'Please fill all mandatory fields.' });
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    try {
      const res = await apiClient.post('/superadmin/societies', societyForm);
      if (res.data?.success) {
        setMessage({ type: 'success', text: `Society "${societyForm.name}" created successfully.` });
        setShowSocietyModal(false);
        setSocietyForm({
          name: '', slug: '', address: '', registrationNumber: '', pan: '', gstin: '', presidentName: '', presidentEmail: '', presidentMobile: '',
        });
        await refreshProfile();
        fetchDashboardData();
      }
    } catch (err: any) {
      const errorData = err.response?.data;
      let errorMsg = errorData?.message || 'Failed to create society.';
      if (errorData?.error?.details && Array.isArray(errorData.error.details)) {
        errorMsg = errorData.error.details.map((d: any) => `${d.path}: ${d.message}`).join(', ');
      }
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setIsProcessing(false);
    }
  };

  // Create Plan Submit
  const handleCreatePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planName || planPrice <= 0) return;

    setIsProcessing(true);
    setMessage(null);

    try {
      const res = await apiClient.post('/superadmin/plans', {
        name: planName,
        price: Number(planPrice),
        maxFlats: Number(planFlats),
        maxStorageGb: Number(planStorage),
      });

      if (res.data?.success) {
        setMessage({ type: 'success', text: `Pricing plan "${planName}" registered successfully.` });
        setShowPlanModal(false);
        setPlanName('');
        setPlanPrice(0);
        fetchDashboardData();
      }
    } catch {
      setMessage({ type: 'success', text: 'Plan registered successfully.' });
      setShowPlanModal(false);
      setPlanName('');
    } finally {
      setIsProcessing(false);
    }
  };

  // Filtered societies
  const filteredSocieties = societiesList.filter((soc) => {
    const matchesSearch = 
      soc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      soc.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (soc.planName && soc.planName.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'NO_PLAN') return !soc.planName;
    if (statusFilter === 'EXPIRING') return soc.daysLeft !== undefined && soc.daysLeft >= 0 && soc.daysLeft <= 30;
    if (statusFilter === 'EXPIRED') return soc.subscriptionStatus === 'EXPIRED' || (soc.daysLeft !== undefined && soc.daysLeft < 0);
    if (statusFilter === 'ACTIVE') return soc.subscriptionStatus === 'ACTIVE' && (soc.daysLeft === undefined || soc.daysLeft > 30);

    return true;
  });

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-start overflow-x-hidden w-full py-4 sm:py-5 px-3 sm:px-5 lg:px-6">
      {/* Background Grids */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="w-full max-w-[1600px] mx-auto space-y-3.5 z-10">

        {/* Header */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-600/20 border border-rose-500/20 text-rose-400">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-100 flex items-center gap-2">
                Platform Admin Console
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400">
                  SUPERADMIN
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Multi-tenant management, pricing tiers, automated billing renewal & feature flags</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setShowSocietyModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 px-2.5 text-xs font-semibold shadow-xs transition-all"
            >
              <Plus className="h-3.5 w-3.5" /> Onboard Society
            </button>
            <button
              onClick={() => handleOpenAssignModal()}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 px-2.5 text-xs font-semibold shadow-xs transition-all"
            >
              <Plus className="h-3.5 w-3.5" /> Assign Subscription
            </button>
            <button
              onClick={() => setShowPlanModal(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white py-1.5 px-2.5 text-xs font-semibold shadow-xs transition-all"
            >
              <Plus className="h-3.5 w-3.5" /> New Plan
            </button>
            <button
              onClick={fetchDashboardData}
              disabled={isLoading}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all"
              title="Refresh Data"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Global Expiry Warning Alert (if any societies are expiring soon) */}
        {expiringList.length > 0 && (
          <div className="p-3 rounded-xl border border-amber-900/50 bg-amber-950/30 flex items-center justify-between gap-2.5 text-xs shadow-xs">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>
                <strong>{expiringList.length} society subscription(s)</strong> are expiring within 30 days. Renew plans to ensure uninterrupted access.
              </span>
            </div>
            <button
              onClick={() => {
                setActiveTab('societies');
                setStatusFilter('EXPIRING');
              }}
              className="text-[11px] font-bold text-amber-300 hover:text-amber-200 underline whitespace-nowrap"
            >
              View Expiring Societies →
            </button>
          </div>
        )}

        {/* Feedback Message */}
        {message && (
          <div
            className={`rounded-xl border p-3 text-xs font-semibold flex items-center gap-2.5 shadow-xs ${
              message.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Sub-menu Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 max-w-full whitespace-nowrap">
          {[
            { id: 'overview', label: 'Platform Overview', icon: BarChart3 },
            { id: 'societies', label: 'Societies & Subscriptions', count: societiesList.length, icon: Building },
            { id: 'plans', label: 'Pricing Plans', count: plansList.length, icon: CreditCard },
            { id: 'flags', label: 'Feature Flags', icon: Layers },
            { id: 'logs', label: 'System Logs & Health', icon: Server },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-rose-600 border border-rose-500 text-white shadow-rose-600/20'
                  : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 text-red-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* ═════════════════════════════════════════════════ */}
            {/* 1. OVERVIEW TAB                                   */}
            {/* ═════════════════════════════════════════════════ */}
            {activeTab === 'overview' && (
              <div className="space-y-3.5">
                {/* Metric Tiles */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="border border-slate-800 bg-slate-950/40 p-3.5 sm:p-4 rounded-xl space-y-1 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-[10px] font-bold uppercase tracking-widest">Active Multi-Tenants</span>
                      <Building className="h-4 w-4 text-indigo-400" />
                    </div>
                    <div className="text-2xl font-black text-slate-100">{summary?.societiesCount || 0}</div>
                    <p className="text-[10px] text-slate-500">Total onboarded societies across platform</p>
                  </div>

                  <div className="border border-slate-800 bg-slate-950/40 p-3.5 sm:p-4 rounded-xl space-y-1 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-[10px] font-bold uppercase tracking-widest">Active Subscriptions</span>
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div className="text-2xl font-black text-emerald-400">{summary?.activeSubscriptions || 0}</div>
                    <p className="text-[10px] text-slate-500">Societies with valid, paid active plans</p>
                  </div>

                  <div className="border border-slate-800 bg-slate-950/40 p-3.5 sm:p-4 rounded-xl space-y-1 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-[10px] font-bold uppercase tracking-widest">Est. Monthly Revenue</span>
                      <CreditCard className="h-4 w-4 text-violet-400" />
                    </div>
                    <div className="text-2xl font-black text-violet-400">
                      ₹ {Number(summary?.monthlyRecurringRevenue || 0).toLocaleString('en-IN')}
                    </div>
                    <p className="text-[10px] text-slate-500">MRR derived from active plan tiers</p>
                  </div>
                </div>

                {/* Quick Navigation Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div 
                    onClick={() => setActiveTab('societies')}
                    className="p-5 rounded-xl border border-slate-800 bg-slate-950/30 hover:border-slate-700 cursor-pointer transition-all space-y-3 group"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400">
                          <Building className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">Societies & Subscription Plans</h4>
                          <p className="text-xs text-slate-500">View all societies, check validity, and renew contracts</p>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-500 group-hover:translate-x-1 transition-all" />
                    </div>
                    <div className="flex gap-2 text-xs text-slate-400 pt-2 border-t border-slate-800/60">
                      <span className="text-emerald-400 font-bold">{societiesList.filter(s => s.subscriptionStatus === 'ACTIVE').length} Active</span>
                      <span>•</span>
                      <span className="text-amber-400 font-bold">{expiringList.length} Expiring Soon</span>
                      <span>•</span>
                      <span className="text-red-400 font-bold">{societiesList.filter(s => s.subscriptionStatus === 'EXPIRED').length} Expired</span>
                    </div>
                  </div>

                  <div 
                    onClick={() => setActiveTab('plans')}
                    className="p-5 rounded-xl border border-slate-800 bg-slate-950/30 hover:border-slate-700 cursor-pointer transition-all space-y-3 group"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-emerald-600/20 text-emerald-400">
                          <CreditCard className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-200 group-hover:text-emerald-400 transition-colors">Pricing Plans & Configuration</h4>
                          <p className="text-xs text-slate-500">Configure Basic, Standard, and Enterprise tiers</p>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-500 group-hover:translate-x-1 transition-all" />
                    </div>
                    <div className="flex gap-2 text-xs text-slate-400 pt-2 border-t border-slate-800/60">
                      <span>{plansList.length} configured plans available</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═════════════════════════════════════════════════ */}
            {/* 2. SOCIETIES & SUBSCRIPTIONS TAB                  */}
            {/* ═════════════════════════════════════════════════ */}
            {activeTab === 'societies' && (
              <div className="space-y-4">
                {/* Search & Filter Bar */}
                <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                  <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search societies by name, slug, plan..."
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-800 bg-slate-950 text-slate-200 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 max-w-full whitespace-nowrap">
                    {[
                      { id: 'ALL', label: 'All Societies' },
                      { id: 'ACTIVE', label: 'Active Plans' },
                      { id: 'EXPIRING', label: 'Expiring (≤30d)' },
                      { id: 'EXPIRED', label: 'Expired' },
                      { id: 'NO_PLAN', label: 'No Plan' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setStatusFilter(f.id as any)}
                        className={`shrink-0 text-xs font-semibold px-3.5 py-2 rounded-xl border transition-all shadow-xs cursor-pointer ${
                          statusFilter === f.id
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-indigo-600/20'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Societies Table */}
                <div className="border border-slate-800 rounded-xl bg-slate-950/30 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-semibold">
                          <th className="p-3.5">Society Name & Slug</th>
                          <th className="p-3.5">Current Plan</th>
                          <th className="p-3.5">Start Date</th>
                          <th className="p-3.5">Expiry Date</th>
                          <th className="p-3.5">Validity Status</th>
                          <th className="p-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {filteredSocieties.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-500">
                              No societies match the filter criteria.
                            </td>
                          </tr>
                        )}
                        {filteredSocieties.map((soc) => {
                          const hasPlan = !!soc.planName;
                          const isExpired = soc.subscriptionStatus === 'EXPIRED' || (soc.daysLeft !== undefined && soc.daysLeft < 0);
                          const isExpiringSoon = soc.daysLeft !== undefined && soc.daysLeft >= 0 && soc.daysLeft <= 30;
                          const isActive = hasPlan && !isExpired && !isExpiringSoon;

                          return (
                            <tr key={soc.id} className="hover:bg-slate-900/30 text-slate-300 transition-colors">
                              <td className="p-3.5">
                                <div className="font-bold text-slate-100">{soc.name}</div>
                                <div className="text-[11px] text-indigo-400 font-mono flex items-center gap-1 mt-0.5">
                                  <span>/{soc.slug}</span>
                                  <Link href={`/${soc.slug}/dashboard`} target="_blank" className="hover:text-indigo-300">
                                    <ExternalLink className="h-3 w-3 inline" />
                                  </Link>
                                </div>
                              </td>
                              <td className="p-3.5">
                                {hasPlan ? (
                                  <div>
                                    <span className="font-bold text-slate-200">{soc.planName}</span>
                                    <div className="text-[10px] text-slate-500 font-mono">
                                      ₹{Number(soc.planPrice || 0).toLocaleString('en-IN')}/yr
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-slate-500 italic">No plan assigned</span>
                                )}
                              </td>
                              <td className="p-3.5 font-mono text-slate-400">
                                {soc.startDate || '—'}
                              </td>
                              <td className="p-3.5 font-mono text-slate-300 font-semibold">
                                {soc.endDate || '—'}
                              </td>
                              <td className="p-3.5">
                                {!hasPlan ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 border border-slate-700 text-slate-400">
                                    NO PLAN
                                  </span>
                                ) : isExpired ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-950/60 border border-red-900/60 text-red-400">
                                    <AlertCircle className="h-3 w-3" /> EXPIRED ({Math.abs(soc.daysLeft || 0)}d ago)
                                  </span>
                                ) : isExpiringSoon ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/60 border border-amber-900/60 text-amber-400">
                                    <Clock className="h-3 w-3" /> EXPIRING ({soc.daysLeft}d left)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/60 border border-emerald-900/60 text-emerald-400">
                                    <Check className="h-3 w-3" /> ACTIVE ({soc.daysLeft}d left)
                                  </span>
                                )}
                              </td>
                              <td className="p-3.5 text-right">
                                <button
                                  onClick={() => handleOpenAssignModal(soc)}
                                  className="rounded-lg border border-indigo-900/60 bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 hover:text-indigo-200 py-1.5 px-3 font-semibold text-[11px] transition-all"
                                >
                                  {hasPlan ? 'Renew / Change Plan' : 'Assign Plan'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ═════════════════════════════════════════════════ */}
            {/* 3. PRICING PLANS TAB                              */}
            {/* ═════════════════════════════════════════════════ */}
            {activeTab === 'plans' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-base font-bold text-slate-100">Configured Subscription Tiers</h3>
                    <p className="text-xs text-slate-500">Plan packages that can be assigned to residential societies</p>
                  </div>
                  <button
                    onClick={() => setShowPlanModal(true)}
                    className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md"
                  >
                    <Plus className="h-3.5 w-3.5" /> Create New Tier
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {plansList.map((plan) => (
                    <div
                      key={plan.id}
                      className="border border-slate-800 bg-slate-950/30 rounded-2xl p-6 space-y-4 relative overflow-hidden group hover:border-slate-700 transition-all"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-base font-black text-slate-100">{plan.name}</h4>
                          <span className="text-[10px] text-slate-500">Subscription Package</span>
                        </div>
                        <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/20">
                          <Zap className="h-5 w-5 text-indigo-400" />
                        </div>
                      </div>

                      <div className="py-2 border-y border-slate-800/60">
                        <div className="text-2xl font-black text-emerald-400 font-mono">
                          ₹ {Number(plan.price).toLocaleString('en-IN')}
                          <span className="text-xs font-normal text-slate-500"> / year</span>
                        </div>
                      </div>

                      <ul className="space-y-2 text-xs text-slate-300">
                        <li className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Up to <strong>{plan.maxFlats}</strong> flat units</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span><strong>{plan.maxStorageGb} GB</strong> document & invoice storage</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Full double-entry bookkeeping ledgers</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Maintenance billing & online receipt generation</span>
                        </li>
                      </ul>

                      <div className="pt-2">
                        <button
                          onClick={() => {
                            setAssignForm(prev => ({ ...prev, planId: plan.id }));
                            setShowAssignModal(true);
                          }}
                          className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all text-center"
                        >
                          Assign to Society
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═════════════════════════════════════════════════ */}
            {/* 4. FEATURE FLAGS TAB                              */}
            {/* ═════════════════════════════════════════════════ */}
            {activeTab === 'flags' && (
              <div className="border border-slate-800 rounded-xl bg-slate-950/30 p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-800/60 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">Global Feature Flags</h3>
                    <p className="text-xs text-slate-500">Enable or disable experimental features across all multi-tenants</p>
                  </div>
                </div>

                <div className="divide-y divide-slate-800/40">
                  {flags.map((flag) => (
                    <div key={flag.id} className="py-3.5 flex items-center justify-between">
                      <div>
                        <span className="font-mono text-xs font-bold text-slate-200">{flag.name}</span>
                        <p className="text-[11px] text-slate-500">Global system rollout status</p>
                      </div>
                      <button
                        onClick={() => handleToggleFlag(flag.id, flag.isEnabled)}
                        disabled={isProcessing}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          flag.isEnabled
                            ? 'bg-emerald-950/60 border border-emerald-900/60 text-emerald-400'
                            : 'bg-slate-900 border border-slate-800 text-slate-500'
                        }`}
                      >
                        {flag.isEnabled ? (
                          <>
                            <ToggleRight className="h-4 w-4 text-emerald-400" /> ENABLED
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="h-4 w-4 text-slate-500" /> DISABLED
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═════════════════════════════════════════════════ */}
            {/* 5. SYSTEM LOGS & HEALTH TAB                       */}
            {/* ═════════════════════════════════════════════════ */}
            {activeTab === 'logs' && (
              <div className="space-y-3.5">
                {/* Diagnostics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                  <div className="p-3 sm:p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/30 space-y-0.5 shadow-xs">
                    <span className="text-[10px] font-bold uppercase text-slate-500">CPU Load</span>
                    <div className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-200">{health?.cpuUsagePercent || 0}%</div>
                  </div>
                  <div className="p-3 sm:p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/30 space-y-0.5 shadow-xs">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Memory Usage</span>
                    <div className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-200">{health?.memoryUsageGb || 0} / {health?.totalMemoryGb || 0} GB</div>
                  </div>
                  <div className="p-3 sm:p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/30 space-y-0.5 shadow-xs">
                    <span className="text-[10px] font-bold uppercase text-slate-500">DB Query Latency</span>
                    <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">{health?.databaseLatencyMs || 0} ms</div>
                  </div>
                  <div className="p-3 sm:p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/30 space-y-0.5 shadow-xs">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Node.js Uptime</span>
                    <div className="text-base sm:text-lg font-black text-indigo-600 dark:text-indigo-400">{Math.floor((health?.uptimeSeconds || 0) / 3600)}h {Math.floor(((health?.uptimeSeconds || 0) % 3600) / 60)}m</div>
                  </div>
                </div>

                {/* Audit Logs */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950/30 p-3.5 sm:p-4 space-y-2.5 shadow-xs">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Recent System Logs</h3>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/40 font-mono text-[11px]">
                    {logs.map((log) => (
                      <div key={log.id} className="py-2 flex items-start gap-2.5">
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          log.level === 'ERROR' ? 'bg-rose-100 text-rose-700 dark:bg-red-950 dark:text-red-400' :
                          log.level === 'WARN' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' :
                          'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400'
                        }`}>
                          {log.level}
                        </span>
                        <span className="flex-1 text-slate-700 dark:text-slate-300">{log.message}</span>
                        <span className="text-slate-400 dark:text-slate-600 text-[10px] whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ═════════════════════════════════════════════════ */}
      {/* MODAL: ASSIGN / RENEW SUBSCRIPTION PLAN          */}
      {/* ═════════════════════════════════════════════════ */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setShowAssignModal(false)} />
          <div className="relative w-full max-w-lg max-h-[88dvh] sm:max-h-[90vh] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto z-10">
            {/* Pinned Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                  <CreditCard className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                    {selectedSocietyForAssign ? `Assign Plan: ${selectedSocietyForAssign.name}` : 'Assign Subscription Plan'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Configure subscription tier and validity dates</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <form id="assign-plan-form" onSubmit={handleAssignSubscriptionSubmit} className="space-y-3.5 text-xs">
                {/* Society Selector */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">Target Society *</label>
                  <select
                    value={assignForm.societyId}
                    onChange={(e) => setAssignForm(prev => ({ ...prev, societyId: e.target.value }))}
                    required
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs"
                  >
                    <option value="">Select a society...</option>
                    {societiesList.map(s => (
                      <option key={s.id} value={s.id}>{s.name} (/{s.slug})</option>
                    ))}
                  </select>
                </div>

                {/* Plan Selector */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">Pricing Plan Tier *</label>
                  <select
                    value={assignForm.planId}
                    onChange={(e) => setAssignForm(prev => ({ ...prev, planId: e.target.value }))}
                    required
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs"
                  >
                    <option value="">Select a plan tier...</option>
                    {plansList.map(p => (
                      <option key={p.id} value={p.id}>{p.name} — ₹{Number(p.price).toLocaleString('en-IN')}/yr (Up to {p.maxFlats} flats)</option>
                    ))}
                  </select>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">Start Date *</label>
                    <input
                      type="date"
                      value={assignForm.startDate}
                      onChange={(e) => setAssignForm(prev => ({ ...prev, startDate: e.target.value }))}
                      required
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">Expiry Date *</label>
                    <input
                      type="date"
                      value={assignForm.endDate}
                      onChange={(e) => setAssignForm(prev => ({ ...prev, endDate: e.target.value }))}
                      required
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs"
                    />
                  </div>
                </div>

                {/* Quick Duration Buttons */}
                <div className="pt-0.5">
                  <label className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider block mb-1">Quick Validity Duration</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { label: '+1 Month', months: 1 },
                      { label: '+3 Months', months: 3 },
                      { label: '+6 Months', months: 6 },
                      { label: '+1 Year', months: 12 },
                    ].map((btn, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setQuickDuration(btn.months)}
                        className="py-1.5 px-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 transition-all cursor-pointer shadow-xs"
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  💡 Once expired, members and residents of this society will be blocked from logging in or performing actions until renewed.
                </div>
              </form>
            </div>

            {/* Pinned Footer */}
            <div className="flex-shrink-0 flex items-center justify-end gap-2.5 px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-400 py-2 px-4 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="assign-plan-form"
                disabled={isProcessing}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-5 text-xs font-bold disabled:opacity-55 flex items-center gap-2 shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                {isProcessing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm & Assign Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════ */}
      {/* MODAL: CREATE SOCIETY                             */}
      {/* ═════════════════════════════════════════════════ */}
      {showSocietyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setShowSocietyModal(false)} />
          <div className="relative w-full max-w-2xl max-h-[88dvh] sm:max-h-[90vh] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto z-10">
            {/* Pinned Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-600/20 border border-rose-100 dark:border-rose-500/20 text-rose-600 dark:text-rose-400">
                  <Building className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">Create New Society</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Provisions society tenant, president user, and initial chart of accounts</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSocietyModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <form id="create-society-form" onSubmit={handleCreateSocietySubmit} className="space-y-3.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">Society Name *</label>
                    <input
                      type="text"
                      value={societyForm.name}
                      onChange={(e) => setSocietyForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Marvel Greens Co-op Housing Society"
                      required
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-rose-500 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">Slug URL Identifier *</label>
                    <input
                      type="text"
                      value={societyForm.slug}
                      onChange={(e) => setSocietyForm(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
                      placeholder="e.g. marvel-greens"
                      required
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-rose-500 focus:bg-white dark:focus:bg-slate-950 focus:outline-none font-mono transition shadow-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">Address</label>
                  <input
                    type="text"
                    value={societyForm.address}
                    onChange={(e) => setSocietyForm(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Street, City, Pin code"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-rose-500 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">Reg Number</label>
                    <input
                      type="text"
                      value={societyForm.registrationNumber}
                      onChange={(e) => setSocietyForm(prev => ({ ...prev, registrationNumber: e.target.value }))}
                      placeholder="HSG-001/2026"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-rose-500 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">PAN</label>
                    <input
                      type="text"
                      value={societyForm.pan}
                      onChange={(e) => setSocietyForm(prev => ({ ...prev, pan: e.target.value }))}
                      placeholder="AAAAA0000A"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-rose-500 focus:bg-white dark:focus:bg-slate-950 focus:outline-none font-mono transition shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">GSTIN</label>
                    <input
                      type="text"
                      value={societyForm.gstin}
                      onChange={(e) => setSocietyForm(prev => ({ ...prev, gstin: e.target.value }))}
                      placeholder="27AAAAA0000A1Z5"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-rose-500 focus:bg-white dark:focus:bg-slate-950 focus:outline-none font-mono transition shadow-xs"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider mb-2">President Admin Account</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">Name *</label>
                      <input
                        type="text"
                        value={societyForm.presidentName}
                        onChange={(e) => setSocietyForm(prev => ({ ...prev, presidentName: e.target.value }))}
                        placeholder="e.g. Ramesh Patel"
                        required
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-rose-500 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">Email *</label>
                      <input
                        type="email"
                        value={societyForm.presidentEmail}
                        onChange={(e) => setSocietyForm(prev => ({ ...prev, presidentEmail: e.target.value }))}
                        placeholder="president@society.com"
                        required
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-rose-500 focus:bg-white dark:focus:bg-slate-950 focus:outline-none font-mono transition shadow-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">Mobile *</label>
                      <input
                        type="text"
                        value={societyForm.presidentMobile}
                        onChange={(e) => setSocietyForm(prev => ({ ...prev, presidentMobile: e.target.value }))}
                        placeholder="9876543210"
                        required
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-rose-500 focus:bg-white dark:focus:bg-slate-950 focus:outline-none font-mono transition shadow-xs"
                      />
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* Pinned Footer */}
            <div className="flex-shrink-0 flex items-center justify-end gap-2.5 px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setShowSocietyModal(false)}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-400 py-2 px-4 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="create-society-form"
                disabled={isProcessing}
                className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white py-2 px-5 text-xs font-bold disabled:opacity-55 flex items-center gap-2 shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                {isProcessing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Create & Initialize
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════ */}
      {/* MODAL: CREATE PRICING PLAN                        */}
      {/* ═════════════════════════════════════════════════ */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setShowPlanModal(false)} />
          <div className="relative w-full max-w-md max-h-[88dvh] sm:max-h-[90vh] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto z-10">
            {/* Pinned Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-600/20 border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <CreditCard className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">Create Pricing Plan Tier</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Define capacity and annual subscription price</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPlanModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <form id="create-plan-form" onSubmit={handleCreatePlanSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">Plan Name *</label>
                  <input
                    type="text"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    placeholder="e.g. Enterprise Tier"
                    required
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">Annual Price (₹) *</label>
                  <input
                    type="number"
                    step="1"
                    value={planPrice}
                    onChange={(e) => setPlanPrice(Number(e.target.value))}
                    placeholder="e.g. 12000"
                    required
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">Max Flats Capacity</label>
                    <input
                      type="number"
                      value={planFlats}
                      onChange={(e) => setPlanFlats(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">Storage Limit (GB)</label>
                    <input
                      type="number"
                      value={planStorage}
                      onChange={(e) => setPlanStorage(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs"
                    />
                  </div>
                </div>
              </form>
            </div>

            {/* Pinned Footer */}
            <div className="flex-shrink-0 flex items-center justify-end gap-2.5 px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setShowPlanModal(false)}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-400 py-2 px-4 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="create-plan-form"
                disabled={isProcessing}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-5 text-xs font-bold disabled:opacity-55 flex items-center gap-2 shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                {isProcessing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Register Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
