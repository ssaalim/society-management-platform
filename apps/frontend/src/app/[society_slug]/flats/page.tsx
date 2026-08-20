'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/auth-context';
import { apiClient } from '../../../lib/api/client';
import { PromptModal, PromptModalConfig } from '../../../components/prompt-modal';
import { Building, Search, Filter, ShieldAlert, Plus, ArrowRight, Loader2, Settings2 , X, Upload, Layers } from 'lucide-react';
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
  
  // Flat Types Master Config State
  const [flatTypesList, setFlatTypesList] = useState<string[]>(['1BHK', '2BHK', '3BHK', '4BHK', 'Penthouse', 'Shop']);
  const [isManageTypesModalOpen, setIsManageTypesModalOpen] = useState<boolean>(false);
  const [newUnitTypeInput, setNewUnitTypeInput] = useState<string>('');
  const [isSavingTypes, setIsSavingTypes] = useState<boolean>(false);

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
  const [membersList, setMembersList] = useState<{ id: string; name: string; email?: string; mobile?: string; memberType?: string; committeeDesignation?: string | null }[]>([]);
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

        // Fetch society config to populate flat unit types
        try {
          const resConfig = await apiClient.get('/maintenance/config');
          if (resConfig.data?.success && resConfig.data.data?.flatTypes) {
            const types = resConfig.data.data.flatTypes;
            if (Array.isArray(types) && types.length > 0) {
              setFlatTypesList(types);
              setNewFlatType(types[0]);
            }
          }
        } catch (err) {
          console.warn('Could not fetch society unit types config:', err);
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

  const handleAddNewUnitType = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newUnitTypeInput.trim();
    if (!trimmed) return;
    if (flatTypesList.includes(trimmed)) {
      alert('Unit type already exists.');
      return;
    }
    const updated = [...flatTypesList, trimmed];
    setIsSavingTypes(true);
    try {
      await apiClient.post('/maintenance/config', { flatTypes: updated });
      setFlatTypesList(updated);
      setNewUnitTypeInput('');
    } catch (e) {
      alert('Failed to save unit type.');
    } finally {
      setIsSavingTypes(false);
    }
  };

  const handleDeleteUnitType = async (fType: string) => {
    if (flatTypesList.length <= 1) {
      alert('Society must have at least one unit type.');
      return;
    }
    if (!confirm(`Are you sure you want to remove unit type "${fType}"?`)) return;
    const updated = flatTypesList.filter(t => t !== fType);
    setIsSavingTypes(true);
    try {
      await apiClient.post('/maintenance/config', { flatTypes: updated });
      setFlatTypesList(updated);
      if (newFlatType === fType) {
        setNewFlatType(updated[0]);
      }
    } catch (e) {
      alert('Failed to delete unit type.');
    } finally {
      setIsSavingTypes(false);
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
    <main className="relative flex min-h-screen flex-col items-center justify-start overflow-x-hidden w-full py-4 sm:py-5 px-3 sm:px-5 lg:px-6">
      {/* Background Grids */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="w-full max-w-[1600px] mx-auto space-y-3.5 z-10">
        
        {/* Header */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Building className="h-6 w-6 text-indigo-500 dark:text-indigo-400" />
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {isOwner ? 'My Housing Unit' : 'Flats Roster & Master Config'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isOwner ? 'View your assigned flat unit properties, layout, and occupancy details' : 'Configure housing layout units, sizes, owners & occupancy status'}
              </p>
            </div>
          </div>
          {isManagementRole && (
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                >
                  Grid
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                >
                  List
                </button>
              </div>
              <button
                onClick={() => setIsManageTypesModalOpen(true)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-1.5 px-2.5 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs"
              >
                <Layers className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" /> Unit Types
              </button>
              <Link
                href={`/${society_slug}/flats/layout`}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-1.5 px-2.5 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs"
              >
                <Settings2 className="h-3.5 w-3.5" /> Layout Settings
              </Link>
              <button
                onClick={() => setShowBulkUpload(true)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-1.5 px-2.5 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs"
              >
                <Upload className="h-3.5 w-3.5" /> Import Bulk
              </button>
              <button
                onClick={() => setIsAddFlatModalOpen(true)}
                className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 px-3 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" /> Add Flat
              </button>
            </div>
          )}
        </div>

        {/* Filters Panel - Only for Management */}
        {!isOwner && (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-5 bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 p-3 rounded-xl shadow-xs">
            {/* Search by Number */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search Flat No..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 py-2 pl-9 pr-3 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:border-indigo-600 focus:outline-none"
              />
            </div>

            {/* Filter by Building */}
            <div className="relative">
              <select
                value={buildingFilter}
                onChange={(e) => setBuildingFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 py-2 px-3 text-xs text-slate-700 dark:text-slate-300 focus:border-indigo-600 focus:outline-none"
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
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 shadow-xs">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-3.5 py-2.5 font-semibold">Flat</th>
                  <th className="px-3.5 py-2.5 font-semibold">Building & Wing</th>
                  <th className="px-3.5 py-2.5 font-semibold">Details</th>
                  <th className="px-3.5 py-2.5 font-semibold">Occupancy</th>
                  <th className="px-3.5 py-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {flatsList.map((flat) => {
                  const statusColors = {
                    VACANT: 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400',
                    OWNER_OCCUPIED: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400',
                    TENANT_OCCUPIED: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-400',
                  };
                  const statusKey = (flat.occupancyStatus || 'VACANT') as keyof typeof statusColors;
                  const badgeStyle = statusColors[statusKey] || statusColors.VACANT;

                  return (
                    <tr key={flat.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                      <td className="px-3.5 py-2.5 font-bold text-slate-900 dark:text-slate-200 text-xs">
                        {flat.number}
                        <div className="text-[10px] font-normal text-slate-500">Floor {flat.floorNumber}</div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className="text-slate-800 dark:text-slate-300 font-medium text-xs">{flat.buildingName}</div>
                        <div className="text-[11px] text-slate-500">Wing {flat.wingName}</div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className="text-slate-800 dark:text-slate-300 text-xs">{flat.flatType}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{flat.sqftArea} SqFt</div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span className={`text-[10px] font-semibold border rounded-full px-2 py-0.5 uppercase tracking-wider ${badgeStyle}`}>
                          {(flat.occupancyStatus || 'VACANT').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        <Link
                          href={`/${society_slug}/flats/${flat.id}`}
                          className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800/60 px-2.5 py-1 rounded-lg text-xs transition-all"
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {flatsList.map((flat) => {
              const statusColors = {
                VACANT: 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400',
                OWNER_OCCUPIED: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400',
                TENANT_OCCUPIED: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-400',
              };

              return (
                <div 
                  key={flat.id} 
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/20 p-3.5 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-all flex flex-col justify-between space-y-2.5 shadow-xs"
                >
                  {(() => {
                    const statusKey = (flat.occupancyStatus || 'VACANT') as keyof typeof statusColors;
                    const badgeStyle = statusColors[statusKey] || statusColors.VACANT;
                    return (
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-base font-bold text-slate-900 dark:text-slate-200">Flat {flat.number}</h4>
                          <p className="text-xs text-slate-500">{flat.buildingName} • {flat.wingName} • Floor {flat.floorNumber}</p>
                        </div>
                        <span className={`text-[10px] font-semibold border rounded-full px-2 py-0.5 uppercase tracking-wider ${badgeStyle}`}>
                          {(flat.occupancyStatus || 'VACANT').replace('_', ' ')}
                        </span>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400 border-t border-b border-slate-100 dark:border-slate-800/40 py-2">
                    <div>
                      <span className="text-slate-500 text-[11px] block">Unit Type</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-300">{flat.flatType}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[11px] block">Super Area</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-300">{flat.sqftArea} SqFt</span>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Link
                      href={`/${society_slug}/flats/${flat.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-all"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setIsAddFlatModalOpen(false)} />
          
          {/* Modal Panel */}
          <div className="relative w-full max-w-lg max-h-[88dvh] sm:max-h-[90vh] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto z-10">

            {/* Pinned Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-100 dark:border-indigo-500/20">
                  <Building className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">Create Flat Master Entry</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Configure a new property unit for the society</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddFlatModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <form id="add-flat-form" onSubmit={handleAddFlatSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Flat Unit Number *</label>
                <input
                  type="text"
                  placeholder="e.g. A-101, B-402, Shop-03"
                  value={newFlatNumber}
                  onChange={(e) => setNewFlatNumber(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2.5 px-3.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none mt-1 font-semibold transition shadow-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Flat Unit Type *</label>
                  <select
                    value={newFlatType}
                    onChange={(e) => {
                      if (e.target.value === '__ADD_NEW__') {
                        const custom = window.prompt('Enter new flat unit type (e.g. Studio, 1.5BHK, Duplex, Villa, Office):');
                        if (custom && custom.trim()) {
                          const trimmed = custom.trim();
                          if (!flatTypesList.includes(trimmed)) {
                            const updated = [...flatTypesList, trimmed];
                            setFlatTypesList(updated);
                            apiClient.post('/maintenance/config', { flatTypes: updated }).catch(console.error);
                          }
                          setNewFlatType(trimmed);
                        }
                      } else {
                        setNewFlatType(e.target.value);
                      }
                    }}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2.5 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none mt-1 transition shadow-xs"
                  >
                    {flatTypesList.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                    <option value="__ADD_NEW__">+ Add New Unit Type...</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Super Builtup Area (SqFt) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="1200"
                    value={newSqftArea}
                    onChange={(e) => setNewSqftArea(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2.5 px-3.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none mt-1 font-semibold transition shadow-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Carpet Area (SqFt - Optional)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="950"
                  value={newCarpetArea}
                  onChange={(e) => setNewCarpetArea(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2.5 px-3.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none mt-1 transition shadow-xs"
                />
              </div>

              {/* Layout Configuration: Building -> Wing -> Floor */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-3.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Location Configuration</h4>
                
                {/* Building Selection */}
                <div className="flex items-end gap-2">
                  <div className="flex-1 min-w-0">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block truncate">Building / Tower <span className="text-rose-500">*</span></label>
                    <select
                      value={selectedLayoutBuildingId}
                      onChange={(e) => {
                        setSelectedLayoutBuildingId(e.target.value);
                        setSelectedLayoutWingId('');
                        setSelectedFloorId('');
                      }}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none mt-1 transition shadow-xs"
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
                    className="shrink-0 mb-[1px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-3 text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-95"
                  >
                    + Add
                  </button>
                </div>

                {/* Wing Selection */}
                <div className="flex items-end gap-2">
                  <div className="flex-1 min-w-0">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block truncate">Wing <span className="text-rose-500">*</span></label>
                    <select
                      value={selectedLayoutWingId}
                      onChange={(e) => {
                        setSelectedLayoutWingId(e.target.value);
                        setSelectedFloorId('');
                      }}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none mt-1 disabled:opacity-50 transition shadow-xs"
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
                    className="shrink-0 mb-[1px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-3 text-xs font-semibold transition-all shadow-xs disabled:opacity-50 cursor-pointer active:scale-95"
                  >
                    + Add
                  </button>
                </div>

                {/* Floor Selection */}
                <div className="flex items-end gap-2">
                  <div className="flex-1 min-w-0">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block truncate">Floor <span className="text-rose-500">*</span></label>
                    <select
                      value={selectedFloorId}
                      onChange={(e) => setSelectedFloorId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none mt-1 disabled:opacity-50 transition shadow-xs"
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
                    className="shrink-0 mb-[1px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-3 text-xs font-semibold transition-all shadow-xs disabled:opacity-50 cursor-pointer active:scale-95"
                  >
                    + Add
                  </button>
                </div>
              </div>

              {/* Assign Primary Owner from Existing Members */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Assign Primary Owner (From Existing Members)</span>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">Existing Roster</span>
                </label>
                <select
                  value={selectedOwnerId}
                  onChange={(e) => setSelectedOwnerId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2.5 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none mt-1 transition shadow-xs"
                >
                  <option value="">-- Select Member as Owner (or Leave Vacant) --</option>
                  {membersList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.email || m.mobile || 'Member'}) [{m.memberType || 'OWNER'}{m.committeeDesignation && m.committeeDesignation !== 'NONE' ? ` • ${m.committeeDesignation}` : ''}]
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Owner will be linked from existing registered society members.
                </p>
              </div>

              {/* Assign Tenant & Tenancy Documents Option */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="assignTenantToggle"
                    checked={assignTenantToggle}
                    onChange={(e) => setAssignTenantToggle(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-indigo-600 focus:ring-0"
                  />
                  <label htmlFor="assignTenantToggle" className="text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                    Flat is rented — Assign Active Tenant & Tenancy Documents
                  </label>
                </div>

                {assignTenantToggle && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in duration-150">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Select Tenant (Existing Member)</label>
                      <select
                        value={selectedTenantId}
                        onChange={(e) => setSelectedTenantId(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2 px-3 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none mt-1 shadow-xs"
                        required={assignTenantToggle}
                      >
                        <option value="">-- Select Member as Tenant --</option>
                        {membersList.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.email || m.mobile || 'Tenant Profile'}) [{m.memberType || 'TENANT'}{m.committeeDesignation && m.committeeDesignation !== 'NONE' ? ` • ${m.committeeDesignation}` : ''}]
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold">Lease Start Date</label>
                        <input
                          type="date"
                          value={leaseStart}
                          onChange={(e) => setLeaseStart(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2 px-3 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none mt-1 shadow-xs"
                          required={assignTenantToggle}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold">Lease End Date</label>
                        <input
                          type="date"
                          value={leaseEnd}
                          onChange={(e) => setLeaseEnd(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2 px-3 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none mt-1 shadow-xs"
                          required={assignTenantToggle}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold">Emergency Contact Person</label>
                        <input
                          type="text"
                          placeholder="Contact Name"
                          value={emergencyContactName}
                          onChange={(e) => setEmergencyContactName(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2 px-3 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none mt-1 shadow-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold">Emergency Phone</label>
                        <input
                          type="text"
                          placeholder="+91 Mobile No."
                          value={emergencyContactPhone}
                          onChange={(e) => setEmergencyContactPhone(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2 px-3 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none mt-1 shadow-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">Tenancy Document Details & Links</label>

                      <div>
                        <label className="text-[10px] text-slate-500 dark:text-slate-400 block">Registered Rental Agreement Document URL</label>
                        <input
                          type="url"
                          placeholder="https://docs.society.app/agreements/rent_101.pdf"
                          value={rentalAgreementUrl}
                          onChange={(e) => setRentalAgreementUrl(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2 px-3 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none mt-0.5 font-mono shadow-xs"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-500 dark:text-slate-400 block">Police Verification Certificate URL</label>
                        <input
                          type="url"
                          placeholder="https://docs.society.app/police/verification_101.pdf"
                          value={policeVerificationUrl}
                          onChange={(e) => setPoliceVerificationUrl(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2 px-3 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none mt-0.5 font-mono shadow-xs"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-500 dark:text-slate-400 block">Society Tenant NOC Certificate URL</label>
                        <input
                          type="url"
                          placeholder="https://docs.society.app/noc/tenant_noc_101.pdf"
                          value={tenantNocUrl}
                          onChange={(e) => setTenantNocUrl(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2 px-3 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none mt-0.5 font-mono shadow-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              </form>
            </div>

            {/* Pinned Footer */}
            <div className="flex-shrink-0 flex items-center justify-end gap-2.5 px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setIsAddFlatModalOpen(false)}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2 px-4 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-flat-form"
                disabled={isSubmitting}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-5 text-xs font-bold disabled:opacity-55 transition-all flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
              >
                {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : 'Create Flat Unit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Unit Types Master Modal */}
      {isManageTypesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setIsManageTypesModalOpen(false)} />
          <div className="relative w-full max-w-md max-h-[88dvh] sm:max-h-[90vh] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto z-10">
            {/* Pinned Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-100 dark:border-indigo-500/20">
                  <Layers className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">Society Unit Types Master</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Configure allowed unit categories across the society</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsManageTypesModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Active Unit Types ({flatTypesList.length})</label>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {flatTypesList.map((fType) => (
                    <div key={fType} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-200">{fType}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteUnitType(fType)}
                        disabled={isSavingTypes}
                        className="text-slate-400 hover:text-rose-500 p-1 rounded-lg transition-colors cursor-pointer"
                        title="Remove unit type"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <form onSubmit={handleAddNewUnitType} className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Add New Unit Type</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Studio, Duplex, Villa, 1.5BHK"
                    value={newUnitTypeInput}
                    onChange={(e) => setNewUnitTypeInput(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-950 focus:outline-none font-semibold transition shadow-xs"
                  />
                  <button
                    type="submit"
                    disabled={!newUnitTypeInput.trim() || isSavingTypes}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold disabled:opacity-40 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                  >
                    {isSavingTypes ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Add
                  </button>
                </div>
              </form>
            </div>

            {/* Pinned Footer */}
            <div className="flex-shrink-0 flex items-center justify-end px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setIsManageTypesModalOpen(false)}
                className="rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 py-2 px-4 text-xs font-semibold transition-all shadow-xs cursor-pointer"
              >
                Close
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
