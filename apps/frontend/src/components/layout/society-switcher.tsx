'use client';

import React, { useState } from 'react';
import { useAuth, Membership } from '../../app/providers/auth-context';
import { ChevronDown, Building, ShieldCheck, Check, Star, AlertCircle, Sparkles } from 'lucide-react';

export const SocietySwitcher: React.FC = () => {
  const { 
    memberships, 
    activeSociety, 
    defaultSocietyId, 
    switchSociety, 
    setDefaultSociety, 
    allSocietiesExpired 
  } = useAuth();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdatingDefault, setIsUpdatingDefault] = useState<string | null>(null);

  if (!memberships || memberships.length === 0) {
    return null;
  }

  // Handle single society case
  if (memberships.length === 1) {
    const single = memberships[0];
    return (
      <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 text-slate-700 dark:text-slate-300 shadow-xs">
        <Building className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
        <div className="text-left">
          <p className="text-xs font-bold truncate max-w-[150px] text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            {single.societyName}
            {single.isExpired && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60 font-semibold">
                Expired
              </span>
            )}
          </p>
          <p className="text-[10px] text-slate-500 capitalize">
            {single.role.replace('_', ' ')}
          </p>
        </div>
      </div>
    );
  }

  const handleSetDefault = async (e: React.MouseEvent, m: Membership) => {
    e.stopPropagation();
    if (m.isExpired) return;
    setIsUpdatingDefault(m.societyId);
    await setDefaultSociety(m.societyId);
    setIsUpdatingDefault(null);
  };

  const handleSelectSociety = (m: Membership) => {
    if (m.isExpired) {
      alert(`"${m.societyName}" subscription has expired. Operations are restricted until renewed.`);
      return;
    }
    switchSociety(m.societyId);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`society-switcher-btn flex items-center justify-between gap-3 px-3 py-1.5 rounded-xl border text-left transition-all focus:outline-none shadow-xs ${
          activeSociety?.isExpired
            ? 'border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 hover:bg-slate-50 dark:hover:bg-slate-900/80 text-slate-800 dark:text-slate-200'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <Building className={`h-4 w-4 shrink-0 ${activeSociety?.isExpired ? 'text-red-500 dark:text-red-400' : 'text-indigo-600 dark:text-indigo-400'}`} />
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-bold truncate max-w-[150px] text-slate-900 dark:text-slate-100">
                {activeSociety?.societyName || 'Select Society'}
              </p>
              {activeSociety?.societyId === defaultSocietyId && (
                <Star className="h-3 w-3 text-amber-500 fill-amber-500 dark:text-amber-400 dark:fill-amber-400 shrink-0" title="Default Society" />
              )}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">
              {activeSociety?.role.replace('_', ' ') || 'Member'}
            </p>
          </div>
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Options */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          
          <div className="society-switcher-dropdown absolute left-0 mt-2 w-80 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-100 dark:border-slate-800/60 mb-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Society Workspaces
              </span>
              <span className="text-[10px] text-slate-500">
                {memberships.length} available
              </span>
            </div>
            
            <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar">
              {memberships.map((m) => {
                const isActive = m.societyId === activeSociety?.societyId;
                const isDefault = m.societyId === defaultSocietyId;
                const isExpired = !!m.isExpired;

                return (
                  <div
                    key={m.societyId}
                    onClick={() => !isExpired && handleSelectSociety(m)}
                    className={`society-switcher-option p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                      isExpired
                        ? 'opacity-60 border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-950/10 cursor-not-allowed'
                        : isActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-500/50 text-indigo-900 dark:text-indigo-200 cursor-pointer shadow-xs'
                        : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-900 hover:border-slate-200 dark:hover:border-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-200 truncate">
                          {m.societyName}
                        </span>
                        {isDefault && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60 px-1.5 py-0.2 rounded-full font-bold">
                            <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400" /> Default
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 capitalize">
                        <span className="flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                          {m.role.replace('_', ' ')}
                        </span>
                        {isExpired && (
                          <span className="text-red-500 font-bold flex items-center gap-0.5">
                            <AlertCircle className="h-2.5 w-2.5" /> Expired
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Set as Default button */}
                      {!isDefault && !isExpired && (
                        <button
                          type="button"
                          onClick={(e) => handleSetDefault(e, m)}
                          disabled={isUpdatingDefault === m.societyId}
                          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
                          title="Set as your default society"
                        >
                          <Star className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {/* Active society indicator checkmark */}
                      {isActive && (
                        <div className="p-1 text-indigo-600 dark:text-indigo-400">
                          <Check className="h-4 w-4 stroke-[2.5]" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-2 border-t border-slate-100 dark:border-slate-800/60 mt-1.5 text-[10px] text-slate-500 text-center">
              💡 Click <Star className="h-3 w-3 text-amber-500 dark:text-amber-400 inline" /> to change your default login society.
            </div>
          </div>
        </>
      )}
    </div>
  );
};
