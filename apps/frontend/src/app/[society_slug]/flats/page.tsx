'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/auth-context';
import { apiClient } from '../../../lib/api/client';
import { PromptModal, PromptModalConfig } from '../../../components/prompt-modal';
import { Building, Search, Filter, ShieldAlert, Plus, ArrowRight, Loader2, Settings2 , X, Upload } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import BulkUploadModal from '../../../components/bulk-upload-modal';

interface FlatListItem {
  id: string;
  number: string;
  flatType: string;
  sqftArea: string;
  floorNumber: number;
  wingName: string;
  buildingName: string;
  buildingId: string;
  wingId: string;
  occupancyStatus: 'VACANT' | 'OWNER_OCCUPIED' | 'TENANT_OCCUPIED';
}

interface LayoutHierarchy {
  id: string;
  name: string;
  wings: {
    id: string;
    name: string;
    floors: {
      id: string;
      number: number;
    }[];
  }[];
}

export default function FlatsListingPage() {
  const { society_slug } = useParams();
  const { activeSociety } = useAuth();
  
  const isOwner = activeSociety?.role === 'OWNER';
  const [flatsList, setFlatsList] = useState<FlatListItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Filters state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [occupancyFilter, setOccupancyFilter] = useState<string>('');
  const [buildingFilter, setBuildingFilter] = useState<string>('');
  const [wingFilter, setWingFilter] = useState<string>('');
  const [ownerFilter, setOwnerFilter] = useState<string>('');
  const [buildingsList, setBuildingsList] = useState<{ id: string; name: string }[]>([]);
  const [wingsList, setWingsList] = useState<{ id: string; name: string }[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const isManagementRole = ['SUPER_ADMIN', 'PRESIDENT', 'SECRETARY', 'COMMITTEE_MEMBER', 'ACCOUNTANT'].includes(activeSociety?.role || '');

  // Add Flat Modal State
  const [isAddFlatModalOpen, setIsAddFlatModalOpen] = useState<boolean>(false);
  const [showBulkUpload, setShowBulkUpload] = useState<boolean>(false);
  const [promptConfig, setPromptConfig] = useState<PromptModalConfig>({ isOpen: false, title: '', label: '', placeholder: '', onSubmit: () => {}, onCancel: () => setPromptConfig(prev => ({ ...prev, isOpen: false })) });
  const [newFlatNumber, setNewFlatNumber] = useState<string>('');
  const [newFlatType, setNewFlatType] = useState<string>('2BHK');
  const [newSqftArea, setNewSqftArea] = useState<string>('1200');
  const [newCarpetArea, setNewCarpetArea] = useState<string>('');
  const [layoutHierarchy, setLayoutHierarchy] = useState<LayoutHierarchy[]>([]);
  const [selectedLayoutBuildingId, setSelectedLayoutBuildingId] = useState<string>('');
  const [selectedLayoutWingId, setSelectedLayoutWingId] = useState<string>('');
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  // Owner & Tenant Assignment State
  const [membersList, setMembersList] = useState<{ id: string; name: string; email?: string; mobile?: string; memberType?: string }[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');
  const [assignTenantToggle, setAssignTenantToggle] = useState<boolean>(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [leaseStart, setLeaseStart] = useState<string>('');
  const [leaseEnd, setLeaseEnd] = useState<string>('');
  const [emergencyContactName, setEmergencyContactName] = useState<string>('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState<string>('');
  const [rentalAgreementUrl, setRentalAgreementUrl] = useState<string>('');
  const [policeVerificationUrl, setPoliceVerificationUrl] = useState<string>('');
  const [tenantNocUrl, setTenantNocUrl] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!society_slug) return;
      try {
        setIsLoading(true);
        // Fetch flats with filters query parameters
        const urlParams = new URLSearchParams();
        if (searchTerm) urlParams.append('search', searchTerm);
        if (buildingFilter) urlParams.append('buildingId', buildingFilter);
        if (wingFilter) urlParams.append('wingId', wingFilter);
        if (occupancyFilter) urlParams.append('occupancyStatus', occupancyFilter);
        if (ownerFilter) urlParams.append('ownerMemberId', ownerFilter);

        const resFlats = await apiClient.get(`/flats?${urlParams.toString()}`);
        if (resFlats.data?.success) {
          setFlatsList(resFlats.data.data);
        }

        const resLayout = await apiClient.get('/flats/layout');
        if (resLayout.data?.success) {
          setLayoutHierarchy(resLayout.data.data);
        }

        // Fetch society members for owner & tenant assignment dropdowns
        const resMembers = await apiClient.get('/members');
        if (resMembers.data?.success) {
          setMembersList(resMembers.data.data);
        }

        // Extract buildings and floors
        const uniqBuildingsMap: Record<string, string> = {};
        const uniqWingsMap: Record<string, string> = {};
        resFlats.data.data.forEach((f: FlatListItem) => {
          uniqBuildingsMap[f.buildingId] = f.buildingName;
          uniqWingsMap[f.wingId] = f.wingName;
        });
        setBuildingsList(
          Object.entries(uniqBuildingsMap).map(([id, name]) => ({ id, name }))
        );
        setWingsList(
          Object.entries(uniqWingsMap).map(([id, name]) => ({ id, name }))
        );
      } catch (err) {
        console.error('Failed to load flats roster:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [society_slug, searchTerm, occupancyFilter, buildingFilter]);

  const handleCreateBuilding = () => {
    setPromptConfig({
      isOpen: true,
      title: 'Add Building / Tower',
      subtitle: 'Create a new main structure in your society',
      label: 'Building Name',
      placeholder: 'e.g. Tower A',
      onCancel: () => setPromptConfig(prev => ({ ...prev, isOpen: false })),
      onSubmit: async (name) => {
        setPromptConfig(prev => ({ ...prev, isOpen: false }));
        try {
          const res = await apiClient.post('/flats/layout/building', { name });
          if (res.data?.success) {
            setSelectedLayoutBuildingId(res.data.data.id);
            const resLayout = await apiClient.get('/flats/layout');
            if (resLayout.data?.success) setLayoutHierarchy(resLayout.data.data);
          }
        } catch (err) {
          alert('Failed to create building');
        }
      }
    });
  };

  const handleCreateWing = () => {
    if (!selectedLayoutBuildingId) return alert('Select a building first');
    setPromptConfig({
      isOpen: true,
      title: 'Add Wing',
      subtitle: 'Create a new wing inside the selected building',
      label: 'Wing Name',
      placeholder: 'e.g. Wing A1',
      onCancel: () => setPromptConfig(prev => ({ ...prev, isOpen: false })),
      onSubmit: async (name) => {
        setPromptConfig(prev => ({ ...prev, isOpen: false }));
        try {
          const res = await apiClient.post('/flats/layout/wing', { buildingId: selectedLayoutBuildingId, name });
          if (res.data?.success) {
            setSelectedLayoutWingId(res.data.data.id);
            const resLayout = await apiClient.get('/flats/layout');
            if (resLayout.data?.success) setLayoutHierarchy(resLayout.data.data);
          }
        } catch (err) {
          alert('Failed to create wing');
        }
      }
    });
  };

  const handleCreateFloor = () => {
    if (!selectedLayoutWingId) return alert('Select a wing first');
    setPromptConfig({
      isOpen: true,
      title: 'Add Floor',
      subtitle: 'Add a new floor to the selected wing',
      label: 'Floor Number',
      placeholder: 'e.g. 1, 2, 3...',
      onCancel: () => setPromptConfig(prev => ({ ...prev, isOpen: false })),
      onSubmit: async (numberStr) => {
        const number = parseInt(numberStr, 10);
        if (isNaN(number)) return alert('Invalid floor number');
        setPromptConfig(prev => ({ ...prev, isOpen: false }));
        try {
          const res = await apiClient.post('/flats/layout/floor', { wingId: selectedLayoutWingId, number });
          if (res.data?.success) {
            setSelectedFloorId(res.data.data.id);
            const resLayout = await apiClient.get('/flats/layout');
            if (resLayout.data?.success) setLayoutHierarchy(resLayout.data.data);
          }
        } catch (err) {
          alert('Failed to create floor');
        }
      }
    });
  };

  const handleAddFlatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Require explicit floor selection now that we have layout configs
      if (!selectedFloorId) {
        alert('Please select a building, wing, and floor to assign this flat to.');
        setIsSubmitting(false);
        return;
      }

      const payload: any = {
        number: newFlatNumber,
        flatType: newFlatType,
        sqftArea: Number(newSqftArea),
        carpetArea: newCarpetArea ? Number(newCarpetArea) : undefined,
        floorId: selectedFloorId,
      };

      if (selectedOwnerId) {
        payload.ownerId = selectedOwnerId;
      }

      if (assignTenantToggle && selectedTenantId && leaseStart && leaseEnd) {
        payload.tenantId = selectedTenantId;
        payload.leaseStart = leaseStart;
        payload.leaseEnd = leaseEnd;
        payload.emergencyContactName = emergencyContactName || undefined;
        payload.emergencyContactPhone = emergencyContactPhone || undefined;
        payload.rentalAgreementUrl = rentalAgreementUrl || undefined;
        payload.policeVerificationUrl = policeVerificationUrl || undefined;
        payload.tenantNocUrl = tenantNocUrl || undefined;
      }

      const res = await apiClient.post('/flats', payload);

      if (res.data?.success) {
        setIsAddFlatModalOpen(false);
        setNewFlatNumber('');
        setSelectedOwnerId('');
        setAssignTenantToggle(false);
        setSelectedTenantId('');
        setLeaseStart('');
        setLeaseEnd('');
        // Refresh roster list
        const resFlats = await apiClient.get('/flats');
        if (resFlats.data?.success) {
          setFlatsList(resFlats.data.data);
        }
      }
    } catch (err) {
      console.error('Failed to create new flat unit:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkUpload = async (data: any[]) => {
    try {
      const res = await apiClient.post('/flats/bulk', data);
      if (res.data?.success) {
        alert(`Successfully imported ${res.data.data.importedCount} flats to roster.`);
        // Refresh list
        const refRes = await apiClient.get('/flats');
        if (refRes.data?.success) {
          setFlatsList(refRes.data.data);
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Bulk Import failed. Verify file columns structure.');
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-start overflow-x-hidden w-full py-8 px-4 sm:px-6 md:px-8 lg:px-10">
      {/* Background Grids */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="w-full max-w-[1450px] mx-auto space-y-8 z-10">
        
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Building className="h-8 w-8 text-indigo-400" />
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-100">
                {isOwner ? 'My Housing Unit' : 'Flats Roster & Master Config'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isOwner ? 'View your assigned flat unit properties, layout, and occupancy details' : 'Configure housing layout units, sizes, owners & occupancy status'}
              </p>
            </div>
          </div>
          {isManagementRole && (
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-slate-950/60 border border-slate-800 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-200'}`}
                >
                  Grid
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-200'}`}
                >
                  List
                </button>
              </div>
              <Link
                href={`/${society_slug}/flats/layout`}
                className="rounded-lg border border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 px-3 text-xs font-semibold transition-all flex items-center gap-2 shadow-md"
              >
                <Settings2 className="h-4 w-4" /> Layout Settings
              </Link>
              <button
                onClick={() => setShowBulkUpload(true)}
                className="rounded-lg border border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 px-3 text-xs font-semibold transition-all flex items-center gap-2 shadow-md"
              >
                <Upload className="h-4 w-4" /> Import Bulk
              </button>
              <button
                onClick={() => setIsAddFlatModalOpen(true)}
                className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-slate-100 py-2 px-4 text-xs font-semibold transition-all flex items-center gap-2 shadow-md"
              >
                <Plus className="h-4 w-4" /> Add Flat Master Entry
              </button>
            </div>
          )}
        </div>

        {/* Filters Panel - Only for Management */}
        {!isOwner && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-5 bg-slate-950/40 border border-slate-800 p-4 rounded-xl">
            {/* Search by Number */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search Flat No..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-600 focus:border-slate-700 focus:outline-none"
              />
            </div>

            {/* Filter by Building */}
            <div className="relative">
              <select
                value={buildingFilter}
                onChange={(e) => setBuildingFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-3.5 text-sm text-slate-500 dark:text-slate-400 focus:border-slate-700 focus:outline-none appearance-none"
              >
                <option value="">All Towers</option>
                {buildingsList.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Filter by Wing */}
            <div className="relative">
              <select
                value={wingFilter}
                onChange={(e) => setWingFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-3.5 text-sm text-slate-500 dark:text-slate-400 focus:border-slate-700 focus:outline-none appearance-none"
              >
                <option value="">All Wings</option>
                {wingsList.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            {/* Filter by Occupancy Status */}
            <div className="relative">
              <select
                value={occupancyFilter}
                onChange={(e) => setOccupancyFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-3.5 text-sm text-slate-500 dark:text-slate-400 focus:border-slate-700 focus:outline-none appearance-none"
              >
                <option value="">All Occupancies</option>
                <option value="VACANT">Vacant</option>
                <option value="OWNER_OCCUPIED">Owner Occupied</option>
                <option value="TENANT_OCCUPIED">Tenant Occupied</option>
              </select>
            </div>

            {/* Filter by Owner */}
            <div className="relative">
              <select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-3.5 text-sm text-slate-500 dark:text-slate-400 focus:border-slate-700 focus:outline-none appearance-none"
              >
                <option value="">All Owners</option>
                {membersList.filter(m => m.memberType === 'OWNER' || m.memberType === 'CO_OWNER').map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
          </div>
        ) : flatsList.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl space-y-3">
            <ShieldAlert className="h-10 w-10 text-slate-500 mx-auto" />
            <h3 className="text-md font-semibold text-slate-300">
              {isOwner ? 'No assigned flat found' : 'No flats found'}
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              {isOwner ? 'Your account does not have a flat assigned in this society yet.' : 'No housing units match the selected search or filter coordinates.'}
            </p>
          </div>
        ) : viewMode === 'list' ? (
          /* List View of Flats */
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
            <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
              <thead className="bg-slate-900 text-xs uppercase text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Flat</th>
                  <th className="px-4 py-3 font-medium">Building & Wing</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                  <th className="px-4 py-3 font-medium">Occupancy</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {flatsList.map((flat) => {
                  const statusColors = {
                    VACANT: 'bg-slate-900 border-slate-800 text-slate-500 dark:text-slate-400',
                    OWNER_OCCUPIED: 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400',
                    TENANT_OCCUPIED: 'bg-indigo-950/40 border-indigo-900/50 text-indigo-400',
                  };
                  const statusKey = (flat.occupancyStatus || 'VACANT') as keyof typeof statusColors;
                  const badgeStyle = statusColors[statusKey] || statusColors.VACANT;

                  return (
                    <tr key={flat.id} className="hover:bg-slate-900/30 transition-colors">
                      <td className="px-4 py-4 font-bold text-slate-200">
                        {flat.number}
                        <div className="text-[10px] font-normal text-slate-500">Floor {flat.floorNumber}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-slate-300 font-medium">{flat.buildingName}</div>
                        <div className="text-xs text-slate-500">Wing {flat.wingName}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-slate-300">{flat.flatType}</div>
                        <div className="text-xs text-slate-500">{flat.sqftArea} SqFt</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-[10px] font-semibold border rounded-full px-2.5 py-1 uppercase tracking-wider ${badgeStyle}`}>
                          {(flat.occupancyStatus || 'VACANT').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Link
                          href={`/${society_slug}/flats/${flat.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-all"
                        >
                          {isOwner ? 'View' : 'Manage'} <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Grid of Flats */
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {flatsList.map((flat) => {
              // Color badges based on occupancy status
              const statusColors = {
                VACANT: 'bg-slate-900 border-slate-800 text-slate-500 dark:text-slate-400',
                OWNER_OCCUPIED: 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400',
                TENANT_OCCUPIED: 'bg-indigo-950/40 border-indigo-900/50 text-indigo-400',
              };

              return (
                <div 
                  key={flat.id} 
                  className="rounded-xl border border-slate-800 bg-slate-950/20 p-5 hover:bg-slate-900/30 transition-all flex flex-col justify-between space-y-4"
                >
                  {(() => {
                    const statusKey = (flat.occupancyStatus || 'VACANT') as keyof typeof statusColors;
                    const badgeStyle = statusColors[statusKey] || statusColors.VACANT;
                    return (
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-lg font-bold text-slate-200">Flat {flat.number}</h4>
                          <p className="text-xs text-slate-500">{flat.buildingName} • {flat.wingName} • Floor {flat.floorNumber}</p>
                        </div>
                        <span className={`text-[10px] font-semibold border rounded-full px-2.5 py-1 uppercase tracking-wider ${badgeStyle}`}>
                          {(flat.occupancyStatus || 'VACANT').replace('_', ' ')}
                        </span>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400 border-t border-b border-slate-800/40 py-2.5">
                    <div>
                      <span className="text-slate-600 block">Unit Type</span>
                      <span className="font-semibold text-slate-300">{flat.flatType}</span>
                    </div>
                    <div>
                      <span className="text-slate-600 block">Super Area</span>
                      <span className="font-semibold text-slate-300">{flat.sqftArea} SqFt</span>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Link
                      href={`/${society_slug}/flats/${flat.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-all"
                    >
                      {isOwner ? 'View Unit Details' : 'Manage Unit'} <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <PromptModal config={promptConfig} />

      {/* Add Flat Master Entry Modal */}
      {isAddFlatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAddFlatModalOpen(false)} />
          
          {/* Modal Panel */}
          <div className="relative w-full max-w-lg bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/90 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-600/20 border border-indigo-500/20">
                  <Building className="h-5 w-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">Create Flat Master Entry</h3>
                  <p className="text-[11px] text-slate-500">Configure a new property unit for the society</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddFlatModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto">
              <form id="add-flat-form" onSubmit={handleAddFlatSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Flat Unit Number</label>
                <input
                  type="text"
                  placeholder="e.g. A-101, B-402, Shop-03"
                  value={newFlatNumber}
                  onChange={(e) => setNewFlatNumber(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1 font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Flat Unit Type</label>
                  <select
                    value={newFlatType}
                    onChange={(e) => setNewFlatType(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                  >
                    <option value="1BHK">1BHK</option>
                    <option value="2BHK">2BHK</option>
                    <option value="3BHK">3BHK</option>
                    <option value="4BHK">4BHK</option>
                    <option value="Penthouse">Penthouse</option>
                    <option value="Shop">Shop / Commercial</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Super Builtup Area (SqFt)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="1200"
                    value={newSqftArea}
                    onChange={(e) => setNewSqftArea(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1 font-semibold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Carpet Area (SqFt - Optional)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="950"
                  value={newCarpetArea}
                  onChange={(e) => setNewCarpetArea(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                />
              </div>

              {/* Layout Configuration: Building -> Wing -> Floor */}
              <div className="border-t border-slate-800/80 pt-3 space-y-4">
                <h4 className="text-sm font-semibold text-slate-300 mb-2">Location Configuration</h4>
                
                {/* Building Selection */}
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Select Building / Tower <span className="text-red-400">*</span></label>
                    <select
                      value={selectedLayoutBuildingId}
                      onChange={(e) => {
                        setSelectedLayoutBuildingId(e.target.value);
                        setSelectedLayoutWingId('');
                        setSelectedFloorId('');
                      }}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-3 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                      required
                    >
                      <option value="">-- Choose Building --</option>
                      {layoutHierarchy.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateBuilding}
                    className="mb-[1px] rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-3 text-xs font-semibold transition-all border border-indigo-500"
                  >
                    + Add
                  </button>
                </div>

                {/* Wing Selection */}
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Select Wing <span className="text-red-400">*</span></label>
                    <select
                      value={selectedLayoutWingId}
                      onChange={(e) => {
                        setSelectedLayoutWingId(e.target.value);
                        setSelectedFloorId('');
                      }}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-3 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1 disabled:opacity-50"
                      disabled={!selectedLayoutBuildingId}
                      required
                    >
                      <option value="">-- Choose Wing --</option>
                      {layoutHierarchy
                        .find(b => b.id === selectedLayoutBuildingId)
                        ?.wings.map((w) => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateWing}
                    disabled={!selectedLayoutBuildingId}
                    className="mb-[1px] rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-3 text-xs font-semibold transition-all border border-indigo-500 disabled:opacity-50"
                  >
                    + Add
                  </button>
                </div>

                {/* Floor Selection */}
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Select Floor <span className="text-red-400">*</span></label>
                    <select
                      value={selectedFloorId}
                      onChange={(e) => setSelectedFloorId(e.target.value)}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-3 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1 disabled:opacity-50"
                      disabled={!selectedLayoutWingId}
                      required
                    >
                      <option value="">-- Choose Floor --</option>
                      {layoutHierarchy
                        .find(b => b.id === selectedLayoutBuildingId)
                        ?.wings.find(w => w.id === selectedLayoutWingId)
                        ?.floors.map((f) => (
                          <option key={f.id} value={f.id}>Floor {f.number}</option>
                        ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateFloor}
                    disabled={!selectedLayoutWingId}
                    className="mb-[1px] rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-3 text-xs font-semibold transition-all border border-indigo-500 disabled:opacity-50"
                  >
                    + Add
                  </button>
                </div>
              </div>

              {/* Assign Primary Owner from Existing Members */}
              <div className="border-t border-slate-800/80 pt-3">
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center justify-between">
                  <span>Assign Primary Owner (From Existing Members)</span>
                  <span className="text-[10px] text-indigo-400 font-semibold">Existing Roster</span>
                </label>
                <select
                  value={selectedOwnerId}
                  onChange={(e) => setSelectedOwnerId(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                >
                  <option value="">-- Select Member as Owner (or Leave Vacant) --</option>
                  {membersList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.email || m.mobile || 'Member'}) [{m.memberType || 'RESIDENT'}]
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Owner will be linked from existing registered society members.
                </p>
              </div>

              {/* Assign Tenant & Tenancy Documents Option */}
              <div className="border-t border-slate-800/80 pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="assignTenantToggle"
                    checked={assignTenantToggle}
                    onChange={(e) => setAssignTenantToggle(e.target.checked)}
                    className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0"
                  />
                  <label htmlFor="assignTenantToggle" className="text-xs font-semibold text-slate-200 cursor-pointer">
                    Flat is rented — Assign Active Tenant & Tenancy Documents
                  </label>
                </div>

                {assignTenantToggle && (
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4 animate-in fade-in duration-150">
                    <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Select Tenant (Existing Member)</label>
                      <select
                        value={selectedTenantId}
                        onChange={(e) => setSelectedTenantId(e.target.value)}
                        className="w-full rounded-lg border border-slate-800 bg-slate-900 py-2 px-3 text-xs text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                        required={assignTenantToggle}
                      >
                        <option value="">-- Select Member as Tenant --</option>
                        {membersList.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.email || m.mobile || 'Tenant Profile'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Lease Start Date</label>
                        <input
                          type="date"
                          value={leaseStart}
                          onChange={(e) => setLeaseStart(e.target.value)}
                          className="w-full rounded-lg border border-slate-800 bg-slate-900 py-2 px-3 text-xs text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                          required={assignTenantToggle}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Lease End Date</label>
                        <input
                          type="date"
                          value={leaseEnd}
                          onChange={(e) => setLeaseEnd(e.target.value)}
                          className="w-full rounded-lg border border-slate-800 bg-slate-900 py-2 px-3 text-xs text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                          required={assignTenantToggle}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Emergency Contact Person</label>
                        <input
                          type="text"
                          placeholder="Contact Name"
                          value={emergencyContactName}
                          onChange={(e) => setEmergencyContactName(e.target.value)}
                          className="w-full rounded-lg border border-slate-800 bg-slate-900 py-2 px-3 text-xs text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Emergency Phone</label>
                        <input
                          type="text"
                          placeholder="+91 Mobile No."
                          value={emergencyContactPhone}
                          onChange={(e) => setEmergencyContactPhone(e.target.value)}
                          className="w-full rounded-lg border border-slate-800 bg-slate-900 py-2 px-3 text-xs text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-1 border-t border-slate-800/60">
                      <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">Tenancy Document Details & Links</label>

                      <div>
                        <label className="text-[10px] text-slate-500 dark:text-slate-400 block">Registered Rental Agreement Document URL</label>
                        <input
                          type="url"
                          placeholder="https://docs.society.app/agreements/rent_101.pdf"
                          value={rentalAgreementUrl}
                          onChange={(e) => setRentalAgreementUrl(e.target.value)}
                          className="w-full rounded-lg border border-slate-800 bg-slate-900 py-1.5 px-3 text-xs text-slate-200 focus:border-slate-700 focus:outline-none mt-0.5 font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-500 dark:text-slate-400 block">Police Verification Certificate URL</label>
                        <input
                          type="url"
                          placeholder="https://docs.society.app/police/verification_101.pdf"
                          value={policeVerificationUrl}
                          onChange={(e) => setPoliceVerificationUrl(e.target.value)}
                          className="w-full rounded-lg border border-slate-800 bg-slate-900 py-1.5 px-3 text-xs text-slate-200 focus:border-slate-700 focus:outline-none mt-0.5 font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-500 dark:text-slate-400 block">Society Tenant NOC Certificate URL</label>
                        <input
                          type="url"
                          placeholder="https://docs.society.app/noc/tenant_noc_101.pdf"
                          value={tenantNocUrl}
                          onChange={(e) => setTenantNocUrl(e.target.value)}
                          className="w-full rounded-lg border border-slate-800 bg-slate-900 py-1.5 px-3 text-xs text-slate-200 focus:border-slate-700 focus:outline-none mt-0.5 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              </form>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-800 bg-slate-950 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddFlatModalOpen(false)}
                className="rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-4 text-xs font-semibold text-slate-500 hover:bg-slate-900 transition-all shadow-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-flat-form"
                disabled={isSubmitting}
                className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-slate-100 py-2 px-6 text-xs font-semibold disabled:opacity-55 transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20"
              >
                {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : 'Create Flat Unit'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BulkUploadModal
        isOpen={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        title="Bulk Import Flats"
        entityName="flats"
        sampleHeaders={['Building Name', 'Wing Name', 'Floor Number', 'Flat Number', 'Flat Type', 'Carpet Area']}
        sampleData={[
          ['Tower A', 'Wing A1', 1, '101', '2BHK', 1200],
          ['Tower A', 'Wing A1', 1, '102', '3BHK', 1500],
        ]}
        keyMapping={{
          'Building Name': 'buildingName',
          'Wing Name': 'wingName',
          'Floor Number': 'floorNumber',
          'Flat Number': 'flatNumber',
          'Flat Type': 'flatType',
          'Carpet Area': 'carpetArea'
        }}
        onUpload={handleBulkUpload}
      />
    </main>
  );
}
