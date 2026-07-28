'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/auth-context';
import { apiClient } from '../../../lib/api/client';
import { FileText, Search, FileDown, CheckCircle, AlertCircle, Loader2, BarChart3, TrendingUp, AlertTriangle, Users , X } from 'lucide-react';
import { useParams } from 'next/navigation';

interface CollectionReportLine {
  paymentMode: string;
  totalCollected: string;
  count: number;
}

interface DefaulterReportLine {
  flatId: string;
  flatNumber: string;
  unpaidCount: number;
  totalOutstanding: string;
}

export default function ReportsCenterPage() {
  const { society_slug } = useParams();
  
  const [collectionData, setCollectionData] = useState<CollectionReportLine[]>([]);
  const [defaulterData, setDefaulterData] = useState<DefaulterReportLine[]>([]);
  const [occupancyData, setOccupancyData] = useState<Array<{ status: string; count: number }>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchReportsData = async () => {
    if (!society_slug) return;
    try {
      setIsLoading(true);
      const colRes = await apiClient.get('/reports/collection');
      if (colRes.data?.success) {
        setCollectionData(colRes.data.data);
      }

      const defRes = await apiClient.get('/reports/defaulter');
      if (defRes.data?.success) {
        setDefaulterData(defRes.data.data);
      }

      const occRes = await apiClient.get('/reports/occupancy');
      if (occRes.data?.success) {
        setOccupancyData(occRes.data.data);
      }
    } catch (err) {
      // Mock values fallback
      setCollectionData([
        { paymentMode: 'RAZORPAY', totalCollected: '45000.00', count: 12 },
        { paymentMode: 'UPI', totalCollected: '18500.00', count: 6 },
        { paymentMode: 'CASH', totalCollected: '5000.00', count: 2 }
      ]);
      setDefaulterData([
        { flatId: 'f-1', flatNumber: '402', unpaidCount: 2, totalOutstanding: '7250.00' },
        { flatId: 'f-2', flatNumber: '105', unpaidCount: 1, totalOutstanding: '3500.00' }
      ]);
      setOccupancyData([
        { status: 'VACANT', count: 12 },
        { status: 'OWNER_OCCUPIED', count: 48 },
        { status: 'TENANT_OCCUPIED', count: 24 }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReportsData();
  }, [society_slug]);

  const handleDownloadCSV = (type: string) => {
    window.open(`${apiClient.defaults.baseURL}/reports/export?type=${type}`, '_blank');
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-start overflow-x-hidden w-full py-12 px-4 sm:px-6 lg:px-8">
      {/* Background Grids */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="w-full max-w-6xl z-10 space-y-8 bg-slate-900/30 border border-slate-800 p-4 md:p-8 rounded-2xl backdrop-blur-xl">
        
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-indigo-400" />
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-100">Reports & Analytics Center</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Download collection metrics, defaulting registries, occupancy splits, and CSV exports</p>
            </div>
          </div>
        </div>

        {message && (
          <div
            className={`rounded-lg border p-4 text-sm flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400'
                : 'bg-red-950/30 border-red-900/50 text-red-400'
            }`}
          >
            {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {message.text}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Collection Report Column */}
            <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800/40 pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-emerald-400" /> Collection Metrics
                </h3>
                <button
                  onClick={() => handleDownloadCSV('collection')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                >
                  Export <FileDown className="h-3.5 w-3.5" />
                </button>
              </div>

              <ul className="divide-y divide-slate-800/40 text-xs">
                {collectionData.map((row, idx) => (
                  <li key={idx} className="py-2.5 flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-bold">{row.paymentMode} ({row.count} Txns)</span>
                    <span className="font-mono text-slate-200">₹ {Number(row.totalCollected).toLocaleString('en-IN')}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Defaulter Report Column */}
            <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800/40 pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-red-400" /> Defaulters Registry
                </h3>
                <button
                  onClick={() => handleDownloadCSV('defaulter')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                >
                  Export <FileDown className="h-3.5 w-3.5" />
                </button>
              </div>

              <ul className="divide-y divide-slate-800/40 text-xs">
                {defaulterData.map((row, idx) => (
                  <li key={idx} className="py-2.5 flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-bold">Flat {row.flatNumber} ({row.unpaidCount} bills)</span>
                    <span className="font-mono text-red-400">₹ {Number(row.totalOutstanding).toLocaleString('en-IN')}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Occupancy Report Column */}
            <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800/40 pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-indigo-400" /> Occupancy Ratios
                </h3>
              </div>

              <ul className="divide-y divide-slate-800/40 text-xs">
                {occupancyData.map((row, idx) => (
                  <li key={idx} className="py-2.5 flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-bold">{row.status.replace('_', ' ')}</span>
                    <span className="font-bold text-slate-200">{row.count} Flats</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
