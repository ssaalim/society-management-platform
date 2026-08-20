'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/auth-context';
import { apiClient } from '../../../lib/api/client';
import { 
  Building, Search, Filter, ShieldAlert, Plus, Calculator, Settings, Receipt, 
  Loader2, CheckCircle, AlertCircle, Calendar, History, CheckSquare, Square, 
  Layers, X, ArrowRight, CreditCard, Clock, HelpCircle, Info, BookOpen, Sparkles,
  ChevronDown, ChevronUp
} from 'lucide-react';
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

interface FormulaVariableDef {
  tag: string;
  name: string;
  category: string;
  categoryColor: string;
  desc: string;
  source: string;
  example: string;
  sampleVal: string;
}

const FORMULA_VARIABLES: FormulaVariableDef[] = [
  {
    tag: 'area',
    name: 'Effective Selected Area',
    category: 'Dimension',
    categoryColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    desc: 'The dynamic area of the flat in Sq. Ft. based on your Step 1 mode selection (Super Built-up Area or RERA Carpet Area).',
    source: 'flats.super_built_up_area OR flats.carpet_area',
    example: 'area * rate',
    sampleVal: '1,000 Sq. Ft.',
  },
  {
    tag: 'sqft',
    name: 'Flat Area (Sq. Ft.)',
    category: 'Dimension',
    categoryColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    desc: 'Convenient shorthand alias for the flat\'s area in square feet.',
    source: 'flats.sqft_area / flats.super_built_up_area',
    example: '(sqft * rate) + parking',
    sampleVal: '1,000 Sq. Ft.',
  },
  {
    tag: 'super_builtup_area',
    name: 'Super Built-Up Area',
    category: 'Dimension',
    categoryColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    desc: 'Explicitly injects the flat\'s full architectural Super Built-Up area in square feet including common share.',
    source: 'flats.super_built_up_area',
    example: 'super_builtup_area * 3.5',
    sampleVal: '1,000 Sq. Ft.',
  },
  {
    tag: 'carpet_area',
    name: 'RERA Net Carpet Area',
    category: 'Dimension',
    categoryColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    desc: 'Explicitly injects the flat\'s net internal usable carpet area as registered under RERA.',
    source: 'flats.carpet_area',
    example: 'carpet_area * 4.2',
    sampleVal: '850 Sq. Ft.',
  },
  {
    tag: 'rate',
    name: 'Mode Base Rate',
    category: 'Rate',
    categoryColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    desc: 'The configured rate per Sq. Ft. (Mode 1) or the fixed rate configured for this flat\'s type (Mode 2).',
    source: 'society_config.per_sq_ft_rate OR per_flat_type_rates',
    example: 'area * rate',
    sampleVal: '₹3.50',
  },
  {
    tag: 'base',
    name: 'Pre-Calculated Base Fee',
    category: 'Rate',
    categoryColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    desc: 'Pre-computed maintenance amount before auxiliary heads. Equals (area * rate) in Mode 1, or unit type rate in Mode 2, or flat uniform rate in Mode 3.',
    source: 'Evaluated dynamically based on active Step 1 Mode',
    example: 'base + parking + water',
    sampleVal: '₹3,500',
  },
  {
    tag: 'parking',
    name: 'Total Combined Parking Fee',
    category: 'Parking',
    categoryColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    desc: 'Total combined parking slot maintenance for all parking spaces (stilt + open + basement) assigned to this flat.',
    source: 'parking_slots table -> sum of rates for linked flat',
    example: 'base + parking',
    sampleVal: '₹500',
  },
  {
    tag: 'parking_stilt',
    name: 'Covered / Stilt Parking',
    category: 'Parking',
    categoryColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    desc: 'Total charges for Covered / Stilt / Podium garage slots assigned to the flat (slots count × stilt rate).',
    source: 'parking_slots where type="STILT"',
    example: 'base + parking_stilt',
    sampleVal: '₹500',
  },
  {
    tag: 'parking_open',
    name: 'Open / Surface Parking',
    category: 'Parking',
    categoryColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    desc: 'Total charges for Open / Surface vehicle bays assigned to the flat (slots count × open rate).',
    source: 'parking_slots where type="OPEN"',
    example: 'base + parking_open',
    sampleVal: '₹250',
  },
  {
    tag: 'parking_slots',
    name: 'Allocated Slots Count',
    category: 'Parking',
    categoryColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    desc: 'The integer count of vehicle slots allocated to the flat (0, 1, 2, etc.). Useful for custom per-slot multipliers.',
    source: 'COUNT(parking_slots) WHERE flat_id = current',
    example: 'base + (parking_slots * 300)',
    sampleVal: '1 slot',
  },
  {
    tag: 'water',
    name: 'Water Utility Charge',
    category: 'Utility',
    categoryColor: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    desc: 'Fixed monthly water consumption or municipal tanker water maintenance cess per unit.',
    source: 'society_config.water_charge_head',
    example: 'base + water',
    sampleVal: '₹250',
  },
  {
    tag: 'sinking',
    name: 'Statutory Sinking Fund',
    category: 'Statutory Fund',
    categoryColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    desc: 'Mandatory sinking fund reserve collection allocated per flat for major structural repairs & lift overhauls.',
    source: 'society_config.sinking_fund_head',
    example: 'base + water + sinking',
    sampleVal: '₹150',
  },
];

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
  const [isVariableGuideOpen, setIsVariableGuideOpen] = useState<boolean>(true);
  const [selectedVarHelp, setSelectedVarHelp] = useState<FormulaVariableDef | null>(null);

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
    <main className="relative flex min-h-screen flex-col items-center justify-start overflow-x-hidden w-full py-4 sm:py-5 px-3 sm:px-5 lg:px-6">
      {/* Background Grids */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="w-full max-w-[1600px] mx-auto space-y-6 z-10">

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
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveView('bills')}
              className={`rounded-lg border py-2 px-3 text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeView === 'bills'
                  ? 'bg-indigo-600 border-indigo-500 text-slate-100 shadow-sm'
                  : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:bg-slate-900'
              }`}
            >
              <CreditCard className="h-3.5 w-3.5" />
              {isManagementRole ? 'Invoices & Receipts' : 'My Invoices'}
            </button>
            <button
              onClick={() => {
                setActiveView('society_dues');
                fetchSocietyDues();
              }}
              className={`rounded-lg border py-2 px-3 text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeView === 'society_dues'
                  ? 'bg-indigo-600 border-indigo-500 text-slate-100 shadow-sm'
                  : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:bg-slate-900'
              }`}
            >
              <Building className="h-3.5 w-3.5" /> Society Outstanding Dues
            </button>
            {isManagementRole && (
              <>
                <button
                  onClick={() => setActiveView('generate')}
                  className={`rounded-lg border py-2 px-3 text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    activeView === 'generate'
                      ? 'bg-indigo-600 border-indigo-500 text-slate-100 shadow-sm'
                      : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <Calculator className="h-3.5 w-3.5" /> Batch Billing Sweep
                </button>
                <button
                  onClick={() => setActiveView('settings')}
                  className={`rounded-lg border py-2 px-3 text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    activeView === 'settings'
                      ? 'bg-indigo-600 border-indigo-500 text-slate-100 shadow-sm'
                      : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <Settings className="h-3.5 w-3.5" /> Formula & Late Fees
                </button>
              </>
            )}
          </div>
        </div>

        {/* Global Feedback Banner */}
        {message && (
          <div
            className={`p-3 sm:p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-semibold shadow-xs ${message.type === 'success'
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
                    <tr className="bg-slate-50 dark:bg-black/60 text-slate-700 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase">
                      <th className="px-3.5 py-2.5 w-10">
                        <button
                          onClick={handleSelectAllPending}
                          title={
                            selectedFlatNumber
                              ? `Select all unpaid invoices for Flat ${selectedFlatNumber}`
                              : 'Select all unpaid invoices for first flat'
                          }
                          className="text-slate-500 dark:text-slate-400 hover:text-indigo-400"
                        >
                          <Layers className="h-3.5 w-3.5" />
                        </button>
                      </th>
                      <th className="px-3.5 py-2.5">Invoice No</th>
                      <th className="px-3.5 py-2.5">Flat Number</th>
                      <th className="px-3.5 py-2.5">Period</th>
                      <th className="px-3.5 py-2.5">Due Date</th>
                      <th className="px-3.5 py-2.5">Total Bill (₹)</th>
                      <th className="px-3.5 py-2.5">Paid / Balance (₹)</th>
                      <th className="px-3.5 py-2.5">Status</th>
                      <th className="px-3.5 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                    {billsList.map((bill) => {
                      const isChecked = selectedBillIds.includes(bill.id);
                      const isFlatDisabled = !!selectedFlatNumber && bill.flatNumber !== selectedFlatNumber;
                      const paidAmount = Number(bill.totalPaid || 0);
                      const remBalance = bill.remainingBalance ? Number(bill.remainingBalance) : Number(bill.amount);

                      return (
                        <tr
                          key={bill.id}
                          className={`text-slate-700 dark:text-slate-300 transition-colors ${isChecked
                              ? 'bg-indigo-50 dark:bg-indigo-950/30'
                              : isFlatDisabled
                                ? 'opacity-40 bg-slate-50 dark:bg-slate-950/40'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-900/10'
                            }`}
                        >
                          <td className="px-3.5 py-2.5">
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
                                className={`h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-indigo-600 focus:ring-indigo-500 ${isFlatDisabled ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'
                                  }`}
                              />
                            ) : (
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-500 opacity-60" />
                            )}
                          </td>
                          <td className="px-3.5 py-2.5 font-mono text-slate-500 dark:text-slate-400">{bill.billNumber}</td>
                          <td className="px-3.5 py-2.5 font-bold text-slate-900 dark:text-slate-200">
                            Flat {bill.flatNumber} <span className="text-[10px] text-slate-500 font-normal">({bill.buildingName})</span>
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-500 dark:text-slate-400">
                            {bill.periodStart.substring(0, 7)}
                          </td>
                          <td className="px-3.5 py-2.5 text-rose-500 dark:text-red-400/80">{bill.dueDate.substring(0, 10)}</td>
                          <td className="px-3.5 py-2.5 font-bold text-slate-900 dark:text-slate-200">
                            ₹ {Number(bill.amount).toLocaleString('en-IN')}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">₹ {paidAmount.toLocaleString('en-IN')}</span>
                            {remBalance > 0 && bill.status !== 'PAID' && (
                              <span className="block text-[10px] text-amber-500 dark:text-amber-400 font-semibold mt-0.5">
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
          <div className="space-y-3.5 animate-in fade-in duration-150">
            {/* Legal Notice Banner */}
            <div className="p-3 rounded-xl border border-indigo-900/60 bg-indigo-950/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
                  <ShieldAlert className="h-4 w-4" />
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
              <div className="flex items-center gap-2 font-mono text-[11px] bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300 whitespace-nowrap">
                <span>Total Flats with Dues:</span>
                <strong className="text-amber-400">{societyDuesList.length}</strong>
              </div>
            </div>

            {/* Filter Search */}
            <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between bg-white dark:bg-slate-950/40 p-3 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Search flat number or tower..."
                  value={duesSearchTerm}
                  onChange={(e) => setDuesSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="text-xs text-slate-500">
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
                <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
              </div>
            ) : societyDuesList.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                <CheckCircle className="h-8 w-8 text-emerald-400 mx-auto" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200">Zero Outstanding Dues!</h3>
                <p className="text-xs text-slate-500">All flats in the society currently have their maintenance accounts cleared.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/20 shadow-xs">
                <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-black/60 text-slate-700 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase">
                      <th className="px-3.5 py-2.5">Flat & Location</th>
                      <th className="px-3.5 py-2.5">Unit Type</th>
                      <th className="px-3.5 py-2.5">Occupancy</th>
                      <th className="px-3.5 py-2.5">Unpaid Invoices</th>
                      <th className="px-3.5 py-2.5">Oldest Due Date</th>
                      <th className="px-3.5 py-2.5">Total Pending Dues (₹)</th>
                      <th className="px-3.5 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                    {societyDuesList
                      .filter((d) =>
                        !duesSearchTerm ||
                        d.flatNumber.toLowerCase().includes(duesSearchTerm.toLowerCase()) ||
                        d.buildingName.toLowerCase().includes(duesSearchTerm.toLowerCase())
                      )
                      .map((item) => (
                        <tr key={item.flatId} className="text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors">
                          <td className="px-3.5 py-2.5 font-bold text-slate-900 dark:text-slate-200">
                            <span>Flat {item.flatNumber}</span>
                            <div className="text-[10px] font-normal text-slate-500 mt-0.5">
                              {item.buildingName} • {item.wingName} • Floor {item.floorNumber}
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[10px]">
                              {item.flatType} ({item.sqftArea} sq ft)
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              item.occupancyStatus === 'OCCUPIED'
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                                : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                            }`}>
                              {item.occupancyStatus}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {item.unpaidInvoicesCount} invoice{item.unpaidInvoicesCount > 1 ? 's' : ''}
                          </td>
                          <td className="px-3.5 py-2.5 font-mono text-slate-500 text-[11px]">
                            {item.oldestDueDate || '—'}
                          </td>
                          <td className="px-3.5 py-2.5 font-bold font-mono text-amber-600 dark:text-amber-300">
                            ₹ {Number(item.totalPendingAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                              item.status === 'OVERDUE'
                                ? 'bg-rose-50 dark:bg-red-950/50 border-rose-200 dark:border-red-800 text-rose-700 dark:text-red-400'
                                : 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
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
          <form onSubmit={handleGenerateInvoices} className="space-y-3.5 max-w-2xl bg-white dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 rounded-xl shadow-xs">
            <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Calculator className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                Generate Invoices Sweep
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Run a batch sweep operation. This automatically computes maintenance variables for all flats and logs double-entry receivables postings.</p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-slate-700 dark:text-slate-300 font-semibold">Billing Period Start</label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 py-2 px-3 text-xs text-slate-900 dark:text-slate-200 focus:border-indigo-600 focus:outline-none mt-1"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-slate-700 dark:text-slate-300 font-semibold">Billing Period End</label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 py-2 px-3 text-xs text-slate-900 dark:text-slate-200 focus:border-indigo-600 focus:outline-none mt-1"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-700 dark:text-slate-300 font-semibold">Invoice Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 py-2 px-3 text-xs text-slate-900 dark:text-slate-200 focus:border-indigo-600 focus:outline-none mt-1"
                required
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div>
                <label className="text-xs text-slate-700 dark:text-slate-300 font-semibold">Generation Type</label>
                <div className="flex gap-4 mt-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="generationType"
                      value="SINGLE"
                      checked={generationType === 'SINGLE'}
                      onChange={() => setGenerationType('SINGLE')}
                      className="accent-indigo-600"
                    />
                    <span>Single Combined Invoice</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="generationType"
                      value="PER_MONTH"
                      checked={generationType === 'PER_MONTH'}
                      onChange={() => setGenerationType('PER_MONTH')}
                      className="accent-indigo-600"
                    />
                    <span>Separate Invoice per Month</span>
                  </label>
                </div>
              </div>
              <button
                type="submit"
                disabled={isProcessing}
                className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 text-xs font-bold transition-all disabled:opacity-55 flex items-center justify-center gap-1.5 shadow-xs"
              >
                {isProcessing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Generate Batch Sweeps
              </button>
            </div>
          </form>
        )}

        {/* Maintenance Calculation Mode Setup */}
        {activeView === 'settings' && (
          <form onSubmit={handleSaveSettings} className="w-full bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 rounded-xl shadow-xs space-y-4">
            <div className="border-b border-slate-200 dark:border-slate-800/80 pb-3">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400">
                  <Settings className="h-4 w-4" />
                </div>
                Maintenance Calculation Mode & Formula Engine
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed max-w-3xl">
                Configure how monthly maintenance is calculated across society housing units, customize the algebraic variable formula, and establish late fee penalty rules.
              </p>
            </div>

            {/* Section 1: Mode Selectors */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Step 1: Choose Primary Billing Mode
                </span>
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                  Active Mode: {calculationType.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Option 1: PER_SQ_FT */}
                <div
                  onClick={() => setCalculationType('PER_SQ_FT')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all space-y-2 relative flex flex-col justify-between ${
                    calculationType === 'PER_SQ_FT'
                      ? 'bg-indigo-50/80 border-indigo-600 text-slate-900 shadow-xs ring-1 ring-indigo-600/20 dark:bg-indigo-950/50 dark:border-indigo-500 dark:text-slate-100'
                      : 'bg-white dark:bg-slate-900/30 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/60 dark:hover:bg-slate-900/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                        Mode 1
                      </span>
                      <div className="flex items-center gap-1">
                        {calculationType === 'PER_SQ_FT' ? (
                          <CheckCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <span className="text-sm">📏</span>
                        )}
                      </div>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Per Sq. Ft. Area Rate</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">
                      Calculated dynamically based on each unit's verified square footage (Area × Rate per Sq. Ft.).
                    </p>
                  </div>
                  <div className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 pt-1.5 border-t border-slate-100 dark:border-slate-800/60">
                    Standard for high-rise apartments
                  </div>
                </div>

                {/* Option 2: PER_FLAT_TYPE */}
                <div
                  onClick={() => setCalculationType('PER_FLAT_TYPE')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all space-y-2 relative flex flex-col justify-between ${
                    calculationType === 'PER_FLAT_TYPE'
                      ? 'bg-indigo-50/80 border-indigo-600 text-slate-900 shadow-xs ring-1 ring-indigo-600/20 dark:bg-indigo-950/50 dark:border-indigo-500 dark:text-slate-100'
                      : 'bg-white dark:bg-slate-900/30 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/60 dark:hover:bg-slate-900/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                        Mode 2
                      </span>
                      <div className="flex items-center gap-1">
                        {calculationType === 'PER_FLAT_TYPE' ? (
                          <CheckCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <span className="text-sm">🏢</span>
                        )}
                      </div>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Per Flat / Unit Type</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">
                      Tiered fixed rate structure assigned per configuration (1BHK, 2BHK, 3BHK, Penthouse, Commercial Shop).
                    </p>
                  </div>
                  <div className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 pt-1.5 border-t border-slate-100 dark:border-slate-800/60">
                    Ideal for mixed residential societies
                  </div>
                </div>

                {/* Option 3: FLAT_RATE_SAME_FOR_ALL */}
                <div
                  onClick={() => setCalculationType('FLAT_RATE_SAME_FOR_ALL')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all space-y-2 relative flex flex-col justify-between ${
                    calculationType === 'FLAT_RATE_SAME_FOR_ALL'
                      ? 'bg-indigo-50/80 border-indigo-600 text-slate-900 shadow-xs ring-1 ring-indigo-600/20 dark:bg-indigo-950/50 dark:border-indigo-500 dark:text-slate-100'
                      : 'bg-white dark:bg-slate-900/30 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/60 dark:hover:bg-slate-900/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                        Mode 3
                      </span>
                      <div className="flex items-center gap-1">
                        {calculationType === 'FLAT_RATE_SAME_FOR_ALL' ? (
                          <CheckCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <span className="text-sm">⚖️</span>
                        )}
                      </div>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Uniform Flat Rate For All</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">
                      Equal, single uniform monthly charge billed across every unit regardless of size or occupant type.
                    </p>
                  </div>
                  <div className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 pt-1.5 border-t border-slate-100 dark:border-slate-800/60">
                    Simplest model for equal-sized units
                  </div>
                </div>
              </div>
            </div>

            {/* Dynamic Rate Configuration Panel Based on Selected Mode */}
            <div className="bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 p-6 sm:p-7 rounded-2xl space-y-6 shadow-xs">
              {calculationType === 'PER_SQ_FT' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200">Rate Per Sq. Ft. (₹)</label>
                      <div className="relative max-w-sm">
                        <span className="absolute left-3.5 top-3 text-sm font-bold text-slate-400 dark:text-slate-500">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          value={perSqFtRate}
                          onChange={(e) => setPerSqFtRate(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-2.5 pl-8 pr-4 text-base text-slate-900 dark:text-slate-100 font-bold focus:border-indigo-600 focus:outline-none shadow-xs"
                          placeholder="3.50"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500">The base monthly rate charged per square foot of area.</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200">Area Basis For Calculation</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <button
                          type="button"
                          onClick={() => setSqftAreaType('SUPER_BUILTUP')}
                          className={`p-3.5 rounded-xl border text-left transition-all ${
                            sqftAreaType === 'SUPER_BUILTUP'
                              ? 'bg-indigo-50 border-indigo-600 text-slate-900 ring-1 ring-indigo-600 dark:bg-indigo-950/60 dark:border-indigo-500 dark:text-slate-100'
                              : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="text-xs font-bold flex items-center justify-between">
                            Super Built-up Area
                            {sqftAreaType === 'SUPER_BUILTUP' && <CheckCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Calculates using flat's Super Built-up Sq. Ft.</p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSqftAreaType('CARPET_AREA')}
                          className={`p-3.5 rounded-xl border text-left transition-all ${
                            sqftAreaType === 'CARPET_AREA'
                              ? 'bg-indigo-50 border-indigo-600 text-slate-900 ring-1 ring-indigo-600 dark:bg-indigo-950/60 dark:border-indigo-500 dark:text-slate-100'
                              : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="text-xs font-bold flex items-center justify-between">
                            RERA Carpet Area
                            {sqftAreaType === 'CARPET_AREA' && <CheckCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Calculates using flat's Net Carpet Area</p>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                    💡 <strong>Calculation Example:</strong> A 1,000 Sq. Ft. flat will be charged 1,000 × ₹{perSqFtRate || '3.50'} = <strong>₹{(1000 * Number(perSqFtRate || 3.5)).toLocaleString()}</strong> base maintenance on {sqftAreaType === 'CARPET_AREA' ? 'Carpet Area' : 'Super Built-up Area'}.
                  </div>
                </div>
              )}

              {calculationType === 'PER_FLAT_TYPE' && (
                <div className="space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div>
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200">Configured Society Flat Unit Types & Fixed Rates (₹)</label>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Define fixed base maintenance charges for each distinct flat type in your society.</p>
                    </div>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-800/60 shrink-0">
                      {flatTypes.length} Types Active
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                    {flatTypes.map((fType) => (
                      <div key={fType} className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl shadow-xs group hover:border-indigo-300 dark:hover:border-slate-700 transition">
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 w-24 truncate" title={fType}>{fType}</span>
                        <div className="relative flex-1">
                          <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400 dark:text-slate-500">₹</span>
                          <input
                            type="number"
                            value={perFlatTypeRates[fType] ?? 0}
                            onChange={(e) => setPerFlatTypeRates({
                              ...perFlatTypeRates,
                              [fType]: Number(e.target.value),
                            })}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 py-1.5 pl-6 pr-2 text-xs text-slate-900 dark:text-slate-100 font-bold focus:border-indigo-600 focus:outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFlatType(fType)}
                          title="Remove unit type"
                          className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add New Unit Type Row */}
                  <div className="bg-white dark:bg-slate-950/80 border border-dashed border-indigo-300 dark:border-indigo-800/80 p-4 rounded-xl flex flex-wrap items-center gap-3">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Plus className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Add New Unit Type:
                    </span>
                    <input
                      type="text"
                      placeholder="e.g. Studio, 1.5BHK, Duplex, Penthouse, Villa"
                      value={newTypeName}
                      onChange={(e) => setNewTypeName(e.target.value)}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 py-2 px-3.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-indigo-600 focus:outline-none min-w-[220px]"
                    />
                    <div className="relative w-36">
                      <span className="absolute left-3 top-2 text-xs font-bold text-slate-400 dark:text-slate-500">₹</span>
                      <input
                        type="number"
                        placeholder="Fixed Rate"
                        value={newTypeRate}
                        onChange={(e) => setNewTypeRate(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 py-2 pl-7 pr-3 text-xs text-slate-900 dark:text-slate-100 font-bold focus:border-indigo-600 focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddFlatType}
                      disabled={!newTypeName.trim()}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-40 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Type
                    </button>
                  </div>
                </div>
              )}

              {calculationType === 'FLAT_RATE_SAME_FOR_ALL' && (
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">Uniform Flat Rate For All Units (₹)</label>
                  <div className="relative max-w-sm">
                    <span className="absolute left-3.5 top-3 text-sm font-bold text-slate-400 dark:text-slate-500">₹</span>
                    <input
                      type="number"
                      step="1"
                      value={flatRateSameForAll}
                      onChange={(e) => setFlatRateSameForAll(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-2.5 pl-8 pr-4 text-base text-slate-900 dark:text-slate-100 font-bold focus:border-indigo-600 focus:outline-none shadow-xs"
                      placeholder="2500"
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Every flat in the society will be charged flat <strong>₹{Number(flatRateSameForAll || 2500).toLocaleString()}</strong> per month regardless of flat size or type.
                  </p>
                </div>
              )}
            </div>

            {/* Section 2: Mathematical Formula Expression Builder */}
            <div className="border-t border-slate-200 dark:border-slate-800/80 pt-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400">
                      <Calculator className="h-4 w-4" />
                    </div>
                    Mathematical Algebraic Formula Builder
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-3xl leading-relaxed">
                    Define the exact algebraic formula used to compute maintenance invoices. The formula evaluates the mode's calculated <code className="text-indigo-600 dark:text-indigo-400 font-mono font-bold bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded">rate</code> or <code className="text-indigo-600 dark:text-indigo-400 font-mono font-bold bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded">base</code> along with dynamic auxiliary charges (parking, water, sinking fund).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsVariableGuideOpen(!isVariableGuideOpen)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 font-bold text-xs transition-all shadow-xs shrink-0 self-start sm:self-center active:scale-95"
                >
                  <HelpCircle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <span>{isVariableGuideOpen ? 'Hide Variable Reference' : 'Variable Reference & Usage Guide'}</span>
                  {isVariableGuideOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* Standard Formula Preset Templates */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Standard Preset Templates (Click to Load):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {[
                    {
                      title: 'Standard Maharashtra Model',
                      formula: '(area * rate) + parking + water + sinking',
                      desc: 'Area-based rate + slots + water + sinking fund',
                    },
                    {
                      title: 'Pure Area-Based Billing',
                      formula: 'area * rate',
                      desc: 'Simple flat area × rate with no extra heads',
                    },
                    {
                      title: 'Unit Type + Stilt/Open Parking',
                      formula: 'base + parking_stilt + parking_open',
                      desc: 'Tiered flat type base + individual parking types',
                    },
                    {
                      title: 'Fixed Rate + Water & Sinking',
                      formula: 'base + water + sinking',
                      desc: 'Fixed flat rate + municipal water & sinking cess',
                    },
                  ].map((preset) => (
                    <button
                      key={preset.title}
                      type="button"
                      onClick={() => setFormulaString(preset.formula)}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        formulaString === preset.formula
                          ? 'bg-indigo-50/80 border-indigo-500 ring-1 ring-indigo-500/30 text-slate-900 dark:bg-indigo-950/40 dark:border-indigo-500 dark:text-slate-100'
                          : 'bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-xs text-indigo-600 dark:text-indigo-400">{preset.title}</div>
                        <code className="text-[11px] font-mono font-bold text-slate-800 dark:text-slate-200 block mt-1">{preset.formula}</code>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5">{preset.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">Formula Expression Syntax Editor</label>
                <input
                  type="text"
                  value={formulaString}
                  onChange={(e) => setFormulaString(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-3.5 px-4 text-base text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:outline-none font-mono font-bold shadow-xs transition"
                  placeholder="(area * rate) + parking + water"
                  required
                />
              </div>

              {/* Variable Pills / Insert Shortcuts with Inline Help Icons */}
              <div className="space-y-3 bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">
                    Click any variable to append to formula (or click ? for full definition):
                  </span>
                  <span className="text-[10px] text-slate-500">{FORMULA_VARIABLES.length} variables supported</span>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {FORMULA_VARIABLES.map((v) => (
                    <div key={v.tag} className="flex items-center group shadow-xs">
                      <button
                        type="button"
                        onClick={() => setFormulaString((prev) => `${prev} + ${v.tag}`.trim())}
                        className="px-3 py-1.5 rounded-l-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 text-indigo-700 dark:text-indigo-300 font-mono text-xs font-bold transition-all hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40"
                        title={`Click to insert +${v.tag} into formula`}
                      >
                        +{v.tag}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedVarHelp(v)}
                        className="px-2.5 py-1.5 rounded-r-xl bg-slate-100 dark:bg-slate-800/80 border border-l-0 border-slate-200 dark:border-slate-800 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-all cursor-pointer"
                        title={`Click to view full definition and calculation details for ${v.tag}`}
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Collapsible Full Variable Reference & Usage Guide */}
              {isVariableGuideOpen && (
                <div className="bg-white dark:bg-slate-950/60 border border-indigo-200 dark:border-indigo-900/60 rounded-2xl p-6 space-y-5 shadow-sm animate-in fade-in duration-200">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      <h5 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                        Formula Variables Reference & Database Mapping
                      </h5>
                    </div>
                    <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800/60">
                      Auto-Evaluated at Billing Sweep
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {FORMULA_VARIABLES.map((item) => (
                      <div
                        key={item.tag}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 hover:border-indigo-300 dark:hover:border-slate-700 transition flex flex-col justify-between gap-3 shadow-xs"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <code className="text-xs font-mono font-extrabold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/60">
                                {item.tag}
                              </code>
                              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{item.name}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedVarHelp(item)}
                              className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border uppercase cursor-pointer hover:opacity-80 transition ${item.categoryColor}`}
                              title="Click for full breakdown"
                            >
                              {item.category} ℹ️
                            </button>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            {item.desc}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                          <div>
                            <span className="font-medium text-slate-400 dark:text-slate-500">Sample Value: </span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{item.sampleVal}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedVarHelp(item)}
                              className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 font-bold text-[10px] transition active:scale-95 flex items-center gap-1"
                            >
                              <HelpCircle className="h-3 w-3" /> Details
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormulaString((prev) => `${prev} + ${item.tag}`.trim())}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] transition active:scale-95 shadow-xs flex items-center gap-1"
                            >
                              <Plus className="h-3 w-3" /> Insert
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dedicated Variable Detail Help Modal */}
              {selectedVarHelp && (
                <div 
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
                  onClick={() => setSelectedVarHelp(null)}
                >
                  <div 
                    className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-150"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400">
                          <Calculator className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono font-extrabold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/60">
                              {selectedVarHelp.tag}
                            </code>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase ${selectedVarHelp.categoryColor}`}>
                              {selectedVarHelp.category}
                            </span>
                          </div>
                          <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">
                            {selectedVarHelp.name}
                          </h4>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedVarHelp(null)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Description */}
                    <div className="space-y-4 text-xs">
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Description & Purpose</label>
                        <p className="text-slate-800 dark:text-slate-200 mt-1 leading-relaxed bg-slate-50 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
                          {selectedVarHelp.desc}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-slate-50 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Database Source</span>
                          <p className="font-mono text-[11px] text-slate-900 dark:text-slate-100 font-semibold truncate" title={selectedVarHelp.source}>
                            {selectedVarHelp.source}
                          </p>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Preview Value (Sample)</span>
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                            {selectedVarHelp.sampleVal}
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Example Algebraic Expression</label>
                        <div className="flex items-center justify-between gap-2 mt-1 bg-slate-100 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                          <code className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {selectedVarHelp.example}
                          </code>
                          <button
                            type="button"
                            onClick={() => {
                              setFormulaString(selectedVarHelp.example);
                              setSelectedVarHelp(null);
                            }}
                            className="text-[10px] font-bold px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 transition"
                          >
                            Use Example
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setSelectedVarHelp(null)}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      >
                        Close
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormulaString((prev) => `${prev} + ${selectedVarHelp.tag}`.trim());
                          setSelectedVarHelp(null);
                        }}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md active:scale-95 transition flex items-center gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" /> Append +{selectedVarHelp.tag} to Formula
                      </button>
                    </div>
                  </div>
                </div>
              )}

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
                  const sampleVars: Record<string, number> = {
                    super_builtup_area: 1000,
                    super_built_up_area: 1000,
                    builtup_area: 1000,
                    built_up_area: 1000,
                    carpet_area: 850,
                    carpet: 850,
                    rera_carpet_area: 850,
                    area: sampleArea,
                    sqft: sampleArea,
                    sq_ft: sampleArea,
                    sqfeet: sampleArea,
                    sq_feet: sampleArea,
                    sqft_area: sampleArea,
                    rate: sampleRate,
                    per_sqft_rate: sampleRate,
                    base_rate: sampleRate,
                    base: sampleBase,
                    base_amount: sampleBase,
                    parking_stilt: 500,
                    stilt_parking: 500,
                    stilt: 500,
                    parking_open: 250,
                    open_parking: 250,
                    open: 250,
                    parking_slots: 1,
                    parking: 500,
                    water: 250,
                    water_charge: 250,
                    sinking: 150,
                    sinking_fund: 150,
                    repair: 200,
                    repairs: 200,
                    repair_fund: 200,
                    elevator: 150,
                    lift: 150,
                    security: 300,
                    gym: 100,
                    clubhouse: 100,
                  };

                  let expr = formulaString.toLowerCase();
                  const sortedKeys = Object.keys(sampleVars).sort((a, b) => b.length - a.length);

                  for (const key of sortedKeys) {
                    const regex = new RegExp(`\\b${key}\\b`, 'gi');
                    expr = expr.replace(regex, sampleVars[key].toString());
                  }

                  if (/^[0-9+\-*/().\s]+$/.test(expr)) {
                    const res = new Function(`return (${expr})`)();
                    if (typeof res === 'number' && !isNaN(res) && isFinite(res)) {
                      sampleCalculated = Number(Number(res).toFixed(2));
                    } else {
                      hasEvalError = true;
                    }
                  } else {
                    hasEvalError = true;
                  }
                } catch (e) {
                  hasEvalError = true;
                }

                return (
                  <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/80 via-white to-indigo-50/40 dark:from-indigo-950/30 dark:via-slate-900/40 dark:to-indigo-950/20 p-4 sm:p-5 space-y-2.5 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-400">
                        <Calculator className="h-4 w-4" /> Live Calculation Formula Preview (Sample 1,000 Sq. Ft. 2BHK Unit)
                      </span>
                      <span className={`font-mono text-base font-extrabold ${hasEvalError ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {hasEvalError ? 'Syntax Error in Formula' : `Evaluated Total: ₹${Number(sampleCalculated || 0).toLocaleString('en-IN')}`}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                      Selected Mode Rate: <span className="text-slate-900 dark:text-slate-100 font-bold">₹{sampleRate}</span> | Base: <span className="text-slate-900 dark:text-slate-100 font-bold">₹{sampleBase}</span> | Evaluated: <span className="text-indigo-600 dark:text-indigo-300 font-bold">{formulaString}</span>
                    </p>
                  </div>
                );
              })()}
            </div>

            {/* Section 3: Society Late Fees & Overdue Penalty Policy */}
            <div className="border-t border-slate-200 dark:border-slate-800/80 pt-8 space-y-6">
              <div>
                <h4 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 text-amber-600 dark:text-amber-400">
                    <Clock className="h-4 w-4" />
                  </div>
                  Late Fees & Overdue Penalty Policy
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-3xl leading-relaxed">
                  Configure the society's late fee rules applied automatically to invoices that remain unpaid after the due date and grace period.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    type: 'PERCENTAGE',
                    title: 'Annual Interest Rate (% p.a.)',
                    desc: 'Standard interest calculated proportionally on overdue principal.',
                  },
                  {
                    type: 'FIXED_PER_MONTH',
                    title: 'Fixed Fee Per Month',
                    desc: 'Flat late charge added for every month the invoice is overdue.',
                  },
                  {
                    type: 'FIXED_ONE_TIME',
                    title: 'One-Time Late Fee',
                    desc: 'Single flat penalty once the invoice crosses due date.',
                  },
                  {
                    type: 'NONE',
                    title: 'No Late Fees',
                    desc: 'Overdue invoices will not accrue any penalty charges.',
                  },
                ].map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setPenaltyType(item.type)}
                    className={`p-5 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between ${
                      penaltyType === item.type
                        ? 'bg-amber-50/80 border-amber-500 text-slate-900 shadow-md ring-2 ring-amber-500/20 dark:bg-amber-950/40 dark:border-amber-500/80 dark:ring-amber-500/30 dark:text-slate-100'
                        : 'bg-white dark:bg-slate-900/30 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/60 dark:hover:bg-slate-900/60'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold flex items-center justify-between mb-2">
                        <span className={penaltyType === item.type ? 'text-amber-800 dark:text-amber-300 font-extrabold' : 'text-slate-800 dark:text-slate-300'}>{item.title}</span>
                        {penaltyType === item.type && <CheckCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Dynamic Inputs Based on Penalty Type */}
              {penaltyType !== 'NONE' && (
                <div className="bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 p-6 sm:p-7 rounded-2xl space-y-5 shadow-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {penaltyType === 'PERCENTAGE' && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-800 dark:text-slate-200">Annual Interest Rate (% p.a.)</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            value={penaltyInterestRate}
                            onChange={(e) => setPenaltyInterestRate(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-2.5 pl-3.5 pr-8 text-sm text-slate-900 dark:text-slate-100 font-bold focus:border-amber-500 focus:outline-none shadow-xs"
                          />
                          <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400 dark:text-slate-500">%</span>
                        </div>
                        <p className="text-[11px] text-slate-500">Model Bye-Laws default up to 21% p.a. max.</p>
                      </div>
                    )}

                    {(penaltyType === 'FIXED_PER_MONTH' || penaltyType === 'FIXED_ONE_TIME') && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-800 dark:text-slate-200">Fixed Late Fee Amount (₹)</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-2.5 text-sm font-bold text-slate-400 dark:text-slate-500">₹</span>
                          <input
                            type="number"
                            step="1"
                            value={penaltyFlatAmount}
                            onChange={(e) => setPenaltyFlatAmount(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-2.5 pl-8 pr-4 text-sm text-slate-900 dark:text-slate-100 font-bold focus:border-amber-500 focus:outline-none shadow-xs"
                          />
                        </div>
                        <p className="text-[11px] text-slate-500">e.g. ₹200 or ₹500 flat fee per period.</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200">Grace Period (Days After Due Date)</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="60"
                          value={penaltyGracePeriodDays}
                          onChange={(e) => setPenaltyGracePeriodDays(Number(e.target.value) || 0)}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-2.5 px-3.5 text-sm text-slate-900 dark:text-slate-100 font-bold focus:border-amber-500 focus:outline-none shadow-xs"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500">Days allowed past the invoice due date before late fees start calculating.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
                All changes apply immediately to upcoming batch sweeps and overdue invoices.
              </span>

              <button
                type="submit"
                disabled={isProcessing}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-8 text-sm font-bold transition-all disabled:opacity-55 flex items-center gap-2 shadow-lg shadow-indigo-600/25 active:scale-95 ml-auto"
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
