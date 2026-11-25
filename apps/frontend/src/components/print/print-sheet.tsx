'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { apiClient, currentSocietyId } from '@/lib/api/client';
import { Button } from '@/components/ui/button';

export interface Letterhead {
  name: string;
  address: string | null;
  registrationNumber: string | null;
  gstin: string | null;
  logoUrl: string | null;
}

let cached: { id: string; data: Letterhead } | null = null;

/** The society's name, address and registration for printed documents (loaded once per society). */
export function useLetterhead(): Letterhead | null {
  const [lh, setLh] = useState<Letterhead | null>(cached && cached.id === currentSocietyId() ? cached.data : null);
  useEffect(() => {
    const id = currentSocietyId();
    if (!id || (cached && cached.id === id)) return;
    apiClient
      .get(`/societies/${id}`)
      .then((res) => {
        const s = res.data?.data || {};
        cached = { id, data: { name: s.name || '', address: s.address || null, registrationNumber: s.registrationNumber || null, gstin: s.gstin || null, logoUrl: s.logoUrl || null } };
        setLh(cached.data);
      })
      .catch(() => setLh({ name: '', address: null, registrationNumber: null, gstin: null, logoUrl: null }));
  }, []);
  return lh;
}

export function LetterheadBlock({ lh }: { lh: Letterhead | null }) {
  if (!lh) return null;
  return (
    <div className="mb-6 flex items-center gap-4 border-b-2 border-slate-800 pb-3">
      {lh.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={lh.logoUrl} alt="" className="h-14 w-14 object-contain" />
      )}
      <div className="flex-1 text-center">
        <div className="text-xl font-bold uppercase tracking-wide">{lh.name}</div>
        {lh.registrationNumber && <div className="text-xs">Registration No. {lh.registrationNumber}</div>}
        {lh.address && <div className="text-xs">{lh.address}</div>}
        {lh.gstin && <div className="text-xs">GSTIN {lh.gstin}</div>}
      </div>
      {lh.logoUrl && <div className="h-14 w-14" />}
    </div>
  );
}

/**
 * A printable A4 document over the app: "Print / Save as PDF" prints only the sheet (the browser's print dialog saves
 * it as a PDF), always black on white whatever the screen theme.
 */
export function PrintSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const prev = document.title;
    document.title = title; // the default PDF file name
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.title = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [title, onClose]);

  const print = () => {
    document.body.classList.add('print-sheet-only');
    const done = () => {
      document.body.classList.remove('print-sheet-only');
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(done, 1000);
  };

  if (!mounted) return null;
  return createPortal(
    <div className="print-sheet-overlay fixed inset-0 z-[100] overflow-y-auto bg-slate-500/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
      <div className="print-sheet-toolbar sticky top-0 z-10 flex items-center justify-between gap-2 bg-slate-900 px-4 py-2 text-white">
        <span className="truncate text-sm">{title}</span>
        <span className="flex gap-2">
          <Button size="sm" onClick={print}>
            <Printer /> Print / Save as PDF
          </Button>
          <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </span>
      </div>
      <div className="print-sheet mx-auto my-6 w-full max-w-[210mm] bg-white p-[14mm] text-[13px] leading-relaxed text-slate-900 shadow-xl">{children}</div>
    </div>,
    document.body,
  );
}

/** Signature lines at the foot of a document. */
export function Signatures({ names }: { names: string[] }) {
  return (
    <div className="mt-14 grid gap-8" style={{ gridTemplateColumns: `repeat(${names.length}, minmax(0, 1fr))` }}>
      {names.map((n) => (
        <div key={n} className="whitespace-pre-line border-t border-slate-700 pt-1 text-center text-xs">
          {n}
        </div>
      ))}
    </div>
  );
}
