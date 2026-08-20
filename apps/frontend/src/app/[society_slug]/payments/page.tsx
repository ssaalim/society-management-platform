'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/auth-context';
import { apiClient } from '../../../lib/api/client';
import { CreditCard, Search, ShieldAlert, ArrowRight, Loader2, CheckCircle, AlertCircle, RefreshCw, XCircle, ArrowUpRight, Receipt, X } from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';

interface ReceiptItem {
  id: string;
  receiptNumber: string;
  amountPaid: string | number;
  paymentMode: string;
  paymentDate: string;
  referenceNumber: string | null;
  status: 'PENDING' | 'CLEARED' | 'BOUNCED' | 'REFUNDED' | 'CANCELLED' | 'REVIEW' | 'REJECTED' | string;
  refundedAmount: string | number | null;
  cancellationReason: string | null;
  billNumber: string;
  flatNumber: string;
  userRemark?: string | null;
  rejectionReason?: string | null;
  approvedBy?: string | null;
}

export default function PaymentsCheckoutPage() {
  const { society_slug } = useParams();
  const { activeSociety } = useAuth();
  
  const isManagementRole = ['SUPER_ADMIN', 'PRESIDENT', 'SECRETARY', 'TREASURER', 'ACCOUNTANT'].includes(activeSociety?.role || '');
  const [receiptsList, setReceiptsList] = useState<ReceiptItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Cancellation / Refund Modal Form state
  const [actionReceiptId, setActionReceiptId] = useState<string | null>(null);
  const [modalAction, setModalAction] = useState<'refund' | 'cancel' | 'approve' | 'reject' | null>(null);
  const [formReason, setFormReason] = useState<string>('');
  const [formAmount, setFormAmount] = useState<number>(0);

  const searchParams = useSearchParams();
  const [showMyPayments, setShowMyPayments] = useState<boolean>(searchParams.get('mine') === 'true');

  const fetchReceipts = async () => {
    if (!society_slug) return;
    try {
      setIsLoading(true);
      const urlParams = new URLSearchParams();
      if (showMyPayments) urlParams.append('mine', 'true');
      const res = await apiClient.get(`/payments/receipts?${urlParams.toString()}`);
      if (res.data?.success) {
        setReceiptsList(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load receipts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [society_slug, showMyPayments, activeSociety?.societyId]);

  const handleOpenActionModal = (receiptId: string, action: 'refund' | 'cancel' | 'approve' | 'reject', amount: number) => {
    setActionReceiptId(receiptId);
    setModalAction(action);
    setFormAmount(amount);
    setFormReason('');
    setMessage(null);
  };

  const handlePostAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionReceiptId || !modalAction) return;
    if ((modalAction === 'cancel' || modalAction === 'reject') && !formReason) return;
    if (modalAction === 'refund' && formAmount <= 0) return;

    setIsProcessing(true);
    setMessage(null);

    try {
      let endpoint = '';
      let payload: any = {};

      if (modalAction === 'refund') {
        endpoint = `/payments/receipts/${actionReceiptId}/refund`;
        payload = { amount: Number(formAmount), reason: formReason };
      } else if (modalAction === 'cancel') {
        endpoint = `/payments/receipts/${actionReceiptId}/cancel`;
        payload = { reason: formReason };
      } else if (modalAction === 'approve') {
        endpoint = `/maintenance/receipt/${actionReceiptId}/approve`;
      } else if (modalAction === 'reject') {
        endpoint = `/maintenance/receipt/${actionReceiptId}/reject`;
        payload = { reason: formReason };
      }

      const res = await apiClient.post(endpoint, payload);
      if (res.data?.success) {
        setMessage({ type: 'success', text: `Receipt ${modalAction} processed successfully!` });
        setModalAction(null);
        fetchReceipts();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || `Failed to ${modalAction} receipt.` });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-start overflow-x-hidden w-full py-4 sm:py-5 px-3 sm:px-5 lg:px-6">
      {/* Background Grids */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="w-full max-w-[1600px] mx-auto space-y-3.5 z-10">
        
        {/* Header */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Receipt className="h-6 w-6 text-indigo-500 dark:text-indigo-400" />
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Payments Ledger</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Track checkouts, clear online captured webhooks, and issue cancellations or refunds</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center cursor-pointer">
              <div className="relative">
                <input type="checkbox" className="sr-only" checked={showMyPayments} onChange={(e) => setShowMyPayments(e.target.checked)} />
                <div className={`block w-8 h-4.5 rounded-full transition-colors ${showMyPayments ? 'bg-indigo-600' : 'bg-slate-700'}`}></div>
                <div className={`dot absolute left-0.5 top-0.5 bg-white w-3.5 h-3.5 rounded-full transition-transform ${showMyPayments ? 'translate-x-3.5' : ''}`}></div>
              </div>
              <div className="ml-2 text-xs font-semibold text-slate-700 dark:text-slate-300">Show My Payments</div>
            </label>
          </div>
        </div>

        {message && (
          <div
            className={`rounded-xl border p-3 text-sm flex items-center gap-2 shadow-xs ${
              message.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-400'
                : 'bg-rose-50 dark:bg-red-950/30 border-rose-200 dark:border-red-900/50 text-rose-800 dark:text-red-400'
            }`}
          >
            {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {message.text}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 text-indigo-500 animate-spin" />
          </div>
        ) : receiptsList.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
            <ShieldAlert className="h-8 w-8 text-slate-400 dark:text-slate-500 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">No payment receipts logged</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">No online or bank clearing records mapped for this society.</p>
          </div>
        ) : (
          /* Receipts Log List */
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/20 shadow-xs">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 dark:bg-black/60 text-slate-700 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase">
                  <th className="px-3.5 py-2.5">Receipt Number</th>
                  <th className="px-3.5 py-2.5">Flat Number</th>
                  <th className="px-3.5 py-2.5">Invoice Ref</th>
                  <th className="px-3.5 py-2.5">Date</th>
                  <th className="px-3.5 py-2.5">Payment Mode</th>
                  <th className="px-3.5 py-2.5">Txn ID / Ref</th>
                  <th className="px-3.5 py-2.5">Amount Cleared (₹)</th>
                  <th className="px-3.5 py-2.5">Status</th>
                  <th className="px-3.5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                {receiptsList.map((rec) => (
                  <tr key={rec.id} className="text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/10 transition-colors">
                    <td className="px-3.5 py-2.5 font-mono font-bold text-slate-900 dark:text-slate-200">{rec.receiptNumber}</td>
                    <td className="px-3.5 py-2.5 font-semibold text-slate-900 dark:text-slate-200">Flat {rec.flatNumber}</td>
                    <td className="px-3.5 py-2.5 font-mono text-slate-500">{rec.billNumber}</td>
                    <td className="px-3.5 py-2.5 text-slate-500">{rec.paymentDate.substring(0, 10)}</td>
                    <td className="px-3.5 py-2.5">
                      <span className="text-[10px] font-bold border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full px-2 py-0.5">
                        {rec.paymentMode}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-slate-500">{rec.referenceNumber || '-'}</td>
                    <td className="px-3.5 py-2.5 font-bold text-slate-900 dark:text-slate-200">₹ {Number(rec.amountPaid).toLocaleString('en-IN')}</td>
                    <td className="px-3.5 py-2.5">
                      <div className="flex flex-col gap-1">
                        <span className={`text-[10px] font-semibold border rounded-full px-2.5 py-0.5 uppercase tracking-wider w-max ${
                          rec.status === 'CLEARED'
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400'
                            : rec.status === 'REFUNDED'
                            ? 'bg-amber-950/30 border-amber-900/50 text-amber-400'
                            : rec.status === 'REVIEW'
                            ? 'bg-blue-950/30 border-blue-900/50 text-blue-400'
                            : rec.status === 'REJECTED'
                            ? 'bg-red-950/30 border-red-900/50 text-red-500'
                            : 'bg-red-950/30 border-red-900/50 text-red-400'
                        }`}>
                          {rec.status}
                        </span>
                        {rec.userRemark && (
                          <div className="text-[10px] text-slate-400 mt-1 max-w-[150px] truncate" title={rec.userRemark}>
                            <span className="font-bold">Note:</span> {rec.userRemark}
                          </div>
                        )}
                        {rec.rejectionReason && (
                          <div className="text-[10px] text-red-400 max-w-[150px] truncate" title={rec.rejectionReason}>
                            <span className="font-bold">Reject:</span> {rec.rejectionReason}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      {isManagementRole && rec.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleOpenActionModal(rec.id, 'approve', Number(rec.amountPaid))}
                            className="inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg shadow-sm transition-all"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleOpenActionModal(rec.id, 'reject', Number(rec.amountPaid))}
                            className="inline-flex items-center gap-1.5 text-xs font-bold bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg shadow-sm transition-all"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {isManagementRole && rec.status === 'CLEARED' && (
                        <>
                          <button
                            onClick={() => handleOpenActionModal(rec.id, 'refund', Number(rec.amountPaid))}
                            className="inline-flex items-center gap-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg shadow-sm transition-all"
                          >
                            Refund
                          </button>
                          <button
                            onClick={() => handleOpenActionModal(rec.id, 'cancel', Number(rec.amountPaid))}
                            className="inline-flex items-center gap-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg shadow-sm transition-all"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

        {/* Modal Sweep Dialog */}
        {modalAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModalAction(null)} />
            
            {/* Modal Panel */}
            <div className="relative w-full max-w-lg bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

              {/* Header */}
              <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/90 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-600/20 border border-indigo-500/20">
                    <Receipt className="h-5 w-5 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold capitalize text-slate-100">{modalAction} Payment Receipt</h3>
                    <p className="text-[11px] text-slate-500">Post reverse journal voucher and adjust outstanding balances.</p>
                  </div>
                </div>
                <button
                  onClick={() => setModalAction(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto">
                <form id="payment-action-form" onSubmit={handlePostAction} className="space-y-4">
                {modalAction === 'refund' && (
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Refund Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formAmount}
                      onChange={(e) => setFormAmount(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-3 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                      max={receiptsList.find(r => r.id === actionReceiptId)?.amountPaid || 0}
                      required
                    />
                  </div>
                )}
                {(modalAction === 'cancel' || modalAction === 'refund' || modalAction === 'reject') && (
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium capitalize">{modalAction} Reason</label>
                    <textarea
                      rows={3}
                      value={formReason}
                      onChange={(e) => setFormReason(e.target.value)}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-3 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                      required
                    />
                  </div>
                )}
                {modalAction === 'approve' && (
                  <p className="text-sm text-slate-300">Are you sure you want to approve this payment? The ledger will be updated.</p>
                )}
                </form>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-800 bg-slate-950 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalAction(null)}
                  className="rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-4 text-xs font-semibold text-slate-500 hover:bg-slate-900 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="payment-action-form"
                  disabled={isProcessing}
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-slate-100 py-2 px-6 text-xs font-semibold disabled:opacity-55 transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20"
                >
                  {isProcessing ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</> : 'Confirm Action'}
                </button>
              </div>
            </div>
          </div>
        )}
    </main>
  );
}
