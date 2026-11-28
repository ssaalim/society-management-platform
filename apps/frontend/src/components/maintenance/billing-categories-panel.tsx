'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';

interface FloorRate {
  fromFloor: number;
  toFloor: number | null;
  rate: number;
}

interface Category {
  id: string;
  name: string;
  usage: 'RESIDENTIAL' | 'COMMERCIAL';
  calculationType: 'SOCIETY_FORMULA' | 'PER_SQ_FT' | 'FIXED';
  areaType: 'SUPER_BUILTUP' | 'CARPET_AREA';
  rate: string;
  floorRates: FloorRate[];
  extraCharges: Record<string, number>;
  includeParking: boolean;
  flatTypes: string[];
  invoicePrefix: string;
  gstEnabled: boolean;
  gstRate: string;
  gstThresholdMonthly: string;
  penaltyType: string | null;
  penaltyInterestRate: string | null;
  penaltyFlatAmount: string | null;
  penaltyGracePeriodDays: number | null;
  isDefault: boolean;
  sortOrder: number;
}

interface Draft {
  name: string;
  usage: 'RESIDENTIAL' | 'COMMERCIAL';
  calculationType: 'SOCIETY_FORMULA' | 'PER_SQ_FT' | 'FIXED';
  areaType: 'SUPER_BUILTUP' | 'CARPET_AREA';
  rate: string;
  floorRates: { fromFloor: string; toFloor: string; rate: string }[];
  extras: { name: string; amount: string }[];
  includeParking: boolean;
  flatTypes: string[];
  invoicePrefix: string;
  gstEnabled: boolean;
  gstRate: string;
  gstThresholdMonthly: string;
  ownLateFee: boolean;
  penaltyType: string;
  penaltyInterestRate: string;
  penaltyFlatAmount: string;
  penaltyGracePeriodDays: string;
  sortOrder: number;
}

const emptyDraft = (): Draft => ({
  name: '',
  usage: 'COMMERCIAL',
  calculationType: 'PER_SQ_FT',
  areaType: 'CARPET_AREA',
  rate: '',
  floorRates: [],
  extras: [],
  includeParking: true,
  flatTypes: [],
  invoicePrefix: 'COM',
  gstEnabled: true,
  gstRate: '18',
  gstThresholdMonthly: '7500',
  ownLateFee: false,
  penaltyType: 'PERCENTAGE',
  penaltyInterestRate: '21',
  penaltyFlatAmount: '500',
  penaltyGracePeriodDays: '0',
  sortOrder: 10,
});

const toDraft = (c: Category): Draft => ({
  name: c.name,
  usage: c.usage,
  calculationType: c.calculationType,
  areaType: c.areaType,
  rate: String(Number(c.rate)),
  floorRates: c.floorRates.map((r) => ({ fromFloor: String(r.fromFloor), toFloor: r.toFloor === null ? '' : String(r.toFloor), rate: String(r.rate) })),
  extras: Object.entries(c.extraCharges || {}).map(([name, amount]) => ({ name, amount: String(amount) })),
  includeParking: c.includeParking,
  flatTypes: c.flatTypes,
  invoicePrefix: c.invoicePrefix,
  gstEnabled: c.gstEnabled,
  gstRate: String(Number(c.gstRate)),
  gstThresholdMonthly: String(Number(c.gstThresholdMonthly)),
  ownLateFee: !!c.penaltyType,
  penaltyType: c.penaltyType || 'PERCENTAGE',
  penaltyInterestRate: c.penaltyInterestRate === null ? '21' : String(Number(c.penaltyInterestRate)),
  penaltyFlatAmount: c.penaltyFlatAmount === null ? '500' : String(Number(c.penaltyFlatAmount)),
  penaltyGracePeriodDays: c.penaltyGracePeriodDays === null ? '0' : String(c.penaltyGracePeriodDays),
  sortOrder: c.sortOrder,
});

const floorName = (n: number) => (n === 0 ? 'Ground' : `${n}${['th', 'st', 'nd', 'rd'][n % 10 > 3 || [11, 12, 13].includes(n % 100) ? 0 : n % 10]}`);
const rupees = (n: number | string) => `₹${Number(n).toLocaleString('en-IN')}`;

