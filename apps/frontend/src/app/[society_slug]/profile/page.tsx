'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateSocietySchema, UpdateSocietyDto } from '../../../../../backend/src/modules/society/dto/update-society.dto';
import { useAuth } from '../../providers/auth-context';
import { apiClient } from '../../../lib/api/client';
import { Building, UploadCloud, CheckCircle, FileText, Loader2, AlertCircle, X, Settings } from 'lucide-react';
import { useParams } from 'next/navigation';

export default function SocietyProfilePage() {
  const { society_slug } = useParams();
  const { activeSociety } = useAuth();
  const isManagementRole = ['SUPER_ADMIN', 'PRESIDENT', 'SECRETARY'].includes(activeSociety?.role || '');
  const [societyId, setSocietyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Track upload tasks progress
  const [uploadsInProgress, setUploadsInProgress] = useState<Record<string, boolean>>({});

  const { register, handleSubmit, setValue, formState: { errors }, reset } = useForm<UpdateSocietyDto>({
    resolver: zodResolver(updateSocietySchema),
  });

  // Resolve society details from slug parameter on mount
  useEffect(() => {
    const fetchProfile = async () => {
      if (!society_slug) return;
      try {
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
        }
      } catch (err: any) {
        setMessage({ type: 'error', text: 'Failed to retrieve society profile.' });
      } finally {
        setIsLoading(false);
      }
    };
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
        setMessage({ type: 'success', text: 'Society profile updated successfully.' });
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

      <div className="w-full max-w-[1450px] mx-auto space-y-8 z-10">
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-indigo-400" />
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-100">Society Profile</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">View official registration certificates, tax identifiers, and bye-laws</p>
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <fieldset disabled={!isManagementRole} className="space-y-8">
            {/* Section 1: Basic Identifiers */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Official Identifiers</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Society Name</label>
                  <input
                    {...register('name')}
                    type="text"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                  />
                  {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
                </div>

                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Society URL Slug</label>
                  <input
                    {...register('slug')}
                    type="text"
                    disabled
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/30 py-2.5 px-3.5 text-sm text-slate-500 focus:outline-none mt-1 disabled:opacity-55"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Registration Number</label>
                  <input
                    {...register('registrationNumber')}
                    type="text"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Registration Date</label>
                  <input
                    {...register('registrationDate')}
                    type="date"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Renewal Date</label>
                  <input
                    {...register('renewalDate')}
                    type="date"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Taxation and Coordinates */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Tax & Address Coordinates</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">GSTIN (GST Number)</label>
                  <input
                    {...register('gstin')}
                    type="text"
                    maxLength={15}
                    placeholder="27AAAAA1111A1Z1"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">PAN Number</label>
                  <input
                    {...register('pan')}
                    type="text"
                    maxLength={10}
                    placeholder="AAAAA1111A"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">TAN Number</label>
                  <input
                    {...register('tan')}
                    type="text"
                    maxLength={10}
                    placeholder="AAAA11111A"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Postal Address</label>
                <textarea
                  {...register('address')}
                  rows={3}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                />
              </div>
            </div>

            {/* Section 3: Official Upload Documents */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Official Document Uploads</h3>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {[
                  { label: 'Registration Certificate', key: 'registrationCertificateUrl' },
                  { label: 'Bye Laws Document', key: 'byeLawsUrl' },
                  { label: 'Society PAN Document', key: 'logoUrl' },
                  { label: 'Bank Passbook Copy', key: 'bankPassbookUrl' }
                ].map((doc) => (
                  <div key={doc.key} className="rounded-xl border border-slate-800 bg-slate-950/30 p-5 space-y-4">
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
                          <p className="text-xs text-slate-500 dark:text-slate-400">Click to upload files (PDF or JPEG)</p>
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
      </div>
    </main>
  );
}
