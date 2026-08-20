'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../providers/auth-context';
import { apiClient } from '../../../../lib/api/client';
import { 
  Building, 
  ArrowLeft, 
  Printer, 
  Receipt, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Tag, 
  FileText, 
  FileCheck, 
  CreditCard,
  QrCode,
  Scissors
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type PrintFormat = 'a4_invoice' | 'thermal_pos' | 'a5_voucher' | 'compact_remittance';

function numberToWordsINR(amount: number): string {
  if (!amount || isNaN(amount) || amount <= 0) return 'Zero Rupees Only';
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertGroup = (n: number): string => {
    if (n === 0) return '';
    if (n < 20) return units[n];
    if (n < 100) return `${tens[Math.floor(n / 10)]} ${units[n % 10]}`.trim();
    return `${units[Math.floor(n / 100)]} Hundred ${convertGroup(n % 100)}`.trim();
  };

  const integer = Math.floor(amount);
  const decimals = Math.round((amount - integer) * 100);

  const crore = Math.floor(integer / 10000000);
  const lakh = Math.floor((integer % 10000000) / 100000);
  const thousand = Math.floor((integer % 100000) / 1000);
  const remainder = integer % 1000;

  let str = '';
  if (crore) str += `${convertGroup(crore)} Crore `;
  if (lakh) str += `${convertGroup(lakh)} Lakh `;
  if (thousand) str += `${convertGroup(thousand)} Thousand `;
  if (remainder) str += convertGroup(remainder);

  str = str.trim() ? `${str.trim()} Rupees` : '';
  if (decimals > 0) {
    str += ` and ${convertGroup(decimals)} Paise`;
  }
  return `${str.trim()} Only`;
}

export default function MaintenanceBillDetailPage() {
  const { society_slug, bill_id } = useParams();
  
  const [billData, setBillData] = useState<any>(null);
  const [societyDetails, setSocietyDetails] = useState<any>(null);
  const [selectedFormat, setSelectedFormat] = useState<PrintFormat>('a4_invoice');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Payment Form state
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<string>('UPI');
  const [transactionId, setTransactionId] = useState<string>('');
  const [waiveLateFee, setWaiveLateFee] = useState<boolean>(false);
  const [customLateFee, setCustomLateFee] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState<string>('');

  const fetchBillDetails = async () => {
    if (!bill_id) return;
    try {
      const res = await apiClient.get(`/maintenance/${bill_id}`);
      if (res.data?.success) {
        const data = res.data.data;
        setBillData(data);
        const totalPaid = data.receipts?.reduce((acc: number, r: any) => acc + Number(r.amountPaid), 0) || 0;
        const remaining = Math.max(0, Number(data.amount || 0) - totalPaid);
        const calcFee = Number(data.calculatedLateFee || 0);
        setCustomLateFee(calcFee);
        setAmountPaid(remaining > 0 ? (remaining + calcFee) : Number(data.amount || 0));
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

  useEffect(() => {
    const fetchSocietyProfile = async () => {
      if (!society_slug) return;
      try {
        const res = await apiClient.get(`/societies/slug/${society_slug}`);
        if (res.data?.success) {
          setSocietyDetails(res.data.data);
        }
      } catch (err) {
        // Fallback gracefully
      }
    };
    fetchSocietyProfile();
  }, [society_slug]);

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
      const feeApplied = waiveLateFee ? 0 : Number(customLateFee || 0);
      const feeWaived = waiveLateFee ? Number(billData?.calculatedLateFee || 0) : 0;

      const res = await apiClient.post('/maintenance/receipt', {
        billId: bill_id,
        amountPaid: Number(amountPaid),
        lateFeeApplied: feeApplied,
        lateFeeWaived: feeWaived,
        discountAmount: Number(discountAmount || 0),
        discountReason: discountReason.trim() || null,
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

  const handlePrintInvoice = () => {
    document.body.classList.add('print-invoice-only');
    document.body.classList.add(`print-format-${selectedFormat}`);

    const cleanup = () => {
      document.body.classList.remove('print-invoice-only');
      document.body.classList.remove(`print-format-${selectedFormat}`);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 2500);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#030712]">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  // Pre-calculated financial numbers
  const totalInvoiceDue = Number(billData?.amount || 0);
  const totalPaidSoFar = billData?.receipts?.reduce((acc: number, r: any) => acc + Number(r.amountPaid || 0) - Number(r.lateFeeApplied || 0) + Number(r.discountAmount || 0), 0) || 0;
  const balanceDue = Math.max(0, totalInvoiceDue - totalPaidSoFar);
  const calcLateFee = Number(billData?.calculatedLateFee || 0);
  const isOverdue = billData?.isOverdue && balanceDue > 0;
  const totalPayableNow = balanceDue + (isOverdue ? calcLateFee : 0);
  const paidPct = totalInvoiceDue > 0 ? Math.min(100, Math.round((totalPaidSoFar / totalInvoiceDue) * 100)) : 0;
  const societyName = societyDetails?.name || billData?.societyName || 'Housing Co-Operative Society';
  const societyRegNo = societyDetails?.registrationNumber || 'REG/HSG/2021/MAH';
  const societyGstin = societyDetails?.gstin || '27AAAAA0000A1Z5';
  const societyAddress = societyDetails?.address || 'Main Complex, Society Premises';

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-4xl space-y-6">
        
        {/* Navigation & Print Format Switcher Header (Hidden in Print) */}
        <div className="no-print space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <Link
              href={`/${society_slug}/maintenance`}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-all font-medium"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard ledger
            </Link>

            <button
              onClick={handlePrintInvoice}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-5 text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <Printer className="h-4 w-4" /> Print Document
            </button>
          </div>

          {/* Format Selection Toolbar */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Document Layout:
            </span>
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5">
              {[
                { key: 'a4_invoice', label: 'A4 Tax Invoice', icon: FileText, desc: 'Full-page official invoice' },
                { key: 'thermal_pos', label: 'Thermal (80mm)', icon: Receipt, desc: 'POS Counter slip roll' },
                { key: 'a5_voucher', label: 'A5 Voucher', icon: FileCheck, desc: 'Stamped society receipt' },
                { key: 'compact_remittance', label: 'Remittance Card', icon: Scissors, desc: 'With tear-off stub' },
              ].map((fmt) => {
                const IconComponent = fmt.icon;
                const isActive = selectedFormat === fmt.key;
                return (
                  <button
                    key={fmt.key}
                    type="button"
                    onClick={() => setSelectedFormat(fmt.key as PrintFormat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                    title={fmt.desc}
                  >
                    <IconComponent className="h-3.5 w-3.5" />
                    {fmt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {message && (
          <div
            className={`no-print rounded-xl border p-3 text-xs font-semibold flex items-center gap-2.5 shadow-xs ${
              message.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Dynamic Printable Document Frame */}
        <div id="invoice-print-frame">
          {/* ======================================================== */}
          {/* FORMAT 1: STANDARD EXECUTIVE A4 TAX INVOICE               */}
          {/* ======================================================== */}
          {selectedFormat === 'a4_invoice' && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 p-6 sm:p-8 space-y-6 sm:space-y-8 text-slate-800 dark:text-slate-300 shadow-sm">
              {/* Society & Invoice Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Building className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <h2 className="text-lg font-black uppercase text-slate-900 dark:text-slate-100 tracking-tight">
                      {societyName}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{societyAddress}</p>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Reg No: <span className="font-semibold text-slate-700 dark:text-slate-300">{societyRegNo}</span> • GSTIN: <span className="font-semibold text-slate-700 dark:text-slate-300">{societyGstin}</span>
                  </p>
                </div>

                <div className="text-left sm:text-right space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 block">
                    Maintenance Assessment Tax Invoice
                  </span>
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">{billData?.billNumber}</h3>
                  <div className="pt-1 flex flex-wrap sm:justify-end gap-1.5">
                    <span className={`inline-block text-[10px] font-bold border rounded-full px-3 py-0.5 uppercase tracking-wider ${
                      billData?.status === 'PAID'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-400'
                        : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-400'
                    }`}>
                      {billData?.status ? billData.status.replace('_', ' ') : 'UNPAID'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Due Date: <span className="text-rose-600 dark:text-red-400 font-bold">{billData?.dueDate ? String(billData.dueDate).substring(0, 10) : 'N/A'}</span>
                  </p>
                </div>
              </div>

              {/* Billing Info Grid & Assessment Summary */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 text-xs">
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Billed To:</h4>
                  <p className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                    {billData?.billedToName || billData?.ownerName || 'Flat Owner / Resident'}
                  </p>
                  <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    Flat {billData?.flatNumber}
                    {billData?.wingName && ` (Wing ${billData.wingName})`}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                    {billData?.buildingName && `${billData.buildingName} • `}Floor {billData?.floorNumber ?? 'N/A'}
                  </p>
                  {(billData?.ownerMobile || billData?.ownerEmail) && (
                    <div className="pt-1 text-[11px] text-slate-600 dark:text-slate-400 font-mono space-y-0.5">
                      {billData.ownerMobile && <p>📞 {billData.ownerMobile}</p>}
                      {billData.ownerEmail && <p>✉️ {billData.ownerEmail}</p>}
                    </div>
                  )}
                  {billData?.tenantName && (
                    <div className="pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Occupant/Tenant:</span> {billData.tenantName}
                      {billData.tenantMobile && ` (📞 ${billData.tenantMobile})`}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Assessment Summary:</h4>
                  <div className="space-y-1.5 bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Total Invoice Billed:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-200">₹ {totalInvoiceDue.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                      <span>Paid to Date:</span>
                      <span className="font-bold">₹ {totalPaidSoFar.toLocaleString('en-IN')} ({paidPct}% Paid)</span>
                    </div>
                    <div className="flex justify-between text-amber-700 dark:text-amber-400 border-t border-slate-200 dark:border-slate-800/80 pt-1">
                      <span>Principal Outstanding:</span>
                      <span className="font-black">₹ {balanceDue.toLocaleString('en-IN')}</span>
                    </div>
                    {isOverdue && calcLateFee > 0 && (
                      <div className="flex justify-between text-rose-700 dark:text-rose-400 border-t border-slate-200 dark:border-slate-800/80 pt-1">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Late Fee ({billData?.effectiveOverdueDays} days overdue):</span>
                        <span className="font-bold">+ ₹ {calcLateFee.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-indigo-700 dark:text-indigo-300 font-extrabold border-t border-slate-200 dark:border-slate-800/80 pt-1 text-sm">
                      <span>Total Amount Payable:</span>
                      <span>₹ {totalPayableNow.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Itemized Lines Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Invoice Particulars</h4>
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-black/60 text-slate-700 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                        <th className="p-3">Charge Particulars Description</th>
                        <th className="p-3 text-right">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40">
                      {billData?.items.map((item: any) => (
                        <tr key={item.id} className="text-slate-800 dark:text-slate-300">
                          <td className="p-3 font-medium">{item.name}</td>
                          <td className="p-3 text-right font-mono font-semibold">₹ {Number(item.amount).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 dark:bg-slate-950/50 font-bold border-t border-slate-200 dark:border-slate-800">
                        <td className="p-3 text-slate-900 dark:text-slate-200">Grand Total Billed</td>
                        <td className="p-3 text-right text-slate-900 dark:text-slate-100 font-mono text-sm">₹ {totalInvoiceDue.toLocaleString('en-IN')}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Cleared Payments Receipt log history */}
              {billData?.receipts?.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800/40">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Receipt className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Cleared Payments History
                    </h4>
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      ₹ {totalPaidSoFar.toLocaleString('en-IN')} paid out of ₹ {totalInvoiceDue.toLocaleString('en-IN')} Total Due
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-black/60 text-slate-700 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                          <th className="p-3">Receipt Number</th>
                          <th className="p-3">Mode</th>
                          <th className="p-3">Transaction ID</th>
                          <th className="p-3">Date</th>
                          <th className="p-3 text-right">Amount Paid</th>
                          <th className="p-3 text-right">Late Fee / Discount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40">
                        {billData.receipts.map((rec: any) => (
                          <tr key={rec.id} className="text-slate-800 dark:text-slate-300">
                            <td className="p-3 font-mono text-slate-600 dark:text-slate-400">{rec.receiptNumber}</td>
                            <td className="p-3">{rec.paymentMode}</td>
                            <td className="p-3 text-slate-500">{rec.referenceNumber || rec.transactionId || '-'}</td>
                            <td className="p-3">{rec.paymentDate ? String(rec.paymentDate).substring(0, 10) : 'N/A'}</td>
                            <td className="p-3 text-right font-mono text-emerald-700 dark:text-emerald-400 font-bold">₹ {Number(rec.amountPaid).toLocaleString('en-IN')}</td>
                            <td className="p-3 text-right text-xs">
                              {Number(rec.lateFeeApplied || 0) > 0 && <span className="text-rose-600 dark:text-rose-400 font-semibold block">+₹{rec.lateFeeApplied} late fee</span>}
                              {Number(rec.lateFeeWaived || 0) > 0 && <span className="text-amber-600 dark:text-amber-400 font-semibold block">₹{rec.lateFeeWaived} fee waived</span>}
                              {Number(rec.discountAmount || 0) > 0 && <span className="text-indigo-600 dark:text-indigo-400 font-semibold block">-₹{rec.discountAmount} discount</span>}
                              {!(Number(rec.lateFeeApplied) || Number(rec.lateFeeWaived) || Number(rec.discountAmount)) && <span className="text-slate-500">-</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Terms & Official Signatures Footer */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4 items-end text-[11px] text-slate-500">
                <div>
                  <p className="font-bold text-slate-700 dark:text-slate-300">Payment Instructions:</p>
                  <p>1. Please pay by the due date to avoid automated late fee charges.</p>
                  <p>2. Cheques to be drawn in favor of <span className="font-bold text-slate-800 dark:text-slate-200">"{societyName}"</span>.</p>
                  <p>3. This is an official computer-generated assessment invoice.</p>
                </div>
                <div className="text-right sm:pr-4 pt-6 space-y-1">
                  <div className="h-10 inline-block border-b border-slate-400 w-48 mb-1" />
                  <p className="font-bold text-slate-800 dark:text-slate-200">Authorized Signatory</p>
                  <p className="text-[10px] text-slate-400">For {societyName}</p>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* FORMAT 2: THERMAL POS RECEIPT (80mm Point of Sale Roll)  */}
          {/* ======================================================== */}
          {selectedFormat === 'thermal_pos' && (
            <div className="w-[320px] max-w-full mx-auto bg-white text-slate-900 font-mono text-[11px] p-5 border border-dashed border-slate-400 rounded-xl shadow-md space-y-3 select-none">
              <div className="text-center space-y-0.5 border-b border-dashed border-slate-400 pb-2">
                <h3 className="font-black text-xs uppercase tracking-wider">{societyName}</h3>
                <p className="text-[9px] text-slate-600">{societyAddress}</p>
                <p className="text-[9px]">Reg: {societyRegNo}</p>
                <p className="font-bold text-[10px] uppercase tracking-widest pt-1">*** PAYMENT RECEIPT ***</p>
              </div>

              <div className="space-y-0.5 text-[10px] border-b border-dashed border-slate-400 pb-2">
                <div className="flex justify-between"><span>Bill No:</span><span className="font-bold">{billData?.billNumber}</span></div>
                <div className="flex justify-between"><span>Date:</span><span>{new Date().toLocaleDateString('en-IN')}</span></div>
                <div className="flex justify-between"><span>Flat:</span><span className="font-bold">{billData?.flatNumber} (Wing {billData?.wingName || 'A'})</span></div>
                <div className="flex justify-between"><span>Resident:</span><span className="font-bold truncate max-w-[150px]">{billData?.billedToName || billData?.ownerName || 'Resident'}</span></div>
                <div className="flex justify-between"><span>Period:</span><span>{String(billData?.billingPeriodStart || '').substring(0, 7)}</span></div>
              </div>

              {/* Itemized Table */}
              <div className="border-b border-dashed border-slate-400 pb-2 space-y-1 text-[10px]">
                <div className="flex justify-between font-bold border-b border-slate-300 pb-0.5">
                  <span>PARTICULARS</span>
                  <span>AMOUNT (INR)</span>
                </div>
                {billData?.items.map((item: any) => (
                  <div key={item.id} className="flex justify-between">
                    <span className="truncate max-w-[180px]">{item.name}</span>
                    <span>{Number(item.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-0.5 text-[10px] border-b border-dashed border-slate-400 pb-2">
                <div className="flex justify-between font-bold">
                  <span>GRAND TOTAL:</span>
                  <span>₹ {totalInvoiceDue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>PAID TO DATE:</span>
                  <span className="font-bold text-emerald-700">₹ {totalPaidSoFar.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-black text-xs pt-1 border-t border-slate-300">
                  <span>BALANCE DUE:</span>
                  <span>₹ {totalPayableNow.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[9px] text-slate-600">
                  <span>STATUS:</span>
                  <span className="font-bold uppercase">{billData?.status || 'UNPAID'}</span>
                </div>
              </div>

              {/* Vector Barcode */}
              <div className="text-center pt-1 space-y-1">
                <svg className="h-6 w-44 mx-auto text-slate-900" viewBox="0 0 100 24" preserveAspectRatio="none">
                  <rect x="0" y="0" width="2.5" height="24" fill="currentColor" />
                  <rect x="5" y="0" width="1.5" height="24" fill="currentColor" />
                  <rect x="8" y="0" width="3.5" height="24" fill="currentColor" />
                  <rect x="14" y="0" width="1.5" height="24" fill="currentColor" />
                  <rect x="17" y="0" width="2.5" height="24" fill="currentColor" />
                  <rect x="22" y="0" width="4.5" height="24" fill="currentColor" />
                  <rect x="28" y="0" width="1.5" height="24" fill="currentColor" />
                  <rect x="31" y="0" width="3" height="24" fill="currentColor" />
                  <rect x="36" y="0" width="1.5" height="24" fill="currentColor" />
                  <rect x="39" y="0" width="3.5" height="24" fill="currentColor" />
                  <rect x="45" y="0" width="1.5" height="24" fill="currentColor" />
                  <rect x="48" y="0" width="4.5" height="24" fill="currentColor" />
                  <rect x="55" y="0" width="2.5" height="24" fill="currentColor" />
                  <rect x="59" y="0" width="1.5" height="24" fill="currentColor" />
                  <rect x="62" y="0" width="3.5" height="24" fill="currentColor" />
                  <rect x="68" y="0" width="1.5" height="24" fill="currentColor" />
                  <rect x="71" y="0" width="3" height="24" fill="currentColor" />
                  <rect x="76" y="0" width="4.5" height="24" fill="currentColor" />
                  <rect x="83" y="0" width="1.5" height="24" fill="currentColor" />
                  <rect x="86" y="0" width="2.5" height="24" fill="currentColor" />
                  <rect x="90" y="0" width="4" height="24" fill="currentColor" />
                  <rect x="96" y="0" width="1.5" height="24" fill="currentColor" />
                </svg>
                <p className="text-[8px] text-slate-500 font-mono tracking-widest">{billData?.billNumber}</p>
                <p className="text-[9px] text-slate-600 pt-1">Thank you for your payment!</p>
                <p className="text-[8px] text-slate-400">=== Computer Generated POS Slip ===</p>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* FORMAT 3: OFFICIAL PAYMENT VOUCHER / RECEIPT (A5 Slip)   */}
          {/* ======================================================== */}
          {selectedFormat === 'a5_voucher' && (
            <div className="w-full max-w-2xl mx-auto bg-amber-50/30 dark:bg-slate-900 border-2 border-indigo-900/30 dark:border-indigo-500/40 p-6 rounded-2xl shadow-md space-y-4 text-slate-800 dark:text-slate-200">
              {/* Header Box */}
              <div className="text-center border-b-2 border-indigo-900/20 dark:border-indigo-500/30 pb-3 space-y-0.5">
                <h3 className="text-base font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-400">
                  {societyName}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">{societyAddress}</p>
                <div className="inline-block bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 font-extrabold text-[10px] px-3 py-0.5 rounded-full border border-indigo-300 dark:border-indigo-800 uppercase tracking-widest mt-1">
                  OFFICIAL MAINTENANCE PAYMENT VOUCHER
                </div>
              </div>

              {/* Voucher Meta */}
              <div className="flex justify-between text-xs font-semibold">
                <span>Voucher No: <span className="font-mono text-indigo-700 dark:text-indigo-300 font-bold">{billData?.billNumber}</span></span>
                <span>Date: <span className="font-mono">{new Date().toLocaleDateString('en-IN')}</span></span>
              </div>

              {/* Received With Thanks Content */}
              <div className="bg-white/80 dark:bg-slate-950/60 p-4 rounded-xl border border-indigo-100 dark:border-slate-800 space-y-2.5 text-xs leading-relaxed">
                <p>
                  Received with thanks from <span className="font-extrabold text-slate-900 dark:text-slate-100 underline decoration-indigo-400">{billData?.billedToName || billData?.ownerName || 'Resident'}</span>,
                  resident of <span className="font-bold text-indigo-700 dark:text-indigo-400">Flat No. {billData?.flatNumber}</span> (Wing {billData?.wingName || 'A'}, Floor {billData?.floorNumber || 'N/A'}),
                </p>
                <p>
                  The sum of Rupees <span className="font-bold text-slate-900 dark:text-slate-100 italic bg-amber-100/60 dark:bg-amber-950/40 px-2 py-0.5 rounded">{numberToWordsINR(totalInvoiceDue)}</span>
                </p>
                <p>
                  Towards maintenance assessment charges for the billing period <span className="font-bold font-mono">{String(billData?.billingPeriodStart || '').substring(0, 10)} to {String(billData?.billingPeriodEnd || '').substring(0, 10)}</span>.
                </p>
              </div>

              {/* Amount Box & Stamps */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <div className="inline-flex items-center gap-2 bg-indigo-900 text-white font-mono px-4 py-2 rounded-xl text-base font-black shadow-sm">
                  <span>AMOUNT:</span>
                  <span>₹ {totalInvoiceDue.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex items-center gap-8 text-center text-xs">
                  <div className="border border-dashed border-slate-400 p-2 rounded-lg text-[9px] text-slate-400 uppercase tracking-wider">
                    [ SOCIETY SEAL ]
                  </div>
                  <div>
                    <div className="h-8 border-b border-slate-400 w-28 mb-1" />
                    <span className="font-bold text-[10px]">Hon. Treasurer</span>
                  </div>
                  <div>
                    <div className="h-8 border-b border-slate-400 w-28 mb-1" />
                    <span className="font-bold text-[10px]">Hon. Secretary</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* FORMAT 4: COMPACT REMITTANCE ADVICE CARD (4x6" Stub)     */}
          {/* ======================================================== */}
          {selectedFormat === 'compact_remittance' && (
            <div className="w-full max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl shadow-md overflow-hidden text-slate-800 dark:text-slate-200">
              {/* Upper Section: Resident Bill Statement */}
              <div className="p-5 space-y-3 bg-gradient-to-br from-slate-50 to-indigo-50/30 dark:from-slate-950 dark:to-indigo-950/20">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-black text-sm uppercase text-indigo-900 dark:text-indigo-400">{societyName}</h3>
                    <p className="text-[10px] text-slate-500">Monthly Maintenance Statement</p>
                  </div>
                  <div className="text-right font-mono text-xs">
                    <span className="text-[9px] text-slate-400 block uppercase">Invoice Ref</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{billData?.billNumber}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Resident / Flat</span>
                    <p className="font-bold text-slate-900 dark:text-slate-100">{billData?.billedToName || billData?.ownerName || 'Resident'}</p>
                    <p className="text-indigo-600 dark:text-indigo-400 font-semibold">Flat {billData?.flatNumber} (Wing {billData?.wingName || 'A'})</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block uppercase">Net Amount Due</span>
                    <p className="text-base font-black text-slate-900 dark:text-slate-100">₹ {totalPayableNow.toLocaleString('en-IN')}</p>
                    <p className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">Due by: {String(billData?.dueDate || '').substring(0, 10)}</p>
                  </div>
                </div>
              </div>

              {/* Perforation Divider Line */}
              <div className="relative border-t-2 border-dashed border-slate-300 dark:border-slate-700 py-1 text-center bg-slate-100 dark:bg-slate-800">
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 flex items-center justify-center gap-1">
                  <Scissors className="h-3 w-3 text-slate-400" /> Detach and submit with Cheque/DD
                </span>
              </div>

              {/* Lower Section: Tear-off Remittance Advice Stub */}
              <div className="p-5 space-y-3 bg-white dark:bg-slate-900 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    SOCIETY OFFICE REMITTANCE SLIP
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">{billData?.billNumber}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Flat No</span>
                    <span className="font-bold">{billData?.flatNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Amount</span>
                    <span className="font-bold font-mono">₹ {totalPayableNow.toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Date</span>
                    <span className="font-mono">{new Date().toLocaleDateString('en-IN')}</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1 text-[10px]">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 w-24">Cheque / DD No:</span>
                    <div className="flex-1 border-b border-slate-300 dark:border-slate-700 h-4" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 w-24">Drawn On Bank:</span>
                    <div className="flex-1 border-b border-slate-300 dark:border-slate-700 h-4" />
                  </div>
                  <div className="flex justify-between items-end pt-3">
                    <span className="text-[8px] text-slate-400">Please deposit in Society Cheque Box</span>
                    <div className="text-center">
                      <div className="w-28 border-b border-slate-400 mb-0.5" />
                      <span className="text-[9px] font-semibold">Payer Signature</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* Record Payment Receipt Panel (Hidden in Print)           */}
        {/* ======================================================== */}
        {billData?.status !== 'PAID' && (() => {
          const rawLateFee = Number(billData?.calculatedLateFee || 0);
          const appliedLateFee = waiveLateFee ? 0 : (Number(customLateFee) || 0);
          const discAmt = Number(discountAmount || 0);
          const netPayable = Math.max(0, balanceDue + appliedLateFee - discAmt);
          const principalCleared = Math.max(0, Math.min(balanceDue, Number(amountPaid || 0) - appliedLateFee + discAmt));
          const newBalanceDue = Math.max(0, balanceDue - principalCleared);
          const isPartial = newBalanceDue > 0;

          return (
            <form
              onSubmit={handleRecordPayment}
              className="no-print rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/40 p-6 space-y-4 shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Log Flat Payment Receipt
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Principal Due: <span className="font-bold text-slate-800 dark:text-slate-200">₹ {balanceDue.toLocaleString('en-IN')}</span>
                </span>
              </div>

              {/* Overdue Alert Banner & Late Fee Waiver Controls */}
              {isOverdue && rawLateFee > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 p-3.5 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      Invoice Overdue: +₹{rawLateFee.toLocaleString('en-IN')} Late Penalty Active
                    </span>
                    <label className="flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={waiveLateFee}
                        onChange={(e) => {
                          setWaiveLateFee(e.target.checked);
                          if (e.target.checked) setCustomLateFee(0);
                          else setCustomLateFee(rawLateFee);
                        }}
                        className="rounded border-amber-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      Waive Penalty Fee
                    </label>
                  </div>
                </div>
              )}

              {/* Amount Received & Mode */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-slate-600 dark:text-slate-400 font-medium">Amount Received (₹)</label>
                    <button
                      type="button"
                      onClick={() => setAmountPaid(netPayable)}
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                    >
                      Fill Exact Due (₹{netPayable.toLocaleString('en-IN')})
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-900 dark:text-slate-200 focus:border-indigo-500 focus:outline-none mt-1 font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-400 font-medium">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-900 dark:text-slate-300 focus:border-indigo-500 focus:outline-none appearance-none mt-1"
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
              <div className="bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 p-3 rounded-xl space-y-1.5 text-xs shadow-xs">
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
                  <span>Credit Applied to Invoice Principal:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    ₹ {principalCleared.toLocaleString('en-IN')} {discAmt > 0 ? `(includes ₹${discAmt} discount)` : ''}
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
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-900 dark:text-slate-200 focus:border-indigo-500 focus:outline-none mt-1 font-mono"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-5 text-sm font-semibold transition-all disabled:opacity-55 flex items-center gap-2 shadow-md cursor-pointer active:scale-95"
                >
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Log Payment Receipt
                </button>
              </div>
            </form>
          );
        })()}
      </div>
    </div>
  );
}
