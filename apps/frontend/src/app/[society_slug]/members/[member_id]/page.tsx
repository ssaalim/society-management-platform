'use client';

import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateMemberSchema, UpdateMemberDto } from '../../../../../../backend/src/modules/member/dto/update-member.dto';
import { useAuth } from '../../../providers/auth-context';
import { apiClient } from '../../../../lib/api/client';
import { Building, UploadCloud, CheckCircle, FileText, Loader2, AlertCircle, ArrowLeft, Users, ShieldAlert, History, CreditCard, Plus, Trash2, Home, Key, X, ShieldCheck, Lock, Eye, EyeOff, UserCheck, UserX } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

export default function MemberDetailPage() {
  const { society_slug, member_id } = useParams();
  const router = useRouter();
  const { activeSociety } = useAuth();
  const isManagementRole = ['SUPER_ADMIN', 'PRESIDENT', 'SECRETARY', 'COMMITTEE_MEMBER'].includes(activeSociety?.role || '');
  
  const [memberIdString, setMemberIdString] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [activeTab, setActiveTab] = useState<'profile' | 'family' | 'nominees' | 'flats' | 'idcard' | 'system'>('profile');
  const [memberData, setMemberData] = useState<any>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [uploadsInProgress, setUploadsInProgress] = useState<Record<string, boolean>>({});

  const { register, control, handleSubmit, setValue, formState: { errors }, reset, watch } = useForm<UpdateMemberDto>({
    resolver: zodResolver(updateMemberSchema),
    defaultValues: {
      familyMembers: [],
      nominees: [],
    }
  });

  const { fields: familyFields, append: appendFamily, remove: removeFamily } = useFieldArray({
    control,
    name: 'familyMembers',
  });

  const { fields: nomineeFields, append: appendNominee, remove: removeNominee } = useFieldArray({
    control,
    name: 'nominees',
  });

  // Watch fields for rendering live Digital ID Card updates
  const watchedName = memberData?.name || '';
  const watchedPhoto = watch('photoUrl') || '';
  const watchedType = watch('memberType') || 'OWNER';
  const watchedNo = watch('membershipNumber') || '';

  useEffect(() => {
    const fetchMemberDetails = async () => {
      if (!member_id) return;
      try {
        const res = await apiClient.get(`/members/${member_id}`);
        if (res.data?.success) {
          const profile = res.data.data;
          setMemberData(profile);
          setMemberIdString(profile.id);
          
          reset({
            name: profile.name || '',
            email: profile.email || '',
            mobile: profile.mobile || '',
            membershipNumber: profile.membershipNumber,
            memberType: profile.role || profile.memberType || 'OWNER',
            photoUrl: profile.photoUrl || '',
            aadhaarUrl: profile.aadhaarUrl || '',
            panUrl: profile.panUrl || '',
            agreementUrl: profile.agreementUrl || '',
            policeVerificationUrl: profile.policeVerificationUrl || '',
            emergencyContactName: profile.emergencyContactName || '',
            emergencyContactPhone: profile.emergencyContactPhone || '',
            status: profile.status || 'ACTIVE',
            canLogin: profile.canLogin ?? true,
            role: profile.role || profile.memberType || 'OWNER',
            password: '',
            familyMembers: profile.familyMembers || [],
            nominees: profile.nominees || [],
          });
        }
      } catch (err) {
        setMessage({ type: 'error', text: 'Failed to retrieve member details context.' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchMemberDetails();
  }, [member_id, reset]);

  const handleFileUpload = async (fileType: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isManagementRole) return;
    const file = e.target.files?.[0];
    if (!file || !memberIdString) return;

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
        setMessage({ type: 'success', text: `Document file '${fileType}' uploaded. Save changes to finalize.` });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Document upload failed.' });
    } finally {
      setUploadsInProgress((prev) => ({ ...prev, [fileType]: false }));
    }
  };

  const onSubmit = async (data: UpdateMemberDto) => {
    if (!isManagementRole || !memberIdString) return;
    setIsSaving(true);
    setMessage(null);

    try {
      const res = await apiClient.patch(`/members/${memberIdString}`, data);
      if (res.data?.success) {
        setMessage({ type: 'success', text: 'Member profile roster updated successfully.' });
        const updatedRes = await apiClient.get(`/members/${memberIdString}`);
        if (updatedRes.data?.success) {
          setMemberData(updatedRes.data.data);
        }
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error?.message || 'Failed to update member profile.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!isManagementRole || !memberIdString) return;
    if (!confirm('Are you sure you want to delete this member? All associated family & nominee rosters will be deleted.')) return;
    setIsSaving(true);
    setMessage(null);

    try {
      const res = await apiClient.delete(`/members/${memberIdString}`);
      if (res.data?.success) {
        router.push(`/${society_slug}/members`);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to delete member profile.' });
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
      {/* Background Grids */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="w-full max-w-[1450px] mx-auto space-y-8 z-10">
        
        {/* Back and Title */}
        <div className="space-y-4">
          <Link
            href={`/${society_slug}/members`}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-all"
          >
            <ArrowLeft className="h-3 w-3" /> Back to members directory
          </Link>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-5">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-indigo-400" />
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-100">
                  {memberData?.name || 'Resident Details'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Membership No: <span className="font-mono text-slate-300">{memberData?.membershipNumber}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold px-3 py-1 bg-indigo-950/40 border border-indigo-900/50 text-indigo-400 rounded-full w-fit">
                {memberData?.memberType}
              </span>
              {isManagementRole && activeTab !== 'idcard' && activeTab !== 'flats' && (
                <button
                  type="submit"
                  form="member-details-form"
                  disabled={isSaving}
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-slate-100 py-2 px-5 text-xs font-semibold disabled:opacity-55 transition-all flex items-center gap-2 shadow-md shadow-indigo-600/20"
                >
                  {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Changes
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab switchers */}
        <div className="flex border-b border-slate-800 space-x-4 overflow-x-auto">
          {[
            { key: 'profile', label: 'Profile' },
            { key: 'family', label: 'Family' },
            { key: 'nominees', label: 'Nominees' },
            { key: 'flats', label: 'Associated Flats' },
            { key: 'idcard', label: 'Digital ID Card' },
            { key: 'system', label: 'System & Credentials' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              className={`pb-3 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
                activeTab === tab.key ? 'border-indigo-500 text-slate-200' : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
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

        <form id="member-details-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <fieldset disabled={!isManagementRole} className="space-y-6">
            {activeTab === 'profile' && (
              <div className="space-y-6 max-w-3xl">
                {/* Personal Identity Details */}
                <div className="bg-slate-950/60 border border-slate-800 p-6 rounded-2xl space-y-4">
                  <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-3">Personal Details</h3>
                  
                  <div>
                    <label className="text-xs text-slate-400 font-medium">Full Name <span className="text-red-400">*</span></label>
                    <input
                      {...register('name')}
                      type="text"
                      placeholder="e.g. John Doe"
                      className="w-full rounded-lg border border-slate-800 bg-slate-900/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-indigo-600/50 focus:outline-none mt-1"
                    />
                    {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs text-slate-400 font-medium">Email Address <span className="text-red-400">*</span></label>
                      <input
                        {...register('email')}
                        type="email"
                        placeholder="john@example.com"
                        className="w-full rounded-lg border border-slate-800 bg-slate-900/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-indigo-600/50 focus:outline-none mt-1 font-mono"
                      />
                      {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 font-medium">Mobile Phone Number</label>
                      <input
                        {...register('mobile')}
                        type="text"
                        placeholder="+91 9876543210"
                        className="w-full rounded-lg border border-slate-800 bg-slate-900/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-indigo-600/50 focus:outline-none mt-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs text-slate-400 font-medium">Membership Number</label>
                      <input
                        {...register('membershipNumber')}
                        type="text"
                        className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 font-medium">Member Role & Designation</label>
                      <select
                        {...register('memberType')}
                        className="w-full rounded-lg border border-slate-800 bg-slate-900/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-indigo-600/50 focus:outline-none appearance-none mt-1"
                      >
                        <option value="OWNER">Owner</option>
                        <option value="CO_OWNER">Co-owner</option>
                        <option value="TENANT">Tenant</option>
                        <option value="ADMIN">Admin</option>
                        <option value="ACCOUNTANT">Accountant</option>
                        <option value="PRESIDENT">President</option>
                        <option value="SECRETARY">Secretary</option>
                        <option value="TREASURER">Treasurer</option>
                        <option value="COMMITTEE_MEMBER">Committee Member</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Emergency Contacts */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Emergency Contact Name</label>
                    <input
                      {...register('emergencyContactName')}
                      type="text"
                      placeholder="Emergency Contact Name"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Emergency Contact Phone</label>
                    <input
                      {...register('emergencyContactPhone')}
                      type="text"
                      placeholder="Emergency Contact Phone"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                    />
                  </div>
                </div>

                {/* Uploads grid */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">KYC Document Vault</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {[
                      { label: 'Photo Avatar', key: 'photoUrl' },
                      { label: 'Aadhaar Card PDF', key: 'aadhaarUrl' },
                      { label: 'PAN Card PDF', key: 'panUrl' },
                      { label: 'Purchase Agreement', key: 'agreementUrl' },
                      { label: 'Police Verification', key: 'policeVerificationUrl' }
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
                </div>

                {/* Delete profile area */}
                {isManagementRole && (
                  <div className="rounded-lg bg-red-950/20 border border-red-900/40 p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mt-8">
                    <div>
                      <h4 className="text-sm font-semibold text-red-400">Archive Member Profile</h4>
                      <p className="text-xs text-slate-500">Deletes this member profile, clearing family details and nominees share indices.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDeleteMember}
                      disabled={isSaving}
                      className="rounded-lg bg-red-950/50 hover:bg-red-900/50 border border-red-900/60 text-red-300 py-2 px-4 text-xs font-semibold transition-all disabled:opacity-55"
                    >
                      Confirm Delete
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'family' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <Users className="h-4 w-4" /> Family Roster
                    </h3>
                    <p className="text-xs text-slate-500">Declare residents living in the unit details</p>
                  </div>
                  {isManagementRole && (
                    <button
                      type="button"
                      onClick={() => appendFamily({ name: '', relation: '', mobile: '', aadhaar: '' })}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-slate-100 py-1.5 px-3.5 rounded-lg transition-all"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Family Member
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {familyFields.length === 0 ? (
                    <div className="text-center py-8 border border-slate-800 rounded-xl">
                      <p className="text-xs text-slate-500 italic">No family members registered.</p>
                    </div>
                  ) : (
                    familyFields.map((field, index) => (
                      <div key={field.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Relative #{index + 1}</span>
                          {isManagementRole && (
                            <button
                              type="button"
                              onClick={() => removeFamily(index)}
                              className="text-red-400 hover:text-red-300 transition-all"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                          <div>
                            <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Full Name</label>
                            <input
                              {...register(`familyMembers.${index}.name` as const)}
                              type="text"
                              placeholder="Name"
                              className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-1.5 px-3 text-xs text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Relation</label>
                            <input
                              {...register(`familyMembers.${index}.relation` as const)}
                              type="text"
                              placeholder="e.g. Spouse, Son"
                              className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-1.5 px-3 text-xs text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Mobile</label>
                            <input
                              {...register(`familyMembers.${index}.mobile` as const)}
                              type="text"
                              placeholder="Mobile"
                              className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-1.5 px-3 text-xs text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Aadhaar No</label>
                            <input
                              {...register(`familyMembers.${index}.aadhaar` as const)}
                              type="text"
                              placeholder="12 digit Aadhaar"
                              className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-1.5 px-3 text-xs text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'nominees' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <Users className="h-4 w-4" /> Share Nominees
                    </h3>
                    <p className="text-xs text-slate-500">Define ownership share nominees in event of transfer</p>
                  </div>
                  {isManagementRole && (
                    <button
                      type="button"
                      onClick={() => appendNominee({ name: '', relation: '', mobile: '', sharePercentage: 100 })}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-slate-100 py-1.5 px-3.5 rounded-lg transition-all"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Nominee
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {nomineeFields.length === 0 ? (
                    <div className="text-center py-8 border border-slate-800 rounded-xl">
                      <p className="text-xs text-slate-500 italic">No nominees declared.</p>
                    </div>
                  ) : (
                    nomineeFields.map((field, index) => (
                      <div key={field.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Nominee #{index + 1}</span>
                          {isManagementRole && (
                            <button
                              type="button"
                              onClick={() => removeNominee(index)}
                              className="text-red-400 hover:text-red-300 transition-all"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                          <div>
                            <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Full Name</label>
                            <input
                              {...register(`nominees.${index}.name` as const)}
                              type="text"
                              placeholder="Name"
                              className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-1.5 px-3 text-xs text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Relation</label>
                            <input
                              {...register(`nominees.${index}.relation` as const)}
                              type="text"
                              placeholder="Relation"
                              className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-1.5 px-3 text-xs text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Mobile</label>
                            <input
                              {...register(`nominees.${index}.mobile` as const)}
                              type="text"
                              placeholder="Mobile"
                              className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-1.5 px-3 text-xs text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Share Percentage (%)</label>
                            <input
                              {...register(`nominees.${index}.sharePercentage` as const, { valueAsNumber: true })}
                              type="number"
                              max="100"
                              placeholder="Share %"
                              className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-1.5 px-3 text-xs text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </fieldset>

          {activeTab === 'idcard' && (
            <div className="flex flex-col items-center py-8 space-y-6">
              {/* Premium CSS Digital ID Card */}
              <div className="w-80 h-96 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-indigo-500/50 p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden text-center select-none">
                
                {/* Visual Glassmorphism highlight */}
                <div className="absolute top-[-50px] right-[-50px] w-36 h-36 bg-indigo-500/10 rounded-full blur-3xl" />
                
                {/* Header housing society name */}
                <div className="border-b border-slate-800/80 pb-2 space-y-0.5">
                  <h3 className="text-xs font-black uppercase tracking-widest text-indigo-400">{activeSociety?.societyName || 'Society Resident'}</h3>
                  <span className="text-[8px] text-slate-500 tracking-wider">Housing Society Digital ID</span>
                </div>

                {/* Photo frame */}
                <div className="mx-auto w-24 h-24 rounded-full border-2 border-indigo-500/40 bg-slate-950 overflow-hidden flex items-center justify-center my-3 relative shadow-inner">
                  {watchedPhoto ? (
                    <img src={watchedPhoto} alt="Member Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <Users className="h-10 w-10 text-slate-700" />
                  )}
                </div>

                {/* Name & details */}
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-100">{watchedName}</h4>
                  <span className="inline-block text-[9px] font-black border border-indigo-900 bg-indigo-950/40 text-indigo-400 rounded-full px-2.5 py-0.5 uppercase tracking-widest">
                    {watchedType}
                  </span>
                </div>

                {/* Card footer details */}
                <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                  <div className="text-left font-mono">
                    <span className="text-[7px] text-slate-600 block uppercase">Member No</span>
                    <span className="font-semibold text-slate-300">{watchedNo || 'MEM-0000'}</span>
                  </div>

                  {/* Mock Verification barcode lines */}
                  <div className="flex gap-[2px] opacity-40">
                    <span className="w-[1px] h-6 bg-slate-200" />
                    <span className="w-[2px] h-6 bg-slate-200" />
                    <span className="w-[1px] h-6 bg-slate-200" />
                    <span className="w-[3px] h-6 bg-slate-200" />
                    <span className="w-[1px] h-6 bg-slate-200" />
                    <span className="w-[2px] h-6 bg-slate-200" />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-5 text-xs font-semibold text-slate-300 hover:bg-slate-900 hover:text-slate-100 transition-all"
              >
                <CreditCard className="h-3.5 w-3.5" /> Print Digital ID
              </button>
            </div>
          )}


        </form>

        {/* Associated Flats Tab (outside form, read-only) */}
        {activeTab === 'flats' && (
          <div className="space-y-6">
            {/* Owned Flats Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-200">Owned Flats</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/30 border border-emerald-900/50 text-emerald-400">
                  {memberData?.ownedFlats?.length || 0}
                </span>
              </div>

              {(!memberData?.ownedFlats || memberData.ownedFlats.length === 0) ? (
                <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl">
                  <Home className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">No owned flats found for this member</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/20">
                  <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-black/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-800">
                        <th className="p-3">Flat No</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Ownership</th>
                        <th className="p-3">Primary</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Since</th>
                        <th className="p-3">End Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {memberData.ownedFlats.map((flat: any, idx: number) => (
                        <tr key={flat.flatId || idx} className="text-slate-300 hover:bg-slate-900/20 transition-colors">
                          <td className="p-3">
                            <Link
                              href={`/${society_slug}/flats/${flat.flatId}`}
                              className="font-bold text-indigo-400 hover:text-indigo-300 transition-all"
                            >
                              {flat.number}
                            </Link>
                          </td>
                          <td className="p-3">
                            <span className="text-[10px] font-semibold border border-slate-700 bg-slate-800/40 rounded-full px-2 py-0.5 uppercase">
                              {flat.flatType || '-'}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-slate-500 dark:text-slate-400">
                            {flat.ownershipShare ? `${flat.ownershipShare}%` : '100%'}
                          </td>
                          <td className="p-3">
                            {flat.isPrimary ? (
                              <span className="text-[10px] font-semibold bg-emerald-950/30 border border-emerald-900/50 text-emerald-400 rounded-full px-2 py-0.5">Primary</span>
                            ) : (
                              <span className="text-[10px] text-slate-500">Secondary</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${
                              flat.isCurrent
                                ? 'bg-emerald-950/30 border border-emerald-900/50 text-emerald-400'
                                : 'bg-amber-950/30 border border-amber-900/50 text-amber-400'
                            }`}>
                              {flat.isCurrent ? 'Current' : 'Past'}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">{flat.startDate || '-'}</td>
                          <td className="p-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">{flat.endDate || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Rented Flats Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-bold text-slate-200">Rented Flats (Tenant)</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950/30 border border-amber-900/50 text-amber-400">
                  {memberData?.rentedFlats?.length || 0}
                </span>
              </div>

              {(!memberData?.rentedFlats || memberData.rentedFlats.length === 0) ? (
                <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl">
                  <Key className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">No rented flats found for this member</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/20">
                  <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-black/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-800">
                        <th className="p-3">Flat No</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Lease Start</th>
                        <th className="p-3">Lease End</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {memberData.rentedFlats.map((flat: any, idx: number) => (
                        <tr key={flat.flatId || idx} className="text-slate-300 hover:bg-slate-900/20 transition-colors">
                          <td className="p-3">
                            <Link
                              href={`/${society_slug}/flats/${flat.flatId}`}
                              className="font-bold text-indigo-400 hover:text-indigo-300 transition-all"
                            >
                              {flat.number}
                            </Link>
                          </td>
                          <td className="p-3">
                            <span className="text-[10px] font-semibold border border-slate-700 bg-slate-800/40 rounded-full px-2 py-0.5 uppercase">
                              {flat.flatType || '-'}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">{flat.leaseStart || '-'}</td>
                          <td className="p-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">{flat.leaseEnd || '-'}</td>
                          <td className="p-3">
                            <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${
                              flat.isActive
                                ? 'bg-emerald-950/30 border border-emerald-900/50 text-emerald-400'
                                : 'bg-slate-800 border border-slate-700 text-slate-500 dark:text-slate-400'
                            }`}>
                              {flat.isActive ? 'Active' : 'Ended'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* System & Credentials Tab */}
        {activeTab === 'system' && (
          <div className="space-y-6 max-w-3xl">
            
            {/* System Access & Login Status Header Box */}
            <div className="bg-slate-950/60 border border-slate-800 p-6 rounded-2xl space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/20 text-indigo-400">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100">System Login & Access Control</h3>
                    <p className="text-xs text-slate-400">Configure member login permissions, account activity status, system role, and access password.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-3 py-1 rounded-full border uppercase tracking-wider ${
                    watch('canLogin')
                      ? 'bg-emerald-950/50 border-emerald-800 text-emerald-400'
                      : 'bg-red-950/50 border-red-800 text-red-400'
                  }`}>
                    {watch('canLogin') ? 'LOGIN ENABLED' : 'LOGIN DISABLED'}
                  </span>
                  <span className={`text-[10px] font-bold px-3 py-1 rounded-full border uppercase tracking-wider ${
                    watch('status') === 'ACTIVE'
                      ? 'bg-emerald-950/50 border-emerald-800 text-emerald-400'
                      : 'bg-amber-950/50 border-amber-800 text-amber-400'
                  }`}>
                    {watch('status') || 'ACTIVE'}
                  </span>
                </div>
              </div>

              {/* Login Enable/Disable Toggle */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-emerald-400" /> System Login Access
                    </label>
                    <input
                      type="checkbox"
                      checked={watch('canLogin') ?? true}
                      onChange={(e) => setValue('canLogin', e.target.checked)}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    When enabled, member can authenticate using their email address and system password.
                  </p>
                </div>

                {/* Active / Inactive Status Switch */}
                <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl space-y-3">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <UserX className="h-4 w-4 text-amber-400" /> Account Activity Status
                  </label>
                  <select
                    value={watch('status') || 'ACTIVE'}
                    onChange={(e) => setValue('status', e.target.value as any)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/80 py-2 px-3 text-xs text-slate-200 focus:border-indigo-600/50 focus:outline-none"
                  >
                    <option value="ACTIVE">ACTIVE (Operational & Active)</option>
                    <option value="INACTIVE">INACTIVE (Suspended / Disabled)</option>
                    <option value="PENDING">PENDING (Approval Pending)</option>
                    <option value="EXPIRED">EXPIRED (Lease / Membership Expired)</option>
                  </select>
                  <p className="text-[11px] text-slate-400">
                    Inactive members are barred from logging in and accessing society features.
                  </p>
                </div>
              </div>

              {/* System Role Selection */}
              <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl space-y-3">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-indigo-400" /> System Role & Designation
                </label>
                <select
                  value={watch('memberType') || 'OWNER'}
                  onChange={(e) => {
                    setValue('memberType', e.target.value as any);
                    setValue('role', e.target.value as any);
                  }}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/80 py-2.5 px-3 text-xs text-slate-200 focus:border-indigo-600/50 focus:outline-none"
                >
                  <option value="OWNER">Owner (Default Flat Owner Role)</option>
                  <option value="CO_OWNER">Co-Owner (Co-Owner Resident Role)</option>
                  <option value="TENANT">Tenant (Renting Resident Role)</option>
                  <option value="ADMIN">Admin (Full Management Administrator)</option>
                  <option value="ACCOUNTANT">Accountant (Ledger & Billing Management)</option>
                  <option value="PRESIDENT">President (Executive Oversight)</option>
                  <option value="SECRETARY">Secretary (Administrative Oversight)</option>
                  <option value="TREASURER">Treasurer (Financial & Bank Oversight)</option>
                  <option value="COMMITTEE_MEMBER">Committee Member (Management Board)</option>
                </select>
                <p className="text-[11px] text-slate-400">
                  Assigns navigation items, administrative powers, and portal access rights to this member.
                </p>
              </div>

              {/* Username / Login Email & Password Configuration */}
              <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl space-y-4">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-emerald-400" /> Username & Password Credentials
                </label>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">Username / Login Email</label>
                    <input
                      type="email"
                      placeholder="e.g. member@society.dev"
                      {...register('email')}
                      className="w-full mt-1 rounded-lg border border-slate-800 bg-slate-950/80 py-2.5 px-3 text-xs text-slate-200 focus:border-indigo-600/50 focus:outline-none font-mono"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Email address used to log into the portal system.</p>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">System Access Password</label>
                    <div className="relative mt-1">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter password (min 6 chars)"
                        {...register('password')}
                        className="w-full rounded-lg border border-slate-800 bg-slate-950/80 py-2.5 pl-3.5 pr-10 text-xs text-slate-200 placeholder-slate-600 focus:border-indigo-600/50 focus:outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Leave blank if keeping current password.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
