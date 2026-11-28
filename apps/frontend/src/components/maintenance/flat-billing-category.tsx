'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Receipt } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { NativeSelect } from '@/components/ui/native-select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Category {
  id: string;
  name: string;
  usage: 'RESIDENTIAL' | 'COMMERCIAL';
  calculationType: 'SOCIETY_FORMULA' | 'PER_SQ_FT' | 'FIXED';
  areaType: 'SUPER_BUILTUP' | 'CARPET_AREA';
  rate: string;
  floorRates: { fromFloor: number; toFloor: number | null; rate: number }[];
  flatTypes: string[];
  isDefault: boolean;
  gstEnabled: boolean;
  gstRate: string;
}

interface Props {
  flatId: string;
  flatType: string;
  floorNumber: number;
  billingCategoryId: string | null;
  societySlug: string;
  canEdit: boolean;
  onSaved: (billingCategoryId: string | null) => void;
}

const AUTO = '__auto__';

/** Same rule as the server: flat type match, else the default category. */
function autoCategory(categories: Category[], flatType: string): Category | undefined {
  const t = (flatType || '').toLowerCase();
  return categories.find((c) => c.flatTypes.some((x) => x.toLowerCase() === t)) || categories.find((c) => c.isDefault) || categories[0];
}

function describeRate(c: Category, floor: number): string {
  if (c.calculationType === 'SOCIETY_FORMULA') return "Society's maintenance formula";
  const band = c.floorRates.find((r) => floor >= r.fromFloor && (r.toFloor === null || floor <= r.toFloor));
  const rate = Number(band ? band.rate : c.rate).toLocaleString('en-IN');
  const where = band ? ` (floor ${floor} rate)` : '';
  if (c.calculationType === 'PER_SQ_FT') {
    return `₹${rate} per sq ft of ${c.areaType === 'CARPET_AREA' ? 'carpet' : 'super built-up'} area${where}`;
  }
  return `₹${rate} fixed per month${where}`;
}

/** Shows which billing category a unit is charged under and lets the office override it for this unit only. */
export function FlatBillingCategory({ flatId, flatType, floorNumber, billingCategoryId, societySlug, canEdit, onSaved }: Props) {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [choice, setChoice] = useState<string>(billingCategoryId || AUTO);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    apiClient
      .get('/maintenance/categories')
      .then((res) => setCategories(res.data?.data || []))
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => setChoice(billingCategoryId || AUTO), [billingCategoryId]);

  const auto = useMemo(() => (categories ? autoCategory(categories, flatType) : undefined), [categories, flatType]);
  // A manual assignment to a category that no longer exists falls back to automatic, as on the server.
  const manual = categories?.find((c) => c.id === billingCategoryId);
  const effective = manual || auto;
  const selected = choice === AUTO ? auto : categories?.find((c) => c.id === choice);
  const dirty = choice !== (manual ? manual.id : AUTO);

  if (loadError) return null; // no billing access for this role

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const next = choice === AUTO ? null : choice;
      await apiClient.post('/maintenance/categories/assign', { flatIds: [flatId], billingCategoryId: next });
      onSaved(next);
      setMessage({ type: 'success', text: 'Saved. Bills generated from now on use this category.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Could not change the billing category.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800/40">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2">
          <Receipt className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Maintenance Billing Category
        </h3>
        <Link href={`/${societySlug}/maintenance?view=categories`} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
          Manage categories
        </Link>
      </div>

      {!categories ? (
        <p className="text-xs text-slate-500 flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading categories…
        </p>
      ) : (
        <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 space-y-3">
          {effective && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-500 dark:text-slate-400">Billed under</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{effective.name}</span>
              <Badge variant={effective.usage === 'COMMERCIAL' ? 'default' : 'secondary'}>
                {effective.usage === 'COMMERCIAL' ? 'Commercial' : 'Residential'}
              </Badge>
              <Badge variant="outline">{manual ? 'Set for this unit' : `Automatic (${flatType})`}</Badge>
              {effective.gstEnabled && <Badge variant="outline">GST {Number(effective.gstRate)}%</Badge>}
            </div>
          )}

          {canEdit && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <NativeSelect
                aria-label="Billing category for this unit"
                value={choice}
                onChange={(e) => {
                  setChoice(e.target.value);
                  setMessage(null);
                }}
                className="sm:max-w-md"
                disabled={saving}
              >
                <option value={AUTO}>Automatic, by flat type{auto ? ` (${auto.name})` : ''}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.usage === 'COMMERCIAL' ? 'commercial' : 'residential'})
                  </option>
                ))}
              </NativeSelect>
              <Button type="button" size="sm" onClick={save} disabled={!dirty || saving}>
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save category
              </Button>
            </div>
          )}

          {selected && <p className="text-xs text-slate-500 dark:text-slate-400">Charge: {describeRate(selected, floorNumber)}.</p>}
          {canEdit && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Choose a category to bill this unit differently from other {flatType} units. Bills already generated are not changed.
            </p>
          )}

          {message && (
            <p className={`text-xs font-medium ${message.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {message.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
