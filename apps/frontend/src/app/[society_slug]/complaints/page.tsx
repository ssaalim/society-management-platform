'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/auth-context';
import { apiClient } from '../../../lib/api/client';
import { 
  ShieldAlert, 
  Search, 
  Filter, 
  ShieldCheck, 
  Plus, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  ArrowUpRight, 
  MessageSquare, 
  Star, 
  X, 
  AlertTriangle,
  UserCheck,
  Wrench,
  Check,
  Clock,
  Building,
  User,
  CheckCircle2,
  Users,
  Trash2,
  Phone,
  Briefcase
} from 'lucide-react';
import { useParams } from 'next/navigation';

interface Complaint {
  id: string;
  title: string;
  description: string;
  status: 'OPEN' | 'ASSIGNED' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  flatNumber?: string;
  raisedByName?: string;
  raisedByEmail?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  resolutionComment?: string;
  resolvedAt?: string;
  residentFeedback?: string;
  rating?: number;
  escalationLevel: number;
  createdAt: string;
  updatedAt?: string;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
  phone?: string;
  salary?: string;
  isAvailable?: boolean;
}

export default function ComplaintManagementPage() {
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
    'ESTATE_MANAGER', 
    'MAINTENANCE_INCHARGE',
    'COMMITTEE_MEMBER'
  ].includes(userRole);

  const [ticketsList, setTicketsList] = useState<Complaint[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters state
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isStaffManagerOpen, setIsStaffManagerOpen] = useState<boolean>(false);
  const [isInlineAddStaff, setIsInlineAddStaff] = useState<boolean>(false);
  const [activeAssignTicket, setActiveAssignTicket] = useState<Complaint | null>(null);
  const [activeResolveTicket, setActiveResolveTicket] = useState<Complaint | null>(null);
  const [activeFeedbackTicket, setActiveFeedbackTicket] = useState<Complaint | null>(null);

  // Form states
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [newPriority, setNewPriority] = useState<string>('MEDIUM');
  const [selectedFlatId, setSelectedFlatId] = useState<string>('');
  const [flatsList, setFlatsList] = useState<Array<{ id: string; number: string; floor?: number }>>([]);

  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [customStaffName, setCustomStaffName] = useState<string>('');

  // Staff creation form
  const [staffForm, setStaffForm] = useState({
    name: '',
    mobile: '',
    role: 'ELECTRICIAN',
    salary: '',
  });

  const [resolutionComment, setResolutionComment] = useState<string>('');

  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackText, setFeedbackText] = useState<string>('');

  const fetchTickets = async () => {
    if (!society_slug) return;
    try {
      setIsLoading(true);
      const urlParams = new URLSearchParams();
      if (statusFilter) urlParams.append('status', statusFilter);
      if (priorityFilter) urlParams.append('priority', priorityFilter);

      const res = await apiClient.get(`/complaints?${urlParams.toString()}`);
      if (res.data?.success) {
        setTicketsList(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to load tickets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStaffList = async () => {
    try {
      const res = await apiClient.get('/staff');
      if (res.data?.success) {
        setStaffList(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to load staff list:', err);
    }
  };

  const fetchFlats = async () => {
    try {
      const res = await apiClient.get('/flats');
      if (res.data?.success) {
        setFlatsList(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to load flats list:', err);
    }
  };

  useEffect(() => {
    fetchTickets();
    fetchStaffList();
    fetchFlats();
  }, [society_slug, statusFilter, priorityFilter]);

  // Handle Create Complaint
  const handleCreateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim()) return;

    setIsProcessing(true);
    setMessage(null);

    try {
      const res = await apiClient.post('/complaints', {
        title: newTitle,
        description: newDescription,
        priority: newPriority,
        flatId: selectedFlatId || undefined,
      });

      if (res.data?.success) {
        setMessage({ type: 'success', text: 'Complaint ticket raised successfully.' });
        setIsCreateOpen(false);
        setNewTitle('');
        setNewDescription('');
        setSelectedFlatId('');
        fetchTickets();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to create complaint.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Create Staff Member
  const handleCreateStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.name.trim() || !staffForm.mobile.trim()) {
      setMessage({ type: 'error', text: 'Staff full name and mobile phone are required.' });
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    try {
      const res = await apiClient.post('/staff', staffForm);
      if (res.data?.success) {
        const createdStaff = res.data.data;
        setMessage({ 
          type: 'success', 
          text: `Staff member ${createdStaff.name} (${createdStaff.role}) registered successfully!` 
        });
        setStaffForm({ name: '', mobile: '', role: 'ELECTRICIAN', salary: '' });
        await fetchStaffList();

        // If inside assign modal, auto select
        if (activeAssignTicket) {
          setSelectedStaffId(createdStaff.id);
          setIsInlineAddStaff(false);
        }
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to register staff member.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Delete Staff Member
  const handleDeleteStaff = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove staff member ${name}?`)) return;
    setIsProcessing(true);
    try {
      const res = await apiClient.delete(`/staff/${id}`);
      if (res.data?.success) {
        setMessage({ type: 'success', text: `Staff member ${name} removed.` });
        fetchStaffList();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to remove staff member.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Assign Staff
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAssignTicket) return;

    const staffMember = staffList.find((s) => s.id === selectedStaffId);
    const staffName = staffMember ? `${staffMember.name} (${staffMember.role})` : customStaffName;

    setIsProcessing(true);
    setMessage(null);

    try {
      const res = await apiClient.post(`/complaints/${activeAssignTicket.id}/assign`, {
        staffId: selectedStaffId || undefined,
        staffName: staffName || undefined,
      });

      if (res.data?.success) {
        setMessage({ 
          type: 'success', 
          text: `Ticket assigned to ${staffName || 'selected staff'} successfully.` 
        });
        setActiveAssignTicket(null);
        setSelectedStaffId('');
        setCustomStaffName('');
        setIsInlineAddStaff(false);
        fetchTickets();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to assign staff.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Resolve Complaint
  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeResolveTicket || !resolutionComment.trim()) return;

    setIsProcessing(true);
    setMessage(null);

    try {
      const res = await apiClient.post(`/complaints/${activeResolveTicket.id}/resolve`, {
        resolutionComment,
      });

      if (res.data?.success) {
        setMessage({ type: 'success', text: 'Resolution comments recorded. Ticket marked as RESOLVED.' });
        setActiveResolveTicket(null);
        setResolutionComment('');
        fetchTickets();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to resolve ticket.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Feedback / Close Ticket
  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFeedbackTicket) return;

    setIsProcessing(true);
    setMessage(null);

    try {
      const res = await apiClient.post(`/complaints/${activeFeedbackTicket.id}/feedback`, {
        feedback: feedbackText,
        rating: feedbackRating,
      });

      if (res.data?.success) {
        setMessage({ type: 'success', text: 'Feedback registered successfully. Complaint CLOSED.' });
        setActiveFeedbackTicket(null);
        setFeedbackText('');
        fetchTickets();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to submit feedback.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Escalate
  const handleEscalate = async (ticketId: string) => {
    setIsProcessing(true);
    setMessage(null);

    try {
      const res = await apiClient.post(`/complaints/${ticketId}/escalate`);
      if (res.data?.success) {
        setMessage({ type: 'success', text: `Ticket escalated to Level ${res.data.data.escalationLevel}.` });
        fetchTickets();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to escalate ticket.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Filtered tickets list
  const filteredTickets = ticketsList.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.flatNumber?.toLowerCase().includes(q) ||
      t.assignedStaffName?.toLowerCase().includes(q) ||
      t.raisedByName?.toLowerCase().includes(q)
    );
  });

  const openCount = ticketsList.filter((t) => t.status === 'OPEN').length;
  const assignedCount = ticketsList.filter((t) => t.status === 'ASSIGNED').length;
  const resolvedCount = ticketsList.filter((t) => t.status === 'RESOLVED').length;
  const closedCount = ticketsList.filter((t) => t.status === 'CLOSED').length;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-start overflow-x-hidden w-full py-8 px-4 sm:px-6 md:px-8 lg:px-10">
      {/* Background Grids */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="w-full max-w-[1450px] mx-auto space-y-8 z-10">
        
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-indigo-400" />
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-100">Complaints & Tickets Center</h2>
              <p className="text-xs text-slate-400">Raise maintenance tickets, assign technicians, manage society staff team, and track resolutions</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isManagementRole && (
              <button
                onClick={() => setIsStaffManagerOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 py-2.5 px-3.5 text-xs font-semibold shadow transition-all"
              >
                <Users className="h-4 w-4 text-sky-400" /> Staff & Technicians ({staffList.length})
              </button>
            )}

            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-slate-100 py-2.5 px-4 text-xs font-semibold shadow transition-all"
            >
              <Plus className="h-4 w-4" /> Raise Complaint
            </button>
          </div>
        </div>

        {/* Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <span className="text-xs text-slate-400 font-semibold">Open Complaints</span>
            <p className="text-2xl font-black text-amber-400 mt-1">{openCount}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <span className="text-xs text-slate-400 font-semibold">Assigned & In-Progress</span>
            <p className="text-2xl font-black text-sky-400 mt-1">{assignedCount}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <span className="text-xs text-slate-400 font-semibold">Resolved (Pending Feedback)</span>
            <p className="text-2xl font-black text-emerald-400 mt-1">{resolvedCount}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <span className="text-xs text-slate-400 font-semibold">Closed & Rated</span>
            <p className="text-2xl font-black text-slate-300 mt-1">{closedCount}</p>
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

        {/* Search & Filters */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 bg-slate-950/40 border border-slate-800 p-4 rounded-xl">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by title, flat, assignee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 pl-9 pr-3.5 text-sm text-slate-200 focus:border-indigo-600 focus:outline-none"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-indigo-600 focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          <div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-indigo-600 focus:outline-none"
            >
              <option value="">All Priorities</option>
              <option value="LOW">Low Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="HIGH">High Priority</option>
              <option value="URGENT">Urgent Priority</option>
            </select>
          </div>
        </div>

        {/* Tickets Grid */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-slate-800 rounded-xl space-y-3">
            <ShieldAlert className="h-10 w-10 text-slate-500 mx-auto" />
            <h3 className="text-md font-semibold text-slate-300">No complaint tickets found</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">No tickets match the selected filters or query.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredTickets.map((ticket) => (
              <div key={ticket.id} className="border border-slate-800 bg-slate-950/30 p-6 rounded-2xl space-y-4 text-xs text-slate-300 relative flex flex-col justify-between">
                
                <div className="space-y-3">
                  {/* Meta Badges */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-[10px] font-bold border rounded-full px-2.5 py-0.5 uppercase tracking-wider ${
                        ticket.priority === 'HIGH' || ticket.priority === 'URGENT'
                          ? 'bg-red-950/40 border-red-900/60 text-red-400'
                          : 'bg-indigo-950/40 border-indigo-900/60 text-indigo-400'
                      }`}>
                        {ticket.priority}
                      </span>
                      {ticket.flatNumber && (
                        <span className="text-[10px] font-semibold bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Building className="h-3 w-3 text-indigo-400" /> Flat {ticket.flatNumber}
                        </span>
                      )}
                      {ticket.escalationLevel > 0 && (
                        <span className="text-[10px] font-bold border border-amber-900/50 bg-amber-950/40 text-amber-400 rounded-full px-2.5 py-0.5 uppercase">
                          Escalated Lvl {ticket.escalationLevel}
                        </span>
                      )}
                    </div>

                    <span className={`text-[10px] font-bold border rounded-full px-2.5 py-0.5 uppercase tracking-wider ${
                      ticket.status === 'CLOSED'
                        ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400'
                        : ticket.status === 'RESOLVED'
                        ? 'bg-teal-950/40 border-teal-800 text-teal-300'
                        : ticket.status === 'ASSIGNED'
                        ? 'bg-sky-950/40 border-sky-800 text-sky-300'
                        : 'bg-amber-950/40 border-amber-800 text-amber-400'
                    }`}>
                      {ticket.status}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h4 className="text-base font-bold text-slate-100">{ticket.title}</h4>
                    <p className="text-slate-400 text-xs mt-1 leading-relaxed">{ticket.description}</p>
                  </div>

                  {/* Raised By & Assigned Info */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <User className="h-3.5 w-3.5 text-slate-500" />
                      <span>Raised by: <strong>{ticket.raisedByName || 'Resident'}</strong></span>
                    </div>

                    {ticket.assignedStaffName ? (
                      <div className="flex items-center gap-1.5 text-sky-400 bg-sky-950/30 border border-sky-900/40 px-2 py-0.5 rounded-lg">
                        <Wrench className="h-3 w-3" />
                        <span>Assigned to: <strong>{ticket.assignedStaffName}</strong></span>
                      </div>
                    ) : (
                      <span className="text-slate-500 italic flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-amber-500" /> Unassigned
                      </span>
                    )}
                  </div>

                  {/* Resolution Remarks Box */}
                  {ticket.resolutionComment && (
                    <div className="bg-emerald-950/30 border border-emerald-900/50 p-3 rounded-xl space-y-1 mt-2">
                      <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Resolution Remarks & Action Taken:
                        </span>
                        {ticket.resolvedAt && (
                          <span className="text-slate-400 font-mono">
                            {new Date(ticket.resolvedAt).toLocaleDateString('en-IN')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-emerald-200/90 leading-relaxed font-medium">
                        {ticket.resolutionComment}
                      </p>
                    </div>
                  )}

                  {/* Resident Feedback Remarks Box */}
                  {ticket.residentFeedback && (
                    <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl space-y-1 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> Resident Feedback Remarks:
                        </span>
                        {ticket.rating && (
                          <div className="flex items-center gap-0.5 text-amber-400">
                            {[...Array(ticket.rating)].map((_, i) => (
                              <Star key={i} className="h-3 w-3 fill-amber-400" />
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 italic">{ticket.residentFeedback}</p>
                    </div>
                  )}
                </div>

                {/* Actions Panel */}
                <div className="flex flex-wrap justify-end gap-2 border-t border-slate-800/60 pt-4 mt-4">
                  {ticket.status !== 'CLOSED' && (
                    <>
                      {/* Assign Staff (Management Only) */}
                      {isManagementRole && (
                        <button
                          onClick={() => {
                            setActiveAssignTicket(ticket);
                            setSelectedStaffId(ticket.assignedStaffId || '');
                            setCustomStaffName(ticket.assignedStaffName || '');
                            setIsInlineAddStaff(false);
                          }}
                          className="rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 py-1.5 px-3 font-semibold transition-all flex items-center gap-1"
                        >
                          <UserCheck className="h-3.5 w-3.5 text-sky-400" /> Assign Staff
                        </button>
                      )}

                      {/* Record Resolution (Management / Assigned Staff) */}
                      {(isManagementRole || ticket.status === 'ASSIGNED') && ticket.status !== 'RESOLVED' && (
                        <button
                          onClick={() => {
                            setActiveResolveTicket(ticket);
                            setResolutionComment(ticket.resolutionComment || '');
                          }}
                          className="rounded-lg bg-teal-600 hover:bg-teal-700 text-white py-1.5 px-3 font-semibold transition-all flex items-center gap-1 shadow"
                        >
                          <Wrench className="h-3.5 w-3.5" /> Resolve Ticket
                        </button>
                      )}

                      {/* Escalate (Available to all) */}
                      <button
                        onClick={() => handleEscalate(ticket.id)}
                        className="rounded-lg border border-slate-800 bg-slate-950/60 py-1.5 px-3 hover:bg-slate-900 font-semibold text-slate-400 hover:text-amber-400 transition-all"
                      >
                        Escalate
                      </button>

                      {/* Submit Feedback & Close */}
                      <button
                        onClick={() => {
                          setActiveFeedbackTicket(ticket);
                          setFeedbackRating(ticket.rating || 5);
                          setFeedbackText(ticket.residentFeedback || '');
                        }}
                        className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 px-3.5 font-bold transition-all shadow"
                      >
                        {ticket.status === 'RESOLVED' ? 'Confirm & Close' : 'Close Ticket'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* MODAL 1: Raise Complaint                   */}
      {/* ========================================== */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-indigo-400" /> Raise Complaint Ticket
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-500 hover:text-slate-300 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateComplaint} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-semibold">Issue Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lift A stuck between 4th & 5th floor / Water pipeline leak"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full mt-1.5 rounded-lg border border-slate-800 bg-slate-900/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold">Tag Flat / Unit</label>
                  <select
                    value={selectedFlatId}
                    onChange={(e) => setSelectedFlatId(e.target.value)}
                    className="w-full mt-1.5 rounded-lg border border-slate-800 bg-slate-900/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-indigo-600 focus:outline-none"
                  >
                    <option value="">-- Auto-Detect My Flat / Common Area --</option>
                    {flatsList.map((f) => (
                      <option key={f.id} value={f.id}>
                        Flat {f.number} {f.floor !== undefined ? `(Floor ${f.floor})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold">Urgency / Priority Level</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full mt-1.5 rounded-lg border border-slate-800 bg-slate-900/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-indigo-600 focus:outline-none"
                  >
                    <option value="LOW">🟢 Low (Cosmetic / General maintenance)</option>
                    <option value="MEDIUM">🔵 Medium (Standard Repair)</option>
                    <option value="HIGH">🟠 High (Urgent Attention)</option>
                    <option value="URGENT">🔴 Urgent (Emergency Breakdown)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold">Detailed Description *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Provide complete breakdown details, location, and severity..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full mt-1.5 rounded-lg border border-slate-800 bg-slate-900/60 py-2 px-3 text-sm text-slate-200 focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold disabled:opacity-50"
                >
                  Log Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 2: Assign Staff / Technician         */}
      {/* ========================================== */}
      {activeAssignTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-sky-400" /> Assign Staff to Ticket
              </h3>
              <button
                onClick={() => {
                  setActiveAssignTicket(null);
                  setIsInlineAddStaff(false);
                }}
                className="text-slate-500 hover:text-slate-300 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="space-y-4 text-xs">
              <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-lg">
                <p className="text-[11px] text-slate-400">Assigning for:</p>
                <p className="font-bold text-slate-200 mt-0.5">{activeAssignTicket.title}</p>
              </div>

              {!isInlineAddStaff ? (
                <>
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-slate-300 font-semibold">Select Society Staff Member</label>
                      <button
                        type="button"
                        onClick={() => setIsInlineAddStaff(true)}
                        className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" /> Register New Staff
                      </button>
                    </div>
                    <select
                      value={selectedStaffId}
                      onChange={(e) => {
                        setSelectedStaffId(e.target.value);
                        if (e.target.value) setCustomStaffName('');
                      }}
                      className="w-full mt-1.5 rounded-lg border border-slate-800 bg-slate-900/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-sky-600 focus:outline-none"
                    >
                      <option value="">-- Choose from staff roster --</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} — {s.role} {s.phone ? `(${s.phone})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold">Or Enter Custom Technician / Vendor Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Otis Elevator AMC Technician / Suresh Electrician"
                      value={customStaffName}
                      onChange={(e) => {
                        setCustomStaffName(e.target.value);
                        if (e.target.value) setSelectedStaffId('');
                      }}
                      className="w-full mt-1.5 rounded-lg border border-slate-800 bg-slate-900/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-sky-600 focus:outline-none"
                    />
                  </div>
                </>
              ) : (
                /* Inline Staff Registration Form */
                <div className="bg-sky-950/20 border border-sky-900/40 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sky-300 text-xs flex items-center gap-1.5">
                      <Users className="h-4 w-4" /> Quick Register Staff Member
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsInlineAddStaff(false)}
                      className="text-[10px] text-slate-400 hover:text-slate-200"
                    >
                      Back to list
                    </button>
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold">Full Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Kumar"
                      value={staffForm.name}
                      onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                      className="w-full mt-1 rounded-lg border border-slate-800 bg-slate-900/80 py-2 px-3 text-sm text-slate-200 focus:border-sky-600 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-300 font-semibold">Mobile *</label>
                      <input
                        type="text"
                        placeholder="9876543210"
                        value={staffForm.mobile}
                        onChange={(e) => setStaffForm({ ...staffForm, mobile: e.target.value })}
                        className="w-full mt-1 rounded-lg border border-slate-800 bg-slate-900/80 py-2 px-3 text-sm text-slate-200 focus:border-sky-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-slate-300 font-semibold">Role / Trade</label>
                      <select
                        value={staffForm.role}
                        onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                        className="w-full mt-1 rounded-lg border border-slate-800 bg-slate-900/80 py-2 px-3 text-sm text-slate-200 focus:border-sky-600 focus:outline-none"
                      >
                        <option value="ELECTRICIAN">Electrician</option>
                        <option value="PLUMBER">Plumber</option>
                        <option value="LIFT_TECHNICIAN">Lift Technician</option>
                        <option value="SECURITY_GUARD">Security Guard</option>
                        <option value="CLEANER">Cleaner / Housekeeping</option>
                        <option value="GARDENER">Gardener</option>
                        <option value="CARPENTER">Carpenter</option>
                        <option value="FACILITY_SUPERVISOR">Facility Supervisor</option>
                        <option value="OTHER">Other Technician</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCreateStaffSubmit}
                    disabled={isProcessing}
                    className="w-full py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition-all shadow"
                  >
                    Save & Select for Ticket
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setActiveAssignTicket(null);
                    setIsInlineAddStaff(false);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold disabled:opacity-50"
                >
                  Assign Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 3: Record Resolution Comments        */}
      {/* ========================================== */}
      {activeResolveTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Wrench className="h-5 w-5 text-teal-400" /> Record Resolution Comments
              </h3>
              <button
                onClick={() => setActiveResolveTicket(null)}
                className="text-slate-500 hover:text-slate-300 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleResolveSubmit} className="space-y-4 text-xs">
              <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-lg">
                <p className="text-[11px] text-slate-400">Resolving:</p>
                <p className="font-bold text-slate-200 mt-0.5">{activeResolveTicket.title}</p>
              </div>

              <div>
                <label className="text-slate-300 font-semibold">Resolution Comments & Action Taken *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Detail the root cause and actions taken (e.g. Replaced faulty relay in elevator panel, tested operational for 30 mins)..."
                  value={resolutionComment}
                  onChange={(e) => setResolutionComment(e.target.value)}
                  className="w-full mt-1.5 rounded-lg border border-slate-800 bg-slate-900/60 py-2 px-3 text-sm text-slate-200 focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveResolveTicket(null)}
                  className="px-4 py-2 rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold disabled:opacity-50"
                >
                  Mark as Resolved
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 4: Resident Feedback & Closing       */}
      {/* ========================================== */}
      {activeFeedbackTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-400 fill-amber-400" /> Resident Feedback & Review
              </h3>
              <button
                onClick={() => setActiveFeedbackTicket(null)}
                className="text-slate-500 hover:text-slate-300 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleFeedbackSubmit} className="space-y-4 text-xs">
              <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-lg">
                <p className="text-[11px] text-slate-400">Closing Ticket:</p>
                <p className="font-bold text-slate-200 mt-0.5">{activeFeedbackTicket.title}</p>
                {activeFeedbackTicket.resolutionComment && (
                  <p className="text-[11px] text-emerald-300 mt-1 italic">
                    Resolution: "{activeFeedbackTicket.resolutionComment}"
                  </p>
                )}
              </div>

              {/* Star Rating Selection */}
              <div>
                <label className="text-slate-300 font-semibold block mb-1.5">Satisfaction Rating</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setFeedbackRating(star)}
                      className="p-1.5 rounded-lg hover:bg-slate-900 transition-all"
                    >
                      <Star
                        className={`h-6 w-6 ${
                          star <= feedbackRating
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-600'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs text-amber-400 font-bold ml-2">
                    {feedbackRating} / 5 Stars
                  </span>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold">Feedback Remarks</label>
                <textarea
                  rows={3}
                  placeholder="Share your satisfaction with the repair turnaround and technician service..."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  className="w-full mt-1.5 rounded-lg border border-slate-800 bg-slate-900/60 py-2 px-3 text-sm text-slate-200 focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveFeedbackTicket(null)}
                  className="px-4 py-2 rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold disabled:opacity-50"
                >
                  Close & Submit Feedback
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 5: Staff & Technicians Manager       */}
      {/* ========================================== */}
      {isStaffManagerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Users className="h-5 w-5 text-sky-400" /> Society Staff & Facility Technicians Team
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Manage electricians, plumbers, security guards, and facility maintenance team</p>
              </div>
              <button
                onClick={() => setIsStaffManagerOpen(false)}
                className="text-slate-500 hover:text-slate-300 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Add Staff Form */}
            <form onSubmit={handleCreateStaffSubmit} className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-3 text-xs">
              <h4 className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                <Plus className="h-4 w-4 text-sky-400" /> Add New Staff Member / Technician
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 font-medium">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={staffForm.name}
                    onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                    className="w-full mt-1 rounded-lg border border-slate-800 bg-slate-950/80 py-2 px-3 text-xs text-slate-200 focus:border-sky-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-medium">Mobile Phone *</label>
                  <input
                    type="text"
                    required
                    placeholder="9876543210"
                    value={staffForm.mobile}
                    onChange={(e) => setStaffForm({ ...staffForm, mobile: e.target.value })}
                    className="w-full mt-1 rounded-lg border border-slate-800 bg-slate-950/80 py-2 px-3 text-xs text-slate-200 focus:border-sky-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-medium">Trade / Role</label>
                  <select
                    value={staffForm.role}
                    onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                    className="w-full mt-1 rounded-lg border border-slate-800 bg-slate-950/80 py-2 px-3 text-xs text-slate-200 focus:border-sky-600 focus:outline-none"
                  >
                    <option value="ELECTRICIAN">Electrician</option>
                    <option value="PLUMBER">Plumber</option>
                    <option value="LIFT_TECHNICIAN">Lift Technician</option>
                    <option value="SECURITY_GUARD">Security Guard</option>
                    <option value="CLEANER">Cleaner / Housekeeping</option>
                    <option value="GARDENER">Gardener</option>
                    <option value="CARPENTER">Carpenter</option>
                    <option value="FACILITY_SUPERVISOR">Facility Supervisor</option>
                    <option value="OTHER">Other Technician</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs disabled:opacity-50 transition-all shadow"
                >
                  Register Staff Member
                </button>
              </div>
            </form>

            {/* Staff List Roster */}
            <div className="overflow-y-auto space-y-2 max-h-64 pr-1">
              {staffList.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                  No staff members registered in the team roster yet.
                </div>
              ) : (
                staffList.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-slate-800/80 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-slate-800/80 flex items-center justify-center text-sky-400 font-bold">
                        {s.name[0]?.toUpperCase() || 'S'}
                      </div>
                      <div>
                        <p className="font-bold text-slate-200">{s.name}</p>
                        <p className="text-[11px] text-slate-400 flex items-center gap-2">
                          <span className="text-sky-400 font-semibold">{s.role.replace('_', ' ')}</span>
                          {s.phone && (
                            <a href={`tel:${s.phone}`} className="text-slate-400 hover:text-slate-200 flex items-center gap-1 font-mono">
                              <Phone className="h-3 w-3 text-slate-500" /> {s.phone}
                            </a>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold bg-emerald-950/40 border border-emerald-800/60 text-emerald-400 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                      <button
                        onClick={() => handleDeleteStaff(s.id, s.name)}
                        className="text-slate-500 hover:text-red-400 p-1.5 transition-colors"
                        title="Remove staff"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
