'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/auth-context';
import { apiClient } from '../../../lib/api/client';
import {
  Box, Loader2, CheckCircle, AlertCircle, Plus, Wrench, X,
  Pencil, Trash2, ShieldCheck, Calendar, Coins, Building,
  AlertTriangle
} from 'lucide-react';
import { useParams } from 'next/navigation';

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────
interface Asset {
  id: string;
  name: string;
  type: string;
  purchaseDate?: string;
  cost?: string;
  warrantyExpiry?: string;
  amcProvider?: string;
  amcCost?: string;
  nextServiceDate?: string;
}

interface CostAnalysisItem {
  assetId: string;
  assetName: string;
  type: string;
  totalCost: string;
}

const ASSET_TYPES = [
  'LIFT', 'PUMP', 'GENERATOR', 'FIRE_SYSTEM', 'CCTV',
  'SOLAR_PANEL', 'STP_WTP', 'GATE_AUTOMATION', 'SWIMMING_POOL',
  'GYM_EQUIPMENT', 'VEHICLE', 'TRANSFORMER', 'INTERCOM', 'OTHER',
];

const BLANK_FORM = {
  name: '', type: 'LIFT', purchaseDate: '', cost: '',
  warrantyExpiry: '', amcProvider: '', amcCost: '', nextServiceDate: '',
};

