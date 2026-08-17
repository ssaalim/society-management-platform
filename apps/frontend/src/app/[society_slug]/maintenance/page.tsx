'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/auth-context';
import { apiClient } from '../../../lib/api/client';
import { Building, Search, Filter, ShieldAlert, Plus, Calculator, Settings, Receipt, Loader2, CheckCircle, AlertCircle, Calendar, History, CheckSquare, Square, Layers, X, ArrowRight, CreditCard, Clock } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';

interface LastPaymentInfo {
  id?: string;
  receiptNumber: string;
  billNumber?: string;
  monthYear?: string;
  paymentType?: 'FULL' | 'PARTIAL';
  amountPaid: string;
  totalBillAmount?: string;
  paymentMode: string;
  referenceNumber?: string;
  paymentDate: string;
}

interface BillListItem {
  id: string;
  billNumber: string;
  flatNumber: string;
  buildingName: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  amount: string;
  status: 'UNPAID' | 'PAID' | 'PARTIAL' | 'OVERDUE';
  totalPaid?: string;
  remainingBalance?: string;
  lastPayment?: LastPaymentInfo | null;
  recentReceipts?: LastPaymentInfo[];
}


interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  isDefault: boolean;
}

export default function MaintenanceDashboardPage() {

  const { society_slug } = useParams();
  const { activeSociety } = useAuth();

  const isManagementRole = ['SUPER_ADMIN', 'PRESIDENT', 'SECRETARY', 'TREASURER', 'ACCOUNTANT'].includes(activeSociety?.role || '');

  const [billsList, setBillsList] = useState<BillListItem[]>([]);
  const searchParams = useSearchParams();
  const [showMyInvoices, setShowMyInvoices] = useState<boolean>(searchParams.get('mine') === 'true');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [activeView, setActiveView] = useState<'bills' | 'society_dues' | 'generate' | 'settings'>('bills');
  const [societyDuesList, setSocietyDuesList] = useState<any[]>([]);
  const [isDuesLoading, setIsDuesLoading] = useState<boolean>(false);
  const [duesSearchTerm, setDuesSearchTerm] = useState<string>('');

  // Multi-invoice selection state
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>([]);
  const [isBulkPaymentModalOpen, setIsBulkPaymentModalOpen] = useState<boolean>(false);

  // Record Single Payment Modal state
  const [selectedBillForPayment, setSelectedBillForPayment] = useState<BillListItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<string>('UPI');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [userRemark, setUserRemark] = useState<string>('');

  // Multi-invoice payment state
  const [bulkPaymentAmount, setBulkPaymentAmount] = useState<number>(0);
  const [bulkPaymentMode, setBulkPaymentMode] = useState<string>('UPI');
  const [bulkTransactionRef, setBulkTransactionRef] = useState<string>('');
  const [bulkPaymentDate, setBulkPaymentDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [bulkUserRemark, setBulkUserRemark] = useState<string>('');

  // Sweep Form state
  const [periodStart, setPeriodStart] = useState<string>('');
  const [periodEnd, setPeriodEnd] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [generationType, setGenerationType] = useState<'SINGLE' | 'PER_MONTH'>('SINGLE');

  // Settings formula state
  const [formulaString, setFormulaString] = useState<string>('(area * rate) + parking + water');

  // Filters state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [depositAccountId, setDepositAccountId] = useState<string>('');
  const [bulkDepositAccountId, setBulkDepositAccountId] = useState<string>('');


  const fetchBankAccounts = async () => {
    if (!activeSociety?.societyId) return;
    try {
      const res = await apiClient.get(`/societies/${activeSociety.societyId}/bank-accounts`);
      if (res.data?.success) {
        setBankAccounts(res.data.data);
        const defaultAcc = res.data.data.find((a: any) => a.isDefault);
        if (defaultAcc) {
          setDepositAccountId(defaultAcc.id);
          setBulkDepositAccountId(defaultAcc.id);
        } else if (res.data.data.length > 0) {
          setDepositAccountId(res.data.data[0].id);
          setBulkDepositAccountId(res.data.data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load bank accounts:', err);
    }
  };

  const fetchBills = async () => {
    if (!society_slug) return;
    try {
      setIsLoading(true);
      const urlParams = new URLSearchParams();
      if (searchTerm) urlParams.append('search', searchTerm);
      if (statusFilter) urlParams.append('status', statusFilter);
      if (showMyInvoices) urlParams.append('mine', 'true');

      const res = await apiClient.get(`/maintenance?${urlParams.toString()}`);
      if (res.data?.success) {
        setBillsList(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load bills:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSocietyDues = async () => {
    if (!society_slug) return;
    try {
      setIsDuesLoading(true);
      const res = await apiClient.get('/maintenance/society-dues');
      if (res.data?.success) {
        setSocietyDuesList(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load society dues transparency:', err);
    } finally {
      setIsDuesLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
    fetchBankAccounts();
    if (activeView === 'society_dues') {
      fetchSocietyDues();
    }
  }, [society_slug, searchTerm, statusFilter, showMyInvoices, activeSociety?.societyId, activeView]);

  // Resolved active selected flat number if any invoice is checked
  const firstSelectedBill = billsList.find((b) => selectedBillIds.includes(b.id));
  const selectedFlatNumber = firstSelectedBill ? firstSelectedBill.flatNumber : null;

  const handleToggleSelectBill = (bill: BillListItem) => {
    if (selectedBillIds.includes(bill.id)) {
      setSelectedBillIds(selectedBillIds.filter((bId) => bId !== bill.id));
    } else {
      if (selectedFlatNumber && bill.flatNumber !== selectedFlatNumber) {
        return; // Restricted to same flat
      }
      setSelectedBillIds([...selectedBillIds, bill.id]);
    }
  };

  const handleSelectAllPending = () => {
    if (selectedBillIds.length > 0) {
      setSelectedBillIds([]);
      return;
    }
    const firstUnpaid = billsList.find((b) => b.status !== 'PAID');
    if (!firstUnpaid) return;
    const sameFlatUnpaidIds = billsList
      .filter((b) => b.status !== 'PAID' && b.flatNumber === firstUnpaid.flatNumber)
      .map((b) => b.id);
    setSelectedBillIds(sameFlatUnpaidIds);
  };

  const handleOpenSinglePaymentModal = (bill: BillListItem) => {
    setSelectedBillForPayment(bill);
    const remaining = bill.remainingBalance ? Number(bill.remainingBalance) : Number(bill.amount);
    setPaymentAmount(remaining);
    setPaymentMode('UPI');
    setTransactionRef('');
    setPaymentDate(new Date().toISOString().substring(0, 10));
    setUserRemark('');
  };

  const handleOpenBulkPaymentModal = () => {
    const selectedBills = billsList.filter((b) => selectedBillIds.includes(b.id));
    const totalDue = selectedBills.reduce(
      (sum, b) => sum + (b.remainingBalance ? Number(b.remainingBalance) : Number(b.amount)),
      0
    );
    setBulkPaymentAmount(totalDue);
    setBulkPaymentMode('UPI');
    setBulkTransactionRef('');
    setBulkPaymentDate(new Date().toISOString().substring(0, 10));
    setBulkUserRemark('');
    setIsBulkPaymentModalOpen(true);
  };

  const handleSinglePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBillForPayment || paymentAmount <= 0) return;

    setIsProcessing(true);
    setMessage(null);

    try {
      const res = await apiClient.post('/maintenance/receipt', {
        billId: selectedBillForPayment.id,
        amountPaid: Number(paymentAmount),
        paymentMode,
        transactionId: transactionRef || null,
        depositAccountId: paymentMode !== 'CASH' && depositAccountId ? depositAccountId : null,
        paymentDate,
        userRemark,
      });

      if (res.data?.success) {
        const isPartial = res.data.data.status === 'PARTIAL';
        setMessage({
          type: 'success',
          text: 'Payment receipt submitted successfully! If you are a resident, it is pending review.',
        });
        setSelectedBillForPayment(null);
        fetchBills();
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to post receipt.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBillIds.length === 0 || bulkPaymentAmount <= 0) return;

    setIsProcessing(true);
    setMessage(null);

    try {
      const res = await apiClient.post('/maintenance/bulk-receipt', {
        billIds: selectedBillIds,
        amountPaid: Number(bulkPaymentAmount),
        paymentMode: bulkPaymentMode,
        transactionId: bulkTransactionRef || null,
        depositAccountId: bulkPaymentMode !== 'CASH' && bulkDepositAccountId ? bulkDepositAccountId : null,
        paymentDate: bulkPaymentDate,
        userRemark: bulkUserRemark,
      });

      if (res.data?.success) {
        setMessage({
          type: 'success',
          text: `Bulk payment of ₹${bulkPaymentAmount} successfully applied across ${res.data.data.receiptsCreated} invoices!`,
        });
        setIsBulkPaymentModalOpen(false);
        setSelectedBillIds([]);
        fetchBills();
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to process bulk payment.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateInvoices = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodStart || !periodEnd || !dueDate) {
      setMessage({ type: 'error', text: 'All sweep dates must be filled.' });
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    try {
      const res = await apiClient.post('/maintenance/generate', {
        periodStart,
        periodEnd,
        dueDate,
        generationType,
      });

      if (res.data?.success) {
        setMessage({
          type: 'success',
          text: `Invoices generated successfully for ${res.data.data.count} flats.`
        });
        setActiveView('bills');
        fetchBills();
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to generate sweep.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Maintenance Calculation Mode Config State
  const [calculationType, setCalculationType] = useState<string>('PER_SQ_FT');
  const [perSqFtRate, setPerSqFtRate] = useState<string>('3.50');
  const [sqftAreaType, setSqftAreaType] = useState<'SUPER_BUILTUP' | 'CARPET_AREA'>('SUPER_BUILTUP');
  const [flatRateSameForAll, setFlatRateSameForAll] = useState<string>('2500.00');
  const [flatTypes, setFlatTypes] = useState<string[]>(['1BHK', '2BHK', '3BHK', '4BHK', 'Penthouse', 'Shop']);
  const [newTypeName, setNewTypeName] = useState<string>('');
  const [newTypeRate, setNewTypeRate] = useState<string>('3000');
  const [perFlatTypeRates, setPerFlatTypeRates] = useState<{ [key: string]: number }>({
    '1BHK': 1500,
    '2BHK': 2500,
    '3BHK': 3500,
    '4BHK': 4500,
    'Penthouse': 5500,
    'Shop': 4000,
  });

  // Late Fees & Penalty Policy State
  const [penaltyType, setPenaltyType] = useState<string>('PERCENTAGE');
  const [penaltyInterestRate, setPenaltyInterestRate] = useState<string>('12.00');
  const [penaltyFlatAmount, setPenaltyFlatAmount] = useState<string>('200.00');
  const [penaltyGracePeriodDays, setPenaltyGracePeriodDays] = useState<number>(0);

  const handleAddFlatType = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTypeName.trim();
    if (!trimmed) return;
    if (!flatTypes.includes(trimmed)) {
      setFlatTypes([...flatTypes, trimmed]);
      setPerFlatTypeRates({
        ...perFlatTypeRates,
        [trimmed]: Number(newTypeRate) || 0,
      });
    }
    setNewTypeName('');
    setNewTypeRate('3000');
  };

  const handleRemoveFlatType = (fType: string) => {
    if (flatTypes.length <= 1) {
      alert('Society must have at least one unit type.');
      return;
    }
    setFlatTypes(flatTypes.filter((t) => t !== fType));
    const copy = { ...perFlatTypeRates };
    delete copy[fType];
    setPerFlatTypeRates(copy);
  };

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await apiClient.get('/maintenance/config');
        if (res.data?.success) {
          const cfg = res.data.data;
          if (cfg.calculationType) setCalculationType(cfg.calculationType);
          if (cfg.perSqFtRate) setPerSqFtRate(String(cfg.perSqFtRate));
          if (cfg.sqftAreaType) setSqftAreaType(cfg.sqftAreaType);
          if (cfg.flatRateSameForAll) setFlatRateSameForAll(String(cfg.flatRateSameForAll));
          if (cfg.flatTypes && Array.isArray(cfg.flatTypes)) setFlatTypes(cfg.flatTypes);
          if (cfg.perFlatTypeRates) setPerFlatTypeRates(cfg.perFlatTypeRates);
          if (cfg.maintenanceFormula) setFormulaString(cfg.maintenanceFormula);
          if (cfg.penaltyType) setPenaltyType(cfg.penaltyType);
          if (cfg.penaltyInterestRate) setPenaltyInterestRate(String(cfg.penaltyInterestRate));
          if (cfg.penaltyFlatAmount) setPenaltyFlatAmount(String(cfg.penaltyFlatAmount));
          if (cfg.penaltyGracePeriodDays !== undefined) setPenaltyGracePeriodDays(Number(cfg.penaltyGracePeriodDays));
        }
      } catch (e) {
        console.error('Failed to load maintenance config', e);
      }
    };
    if (society_slug) fetchConfig();
  }, [society_slug]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setMessage(null);
    try {
      const res = await apiClient.post('/maintenance/config', {
        calculationType,
        perSqFtRate,
        sqftAreaType,
        flatRateSameForAll,
        flatTypes,
        perFlatTypeRates,
        maintenanceFormula: formulaString,
        penaltyType,
        penaltyInterestRate,
        penaltyFlatAmount,
        penaltyGracePeriodDays,
      });
      if (res.data?.success) {
        setMessage({ type: 'success', text: 'Maintenance calculation mode, formula builder & late fee policy updated successfully!' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to update maintenance calculation configuration.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const getReferencePlaceholder = (mode: string) => {
    switch (mode) {
      case 'UPI': return 'e.g. UPI/928374829101 or GPay Reference';
      case 'NEFT': return 'e.g. UTR12984719283 Bank Reference';
      case 'CHEQUE': return 'e.g. Cheque No. CHQ-849201 HDFC Bank';
      case 'CASH': return 'e.g. Cash Memo #4092 (Handed to Accountant)';
      case 'CARD': return 'e.g. POS Transaction Auth #9821';
      default: return 'Transaction Reference Number';
    }
  };

  const selectedBillsData = billsList.filter((b) => selectedBillIds.includes(b.id));
  const totalSelectedDue = selectedBillsData.reduce(
    (sum, b) => sum + (b.remainingBalance ? Number(b.remainingBalance) : Number(b.amount)),
    0
  );

  return (
    <main className="min-h-screen w-full bg-slate-950 text-slate-100 p-4 sm:p-6 md:p-8 lg:p-10">
      <div className="w-full max-w-[1450px] mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="h-8 w-8 text-indigo-400" />
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-100">Billing & Maintenance Portal</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Manage billing cycles, record single/multi-invoice payments, track part payments, and audit double-entry ledger postings</p>
            </div>
          </div>

          {/* Action Tabs for Management and Residents */}
          <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl overflow-x-auto">
            <button
              onClick={() => setActiveView('bills')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeView === 'bills'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {isManagementRole ? 'Invoices & Receipts' : 'My Invoices'}
            </button>
            <button
              onClick={() => {
                setActiveView('society_dues');
                fetchSocietyDues();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
                activeView === 'society_dues'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building className="h-3.5 w-3.5" /> Society Outstanding Dues
            </button>
            {isManagementRole && (
              <>
                <button
                  onClick={() => setActiveView('generate')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeView === 'generate'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Calculator className="h-3.5 w-3.5 inline mr-1" /> Batch Billing Sweep
                </button>
                <button
                  onClick={() => setActiveView('settings')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeView === 'settings'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Settings className="h-3.5 w-3.5 inline mr-1" /> Formula & Late Fees
                </button>
              </>
            )}
          </div>
        </div>

        {/* Global Feedback Banner */}
        {message && (
          <div
            className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-medium ${message.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-900/60 text-emerald-300'
                : 'bg-red-950/40 border-red-900/60 text-red-300'
              }`}
          >
            {message.type === 'success' ? <CheckCircle className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Multi-Invoice Bulk Action Bar */}
        {selectedBillIds.length > 0 && activeView === 'bills' && (
          <div className="bg-indigo-950/60 border border-indigo-900/60 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in duration-150 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                {selectedBillIds.length}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5 text-indigo-400" /> Flat {selectedFlatNumber} — {selectedBillIds.length} Invoices Selected for Lump-Sum Payment
                </p>
                <p className="text-[11px] text-indigo-300 mt-0.5">
                  Combined Total Due: <span className="font-bold text-white">₹ {totalSelectedDue.toLocaleString('en-IN')}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedBillIds([])}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold"
              >
                Deselect All
              </button>
              <button
                onClick={handleOpenBulkPaymentModal}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
              >
                <Receipt className="h-4 w-4" /> Record Multi-Invoice Payment (₹ {totalSelectedDue.toLocaleString('en-IN')})
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        {activeView === 'bills' && (
          <div className="space-y-4">

            {/* Filter Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-950/40 p-3 border border-slate-800 rounded-xl">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search flat number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-800 bg-slate-900/60 text-xs text-slate-200 focus:outline-none focus:border-slate-700"
                />
              </div>

              <div className="flex items-center gap-4 w-full sm:w-auto">
                <label className="flex items-center cursor-pointer border-r border-slate-700 pr-4">
                  <div className="relative">
                    <input type="checkbox" className="sr-only" checked={showMyInvoices} onChange={(e) => setShowMyInvoices(e.target.checked)} />
                    <div className={`block w-9 h-5 rounded-full transition-colors ${showMyInvoices ? 'bg-indigo-600' : 'bg-slate-700'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform ${showMyInvoices ? 'translate-x-4' : ''}`}></div>
                  </div>
                  <div className="ml-2 text-[11px] font-bold text-slate-300">Show My Bills</div>
                </label>
                <Filter className="h-4 w-4 text-slate-500 hidden sm:inline" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full sm:w-44 py-2 px-3 rounded-lg border border-slate-800 bg-slate-900/60 text-xs text-slate-300 focus:outline-none appearance-none"
                >
                  <option value="">All Statuses</option>
                  <option value="UNPAID">UNPAID</option>
                  <option value="PARTIAL">PARTIAL</option>
                  <option value="OVERDUE">OVERDUE</option>
                  <option value="PAID">PAID</option>
                </select>
              </div>
            </div>

            {/* Invoices List Table */}
            {isLoading ? (
              <div className="flex justify-center items-center py-16 text-slate-500">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : billsList.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-slate-800 rounded-xl">
                <Building className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No maintenance bills found</p>
                <p className="text-xs text-slate-600 mt-1">Run a batch sweep or adjust filters to view invoice records.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/20">
                <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-black/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-800">
                      <th className="p-4 w-10">
                        <button
                          onClick={handleSelectAllPending}
                          title={
                            selectedFlatNumber
                              ? `Select all unpaid invoices for Flat ${selectedFlatNumber}`
                              : 'Select all unpaid invoices for first flat'
                          }
                          className="text-slate-500 dark:text-slate-400 hover:text-indigo-400"
                        >
                          <Layers className="h-4 w-4" />
                        </button>
                      </th>
                      <th className="p-4">Invoice No</th>
                      <th className="p-4">Flat Number</th>
                      <th className="p-4">Period</th>
                      <th className="p-4">Due Date</th>
                      <th className="p-4">Total Bill (₹)</th>
                      <th className="p-4">Paid / Balance (₹)</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {billsList.map((bill) => {
                      const isChecked = selectedBillIds.includes(bill.id);
                      const isFlatDisabled = !!selectedFlatNumber && bill.flatNumber !== selectedFlatNumber;
                      const paidAmount = Number(bill.totalPaid || 0);
                      const remBalance = bill.remainingBalance ? Number(bill.remainingBalance) : Number(bill.amount);

                      return (
                        <tr
                          key={bill.id}
                          className={`text-slate-300 transition-colors ${isChecked
                              ? 'bg-indigo-950/30'
                              : isFlatDisabled
                                ? 'opacity-40 bg-slate-950/40'
                                : 'hover:bg-slate-900/10'
                            }`}
                        >
                          <td className="p-4">
                            {bill.status !== 'PAID' ? (
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={isFlatDisabled}
                                onChange={() => handleToggleSelectBill(bill)}
                                title={
                                  isFlatDisabled
                                    ? `Multi-invoice payment restricted to Flat ${selectedFlatNumber}`
                                    : `Select invoice for Flat ${bill.flatNumber}`
                                }
                                className={`h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 ${isFlatDisabled ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'
                                  }`}
                              />
                            ) : (
                              <CheckCircle className="h-4 w-4 text-emerald-500 opacity-60" />
                            )}
                          </td>
                          <td className="p-4 font-mono text-slate-500 dark:text-slate-400">{bill.billNumber}</td>
                          <td className="p-4 font-bold text-slate-200">
                            Flat {bill.flatNumber} <span className="text-[10px] text-slate-500 font-normal">({bill.buildingName})</span>
                          </td>
                          <td className="p-4 text-slate-500 dark:text-slate-400">
                            {bill.periodStart.substring(0, 7)}
                          </td>
                          <td className="p-4 text-red-400/80">{bill.dueDate.substring(0, 10)}</td>
                          <td className="p-4 font-bold text-slate-200">
                            ₹ {Number(bill.amount).toLocaleString('en-IN')}
                          </td>
                          <td className="p-4">
                            <span className="font-semibold text-emerald-400">₹ {paidAmount.toLocaleString('en-IN')}</span>
                            {remBalance > 0 && bill.status !== 'PAID' && (
                              <span className="block text-[10px] text-amber-400 font-semibold mt-0.5">
                                Due: ₹ {remBalance.toLocaleString('en-IN')}
                              </span>
                            )}
                          </td>
                          <td className="p-4">
                            <span
                              className={`text-[10px] font-bold border rounded-full px-2.5 py-1 uppercase tracking-wider ${bill.status === 'PAID'
                                  ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400'
                                  : bill.status === 'PARTIAL'
                                    ? 'bg-amber-950/30 border-amber-900/50 text-amber-400'
                                    : 'bg-red-950/30 border-red-900/50 text-red-400'
                                }`}
                            >
                              {bill.status}
                            </span>
                          </td>
                          <td className="p-4 text-right space-x-2">
                            {bill.status !== 'PAID' && (
                              <button
                                onClick={() => handleOpenSinglePaymentModal(bill)}
                                className="inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg shadow-sm transition-all"
                              >
                                <Receipt className="h-3.5 w-3.5" /> Record Payment
                              </button>
                            )}
                            {(isManagementRole || bill.status === 'PAID' || bill.status === 'PARTIAL') && (
                              <Link
                                href={`/${society_slug}/maintenance/${bill.id}`}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-all"
                              >
                                Open Invoice <ArrowRight className="h-3.5 w-3.5" />
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Society Outstanding Dues (Statutory Transparency View for all members) */}
        {activeView === 'society_dues' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Legal Notice Banner */}
            <div className="p-4 rounded-xl border border-indigo-900/60 bg-indigo-950/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-100 flex items-center gap-2">
                    Statutory Transparency Roster
                    <span className="text-[10px] bg-indigo-900/80 text-indigo-300 px-2 py-0.2 rounded-full font-bold">
                      MCS & RWA Compliant
                    </span>
                  </h4>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    As mandated by housing society regulations, all members have the right to view the society-wide pending maintenance dues roster by flat.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300">
                <span>Total Flats with Dues:</span>
                <strong className="text-amber-400">{societyDuesList.length}</strong>
              </div>
            </div>

            {/* Filter Search */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-950/40 p-3 border border-slate-800 rounded-xl">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search flat number or tower..."
                  value={duesSearchTerm}
                  onChange={(e) => setDuesSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-800 bg-slate-900/60 text-xs text-slate-200 focus:outline-none focus:border-slate-700"
                />
              </div>

              <div className="text-xs text-slate-400">
                Showing {
                  societyDuesList.filter((d) =>
                    !duesSearchTerm ||
                    d.flatNumber.toLowerCase().includes(duesSearchTerm.toLowerCase()) ||
                    d.buildingName.toLowerCase().includes(duesSearchTerm.toLowerCase())
                  ).length
                } units
              </div>
            </div>

            {/* Dues Transparency Table */}
            {isDuesLoading ? (
              <div className="flex justify-center items-center py-16 text-slate-500">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              </div>
            ) : societyDuesList.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-slate-800 rounded-xl space-y-2">
                <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto" />
                <h3 className="text-sm font-bold text-slate-200">Zero Outstanding Dues!</h3>
                <p className="text-xs text-slate-500">All flats in the society currently have their maintenance accounts cleared.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/20 shadow-sm">
                <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-black/60 text-slate-400 font-semibold border-b border-slate-800">
                      <th className="p-4">Flat & Location</th>
                      <th className="p-4">Unit Type</th>
                      <th className="p-4">Occupancy</th>
                      <th className="p-4">Unpaid Invoices</th>
                      <th className="p-4">Oldest Due Date</th>
                      <th className="p-4">Total Pending Dues (₹)</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {societyDuesList
                      .filter((d) =>
                        !duesSearchTerm ||
                        d.flatNumber.toLowerCase().includes(duesSearchTerm.toLowerCase()) ||
                        d.buildingName.toLowerCase().includes(duesSearchTerm.toLowerCase())
                      )
                      .map((item) => (
                        <tr key={item.flatId} className="text-slate-300 hover:bg-slate-900/20 transition-colors">
                          <td className="p-4 font-bold text-slate-200">
                            <span className="text-sm">Flat {item.flatNumber}</span>
                            <div className="text-[10px] font-normal text-slate-500 mt-0.5">
                              {item.buildingName} • {item.wingName} • Floor {item.floorNumber}
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300 font-semibold text-[10px]">
                              {item.flatType} ({item.sqftArea} sq ft)
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              item.occupancyStatus === 'OCCUPIED'
                                ? 'bg-emerald-950/40 border-emerald-900/60 text-emerald-300'
                                : 'bg-slate-900 border-slate-800 text-slate-400'
                            }`}>
                              {item.occupancyStatus}
                            </span>
                          </td>
                          <td className="p-4 font-mono font-semibold text-slate-300">
                            {item.unpaidInvoicesCount} invoice{item.unpaidInvoicesCount > 1 ? 's' : ''}
                          </td>
                          <td className="p-4 font-mono text-slate-400 text-[11px]">
                            {item.oldestDueDate || '—'}
                          </td>
                          <td className="p-4 font-bold font-mono text-amber-300 text-sm">
                            ₹ {Number(item.totalPendingAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-4">
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider ${
                              item.status === 'OVERDUE'
                                ? 'bg-red-950/50 border-red-800 text-red-400'
                                : 'bg-amber-950/50 border-amber-800 text-amber-400'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Generate Sweep Form */}
        {activeView === 'generate' && (
          <form onSubmit={handleGenerateInvoices} className="space-y-6 max-w-xl bg-slate-950/20 border border-slate-800 p-6 rounded-xl">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Generate Invoices Sweep</h3>
            <p className="text-xs text-slate-500">Run a batch sweep operation. This automatically computes maintenance variables for all flats and logs double-entry receivables postings.</p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Billing Period Start</label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Billing Period End</label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Invoice Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                required
              />
            </div>

            <div className="flex justify-end">
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 font-medium">Generation Type</label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="generationType"
                      value="SINGLE"
                      checked={generationType === 'SINGLE'}
                      onChange={() => setGenerationType('SINGLE')}
                      className="accent-indigo-500"
                    />
                    <span>Single Combined Invoice</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="generationType"
                      value="PER_MONTH"
                      checked={generationType === 'PER_MONTH'}
                      onChange={() => setGenerationType('PER_MONTH')}
                      className="accent-indigo-500"
                    />
                    <span>Separate Invoice per Month</span>
                  </label>
                </div>
              </div>
              <button
                type="submit"
                disabled={isProcessing}
                className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-slate-100 py-2 px-5 text-sm font-semibold transition-all disabled:opacity-55 flex items-center gap-2"
              >
                {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                Generate Batch Sweeps
              </button>
            </div>
          </form>
        )}

        {/* Maintenance Calculation Mode Setup */}
        {activeView === 'settings' && (
          <form onSubmit={handleSaveSettings} className="space-y-6 max-w-3xl bg-slate-950/40 border border-slate-800 p-6 rounded-2xl">
            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Settings className="h-5 w-5 text-indigo-400" /> Maintenance Calculation Mode Configuration
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Configure how monthly maintenance is calculated across society housing units. Restricted strictly to President, Secretary, Treasurer & Accountant roles.
              </p>
            </div>

            {/* Mode Selectors */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Option 1: PER_SQ_FT */}
              <div
                onClick={() => setCalculationType('PER_SQ_FT')}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all space-y-2 relative ${calculationType === 'PER_SQ_FT'
                    ? 'bg-indigo-50 border-indigo-600 text-slate-900 shadow-lg ring-2 ring-indigo-600 dark:bg-indigo-950/50 dark:border-indigo-500 dark:text-slate-100 dark:ring-indigo-500'
                    : 'bg-white dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Mode 1</span>
                  <div className="flex items-center gap-1.5">
                    {calculationType === 'PER_SQ_FT' && <CheckCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
                    <span className="text-sm">📏</span>
                  </div>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-200">Per Sq. Ft. Rate</h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Calculated based on the area of each flat (Area × Rate per Sq. Ft.)
                </p>
              </div>

              {/* Option 2: PER_FLAT_TYPE */}
              <div
                onClick={() => setCalculationType('PER_FLAT_TYPE')}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all space-y-2 relative ${calculationType === 'PER_FLAT_TYPE'
                    ? 'bg-indigo-50 border-indigo-600 text-slate-900 shadow-lg ring-2 ring-indigo-600 dark:bg-indigo-950/50 dark:border-indigo-500 dark:text-slate-100 dark:ring-indigo-500'
                    : 'bg-white dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Mode 2</span>
                  <div className="flex items-center gap-1.5">
                    {calculationType === 'PER_FLAT_TYPE' && <CheckCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
                    <span className="text-sm">🏢</span>
                  </div>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-200">Per Flat Type</h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Different fixed rates per flat type (1BHK, 2BHK, 3BHK, Shop, etc.)
                </p>
              </div>

              {/* Option 3: FLAT_RATE_SAME_FOR_ALL */}
              <div
                onClick={() => setCalculationType('FLAT_RATE_SAME_FOR_ALL')}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all space-y-2 relative ${calculationType === 'FLAT_RATE_SAME_FOR_ALL'
                    ? 'bg-indigo-50 border-indigo-600 text-slate-900 shadow-lg ring-2 ring-indigo-600 dark:bg-indigo-950/50 dark:border-indigo-500 dark:text-slate-100 dark:ring-indigo-500'
                    : 'bg-white dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Mode 3</span>
                  <div className="flex items-center gap-1.5">
                    {calculationType === 'FLAT_RATE_SAME_FOR_ALL' && <CheckCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
                    <span className="text-sm">⚖️</span>
                  </div>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-200">Same For All Flats</h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Uniform fixed maintenance fee charged equally to all flat units.
                </p>
              </div>
            </div>

            {/* Dynamic Inputs Based on Selected Mode */}
            <div className="bg-slate-950/60 border border-slate-800/80 p-5 rounded-xl space-y-4">
              {calculationType === 'PER_SQ_FT' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300">Rate Per Sq. Ft. (₹)</label>
                    <div className="relative max-w-xs">
                      <span className="absolute left-3.5 top-2.5 text-sm font-bold text-slate-500">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        value={perSqFtRate}
                        onChange={(e) => setPerSqFtRate(e.target.value)}
                        className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 pl-8 pr-4 text-sm text-slate-100 font-bold focus:border-slate-700 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Option to calculate by Super Built-up vs Carpet Area */}
                  <div className="space-y-2 pt-2 border-t border-slate-800/60">
                    <label className="text-xs font-semibold text-slate-300">Area Basis For Calculation</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                      <button
                        type="button"
                        onClick={() => setSqftAreaType('SUPER_BUILTUP')}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          sqftAreaType === 'SUPER_BUILTUP'
                            ? 'bg-indigo-950/60 border-indigo-500 text-slate-100 ring-1 ring-indigo-500'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold flex items-center justify-between">
                          Super Built-up Area
                          {sqftAreaType === 'SUPER_BUILTUP' && <CheckCircle className="h-3.5 w-3.5 text-indigo-400" />}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">Calculates using flat's Super Built-up Sq. Ft.</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSqftAreaType('CARPET_AREA')}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          sqftAreaType === 'CARPET_AREA'
                            ? 'bg-indigo-950/60 border-indigo-500 text-slate-100 ring-1 ring-indigo-500'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold flex items-center justify-between">
                          RERA Carpet Area
                          {sqftAreaType === 'CARPET_AREA' && <CheckCircle className="h-3.5 w-3.5 text-indigo-400" />}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">Calculates using flat's Net Carpet Area</p>
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    Example: A 1,000 Sq. Ft. flat will be charged 1,000 × ₹{perSqFtRate || '3.50'} = ₹{(1000 * Number(perSqFtRate || 3.5)).toLocaleString()} base maintenance on {sqftAreaType === 'CARPET_AREA' ? 'Carpet Area' : 'Super Built-up Area'}.
                  </p>
                </div>
              )}

              {calculationType === 'PER_FLAT_TYPE' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-semibold text-slate-300">Configured Society Flat Unit Types & Fixed Rates (₹)</label>
                      <p className="text-[11px] text-slate-400">Add or manage unit types used across flat creation and maintenance billing.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {flatTypes.map((fType) => (
                      <div key={fType} className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-2.5 rounded-lg group">
                        <span className="text-xs font-bold text-indigo-400 w-24 truncate" title={fType}>{fType}</span>
                        <div className="relative flex-1">
                          <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-500">₹</span>
                          <input
                            type="number"
                            value={perFlatTypeRates[fType] ?? 0}
                            onChange={(e) => setPerFlatTypeRates({
                              ...perFlatTypeRates,
                              [fType]: Number(e.target.value),
                            })}
                            className="w-full rounded-md border border-slate-800 bg-slate-950 py-1.5 pl-6 pr-2 text-xs text-slate-100 font-bold focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFlatType(fType)}
                          title="Remove unit type"
                          className="text-slate-500 hover:text-rose-400 p-1.5 rounded transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add New Unit Type Row */}
                  <div className="bg-slate-900/60 border border-dashed border-slate-700/80 p-3 rounded-lg flex flex-wrap items-center gap-3">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5 text-indigo-400" /> Add New Unit Type:
                    </span>
                    <input
                      type="text"
                      placeholder="e.g. Studio, 1.5BHK, Duplex, Villa"
                      value={newTypeName}
                      onChange={(e) => setNewTypeName(e.target.value)}
                      className="rounded-md border border-slate-700 bg-slate-950 py-1.5 px-3 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none min-w-[160px]"
                    />
                    <div className="relative w-32">
                      <span className="absolute left-2.5 top-1.5 text-xs font-bold text-slate-500">₹</span>
                      <input
                        type="number"
                        placeholder="Rate"
                        value={newTypeRate}
                        onChange={(e) => setNewTypeRate(e.target.value)}
                        className="w-full rounded-md border border-slate-700 bg-slate-950 py-1.5 pl-6 pr-2 text-xs text-slate-100 font-bold focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddFlatType}
                      disabled={!newTypeName.trim()}
                      className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold disabled:opacity-40 transition-all flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Type
                    </button>
                  </div>
                </div>
              )}

              {calculationType === 'FLAT_RATE_SAME_FOR_ALL' && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">Uniform Flat Rate For All Units (₹)</label>
                  <div className="relative max-w-xs">
                    <span className="absolute left-3.5 top-2.5 text-sm font-bold text-slate-500">₹</span>
                    <input
                      type="number"
                      step="1"
                      value={flatRateSameForAll}
                      onChange={(e) => setFlatRateSameForAll(e.target.value)}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 pl-8 pr-4 text-sm text-slate-100 font-bold focus:border-slate-700 focus:outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Every flat in the society will be charged flat ₹{Number(flatRateSameForAll || 2500).toLocaleString()} per month regardless of flat size or type.
                  </p>
                </div>
              )}
            </div>

            {/* Section 2: Mathematical Formula Expression Builder */}
            <div className="border-t border-slate-800/80 pt-6 space-y-4">
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-indigo-400" /> Mathematical Algebraic Formula Builder
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Define the exact algebraic formula used to compute maintenance invoices. The formula evaluates the mode's calculated <code className="text-indigo-400">rate</code> or <code className="text-indigo-400">base</code> along with extra head charges.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Formula Expression Syntax</label>
                <input
                  type="text"
                  value={formulaString}
                  onChange={(e) => setFormulaString(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2.5 px-3.5 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none mt-1 font-mono font-bold shadow-sm"
                  placeholder="(area * rate) + parking + water"
                  required
                />
              </div>

              {/* Variable Pills / Insert Shortcuts */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Click variables to insert into formula:</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { tag: 'area', label: 'area (Selected Basis)' },
                    { tag: 'super_builtup_area', label: 'super_builtup_area (SqFt)' },
                    { tag: 'carpet_area', label: 'carpet_area (SqFt)' },
                    { tag: 'rate', label: 'rate (Mode Rate)' },
                    { tag: 'base', label: 'base (Base Amount)' },
                    { tag: 'parking', label: 'parking (Total Slot Fees)' },
                    { tag: 'parking_stilt', label: 'parking_stilt (₹500)' },
                    { tag: 'parking_open', label: 'parking_open (₹250)' },
                    { tag: 'parking_slots', label: 'parking_slots (Count)' },
                    { tag: 'water', label: 'water (₹250)' },
                    { tag: 'sinking', label: 'sinking (₹150)' },
                  ].map((v) => (
                    <button
                      key={v.tag}
                      type="button"
                      onClick={() => setFormulaString((prev) => `${prev} + ${v.tag}`.trim())}
                      className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 text-indigo-700 dark:text-indigo-300 font-mono text-xs font-semibold transition-all"
                    >
                      +{v.tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Formula Preview Box */}
              {(() => {
                let sampleRate = 3.5;
                if (calculationType === 'PER_SQ_FT') sampleRate = Number(perSqFtRate) || 3.5;
                else if (calculationType === 'PER_FLAT_TYPE') sampleRate = perFlatTypeRates['2BHK'] || 2500;
                else if (calculationType === 'FLAT_RATE_SAME_FOR_ALL') sampleRate = Number(flatRateSameForAll) || 2500;

                let sampleArea = sqftAreaType === 'CARPET_AREA' ? 850 : 1000;
                let sampleBase = calculationType === 'PER_SQ_FT' ? sampleArea * sampleRate : sampleRate;
                let sampleCalculated = sampleBase + 500 + 250;
                let hasEvalError = false;

                try {
                  const expr = formulaString.toLowerCase()
                    .replace(/\bsuper_builtup_area\b/g, '1000')
                    .replace(/\bcarpet_area\b/g, '850')
                    .replace(/\barea\b/g, sampleArea.toString())
                    .replace(/\brate\b/g, sampleRate.toString())
                    .replace(/\bbase\b/g, sampleBase.toString())
                    .replace(/\bparking_stilt\b/g, '500')
                    .replace(/\bparking_open\b/g, '250')
                    .replace(/\bparking_slots\b/g, '1')
                    .replace(/\bparking\b/g, '500')
                    .replace(/\bwater\b/g, '250')
                    .replace(/\bsinking\b/g, '150');

                  if (/^[0-9+\-*/().\s]+$/.test(expr)) {
                    sampleCalculated = Number(new Function(`return (${expr})`)());
                  } else {
                    hasEvalError = true;
                  }
                } catch (e) {
                  hasEvalError = true;
                }

                return (
                  <div className="rounded-xl border border-indigo-900/50 bg-indigo-950/20 p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                      <span className="flex items-center gap-1.5 text-indigo-400">
                        <Calculator className="h-4 w-4" /> Live Calculation Formula Preview (Sample 1000 Sq. Ft. 2BHK Flat)
                      </span>
                      <span className="font-mono text-sm text-emerald-400">
                        {hasEvalError ? 'Syntax Error' : `Total: ₹${Number(sampleCalculated || 0).toLocaleString('en-IN')}`}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      Selected Mode Rate: <span className="text-slate-200">₹{sampleRate}</span> | Base: <span className="text-slate-200">₹{sampleBase}</span> | Evaluated: <span className="text-indigo-300 font-bold">{formulaString}</span>
                    </p>
                  </div>
                );
              })()}
            </div>

            {/* Section 3: Society Late Fees & Overdue Penalty Policy */}
            <div className="border-t border-slate-800/80 pt-6 space-y-4">
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-400" /> Late Fees & Overdue Penalty Policy
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Configure the society's late fee rules applied to invoices that remain unpaid after the due date.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    type: 'PERCENTAGE',
                    title: 'Annual Interest Rate (% p.a.)',
                    desc: 'Standard interest calculated proportionally on overdue principal.',
                  },
                  {
                    type: 'FIXED_PER_MONTH',
                    title: 'Fixed Fee Per Overdue Month',
                    desc: 'Flat late charge added for every month the invoice is overdue.',
                  },
                  {
                    type: 'FIXED_ONE_TIME',
                    title: 'Fixed One-Time Late Fee',
                    desc: 'Single flat penalty once the invoice crosses due date.',
                  },
                  {
                    type: 'NONE',
                    title: 'No Late Fees / Disabled',
                    desc: 'Overdue invoices will not accrue any penalty charges.',
                  },
                ].map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setPenaltyType(item.type)}
                    className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                      penaltyType === item.type
                        ? 'bg-amber-950/40 border-amber-500/80 ring-1 ring-amber-500/50 text-slate-100 shadow-md'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold flex items-center justify-between mb-1">
                        <span className={penaltyType === item.type ? 'text-amber-300' : 'text-slate-300'}>{item.title}</span>
                        {penaltyType === item.type && <CheckCircle className="h-4 w-4 text-amber-400" />}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">{item.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Dynamic Inputs Based on Penalty Type */}
              {penaltyType !== 'NONE' && (
                <div className="bg-slate-950/60 border border-slate-800/80 p-5 rounded-xl space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {penaltyType === 'PERCENTAGE' && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300">Annual Interest Rate (% p.a.)</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            value={penaltyInterestRate}
                            onChange={(e) => setPenaltyInterestRate(e.target.value)}
                            className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 pl-3 pr-8 text-sm text-slate-100 font-bold focus:border-amber-500 focus:outline-none"
                          />
                          <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-500">%</span>
                        </div>
                        <p className="text-[11px] text-slate-500">e.g. 12% or 18% or 21% per annum (Model Bye-Laws default 21% p.a. max).</p>
                      </div>
                    )}

                    {(penaltyType === 'FIXED_PER_MONTH' || penaltyType === 'FIXED_ONE_TIME') && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300">Fixed Late Fee Amount (₹)</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-2.5 text-sm font-bold text-slate-500">₹</span>
                          <input
                            type="number"
                            step="1"
                            value={penaltyFlatAmount}
                            onChange={(e) => setPenaltyFlatAmount(e.target.value)}
                            className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 pl-8 pr-4 text-sm text-slate-100 font-bold focus:border-amber-500 focus:outline-none"
                          />
                        </div>
                        <p className="text-[11px] text-slate-500">e.g. ₹200 or ₹500 flat fee.</p>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Grace Period (Days After Due Date)</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="60"
                          value={penaltyGracePeriodDays}
                          onChange={(e) => setPenaltyGracePeriodDays(Number(e.target.value) || 0)}
                          className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 px-3 text-sm text-slate-100 font-bold focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500">Days allowed past the invoice due date before late fees start calculating.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="submit"
                disabled={isProcessing}
                className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-slate-100 py-2.5 px-6 text-sm font-semibold transition-all disabled:opacity-55 flex items-center gap-2 shadow-md"
              >
                {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Mode, Formula & Late Fee Settings
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Single Invoice Manual Payment Entry Modal Dialog with Last Payment Details */}
      {selectedBillForPayment && (() => {
        const billAmount = Number(selectedBillForPayment.amount || 0);
        const totalPaidSoFar = Number(selectedBillForPayment.totalPaid || 0);
        const curRemainingBalance = Number(selectedBillForPayment.remainingBalance ?? Math.max(0, billAmount - totalPaidSoFar));
        const paidPercentage = billAmount > 0 ? Math.min(100, Math.round((totalPaidSoFar / billAmount) * 100)) : 0;
        const enteredAmount = Number(paymentAmount || 0);
        const newTotalPaid = totalPaidSoFar + enteredAmount;
        const newRemainingBalance = Math.max(0, billAmount - newTotalPaid);
        const isPartPayment = newRemainingBalance > 0;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedBillForPayment(null)} />

            {/* Modal Panel */}
            <div className="relative w-full max-w-lg bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

              {/* Header */}
              <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/90 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-600/20 border border-emerald-500/20">
                    <Receipt className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-100">Record Single / Part Payment</h3>
                    <p className="text-[11px] text-slate-500">Invoice <span className="font-mono text-indigo-400 font-semibold">{selectedBillForPayment.billNumber}</span> for <span className="font-bold text-slate-200">Flat {selectedBillForPayment.flatNumber}</span></p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedBillForPayment(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-5">

                {/* Outstanding & Part Payment Summary Box */}
                <div className="modal-summary-box bg-slate-950/70 border border-slate-800 p-4 rounded-xl space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-semibold">Total Due (Bill)</span>
                      <span className="block font-bold text-slate-200 mt-0.5">₹ {billAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-semibold">Paid So Far</span>
                      <span className="block font-bold text-emerald-400 mt-0.5">₹ {totalPaidSoFar.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-semibold">Balance Due</span>
                      <span className="block font-black text-amber-400 mt-0.5">₹ {curRemainingBalance.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="space-y-1 pt-1 border-t border-slate-800/60">
                    <div className="flex justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      <span>Payment Progress</span>
                      <span className="text-emerald-400 font-bold">{paidPercentage}% Paid ({`₹ ${totalPaidSoFar.toLocaleString('en-IN')} / ₹ ${billAmount.toLocaleString('en-IN')}`})</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-300 dark:border-slate-800 flex">
                      <div
                        className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                        style={{ width: `${paidPercentage}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Past Payment Details Section */}
                <div className="modal-history-box bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 p-4 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-300 uppercase tracking-wider">
                      <History className="h-4 w-4 text-indigo-500 dark:text-indigo-400" /> Past Payment Details
                    </div>
                    {selectedBillForPayment.lastPayment && (
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider ${selectedBillForPayment.lastPayment.paymentType === 'FULL'
                          ? 'bg-emerald-100 dark:bg-emerald-950/50 border-emerald-800 text-emerald-700 dark:text-emerald-400'
                          : 'bg-amber-100 dark:bg-amber-950/50 border-amber-800 text-amber-700 dark:text-amber-400'
                        }`}>
                        {selectedBillForPayment.lastPayment.paymentType === 'FULL' ? 'FULL PAYMENT' : 'PART PAYMENT'}
                      </span>
                    )}
                  </div>

                  {selectedBillForPayment.lastPayment ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs border-t border-indigo-900/40 pt-2">
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Invoice Total Billed</span>
                        <span className="font-mono font-bold text-slate-200">₹ {billAmount.toLocaleString('en-IN')}</span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Receipt Amount Paid</span>
                        <span className="font-black text-emerald-400">
                          ₹ {Number(selectedBillForPayment.lastPayment.amountPaid).toLocaleString('en-IN')} <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">(out of ₹ {billAmount.toLocaleString('en-IN')} Total Due)</span>
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Receipt Number</span>
                        <span className="font-mono font-semibold text-slate-200">{selectedBillForPayment.lastPayment.receiptNumber}</span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Billing Period / Month</span>
                        <span className="font-semibold text-indigo-300">{selectedBillForPayment.lastPayment.monthYear || 'Jul 2026'}</span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Payment Mode & Ref</span>
                        <span className="font-semibold text-slate-300">
                          {selectedBillForPayment.lastPayment.paymentMode} <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">({selectedBillForPayment.lastPayment.referenceNumber || 'No Ref'})</span>
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Payment Date</span>
                        <span className="font-semibold text-slate-300">{selectedBillForPayment.lastPayment.paymentDate}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic pt-1">No prior payment receipts recorded against this invoice.</p>
                  )}
                </div>

                <form id="single-payment-form" onSubmit={handleSinglePaymentSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs text-slate-600 dark:text-slate-400 font-medium">Amount Received (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-900 dark:text-slate-200 focus:border-slate-700 focus:outline-none mt-1 font-bold"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-600 dark:text-slate-400 font-medium">Payment Mode</label>
                      <select
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-900 dark:text-slate-300 focus:border-slate-700 focus:outline-none appearance-none mt-1"
                      >
                        <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                        <option value="NEFT">NEFT / RTGS (Account Transfer)</option>
                        <option value="CHEQUE">Cheque</option>
                        <option value="CASH">Cash</option>
                        <option value="CARD">Debit / Credit Card</option>
                      </select>
                    </div>
                  </div>

                  {/* Live Part Payment Impact Preview Box */}
                  <div className="bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/50 p-3 rounded-lg space-y-1.5 text-xs shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-indigo-800 dark:text-indigo-300 font-bold uppercase tracking-wide">Payment Impact Preview</span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider ${isPartPayment
                          ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-800/80 text-amber-700 dark:text-amber-400'
                          : 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-800/80 text-emerald-700 dark:text-emerald-400'
                        }`}>
                        {isPartPayment ? 'PARTIAL PAYMENT' : 'FULL PAYMENT'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-200 text-xs mt-2">
                      <span className="font-medium">Total Paid out of Due:</span>
                      <span className="font-bold text-emerald-400">
                        ₹ {newTotalPaid.toLocaleString('en-IN')} <span className="text-[10px] text-slate-500 font-normal">out of ₹ {billAmount.toLocaleString('en-IN')} Total</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-200 text-xs">
                      <span className="font-medium">Remaining Balance Due:</span>
                      <span className="font-black text-amber-400 text-sm">₹ {newRemainingBalance.toLocaleString('en-IN')}</span>
                    </div>
                  </div>


                  {paymentMode !== 'CASH' && bankAccounts.length > 0 && (
                    <div>
                      <label className="text-xs text-slate-600 dark:text-slate-400 font-medium">Deposit Bank Account</label>
                      <select
                        value={depositAccountId}
                        onChange={(e) => setDepositAccountId(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-900 dark:text-slate-300 focus:border-slate-700 focus:outline-none appearance-none mt-1"
                      >
                        {bankAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.bankName} - {acc.accountNumber} {acc.isDefault ? '(Default)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      Reference / Transaction Details <span className="text-slate-500 font-normal">({paymentMode})</span>
                    </label>
                    <input
                      type="text"
                      placeholder={getReferencePlaceholder(paymentMode)}
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-900 dark:text-slate-200 placeholder-slate-600 focus:border-slate-700 focus:outline-none mt-1 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-600 dark:text-slate-400 font-medium">Payment Date</label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-900 dark:text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-600 dark:text-slate-400 font-medium">Remark / Notes (Optional)</label>
                    <textarea
                      rows={2}
                      value={userRemark}
                      onChange={(e) => setUserRemark(e.target.value)}
                      placeholder="E.g. Resubmitting after rejection..."
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-900 dark:text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                    ></textarea>
                  </div>
                </form>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-800 bg-slate-950 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedBillForPayment(null)}
                  className="rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-4 text-xs font-semibold text-slate-500 hover:bg-slate-900 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="single-payment-form"
                  disabled={isProcessing}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-100 py-2 px-6 text-xs font-semibold disabled:opacity-55 transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                >
                  {isProcessing ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</> : 'Confirm & Post Receipt'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Multi-Invoice Bulk Payment Recording Modal Dialog */}
      {isBulkPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsBulkPaymentModalOpen(false)} />

          {/* Modal Panel */}
          <div className="relative w-full max-w-lg bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/90 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-600/20 border border-indigo-500/20">
                  <Receipt className="h-5 w-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">Multi-Invoice Lump-Sum Payment</h3>
                  <p className="text-[11px] text-slate-500">Log a single lump-sum payment received across <span className="font-bold text-indigo-300">{selectedBillsData.length} selected invoices</span>.</p>
                </div>
              </div>
              <button
                onClick={() => setIsBulkPaymentModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-5">

              {/* Selected Invoices Breakdown */}
              <div className="modal-summary-box bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl space-y-2 max-h-40 overflow-y-auto">
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Selected Invoices</span>
                <div className="space-y-1 divide-y divide-slate-800/40">
                  {selectedBillsData.map((b) => (
                    <div key={b.id} className="pt-1 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-200">Flat {b.flatNumber}</span>
                        <span className="text-[10px] text-slate-500 font-mono ml-2">({b.billNumber})</span>
                      </div>
                      <span className="font-bold text-amber-400">
                        ₹ {Number(b.remainingBalance || b.amount).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-history-box bg-indigo-950/40 border border-indigo-900/60 p-3 rounded-lg flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Combined Due Amount</span>
                <span className="text-base font-black text-white">₹ {totalSelectedDue.toLocaleString('en-IN')}</span>
              </div>


              <form id="bulk-payment-form" onSubmit={handleBulkPaymentSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Lump-Sum Amount Received (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={bulkPaymentAmount}
                      onChange={(e) => setBulkPaymentAmount(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1 font-bold"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Payment Mode</label>
                    <select
                      value={bulkPaymentMode}
                      onChange={(e) => setBulkPaymentMode(e.target.value)}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-300 focus:border-slate-700 focus:outline-none appearance-none mt-1"
                    >
                      <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                      <option value="NEFT">NEFT / RTGS (Account Transfer)</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="CASH">Cash</option>
                      <option value="CARD">Debit / Credit Card</option>
                    </select>
                  </div>
                </div>

                {bulkPaymentMode !== 'CASH' && bankAccounts.length > 0 && (
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Deposit Bank Account</label>
                    <select
                      value={bulkDepositAccountId}
                      onChange={(e) => setBulkDepositAccountId(e.target.value)}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-300 focus:border-slate-700 focus:outline-none appearance-none mt-1"
                    >
                      {bankAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.bankName} - {acc.accountNumber} {acc.isDefault ? '(Default)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Reference / Transaction Details <span className="text-slate-500 font-normal">({bulkPaymentMode})</span>
                  </label>
                  <input
                    type="text"
                    placeholder={getReferencePlaceholder(bulkPaymentMode)}
                    value={bulkTransactionRef}
                    onChange={(e) => setBulkTransactionRef(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 placeholder-slate-600 focus:border-slate-700 focus:outline-none mt-1 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Payment Date</label>
                  <input
                    type="date"
                    value={bulkPaymentDate}
                    onChange={(e) => setBulkPaymentDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Remark / Notes (Optional)</label>
                  <textarea
                    rows={2}
                    value={bulkUserRemark}
                    onChange={(e) => setBulkUserRemark(e.target.value)}
                    placeholder="E.g. Bulk payment for previous months..."
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                  ></textarea>
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-800 bg-slate-950 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsBulkPaymentModalOpen(false)}
                className="rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-4 text-xs font-semibold text-slate-500 hover:bg-slate-900 transition-all shadow-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="bulk-payment-form"
                disabled={isProcessing}
                className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-slate-100 py-2 px-6 text-xs font-semibold disabled:opacity-55 transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20"
              >
                {isProcessing ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</> : 'Confirm & Post Bulk Receipts'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
