'use client';

import React, { useState } from 'react';
import { useAuth } from '../../app/providers/auth-context';
import { Building, ShieldCheck, Star, AlertCircle, Check, ArrowRight, X } from 'lucide-react';

export const DefaultSocietyModal: React.FC = () => {
  const { 
    memberships, 
    defaultSocietyId, 
    requiresDefaultSelection, 
    setDefaultSociety, 
    dismissDefaultSelection 
  } = useAuth();

  const [selectedId, setSelectedId] = useState<string>(
    defaultSocietyId || (memberships.find(m => !m.isExpired)?.societyId || '')
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!requiresDefaultSelection || memberships.length <= 1) {
    return null;
  }

  const activeSocieties = memberships.filter(m => !m.isExpired);
  const expiredSocieties = memberships.filter(m => m.isExpired);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setIsSubmitting(true);
    await setDefaultSociety(selectedId);
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200" 
        onClick={dismissDefaultSelection} 
      />

      {/* Dialog Box */}
      <div className="relative w-full max-w-lg bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-900/40 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <Star className="h-6 w-6 fill-indigo-400/20" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">Select Your Default Society</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Choose which society dashboard opens automatically upon login.
              </p>
            </div>
          </div>
          <button 
            onClick={dismissDefaultSelection}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800"
            title="Skip for now"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body Form */}
        <form id="default-society-form" onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <p className="text-xs text-slate-400">
            You are associated with multiple housing societies. You can switch between them or change your default society anytime from the top navigation bar.
          </p>

          <div className="space-y-2">
            {/* Active Societies */}
            {activeSocieties.map((m) => {
              const isSelected = m.societyId === selectedId;
              return (
                <div
                  key={m.societyId}
                  onClick={() => setSelectedId(m.societyId)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500/60 shadow-md shadow-indigo-950/30'
                      : 'bg-slate-900/30 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                      <Building className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-200 flex items-center gap-2">
                        {m.societyName}
                        {m.isDefault && (
                          <span className="text-[10px] bg-amber-950/60 text-amber-400 border border-amber-800/60 px-2 py-0.5 rounded-full font-bold">
                            Current Default
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 capitalize flex items-center gap-1.5 mt-0.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Role: <strong className="text-slate-400">{m.role.replace('_', ' ')}</strong></span>
                        {m.planName && <span>• {m.planName}</span>}
                      </div>
                    </div>
                  </div>

                  <div className={`h-5 w-5 rounded-full border flex items-center justify-center transition-all ${
                    isSelected ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-700 bg-slate-950'
                  }`}>
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                </div>
              );
            })}

            {/* Expired Societies (Disabled) */}
            {expiredSocieties.map((m) => (
              <div
                key={m.societyId}
                className="p-4 rounded-xl border border-red-900/30 bg-red-950/10 opacity-60 cursor-not-allowed flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-950/60 text-red-400">
                    <Building className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-300 flex items-center gap-2">
                      {m.societyName}
                      <span className="text-[10px] bg-red-950/80 text-red-400 border border-red-900/60 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <AlertCircle className="h-2.5 w-2.5" /> Subscription Expired
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 capitalize flex items-center gap-1.5 mt-0.5">
                      <span>Role: {m.role.replace('_', ' ')}</span>
                      <span>• Access restricted</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </form>

        {/* Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={dismissDefaultSelection}
            className="text-xs font-semibold text-slate-400 hover:text-slate-200 py-2 px-3 rounded-lg hover:bg-slate-900"
          >
            Remind Me Later
          </button>

          <button
            type="submit"
            form="default-society-form"
            disabled={isSubmitting || !selectedId}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-5 text-xs font-semibold disabled:opacity-55 flex items-center gap-1.5 transition-all shadow-md shadow-indigo-950/40"
          >
            <span>Set as Default & Continue</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
};
