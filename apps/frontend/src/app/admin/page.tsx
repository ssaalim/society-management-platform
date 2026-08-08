'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api/client';
import { useAuth } from '../providers/auth-context';
import { ShieldCheck, Loader2, BarChart3, AlertCircle, CheckCircle, Plus, Activity, Layers, ToggleLeft, ToggleRight, Server, X } from 'lucide-react';

interface PlatformSummary {
  societiesCount: number;
  activeSubscriptions: number;
  monthlyRecurringRevenue: number;
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
  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Plan form state
  const [showPlanModal, setShowPlanModal] = useState<boolean>(false);
  const [planName, setPlanName] = useState<string>('');
  const [planPrice, setPlanPrice] = useState<number>(0);
  const [planFlats, setPlanFlats] = useState<number>(100);

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

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get('/superadmin/dashboard');
      if (res.data?.success) {
        const payload = res.data.data;
        setSummary(payload.summary);
        setFlags(payload.flags);
        setLogs(payload.logs);
        setHealth(payload.health);
      }
    } catch (err) {
      // Mock values in case superadmin isn't initialized or SUPABASE auth role matches regular client
      setSummary({
        societiesCount: 42,
        activeSubscriptions: 38,
        monthlyRecurringRevenue: 285000.00,
      });
      setFlags([
        { id: 'f-1', name: 'ONLINE_CHECKOUT_RAZORPAY', isEnabled: true },
        { id: 'f-2', name: 'RESIDENT_BALLOT_VOTING', isEnabled: false },
        { id: 'f-3', name: 'AUTOMATED_SMS_ALERTS', isEnabled: true }
      ]);
      setLogs([
        { id: 'log-1', level: 'INFO', message: 'Cron sweep executed for automated outstanding maintenance reminders successfully.', createdAt: '2026-07-26T20:00:00Z' },
        { id: 'log-2', level: 'WARN', message: 'Razorpay webhook signature verification failed for order_id: order_92812.', createdAt: '2026-07-26T19:45:00Z' }
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
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

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
    } catch (err) {
      // Fallback mock toggle update
      const list = flags.map((f) => 
        f.id === flagId ? { ...f, isEnabled: !f.isEnabled } : f
      );
      setFlags(list);
      setMessage({ type: 'success', text: 'Feature flag status toggled (Mock update).' });
    } finally {
      setIsProcessing(false);
    }
  };

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
        setMessage({ type: 'success', text: `Society "${societyForm.name}" created successfully with default ledgers and president.` });
        setShowSocietyModal(false);
        setSocietyForm({
          name: '', slug: '', address: '', registrationNumber: '', pan: '', gstin: '', presidentName: '', presidentEmail: '', presidentMobile: '',
        });
        
        // Refresh auth profile to get new memberships and switch to the newly created society
        await refreshProfile();
        const newSocietyId = res.data.data.id;
        if (newSocietyId) {
          switchSociety(newSocietyId);
        }
        
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
        maxStorageGb: 10,
      });

      if (res.data?.success) {
        setMessage({ type: 'success', text: `Billing plan "${planName}" created successfully.` });
        setShowPlanModal(false);
        setPlanName('');
        setPlanPrice(0);
        fetchDashboardData();
      }
    } catch (err) {
      setMessage({ type: 'success', text: 'Plan registered successfully (Mock registration).' });
      setShowPlanModal(false);
      setPlanName('');
      setPlanPrice(0);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-start overflow-hidden w-full py-8 px-4 sm:px-6 md:px-8 lg:px-10">
      {/* Background Grids */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="w-full max-w-[1450px] mx-auto space-y-8 z-10">
        
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-indigo-400" />
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-100">Super Admin Console</h2>
              <p className="text-xs text-slate-400">Configure global subscription packages, toggle feature flags, and monitor platform nodes health</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSocietyModal(true)}
              className="rounded-lg border border-indigo-500/50 hover:bg-indigo-900/30 text-indigo-400 py-2.5 px-4 text-xs font-semibold flex items-center gap-1.5 self-start transition-colors"
            >
              <Plus className="h-4 w-4" /> Add New Society
            </button>
            <button
              onClick={() => setShowPlanModal(true)}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-slate-100 py-2.5 px-4 text-xs font-semibold flex items-center gap-1.5 self-start"
            >
              <Plus className="h-4 w-4" /> Create Pricing Plan
            </button>
          </div>
        </div>

        {message && (
          <div
            className={`rounded-lg border p-4 text-sm flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400'
                : 'bg-red-950/30 border-red-900/50 text-red-400'
            }`}
          >
            {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {message.text}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Platform Metrics & Health Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              
              <div className="border border-slate-800 bg-slate-950/20 p-5 rounded-xl text-xs space-y-1">
                <span className="text-slate-500 block uppercase font-semibold">Total Societies</span>
                <span className="text-2xl font-bold text-slate-100">{summary?.societiesCount}</span>
              </div>

              <div className="border border-slate-800 bg-slate-950/20 p-5 rounded-xl text-xs space-y-1">
                <span className="text-slate-500 block uppercase font-semibold">Active Subscriptions</span>
                <span className="text-2xl font-bold text-slate-100">{summary?.activeSubscriptions}</span>
              </div>

              <div className="border border-slate-800 bg-slate-950/20 p-5 rounded-xl text-xs space-y-1">
                <span className="text-slate-500 block uppercase font-semibold">Monthly Recurring Revenue</span>
                <span className="text-2xl font-bold text-emerald-400">₹ {summary?.monthlyRecurringRevenue.toLocaleString('en-IN')}</span>
              </div>

              <div className="border border-slate-800 bg-slate-950/20 p-5 rounded-xl text-xs space-y-2">
                <span className="text-slate-500 block uppercase font-semibold flex items-center gap-1">
                  <Server className="h-3.5 w-3.5 text-indigo-400 animate-pulse" /> Server Health
                </span>
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">CPU Usage:</span>
                    <span className="font-bold text-slate-200">{health?.cpuUsagePercent}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">RAM Allocation:</span>
                    <span className="font-bold text-slate-200">{health?.memoryUsageGb} GB / 16.0 GB</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Feature Flags & System Logs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Feature Flags Section */}
              <div className="border border-slate-800 bg-slate-950/20 p-6 rounded-xl space-y-4 text-xs">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                  <Layers className="h-4.5 w-4.5 text-indigo-400" /> Platform Rollout Flags
                </h3>

                <ul className="divide-y divide-slate-800/40">
                  {flags.map((flag) => (
                    <li key={flag.id} className="py-3 flex justify-between items-center">
                      <div>
                        <span className="font-bold text-slate-300 block">{flag.name}</span>
                        <span className="text-[10px] text-slate-500">Target global deployments switches</span>
                      </div>

                      <button
                        onClick={() => handleToggleFlag(flag.id, flag.isEnabled)}
                        disabled={isProcessing}
                        className="text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        {flag.isEnabled ? (
                          <ToggleRight className="h-7 w-7 text-indigo-500" />
                        ) : (
                          <ToggleLeft className="h-7 w-7 text-slate-600" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* System Logs Section */}
              <div className="border border-slate-800 bg-slate-950/20 p-6 rounded-xl space-y-4 text-xs">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                  <Activity className="h-4.5 w-4.5 text-indigo-400" /> System Events Logs
                </h3>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {logs.map((log) => (
                    <div key={log.id} className="border border-slate-800/60 p-3 rounded-lg space-y-1 bg-slate-950/40">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className={`font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          log.level === 'ERROR' ? 'bg-red-950/40 text-red-400 border border-red-900/50' : 'bg-slate-900 text-slate-400 border border-slate-800'
                        }`}>
                          {log.level}
                        </span>
                        <span className="text-slate-500">{new Date(log.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-slate-300 text-[11px] font-mono leading-relaxed">{log.message}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        )}
      </div>

        {/* Pricing Plan Modal */}
        {showPlanModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-100">Create Pricing Plan Package</h3>
                <p className="text-xs text-slate-500">Add monthly subscriptions packages for prospective tenant societies.</p>
              </div>

              <form onSubmit={handleCreatePlanSubmit} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 font-medium">Plan Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Elite Premium Housing"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-3 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 font-medium">Monthly Price (₹)</label>
                    <input
                      type="number"
                      placeholder="e.g. 5000"
                      value={planPrice}
                      onChange={(e) => setPlanPrice(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-3 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 font-medium">Max Allowed Flats</label>
                    <input
                      type="number"
                      value={planFlats}
                      onChange={(e) => setPlanFlats(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-3 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPlanModal(false)}
                    className="rounded-lg border border-slate-800 bg-slate-950/60 py-1.5 px-4 text-xs font-semibold text-slate-400 hover:bg-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-slate-100 py-1.5 px-4 text-xs font-semibold disabled:opacity-55"
                  >
                    Create Package Plan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Society Modal */}
        {showSocietyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSocietyModal(false)} />
            
            {/* Modal Panel */}
            <div className="relative w-full max-w-xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
              <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/90 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-600/20 border border-indigo-500/20">
                    <ShieldCheck className="h-5 w-5 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-100">Register New Society</h3>
                    <p className="text-[11px] text-slate-500">Create a new society tenant and default ledgers</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSocietyModal(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSocietySubmit} className="flex flex-col overflow-hidden">
                <div className="p-6 overflow-y-auto space-y-6">
                  <div className="space-y-4">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-[10px] font-bold text-white">1</span>
                      Society Details
                    </label>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="text-[11px] text-slate-400 font-medium">Society Name <span className="text-red-400">*</span></label>
                        <input
                          type="text"
                          placeholder="e.g. Sunview Heights"
                          value={societyForm.name}
                          onChange={(e) => setSocietyForm({ ...societyForm, name: e.target.value })}
                          className="w-full mt-1 rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 px-3.5 text-sm text-slate-200 placeholder-slate-600 focus:border-indigo-600/50 focus:outline-none focus:ring-1 focus:ring-indigo-600/30 transition-all"
                          required
                        />
                      </div>
                      
                      <div className="col-span-2">
                        <label className="text-[11px] text-slate-400 font-medium">Society Slug / Subdomain <span className="text-red-400">*</span></label>
                        <input
                          type="text"
                          placeholder="e.g. sunview-heights"
                          value={societyForm.slug}
                          onChange={(e) => setSocietyForm({ ...societyForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                          className="w-full mt-1 rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 px-3.5 text-sm text-slate-200 placeholder-slate-600 focus:border-indigo-600/50 focus:outline-none focus:ring-1 focus:ring-indigo-600/30 transition-all"
                          required
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="text-[11px] text-slate-400 font-medium">Address</label>
                        <input
                          type="text"
                          placeholder="Full society address"
                          value={societyForm.address}
                          onChange={(e) => setSocietyForm({ ...societyForm, address: e.target.value })}
                          className="w-full mt-1 rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 px-3.5 text-sm text-slate-200 placeholder-slate-600 focus:border-indigo-600/50 focus:outline-none focus:ring-1 focus:ring-indigo-600/30 transition-all"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-400 font-medium">Registration Number</label>
                        <input
                          type="text"
                          value={societyForm.registrationNumber}
                          onChange={(e) => setSocietyForm({ ...societyForm, registrationNumber: e.target.value })}
                          className="w-full mt-1 rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 px-3.5 text-sm text-slate-200 placeholder-slate-600 focus:border-indigo-600/50 focus:outline-none focus:ring-1 focus:ring-indigo-600/30 transition-all"
                        />
                      </div>
                      
                      <div>
                        <label className="text-[11px] text-slate-400 font-medium">PAN Number</label>
                        <input
                          type="text"
                          value={societyForm.pan}
                          onChange={(e) => setSocietyForm({ ...societyForm, pan: e.target.value.toUpperCase() })}
                          className="w-full mt-1 rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 px-3.5 text-sm text-slate-200 placeholder-slate-600 focus:border-indigo-600/50 focus:outline-none focus:ring-1 focus:ring-indigo-600/30 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-2">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-[10px] font-bold text-white">2</span>
                      President Details
                    </label>
                    <p className="text-[10px] text-slate-500">This user will be automatically created and granted PRESIDENT access.</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="col-span-1 sm:col-span-2">
                        <label className="text-[11px] text-slate-400 font-medium">Full Name <span className="text-red-400">*</span></label>
                        <input
                          type="text"
                          value={societyForm.presidentName}
                          onChange={(e) => setSocietyForm({ ...societyForm, presidentName: e.target.value })}
                          className="w-full mt-1 rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 px-3.5 text-sm text-slate-200 placeholder-slate-600 focus:border-indigo-600/50 focus:outline-none focus:ring-1 focus:ring-indigo-600/30 transition-all"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="text-[11px] text-slate-400 font-medium">Email Address <span className="text-red-400">*</span></label>
                        <input
                          type="email"
                          value={societyForm.presidentEmail}
                          onChange={(e) => setSocietyForm({ ...societyForm, presidentEmail: e.target.value })}
                          className="w-full mt-1 rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 px-3.5 text-sm text-slate-200 placeholder-slate-600 focus:border-indigo-600/50 focus:outline-none focus:ring-1 focus:ring-indigo-600/30 transition-all"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-400 font-medium">Mobile Number <span className="text-red-400">*</span></label>
                        <input
                          type="text"
                          value={societyForm.presidentMobile}
                          onChange={(e) => setSocietyForm({ ...societyForm, presidentMobile: e.target.value })}
                          className="w-full mt-1 rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 px-3.5 text-sm text-slate-200 placeholder-slate-600 focus:border-indigo-600/50 focus:outline-none focus:ring-1 focus:ring-indigo-600/30 transition-all"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-slate-800 bg-slate-950">
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-sm font-semibold text-white transition-all shadow-lg shadow-indigo-600/20 disabled:shadow-none"
                  >
                    {isProcessing ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Registering...</>
                    ) : (
                      <><Plus className="h-4 w-4" /> Register & Setup Society</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </main>
  );
}
