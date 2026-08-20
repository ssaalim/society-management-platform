import React, { useState, useEffect } from 'react';
import { X, Type } from 'lucide-react';

export interface PromptModalConfig {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  label: string;
  placeholder: string;
  initialValue?: string;
  onSubmit: (val: string) => void;
  onCancel: () => void;
}

export function PromptModal({ config }: { config: PromptModalConfig }) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (config.isOpen) {
      setValue(config.initialValue || '');
    }
  }, [config.isOpen, config.initialValue]);

  if (!config.isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    config.onSubmit(value);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={config.onCancel} />
      
      {/* Modal Panel */}
      <div className="relative w-full max-w-md max-h-[88dvh] sm:max-h-[90vh] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto z-10 animate-in zoom-in-95 duration-150">
        {/* Pinned Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-100 dark:border-indigo-500/20">
              <Type className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">{config.title}</h3>
              {config.subtitle && <p className="text-[11px] text-slate-500 dark:text-slate-400">{config.subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={config.onCancel}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <form id="prompt-modal-form" onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{config.label}</label>
              <input
                type="text"
                autoFocus
                placeholder={config.placeholder}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2.5 px-3.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-950 focus:outline-none mt-1 font-semibold transition-all shadow-xs"
              />
            </div>
          </form>
        </div>

        {/* Pinned Footer */}
        <div className="flex-shrink-0 flex items-center justify-end gap-2.5 px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <button
            type="button"
            onClick={config.onCancel}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="prompt-modal-form"
            disabled={!value.trim()}
            className="px-5 py-2 text-xs font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition-all cursor-pointer active:scale-95"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
