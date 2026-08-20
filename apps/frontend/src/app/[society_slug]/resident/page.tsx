'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/auth-context';
import { apiClient } from '../../../lib/api/client';
import { 
  User, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  FileDown, 
  Eye, 
  Check, 
  X, 
  Vote, 
  Plus, 
  Car, 
  FileText, 
  Trash2, 
  Calendar, 
  Download, 
  ExternalLink,
  ShieldCheck,
  Building
} from 'lucide-react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Visitor {
  id: string;
  name: string;
  mobile: string;
  purpose: string;
  type?: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | string;
  entryTime?: string;
  gateNo?: string;
}

interface Vehicle {
  id: string;
  number: string;
  type: string;
  make?: string;
  model?: string;
}

interface DocumentItem {
  id: string;
  name: string;
  fileUrl: string;
  category: string;
  fileSize?: number;
  isPrivate?: boolean;
  createdAt: string;
}

interface Poll {
  id: string;
  question: string;
  description?: string;
  endDate: string;
  status: string;
  totalVotes?: number;
  yesVotes?: number;
  noVotes?: number;
  abstainVotes?: number;
  hasVoted?: boolean;
  userVote?: 'YES' | 'NO' | 'ABSTAIN' | null;
}

export default function ResidentDashboardPage() {
  const { society_slug } = useParams();
  const { activeSociety } = useAuth();
  
  const userRole = activeSociety?.role || '';
  const isManagementRole = [
    'SUPER_ADMIN', 
    'PRESIDENT', 
    'VICE_PRESIDENT', 
    'SECRETARY', 
    'JOINT_SECRETARY', 
    'TREASURER', 
    'ACCOUNTANT', 
    'COMMITTEE_MEMBER', 
    'ESTATE_MANAGER',
    'SOCIETY_ADMIN'
  ].includes(userRole);

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const getVehicleTypeBadge = (type: string) => {
    switch (type) {
      case 'EV_CAR':
        return (
          <span className="text-[10px] font-bold border border-emerald-800/80 bg-emerald-950/60 text-emerald-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            ⚡ EV Car
          </span>
        );
      case 'EV_TWO_WHEELER':
        return (
          <span className="text-[10px] font-bold border border-teal-800/80 bg-teal-950/60 text-teal-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            ⚡ EV 2-Wheeler
          </span>
        );
      case 'FOUR_WHEELER':
        return (
          <span className="text-[10px] font-semibold border border-indigo-900/60 bg-indigo-950/40 text-indigo-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            🚗 4-Wheeler
          </span>
        );
      case 'TWO_WHEELER':
        return (
          <span className="text-[10px] font-semibold border border-blue-900/60 bg-blue-950/40 text-blue-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            🛵 2-Wheeler
          </span>
        );
      case 'COMMERCIAL':
        return (
          <span className="text-[10px] font-semibold border border-amber-900/60 bg-amber-950/40 text-amber-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            🚐 Commercial
          </span>
        );
      case 'BICYCLE':
        return (
          <span className="text-[10px] font-semibold border border-purple-900/60 bg-purple-950/40 text-purple-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            🚲 Bicycle
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-semibold border border-slate-800 bg-slate-900 text-slate-300 px-2.5 py-0.5 rounded-full">
            {type?.replace('_', ' ') || 'Vehicle'}
          </span>
        );
    }
  };

  // Voting choices state
  const [selectedChoices, setSelectedChoices] = useState<Record<string, 'YES' | 'NO' | 'ABSTAIN'>>({});

  // Modals state
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [isAddDocOpen, setIsAddDocOpen] = useState(false);
  const [isCreatePollOpen, setIsCreatePollOpen] = useState(false);

  // Form states
  const [vehicleForm, setVehicleForm] = useState({
    number: '',
    type: 'FOUR_WHEELER',
    make: '',
    model: '',
  });

  const [docForm, setDocForm] = useState({
    name: '',
    category: 'CIRCULAR',
    fileUrl: '',
  });

  const [pollForm, setPollForm] = useState({
    question: '',
    description: '',
    endDate: new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10),
  });

  const fetchDashboard = async () => {
    if (!society_slug) return;
    try {
      setIsLoading(true);
      const res = await apiClient.get('/residents/dashboard');
      if (res.data?.success) {
        setDashboardData(res.data.data);
      }
    } catch (err) {
      console.warn('Dashboard fetch notice:', err);
      // Fallback default structure
      setDashboardData({
        outstanding: 0,
        visitors: [],
        vehicles: [],
        documents: [],
        polls: [],
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [society_slug]);

  // Visitor Gate Approval
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
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update visitor status.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Vote on Ballot
  const handleVoteSubmit = async (pollId: string) => {
    const choice = selectedChoices[pollId];
    if (!choice) {
      setMessage({ type: 'error', text: 'Select a voting option (YES, NO, or ABSTAIN) before submitting.' });
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
        text: err.response?.data?.message || 'Failed to cast ballot vote.' 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Register Vehicle
  const handleAddVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleForm.number.trim()) {
      setMessage({ type: 'error', text: 'Vehicle number is required.' });
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    try {
      const res = await apiClient.post('/residents/vehicles', vehicleForm);
      if (res.data?.success) {
        setMessage({ type: 'success', text: `Vehicle ${vehicleForm.number.toUpperCase()} registered successfully!` });
        setIsAddVehicleOpen(false);
        setVehicleForm({ number: '', type: 'FOUR_WHEELER', make: '', model: '' });
        fetchDashboard();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to register vehicle.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Remove Vehicle
  const handleDeleteVehicle = async (id: string, num: string) => {
    if (!confirm(`Are you sure you want to remove vehicle ${num}?`)) return;
    setIsProcessing(true);
    try {
      const res = await apiClient.delete(`/residents/vehicles/${id}`);
      if (res.data?.success) {
        setMessage({ type: 'success', text: `Vehicle ${num} removed.` });
        fetchDashboard();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to remove vehicle.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Publish Circular / Document
  const handleAddDocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docForm.name.trim() || !docForm.fileUrl.trim()) {
      setMessage({ type: 'error', text: 'Document name and valid URL are required.' });
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    try {
      const res = await apiClient.post('/residents/documents', docForm);
      if (res.data?.success) {
        setMessage({ type: 'success', text: `Document "${docForm.name}" published successfully!` });
        setIsAddDocOpen(false);
        setDocForm({ name: '', category: 'CIRCULAR', fileUrl: '' });
        fetchDashboard();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to publish document.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete Document
  const handleDeleteDoc = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    setIsProcessing(true);
    try {
      const res = await apiClient.delete(`/residents/documents/${id}`);
      if (res.data?.success) {
        setMessage({ type: 'success', text: `Document "${name}" deleted.` });
        fetchDashboard();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to delete document.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Create General Body Proposal / Poll
  const handleCreatePollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pollForm.question.trim() || !pollForm.endDate) {
      setMessage({ type: 'error', text: 'Proposal title and closing date are required.' });
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    try {
      const res = await apiClient.post('/residents/polls', pollForm);
      if (res.data?.success) {
        setMessage({ type: 'success', text: 'General body proposal created and opened for voting!' });
        setIsCreatePollOpen(false);
        setPollForm({
          question: '',
          description: '',
          endDate: new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10),
        });
        fetchDashboard();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to create proposal poll.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete / Close Proposal
  const handleDeletePoll = async (id: string, question: string) => {
    if (!confirm(`Are you sure you want to delete proposal "${question}"?`)) return;
    setIsProcessing(true);
    try {
      const res = await apiClient.delete(`/residents/polls/${id}`);
      if (res.data?.success) {
        setMessage({ type: 'success', text: 'Proposal deleted.' });
        fetchDashboard();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to delete proposal.' });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-start overflow-x-hidden w-full py-4 sm:py-5 px-3 sm:px-5 lg:px-6">
      {/* Background Grids */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      <div className="w-full max-w-[1600px] mx-auto space-y-3.5 z-10">
        
        {/* Header */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <User className="h-6 w-6 text-indigo-500 dark:text-indigo-400" />
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Resident Self-Service Portal</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Manage gate clearances, register vehicles, access shared circulars, and cast ballot votes</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setIsAddVehicleOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-all"
            >
              <Plus className="h-3.5 w-3.5" /> Add Vehicle
            </button>
            {isManagementRole && (
              <>
                <button
                  onClick={() => setIsAddDocOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-all shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5" /> Publish Circular
                </button>
                <button
                  onClick={() => setIsCreatePollOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs transition-all"
                >
                  <Vote className="h-3.5 w-3.5" /> Create Proposal
                </button>
              </>
            )}
          </div>
        </div>

        {message && (
          <div
            className={`rounded-xl border p-3 text-sm flex items-center gap-2 shadow-xs ${
              message.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-400'
                : 'bg-rose-50 dark:bg-red-950/30 border-rose-200 dark:border-red-900/50 text-rose-800 dark:text-red-400'
            }`}
          >
            {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {message.text}
          </div>
        )}

        {/* Dashboard Grid Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          
          {/* Outstanding Assessment Card */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950/20 p-3.5 sm:p-4 space-y-3 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">My Maintenance Balance</h3>
                {dashboardData?.flatNumber && (
                  <span className="text-[10px] bg-indigo-50 dark:bg-slate-900 border border-indigo-200 dark:border-slate-800 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full font-bold">
                    Flat {dashboardData.flatNumber}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
                  ₹ {Number(dashboardData?.outstanding || 0).toLocaleString('en-IN')}
                </span>
                {Number(dashboardData?.outstanding || 0) > 0 ? (
                  <span className="text-xs text-rose-500 dark:text-red-400 font-bold">Due</span>
                ) : (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">All Cleared</span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Includes calculated base maintenance, water utility rates, and late fee policies.
              </p>
            </div>
            
            <Link
              href={`/${society_slug}/maintenance?mine=true`}
              className="inline-flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-bold transition-all mt-4"
            >
              View Invoices & Pay Online <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Pre-Registered Vehicles Card */}
          <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Car className="h-4 w-4 text-indigo-400" /> Registered Vehicles
              </h3>
              <button
                onClick={() => setIsAddVehicleOpen(true)}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>

            {(!dashboardData?.vehicles || dashboardData.vehicles.length === 0) ? (
              <div className="text-center py-6 border border-dashed border-slate-800/80 rounded-lg space-y-1">
                <p className="text-xs text-slate-400">No vehicles registered</p>
                <p className="text-[10px] text-slate-500">Register your car/bike for security gate clearance.</p>
              </div>
            ) : (
              <ul className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                {dashboardData.vehicles.map((v: Vehicle) => (
                  <li key={v.id} className="text-xs text-slate-300 flex justify-between items-center bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60">
                    <div>
                      <p className="font-bold text-slate-200 font-mono">{v.number}</p>
                      <p className="text-[10px] text-slate-400">{v.make || ''} {v.model || ''}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getVehicleTypeBadge(v.type)}
                      <button
                        onClick={() => handleDeleteVehicle(v.id, v.number)}
                        className="text-slate-500 hover:text-red-400 p-1"
                        title="Remove vehicle"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Shared Society Files & Circulars */}
          <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-emerald-400" /> Circulars & Documents
              </h3>
              {isManagementRole && (
                <button
                  onClick={() => setIsAddDocOpen(true)}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Upload
                </button>
              )}
            </div>

            {(!dashboardData?.documents || dashboardData.documents.length === 0) ? (
              <div className="text-center py-6 border border-dashed border-slate-800/80 rounded-lg space-y-1">
                <p className="text-xs text-slate-400">No circulars published yet</p>
                <p className="text-[10px] text-slate-500">Official bye-laws and audited reports will appear here.</p>
              </div>
            ) : (
              <ul className="space-y-2 text-xs max-h-48 overflow-y-auto pr-1">
                {dashboardData.documents.map((doc: DocumentItem) => (
                  <li key={doc.id} className="flex justify-between items-center p-2 rounded-lg bg-slate-950/40 border border-slate-800/60 hover:border-slate-700 transition-all">
                    <div className="truncate pr-2">
                      <p className="text-slate-200 font-medium truncate">{doc.name}</p>
                      <span className="text-[9px] text-emerald-400/80 uppercase font-mono">{doc.category.replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 rounded bg-slate-900 border border-slate-800 text-indigo-400 hover:text-indigo-300"
                        title="Download / Open file"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      {isManagementRole && (
                        <button
                          onClick={() => handleDeleteDoc(doc.id, doc.name)}
                          className="p-1 rounded text-slate-500 hover:text-red-400"
                          title="Delete document"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Visitors Clearance and Active Voting Resolutions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Pre-Approvals Gates Checkpoint */}
          <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800/40 pb-2 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-sky-400" /> Visitor Pre-Approvals & Gate Checkpoints
            </h3>
            
            {(!dashboardData?.visitors || dashboardData.visitors.length === 0) ? (
              <p className="text-xs text-slate-500 py-6 text-center">No visitor gates activities or check-ins logged for your unit.</p>
            ) : (
              <ul className="divide-y divide-slate-800/40 text-xs">
                {dashboardData.visitors.map((vis: Visitor) => (
                  <li key={vis.id} className="py-3 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-200">{vis.name}</p>
                      <p className="text-[10px] text-slate-500">{vis.purpose || 'Visit'} • {vis.mobile}</p>
                    </div>

                    <div className="flex gap-2">
                      {vis.status === 'PENDING' ? (
                        <>
                          <button
                            onClick={() => handleVisitorDecision(vis.id, true)}
                            disabled={isProcessing}
                            className="bg-emerald-950/40 border border-emerald-800 text-emerald-400 rounded-lg px-2.5 py-1 text-[11px] font-bold hover:bg-emerald-900/40 transition-all flex items-center gap-1"
                          >
                            <Check className="h-3.5 w-3.5" /> Allow
                          </button>
                          <button
                            onClick={() => handleVisitorDecision(vis.id, false)}
                            disabled={isProcessing}
                            className="bg-red-950/40 border border-red-800 text-red-400 rounded-lg px-2.5 py-1 text-[11px] font-bold hover:bg-red-900/40 transition-all flex items-center gap-1"
                          >
                            <X className="h-3.5 w-3.5" /> Deny
                          </button>
                        </>
                      ) : (
                        <span className={`text-[10px] font-bold border rounded-full px-2.5 py-0.5 uppercase tracking-wider ${
                          vis.status === 'APPROVED' 
                            ? 'bg-emerald-950/30 border-emerald-800 text-emerald-400' 
                            : 'bg-red-950/30 border-red-800 text-red-400'
                        }`}>
                          {vis.status}
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
            <div className="flex items-center justify-between border-b border-slate-800/40 pb-2">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Vote className="h-4 w-4 text-purple-400" /> Active General Body Proposals & Polls
              </h3>
              {isManagementRole && (
                <button
                  onClick={() => setIsCreatePollOpen(true)}
                  className="text-[11px] text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> New Proposal
                </button>
              )}
            </div>
            
            {(!dashboardData?.polls || dashboardData.polls.length === 0) ? (
              <p className="text-xs text-slate-500 py-6 text-center">No active voting proposals scheduled currently.</p>
            ) : (
              <div className="space-y-4">
                {dashboardData.polls.map((p: Poll) => {
                  const total = (p.yesVotes || 0) + (p.noVotes || 0) + (p.abstainVotes || 0);
                  const yesPct = total > 0 ? Math.round(((p.yesVotes || 0) / total) * 100) : 0;
                  const noPct = total > 0 ? Math.round(((p.noVotes || 0) / total) * 100) : 0;
                  const absPct = total > 0 ? Math.round(((p.abstainVotes || 0) / total) * 100) : 0;

                  return (
                    <div key={p.id} className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl space-y-3 text-xs">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="font-bold text-slate-200 text-sm">
                            {p.question}
                          </h4>
                          {p.description && (
                            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{p.description}</p>
                          )}
                        </div>
                        {isManagementRole && (
                          <button
                            onClick={() => handleDeletePoll(p.id, p.question)}
                            className="text-slate-500 hover:text-red-400 p-1 shrink-0"
                            title="Delete proposal"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* If already voted or voting stats available */}
                      {p.hasVoted ? (
                        <div className="space-y-2 pt-2 border-t border-slate-800/60">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">
                              Your Vote: <strong className="text-indigo-400 uppercase">{p.userVote}</strong>
                            </span>
                            <span className="text-slate-500 font-mono">{total} vote{total !== 1 ? 's' : ''} cast</span>
                          </div>
                          
                          {/* Vote tally progress bar */}
                          <div className="w-full bg-slate-900 rounded-full h-2 flex overflow-hidden border border-slate-800">
                            <div style={{ width: `${yesPct}%` }} className="bg-emerald-500" title={`YES: ${yesPct}%`} />
                            <div style={{ width: `${noPct}%` }} className="bg-red-500" title={`NO: ${noPct}%`} />
                            <div style={{ width: `${absPct}%` }} className="bg-amber-500" title={`ABSTAIN: ${absPct}%`} />
                          </div>

                          <div className="flex justify-between text-[10px] text-slate-500 font-mono pt-1">
                            <span className="text-emerald-400 font-semibold">YES {yesPct}% ({p.yesVotes || 0})</span>
                            <span className="text-red-400 font-semibold">NO {noPct}% ({p.noVotes || 0})</span>
                            <span className="text-amber-400 font-semibold">ABSTAIN {absPct}% ({p.abstainVotes || 0})</span>
                          </div>
                        </div>
                      ) : (
                        /* Radio Options choice */
                        <div className="space-y-3 pt-2 border-t border-slate-800/60">
                          <div className="flex gap-4">
                            {['YES', 'NO', 'ABSTAIN'].map((choice) => (
                              <label key={choice} className="flex items-center gap-1.5 text-slate-300 font-semibold cursor-pointer text-xs">
                                <input
                                  type="radio"
                                  name={`poll-${p.id}`}
                                  value={choice}
                                  checked={selectedChoices[p.id] === choice}
                                  onChange={() => setSelectedChoices({ ...selectedChoices, [p.id]: choice as any })}
                                  className="text-indigo-600 focus:ring-indigo-500"
                                />
                                {choice}
                              </label>
                            ))}
                          </div>

                          <div className="flex justify-between items-center pt-1 text-[10px]">
                            <span className="text-slate-500">Closes: {p.endDate}</span>
                            <button
                              type="button"
                              onClick={() => handleVoteSubmit(p.id)}
                              disabled={isProcessing}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-bold transition-all disabled:opacity-50"
                            >
                              Cast Ballot Vote
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* MODAL 1: Add Vehicle                       */}
      {/* ========================================== */}
      {isAddVehicleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setIsAddVehicleOpen(false)} />
          <div className="relative w-full max-w-md max-h-[88dvh] sm:max-h-[90vh] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto z-10">
            {/* Pinned Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-100 dark:border-indigo-500/20">
                  <Car className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">Register Vehicle</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Add resident parking pass record</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddVehicleOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <form id="add-vehicle-form" onSubmit={handleAddVehicleSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold">License Plate / Vehicle Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MH 12 AB 1234"
                    value={vehicleForm.number}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, number: e.target.value })}
                    className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2.5 px-3.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 uppercase font-mono placeholder-slate-400 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold">Vehicle Type</label>
                  <select
                    value={vehicleForm.type}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, type: e.target.value })}
                    className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2.5 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs"
                  >
                    <option value="FOUR_WHEELER">🚗 Four Wheeler (Car / SUV)</option>
                    <option value="TWO_WHEELER">🛵 Two Wheeler (Scooter / Bike)</option>
                    <option value="EV_CAR">⚡ EV Car (Electric Vehicle)</option>
                    <option value="EV_TWO_WHEELER">⚡ EV Two Wheeler (Electric Bike)</option>
                    <option value="COMMERCIAL">🚐 Commercial Vehicle</option>
                    <option value="BICYCLE">🚲 Bicycle</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-semibold">Make / Brand</label>
                    <input
                      type="text"
                      placeholder="e.g. Tata / Honda"
                      value={vehicleForm.make}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })}
                      className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2.5 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-semibold">Model</label>
                    <input
                      type="text"
                      placeholder="e.g. Nexon EV / Activa"
                      value={vehicleForm.model}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                      className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2.5 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs"
                    />
                  </div>
                </div>
              </form>
            </div>

            {/* Pinned Footer */}
            <div className="flex-shrink-0 flex items-center justify-end gap-2.5 px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setIsAddVehicleOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-vehicle-form"
                disabled={isProcessing}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs disabled:opacity-50 cursor-pointer active:scale-95 transition-all"
              >
                Register Vehicle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 2: Publish Document / Circular       */}
      {/* ========================================== */}
      {isAddDocOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setIsAddDocOpen(false)} />
          <div className="relative w-full max-w-md max-h-[88dvh] sm:max-h-[90vh] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto z-10">
            {/* Pinned Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-600/20 border border-emerald-100 dark:border-emerald-500/20">
                  <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">Publish Circular / Document</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Share document with society residents</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddDocOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <form id="add-doc-form" onSubmit={handleAddDocSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold">Document Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AGM Notice & Agenda 2026 / Audited Balance Sheet"
                    value={docForm.name}
                    onChange={(e) => setDocForm({ ...docForm, name: e.target.value })}
                    className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2.5 px-3.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-emerald-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold">Category</label>
                  <select
                    value={docForm.category}
                    onChange={(e) => setDocForm({ ...docForm, category: e.target.value })}
                    className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2.5 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs"
                  >
                    <option value="CIRCULAR">General Society Circular</option>
                    <option value="BYE_LAW">Bye-Laws & Society Rules</option>
                    <option value="AUDIT_REPORT">Audited Financial Report</option>
                    <option value="MEETING_MINUTES">AGM / EGM Minutes</option>
                    <option value="MAINTENANCE_NOTICE">Maintenance & Tariff Notice</option>
                    <option value="CONTRACT">Vendor / AMC Contract</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold">File / Attachment URL *</label>
                  <input
                    type="url"
                    required
                    placeholder="https://drive.google.com/... or cloud storage URL"
                    value={docForm.fileUrl}
                    onChange={(e) => setDocForm({ ...docForm, fileUrl: e.target.value })}
                    className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2.5 px-3.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 font-mono focus:border-emerald-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Direct link to PDF, document, or spreadsheet.</p>
                </div>
              </form>
            </div>

            {/* Pinned Footer */}
            <div className="flex-shrink-0 flex items-center justify-end gap-2.5 px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setIsAddDocOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-doc-form"
                disabled={isProcessing}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs disabled:opacity-50 cursor-pointer active:scale-95 transition-all"
              >
                Publish Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 3: Create General Body Proposal      */}
      {/* ========================================== */}
      {isCreatePollOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setIsCreatePollOpen(false)} />
          <div className="relative w-full max-w-md max-h-[88dvh] sm:max-h-[90vh] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto z-10">
            {/* Pinned Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-600/20 border border-purple-100 dark:border-purple-500/20">
                  <Vote className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">Create General Body Proposal</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Launch resolution ballot vote for residents</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatePollOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <form id="create-poll-form" onSubmit={handleCreatePollSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold">Proposal / Resolution Question *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Upgrade clubhouse solar water heater infrastructure?"
                    value={pollForm.question}
                    onChange={(e) => setPollForm({ ...pollForm, question: e.target.value })}
                    className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2.5 px-3.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-purple-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold">Detailed Description & Budget Impact</label>
                  <textarea
                    rows={3}
                    placeholder="Proposed budget allocation of ₹4,50,000 funded via Sinking Fund reserves with 3-year AMC warranty."
                    value={pollForm.description}
                    onChange={(e) => setPollForm({ ...pollForm, description: e.target.value })}
                    className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-purple-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold">Voting Closing Date *</label>
                  <input
                    type="date"
                    required
                    value={pollForm.endDate}
                    onChange={(e) => setPollForm({ ...pollForm, endDate: e.target.value })}
                    className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2.5 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-purple-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs"
                  />
                </div>
              </form>
            </div>

            {/* Pinned Footer */}
            <div className="flex-shrink-0 flex items-center justify-end gap-2.5 px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setIsCreatePollOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="create-poll-form"
                disabled={isProcessing}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs disabled:opacity-50 cursor-pointer active:scale-95 transition-all"
              >
                Launch Proposal
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
