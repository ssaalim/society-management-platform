'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../providers/auth-context';
import { apiClient } from '../../../lib/api/client';
import {
  BarChart3, TrendingUp, AlertTriangle, Users, FileDown, Loader2,
  CheckCircle, AlertCircle, Clock, Tag, ShieldAlert, Package,
  Wallet, Activity, ArrowUpRight, ArrowDownRight, RefreshCw,
  Building, Receipt, FileText, Scale, Coins, PieChart, Code2
} from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

// ─────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────
const fmt = (n: number | string) => Number(n).toLocaleString('en-IN');
const pct = (n: number) => `${n.toFixed(1)}%`;

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full bg-slate-800/60 rounded-full h-1.5 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${w}%` }} />
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, color, trend }: {
  label: string; value: string; sub?: string; icon: any; color: string; trend?: 'up' | 'down' | null;
}) {
  return (
    <div className={`relative p-4 rounded-xl border bg-white dark:bg-slate-950/40 space-y-2 overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 transition-all border-slate-200 dark:border-slate-800 shadow-xs`}>
      <div className={`absolute -top-3 -right-3 p-4 rounded-full opacity-10 ${color.replace('text-', 'bg-')}`} />
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</span>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className={`text-xl font-black ${color}`}>{value}</div>
      {sub && (
        <div className="flex items-center gap-1">
          {trend === 'up' && <ArrowUpRight className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />}
          {trend === 'down' && <ArrowDownRight className="h-3 w-3 text-rose-600 dark:text-rose-400" />}
          <span className="text-[11px] text-slate-600 dark:text-slate-400">{sub}</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────────
export default function ReportsCenterPage() {
  const { society_slug } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeSociety } = useAuth();

  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<string>(tabParam || 'summary');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // Data states
  const [collectionData, setCollectionData] = useState<any[]>([]);
  const [defaulterData, setDefaulterData] = useState<any[]>([]);
  const [occupancyData, setOccupancyData] = useState<any[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<any[]>([]);
  const [maintenanceStatus, setMaintenanceStatus] = useState<any>({ breakdown: [], summary: {} });
  const [complaintsData, setComplaintsData] = useState<any>({ byStatus: [], byPriority: [], summary: {} });
  const [assetData, setAssetData] = useState<any>({ breakdown: [], summary: {} });
  const [lateFeeData, setLateFeeData] = useState<any>({});

  const fetchAll = useCallback(async () => {
    if (!society_slug) return;
    setIsRefreshing(true);

    const safe = async (fn: () => Promise<any>, fallback: any) => {
      try { return await fn(); } catch { return fallback; }
    };

    const [col, def, occ, trend, maint, comp, asset, latefee] = await Promise.all([
      safe(() => apiClient.get('/reports/collection').then(r => r.data?.data || []), []),
      safe(() => apiClient.get('/reports/defaulter').then(r => r.data?.data || []), []),
      safe(() => apiClient.get('/reports/occupancy').then(r => r.data?.data || []), []),
      safe(() => apiClient.get('/reports/monthly-trend').then(r => r.data?.data || []), []),
      safe(() => apiClient.get('/reports/maintenance-status').then(r => r.data?.data || { breakdown: [], summary: {} }), { breakdown: [], summary: {} }),
      safe(() => apiClient.get('/reports/complaints-analytics').then(r => r.data?.data || { byStatus: [], byPriority: [], summary: {} }), { byStatus: [], byPriority: [], summary: {} }),
      safe(() => apiClient.get('/reports/asset-summary').then(r => r.data?.data || { breakdown: [], summary: {} }), { breakdown: [], summary: {} }),
      safe(() => apiClient.get('/reports/late-fee').then(r => r.data?.data || {}), {}),
    ]);

    setCollectionData(col);
    setDefaulterData(def);
    setOccupancyData(occ);
    setMonthlyTrend(trend);
    setMaintenanceStatus(maint);
    setComplaintsData(comp);
    setAssetData(asset);
    setLateFeeData(latefee);
    setIsLoading(false);
    setIsRefreshing(false);
  }, [society_slug]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDownloadCSV = (type: string) => {
    window.open(`${apiClient.defaults.baseURL}/reports/export?type=${type}`, '_blank');
  };

  const totalCollected = collectionData.reduce((s, r) => s + Number(r.totalCollected), 0);
  const totalTransactions = collectionData.reduce((s, r) => s + Number(r.count), 0);
  const totalDefaulters = defaulterData.length;
  const totalOutstanding = defaulterData.reduce((s, r) => s + Number(r.totalOutstanding), 0);

  const TABS = [
    { id: 'summary', label: 'Summary', icon: FileText },
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'collection', label: 'Collections', icon: TrendingUp },
    { id: 'maintenance', label: 'Invoices', icon: Receipt },
    { id: 'defaulters', label: 'Defaulters', icon: AlertTriangle },
    { id: 'complaints', label: 'Complaints', icon: AlertCircle },
    { id: 'assets', label: 'Assets', icon: Package },
    { id: 'latefee', label: 'Late Fees', icon: Clock },
    { id: 'occupancy', label: 'Occupancy', icon: Building },
    { id: 'custom-sql', label: 'Custom SQL', icon: Code2 },
  ];

  const STATUS_COLORS: Record<string, string> = {
    PAID: 'text-emerald-700 dark:text-emerald-400',
    UNPAID: 'text-rose-700 dark:text-rose-400',
    PARTIAL: 'text-amber-700 dark:text-amber-400',
    OVERDUE: 'text-rose-700 dark:text-rose-400',
    OPEN: 'text-amber-700 dark:text-amber-400',
    ASSIGNED: 'text-indigo-700 dark:text-indigo-400',
    RESOLVED: 'text-emerald-700 dark:text-emerald-400',
    CLOSED: 'text-slate-600 dark:text-slate-500',
    LOW: 'text-slate-700 dark:text-slate-400',
    MEDIUM: 'text-amber-700 dark:text-amber-400',
    HIGH: 'text-orange-700 dark:text-orange-400',
    URGENT: 'text-rose-700 dark:text-rose-400',
  };

  const STATUS_BG: Record<string, string> = {
    PAID: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/40',
    UNPAID: 'bg-rose-50 dark:bg-red-950/40 border-rose-200 dark:border-red-900/40',
    PARTIAL: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/40',
    OVERDUE: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/40',
    OPEN: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/40',
    ASSIGNED: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/40',
    RESOLVED: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/40',
    CLOSED: 'bg-slate-100 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/40',
    LOW: 'bg-slate-100 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/40',
    MEDIUM: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/40',
    HIGH: 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900/40',
    URGENT: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/40',
  };

  const maxMonthly = monthlyTrend.length > 0 ? Math.max(...monthlyTrend.map(r => Number(r.totalCollected))) : 1;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-start overflow-x-hidden w-full py-4 sm:py-5 px-3 sm:px-5 lg:px-6">
      {/* Background */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="w-full max-w-[1600px] mx-auto space-y-3.5 z-10">

        {/* Header */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Reports & Analytics Center</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Society financial intelligence, occupancy, complaints & asset insights</p>
            </div>
          </div>
          <button
            onClick={() => fetchAll()}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-900 rounded-xl px-3 py-1.5 shadow-xs transition-all"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>

        {message && (
          <div className={`rounded-xl border p-3 text-sm flex items-center gap-2 shadow-xs ${message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-400' : 'bg-rose-50 dark:bg-red-950/30 border-rose-200 dark:border-red-900/50 text-rose-800 dark:text-red-400'}`}>
            {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'custom-sql') {
                  router.push(`/${society_slug}/reports/custom`);
                } else {
                  setActiveTab(tab.id);
                }
              }}
              className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-semibold shadow-xs transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 text-indigo-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* ── SUMMARY TAB (classic 3-tile view) ── */}
            {activeTab === 'summary' && (
              <div className="space-y-3.5">
                {/* Classic header note */}
                <div className="flex items-center gap-2 px-1">
                  <FileText className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                  <p className="text-xs text-slate-500">
                    Quick-glance tiles for collection metrics, defaulter registry, and flat occupancy — with CSV export.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">

                  {/* ── Collection Metrics ── */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950/20 p-4 space-y-3 shadow-xs">
                    <div className="flex justify-between items-center border-b border-slate-800/40 pb-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4 text-emerald-400" /> Collection Metrics
                      </h3>
                      <button
                        onClick={() => handleDownloadCSV('collection')}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 transition-colors"
                      >
                        Export <FileDown className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {collectionData.length === 0 ? (
                      <p className="text-xs text-slate-500 py-4 text-center">No collection data yet.</p>
                    ) : (
                      <ul className="divide-y divide-slate-800/40 text-xs">
                        {collectionData.map((row: any, idx: number) => (
                          <li key={idx} className="py-2.5 flex justify-between items-center gap-2">
                            <span className="text-slate-500 font-bold">
                              {row.paymentMode}
                              <span className="text-slate-600 font-normal ml-1">({row.count} txns)</span>
                            </span>
                            <span className="font-mono text-slate-200 font-semibold">₹ {Number(row.totalCollected).toLocaleString('en-IN')}</span>
                          </li>
                        ))}
                        <li className="py-2.5 flex justify-between items-center font-bold border-t-2 border-slate-700 mt-1 pt-3">
                          <span className="text-emerald-400">Total Collected</span>
                          <span className="font-mono text-emerald-300">₹ {totalCollected.toLocaleString('en-IN')}</span>
                        </li>
                      </ul>
                    )}
                  </div>

                  {/* ── Defaulters Registry ── */}
                  <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-6 space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-800/40 pb-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 text-red-400" /> Defaulters Registry
                      </h3>
                      <button
                        onClick={() => handleDownloadCSV('defaulter')}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 transition-colors"
                      >
                        Export <FileDown className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {defaulterData.length === 0 ? (
                      <p className="text-xs text-emerald-400 font-semibold py-4 text-center">🎉 No defaulters! All dues are cleared.</p>
                    ) : (
                      <ul className="divide-y divide-slate-800/40 text-xs">
                        {defaulterData.slice(0, 8).map((row: any, idx: number) => (
                          <li key={idx} className="py-2.5 flex justify-between items-center gap-2">
                            <span className="text-slate-500 font-bold">
                              Flat {row.flatNumber}
                              <span className="text-slate-600 font-normal ml-1">({row.unpaidCount} bills)</span>
                            </span>
                            <span className="font-mono text-red-400 font-semibold">₹ {Number(row.totalOutstanding).toLocaleString('en-IN')}</span>
                          </li>
                        ))}
                        {defaulterData.length > 8 && (
                          <li className="pt-2 text-center">
                            <button onClick={() => setActiveTab('defaulters')} className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold">
                              + {defaulterData.length - 8} more → View All
                            </button>
                          </li>
                        )}
                        <li className="py-2.5 flex justify-between items-center font-bold border-t-2 border-slate-700 mt-1 pt-3">
                          <span className="text-red-400">{defaulterData.length} Defaulter Flats</span>
                          <span className="font-mono text-red-300">₹ {totalOutstanding.toLocaleString('en-IN')}</span>
                        </li>
                      </ul>
                    )}
                  </div>

                  {/* ── Occupancy Ratios ── */}
                  <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-6 space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-800/40 pb-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-indigo-400" /> Occupancy Ratios
                      </h3>
                    </div>

                    {occupancyData.length === 0 ? (
                      <p className="text-xs text-slate-500 py-4 text-center">No occupancy data available.</p>
                    ) : (
                      <>
                        <ul className="divide-y divide-slate-800/40 text-xs">
                          {occupancyData.map((row: any, idx: number) => {
                            const total = occupancyData.reduce((s: number, r: any) => s + r.count, 0);
                            const colors = ['text-emerald-400', 'text-indigo-400', 'text-amber-400'];
                            const bars = ['bg-emerald-500', 'bg-indigo-500', 'bg-amber-500'];
                            return (
                              <li key={idx} className="py-2.5 space-y-1">
                                <div className="flex justify-between">
                                  <span className={`font-bold ${colors[idx % colors.length]}`}>{row.status.replace(/_/g, ' ')}</span>
                                  <span className="font-bold text-slate-200">{row.count} Flats</span>
                                </div>
                                <MiniBar value={row.count} max={total} color={bars[idx % bars.length]} />
                                <div className="text-[10px] text-slate-500 text-right">
                                  {total > 0 ? pct((row.count / total) * 100) : '0%'} of total
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                        <div className="border-t border-slate-800/40 pt-2 text-xs flex justify-between text-slate-500 font-semibold">
                          <span>Total Flats</span>
                          <span className="text-slate-300">{occupancyData.reduce((s: number, r: any) => s + r.count, 0)}</span>
                        </div>
                      </>
                    )}
                  </div>

                </div>
              </div>
            )}

            {/* ── OVERVIEW TAB ── */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* KPI Summary Tiles */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <StatCard label="Total Collected" value={`₹${(totalCollected/100000).toFixed(1)}L`} sub={`${totalTransactions} transactions`} icon={Wallet} color="text-emerald-400" trend="up" />
                  <StatCard label="Outstanding" value={`₹${(totalOutstanding/100000).toFixed(1)}L`} sub={`${totalDefaulters} defaulter flats`} icon={AlertTriangle} color="text-red-400" trend="down" />
                  <StatCard label="Collection Efficiency" value={pct(maintenanceStatus?.summary?.collectionEfficiency || 0)} sub="of total billed" icon={Activity} color="text-indigo-400" />
                  <StatCard label="Total Complaints" value={String(complaintsData?.summary?.total || 0)} sub={`${complaintsData?.summary?.resolutionRate || 0}% resolved`} icon={AlertCircle} color="text-amber-400" />
                  <StatCard label="Asset Net Value" value={`₹${fmt(assetData?.summary?.netBookValue || 0)}`} sub={`${assetData?.summary?.totalAssets || 0} assets`} icon={Package} color="text-violet-400" />
                  <StatCard label="Late Fees Collected" value={`₹${fmt(lateFeeData?.totalLateFeeCollected || 0)}`} sub={`₹${fmt(lateFeeData?.totalLateFeeWaived || 0)} waived`} icon={Clock} color="text-rose-400" />
                </div>

                {/* Monthly Trend Bar Chart */}
                <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4 text-emerald-400" /> 12-Month Collection Trend
                    </h3>
                    <button onClick={() => handleDownloadCSV('monthly-trend')} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                      Export CSV <FileDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {monthlyTrend.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">No collection data yet for the last 12 months.</p>
                  ) : (
                    <div className="flex gap-2 items-end h-32 mt-2">
                      {monthlyTrend.map((row, i) => {
                        const h = maxMonthly > 0 ? Math.max(4, Math.round((Number(row.totalCollected) / maxMonthly) * 100)) : 4;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                            <div
                              className="w-full bg-indigo-600/70 hover:bg-indigo-500 rounded-t transition-all"
                              style={{ height: `${h}%`, minHeight: '4px' }}
                            />
                            <span className="text-[9px] text-slate-600 group-hover:text-slate-400 font-mono transition-all">
                              {row.month?.slice(5)}
                            </span>
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 shadow-xl whitespace-nowrap text-[10px] text-slate-200 font-mono">
                              ₹{fmt(row.totalCollected)} • {row.count} receipts
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3-col summary row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                  {/* Collection by mode */}
                  <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-4 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <PieChart className="h-4 w-4 text-indigo-400" /> Payment Mode Split
                    </h3>
                    {collectionData.map((row, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400 font-semibold">{row.paymentMode}</span>
                          <span className="text-slate-200 font-mono">₹{fmt(row.totalCollected)}</span>
                        </div>
                        <MiniBar value={Number(row.totalCollected)} max={totalCollected} color="bg-indigo-500" />
                      </div>
                    ))}
                  </div>

                  {/* Complaints status */}
                  <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-4 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4 text-amber-400" /> Complaints Status
                    </h3>
                    {complaintsData.byStatus.map((row: any, i: number) => (
                      <div key={i} className="flex justify-between items-center text-xs">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_BG[row.status] || 'bg-slate-900/40 border-slate-800'} ${STATUS_COLORS[row.status] || 'text-slate-400'}`}>
                          {row.status}
                        </span>
                        <span className="font-bold text-slate-200">{row.count} complaints</span>
                      </div>
                    ))}
                    {complaintsData.byStatus.length === 0 && <p className="text-xs text-slate-500">No complaints data.</p>}
                  </div>

                  {/* Occupancy split */}
                  <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-4 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Building className="h-4 w-4 text-violet-400" /> Flat Occupancy
                    </h3>
                    {occupancyData.map((row, i) => {
                      const totalFlats = occupancyData.reduce((s, r) => s + r.count, 0);
                      const colors = ['bg-emerald-500', 'bg-indigo-500', 'bg-amber-500'];
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-400 font-semibold">{row.status.replace(/_/g, ' ')}</span>
                            <span className="text-slate-200 font-bold">{row.count} flats</span>
                          </div>
                          <MiniBar value={row.count} max={totalFlats} color={colors[i % colors.length]} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── COLLECTION TAB ── */}
            {activeTab === 'collection' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="Total Collected" value={`₹${fmt(totalCollected)}`} sub={`${totalTransactions} transactions`} icon={Wallet} color="text-emerald-400" />
                  <StatCard label="Online / Digital" value={`₹${fmt(collectionData.filter(r => ['UPI', 'RAZORPAY', 'NEFT', 'CARD'].includes(r.paymentMode)).reduce((s, r) => s + Number(r.totalCollected), 0))}`} sub="UPI, NEFT, Card, Razorpay" icon={Activity} color="text-indigo-400" />
                  <StatCard label="Cash Collections" value={`₹${fmt(collectionData.filter(r => r.paymentMode === 'CASH').reduce((s, r) => s + Number(r.totalCollected), 0))}`} sub="Physical cash received" icon={Coins} color="text-amber-400" />
                  <StatCard label="Cheque / NEFT" value={`₹${fmt(collectionData.filter(r => ['CHEQUE', 'NEFT'].includes(r.paymentMode)).reduce((s, r) => s + Number(r.totalCollected), 0))}`} sub="Bank instruments" icon={FileText} color="text-violet-400" />
                </div>

                {/* Monthly Trend */}
                <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4 text-emerald-400" /> Monthly Collection Trend (Last 12 Months)
                    </h3>
                    <button onClick={() => handleDownloadCSV('monthly-trend')} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">Export <FileDown className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead><tr className="border-b border-slate-800 text-slate-500 font-semibold">
                        <th className="p-2">Month</th>
                        <th className="p-2 text-right">Receipts</th>
                        <th className="p-2 text-right">Amount Collected</th>
                        <th className="p-2">Progress</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {monthlyTrend.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-slate-500">No data for the last 12 months.</td></tr>}
                        {monthlyTrend.map((row, i) => (
                          <tr key={i} className="text-slate-300 hover:bg-slate-900/30">
                            <td className="p-2 font-mono font-bold">{row.month}</td>
                            <td className="p-2 text-right text-indigo-400">{row.count}</td>
                            <td className="p-2 text-right font-mono font-bold text-emerald-400">₹{fmt(row.totalCollected)}</td>
                            <td className="p-2 w-40"><MiniBar value={Number(row.totalCollected)} max={maxMonthly} color="bg-emerald-500" /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Collection by Mode */}
                <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <PieChart className="h-4 w-4 text-indigo-400" /> Collection By Payment Mode
                    </h3>
                    <button onClick={() => handleDownloadCSV('collection')} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">Export <FileDown className="h-3.5 w-3.5" /></button>
                  </div>
                  {collectionData.map((row, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-20 text-xs font-bold text-slate-400 text-right">{row.paymentMode}</span>
                      <div className="flex-1 space-y-0.5">
                        <MiniBar value={Number(row.totalCollected)} max={totalCollected} color="bg-indigo-500" />
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>{row.count} transactions</span>
                          <span>{totalCollected > 0 ? pct((Number(row.totalCollected) / totalCollected) * 100) : '0%'}</span>
                        </div>
                      </div>
                      <span className="w-28 text-right text-xs font-mono font-bold text-slate-200">₹{fmt(row.totalCollected)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── MAINTENANCE / INVOICE STATUS TAB ── */}
            {activeTab === 'maintenance' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="Total Billed" value={`₹${fmt(maintenanceStatus?.summary?.totalBilled || 0)}`} icon={Receipt} color="text-slate-300" />
                  <StatCard label="Collected" value={`₹${fmt(maintenanceStatus?.summary?.totalCollected || 0)}`} sub="Fully paid invoices" icon={CheckCircle} color="text-emerald-400" />
                  <StatCard label="Outstanding" value={`₹${fmt(maintenanceStatus?.summary?.totalOutstanding || 0)}`} sub="Unpaid + Partial" icon={AlertTriangle} color="text-red-400" />
                  <StatCard label="Efficiency" value={pct(maintenanceStatus?.summary?.collectionEfficiency || 0)} sub="of total billed recovered" icon={Activity} color="text-indigo-400" />
                </div>

                <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Scale className="h-4 w-4 text-indigo-400" /> Invoice Status Breakdown
                    </h3>
                    <button onClick={() => handleDownloadCSV('maintenance-status')} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">Export <FileDown className="h-3.5 w-3.5" /></button>
                  </div>
                  {maintenanceStatus.breakdown.map((row: any, i: number) => (
                    <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${STATUS_BG[row.status] || 'bg-slate-900/40 border-slate-800'}`}>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className={`text-xs font-bold ${STATUS_COLORS[row.status] || 'text-slate-400'}`}>{row.status}</span>
                          <span className="text-xs text-slate-200 font-mono">₹{fmt(row.totalAmount)}</span>
                        </div>
                        <MiniBar value={Number(row.totalAmount)} max={maintenanceStatus.summary.totalBilled || 1} color={row.status === 'PAID' ? 'bg-emerald-500' : row.status === 'PARTIAL' ? 'bg-amber-500' : 'bg-red-500'} />
                        <div className="text-[10px] text-slate-500 mt-0.5">{row.count} invoices</div>
                      </div>
                    </div>
                  ))}
                  {maintenanceStatus.breakdown.length === 0 && <p className="text-xs text-slate-500 text-center py-4">No maintenance invoice data.</p>}
                </div>
              </div>
            )}

            {/* ── DEFAULTERS TAB ── */}
            {activeTab === 'defaulters' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <StatCard label="Defaulter Flats" value={String(totalDefaulters)} sub="with unpaid invoices" icon={ShieldAlert} color="text-red-400" />
                  <StatCard label="Total Outstanding" value={`₹${fmt(totalOutstanding)}`} sub="across all defaulters" icon={AlertTriangle} color="text-amber-400" />
                  <StatCard label="Avg Per Flat" value={`₹${fmt(totalDefaulters > 0 ? totalOutstanding / totalDefaulters : 0)}`} sub="average outstanding" icon={Coins} color="text-rose-400" />
                </div>

                <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-red-400" /> Defaulters Registry
                    </h3>
                    <button onClick={() => handleDownloadCSV('defaulter')} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">Export <FileDown className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead><tr className="border-b border-slate-800 text-slate-500 font-semibold">
                        <th className="p-2">Flat No.</th>
                        <th className="p-2 text-center">Unpaid Bills</th>
                        <th className="p-2 text-right">Outstanding (₹)</th>
                        <th className="p-2">Balance Bar</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {defaulterData.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-emerald-400 font-semibold">🎉 No defaulters! All flats are up to date.</td></tr>}
                        {defaulterData.sort((a, b) => Number(b.totalOutstanding) - Number(a.totalOutstanding)).map((row, i) => (
                          <tr key={i} className="text-slate-300 hover:bg-slate-900/30">
                            <td className="p-2 font-bold text-slate-100">Flat {row.flatNumber}</td>
                            <td className="p-2 text-center">
                              <span className="bg-red-950/60 border border-red-900/40 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{row.unpaidCount}</span>
                            </td>
                            <td className="p-2 text-right font-mono font-black text-red-400">₹{fmt(row.totalOutstanding)}</td>
                            <td className="p-2 w-32"><MiniBar value={Number(row.totalOutstanding)} max={totalOutstanding} color="bg-red-500" /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── COMPLAINTS TAB ── */}
            {activeTab === 'complaints' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="Total Complaints" value={String(complaintsData?.summary?.total || 0)} icon={AlertCircle} color="text-amber-400" />
                  <StatCard label="Resolved" value={String(complaintsData?.summary?.resolved || 0)} sub="closed or resolved" icon={CheckCircle} color="text-emerald-400" />
                  <StatCard label="Pending" value={String(complaintsData?.summary?.pending || 0)} sub="open or in-progress" icon={Clock} color="text-red-400" />
                  <StatCard label="Resolution Rate" value={pct(complaintsData?.summary?.resolutionRate || 0)} sub="of all complaints" icon={Activity} color="text-indigo-400" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950/20 p-5 space-y-3 shadow-xs">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300">By Status</h3>
                    {complaintsData.byStatus.map((row: any, i: number) => (
                      <div key={i} className={`flex justify-between items-center p-2.5 rounded-lg border text-xs ${STATUS_BG[row.status] || 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'}`}>
                        <span className={`font-bold ${STATUS_COLORS[row.status] || 'text-slate-700 dark:text-slate-400'}`}>{row.status}</span>
                        <span className="font-bold text-slate-900 dark:text-slate-200">{row.count} complaints</span>
                      </div>
                    ))}
                    {complaintsData.byStatus.length === 0 && <p className="text-xs text-slate-500">No complaints on record.</p>}
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950/20 p-5 space-y-3 shadow-xs">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300">By Priority</h3>
                    {complaintsData.byPriority.map((row: any, i: number) => (
                      <div key={i} className={`flex justify-between items-center p-2.5 rounded-lg border text-xs ${STATUS_BG[row.priority] || 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'}`}>
                        <span className={`font-bold ${STATUS_COLORS[row.priority] || 'text-slate-700 dark:text-slate-400'}`}>{row.priority}</span>
                        <span className="font-bold text-slate-900 dark:text-slate-200">{row.count} complaints</span>
                      </div>
                    ))}
                    {complaintsData.byPriority.length === 0 && <p className="text-xs text-slate-500">No priority data.</p>}
                  </div>
                </div>
              </div>
            )}

            {/* ── ASSETS TAB ── */}
            {activeTab === 'assets' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="Total Assets" value={String(assetData?.summary?.totalAssets || 0)} icon={Package} color="text-violet-600 dark:text-violet-400" />
                  <StatCard label="Purchase Value" value={`₹${fmt(assetData?.summary?.totalValue || 0)}`} sub="Original cost" icon={Coins} color="text-indigo-600 dark:text-indigo-400" />
                  <StatCard label="Depreciation" value={`₹${fmt(assetData?.summary?.totalDepreciation || 0)}`} sub="Cumulative to date" icon={ArrowDownRight} color="text-amber-600 dark:text-amber-400" />
                  <StatCard label="Net Book Value" value={`₹${fmt(assetData?.summary?.netBookValue || 0)}`} sub="After depreciation" icon={Scale} color="text-emerald-600 dark:text-emerald-400" />
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950/20 p-5 space-y-3 shadow-xs">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300 flex items-center gap-1.5">
                    <Package className="h-4 w-4 text-violet-600 dark:text-violet-400" /> Asset Register By Category
                  </h3>
                  {assetData.breakdown.length === 0 && <p className="text-xs text-slate-500 text-center py-4">No asset records found. Add assets in the Assets section.</p>}
                  {assetData.breakdown.map((row: any, i: number) => (
                    <div key={i} className="space-y-1 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                      <div className="flex justify-between text-xs">
                        <span className="font-bold text-slate-900 dark:text-slate-200">{row.category || 'Uncategorized'} <span className="text-slate-500 font-normal">({row.count} items)</span></span>
                        <span className="text-violet-600 dark:text-violet-400 font-mono font-bold">₹{fmt(row.totalValue)}</span>
                      </div>
                      <MiniBar value={Number(row.totalValue)} max={assetData.summary.totalValue || 1} color="bg-violet-500" />
                      <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
                        <span>Depreciation: ₹{fmt(row.totalDepreciation)}</span>
                        <span>Net: ₹{fmt(Number(row.totalValue) - Number(row.totalDepreciation))}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── LATE FEES TAB ── */}
            {activeTab === 'latefee' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="Late Fees Collected" value={`₹${fmt(lateFeeData?.totalLateFeeCollected || 0)}`} sub="Penalty income received" icon={Clock} color="text-rose-600 dark:text-rose-400" />
                  <StatCard label="Late Fees Waived" value={`₹${fmt(lateFeeData?.totalLateFeeWaived || 0)}`} sub="Society concessions granted" icon={Tag} color="text-amber-600 dark:text-amber-400" />
                  <StatCard label="Discounts Granted" value={`₹${fmt(lateFeeData?.totalDiscountsGranted || 0)}`} sub="Custom rebates applied" icon={Tag} color="text-indigo-600 dark:text-indigo-400" />
                  <StatCard label="Waivers Granted" value={String(lateFeeData?.waiversCount || 0)} sub={`of ${lateFeeData?.receiptCount || 0} total receipts`} icon={CheckCircle} color="text-violet-600 dark:text-violet-400" />
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950/20 p-5 space-y-4 shadow-xs">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300 flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-rose-600 dark:text-rose-400" /> Late Fee Summary
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { label: 'Total Late Fee Collected (Penalty Income)', value: `₹${fmt(lateFeeData?.totalLateFeeCollected || 0)}`, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/40' },
                      { label: 'Total Late Fee Waived (Society Forgiven)', value: `₹${fmt(lateFeeData?.totalLateFeeWaived || 0)}`, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/40' },
                      { label: 'Total Discounts Granted (Concessions)', value: `₹${fmt(lateFeeData?.totalDiscountsGranted || 0)}`, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900/40' },
                    ].map((item, i) => (
                      <div key={i} className={`p-4 rounded-xl border ${item.bg} text-center space-y-1 shadow-xs`}>
                        <div className={`text-2xl font-black ${item.color}`}>{item.value}</div>
                        <div className="text-[11px] font-medium text-slate-700 dark:text-slate-400">{item.label}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-3">
                    Configure late fee policy in <span className="text-indigo-600 dark:text-indigo-400 font-semibold">Maintenance → Formula & Settings → Late Fees & Overdue Penalty Policy</span>. Waivers and discounts can be applied per receipt when recording payments.
                  </p>
                </div>
              </div>
            )}

            {/* ── OCCUPANCY TAB ── */}
            {activeTab === 'occupancy' && (
              <div className="space-y-5">
                {(() => {
                  const totalFlats = occupancyData.reduce((s, r) => s + r.count, 0);
                  return (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <StatCard label="Total Flats" value={String(totalFlats)} icon={Building} color="text-slate-300" />
                        <StatCard label="Owner Occupied" value={String(occupancyData.find(r => r.status === 'OWNER_OCCUPIED')?.count || 0)} sub="Self-occupied units" icon={Users} color="text-emerald-400" />
                        <StatCard label="Tenant Occupied" value={String(occupancyData.find(r => r.status === 'TENANT_OCCUPIED')?.count || 0)} sub="Rented out units" icon={Users} color="text-indigo-400" />
                        <StatCard label="Vacant" value={String(occupancyData.find(r => r.status === 'VACANT')?.count || 0)} sub="Empty / unoccupied" icon={Building} color="text-amber-400" />
                      </div>

                      <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-5 space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                          <Building className="h-4 w-4 text-violet-400" /> Occupancy Distribution
                        </h3>
                        {occupancyData.map((row, i) => {
                          const colors = ['bg-emerald-500', 'bg-indigo-500', 'bg-amber-500'];
                          const textColors = ['text-emerald-400', 'text-indigo-400', 'text-amber-400'];
                          return (
                            <div key={i} className="space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className={`font-bold ${textColors[i % textColors.length]}`}>{row.status.replace(/_/g, ' ')}</span>
                                <span className="text-slate-200 font-bold">{row.count} flats ({totalFlats > 0 ? pct((row.count / totalFlats) * 100) : '0%'})</span>
                              </div>
                              <div className="w-full bg-slate-800/60 rounded-full h-3 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-700 ${colors[i % colors.length]}`}
                                  style={{ width: totalFlats > 0 ? `${(row.count / totalFlats) * 100}%` : '0%' }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
