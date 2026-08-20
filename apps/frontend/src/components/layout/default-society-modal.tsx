'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth, Membership } from '../../app/providers/auth-context';
import { Building, ShieldCheck, Star, AlertCircle, Check, ArrowRight, X, Sparkles } from 'lucide-react';

export const DefaultSocietyModal: React.FC = () => {
  const { 
    memberships, 
    defaultSocietyId, 
    requiresDefaultSelection, 
    setDefaultSociety, 
    dismissDefaultSelection 
  } = useAuth();

  const [mounted, setMounted] = useState<boolean>(false);
  const [selectedId, setSelectedId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (defaultSocietyId) {
      setSelectedId(defaultSocietyId);
    } else if (memberships && memberships.length > 0) {
      const firstActive = memberships.find((m) => !m.isExpired);
      if (firstActive) {
        setSelectedId(firstActive.societyId);
      }
    }
  }, [defaultSocietyId, memberships]);

  if (!mounted || !requiresDefaultSelection || !memberships || memberships.length <= 1) {
    return null;
  }

  const activeSocieties = memberships.filter((m) => !m.isExpired);
  const expiredSocieties = memberships.filter((m) => m.isExpired);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setIsSubmitting(true);
    try {
      await setDefaultSociety(selectedId);
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200" 
        onClick={dismissDefaultSelection} 
      />

      {/* Dialog Box */}
      <div 
        className="relative w-full max-w-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto animate-in fade-in zoom-in-95 duration-200 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/40 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 shrink-0 shadow-xs">
              <Star className="h-6 w-6 fill-indigo-600/20 dark:fill-indigo-400/20" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                Select Your Default Society
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Choose which society workspace opens automatically upon login.
              </p>
            </div>
          </div>
          <button 
            onClick={dismissDefaultSelection}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Skip for now"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body Form */}
        <form id="default-society-form" onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            You belong to multiple housing societies. You can switch between them anytime from the top bar.
          </p>

          <div className="space-y-2">
            {/* Active Societies */}
            {activeSocieties.map((m) => {
              const isSelected = m.societyId === selectedId;
              return (
                <div
                  key={m.societyId}
                  onClick={() => setSelectedId(m.societyId)}
                  className={`p-3.5 sm:p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-slate-700 hover:bg-slate-100/80 dark:hover:bg-slate-900/60 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`p-2 rounded-xl border shrink-0 transition ${
                      isSelected 
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}>
                      <Building className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span className="truncate">{m.societyName}</span>
                        {m.isDefault && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 px-1.5 py-0.5 rounded-full font-bold shrink-0">
                            <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400" /> Default
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 capitalize flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1 font-medium">
                          <ShieldCheck className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                          {m.role.replace('_', ' ')}
                        </span>
                        {m.planName && <span>• {m.planName}</span>}
                      </div>
                    </div>
                  </div>

                  <div className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                    isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950'
                  }`}>
                    {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                  </div>
                </div>
              );
            })}

            {/* Expired Societies (Disabled) */}
            {expiredSocieties.map((m) => (
              <div
                key={m.societyId}
                className="p-3.5 sm:p-4 rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/10 opacity-70 cursor-not-allowed flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="p-2 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 shrink-0">
                    <Building className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-300 flex items-center gap-2">
                      <span className="truncate">{m.societyName}</span>
                      <span className="text-[9px] bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/60 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0">
                        <AlertCircle className="h-2.5 w-2.5" /> Expired
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 capitalize flex items-center gap-1.5 mt-0.5">
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
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={dismissDefaultSelection}
            className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 py-2 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition"
          >
            Remind Me Later
          </button>

          <button
            type="submit"
            form="default-society-form"
            disabled={isSubmitting || !selectedId}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 sm:px-5 text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20 active:scale-95"
          >
            <span>Set as Default & Continue</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
