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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={config.onCancel} />
      
      {/* Modal Panel */}
      <div className="relative w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/90 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-600/20 border border-indigo-500/20">
              <Type className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">{config.title}</h3>
              {config.subtitle && <p className="text-[11px] text-slate-500">{config.subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={config.onCancel}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">{config.label}</label>
              <input
                type="text"
                autoFocus
                placeholder={config.placeholder}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none mt-1 font-semibold transition-all"
              />
            </div>
            
            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/60">
              <button
                type="button"
                onClick={config.onCancel}
                className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!value.trim()}
                className="px-4 py-2 text-sm font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 hover:shadow-md hover:shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Confirm
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