function describeRate(c: Category) {
  if (c.calculationType === 'SOCIETY_FORMULA') return 'Society formula (Formula & Late Fees tab)';
  const unit = c.calculationType === 'PER_SQ_FT' ? `/sq ft ${c.areaType === 'CARPET_AREA' ? 'carpet' : 'built-up'}` : ' per unit';
  const bands = c.floorRates.map((r) => `${floorName(r.fromFloor)}${r.toFloor === null ? '+' : r.toFloor !== r.fromFloor ? `–${floorName(r.toFloor)}` : ''}: ${rupees(r.rate)}`);
  return bands.length ? `${bands.join(' · ')} · other floors ${rupees(c.rate)}${unit}` : `${rupees(c.rate)}${unit}`;
}

function describeLateFee(c: Category) {
  if (!c.penaltyType) return 'Society rules';
  if (c.penaltyType === 'NONE') return 'No late fee';
  if (c.penaltyType === 'PERCENTAGE') return `${Number(c.penaltyInterestRate)}% a year`;
  if (c.penaltyType === 'FIXED_PER_MONTH') return `${rupees(c.penaltyFlatAmount || 0)} a month`;
  return `${rupees(c.penaltyFlatAmount || 0)} once`;
}

function apiError(err: any): string {
  const data = err?.response?.data;
  const first = Array.isArray(data?.errors) && data.errors[0]?.message;
  return first ? `${data.errors[0].path ? `${data.errors[0].path}: ` : ''}${first}` : data?.message || err?.message || 'Something went wrong.';
}