// ──────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────
export default function AssetManagementPage() {
  const { society_slug } = useParams();
  const { activeSociety } = useAuth();
  const isManagement = ['SUPER_ADMIN', 'PRESIDENT', 'SECRETARY', 'TREASURER', 'ACCOUNTANT', 'COMMITTEE_MEMBER'].includes(activeSociety?.role || '');

  const [assetsList, setAssetsList] = useState<Asset[]>([]);
  const [costAnalysis, setCostAnalysis] = useState<CostAnalysisItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'assets' | 'cost'>('assets');

  // ── Add / Edit Asset Modal ──
  const [assetModal, setAssetModal] = useState<'add' | 'edit' | null>(null);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [assetForm, setAssetForm] = useState<typeof BLANK_FORM>({ ...BLANK_FORM });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // ── Log Maintenance Modal ──
  const [logAssetId, setLogAssetId] = useState<string | null>(null);
  const [logType, setLogType] = useState<'MAINTENANCE' | 'REPAIR'>('MAINTENANCE');
  const [logDesc, setLogDesc] = useState('');
  const [logCost, setLogCost] = useState(0);
  const [logDate, setLogDate] = useState(new Date().toISOString().substring(0, 10));

  const fetchData = async () => {
    if (!society_slug) return;
    try {
      setIsLoading(true);
      const [assetsRes, costRes] = await Promise.all([
        apiClient.get('/assets'),
        apiClient.get('/assets/reports/cost-analysis'),
      ]);
      if (assetsRes.data?.success) setAssetsList(assetsRes.data.data);
      if (costRes.data?.success) setCostAnalysis(costRes.data.data);
    } catch {
      // Fallback demo data if API is unavailable
      setAssetsList([
        { id: 'demo-1', name: 'Main Elevator Tower A', type: 'LIFT', purchaseDate: '2020-01-15', cost: '1200000.00', warrantyExpiry: '2022-01-15', amcProvider: 'Otis Elevators India', amcCost: '45000.00', nextServiceDate: '2026-08-10' },
        { id: 'demo-2', name: 'Water Pump Unit 2', type: 'PUMP', purchaseDate: '2023-05-20', cost: '75000.00', warrantyExpiry: '2025-05-20', amcProvider: 'Kirloskar Brothers Ltd', amcCost: '8000.00', nextServiceDate: '2026-07-30' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [society_slug]);

  const openAddModal = () => {
    setAssetForm({ ...BLANK_FORM });
    setEditingAsset(null);
    setAssetModal('add');
  };

  const openEditModal = (asset: Asset) => {
    setAssetForm({
      name: asset.name,
      type: asset.type,
      purchaseDate: asset.purchaseDate || '',
      cost: asset.cost || '',
      warrantyExpiry: asset.warrantyExpiry || '',
      amcProvider: asset.amcProvider || '',
      amcCost: asset.amcCost || '',
      nextServiceDate: asset.nextServiceDate || '',
    });
    setEditingAsset(asset);
    setAssetModal('edit');
  };

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetForm.name.trim()) return;
    setIsProcessing(true);
    setMessage(null);
    try {
      const payload = {
        ...assetForm,
        cost: assetForm.cost ? Number(assetForm.cost) : undefined,
        amcCost: assetForm.amcCost ? Number(assetForm.amcCost) : undefined,
      };

      if (assetModal === 'add') {
        await apiClient.post('/assets', payload);
        setMessage({ type: 'success', text: 'Asset added to society register successfully.' });
      } else if (assetModal === 'edit' && editingAsset) {
        await apiClient.put(`/assets/${editingAsset.id}`, payload);
        setMessage({ type: 'success', text: 'Asset details updated successfully.' });
      }

      setAssetModal(null);
      setEditingAsset(null);
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save asset. Please try again.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    setIsProcessing(true);
    try {
      await apiClient.delete(`/assets/${assetId}`);
      setMessage({ type: 'success', text: 'Asset removed from society register.' });
      setDeleteConfirmId(null);
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to delete asset.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePostLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logAssetId || !logDesc) return;
    setIsProcessing(true);
    setMessage(null);
    try {
      await apiClient.post(`/assets/${logAssetId}/logs`, {
        type: logType, description: logDesc,
        cost: Number(logCost), date: logDate, status: 'COMPLETED',
      });
      setMessage({ type: 'success', text: 'Maintenance / repair log registered successfully.' });
      setLogAssetId(null);
      fetchData();
    } catch {
      setMessage({ type: 'error', text: 'Failed to log maintenance entry.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const totalAssetValue = assetsList.reduce((s, a) => s + Number(a.cost || 0), 0);
  const totalAmcCost = assetsList.reduce((s, a) => s + Number(a.amcCost || 0), 0);
  const nearServiceAssets = assetsList.filter(a => {
    if (!a.nextServiceDate) return false;
    const diff = (new Date(a.nextServiceDate).getTime() - Date.now()) / (1000 * 86400);
    return diff >= 0 && diff <= 30;
  }).length;

  const inp = (field: keyof typeof BLANK_FORM, label: string, type = 'text', placeholder = '') => (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={assetForm[field]}
        onChange={(e) => setAssetForm(prev => ({ ...prev, [field]: e.target.value }))}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none transition-all"
      />
    </div>
  );

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-start overflow-x-hidden w-full py-8 px-4 sm:px-6 md:px-8 lg:px-10">
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="w-full max-w-[1450px] mx-auto space-y-6 z-10">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/20">
              <Box className="h-7 w-7 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-100">Asset Management Center</h2>
              <p className="text-xs text-slate-500">Track warranties, AMC contracts, schedule servicing & audit maintenance costs</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('assets')}
              className={`rounded-lg border py-2 px-4 text-xs font-semibold transition-all ${activeTab === 'assets' ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200'}`}
            >
              Assets Roster ({assetsList.length})
            </button>
            <button
              onClick={() => setActiveTab('cost')}
              className={`rounded-lg border py-2 px-4 text-xs font-semibold transition-all ${activeTab === 'cost' ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200'}`}
            >
              Cost & AMC Analysis
            </button>
            {isManagement && (
              <button
                onClick={openAddModal}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 text-xs font-semibold transition-all shadow-md"
              >
                <Plus className="h-3.5 w-3.5" /> Add Asset
              </button>
            )}
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Assets', value: String(assetsList.length), icon: Box, color: 'text-indigo-400' },
            { label: 'Total Capital Value', value: `₹${(totalAssetValue / 100000).toFixed(1)}L`, icon: Coins, color: 'text-emerald-400' },
            { label: 'Annual AMC Cost', value: `₹${(totalAmcCost).toLocaleString('en-IN')}`, icon: Calendar, color: 'text-amber-400' },
            { label: 'Service Due (30 days)', value: String(nearServiceAssets), icon: AlertTriangle, color: nearServiceAssets > 0 ? 'text-rose-400' : 'text-slate-500' },
          ].map((kpi, i) => (
            <div key={i} className="border border-slate-800 rounded-xl bg-slate-950/40 p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{kpi.label}</span>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
              <div className={`text-xl font-black ${kpi.color}`}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {message && (
          <div className={`rounded-lg border p-3 text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400' : 'bg-red-950/30 border-red-900/50 text-red-400'}`}>
            {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {message.text}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 text-indigo-500 animate-spin" /></div>
        ) : (
          <>
            {/* ── ASSETS ROSTER TAB ── */}
            {activeTab === 'assets' && (
              <div className="space-y-4">
                {assetsList.length === 0 && (
                  <div className="flex flex-col items-center justify-center gap-3 py-20 border border-dashed border-slate-800 rounded-xl text-slate-500">
                    <Box className="h-12 w-12 opacity-20" />
                    <p className="text-sm font-semibold">No assets added yet</p>
                    <p className="text-xs text-center max-w-xs">Click <span className="text-emerald-400 font-bold">"Add Asset"</span> to register society equipment like lifts, pumps, generators, CCTV, etc.</p>
                    {isManagement && (
                      <button onClick={openAddModal} className="mt-2 flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-5 text-xs font-semibold">
                        <Plus className="h-3.5 w-3.5" /> Add First Asset
                      </button>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {assetsList.map((asset) => {
                    const warrantyExp = asset.warrantyExpiry ? new Date(asset.warrantyExpiry) : null;
                    const isWarrantyActive = warrantyExp ? warrantyExp > new Date() : false;
                    const serviceDays = asset.nextServiceDate ? Math.ceil((new Date(asset.nextServiceDate).getTime() - Date.now()) / (1000 * 86400)) : null;
                    const isDueSoon = serviceDays !== null && serviceDays >= 0 && serviceDays <= 30;
                    const isOverdue = serviceDays !== null && serviceDays < 0;

                    return (
                      <div key={asset.id} className="border border-slate-800 bg-slate-950/20 rounded-xl p-5 space-y-4 text-xs hover:border-slate-700 transition-all group">

                        {/* Title row */}
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <h3 className="text-sm font-bold text-slate-100">{asset.name}</h3>
                            <span className="inline-block mt-1 text-[10px] bg-indigo-950/40 border border-indigo-900/40 text-indigo-400 rounded px-1.5 py-0.5 font-semibold uppercase">
                              {asset.type}
                            </span>
                          </div>
                          <span className={`text-[10px] font-semibold border rounded-full px-2.5 py-0.5 uppercase whitespace-nowrap flex-shrink-0 ${isWarrantyActive ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400' : 'bg-slate-900/30 border-slate-800 text-slate-600'}`}>
                            {isWarrantyActive ? '✓ Warranty' : 'Expired'}
                          </span>
                        </div>

                        {/* Detail grid */}
                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 border-t border-slate-800/60 pt-3 text-[11px]">
                          <div><span className="text-slate-500 block">Purchase Value</span><span className="font-bold text-slate-200">{asset.cost ? `₹${Number(asset.cost).toLocaleString('en-IN')}` : '—'}</span></div>
                          <div><span className="text-slate-500 block">Annual AMC Cost</span><span className="font-bold text-amber-400">{asset.amcCost ? `₹${Number(asset.amcCost).toLocaleString('en-IN')}` : '—'}</span></div>
                          <div><span className="text-slate-500 block">AMC Provider</span><span className="font-semibold text-slate-300">{asset.amcProvider || '—'}</span></div>
                          <div>
                            <span className="text-slate-500 block">Next Service</span>
                            <span className={`font-semibold ${isOverdue ? 'text-rose-400' : isDueSoon ? 'text-amber-400' : 'text-slate-300'}`}>
                              {asset.nextServiceDate || '—'}
                              {isOverdue && <span className="ml-1 text-[9px] font-bold text-rose-500">(OVERDUE)</span>}
                              {isDueSoon && !isOverdue && <span className="ml-1 text-[9px] font-bold text-amber-500">({serviceDays}d)</span>}
                            </span>
                          </div>
                          <div><span className="text-slate-500 block">Purchase Date</span><span className="text-slate-400">{asset.purchaseDate || '—'}</span></div>
                          <div><span className="text-slate-500 block">Warranty Until</span><span className="text-slate-400">{asset.warrantyExpiry || '—'}</span></div>
                        </div>

                        {/* Actions */}
                        {isManagement && (
                          <div className="flex items-center justify-between border-t border-slate-800/60 pt-3 gap-2">
                            <button
                              onClick={() => { setLogAssetId(asset.id); setLogDesc(''); setLogCost(0); }}
                              className="flex-1 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white py-1.5 px-3 font-semibold flex items-center justify-center gap-1 transition-all text-[11px]"
                            >
                              <Wrench className="h-3 w-3" /> Log Maintenance
                            </button>
                            <button
                              onClick={() => openEditModal(asset)}
                              className="rounded-lg border border-slate-700 hover:border-slate-600 bg-slate-900/60 text-slate-300 hover:text-slate-100 py-1.5 px-3 font-semibold flex items-center gap-1 transition-all text-[11px]"
                            >
                              <Pencil className="h-3 w-3" /> Edit
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(asset.id)}
                              className="rounded-lg border border-red-900/40 hover:bg-red-950/40 text-red-400 hover:text-red-300 py-1.5 px-3 font-semibold flex items-center gap-1 transition-all text-[11px]"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── COST & AMC ANALYSIS TAB ── */}
            {activeTab === 'cost' && (
              <div className="space-y-5">
                <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Maintenance Cost Ledger Analysis</h3>
                  <p className="text-xs text-slate-500 mt-1">Aggregated repair and servicing expenditures grouped by asset and work type. Log entries via the Maintenance button on each asset card.</p>
                </div>

                {costAnalysis.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-16 border border-dashed border-slate-800 rounded-xl text-slate-500">
                    <Wrench className="h-10 w-10 opacity-20" />
                    <p className="text-sm font-semibold">No maintenance records yet</p>
                    <p className="text-xs text-center">Go to <span className="text-indigo-400">Assets Roster</span> and click <span className="text-indigo-400">"Log Maintenance"</span> on any asset to record a cost entry.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/20">
                    <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                      <thead>
                        <tr className="bg-black/60 text-slate-500 font-semibold border-b border-slate-800">
                          <th className="p-4">Asset Name</th>
                          <th className="p-4">Work Type</th>
                          <th className="p-4 text-right">Total Expenditure (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {costAnalysis.map((row, idx) => (
                          <tr key={idx} className="text-slate-300 hover:bg-slate-900/20 transition-colors">
                            <td className="p-4 font-bold text-slate-200">{row.assetName}</td>
                            <td className="p-4">
                              <span className={`text-[10px] border rounded px-2 py-0.5 font-bold uppercase ${row.type === 'MAINTENANCE' ? 'border-indigo-900/50 bg-indigo-950/30 text-indigo-400' : 'border-amber-900/50 bg-amber-950/30 text-amber-400'}`}>
                                {row.type}
                              </span>
                            </td>
                            <td className="p-4 text-right font-mono font-bold text-slate-100">
                              ₹ {Number(row.totalCost).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-slate-950/60 font-bold border-t-2 border-slate-700">
                          <td className="p-4 text-slate-300" colSpan={2}>Total Maintenance & Repair Spend</td>
                          <td className="p-4 text-right font-mono text-indigo-400 font-black text-sm">
                            ₹ {costAnalysis.reduce((s, r) => s + Number(r.totalCost), 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* MODAL: Add / Edit Asset                    */}
      {/* ═══════════════════════════════════════════ */}
      {assetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setAssetModal(null)} />
          <div className="relative w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-600/20 border border-emerald-500/20">
                  <Box className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">{assetModal === 'add' ? 'Add New Society Asset' : 'Edit Asset Details'}</h3>
                  <p className="text-[11px] text-slate-500">Register capital assets like lifts, pumps, generators, CCTV, etc.</p>
                </div>
              </div>
              <button onClick={() => setAssetModal(null)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-all">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto p-6">
              <form id="asset-form" onSubmit={handleSaveAsset} className="space-y-5">
                {/* Row 1 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Asset Name *</label>
                    <input
                      type="text"
                      value={assetForm.name}
                      onChange={(e) => setAssetForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Main Elevator Tower A, Water Pump Unit 3"
                      required
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Asset Type *</label>
                    <select
                      value={assetForm.type}
                      onChange={(e) => setAssetForm(prev => ({ ...prev, type: e.target.value }))}
                      required
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none appearance-none"
                    >
                      {ASSET_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                </div>

                {/* Row 2 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {inp('purchaseDate', 'Purchase Date', 'date')}
                  {inp('cost', 'Purchase Cost (₹)', 'number', '0.00')}
                  {inp('warrantyExpiry', 'Warranty Expiry Date', 'date')}
                </div>

                {/* Row 3 - AMC */}
                <div className="border border-amber-900/30 bg-amber-950/10 rounded-xl p-4 space-y-3">
                  <h4 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Annual Maintenance Contract (AMC) Details</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {inp('amcProvider', 'AMC Service Provider', 'text', 'e.g. Otis Elevators India, Kirloskar Brothers Ltd')}
                    {inp('amcCost', 'Annual AMC Cost (₹)', 'number', '0.00')}
                  </div>
                  {inp('nextServiceDate', 'Next Scheduled Service Date', 'date')}
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-800 flex-shrink-0">
              <button type="button" onClick={() => setAssetModal(null)} className="rounded-lg border border-slate-800 bg-slate-900/60 text-slate-400 py-2 px-5 text-xs font-semibold hover:bg-slate-800 transition-all">
                Cancel
              </button>
              <button type="submit" form="asset-form" disabled={isProcessing} className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-6 text-xs font-semibold disabled:opacity-55 flex items-center gap-2 transition-all shadow-lg">
                {isProcessing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {assetModal === 'add' ? 'Add Asset to Register' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* MODAL: Log Maintenance / Repair            */}
      {/* ═══════════════════════════════════════════ */}
      {logAssetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setLogAssetId(null)} />
          <div className="relative w-full max-w-lg bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-600/20 border border-indigo-500/20">
                  <Wrench className="h-5 w-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Log Maintenance / Repair</h3>
                  <p className="text-[11px] text-slate-500">
                    {assetsList.find(a => a.id === logAssetId)?.name || 'Asset'}
                  </p>
                </div>
              </div>
              <button onClick={() => setLogAssetId(null)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-all">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <form id="log-form" onSubmit={handlePostLog} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Work Type</label>
                    <select value={logType} onChange={(e) => setLogType(e.target.value as any)} className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-sm text-slate-200 appearance-none focus:border-indigo-500 focus:outline-none">
                      <option value="MAINTENANCE">Scheduled Maintenance</option>
                      <option value="REPAIR">Repair / Replacement</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Activity Date</label>
                    <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} required className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Expense Cost (₹)</label>
                  <input type="number" step="0.01" value={logCost} onChange={(e) => setLogCost(Number(e.target.value))} className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Activity Description *</label>
                  <textarea rows={3} placeholder="e.g. Quarterly elevator rope inspection and brake adjustment..." value={logDesc} onChange={(e) => setLogDesc(e.target.value)} required className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none" />
                </div>
              </form>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-800 flex-shrink-0">
              <button type="button" onClick={() => setLogAssetId(null)} className="rounded-lg border border-slate-800 bg-slate-900/60 text-slate-400 py-2 px-4 text-xs font-semibold hover:bg-slate-800 transition-all">Cancel</button>
              <button type="submit" form="log-form" disabled={isProcessing} className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-6 text-xs font-semibold disabled:opacity-55 flex items-center gap-2 shadow-lg">
                {isProcessing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Log Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* MODAL: Delete Confirm                      */}
      {/* ═══════════════════════════════════════════ */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeleteConfirmId(null)} />
          <div className="relative w-full max-w-sm bg-slate-950 border border-red-900/50 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-600/20 border border-red-500/20 flex-shrink-0">
                <Trash2 className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Remove Asset</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Are you sure you want to remove <span className="font-bold text-slate-200">{assetsList.find(a => a.id === deleteConfirmId)?.name}</span> from the society asset register? All associated maintenance logs will also be deleted.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirmId(null)} className="rounded-lg border border-slate-800 bg-slate-900 text-slate-400 py-2 px-4 text-xs font-semibold hover:bg-slate-800 transition-all">Cancel</button>
              <button
                onClick={() => handleDeleteAsset(deleteConfirmId)}
                disabled={isProcessing}
                className="rounded-lg bg-red-600 hover:bg-red-700 text-white py-2 px-5 text-xs font-semibold disabled:opacity-55 flex items-center gap-2"
              >
                {isProcessing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Yes, Remove Asset
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
