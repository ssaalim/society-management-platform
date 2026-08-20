'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Building2, Pencil, ArrowLeft, Plus , X } from 'lucide-react';
import { useAuth } from '../../../providers/auth-context';
import { apiClient } from '../../../../lib/api/client';
import { PromptModal, PromptModalConfig } from '../../../../components/prompt-modal';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

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

export default function LayoutSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const { activeSociety } = useAuth();
  
  const society_slug = (params?.society_slug as string) || '';
  
  const [layoutHierarchy, setLayoutHierarchy] = useState<LayoutHierarchy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [promptConfig, setPromptConfig] = useState<PromptModalConfig>({ isOpen: false, title: '', label: '', placeholder: '', onSubmit: () => {}, onCancel: () => setPromptConfig(prev => ({ ...prev, isOpen: false })) });

  // Check roles (only management allowed to view/edit this)
  const isManagementRole = ['SUPER_ADMIN', 'PRESIDENT', 'SECRETARY', 'COMMITTEE_MEMBER'].includes(activeSociety?.role || '');

  const fetchLayout = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get('/flats/layout');
      if (res.data?.success) {
        setLayoutHierarchy(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load layout hierarchy:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSociety) {
      if (!isManagementRole) {
        router.push(`/${society_slug}/flats`);
        return;
      }
      fetchLayout();
    }
  }, [activeSociety, isManagementRole, router, society_slug, fetchLayout]);

  // Edits
  const handleEditBuilding = (id: string, currentName: string) => {
    setPromptConfig({
      isOpen: true,
      title: 'Edit Building',
      label: 'Building Name',
      placeholder: 'e.g. Tower A',
      initialValue: currentName,
      onCancel: () => setPromptConfig(prev => ({ ...prev, isOpen: false })),
      onSubmit: async (newName) => {
        setPromptConfig(prev => ({ ...prev, isOpen: false }));
        if (newName === currentName) return;
        try {
          await apiClient.patch(`/flats/layout/building/${id}`, { name: newName });
          fetchLayout();
        } catch (err) {
          alert('Failed to update building');
        }
      }
    });
  };

  const handleEditWing = (id: string, currentName: string) => {
    setPromptConfig({
      isOpen: true,
      title: 'Edit Wing',
      label: 'Wing Name',
      placeholder: 'e.g. Wing A1',
      initialValue: currentName,
      onCancel: () => setPromptConfig(prev => ({ ...prev, isOpen: false })),
      onSubmit: async (newName) => {
        setPromptConfig(prev => ({ ...prev, isOpen: false }));
        if (newName === currentName) return;
        try {
          await apiClient.patch(`/flats/layout/wing/${id}`, { name: newName });
          fetchLayout();
        } catch (err) {
          alert('Failed to update wing');
        }
      }
    });
  };

  const handleEditFloor = (id: string, currentNum: number) => {
    setPromptConfig({
      isOpen: true,
      title: 'Edit Floor',
      label: 'Floor Number',
      placeholder: 'e.g. 1',
      initialValue: String(currentNum),
      onCancel: () => setPromptConfig(prev => ({ ...prev, isOpen: false })),
      onSubmit: async (newNumStr) => {
        setPromptConfig(prev => ({ ...prev, isOpen: false }));
        const newNum = parseInt(newNumStr, 10);
        if (isNaN(newNum) || newNum === currentNum) return;
        try {
          await apiClient.patch(`/flats/layout/floor/${id}`, { number: newNum });
          fetchLayout();
        } catch (err) {
          alert('Failed to update floor');
        }
      }
    });
  };

  // Add
  const handleAddBuilding = () => {
    setPromptConfig({
      isOpen: true,
      title: 'Add Building / Tower',
      label: 'Building Name',
      placeholder: 'e.g. Tower A',
      onCancel: () => setPromptConfig(prev => ({ ...prev, isOpen: false })),
      onSubmit: async (name) => {
        setPromptConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await apiClient.post('/flats/layout/building', { name });
          fetchLayout();
        } catch (err) {
          alert('Failed to create building');
        }
      }
    });
  };

  const handleAddWing = (buildingId: string) => {
    setPromptConfig({
      isOpen: true,
      title: 'Add Wing',
      label: 'Wing Name',
      placeholder: 'e.g. Wing A1',
      onCancel: () => setPromptConfig(prev => ({ ...prev, isOpen: false })),
      onSubmit: async (name) => {
        setPromptConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await apiClient.post('/flats/layout/wing', { buildingId, name });
          fetchLayout();
        } catch (err) {
          alert('Failed to create wing');
        }
      }
    });
  };

  const handleAddFloor = (wingId: string) => {
    setPromptConfig({
      isOpen: true,
      title: 'Add Floor',
      label: 'Floor Number',
      placeholder: 'e.g. 1',
      onCancel: () => setPromptConfig(prev => ({ ...prev, isOpen: false })),
      onSubmit: async (numberStr) => {
        setPromptConfig(prev => ({ ...prev, isOpen: false }));
        const number = parseInt(numberStr, 10);
        if (isNaN(number)) return alert('Invalid floor number');
        try {
          await apiClient.post('/flats/layout/floor', { wingId, number });
          fetchLayout();
        } catch (err) {
          alert('Failed to create floor');
        }
      }
    });
  };

  if (!isManagementRole) return null;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-start overflow-x-hidden w-full py-4 sm:py-5 px-3 sm:px-5 lg:px-6">
      {/* Background Grids */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="w-full max-w-[1600px] mx-auto space-y-3.5 z-10">
        {/* Header */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Link href={`/${society_slug}/flats`} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <ArrowLeft className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
                Layout Configuration
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Manage society buildings, wings, and floors.</p>
            </div>
          </div>
          <button
            onClick={handleAddBuilding}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 transition-all"
          >
            <Plus className="h-3.5 w-3.5" /> Add Building
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
          </div>
        ) : layoutHierarchy.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl">
            <Building2 className="h-10 w-10 text-slate-500 mx-auto mb-3" />
            <h3 className="text-md font-semibold text-slate-300">No Layout Defined</h3>
            <p className="text-xs text-slate-500 mt-1">Start by adding a new Building or Tower.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {layoutHierarchy.map((building) => (
              <div key={building.id} className="bg-slate-950/40 border border-slate-800 rounded-xl p-5 space-y-4">
                
                {/* Building Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
                  <h2 className="text-lg font-bold text-slate-200">{building.name}</h2>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleEditBuilding(building.id, building.name)} className="p-1.5 rounded hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleAddWing(building.id)} className="text-xs px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold transition-colors shadow-sm">
                      + Add Wing
                    </button>
                  </div>
                </div>

                {/* Wings */}
                {building.wings.length === 0 ? (
                  <p className="text-xs text-slate-500 italic px-2">No wings configured.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {building.wings.map((wing) => (
                      <div key={wing.id} className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
                        
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-slate-300 text-sm">Wing {wing.name}</h3>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleEditWing(wing.id, wing.name)} className="p-1 rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button onClick={() => handleAddFloor(wing.id)} className="text-[10px] px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold transition-colors shadow-sm">
                              + Floor
                            </button>
                          </div>
                        </div>

                        {/* Floors */}
                        <div className="flex flex-wrap gap-2">
                          {wing.floors.length === 0 ? (
                            <span className="text-[10px] text-slate-500">No floors</span>
                          ) : (
                            wing.floors.sort((a, b) => a.number - b.number).map((floor) => (
                              <button
                                key={floor.id}
                                onClick={() => handleEditFloor(floor.id, floor.number)}
                                className="group relative flex items-center justify-center w-8 h-8 rounded bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:border-indigo-500/50 hover:text-indigo-300 transition-colors"
                                title="Click to edit floor number"
                              >
                                {floor.number}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <PromptModal config={promptConfig} />
    </main>
  );
}
