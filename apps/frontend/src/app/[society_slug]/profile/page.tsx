'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateSocietySchema, UpdateSocietyDto } from '../../../../../backend/src/modules/society/dto/update-society.dto';
import { useAuth } from '../../providers/auth-context';
import { apiClient } from '../../../lib/api/client';
import { 
  Building, 
  UploadCloud, 
  CheckCircle, 
  FileText, 
  Loader2, 
  AlertCircle, 
  X, 
  Settings, 
  History, 
  Calendar, 
  AlertTriangle, 
  ShieldCheck, 
  ShieldAlert, 
  User, 
  Clock,
  ArrowRight
} from 'lucide-react';
import { useParams } from 'next/navigation';

interface ExpiryStatus {
  renewalDate: string | null;
  registrationDate: string | null;
  registrationNumber: string | null;
  daysLeft: number | null;
  isExpired: boolean;
  isNearExpiry: boolean;
  status: 'EXPIRED' | 'NEAR_EXPIRY' | 'ACTIVE' | 'NOT_SET';
}

interface AuditLogItem {
  id: string;
  action: string;
  entityName: string;
  entityId: string;
  oldValues: any;
  newValues: any;
  createdAt: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
}

export default function SocietyProfilePage() {
  const { society_slug } = useParams();
  const { activeSociety } = useAuth();
  const isManagementRole = ['SUPER_ADMIN', 'PRESIDENT', 'SECRETARY'].includes(activeSociety?.role || '');
  
  const [activeTab, setActiveTab] = useState<'profile' | 'history'>('profile');
  const [societyId, setSocietyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Registration Expiry & History States
  const [expiryStatus, setExpiryStatus] = useState<ExpiryStatus | null>(null);
  const [historyLogs, setHistoryLogs] = useState<AuditLogItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  // Track upload tasks progress
  const [uploadsInProgress, setUploadsInProgress] = useState<Record<string, boolean>>({});

  const { register, handleSubmit, setValue, formState: { errors }, reset } = useForm<UpdateSocietyDto>({
    resolver: zodResolver(updateSocietySchema),
  });

  const fetchProfile = async () => {
    if (!society_slug) return;
    try {
      setIsLoading(true);
      const res = await apiClient.get(`/societies/slug/${society_slug}`);
      if (res.data?.success) {
        const profile = res.data.data;
        setSocietyId(profile.id);
        reset({
          name: profile.name,
          slug: profile.slug,
          address: profile.address || '',
          gstin: profile.gstin || '',
          pan: profile.pan || '',
          tan: profile.tan || '',
          registrationNumber: profile.registrationNumber || '',
          registrationDate: profile.registrationDate ? profile.registrationDate.substring(0, 10) : '',
          renewalDate: profile.renewalDate ? profile.renewalDate.substring(0, 10) : '',
          logoUrl: profile.logoUrl,
          registrationCertificateUrl: profile.registrationCertificateUrl,
          byeLawsUrl: profile.byeLawsUrl,
          bankPassbookUrl: profile.bankPassbookUrl,
        });

        // Fetch expiry status
        if (profile.id) {
          fetchExpiryStatus(profile.id);
          fetchHistory(profile.id);
        }
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to retrieve society profile.' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchExpiryStatus = async (id: string) => {
    try {
      const res = await apiClient.get(`/societies/${id}/registration-expiry`);
      if (res.data?.success) {
        setExpiryStatus(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to load expiry status:', err);
    }
  };

  const fetchHistory = async (id: string) => {
    try {
      setIsLoadingHistory(true);
      const res = await apiClient.get(`/societies/${id}/history`);
      if (res.data?.success) {
        setHistoryLogs(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to load change history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [society_slug, reset]);

  const handleFileUpload = async (fileType: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isManagementRole) return;
    const file = e.target.files?.[0];
    if (!file || !societyId) return;

    setUploadsInProgress((prev) => ({ ...prev, [fileType]: true }));
    setMessage(null);

    try {
      const resUrl = await apiClient.post(
        `/societies/${societyId}/documents/upload-url?fileType=${fileType}&fileName=${encodeURIComponent(file.name)}`
      );

      if (resUrl.data?.success) {
        const { uploadUrl, publicUrl } = resUrl.data.data;

        await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        });

        setValue(fileType as any, publicUrl, { shouldDirty: true });
        setMessage({ type: 'success', text: `Document '${fileType}' uploaded successfully. Save changes to update profile.` });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Document upload failed.' });
    } finally {
      setUploadsInProgress((prev) => ({ ...prev, [fileType]: false }));
    }
  };

  const onSubmit = async (data: UpdateSocietyDto) => {
    if (!isManagementRole || !societyId) return;
    setIsSaving(true);
    setMessage(null);

    try {
      const res = await apiClient.patch(`/societies/${societyId}`, data);
      if (res.data?.success) {
        setMessage({ type: 'success', text: 'Society profile and registration settings updated successfully.' });
        fetchExpiryStatus(societyId);
        fetchHistory(societyId);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error?.message || 'Failed to update profile.' });
    } finally {
      setIsSaving(false);
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
    <main className="relative flex min-h-screen flex-col items-center justify-start overflow-x-hidden w-full py-8 px-4 sm:px-6 md:px-8 lg:px-10">
      {/* Visual background grids */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="w-full max-w-[1450px] mx-auto space-y-6 z-10">
        
        {/* Header Title */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Settings className="h-8 w-8 text-indigo-400" />
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-100">Society Profile & Settings</h2>
              <p className="text-xs text-slate-400">Official statutory registration, renewal tracking, tax identifiers, and change audit log</p>
            </div>
          </div>

          {/* Sub-Tab Navigation */}
          <div className="flex items-center gap-2 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'profile'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building className="h-3.5 w-3.5" /> Profile & Registration
            </button>
            <button
              onClick={() => {
                setActiveTab('history');
                if (societyId) fetchHistory(societyId);
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'history'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="h-3.5 w-3.5" /> Change History ({historyLogs.length})
            </button>
          </div>
        </div>

        {/* ========================================== */}
        {/* STATUTORY REGISTRATION RENEWAL / EXPIRY ALERT BANNER */}
        {/* ========================================== */}
        {expiryStatus?.status === 'EXPIRED' && (
          <div className="rounded-xl border border-red-800/80 bg-red-950/40 p-4 text-red-200 flex items-start gap-3 shadow-lg animate-pulse">
            <ShieldAlert className="h-6 w-6 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-bold text-sm text-red-100 flex items-center gap-2">
                CRITICAL ALERT: Society Statutory Registration Has Expired!
              </p>
              <p className="text-red-300">
                The official registration renewal date of <strong>{expiryStatus.renewalDate}</strong> passed{' '}
                <strong>{Math.abs(expiryStatus.daysLeft || 0)} day(s) ago</strong>. 
                Please initiate immediate renewal filings with the Registrar of Co-operative Societies to remain legally compliant.
              </p>
            </div>
          </div>
        )}

        {expiryStatus?.status === 'NEAR_EXPIRY' && (
          <div className="rounded-xl border border-amber-800/80 bg-amber-950/40 p-4 text-amber-200 flex items-start gap-3 shadow-lg">
            <AlertTriangle className="h-6 w-6 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-bold text-sm text-amber-100 flex items-center gap-2">
                ACTION REQUIRED: Society Registration Renewal Due Soon ({expiryStatus.daysLeft} Days Left)
              </p>
              <p className="text-amber-300">
                Society registration renewal is due on <strong>{expiryStatus.renewalDate}</strong>. 
                Please prepare mandatory statutory audit forms and AGM resolutions for Registrar renewal submission.
              </p>
            </div>
          </div>
        )}

        {expiryStatus?.status === 'ACTIVE' && (
          <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-3.5 text-emerald-300 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <span>
                Statutory Registration in Good Standing • Next Renewal Due: <strong>{expiryStatus.renewalDate}</strong> ({expiryStatus.daysLeft} days remaining)
              </span>
            </div>
            <span className="text-[10px] uppercase font-bold bg-emerald-900/50 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-800">
              Active Compliant
            </span>
          </div>
        )}

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

        {/* ========================================== */}
        {/* TAB 1: Profile & Registration Form         */}
        {/* ========================================== */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <fieldset disabled={!isManagementRole} className="space-y-8">
              {/* Section 1: Basic Identifiers */}
              <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/30 p-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-indigo-400">Official Identifiers & Registration</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-400 font-medium">Society Name *</label>
                    <input
                      {...register('name')}
                      type="text"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-indigo-600 focus:outline-none mt-1"
                    />
                    {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 font-medium">Society URL Slug</label>
                    <input
                      {...register('slug')}
                      type="text"
                      disabled
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/30 py-2.5 px-3.5 text-sm text-slate-500 focus:outline-none mt-1 disabled:opacity-55"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 items-start">
                  <div>
                    <div className="flex items-center justify-between h-5 mb-1">
                      <label className="text-xs text-slate-400 font-medium">Registration Number</label>
                    </div>
                    <input
                      {...register('registrationNumber')}
                      type="text"
                      placeholder="e.g. BOM/HSG/12345/2010"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-indigo-600 focus:outline-none uppercase font-mono"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between h-5 mb-1">
                      <label className="text-xs text-slate-400 font-medium">Registration Date</label>
                    </div>
                    <input
                      {...register('registrationDate')}
                      type="date"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between h-5 mb-1">
                      <label className="text-xs text-slate-400 font-medium">Statutory Renewal Date</label>
                      {expiryStatus?.daysLeft !== null && expiryStatus?.daysLeft !== undefined && (
                        <span className={`text-[10px] font-bold ${expiryStatus.daysLeft < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {expiryStatus.daysLeft < 0 ? `${Math.abs(expiryStatus.daysLeft)}d overdue` : `${expiryStatus.daysLeft}d left`}
                        </span>
                      )}
                    </div>
                    <input
                      {...register('renewalDate')}
                      type="date"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Taxation and Coordinates */}
              <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/30 p-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-indigo-400">Tax & Address Coordinates</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="text-xs text-slate-400 font-medium">GSTIN (GST Number)</label>
                    <input
                      {...register('gstin')}
                      type="text"
                      maxLength={15}
                      placeholder="27AAAAA1111A1Z1"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-indigo-600 focus:outline-none mt-1 uppercase font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 font-medium">PAN Number</label>
                    <input
                      {...register('pan')}
                      type="text"
                      maxLength={10}
                      placeholder="AAAAA1111A"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-indigo-600 focus:outline-none mt-1 uppercase font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 font-medium">TAN Number</label>
                    <input
                      {...register('tan')}
                      type="text"
                      maxLength={10}
                      placeholder="AAAA11111A"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-indigo-600 focus:outline-none mt-1 uppercase font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-medium">Official Postal Address</label>
                  <textarea
                    {...register('address')}
                    rows={3}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-indigo-600 focus:outline-none mt-1"
                  />
                </div>
              </div>

              {/* Section 3: Official Upload Documents */}
              <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/30 p-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-indigo-400">Official Document Uploads</h3>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  {[
                    { label: 'Registration Certificate', key: 'registrationCertificateUrl' },
                    { label: 'Bye Laws Document', key: 'byeLawsUrl' },
                    { label: 'Society PAN Document', key: 'logoUrl' },
                    { label: 'Bank Passbook Copy', key: 'bankPassbookUrl' }
                  ].map((doc) => (
                    <div key={doc.key} className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-200">{doc.label}</span>
                        {uploadsInProgress[doc.key] ? (
                          <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" />
                        ) : (
                          <FileText className="h-4 w-4 text-slate-500" />
                        )}
                      </div>

                      {isManagementRole && (
                        <div className="relative flex items-center justify-center border border-dashed border-slate-800 rounded-lg p-6 bg-black/60 hover:bg-slate-900/60 transition-all cursor-pointer">
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => handleFileUpload(doc.key, e)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <div className="text-center space-y-1">
                            <UploadCloud className="h-6 w-6 text-slate-500 mx-auto" />
                            <p className="text-xs text-slate-400">Click to upload files (PDF or JPEG)</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </fieldset>

            {/* Submit Button */}
            {isManagementRole && (
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-slate-100 py-2.5 px-6 font-semibold transition-all disabled:opacity-55 flex items-center gap-2"
                >
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Profile Changes
                </button>
              </div>
            )}
          </form>
        )}

        {/* ========================================== */}
        {/* TAB 2: Change History & Audit Trail        */}
        {/* ========================================== */}
        {activeTab === 'history' && (
          <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/30 p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <History className="h-4 w-4 text-indigo-400" /> Settings & Profile Mutation History
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Chronological audit log of all changes made to society profile, legal dates, and configurations</p>
              </div>
              <button
                onClick={() => societyId && fetchHistory(societyId)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                Refresh Log
              </button>
            </div>

            {isLoadingHistory ? (
              <div className="py-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-400" /> Loading change history...
              </div>
            ) : historyLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No mutation change history recorded for this society yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {historyLogs.map((log) => {
                  const dateStr = new Date(log.createdAt).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div key={log.id} className="py-4 space-y-2 text-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-indigo-400 font-mono uppercase bg-indigo-950/50 border border-indigo-900/60 px-2 py-0.5 rounded text-[10px]">
                            {log.action}
                          </span>
                          <span className="text-slate-300 font-semibold">
                            {log.entityName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                          <Clock className="h-3 w-3" />
                          <span>{dateStr}</span>
                          {log.userName && (
                            <span className="flex items-center gap-1 text-slate-400 font-medium">
                              • <User className="h-3 w-3 text-slate-500" /> {log.userName} ({log.userEmail || 'Admin'})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Snapshots comparison */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                        {log.oldValues && (
                          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Previous Values</p>
                            <pre className="text-[11px] font-mono text-red-300/80 overflow-x-auto max-h-32 p-1">
                              {JSON.stringify(log.oldValues, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.newValues && (
                          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Updated Values</p>
                            <pre className="text-[11px] font-mono text-emerald-300/80 overflow-x-auto max-h-32 p-1">
                              {JSON.stringify(log.newValues, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
