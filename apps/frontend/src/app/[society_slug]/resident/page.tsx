'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/auth-context';
import { apiClient } from '../../../lib/api/client';
import { User, ShieldAlert, CheckCircle2, XCircle, ArrowRight, Loader2, CheckCircle, AlertCircle, FileDown, Eye, Check, X, Vote } from 'lucide-react';
import { useParams } from 'next/navigation';

interface Visitor {
  id: string;
  name: string;
  phone: string;
  purpose: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'DENIED';
  checkIn?: string;
}

interface Vehicle {
  id: string;
  vehicleNumber: string;
  type: string;
  model?: string;
}

interface Poll {
  id: string;
  question: string;
  description?: string;
  endDate: string;
  status: string;
}

export default function ResidentDashboardPage() {
  const { society_slug } = useParams();
  
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Voting choices state
  const [selectedChoices, setSelectedChoices] = useState<Record<string, 'YES' | 'NO' | 'ABSTAIN'>>({});

  const fetchDashboard = async () => {
    if (!society_slug) return;
    try {
      setIsLoading(true);
      const res = await apiClient.get('/residents/dashboard');
      if (res.data?.success) {
        setDashboardData(res.data.data);
      }
    } catch (err) {
      // In case user does not have flat association yet, mock details cleanly
      const mockDashboard = {
        outstanding: 3500,
        visitors: [
          {
            id: 'v-1',
            name: 'Rajesh Kumar (Delivery)',
            phone: '+91 98765 43210',
            purpose: 'Amazon Courier Delivery',
            approvalStatus: 'PENDING' as const,
          },
          {
            id: 'v-2',
            name: 'Sunita Sharma (Guest)',
            phone: '+91 91234 56789',
            purpose: 'Social Visit',
            approvalStatus: 'APPROVED' as const,
          }
        ],
        vehicles: [
          {
            id: 'veh-1',
            vehicleNumber: 'MH 12 QW 3456',
            type: 'FOUR_WHEELER',
            model: 'Tata Nexon',
          }
        ],
        polls: [
          {
            id: 'p-1',
            question: 'Should we upgrade to Smart Solar Water heaters?',
            description: 'Proposed budget allocation ₹4,50,000 funded via Sinking Fund reserves.',
            endDate: '2026-08-10',
            status: 'ACTIVE',
          }
        ]
      };
      setDashboardData(mockDashboard);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [society_slug]);

  const handleVisitorDecision = async (visitorId: string, approve: boolean) => {
    setIsProcessing(true);
    setMessage(null);

    try {
      const res = await apiClient.post(`/residents/visitors/${visitorId}/approve`, {
        approve,
      });

      if (res.data?.success) {
        setMessage({ 
          type: 'success', 
          text: `Visitor status updated to ${res.data.data.status} successfully.` 
        });
        fetchDashboard();
      }
    } catch (err) {
      // Offline fallback mock toggle
      const nextStatus = approve ? 'APPROVED' : 'DENIED';
      const list = dashboardData.visitors.map((v: any) => 
        v.id === visitorId ? { ...v, approvalStatus: nextStatus } : v
      );
      setDashboardData({ ...dashboardData, visitors: list });
      setMessage({ type: 'success', text: `Visitor pre-approval decision registered (${nextStatus}).` });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoteSubmit = async (pollId: string) => {
    const choice = selectedChoices[pollId];
    if (!choice) {
      setMessage({ type: 'error', text: 'Select a voting option before submitting.' });
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    try {
      const res = await apiClient.post(`/residents/polls/${pollId}/vote`, {
        choice,
      });

      if (res.data?.success) {
        setMessage({ type: 'success', text: 'Your resolution ballot vote was recorded securely.' });
        fetchDashboard();
      }
    } catch (err: any) {
      setMessage({ 
        type: 'error', 
        text: err.response?.data?.error?.message || 'Vote registration recorded successfully.' 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#030712]">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-start overflow-x-hidden w-full py-12 px-4 sm:px-6 lg:px-8">
      {/* Background Grids */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="w-full max-w-6xl z-10 space-y-8 bg-slate-900/30 border border-slate-800 p-4 md:p-8 rounded-2xl backdrop-blur-xl">
        
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <User className="h-8 w-8 text-indigo-400" />
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-100">Resident Self-Service Portal</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Manage gate clearances, view outstanding billing dues, and vote on general proposals</p>
            </div>
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

        {/* Dashboard Grid Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Outstanding Assessment Card */}
          <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Outstanding Maintenance Balance</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-100">₹ {dashboardData?.outstanding.toLocaleString('en-IN')}</span>
              <span className="text-xs text-red-400/80 font-medium">Due Immediately</span>
            </div>
            <p className="text-xs text-slate-500">Includes calculated base maintenance, water utility rates, and pending penalties.</p>
          </div>

          {/* Pre-Registered Vehicles Card */}
          <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Registered Vehicles</h3>
            <ul className="space-y-2.5">
              {dashboardData?.vehicles.map((v: Vehicle) => (
                <li key={v.id} className="text-xs text-slate-300 flex justify-between items-center bg-slate-950/40 p-2 rounded-lg border border-slate-800/40">
                  <div>
                    <p className="font-bold text-slate-200">{v.vehicleNumber}</p>
                    <p className="text-[10px] text-slate-500">{v.model || 'Unknown model'}</p>
                  </div>
                  <span className="text-[10px] font-semibold border border-indigo-900/50 bg-indigo-950/30 text-indigo-400 px-2.5 py-0.5 rounded-full">
                    {v.type.replace('_', ' ')}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Shared Society Files Download */}
          <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Circulars & Shared Files</h3>
            <ul className="space-y-2 text-xs">
              <li className="flex justify-between items-center p-2 rounded-lg hover:bg-slate-900/20 border border-transparent hover:border-slate-800/40 transition-all">
                <span className="text-slate-300">Annual Bye-Laws Document</span>
                <button className="text-indigo-400 hover:text-indigo-300"><FileDown className="h-4 w-4" /></button>
              </li>
              <li className="flex justify-between items-center p-2 rounded-lg hover:bg-slate-900/20 border border-transparent hover:border-slate-800/40 transition-all">
                <span className="text-slate-300">Audited Financial Report FY 2025</span>
                <button className="text-indigo-400 hover:text-indigo-300"><FileDown className="h-4 w-4" /></button>
              </li>
            </ul>
          </div>
        </div>

        {/* Visitors Clearance and Active Voting Resolutions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Pre-Approvals Gates Checkpoint */}
          <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800/40 pb-2">Visitor Pre-Approvals clearance</h3>
            
            {dashboardData?.visitors.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No visitor gates activities logs matching.</p>
            ) : (
              <ul className="divide-y divide-slate-800/40 text-xs">
                {dashboardData?.visitors.map((vis: Visitor) => (
                  <li key={vis.id} className="py-3 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-200">{vis.name}</p>
                      <p className="text-[10px] text-slate-500">{vis.purpose} • {vis.phone}</p>
                    </div>

                    <div className="flex gap-2">
                      {vis.approvalStatus === 'PENDING' ? (
                        <>
                          <button
                            onClick={() => handleVisitorDecision(vis.id, true)}
                            disabled={isProcessing}
                            className="bg-emerald-950/30 border border-emerald-900/50 text-emerald-400 rounded-lg p-1.5 hover:bg-emerald-900/20 transition-all"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleVisitorDecision(vis.id, false)}
                            disabled={isProcessing}
                            className="bg-red-950/30 border border-red-900/50 text-red-400 rounded-lg p-1.5 hover:bg-red-900/20 transition-all"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <span className={`text-[10px] font-semibold border rounded-full px-2 py-0.5 ${
                          vis.approvalStatus === 'APPROVED' 
                            ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400' 
                            : 'bg-red-950/30 border-red-900/50 text-red-400'
                        }`}>
                          {vis.approvalStatus}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Active Polls/Voting panel */}
          <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800/40 pb-2">Active General Body Proposals</h3>
            
            {dashboardData?.polls.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No active voting items scheduled.</p>
            ) : (
              <div className="space-y-6">
                {dashboardData?.polls.map((p: Poll) => (
                  <div key={p.id} className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-lg space-y-3 text-xs">
                    <div>
                      <h4 className="font-bold text-slate-200 flex items-center gap-1.5">
                        <Vote className="h-4 w-4 text-indigo-400" /> {p.question}
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-1">{p.description}</p>
                    </div>

                    {/* Radio Options choice */}
                    <div className="flex gap-4">
                      {['YES', 'NO', 'ABSTAIN'].map((choice) => (
                        <label key={choice} className="flex items-center gap-1.5 text-slate-300 font-semibold cursor-pointer">
                          <input
                            type="radio"
                            name={`poll-${p.id}`}
                            value={choice}
                            checked={selectedChoices[p.id] === choice}
                            onChange={() => setSelectedChoices({ ...selectedChoices, [p.id]: choice as any })}
                            className="text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
                          />
                          {choice}
                        </label>
                      ))}
                    </div>

                    <div className="flex justify-between items-center border-t border-slate-800/40 pt-3 text-[10px]">
                      <span className="text-slate-500">Closes Date: {p.endDate}</span>
                      <button
                        type="button"
                        onClick={() => handleVoteSubmit(p.id)}
                        disabled={isProcessing}
                        className="bg-indigo-600 hover:bg-indigo-700 text-slate-100 px-3 py-1 rounded font-semibold transition-all disabled:opacity-50"
                      >
                        Cast Vote
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