/** Billing categories: how residential and commercial units (shops, offices by floor, ...) are charged. */
export function BillingCategoriesPanel() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [flatTypes, setFlatTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; isDefault: boolean; draft: Draft } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cats, units] = await Promise.all([apiClient.get('/maintenance/categories'), apiClient.get('/flats')]);
      setCategories(cats.data.data);
      const list = units.data.data?.list ?? units.data.data ?? [];
      setFlatTypes(Array.from(new Set<string>(list.map((f: any) => f.flatType).filter(Boolean))).sort());
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /** Which category each flat type is billed under right now. */
  const typeOwner = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) for (const t of c.flatTypes) map.set(t, c.name);
    return map;
  }, [categories]);
  const defaultName = categories.find((c) => c.isDefault)?.name || 'Residential';

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setEditing((e) => (e ? { ...e, draft: { ...e.draft, [key]: value } } : e));

  const save = async () => {
    if (!editing) return;
    const d = editing.draft;
    setFormError(null);
    const body = {
      name: d.name,
      usage: d.usage,
      calculationType: d.calculationType,
      areaType: d.areaType,
      rate: Number(d.rate || 0),
      floorRates: d.floorRates
        .filter((r) => r.fromFloor !== '' && r.rate !== '')
        .map((r) => ({ fromFloor: Number(r.fromFloor), toFloor: r.toFloor === '' ? null : Number(r.toFloor), rate: Number(r.rate) })),
      extraCharges: Object.fromEntries(d.extras.filter((x) => x.name.trim() && x.amount !== '').map((x) => [x.name.trim(), Number(x.amount)])),
      includeParking: d.includeParking,
      flatTypes: d.flatTypes,
      invoicePrefix: d.invoicePrefix || 'INV',
      gstEnabled: d.gstEnabled,
      gstRate: Number(d.gstRate || 0),
      gstThresholdMonthly: Number(d.gstThresholdMonthly || 0),
      penaltyType: d.ownLateFee ? d.penaltyType : null,
      penaltyInterestRate: d.ownLateFee && d.penaltyType === 'PERCENTAGE' ? Number(d.penaltyInterestRate || 0) : null,
      penaltyFlatAmount: d.ownLateFee && ['FIXED_PER_MONTH', 'FIXED_ONE_TIME'].includes(d.penaltyType) ? Number(d.penaltyFlatAmount || 0) : null,
      penaltyGracePeriodDays: d.ownLateFee && d.penaltyType !== 'NONE' ? Number(d.penaltyGracePeriodDays || 0) : null,
      sortOrder: d.sortOrder,
    };
    setSaving(true);
    try {
      if (editing.id) await apiClient.patch(`/maintenance/categories/${editing.id}`, body);
      else await apiClient.post('/maintenance/categories', body);
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Category) => {
    if (!window.confirm(`Delete "${c.name}"? Its units will be billed under ${defaultName} (or their flat type's category) from the next run. Existing bills are not changed.`)) return;
    try {
      await apiClient.delete(`/maintenance/categories/${c.id}`);
      await load();
    } catch (err) {
      setError(apiError(err));
    }
  };

  const d = editing?.draft;
  const isFormula = d?.calculationType === 'SOCIETY_FORMULA';

  return (
    <Card className="w-full">
      <CardHeader>
        <div>
          <CardTitle>Billing categories</CardTitle>
          <CardDescription className="mt-1">
            How each kind of unit is charged. Units follow their flat type; types not listed below use {defaultName}.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setEditing({ id: null, isDefault: false, draft: emptyDraft() })}>
          <Plus /> New category
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {loading ? (
          <div className="flex justify-center py-10 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Rate</th>
                  <th className="px-3 py-2 text-left">Extras</th>
                  <th className="px-3 py-2 text-left">GST</th>
                  <th className="px-3 py-2 text-left">Late fee</th>
                  <th className="px-3 py-2 text-left">Flat types</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id} className="align-top">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-900 dark:text-slate-100">{c.name}</span>
                        <Badge variant={c.usage === 'COMMERCIAL' ? 'info' : 'muted'}>{c.usage === 'COMMERCIAL' ? 'Commercial' : 'Residential'}</Badge>
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        Invoices {c.invoicePrefix}-…{c.isDefault ? ' · default' : ''}
                      </div>
                    </td>
                    <td className="max-w-xs px-3 py-2.5 text-slate-600 dark:text-slate-300">{describeRate(c)}</td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                      {c.calculationType === 'SOCIETY_FORMULA'
                        ? '—'
                        : [...Object.entries(c.extraCharges || {}).map(([k, v]) => `${k} ${rupees(v)}`), c.includeParking ? 'Parking' : null]
                            .filter(Boolean)
                            .join(' · ') || 'None'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                      {c.gstEnabled ? `${Number(c.gstRate)}% above ${rupees(c.gstThresholdMonthly)}/month` : 'No'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{describeLateFee(c)}</td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                      {c.flatTypes.length ? c.flatTypes.join(', ') : c.isDefault ? 'All other types' : <span className="text-amber-600">None yet</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <Button variant="ghost" size="icon-sm" aria-label={`Edit ${c.name}`} onClick={() => setEditing({ id: c.id, isDefault: c.isDefault, draft: toDraft(c) })}>
                        <Pencil />
                      </Button>
                      {!c.isDefault && (
                        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${c.name}`} onClick={() => remove(c)} className="text-red-600">
                          <Trash2 />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(open: boolean) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? `Edit ${editing.draft.name || 'category'}` : 'New billing category'}</DialogTitle>
            <DialogDescription>Applies from the next bill generation. Bills already created are not changed.</DialogDescription>
          </DialogHeader>
          {d && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="cat-name">Name</Label>
                  <Input id="cat-name" value={d.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Shop, Office" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cat-usage">Use</Label>
                  <NativeSelect id="cat-usage" value={d.usage} disabled={editing?.isDefault} onChange={(e) => set('usage', e.target.value as Draft['usage'])}>
                    <option value="COMMERCIAL">Commercial</option>
                    <option value="RESIDENTIAL">Residential</option>
                  </NativeSelect>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cat-calc">Charged</Label>
                  <NativeSelect id="cat-calc" value={d.calculationType} onChange={(e) => set('calculationType', e.target.value as Draft['calculationType'])}>
                    <option value="PER_SQ_FT">Per sq ft</option>
                    <option value="FIXED">Fixed per unit</option>
                    <option value="SOCIETY_FORMULA">Society formula</option>
                  </NativeSelect>
                </div>
                {d.calculationType === 'PER_SQ_FT' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="cat-area">Area</Label>
                    <NativeSelect id="cat-area" value={d.areaType} onChange={(e) => set('areaType', e.target.value as Draft['areaType'])}>
                      <option value="CARPET_AREA">Carpet area</option>
                      <option value="SUPER_BUILTUP">Super built-up area</option>
                    </NativeSelect>
                  </div>
                )}
                {!isFormula && (
                  <div className="space-y-1.5">
                    <Label htmlFor="cat-rate">{d.calculationType === 'PER_SQ_FT' ? 'Rate per sq ft (₹)' : 'Amount per month (₹)'}</Label>
                    <Input id="cat-rate" type="number" min={0} step="0.01" value={d.rate} onChange={(e) => set('rate', e.target.value)} />
                  </div>
                )}
              </div>

              {isFormula ? (
                <p className="rounded-md bg-muted/50 p-3 text-sm text-slate-600 dark:text-slate-300">
                  Uses the society&apos;s calculation mode and formula from the <span className="font-medium">Formula &amp; Late Fees</span> tab.
                </p>
              ) : (
                <>
                  <fieldset className="space-y-2">
                    <legend className="text-sm text-slate-500">Rates by floor (optional; other floors use the rate above)</legend>
                    {d.floorRates.map((r, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-slate-500">Floors</span>
                        <Input aria-label="From floor" type="number" className="w-20" value={r.fromFloor} onChange={(e) => set('floorRates', d.floorRates.map((x, j) => (j === i ? { ...x, fromFloor: e.target.value } : x)))} />
                        <span className="text-slate-500">to</span>
                        <Input aria-label="To floor" type="number" className="w-28" placeholder="and above" value={r.toFloor} onChange={(e) => set('floorRates', d.floorRates.map((x, j) => (j === i ? { ...x, toFloor: e.target.value } : x)))} />
                        <span className="text-slate-500">₹</span>
                        <Input aria-label="Rate" type="number" step="0.01" className="w-28" value={r.rate} onChange={(e) => set('floorRates', d.floorRates.map((x, j) => (j === i ? { ...x, rate: e.target.value } : x)))} />
                        <Button variant="ghost" size="icon-sm" aria-label="Remove floor rate" onClick={() => set('floorRates', d.floorRates.filter((_, j) => j !== i))}>
                          <X />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => set('floorRates', [...d.floorRates, { fromFloor: String(d.floorRates.length), toFloor: String(d.floorRates.length), rate: '' }])}>
                      <Plus /> Add floor rate
                    </Button>
                    <p className="text-xs text-slate-500">Ground floor is 0. Leave &quot;to&quot; empty for &quot;and above&quot;.</p>
                  </fieldset>

                  <fieldset className="space-y-2">
                    <legend className="text-sm text-slate-500">Extra monthly charges</legend>
                    {d.extras.map((x, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input aria-label="Charge name" placeholder="e.g. Water, Sinking fund, Lift" value={x.name} onChange={(e) => set('extras', d.extras.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} />
                        <Input aria-label="Amount" type="number" step="0.01" className="w-32" placeholder="₹" value={x.amount} onChange={(e) => set('extras', d.extras.map((y, j) => (j === i ? { ...y, amount: e.target.value } : y)))} />
                        <Button variant="ghost" size="icon-sm" aria-label="Remove charge" onClick={() => set('extras', d.extras.filter((_, j) => j !== i))}>
                          <X />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => set('extras', [...d.extras, { name: '', amount: '' }])}>
                      <Plus /> Add charge
                    </Button>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={d.includeParking} onChange={(e) => set('includeParking', e.target.checked)} />
                      Charge allotted parking slots
                    </label>
                  </fieldset>
                </>
              )}

              <fieldset className="space-y-2">
                <legend className="text-sm text-slate-500">Flat types billed in this category</legend>
                {editing?.isDefault && <p className="text-xs text-slate-500">Types not listed in any other category are also billed here.</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {flatTypes.length === 0 && <span className="text-sm text-slate-400">No units yet.</span>}
                  {flatTypes.map((t) => {
                    const owner = typeOwner.get(t);
                    const takenElsewhere = owner && owner !== (editing?.id ? categories.find((c) => c.id === editing.id)?.name : undefined);
                    return (
                      <label key={t} className="flex items-center gap-2 text-sm" title={takenElsewhere ? `Currently billed under ${owner}` : undefined}>
                        <input
                          type="checkbox"
                          disabled={!!takenElsewhere}
                          checked={d.flatTypes.includes(t)}
                          onChange={(e) => set('flatTypes', e.target.checked ? [...d.flatTypes, t] : d.flatTypes.filter((x) => x !== t))}
                        />
                        {t}
                        {takenElsewhere && <span className="text-xs text-slate-400">({owner})</span>}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-sm text-slate-500">GST</legend>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={d.gstEnabled} onChange={(e) => set('gstEnabled', e.target.checked)} />
                  Charge GST on these units
                </label>
                {d.gstEnabled && (
                  <div className="flex flex-wrap items-end gap-3 pl-6 text-sm">
                    <div className="space-y-1.5">
                      <Label htmlFor="cat-gst-rate">Rate (%)</Label>
                      <Input id="cat-gst-rate" type="number" step="0.01" className="w-24" value={d.gstRate} onChange={(e) => set('gstRate', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cat-gst-threshold">When monthly maintenance is above (₹)</Label>
                      <Input id="cat-gst-threshold" type="number" className="w-36" value={d.gstThresholdMonthly} onChange={(e) => set('gstThresholdMonthly', e.target.value)} />
                    </div>
                    <p className="pb-2 text-xs text-slate-500">Charged on the whole amount, shown as CGST + SGST. Set the society GSTIN in Society Settings.</p>
                  </div>
                )}
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-sm text-slate-500">Late fee</legend>
                <div className="flex flex-col gap-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="cat-late" checked={!d.ownLateFee} onChange={() => set('ownLateFee', false)} />
                    Same as the society (Formula &amp; Late Fees tab)
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="cat-late" checked={d.ownLateFee} onChange={() => set('ownLateFee', true)} />
                    Own late-fee rules
                  </label>
                </div>
                {d.ownLateFee && (
                  <div className="flex flex-wrap items-end gap-3 pl-6">
                    <div className="space-y-1.5">
                      <Label htmlFor="cat-pen-type">Type</Label>
                      <NativeSelect id="cat-pen-type" className="w-52" value={d.penaltyType} onChange={(e) => set('penaltyType', e.target.value)}>
                        <option value="PERCENTAGE">Interest (% a year)</option>
                        <option value="FIXED_PER_MONTH">Fixed amount per month</option>
                        <option value="FIXED_ONE_TIME">Fixed amount once</option>
                        <option value="NONE">No late fee</option>
                      </NativeSelect>
                    </div>
                    {d.penaltyType === 'PERCENTAGE' && (
                      <div className="space-y-1.5">
                        <Label htmlFor="cat-pen-rate">% a year</Label>
                        <Input id="cat-pen-rate" type="number" step="0.01" className="w-24" value={d.penaltyInterestRate} onChange={(e) => set('penaltyInterestRate', e.target.value)} />
                      </div>
                    )}
                    {['FIXED_PER_MONTH', 'FIXED_ONE_TIME'].includes(d.penaltyType) && (
                      <div className="space-y-1.5">
                        <Label htmlFor="cat-pen-amount">Amount (₹)</Label>
                        <Input id="cat-pen-amount" type="number" className="w-28" value={d.penaltyFlatAmount} onChange={(e) => set('penaltyFlatAmount', e.target.value)} />
                      </div>
                    )}
                    {d.penaltyType !== 'NONE' && (
                      <div className="space-y-1.5">
                        <Label htmlFor="cat-pen-grace">Grace days</Label>
                        <Input id="cat-pen-grace" type="number" min={0} className="w-24" value={d.penaltyGracePeriodDays} onChange={(e) => set('penaltyGracePeriodDays', e.target.value)} />
                      </div>
                    )}
                  </div>
                )}
              </fieldset>

              <div className="grid grid-cols-2 gap-3 sm:w-1/2">
                <div className="space-y-1.5">
                  <Label htmlFor="cat-prefix">Invoice prefix</Label>
                  <Input id="cat-prefix" value={d.invoicePrefix} onChange={(e) => set('invoicePrefix', e.target.value.toUpperCase())} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cat-order">Order</Label>
                  <Input id="cat-order" type="number" value={d.sortOrder} onChange={(e) => set('sortOrder', Number(e.target.value) || 0)} />
                </div>
              </div>

              {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !d?.name.trim()}>
              {saving && <Loader2 className="animate-spin" />}
              Save category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
