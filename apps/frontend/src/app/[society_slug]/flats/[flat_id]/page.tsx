'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateFlatSchema, UpdateFlatDto } from '../../../../../../backend/src/modules/flat/dto/update-flat.dto';
import { useAuth } from '../../../providers/auth-context';
import { apiClient } from '../../../../lib/api/client';
import { Building, UploadCloud, CheckCircle, FileText, Loader2, AlertCircle, ArrowLeft, Users, ShieldAlert, History , X } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

export default function FlatDetailPage() {
  const { society_slug, flat_id } = useParams();
  const router = useRouter();
  const { activeSociety } = useAuth();
  
  const isManagementRole = ['SUPER_ADMIN', 'PRESIDENT', 'SECRETARY', 'COMMITTEE_MEMBER'].includes(activeSociety?.role || '');
  const [flatIdString, setFlatIdString] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'tenancy' | 'history'>('profile');
  const [flatData, setFlatData] = useState<any>(null);
  const [membersList, setMembersList] = useState<{ id: string; name: string; email?: string; mobile?: string; memberType?: string }[]>([]);

  // Change Owner Modal state
  const [isChangeOwnerModalOpen, setIsChangeOwnerModalOpen] = useState<boolean>(false);
  const [newOwnerId, setNewOwnerId] = useState<string>('');
  const [transferDate, setTransferDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [transferNotes, setTransferNotes] = useState<string>('');

  const [uploadsInProgress, setUploadsInProgress] = useState<Record<string, boolean>>({});

  const { register, handleSubmit, setValue, formState: { errors }, reset } = useForm<UpdateFlatDto>({
    resolver: zodResolver(updateFlatSchema),
  });

  useEffect(() => {
    const fetchFlatDetails = async () => {
      if (!flat_id) return;
      try {
        const res = await apiClient.get(`/flats/${flat_id}`);
        const resMembers = await apiClient.get('/members');
        if (resMembers.data?.success) {
          setMembersList(resMembers.data.data);
        }
        if (res.data?.success) {
          const profile = res.data.data;
          setFlatData(profile);
          setFlatIdString(profile.id);
          reset({
            number: profile.number,
            floorId: profile.floorId,
            sqftArea: Number(profile.sqftArea),
            carpetArea: profile.carpetArea ? Number(profile.carpetArea) : null,
            terraceArea: profile.terraceArea ? Number(profile.terraceArea) : null,
            flatType: profile.flatType,
            tenantId: profile.activeTenant?.tenantId || '',
            leaseStart: profile.activeTenant?.leaseStart ? profile.activeTenant.leaseStart.substring(0, 10) : '',
            leaseEnd: profile.activeTenant?.leaseEnd ? profile.activeTenant.leaseEnd.substring(0, 10) : '',
            rentalAgreementUrl: profile.activeTenant?.rentalAgreementUrl || '',
            policeVerificationUrl: profile.activeTenant?.policeVerificationUrl || '',
            tenantNocUrl: profile.activeTenant?.tenantNocUrl || '',
            emergencyContactName: profile.activeTenant?.emergencyContactName || '',
            emergencyContactPhone: profile.activeTenant?.emergencyContactPhone || '',
          });
        }
      } catch (err) {
        setMessage({ type: 'error', text: 'Failed to retrieve flat coordinates details.' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchFlatDetails();
  }, [flat_id, reset]);

  const handleChangeOwnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flat_id) return;
    setIsSaving(true);
    setMessage(null);

    try {
      const res = await apiClient.post(`/flats/${flat_id}/change-owner`, {
        newOwnerId,
        transferDate,
        notes: transferNotes,
      });

      if (res.data?.success) {
        setMessage({ type: 'success', text: 'Ownership transfer processed successfully. Previous owner archived in history.' });
        setIsChangeOwnerModalOpen(false);
        // Refresh flat details
        const refreshed = await apiClient.get(`/flats/${flat_id}`);
        if (refreshed.data?.success) {
          setFlatData(refreshed.data.data);
        }
      }
    } catch (err: any) {
      setMessage({ 
        type: 'error', 
        text: err.response?.data?.error?.message || 'Failed to process ownership transfer.' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (fileType: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isManagementRole) return;
    const file = e.target.files?.[0];
    if (!file || !flatIdString) return;

    setUploadsInProgress((prev) => ({ ...prev, [fileType]: true }));
    setMessage(null);

    try {
      const resUrl = await apiClient.post(
        `/societies/${activeSociety?.societyId}/documents/upload-url?fileType=bye_laws&fileName=${encodeURIComponent(file.name)}`
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
        setMessage({ type: 'success', text: `Lease document '${fileType}' uploaded. Save changes to update.` });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Document upload failed.' });
    } finally {
      setUploadsInProgress((prev) => ({ ...prev, [fileType]: false }));
    }
  };

  const onSubmit = async (data: UpdateFlatDto) => {
    if (!isManagementRole || !flatIdString) return;
    setIsSaving(true);
    setMessage(null);

    try {
      const res = await apiClient.patch(`/flats/${flatIdString}`, data);
      if (res.data?.success) {
        setMessage({ type: 'success', text: 'Flat details updated successfully.' });
        setFlatData(res.data.data);
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update flat details.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMoveOut = async () => {
    if (!isManagementRole || !flatIdString) return;
    setIsSaving(true);
    setMessage(null);

    try {
      const todayStr = new Date().toISOString().substring(0, 10);
      const res = await apiClient.patch(`/flats/${flatIdString}`, {
        moveOutDate: todayStr,
      });

      if (res.data?.success) {
        setMessage({ type: 'success', text: 'Tenant checkout move-out processed cleanly.' });
        setFlatData(res.data.data);
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to process tenant move-out.' });
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
    <main className="relative flex min-h-screen flex-col items-center justify-start overflow-x-hidden w-full py-12 px-4 sm:px-6 lg:px-8">
      {/* Background Grids */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="w-full max-w-4xl z-10 space-y-8 bg-slate-900/30 border border-slate-800 p-8 rounded-2xl backdrop-blur-xl">
        
        {/* Back navigation */}
        <Link
          href={`/${society_slug}/flats`}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-all"
        >
          <ArrowLeft className="h-3 w-3" /> Back to housing units roster
        </Link>

        {/* Header summary */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-indigo-950/60 border border-indigo-900/50 flex items-center justify-center text-indigo-400 font-bold">
              {flatData?.number}
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-100">
                Flat {flatData?.number} — {flatData?.flatType}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {flatData?.buildingName} • {flatData?.wingName} • Floor {flatData?.floorNumber}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-3 py-1 bg-indigo-950/40 border border-indigo-900/50 text-indigo-400 rounded-full w-fit">
            {flatData?.occupancyStatus.replace('_', ' ')}
          </span>
        </div>

        {/* Tab switchers */}
        <div className="flex border-b border-slate-800 space-x-4">
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-3 text-sm font-semibold transition-all border-b-2 ${
              activeTab === 'profile' ? 'border-indigo-500 text-slate-200' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            Unit Properties
          </button>
          <button
            onClick={() => setActiveTab('tenancy')}
            className={`pb-3 text-sm font-semibold transition-all border-b-2 ${
              activeTab === 'tenancy' ? 'border-indigo-500 text-slate-200' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            Active Tenant & NOC
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 text-sm font-semibold transition-all border-b-2 ${
              activeTab === 'history' ? 'border-indigo-500 text-slate-200' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            Owner & Lease History
          </button>
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <fieldset disabled={!isManagementRole} className="space-y-6">
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Super Builtup Area (SqFt)</label>
                    <input
                      {...register('sqftArea', { valueAsNumber: true })}
                      type="number"
                      step="0.01"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1 font-semibold"
                    />
                    {errors.sqftArea && <p className="text-xs text-red-500 mt-1">{errors.sqftArea.message}</p>}
                  </div>

                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Carpet Area (SqFt)</label>
                    <input
                      {...register('carpetArea', { valueAsNumber: true })}
                      type="number"
                      step="0.01"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Terrace Area (SqFt)</label>
                    <input
                      {...register('terraceArea', { valueAsNumber: true })}
                      type="number"
                      step="0.01"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Flat Unit Type</label>
                    <input
                      {...register('flatType')}
                      type="text"
                      placeholder="e.g. 2BHK, Penthouse"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1 font-semibold"
                    />
                  </div>
                </div>

                {/* Owner details overview with Change Owner trigger */}
                <div className="space-y-4 pt-4 border-t border-slate-800/40">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <Users className="h-4 w-4 text-emerald-400" /> Current Flat Owner
                    </h3>
                    {isManagementRole && (
                      <button
                        type="button"
                        onClick={() => setIsChangeOwnerModalOpen(true)}
                        className="rounded-lg bg-indigo-600/80 hover:bg-indigo-600 border border-indigo-500/50 text-white py-1.5 px-3 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
                      >
                        <Users className="h-3.5 w-3.5" /> Transfer / Change Owner
                      </button>
                    )}
                  </div>

                  {flatData?.owners.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No owners assigned to this flat yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {flatData?.owners.map((ow: any) => (
                        <div key={ow.ownerId} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-1">
                          <p className="text-sm font-bold text-slate-200">{ow.name || 'Owner Profile'}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{ow.email} • {ow.mobile}</p>
                          <div className="flex items-center gap-2 pt-2">
                            <span className="text-[10px] bg-emerald-950/50 border border-emerald-800 text-emerald-400 font-extrabold rounded-full px-2.5 py-0.5 uppercase tracking-wider">
                              ACTIVE OWNER ({ow.ownershipShare || '100'}%)
                            </span>
                            {ow.startDate && (
                              <span className="text-[10px] text-slate-500 font-mono">
                                Since {String(ow.startDate).substring(0, 10)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'tenancy' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Select Tenant (Existing Member) <span className="text-red-400">*</span></label>
                    <select
                      {...register('tenantId')}
                      className={`w-full rounded-lg border bg-slate-900/50 py-2.5 px-3.5 text-sm focus:outline-none focus:ring-1 transition-all mt-1 ${
                        errors.tenantId ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20 text-red-200' : 'border-slate-800 text-slate-200 focus:border-indigo-600/50 focus:ring-indigo-600/30'
                      }`}
                    >
                      <option value="">-- Select Member as Tenant --</option>
                      {membersList.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.email || m.mobile || 'Tenant Profile'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Emergency Contact Name</label>
                    <input
                      {...register('emergencyContactName')}
                      type="text"
                      placeholder="e.g. Relation, relative name"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                    />
                  </div>
                </div>

                {/* Uploads */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {[
                    { label: 'Rental Agreement', key: 'rentalAgreementUrl' },
                    { label: 'Police Verification', key: 'policeVerificationUrl' },
                    { label: 'Tenant NOC Upload', key: 'tenantNocUrl' }
                  ].map((doc) => (
                    <div key={doc.key} className="rounded-xl border border-slate-800 bg-slate-950/30 p-4 space-y-3">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                        <span>{doc.label}</span>
                        {uploadsInProgress[doc.key] ? (
                          <Loader2 className="h-3 w-3 text-indigo-400 animate-spin" />
                        ) : (
                          <FileText className="h-3 w-3 text-slate-500" />
                        )}
                      </div>
                      {isManagementRole && (
                        <div className="relative flex items-center justify-center border border-dashed border-slate-800 rounded-lg p-4 bg-black/60 hover:bg-slate-900/60 transition-all cursor-pointer">
                          <input
                            type="file"
                            onChange={(e) => handleFileUpload(doc.key, e)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <UploadCloud className="h-5 w-5 text-slate-500" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Move out action */}
                {isManagementRole && flatData?.activeTenant && (
                  <div className="rounded-lg bg-red-950/20 border border-red-900/40 p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mt-8">
                    <div>
                      <h4 className="text-sm font-semibold text-red-400">Lease Move-Out Checkout</h4>
                      <p className="text-xs text-slate-500">Deactivate active lease coordinates and log previous tenant details to histories archive.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleMoveOut}
                      disabled={isSaving}
                      className="rounded-lg bg-red-950/50 hover:bg-red-900/50 border border-red-900/60 text-red-300 py-2 px-4 text-xs font-semibold transition-all disabled:opacity-55"
                    >
                      Confirm Move Out
                    </button>
                  </div>
                )}
              </div>
            )}
          </fieldset>

          {activeTab === 'history' && (
            <div className="space-y-8">
              {/* Section 1: Previous Owners History & Time Period */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-400" /> Previous Owners Timeline & Transfer History
                  </h3>
                  <span className="text-xs text-slate-500 font-semibold">
                    {flatData?.ownerHistory?.length || 0} Records Logged
                  </span>
                </div>

                {!flatData?.ownerHistory || flatData.ownerHistory.length === 0 ? (
                  <div className="text-center py-6 border border-slate-800 rounded-xl bg-slate-950/30">
                    <p className="text-xs text-slate-500 italic">No ownership transfers logged for this unit.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
                    <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                      <thead>
                        <tr className="bg-slate-950/90 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-800">
                          <th className="p-3">Owner Name</th>
                          <th className="p-3">Contact Email & Phone</th>
                          <th className="p-3">Ownership Status</th>
                          <th className="p-3">Ownership Period (Start → End)</th>
                          <th className="p-3">Notes & Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {flatData.ownerHistory.map((oh: any) => (
                          <tr key={oh.id} className="text-slate-300 hover:bg-slate-900/20">
                            <td className="p-3 font-bold text-slate-200">{oh.name || 'Owner Profile'}</td>
                            <td className="p-3 text-slate-500 dark:text-slate-400">{oh.email} <span className="text-slate-500">({oh.mobile || 'No Phone'})</span></td>
                            <td className="p-3">
                              {oh.isCurrent ? (
                                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800 text-emerald-400 uppercase">
                                  Current Owner
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-500 dark:text-slate-400 uppercase">
                                  Former Owner
                                </span>
                              )}
                            </td>
                            <td className="p-3 font-mono text-slate-300">
                              {oh.startDate ? String(oh.startDate).substring(0, 10) : 'N/A'} → {oh.isCurrent ? <span className="text-emerald-400 font-semibold">Present</span> : (oh.endDate ? String(oh.endDate).substring(0, 10) : 'Archived')}
                            </td>
                            <td className="p-3 text-slate-500 dark:text-slate-400 italic">{oh.notes || 'Ownership transfer'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Section 2: Previous Lease Histories */}
              <div className="space-y-4 pt-4 border-t border-slate-800/40">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <History className="h-4 w-4 text-indigo-400" /> Previous Tenant Lease Histories
                </h3>
                {flatData?.history.length === 0 ? (
                  <div className="text-center py-6 border border-slate-800 rounded-xl bg-slate-950/30">
                    <p className="text-xs text-slate-500 italic">No historical tenancy listings logged for this unit.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
                    <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                      <thead>
                        <tr className="bg-slate-950/90 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-800">
                          <th className="p-3">Tenant Name</th>
                          <th className="p-3">Lease Start</th>
                          <th className="p-3">Lease End</th>
                          <th className="p-3">Move-In Date</th>
                          <th className="p-3">Move-Out Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {flatData?.history.map((h: any) => (
                          <tr key={h.leaseId} className="text-slate-300 hover:bg-slate-900/10">
                            <td className="p-3 font-medium text-slate-200">{h.name || 'Tenant profile'}</td>
                            <td className="p-3 font-mono">{h.leaseStart ? String(h.leaseStart).substring(0, 10) : '-'}</td>
                            <td className="p-3 font-mono">{h.leaseEnd ? String(h.leaseEnd).substring(0, 10) : '-'}</td>
                            <td className="p-3 font-mono">{h.moveInDate ? String(h.moveInDate).substring(0, 10) : '-'}</td>
                            <td className="p-3 font-mono text-red-400">{h.moveOutDate ? String(h.moveOutDate).substring(0, 10) : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Submit Save Button */}
          {isManagementRole && activeTab !== 'history' && (
            <div className="flex justify-end pt-4 border-t border-slate-800/40">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-slate-100 py-2 px-5 text-sm font-semibold transition-all disabled:opacity-55 flex items-center gap-2 shadow-md"
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          )}
        </form>

        {/* Change Owner Modal Dialog */}
        {isChangeOwnerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsChangeOwnerModalOpen(false)} />
            
            {/* Modal Panel */}
            <div className="relative w-full max-w-lg bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

              {/* Header */}
              <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/90 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-600/20 border border-emerald-500/20">
                    <Users className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-100">Transfer Flat Ownership</h3>
                    <p className="text-[11px] text-slate-500">Record an ownership change for Flat {flatData?.number}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsChangeOwnerModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto">
                <form id="change-owner-form" onSubmit={handleChangeOwnerSubmit} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">New Owner (From Existing Members)</label>
                  <select
                    value={newOwnerId}
                    onChange={(e) => setNewOwnerId(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1 font-semibold"
                    required
                  >
                    <option value="">-- Select Member as Owner --</option>
                    {membersList.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.email || m.mobile || 'Member'}) [{m.memberType || 'RESIDENT'}]
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Transfer Effective Date</label>
                  <input
                    type="date"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Transfer Notes / Reason</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Sale Agreement #1092, Registered Deed, Inheritance"
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                  />
                </div>

                </form>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-800 bg-slate-950 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsChangeOwnerModalOpen(false)}
                  className="rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-4 text-xs font-semibold text-slate-500 hover:bg-slate-900 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="change-owner-form"
                  disabled={isSaving}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-100 py-2 px-6 text-xs font-semibold disabled:opacity-55 transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                >
                  {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Transferring...</> : 'Confirm Ownership Transfer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
