'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../providers/auth-context';
import { apiClient } from '../../../lib/api/client';
import { Users, Search, Filter, ShieldAlert, Download, Upload, ArrowRight, Loader2, Plus, CheckCircle, AlertCircle, X, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import BulkUploadModal from '../../../components/bulk-upload-modal';

interface MemberListItem {
  id: string;
  membershipNumber: string;
  memberType: 'OWNER' | 'CO_OWNER' | 'TENANT';
  status: string;
  name: string;
  email: string;
  mobile: string;
  photoUrl?: string;
}

export default function MembersListingPage() {
  const { society_slug } = useParams();
  const { activeSociety } = useAuth();
  
  const isManagementRole = ['SUPER_ADMIN', 'PRESIDENT', 'SECRETARY', 'COMMITTEE_MEMBER'].includes(activeSociety?.role || '');
  const [membersList, setMembersList] = useState<MemberListItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessingCsv, setIsProcessingCsv] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [memberTypeFilter, setMemberTypeFilter] = useState<string>('');

  const [showAddMember, setShowAddMember] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [newMemberForm, setNewMemberForm] = useState({
    name: '',
    email: '',
    mobile: '',
    memberType: 'OWNER' as 'OWNER' | 'CO_OWNER' | 'TENANT',
    status: 'ACTIVE',
  });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const fetchMembers = async () => {
      if (!society_slug) return;
      try {
        setIsLoading(true);
        const urlParams = new URLSearchParams();
        if (searchTerm) urlParams.append('search', searchTerm);
        if (memberTypeFilter) urlParams.append('memberType', memberTypeFilter);

        const res = await apiClient.get(`/members?${urlParams.toString()}`);
        if (res.data?.success) {
          setMembersList(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load members roster:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMembers();
  }, [society_slug, searchTerm, memberTypeFilter]);

  const handleExportCsv = async () => {
    try {
      const res = await apiClient.get('/members/export', { responseType: 'blob' });
      // Create trigger link download
      const blob = new Blob([res.data], { type: 'text/csv' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'members_roster.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setMessage({ type: 'success', text: 'Members roster CSV exported successfully.' });
    } catch (err) {
      setMessage({ type: 'error', text: 'CSV export failed.' });
    }
  };

  const handleBulkUpload = async (data: any[]) => {
    setIsProcessingCsv(true);
    setMessage(null);

    try {
      const res = await apiClient.post('/members/bulk', data);
      if (res.data?.success) {
        setMessage({ 
          type: 'success', 
          text: `Successfully imported ${res.data.data.importedCount} members to roster.` 
        });
        
        // Refresh roster
        const refRes = await apiClient.get('/members');
        if (refRes.data?.success) {
          setMembersList(refRes.data.data);
        }
      }
    } catch (err: any) {
      setMessage({ 
        type: 'error', 
        text: err.response?.data?.error?.message || 'Bulk Import failed. Verify file columns structure.' 
      });
    } finally {
      setIsProcessingCsv(false);
    }
  };

  const handleCreateMember = async () => {
    if (!newMemberForm.name.trim() || !newMemberForm.email.trim()) return;
    setIsCreating(true);
    setMessage(null);

    try {
      const payload = {
        name: newMemberForm.name,
        email: newMemberForm.email,
        mobile: newMemberForm.mobile,
        memberType: newMemberForm.memberType,
        status: newMemberForm.status,
      };
      const res = await apiClient.post('/members', payload);
      if (res.data?.success) {
        setMessage({ type: 'success', text: `Member "${newMemberForm.name}" added successfully.` });
        setShowAddMember(false);
        setNewMemberForm({ name: '', email: '', mobile: '', memberType: 'OWNER', status: 'ACTIVE' });
        
        // Refresh list
        const refRes = await apiClient.get('/members');
        if (refRes.data?.success) {
          setMembersList(refRes.data.data);
        }
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to add member.' });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-start overflow-x-hidden w-full py-12 px-4 sm:px-6 lg:px-8">
      {/* Background Grids */}
      <div className="absolute inset-0 -z-10 block bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="w-full max-w-6xl z-10 space-y-8 bg-slate-900/30 border border-slate-800 p-4 md:p-8 rounded-2xl shadow-none backdrop-blur-xl">
        
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-indigo-400" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight text-slate-100">Member Directory</h2>
                {!isLoading && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-950/50 border border-indigo-900/50 text-indigo-400">
                    {membersList.length} members
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">View owners, co-owners, family members, nominees, and digital IDs</p>
            </div>
          </div>

          {isManagementRole && (
            <div className="flex items-center gap-2">
              {/* Add Member Button */}
              <button
                onClick={() => setShowAddMember(true)}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 py-2 px-4 text-xs font-semibold text-white transition-all shadow-indigo-600/20"
              >
                <UserPlus className="h-3.5 w-3.5" /> Add Member
              </button>

              {/* Import Trigger */}
              <button
                onClick={() => setShowBulkUpload(true)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-4 text-xs font-semibold text-slate-300 hover:bg-slate-900 hover:text-slate-100 cursor-pointer transition-all shadow-sm"
              >
                <Upload className="h-3.5 w-3.5" />
                Import Bulk
              </button>

              {/* Export Trigger */}
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-4 text-xs font-semibold text-slate-300 hover:bg-slate-900 hover:text-slate-100 transition-all shadow-sm"
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
            </div>
          )}
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

        {/* Filters Panel */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 bg-slate-950/40 border border-slate-800 p-4 rounded-xl">
          {/* Search by Name / No */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search Name or Membership No..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-600 focus:border-slate-700 focus:outline-none focus:ring-1 focus:ring-transparent"
            />
          </div>

          {/* Filter by Type */}
          <div className="relative">
            <select
              value={memberTypeFilter}
              onChange={(e) => setMemberTypeFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-3.5 text-sm text-slate-500 focus:border-slate-700 focus:outline-none focus:ring-1 focus:ring-transparent appearance-none"
            >
              <option value="">All Member Types</option>
              <option value="OWNER">Owner</option>
              <option value="CO_OWNER">Co-owner</option>
              <option value="TENANT">Tenant</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
          </div>
        ) : membersList.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl space-y-3">
            <ShieldAlert className="h-10 w-10 text-slate-500 mx-auto" />
            <h3 className="text-md font-semibold text-slate-300">No members found</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">No records match the current filters or search term parameters.</p>
          </div>
        ) : (
          /* Members Table Listing */
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/20 shadow-sm">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-black/60 text-slate-400 font-semibold border-b border-slate-800">
                  <th className="p-4">Membership Info</th>
                  <th className="p-4">Full Name</th>
                  <th className="p-4">Email Address</th>
                  <th className="p-4">Mobile Number</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {membersList.map((member) => (
                  <tr key={member.id} className="text-slate-300 hover:bg-slate-900/10 transition-colors">
                    <td className="p-4 font-mono text-slate-400">{member.membershipNumber}</td>
                    <td className="p-4 font-bold text-slate-200">{member.name || 'Resident'}</td>
                    <td className="p-4 text-slate-400">{member.email}</td>
                    <td className="p-4 text-slate-400">{member.mobile || '-'}</td>
                    <td className="p-4">
                      <span className="text-[10px] font-semibold border border-indigo-900/50 bg-indigo-950/40 text-indigo-400 rounded-full px-2 py-0.5 uppercase">
                        {member.memberType}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 uppercase ${
                        member.status === 'ACTIVE' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {member.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <Link
                        href={`/${society_slug}/members/${member.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-all"
                      >
                        {isManagementRole ? 'Manage Profile' : 'View Profile'} <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==================== ADD MEMBER MODAL ==================== */}
      {showAddMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddMember(false)} />
          
          {/* Modal Panel */}
          <div className="relative w-full max-w-lg bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/90 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-600/20 border border-indigo-500/20">
                  <UserPlus className="h-5 w-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">Add New Member</h3>
                  <p className="text-[11px] text-slate-500">Link an existing user to this society</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddMember(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Step 1: User Identity Details */}
              <div className="space-y-4">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-[10px] font-bold text-white">1</span>
                  Personal Details
                </label>
                
                <div>
                  <label className="text-[11px] text-slate-400 font-medium">Full Name <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={newMemberForm.name}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, name: e.target.value })}
                    placeholder="e.g. John Doe"
                    className="w-full mt-1 rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 px-3.5 text-sm text-slate-200 placeholder-slate-600 focus:border-indigo-600/50 focus:outline-none focus:ring-1 focus:ring-indigo-600/30 transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">Email Address <span className="text-red-400">*</span></label>
                    <input
                      type="email"
                      value={newMemberForm.email}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, email: e.target.value })}
                      placeholder="john@example.com"
                      className="w-full mt-1 rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 px-3.5 text-sm text-slate-200 placeholder-slate-600 focus:border-indigo-600/50 focus:outline-none focus:ring-1 focus:ring-indigo-600/30 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">Mobile Number</label>
                    <input
                      type="text"
                      value={newMemberForm.mobile}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, mobile: e.target.value })}
                      placeholder="+91 9876543210"
                      className="w-full mt-1 rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 px-3.5 text-sm text-slate-200 placeholder-slate-600 focus:border-indigo-600/50 focus:outline-none focus:ring-1 focus:ring-indigo-600/30 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Step 2: Membership Details */}
              <div className="space-y-4">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-[10px] font-bold text-white">2</span>
                  Membership Details
                </label>

                <div>
                  <label className="text-[11px] text-slate-400 font-medium">Membership Number</label>
                  <input
                    type="text"
                    disabled
                    value="Auto-generated by system"
                    className="w-full mt-1 rounded-lg border border-slate-800 bg-slate-900/20 py-2.5 px-3.5 text-sm text-slate-500 italic cursor-not-allowed"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">A sequential membership number (e.g. MEM-0001) will be assigned automatically.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">Member Type</label>
                    <select
                      value={newMemberForm.memberType}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, memberType: e.target.value as any })}
                      className="w-full mt-1 rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 px-3.5 text-sm text-slate-400 focus:border-indigo-600/50 focus:outline-none appearance-none transition-all"
                    >
                      <option value="OWNER">Owner</option>
                      <option value="CO_OWNER">Co-owner</option>
                      <option value="TENANT">Tenant</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">Status</label>
                    <select
                      value={newMemberForm.status}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, status: e.target.value })}
                      className="w-full mt-1 rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 px-3.5 text-sm text-slate-400 focus:border-indigo-600/50 focus:outline-none appearance-none transition-all"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="SUSPENDED">Suspended</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer / Submit */}
            <div className="p-6 border-t border-slate-800 bg-slate-950">
              <button
                type="button"
                onClick={handleCreateMember}
                disabled={!newMemberForm.name.trim() || !newMemberForm.email.trim() || isCreating}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-sm font-semibold text-white transition-all shadow-lg shadow-indigo-600/20 disabled:shadow-none"
              >
                {isCreating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</>
                ) : (
                  <><Plus className="h-4 w-4" /> Add Member to Society</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <BulkUploadModal
        isOpen={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        title="Bulk Import Members"
        entityName="members"
        sampleHeaders={['Membership Number', 'Member Type', 'Name', 'Email', 'Mobile']}
        sampleData={[
          ['MEM-0001', 'OWNER', 'John Doe', 'john@example.com', '9876543210'],
          ['MEM-0002', 'TENANT', 'Jane Smith', 'jane@example.com', '9876543211'],
        ]}
        keyMapping={{
          'Membership Number': 'membershipNumber',
          'Member Type': 'memberType',
          'Name': 'name',
          'Email': 'email',
          'Mobile': 'mobile'
        }}
        onUpload={handleBulkUpload}
      />
    </main>
  );
}
