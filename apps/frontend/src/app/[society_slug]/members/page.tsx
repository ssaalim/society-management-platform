'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../providers/auth-context';
import { apiClient } from '../../../lib/api/client';
import {
  Users,
  Search,
  Filter,
  ShieldAlert,
  Download,
  Upload,
  ArrowRight,
  Loader2,
  Plus,
  CheckCircle,
  AlertCircle,
  X,
  UserPlus,
  ShieldCheck,
  Star,
  Award,
  Home,
  UserCheck,
  Key,
  Briefcase,
  UserX,
  Edit2,
  Trash2,
  Building,
  Mail,
  Phone
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import BulkUploadModal from '../../../components/bulk-upload-modal';

interface MemberListItem {
  id: string;
  membershipNumber: string;
  memberType: 'OWNER' | 'CO_OWNER' | 'TENANT' | 'FAMILY_MEMBER' | 'ASSOCIATE_MEMBER';
  committeeDesignation?: string | null;
  status: string;
  name: string;
  email: string;
  mobile: string;
  photoUrl?: string;
  canLogin?: boolean;
}

interface SocietyUserItem {
  id: string;
  userId: string;
  name?: string;
  email: string;
  mobile?: string;
  roleId: string;
  roleName: string;
  roleDescription?: string;
  flatNumber?: string | null;
  isInventoryHolder: boolean;
  userCategory: 'RESIDENT_MEMBER' | 'STAFF_PROFESSIONAL';
  createdAt: string;
}

export default function MembersListingPage() {
  const { society_slug } = useParams();
  const { activeSociety } = useAuth();

  const isManagementRole = ['SUPER_ADMIN', 'PRESIDENT', 'SECRETARY', 'COMMITTEE_MEMBER'].includes(activeSociety?.role || '');

  // Tab state
  const [activeTab, setActiveTab] = useState<'members' | 'system_users'>('members');

  // Members state
  const [membersList, setMembersList] = useState<MemberListItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessingCsv, setIsProcessingCsv] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters state (Members)
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [memberTypeFilter, setMemberTypeFilter] = useState<string>('');
  const [committeeFilter, setCommitteeFilter] = useState<string>('');

  const [showAddMember, setShowAddMember] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [newMemberForm, setNewMemberForm] = useState({
    name: '',
    email: '',
    mobile: '',
    memberType: 'OWNER',
    committeeDesignation: 'NONE',
    status: 'ACTIVE',
    canLogin: true,
    password: '',
  });
  const [isCreating, setIsCreating] = useState(false);

  // System Users state
  const [societyUsersList, setSocietyUsersList] = useState<SocietyUserItem[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState<boolean>(false);
  const [userSearchTerm, setUserSearchTerm] = useState<string>('');
  const [userCategoryFilter, setUserCategoryFilter] = useState<string>('');

  // Modals for System Users
  const [showGrantAccessModal, setShowGrantAccessModal] = useState<boolean>(false);
  const [editingUserRole, setEditingUserRole] = useState<SocietyUserItem | null>(null);
  const [newRoleSelection, setNewRoleSelection] = useState<string>('ACCOUNTANT');

  const [grantAccessForm, setGrantAccessForm] = useState({
    name: '',
    email: '',
    mobile: '',
    roleName: 'ACCOUNTANT',
    password: '',
  });
  const [isGranting, setIsGranting] = useState<boolean>(false);

  // Fetch Members
  const fetchMembers = async () => {
    if (!society_slug) return;
    try {
      setIsLoading(true);
      const urlParams = new URLSearchParams();
      if (searchTerm) urlParams.append('search', searchTerm);
      if (memberTypeFilter) urlParams.append('memberType', memberTypeFilter);
      if (committeeFilter) urlParams.append('committeeDesignation', committeeFilter);

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

  // Fetch Society Users
  const fetchSocietyUsers = async () => {
    if (!society_slug) return;
    try {
      setIsUsersLoading(true);
      const res = await apiClient.get('/users/society-users');
      if (res.data?.success) {
        setSocietyUsersList(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load society users:', err);
    } finally {
      setIsUsersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'members') {
      fetchMembers();
    } else {
      fetchSocietyUsers();
    }
  }, [society_slug, activeTab, searchTerm, memberTypeFilter, committeeFilter]);

  const handleExportCsv = async () => {
    try {
      const res = await apiClient.get('/members/export', { responseType: 'blob' });
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
        fetchMembers();
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
        committeeDesignation: newMemberForm.committeeDesignation === 'NONE' ? null : newMemberForm.committeeDesignation,
        status: newMemberForm.status,
        canLogin: newMemberForm.canLogin,
        password: newMemberForm.password || undefined,
      };
      const res = await apiClient.post('/members', payload);
      if (res.data?.success) {
        setMessage({ type: 'success', text: `Member "${newMemberForm.name}" added successfully.` });
        setShowAddMember(false);
        setNewMemberForm({
          name: '',
          email: '',
          mobile: '',
          memberType: 'OWNER',
          committeeDesignation: 'NONE',
          status: 'ACTIVE',
          canLogin: true,
          password: ''
        });
        fetchMembers();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to add member.' });
    } finally {
      setIsCreating(false);
    }
  };

  // Grant Access to Staff / Accountant / Auditor
  const handleGrantAccessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantAccessForm.email.trim()) return;

    setIsGranting(true);
    setMessage(null);

    try {
      const res = await apiClient.post('/users/grant-access', grantAccessForm);
      if (res.data?.success) {
        setMessage({
          type: 'success',
          text: `System access granted to ${grantAccessForm.email} as ${grantAccessForm.roleName} successfully!`
        });
        setShowGrantAccessModal(false);
        setGrantAccessForm({ name: '', email: '', mobile: '', roleName: 'ACCOUNTANT', password: '' });
        fetchSocietyUsers();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to grant system access.' });
    } finally {
      setIsGranting(false);
    }
  };

  // Update User Role
  const handleUpdateUserRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserRole) return;

    setIsGranting(true);
    setMessage(null);

    try {
      const res = await apiClient.patch(`/users/${editingUserRole.userId}/role`, {
        roleName: newRoleSelection,
      });
      if (res.data?.success) {
        setMessage({ type: 'success', text: `Role updated to ${newRoleSelection} successfully.` });
        setEditingUserRole(null);
        fetchSocietyUsers();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update user role.' });
    } finally {
      setIsGranting(false);
    }
  };

  // Revoke User Access
  const handleRevokeUserAccess = async (userItem: SocietyUserItem) => {
    if (!confirm(`Are you sure you want to revoke system login access for ${userItem.name || userItem.email} from this society?`)) {
      return;
    }

    try {
      const res = await apiClient.delete(`/users/${userItem.userId}/revoke`);
      if (res.data?.success) {
        setMessage({ type: 'success', text: `System access revoked for ${userItem.email}.` });
        fetchSocietyUsers();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to revoke user access.' });
    }
  };

  const getOccupancyBadge = (type: string) => {
    switch (type) {
      case 'OWNER':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 rounded-full px-2.5 py-0.5 uppercase tracking-wide">
            <Home className="h-2.5 w-2.5" /> Owner
          </span>
        );
      case 'CO_OWNER':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold border border-teal-200 dark:border-teal-900/60 bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 rounded-full px-2.5 py-0.5 uppercase tracking-wide">
            <Home className="h-2.5 w-2.5" /> Co-owner
          </span>
        );
      case 'TENANT':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 rounded-full px-2.5 py-0.5 uppercase tracking-wide">
            <Key className="h-2.5 w-2.5" /> Tenant
          </span>
        );
      case 'FAMILY_MEMBER':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 rounded-full px-2.5 py-0.5 uppercase tracking-wide">
            <Users className="h-2.5 w-2.5" /> Family
          </span>
        );
      case 'ASSOCIATE_MEMBER':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold border border-purple-200 dark:border-purple-900/60 bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 rounded-full px-2.5 py-0.5 uppercase tracking-wide">
            <UserCheck className="h-2.5 w-2.5" /> Associate
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-400 rounded-full px-2 py-0.5">
            {type}
          </span>
        );
    }
  };

  const getCommitteeBadge = (designation?: string | null) => {
    if (!designation || designation === 'NONE') return null;
    const isExecutive = ['PRESIDENT', 'SECRETARY', 'TREASURER'].includes(designation);
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-bold border rounded-full px-2.5 py-0.5 uppercase tracking-wider ${
        isExecutive
          ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-700/60 text-indigo-800 dark:text-indigo-300 shadow-xs'
          : 'bg-slate-100 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-300'
      }`}>
        <Award className="h-2.5 w-2.5 text-amber-500 dark:text-amber-400" />
        {designation.replace('_', ' ')}
      </span>
    );
  };

  const getRoleBadge = (roleName: string) => {
    switch (roleName) {
      case 'ACCOUNTANT':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 rounded-full px-2.5 py-0.5 uppercase">
            <Briefcase className="h-3 w-3" /> Accountant
          </span>
        );
      case 'AUDITOR':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 rounded-full px-2.5 py-0.5 uppercase">
            <ShieldCheck className="h-3 w-3" /> Auditor
          </span>
        );
      case 'ESTATE_MANAGER':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 rounded-full px-2.5 py-0.5 uppercase">
            <Building className="h-3 w-3" /> Estate Manager
          </span>
        );
      case 'PRESIDENT':
      case 'SECRETARY':
      case 'TREASURER':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 rounded-full px-2.5 py-0.5 uppercase">
            <Award className="h-3 w-3 text-amber-500 dark:text-amber-400" /> {roleName}
          </span>
        );
      case 'STAFF':
      case 'SECURITY_SUPERVISOR':
      case 'MAINTENANCE_INCHARGE':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-full px-2.5 py-0.5 uppercase">
            <UserCheck className="h-3 w-3" /> {roleName.replace('_', ' ')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-300 rounded-full px-2.5 py-0.5 uppercase">
            {roleName}
          </span>
        );
    }
  };

  // Filtered system users
  const filteredSystemUsers = societyUsersList.filter((u) => {
    if (userSearchTerm) {
      const q = userSearchTerm.toLowerCase();
      const match =
        u.email?.toLowerCase().includes(q) ||
        u.name?.toLowerCase().includes(q) ||
        u.roleName?.toLowerCase().includes(q) ||
        u.flatNumber?.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (userCategoryFilter) {
      if (u.userCategory !== userCategoryFilter) return false;
    }
    return true;
  });

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-start overflow-x-hidden w-full py-4 sm:py-5 px-3 sm:px-5 lg:px-6">
      {/* Dynamic Background Grids */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="w-full max-w-[1600px] mx-auto space-y-3.5 z-10">

        {/* Header & Tabs */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-slate-800/80 pb-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <Users className="h-6 w-6 text-indigo-500 dark:text-indigo-400" /> Society Directory & User Access
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Manage member records, flat owners, tenants, and configure login access for accountants, auditors, and staff
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            {activeTab === 'members' ? (
              <>
                <button
                  onClick={handleExportCsv}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 py-1.5 px-2.5 text-xs font-semibold shadow-xs transition-all"
                >
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </button>

                {isManagementRole && (
                  <>
                    <button
                      onClick={() => setShowBulkUpload(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 py-1.5 px-2.5 text-xs font-semibold shadow-xs transition-all"
                    >
                      <Upload className="h-3.5 w-3.5" /> Bulk Import
                    </button>
                    <button
                      onClick={() => setShowAddMember(true)}
                      className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 px-3 text-xs font-semibold shadow-xs transition-all"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Member
                    </button>
                  </>
                )}
              </>
            ) : (
              isManagementRole && (
                <button
                  onClick={() => setShowGrantAccessModal(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 px-3 text-xs font-semibold shadow-xs transition-all"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Grant System Access / Add User
                </button>
              )
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('members')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs ${
              activeTab === 'members'
                ? 'bg-indigo-600 border border-indigo-500 text-white shadow-indigo-600/20'
                : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80'
            }`}
          >
            <Home className="h-3.5 w-3.5" />
            <span>Society Members & Residents</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              activeTab === 'members'
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}>
              {membersList.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('system_users')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs ${
              activeTab === 'system_users'
                ? 'bg-indigo-600 border border-indigo-500 text-white shadow-indigo-600/20'
                : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>System Users & Staff Access</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              activeTab === 'system_users'
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}>
              {societyUsersList.length}
            </span>
          </button>
        </div>

        {message && (
          <div
            className={`rounded-xl border p-3 text-xs font-semibold flex items-center gap-2.5 shadow-xs ${message.type === 'success'
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

        {/* ========================================== */}
        {/* TAB 1: Society Members & Residents         */}
        {/* ========================================== */}
        {activeTab === 'members' && (
          <div className="space-y-3.5">
            {/* Search & Filters */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 p-3 rounded-xl shadow-xs">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by name, email, membership no..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 py-2 pl-9 pr-3 text-xs text-slate-900 dark:text-slate-200 focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div>
                <select
                  value={memberTypeFilter}
                  onChange={(e) => setMemberTypeFilter(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 py-2 px-3 text-xs text-slate-900 dark:text-slate-200 focus:border-indigo-600 focus:outline-none"
                >
                  <option value="">All Membership Types</option>
                  <option value="OWNER">Owners Only</option>
                  <option value="CO_OWNER">Co-owners Only</option>
                  <option value="TENANT">Tenants Only</option>
                  <option value="FAMILY_MEMBER">Family Members</option>
                  <option value="ASSOCIATE_MEMBER">Associate Members</option>
                </select>
              </div>

              <div>
                <select
                  value={committeeFilter}
                  onChange={(e) => setCommitteeFilter(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 py-2 px-3 text-xs text-slate-900 dark:text-slate-200 focus:border-indigo-600 focus:outline-none"
                >
                  <option value="">All Committee Roles</option>
                  <option value="COMMITTEE_ONLY">All Committee Members</option>
                  <option value="PRESIDENT">President</option>
                  <option value="SECRETARY">Secretary</option>
                  <option value="TREASURER">Treasurer</option>
                  <option value="COMMITTEE_MEMBER">Executive Members</option>
                </select>
              </div>
            </div>

            {/* Members Table */}
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-7 w-7 text-indigo-500 animate-spin" />
              </div>
            ) : membersList.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                <ShieldAlert className="h-8 w-8 text-slate-400 dark:text-slate-500 mx-auto" />
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">No members found</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">No resident records matched your search parameters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3.5">Member Info</th>
                      <th className="py-2.5 px-3.5">Contact</th>
                      <th className="py-2.5 px-3.5">Membership Type</th>
                      <th className="py-2.5 px-3.5">Committee Role</th>
                      <th className="py-2.5 px-3.5">Login Access</th>
                      <th className="py-2.5 px-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-300">
                    {membersList.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                        <td className="py-2.5 px-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-slate-800 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-slate-700 shadow-xs text-xs">
                              {m.name[0]?.toUpperCase() || 'M'}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-slate-100 text-xs">{m.name}</p>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                #{m.membershipNumber}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5">
                          <div className="space-y-0.5">
                            <p className="text-slate-800 dark:text-slate-300">{m.email}</p>
                            <p className="text-[11px] text-slate-500 font-mono">{m.mobile || 'No Mobile'}</p>
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5">
                          {getOccupancyBadge(m.memberType)}
                        </td>
                        <td className="py-2.5 px-3.5">
                          {getCommitteeBadge(m.committeeDesignation) || <span className="text-slate-600">-</span>}
                        </td>
                        <td className="py-2.5 px-3.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            m.canLogin ?? true
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50'
                                : 'bg-rose-50 dark:bg-red-950/40 text-rose-800 dark:text-red-400 border border-rose-200 dark:border-red-900/50'
                          }`}>
                            {m.canLogin ?? true ? 'Login Active' : 'No Login'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 text-right">
                          <Link
                            href={`/${society_slug}/members/${m.id}`}
                            className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800/60 px-2.5 py-1 rounded-lg text-xs transition-all"
                          >
                            Profile <ArrowRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 2: System Users & Staff Access         */}
        {/* ========================================== */}
        {activeTab === 'system_users' && (
          <div className="space-y-3.5">

            {/* Info Banner */}
            <div className="rounded-xl border border-sky-200 dark:border-sky-900/50 bg-sky-50 dark:bg-sky-950/20 p-3 text-xs text-sky-900 dark:text-sky-300 flex items-start gap-2.5 shadow-xs">
              <ShieldCheck className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sky-900 dark:text-sky-200">System Users & Non-Inventory Access Control</p>
                <p className="text-sky-800 dark:text-sky-300/80 mt-0.5 leading-relaxed">
                  Manage all users with active system logins in this society—including external professionals (<strong>Accountants, Auditors, Estate Managers, Facility Staff</strong>) who do not own a flat or hold inventory in the society.
                </p>
              </div>
            </div>

            {/* Search & Filters */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 p-3 rounded-xl shadow-xs">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by user name, email, or role..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 py-2 pl-9 pr-3 text-xs text-slate-900 dark:text-slate-200 focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div>
                <select
                  value={userCategoryFilter}
                  onChange={(e) => setUserCategoryFilter(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 py-2 px-3 text-xs text-slate-900 dark:text-slate-200 focus:border-indigo-600 focus:outline-none"
                >
                  <option value="">All User Categories</option>
                  <option value="STAFF_PROFESSIONAL">Non-Inventory Professionals & Staff (Accountants/Auditors/Staff)</option>
                  <option value="RESIDENT_MEMBER">Resident Members (Flat Owners/Tenants)</option>
                </select>
              </div>
            </div>

            {/* System Users Table */}
            {isUsersLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-7 w-7 text-indigo-600 dark:text-indigo-500 animate-spin" />
              </div>
            ) : filteredSystemUsers.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl space-y-2 bg-white/50 dark:bg-slate-950/20">
                <Users className="h-8 w-8 text-slate-400 dark:text-slate-500 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-300">No system users found</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">Click "Grant System Access" to invite an accountant, auditor, or staff member.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3.5">User Details</th>
                      <th className="py-2.5 px-3.5">Assigned System Role</th>
                      <th className="py-2.5 px-3.5">Society Affiliation</th>
                      <th className="py-2.5 px-3.5">Access Granted Date</th>
                      <th className="py-2.5 px-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-300">
                    {filteredSystemUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                        <td className="py-2.5 px-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-lg bg-sky-50 dark:bg-slate-800 flex items-center justify-center font-bold text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-slate-700 shadow-xs text-xs">
                              {u.name ? u.name[0]?.toUpperCase() : u.email[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-slate-200 text-xs">{u.name || 'User'}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <Mail className="h-3 w-3 text-slate-400" /> {u.email}
                              </p>
                              {u.mobile && (
                                <p className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                                  <Phone className="h-3 w-3 text-slate-400" /> {u.mobile}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {getRoleBadge(u.roleName)}
                        </td>
                        <td className="py-3.5 px-4">
                          {u.flatNumber ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-full">
                              <Building className="h-3 w-3 text-indigo-600 dark:text-indigo-400" /> Flat {u.flatNumber}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900/60 text-sky-800 dark:text-sky-300 px-2.5 py-1 rounded-full">
                              <Briefcase className="h-3 w-3 text-sky-600 dark:text-sky-400" /> Non-Inventory Professional / Staff
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                          {new Date(u.createdAt).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isManagementRole && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingUserRole(u);
                                    setNewRoleSelection(u.roleName);
                                  }}
                                  className="p-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-all"
                                  title="Change System Role"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleRevokeUserAccess(u)}
                                  className="p-1.5 rounded-lg border border-red-900/50 bg-red-950/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 transition-all"
                                  title="Revoke System Login Access"
                                >
                                  <UserX className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
      {/* ========================================== */}
      {/* MODAL: Grant System Access / Add User      */}
      {/* ========================================== */}
      {showGrantAccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Grant System Access
              </h3>
              <button
                onClick={() => setShowGrantAccessModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleGrantAccessSubmit} className="space-y-3.5 text-xs">
              <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                Grant login credentials to accountants, auditors, estate managers, or facility staff who do not own a flat in the society.
              </p>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Sharma"
                  value={grantAccessForm.name}
                  onChange={(e) => setGrantAccessForm({ ...grantAccessForm, name: e.target.value })}
                  className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs"
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold">Email Address (Login Username) *</label>
                <input
                  type="email"
                  required
                  placeholder="accountant@example.com"
                  value={grantAccessForm.email}
                  onChange={(e) => setGrantAccessForm({ ...grantAccessForm, email: e.target.value })}
                  className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold">Mobile Number</label>
                  <input
                    type="text"
                    placeholder="9876543210"
                    value={grantAccessForm.mobile}
                    onChange={(e) => setGrantAccessForm({ ...grantAccessForm, mobile: e.target.value })}
                    className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold">Initial Password</label>
                  <input
                    type="password"
                    placeholder="Defaults to Society@123"
                    value={grantAccessForm.password}
                    onChange={(e) => setGrantAccessForm({ ...grantAccessForm, password: e.target.value })}
                    className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold">Assigned System Role *</label>
                <select
                  value={grantAccessForm.roleName}
                  onChange={(e) => setGrantAccessForm({ ...grantAccessForm, roleName: e.target.value })}
                  className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs"
                >
                  <option value="ACCOUNTANT">Accountant (Ledgers, Vouchers, Payments Recording)</option>
                  <option value="AUDITOR">Auditor (Financial Auditing & Reports View)</option>
                  <option value="ESTATE_MANAGER">Estate Manager (Facility & Maintenance Operations)</option>
                  <option value="MAINTENANCE_INCHARGE">Maintenance Incharge</option>
                  <option value="SECURITY_SUPERVISOR">Security Supervisor</option>
                  <option value="PRESIDENT">President</option>
                  <option value="SECRETARY">Secretary</option>
                  <option value="TREASURER">Treasurer</option>
                  <option value="COMMITTEE_MEMBER">Executive Committee Member</option>
                  <option value="STAFF">Facility Staff / Technician</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowGrantAccessModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGranting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs disabled:opacity-50 cursor-pointer active:scale-95"
                >
                  {isGranting ? 'Granting...' : 'Grant Access'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: Change User Role                    */}
      {/* ========================================== */}
      {editingUserRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-sky-600 dark:text-sky-400" /> Change System Role
              </h3>
              <button
                onClick={() => setEditingUserRole(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateUserRoleSubmit} className="space-y-4 text-xs">
              <div className="bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Updating role for:</p>
                <p className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-0.5">{editingUserRole.name || editingUserRole.email}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{editingUserRole.email}</p>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold">Select New System Role</label>
                <select
                  value={newRoleSelection}
                  onChange={(e) => setNewRoleSelection(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2.5 px-3 text-xs text-slate-900 dark:text-slate-100 focus:border-sky-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs"
                >
                  <option value="ACCOUNTANT">Accountant</option>
                  <option value="AUDITOR">Auditor</option>
                  <option value="ESTATE_MANAGER">Estate Manager</option>
                  <option value="MAINTENANCE_INCHARGE">Maintenance Incharge</option>
                  <option value="SECURITY_SUPERVISOR">Security Supervisor</option>
                  <option value="PRESIDENT">President</option>
                  <option value="SECRETARY">Secretary</option>
                  <option value="TREASURER">Treasurer</option>
                  <option value="COMMITTEE_MEMBER">Executive Committee Member</option>
                  <option value="STAFF">Staff / Technician</option>
                  <option value="OWNER">Owner</option>
                  <option value="TENANT">Tenant</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUserRole(null)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGranting}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs disabled:opacity-50 cursor-pointer active:scale-95"
                >
                  Save New Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulkUpload && (
        <BulkUploadModal
          isOpen={showBulkUpload}
          onClose={() => setShowBulkUpload(false)}
          title="Bulk Import Society Members"
          entityName="Members"
          sampleHeaders={['Name', 'Email', 'Mobile', 'Member Type', 'Committee Designation']}
          sampleData={[
            ['Ramesh Sharma', 'ramesh@example.com', '9876543210', 'OWNER', 'SECRETARY'],
            ['Suresh Verma', 'suresh@example.com', '9876543211', 'TENANT', 'NONE'],
          ]}
          keyMapping={{
            'Name': 'name',
            'Email': 'email',
            'Mobile': 'mobile',
            'Member Type': 'memberType',
            'Committee Designation': 'committeeDesignation',
          }}
          onUpload={handleBulkUpload}
        />
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Add New Society Member
              </h3>
              <button
                onClick={() => setShowAddMember(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={newMemberForm.name}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, name: e.target.value })}
                    className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold">Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="ramesh@example.com"
                    value={newMemberForm.email}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, email: e.target.value })}
                    className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold">Mobile</label>
                  <input
                    type="text"
                    placeholder="9876543210"
                    value={newMemberForm.mobile}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, mobile: e.target.value })}
                    className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold">Membership Type</label>
                  <select
                    value={newMemberForm.memberType}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, memberType: e.target.value as any })}
                    className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs"
                  >
                    <option value="OWNER">Owner</option>
                    <option value="CO_OWNER">Co-owner</option>
                    <option value="TENANT">Tenant</option>
                    <option value="FAMILY_MEMBER">Family Member</option>
                    <option value="ASSOCIATE_MEMBER">Associate Member</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold">Committee Designation</label>
                <select
                  value={newMemberForm.committeeDesignation}
                  onChange={(e) => setNewMemberForm({ ...newMemberForm, committeeDesignation: e.target.value })}
                  className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition shadow-xs"
                >
                  <option value="NONE">None (Regular Resident)</option>
                  <option value="PRESIDENT">President</option>
                  <option value="SECRETARY">Secretary</option>
                  <option value="TREASURER">Treasurer</option>
                  <option value="COMMITTEE_MEMBER">Executive Committee Member</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddMember(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateMember}
                  disabled={isCreating}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs disabled:opacity-50 cursor-pointer active:scale-95"
                >
                  {isCreating ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
