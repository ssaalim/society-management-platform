'use client';

import React, { useState } from 'react';
import { useAuth } from '../../app/providers/auth-context';
import { ChevronDown, Building, ShieldCheck, Check } from 'lucide-react';

export const SocietySwitcher: React.FC = () => {
  const { memberships, activeSociety, switchSociety } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (memberships.length <= 1) {
    return (
      <div className="flex items-center gap-3 px-3 py-2 text-slate-300">
        <Building className="h-5 w-5 text-indigo-400" />
        <div className="text-left">
          <p className="text-sm font-semibold truncate max-w-[150px] text-slate-100">
            {activeSociety?.societyName || 'Personal Workspace'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
            {activeSociety?.role || 'Guest'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="society-switcher-btn flex items-center justify-between w-full gap-3 px-3 py-2 text-slate-200 border border-slate-800 rounded-lg bg-slate-950/40 hover:bg-slate-900/60 transition-all focus:outline-none"
      >
        <div className="flex items-center gap-3 text-left">
          <Building className="h-5 w-5 text-indigo-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold truncate max-w-[140px] text-slate-100">
              {activeSociety?.societyName || 'Select Workspace'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
              {activeSociety?.role || 'Guest'}
            </p>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-slate-500 dark:text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Options */}
      {isOpen && (
        <>
          {/* Backdrop overlay to close */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          
          <div className="society-switcher-dropdown absolute left-0 mt-2 w-full min-w-[220px] rounded-lg border border-slate-800 bg-slate-950 p-1.5 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
            <p className="px-2.5 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-800/40 mb-1">
              Switch Society Scope
            </p>
            
            <div className="space-y-1">
              {memberships.map((m) => {
                const isActive = m.societyId === activeSociety?.societyId;
                return (
                  <button
                    key={m.societyId}
                    onClick={() => {
                      switchSociety(m.societyId);
                      setIsOpen(false);
                    }}
                    className={`society-switcher-option flex items-center justify-between w-full px-2.5 py-2 text-left rounded-md text-sm transition-all ${
                      isActive 
                        ? 'society-switcher-option-active bg-indigo-950/40 text-indigo-300 font-semibold' 
                        : 'text-slate-300 hover:bg-slate-900 hover:text-slate-100'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-200">{m.societyName}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 capitalize flex items-center gap-1 mt-0.5">
                        <ShieldCheck className="h-3 w-3 text-indigo-400" /> {m.role}
                      </span>
                    </div>
                    {isActive && <Check className="h-4 w-4 text-indigo-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
