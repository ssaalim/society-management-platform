'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../providers/auth-context';
import { apiClient } from '../../../../lib/api/client';
import { Building, ArrowLeft, Printer, CreditCard, Receipt, Loader2, CheckCircle, AlertCircle , X } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function MaintenanceBillDetailPage() {
  const { society_slug, bill_id } = useParams();
  
  const [billData, setBillData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Payment Form state
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<string>('UPI');
  const [transactionId, setTransactionId] = useState<string>('');

  const fetchBillDetails = async () => {
    if (!bill_id) return;
    try {
      const res = await apiClient.get(`/maintenance/${bill_id}`);
      if (res.data?.success) {
        const data = res.data.data;
        setBillData(data);
        const totalPaid = data.receipts?.reduce((acc: number, r: any) => acc + Number(r.amountPaid), 0) || 0;
        const remaining = Math.max(0, Number(data.amount || 0) - totalPaid);
        setAmountPaid(remaining > 0 ? remaining : Number(data.amount || 0));
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to retrieve bill invoice details.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBillDetails();
  }, [bill_id]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amountPaid || amountPaid <= 0) {
      setMessage({ type: 'error', text: 'Payment amount must be a positive number.' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const todayStr = new Date().toISOString().substring(0, 10);
      const res = await apiClient.post('/maintenance/receipt', {
        billId: bill_id,
        amountPaid: Number(amountPaid),
        paymentMode,
        transactionId: transactionId || null,
        paymentDate: todayStr,
      });

      if (res.data?.success) {
        setMessage({ type: 'success', text: 'Payment receipt logged successfully.' });
        fetchBillDetails();
      }
    } catch (err: any) {
      setMessage({ 
        type: 'error', 
        text: err.response?.data?.error?.message || 'Failed to record payment receipt.' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#030712]">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-start overflow-x-hidden w-full py-12 px-4 sm:px-6 lg:px-8">
      {/* Background Grids */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="w-full max-w-4xl z-10 space-y-8 bg-slate-900/30 border border-slate-800 p-8 rounded-2xl backdrop-blur-xl">
        
        {/* Back navigation */}
        <div className="flex items-center justify-between">
          <Link
            href={`/${society_slug}/maintenance`}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-all"
          >
            <ArrowLeft className="h-3 w-3" /> Back to dashboard ledger
          </Link>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/60 py-1.5 px-3.5 text-xs font-semibold text-slate-300 hover:bg-slate-900 hover:text-slate-100 transition-all"
          >
            <Printer className="h-3.5 w-3.5" /> Print Invoice
          </button>
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

        {/* Professional Print Layout Frame */}
        <div id="invoice-print-frame" className="rounded-xl border border-slate-800 bg-slate-950/40 p-8 space-y-8 text-slate-300">
          
          {/* Invoice Header */}
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between border-b border-slate-800 pb-6">
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 block mb-1">Maintenance Assessment Invoice</span>
              <h3 className="text-xl font-bold text-slate-200">{billData?.billNumber}</h3>
              <p className="text-xs text-slate-500 mt-1">
                Period: {billData?.periodStart ? String(billData.periodStart).substring(0, 10) : billData?.billingPeriodStart ? String(billData.billingPeriodStart).substring(0, 10) : 'N/A'} to {billData?.periodEnd ? String(billData.periodEnd).substring(0, 10) : billData?.billingPeriodEnd ? String(billData.billingPeriodEnd).substring(0, 10) : 'N/A'}
              </p>
            </div>
            
            <div className="text-left sm:text-right space-y-1">
              <span className={`inline-block text-[10px] font-semibold border rounded-full px-2.5 py-0.5 uppercase tracking-wider mb-2 ${
                billData?.status === 'PAID'
                  ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400'
                  : 'bg-red-950/30 border-red-900/50 text-red-400'
              }`}>
                {billData?.status ? billData.status.replace('_', ' ') : 'UNPAID'}
              </span>
              <p className="text-xs text-slate-500">Due Date: <span className="text-red-400/80 font-semibold">{billData?.dueDate ? String(billData.dueDate).substring(0, 10) : 'N/A'}</span></p>
            </div>
          </div>

          {/* Billing Info Grid */}
          {/* Billing Info Grid & Assessment Summary */}
          {(() => {
            const totalInvoiceDue = Number(billData?.amount || 0);
            const totalPaidSoFar = billData?.receipts?.reduce((acc: number, r: any) => acc + Number(r.amountPaid || 0), 0) || 0;
            const balanceDue = Math.max(0, totalInvoiceDue - totalPaidSoFar);
            const paidPct = totalInvoiceDue > 0 ? Math.min(100, Math.round((totalPaidSoFar / totalInvoiceDue) * 100)) : 0;
            const enteredVal = Number(amountPaid || 0);
            const newTotalPaid = totalPaidSoFar + enteredVal;
            const newBalanceDue = Math.max(0, totalInvoiceDue - newTotalPaid);
            const isPartial = newBalanceDue > 0;

            return (
              <>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 text-xs">
                  <div>
                    <h4 className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Billed To:</h4>
                    <p className="text-sm font-bold text-slate-200">Flat {billData?.flatNumber}</p>
                    <p className="text-slate-500">{billData?.buildingName} • Wing {billData?.wingName} • Floor {billData?.floorNumber}</p>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Assessment Summary:</h4>
                    <div className="space-y-1.5 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Total Invoice Due:</span>
                        <span className="font-bold text-slate-200">₹ {totalInvoiceDue.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-emerald-400">
                        <span>Paid to Date:</span>
                        <span className="font-bold">₹ {totalPaidSoFar.toLocaleString('en-IN')} ({paidPct}% Paid)</span>
                      </div>
                      <div className="flex justify-between text-amber-400 border-t border-slate-800/80 pt-1">
                        <span>Balance Outstanding:</span>
                        <span className="font-black">₹ {balanceDue.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Itemized Lines */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Invoice Line Items</h4>
                  <div className="overflow-x-auto rounded-lg border border-slate-800">
                    <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                      <thead>
                        <tr className="bg-black/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-800">
                          <th className="p-3">Charge Particulars Description</th>
                          <th className="p-3 text-right">Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {billData?.items.map((item: any) => (
                          <tr key={item.id} className="text-slate-300">
                            <td className="p-3 font-medium">{item.name}</td>
                            <td className="p-3 text-right font-mono">₹ {Number(item.amount).toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-950/50 font-bold border-t border-slate-800">
                          <td className="p-3 text-slate-200">Grand Total Billed</td>
                          <td className="p-3 text-right text-slate-100 font-mono">₹ {totalInvoiceDue.toLocaleString('en-IN')}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Payments Receipt log history */}
                {billData?.receipts.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-slate-800/40">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Receipt className="h-4 w-4 text-emerald-400" /> Cleared Payments History
                      </h4>
                      <span className="text-xs font-semibold text-emerald-400">
                        ₹ {totalPaidSoFar.toLocaleString('en-IN')} paid out of ₹ {totalInvoiceDue.toLocaleString('en-IN')} Total Due
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-slate-800">
                      <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                        <thead>
                          <tr className="bg-black/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-800">
                            <th className="p-3">Receipt Number</th>
                            <th className="p-3">Mode</th>
                            <th className="p-3">Transaction ID</th>
                            <th className="p-3">Date</th>
                            <th className="p-3 text-right">Amount Paid</th>
                            <th className="p-3 text-right">Out of Total Due</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {billData.receipts.map((rec: any) => (
                            <tr key={rec.id} className="text-slate-300">
                              <td className="p-3 font-mono text-slate-500 dark:text-slate-400">{rec.receiptNumber}</td>
                              <td className="p-3">{rec.paymentMode}</td>
                              <td className="p-3 text-slate-500">{rec.transactionId || '-'}</td>
                              <td className="p-3">{rec.paymentDate ? String(rec.paymentDate).substring(0, 10) : 'N/A'}</td>
                              <td className="p-3 text-right font-mono text-emerald-400 font-bold">₹ {Number(rec.amountPaid).toLocaleString('en-IN')}</td>
                              <td className="p-3 text-right text-slate-500 dark:text-slate-400">₹ {Number(rec.amountPaid).toLocaleString('en-IN')} / ₹ {totalInvoiceDue.toLocaleString('en-IN')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Record Payment Receipt Panel */}
        {billData?.status !== 'PAID' && (() => {
          const totalInvoiceDue = Number(billData?.amount || 0);
          const totalPaidSoFar = billData?.receipts?.reduce((acc: number, r: any) => acc + Number(r.amountPaid || 0), 0) || 0;
          const balanceDue = Math.max(0, totalInvoiceDue - totalPaidSoFar);
          const enteredVal = Number(amountPaid || 0);
          const newTotalPaid = totalPaidSoFar + enteredVal;
          const newBalanceDue = Math.max(0, totalInvoiceDue - newTotalPaid);
          const isPartial = newBalanceDue > 0;

          return (
            <form onSubmit={handleRecordPayment} className="space-y-5 max-w-xl bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Record Payment Receipt
                </h3>
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  Balance Due: ₹ {balanceDue.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Total Due & Paid Summary Header Card */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-center text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">Total Billed</span>
                  <span className="font-bold text-slate-900 dark:text-slate-200">₹ {totalInvoiceDue.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">Paid So Far</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">₹ {totalPaidSoFar.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">Remaining Due</span>
                  <span className="font-black text-amber-600 dark:text-amber-400">₹ {balanceDue.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-400 font-medium">Amount Received (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-900 dark:text-slate-200 focus:border-indigo-500 focus:outline-none mt-1 font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-400 font-medium">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-900 dark:text-slate-300 focus:border-indigo-500 focus:outline-none appearance-none mt-1"
                  >
                    <option value="UPI">UPI</option>
                    <option value="NEFT">NEFT / RTGS</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CASH">Cash</option>
                    <option value="CARD">Debit/Credit Card</option>
                  </select>
                </div>
              </div>

              {/* Live Calculation Preview */}
              <div className="bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 p-3 rounded-lg space-y-1.5 text-xs shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">After Logged Payment:</span>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                    isPartial
                      ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/80 text-amber-700 dark:text-amber-400'
                      : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-400'
                  }`}>
                    {isPartial ? 'PARTIAL PAYMENT' : 'FULL PAYMENT'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 text-xs">
                  <span>Total Paid out of Billed Due:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    ₹ {newTotalPaid.toLocaleString('en-IN')} <span className="text-[10px] text-slate-500">out of ₹ {totalInvoiceDue.toLocaleString('en-IN')} Total Due</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 text-xs">
                  <span>Balance Remaining Due:</span>
                  <span className="font-black text-amber-600 dark:text-amber-400">₹ {newBalanceDue.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 font-medium">Transaction ID / Reference Number</label>
                <input
                  type="text"
                  placeholder="UPI Ref, Cheque No, Bank Txn ID"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-900 dark:text-slate-200 focus:border-indigo-500 focus:outline-none mt-1 font-mono"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-slate-100 py-2.5 px-5 text-sm font-semibold transition-all disabled:opacity-55 flex items-center gap-2 shadow-lg"
                >
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Log Payment Receipt
                </button>
              </div>
            </form>
          );
        })()}
      </div>
    </main>
  );
}
