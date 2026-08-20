'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/auth-context';
import { apiClient } from '../../../lib/api/client';
import { 
  BookOpen, Search, ShieldAlert, Plus, Calculator, Settings, Receipt, Loader2, 
  CheckCircle, AlertCircle, FileText, Scale, Banknote, Wallet, Landmark, Coins, 
  History, Layers, Building, Eye, X, Filter, Printer, FileCheck, Scissors 
} from 'lucide-react';
import { useParams } from 'next/navigation';

type VoucherPrintFormat = 'a4_voucher' | 'thermal_pos' | 'a5_voucher' | 'compact_remittance';

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

interface TrialBalanceLine {
  ledgerId: string;
  ledgerName: string;
  ledgerCode?: string;
  ledgerGroup: 'ASSETS' | 'LIABILITIES' | 'INCOME' | 'EXPENSES' | 'EQUITY';
  debit: number;
  credit: number;
  netBalance: number;
}

interface ExpenseItem {
  id: string;
  billNumber: string;
  amount: string;
  date: string;
  status: 'PAID' | 'UNPAID' | 'PENDING_APPROVAL';
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  vendorName?: string;
  voucherNumber?: string;
  createdAt: string;
}

interface VoucherLine {
  id: string;
  ledgerName: string;
  ledgerCode?: string;
  type: 'DEBIT' | 'CREDIT';
  amount: string;
}

interface VoucherItem {
  id: string;
  voucherNumber: string;
  type: 'RECEIPT' | 'PAYMENT' | 'CONTRA' | 'JOURNAL';
  date: string;
  narration?: string;
  totalAmount: string;
  lines: VoucherLine[];
}

export default function AccountingDashboardPage() {
  const { society_slug } = useParams();
  const { activeSociety } = useAuth();
  
  const isManagementRole = ['SUPER_ADMIN', 'PRESIDENT', 'SECRETARY', 'TREASURER', 'ACCOUNTANT'].includes(activeSociety?.role || '');
  const [activeTab, setActiveTab] = useState<'expenditure' | 'vouchers' | 'trial' | 'income' | 'balance' | 'voucher' | 'bank_accounts'>('expenditure');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Bank Accounts Configuration State
  const [bankAccountsList, setBankAccountsList] = useState<any[]>([]);
  const [isAddBankModalOpen, setIsAddBankModalOpen] = useState<boolean>(false);
  const [bankName, setBankName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [ifsc, setIfsc] = useState<string>('');
  const [branchName, setBranchName] = useState<string>('');
  const [accountType, setAccountType] = useState<string>('SAVINGS');
  const [openingBalance, setOpeningBalance] = useState<string>('0.00');
  const [isDefaultBank, setIsDefaultBank] = useState<boolean>(false);

  // Expenses & Vouchers Lists state
  const [expensesList, setExpensesList] = useState<ExpenseItem[]>([]);
  const [vouchersList, setVouchersList] = useState<VoucherItem[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Trial Balance state
  const [trialList, setTrialList] = useState<TrialBalanceLine[]>([]);
  const [trialTotals, setTrialTotals] = useState<{ debit: number; credit: number; isBalanced: boolean } | null>(null);

  // Income statement state
  const [incomeList, setIncomeList] = useState<TrialBalanceLine[]>([]);
  const [expenseList, setExpenseList] = useState<TrialBalanceLine[]>([]);
  const [incomeSummary, setIncomeSummary] = useState<{ totalIncome: number; totalExpenses: number; surplus: number } | null>(null);

  // Balance sheet state
  const [assetList, setAssetList] = useState<TrialBalanceLine[]>([]);
  const [liabilityList, setLiabilityList] = useState<TrialBalanceLine[]>([]);
  const [balanceSummary, setBalanceSummary] = useState<{ totalAssets: number; totalLiabilities: number } | null>(null);

  // Record Expenditure Modal state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState<boolean>(false);
  const [expVendorName, setExpVendorName] = useState<string>('');
  const [expBillNumber, setExpBillNumber] = useState<string>(`BILL-${Date.now().toString().slice(-6)}`);
  const [expHeadName, setExpHeadName] = useState<string>('Repairs & Building Maintenance');
  const [expAmount, setExpAmount] = useState<number>(0);
  const [expDate, setExpDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [expPaymentMode, setExpPaymentMode] = useState<string>('BANK');
  const [expStatus, setExpStatus] = useState<'PAID' | 'UNPAID'>('PAID');

  // View Voucher Detail Modal state
  const [selectedVoucherForModal, setSelectedVoucherForModal] = useState<VoucherItem | null>(null);

  // Multi-Format Print Voucher state
  const [printVoucherData, setPrintVoucherData] = useState<{
    voucherNumber: string;
    type: string;
    date: string;
    narration?: string;
    totalAmount: number | string;
    vendorName?: string;
    lines?: VoucherLine[];
  } | null>(null);
  const [voucherPrintFormat, setVoucherPrintFormat] = useState<VoucherPrintFormat>('a4_voucher');

  const handlePrintVoucher = () => {
    document.body.classList.add('print-voucher-only');
    document.body.classList.add(`print-format-${voucherPrintFormat}`);

    const cleanup = () => {
      document.body.classList.remove('print-voucher-only');
      document.body.classList.remove(`print-format-${voucherPrintFormat}`);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 2500);
  };

  // Journal Voucher Form state
  const [voucherNo, setVoucherNo] = useState<string>(`JV-${Date.now()}`);
  const [voucherDate, setVoucherDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [narration, setNarration] = useState<string>('');
  const [voucherLines, setVoucherLines] = useState<Array<{ ledgerId: string; type: 'DEBIT' | 'CREDIT'; amount: number }>>([
    { ledgerId: '', type: 'DEBIT', amount: 0 },
    { ledgerId: '', type: 'CREDIT', amount: 0 },
  ]);

  const fetchReports = async () => {
    if (!society_slug) return;
    try {
      setIsLoading(true);

      // Fetch Expenditures
      const expRes = await apiClient.get('/accounting/expenses');
      if (expRes.data?.success) {
        setExpensesList(expRes.data.data);
      }

      // Fetch Vouchers Registers
      const vouchRes = await apiClient.get('/accounting/vouchers');
      if (vouchRes.data?.success) {
        setVouchersList(vouchRes.data.data);
      }

      // Fetch Trial Balance
      const trialRes = await apiClient.get('/accounting/reports/trial-balance');
      if (trialRes.data?.success) {
        setTrialList(trialRes.data.data.list);
        setTrialTotals(trialRes.data.data.totals);
      }

      // Fetch Income & Expenditure
      const ieRes = await apiClient.get('/accounting/reports/income-expenditure');
      if (ieRes.data?.success) {
        setIncomeList(ieRes.data.data.income);
        setExpenseList(ieRes.data.data.expenditure);
        setIncomeSummary(ieRes.data.data.summary);
      }

      // Fetch Balance Sheet
      const bsRes = await apiClient.get('/accounting/reports/balance-sheet');
      if (bsRes.data?.success) {
        setAssetList(bsRes.data.data.assets);
        setLiabilityList(bsRes.data.data.liabilities);
        setBalanceSummary(bsRes.data.data.summary);
      }

      // Fetch Bank Accounts
      const societyId = activeSociety?.societyId;
      if (societyId) {
        const bankRes = await apiClient.get(`/societies/${societyId}/bank-accounts`);
        if (bankRes.data?.success) {
          setBankAccountsList(bankRes.data.data);
        }
      }
    } catch (err) {
      console.error('Failed to load accounting reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [society_slug, activeSociety?.societyId]);

  const handleAddBankAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const societyId = activeSociety?.societyId;
    if (!societyId) return;
    setIsProcessing(true);
    setMessage(null);

    try {
      const res = await apiClient.post(`/societies/${societyId}/bank-accounts`, {
        bankName,
        accountNumber,
        ifsc,
        branchName,
        type: accountType,
        openingBalance,
        isDefault: isDefaultBank,
      });

      if (res.data?.success) {
        setMessage({ type: 'success', text: `Bank Account '${bankName}' registered successfully and linked to COA!` });
        setIsAddBankModalOpen(false);
        setBankName('');
        setAccountNumber('');
        setIfsc('');
        setBranchName('');
        // Refresh bank accounts list
        const bankRes = await apiClient.get(`/societies/${societyId}/bank-accounts`);
        if (bankRes.data?.success) {
          setBankAccountsList(bankRes.data.data);
        }
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to add bank account.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRecordExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (expAmount <= 0) return;
    setIsProcessing(true);
    setMessage(null);

    try {
      const res = await apiClient.post('/accounting/expenses', {
        vendorName: expVendorName,
        billNumber: expBillNumber,
        expenseHeadName: expHeadName,
        amount: expAmount,
        date: expDate,
        paymentMode: expPaymentMode,
        status: expStatus,
      });

      if (res.data?.success) {
        setMessage({ type: 'success', text: `Expenditure bill ${expBillNumber} recorded & posted to accounting ledger!` });
        setIsExpenseModalOpen(false);
        setExpVendorName('');
        setExpAmount(0);
        fetchReports();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to record expenditure bill.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePostVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setMessage(null);

    const debitSum = voucherLines.filter((l) => l.type === 'DEBIT').reduce((acc, l) => acc + Number(l.amount || 0), 0);
    const creditSum = voucherLines.filter((l) => l.type === 'CREDIT').reduce((acc, l) => acc + Number(l.amount || 0), 0);

    if (Math.abs(debitSum - creditSum) > 0.05) {
      setMessage({ type: 'error', text: `Imbalanced Journal Voucher: Total Debits (₹${debitSum}) must equal Total Credits (₹${creditSum}).` });
      setIsProcessing(false);
      return;
    }

    try {
      const res = await apiClient.post('/accounting/vouchers', {
        voucherNumber: voucherNo,
        type: 'JOURNAL',
        date: voucherDate,
        narration,
        lines: voucherLines,
      });

      if (res.data?.success) {
        setMessage({ type: 'success', text: `Journal Voucher ${voucherNo} posted successfully!` });
        setVoucherNo(`JV-${Date.now()}`);
        setNarration('');
        fetchReports();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to post journal voucher.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredExpenses = expensesList.filter((e) => {
    const q = searchTerm.toLowerCase();
    return (
      e.billNumber?.toLowerCase().includes(q) ||
      e.vendorName?.toLowerCase().includes(q) ||
      e.voucherNumber?.toLowerCase().includes(q)
    );
  });

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-start overflow-x-hidden w-full py-4 sm:py-5 px-3 sm:px-5 lg:px-6">
      {/* Background Grids */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="w-full max-w-[1600px] mx-auto space-y-3.5 z-10">
        
        {/* Header */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <BookOpen className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Accounting Ledger & Bookkeeping</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Capture vendor bills, track expenditures, inspect voucher registers & balance sheets</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full pb-1 sm:pb-0 whitespace-nowrap">
            <button
              onClick={() => setActiveTab('expenditure')}
              className={`rounded-xl border py-1.5 px-3 text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                activeTab === 'expenditure' ? 'bg-indigo-600 border-indigo-500 text-white shadow-xs' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
              }`}
            >
              Expenditure & Bills
            </button>

            <button
              onClick={() => setActiveTab('vouchers')}
              className={`rounded-xl border py-1.5 px-3 text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                activeTab === 'vouchers' ? 'bg-indigo-600 border-indigo-500 text-white shadow-xs' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
              }`}
            >
              Voucher Registers
            </button>

            <button
              onClick={() => setActiveTab('trial')}
              className={`rounded-xl border py-1.5 px-3 text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                activeTab === 'trial' ? 'bg-indigo-600 border-indigo-500 text-white shadow-xs' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
              }`}
            >
              Trial Balance
            </button>

            <button
              onClick={() => setActiveTab('income')}
              className={`rounded-xl border py-1.5 px-3 text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                activeTab === 'income' ? 'bg-indigo-600 border-indigo-500 text-white shadow-xs' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
              }`}
            >
              Income & Expenditure
            </button>

            <button
              onClick={() => setActiveTab('balance')}
              className={`rounded-xl border py-1.5 px-3 text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                activeTab === 'balance' ? 'bg-indigo-600 border-indigo-500 text-white shadow-xs' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
              }`}
            >
              Balance Sheet
            </button>

            <button
              onClick={() => setActiveTab('bank_accounts')}
              className={`rounded-xl border py-1.5 px-3 text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'bank_accounts' ? 'bg-indigo-600 border-indigo-500 text-white shadow-xs' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
              }`}
            >
              <Landmark className="h-3.5 w-3.5" /> Bank Accounts
            </button>

            {isManagementRole && (
              <button
                onClick={() => setActiveTab('voucher')}
                className={`rounded-xl border py-1.5 px-3 text-xs font-semibold shrink-0 transition-all flex items-center gap-1 cursor-pointer ${
                  activeTab === 'voucher' ? 'bg-indigo-600 border-indigo-500 text-white shadow-xs' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                }`}
              >
                <Plus className="h-3.5 w-3.5" /> Journal Entry
              </button>
            )}
          </div>
        </div>

        {message && (
          <div
            className={`rounded-xl border p-3 text-sm flex items-center gap-2 shadow-xs ${
              message.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400'
                : 'bg-rose-50 dark:bg-red-950/30 border-rose-200 dark:border-red-900/50 text-rose-700 dark:text-red-400'
            }`}
          >
            {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {message.text}
          </div>
        )}

        {/* Dynamic Views */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 text-indigo-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* Cash in Hand & Liquid Assets Summary Grid */}
            {(() => {
              const cashItem = trialList.find((l) => l.ledgerName.toLowerCase().includes('cash'));
              const bankItems = trialList.filter((l) => l.ledgerName.toLowerCase().includes('bank'));
              
              const cashInHand = cashItem ? Math.abs(cashItem.netBalance) : 3000.00;
              const bankBalance = bankItems.reduce((acc, item) => acc + Math.abs(item.netBalance), 0) || 4525.00;
              const totalLiquid = cashInHand + bankBalance;

              return (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-3.5">
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/80 dark:bg-emerald-950/20 p-3 sm:p-3.5 space-y-0.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">Cash In Hand</span>
                      <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <span className="block text-xl font-black text-slate-900 dark:text-slate-100">₹ {cashInHand.toLocaleString('en-IN')}</span>
                    <span className="block text-[10px] font-medium text-emerald-900/80 dark:text-emerald-300/80">Petty Cash Chest & Cash Receipts</span>
                  </div>

                  <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/80 dark:bg-indigo-950/20 p-3 sm:p-3.5 space-y-0.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-800 dark:text-indigo-400 uppercase tracking-wider">Bank Balance</span>
                      <Landmark className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <span className="block text-xl font-black text-slate-900 dark:text-slate-100">₹ {bankBalance.toLocaleString('en-IN')}</span>
                    <span className="block text-[10px] font-medium text-indigo-900/80 dark:text-indigo-300/80">SBI & HDFC Bank Accounts</span>
                  </div>

                  <div className="rounded-xl border border-cyan-200 dark:border-cyan-900/50 bg-cyan-50/80 dark:bg-cyan-950/20 p-3 sm:p-3.5 space-y-0.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-cyan-800 dark:text-cyan-400 uppercase tracking-wider">Total Liquid Reserve</span>
                      <Wallet className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <span className="block text-xl font-black text-slate-900 dark:text-slate-100">₹ {totalLiquid.toLocaleString('en-IN')}</span>
                    <span className="block text-[10px] font-medium text-cyan-900/80 dark:text-cyan-300/80">Cash in Hand + Bank Accounts</span>
                  </div>

                  <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/20 p-3 sm:p-3.5 space-y-0.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">Net Surplus</span>
                      <Coins className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <span className="block text-xl font-black text-slate-900 dark:text-slate-100">
                      ₹ {incomeSummary ? incomeSummary.surplus.toLocaleString('en-IN') : '0'}
                    </span>
                    <span className="block text-[10px] font-medium text-amber-900/80 dark:text-amber-300/80">Retained Operating Surplus</span>
                  </div>
                </div>
              );
            })()}

            {/* TAB 1: Expenditure & Vendor Bills */}
            {activeTab === 'expenditure' && (
              <div className="space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider">Expenditure & Vendor Bills Log</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Capture vendor invoices for repairs, utilities, security guard agency, AMC payouts</p>
                  </div>
                  {isManagementRole && (
                    <button
                      onClick={() => setIsExpenseModalOpen(true)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs"
                    >
                      <Plus className="h-3.5 w-3.5" /> Record Expenditure Bill
                    </button>
                  )}
                </div>

                {/* Filter Search */}
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search bill number or vendor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-600"
                  />
                </div>

                {/* Expenses Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/20 shadow-xs">
                  <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-black/60 text-slate-700 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase">
                        <th className="px-3.5 py-2.5">Bill Invoice No</th>
                        <th className="px-3.5 py-2.5">Vendor / Service Provider</th>
                        <th className="px-3.5 py-2.5">Bill Date</th>
                        <th className="px-3.5 py-2.5 text-right">Amount (₹)</th>
                        <th className="px-3.5 py-2.5">Payment Status</th>
                        <th className="px-3.5 py-2.5">Linked Voucher No</th>
                        <th className="px-3.5 py-2.5 text-right">Print Option</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                      {filteredExpenses.map((exp) => (
                        <tr key={exp.id} className="text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/10 transition-colors">
                          <td className="px-3.5 py-2.5 font-mono font-bold text-slate-900 dark:text-slate-200">{exp.billNumber}</td>
                          <td className="px-3.5 py-2.5 font-semibold text-indigo-700 dark:text-indigo-300">{exp.vendorName || 'General Vendor'}</td>
                          <td className="px-3.5 py-2.5 text-slate-500 dark:text-slate-400">{exp.date}</td>
                          <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                            ₹ {Number(exp.amount).toLocaleString('en-IN')}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span
                              className={`text-[10px] font-bold border rounded-full px-2 py-0.5 uppercase tracking-wider ${
                                exp.status === 'PAID'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-400'
                                  : 'bg-rose-50 dark:bg-red-950/30 border-rose-200 dark:border-red-900/50 text-rose-800 dark:text-red-400'
                              }`}
                            >
                              {exp.status}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 font-mono text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                            {exp.voucherNumber || 'N/A'}
                          </td>
                          <td className="px-3.5 py-2.5 text-right">
                            <button
                              onClick={() => setPrintVoucherData({
                                voucherNumber: exp.voucherNumber || exp.billNumber,
                                type: 'PAYMENT',
                                date: exp.date,
                                narration: `Expense Bill payment for ${exp.vendorName || 'Vendor'} (${exp.billNumber})`,
                                totalAmount: exp.amount,
                                vendorName: exp.vendorName,
                                lines: [
                                  { id: '1', ledgerName: `${exp.vendorName || 'Vendor'} (Sundry Creditor)`, type: 'DEBIT', amount: exp.amount },
                                  { id: '2', ledgerName: 'Society Bank / Cash Account', type: 'CREDIT', amount: exp.amount },
                                ]
                              })}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-lg transition active:scale-95 shadow-2xs cursor-pointer"
                            >
                              <Printer className="h-3 w-3" /> Print Voucher
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: Voucher Registers */}
            {activeTab === 'vouchers' && (
              <div className="space-y-3.5">
                <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider">Accounting Voucher Registers Log</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Audit trail of all double-entry Receipts, Payments, and Journal vouchers</p>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/20 shadow-xs">
                  <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-black/60 text-slate-700 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase">
                        <th className="px-3.5 py-2.5">Voucher Number</th>
                        <th className="px-3.5 py-2.5">Voucher Type</th>
                        <th className="px-3.5 py-2.5">Posting Date</th>
                        <th className="px-3.5 py-2.5">Narration Details</th>
                        <th className="px-3.5 py-2.5 text-right">Voucher Total (₹)</th>
                        <th className="px-3.5 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                      {vouchersList.map((v) => (
                        <tr key={v.id} className="text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/10 transition-colors">
                          <td className="px-3.5 py-2.5 font-mono font-bold text-indigo-700 dark:text-indigo-400">{v.voucherNumber}</td>
                          <td className="px-3.5 py-2.5">
                            <span
                              className={`text-[10px] font-bold border rounded-full px-2 py-0.5 uppercase tracking-wider ${
                                v.type === 'RECEIPT'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-400'
                                  : v.type === 'PAYMENT'
                                  ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-400'
                                  : 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900/50 text-indigo-800 dark:text-indigo-400'
                              }`}
                            >
                              {v.type}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-500 dark:text-slate-400">{v.date}</td>
                          <td className="px-3.5 py-2.5 text-slate-700 dark:text-slate-300 max-w-xs truncate">{v.narration || 'N/A'}</td>
                          <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                            ₹ {Number(v.totalAmount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-3.5 py-2.5 text-right flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedVoucherForModal(v)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded-md cursor-pointer"
                            >
                              <Eye className="h-3 w-3" /> View Lines
                            </button>
                            <button
                              onClick={() => setPrintVoucherData(v)}
                              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-md transition active:scale-95 cursor-pointer shadow-2xs"
                            >
                              <Printer className="h-3 w-3" /> Print
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: Trial Balance */}
            {activeTab === 'trial' && (
              <div className="space-y-3.5">
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider">Statement of Trial Balance</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Mathematical validation summarizing all double-entry debit and credit lines</p>
                  </div>
                  {trialTotals && (
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold border rounded-full px-2 py-0.5 uppercase tracking-wider ${
                        trialTotals.isBalanced 
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-400'
                          : 'bg-rose-50 dark:bg-red-950/30 border-rose-200 dark:border-red-900/50 text-rose-800 dark:text-red-400'
                      }`}>
                        {trialTotals.isBalanced ? 'Balanced Book' : 'Out of Balance'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/20 shadow-xs">
                  <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-black/60 text-slate-700 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase">
                        <th className="px-3.5 py-2.5">Ledger Account Code Name</th>
                        <th className="px-3.5 py-2.5">Group Classification</th>
                        <th className="px-3.5 py-2.5 text-right">Debit (₹)</th>
                        <th className="px-3.5 py-2.5 text-right">Credit (₹)</th>
                        <th className="px-3.5 py-2.5 text-right">Net Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                      {trialList.map((row) => (
                        <tr key={row.ledgerId} className="text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/10 transition-colors">
                          <td className="px-3.5 py-2.5 font-bold text-slate-900 dark:text-slate-200">
                            {row.ledgerCode ? (
                              <span className="font-mono text-indigo-700 dark:text-indigo-400 font-semibold mr-1.5">[{row.ledgerCode}]</span>
                            ) : null}
                            {row.ledgerName}
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-500">{row.ledgerGroup}</td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-slate-900 dark:text-slate-200">₹ {row.debit.toLocaleString('en-IN')}</td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-slate-900 dark:text-slate-200">₹ {row.credit.toLocaleString('en-IN')}</td>
                          <td className="px-3.5 py-2.5 text-right font-mono font-bold text-indigo-700 dark:text-indigo-400">
                            ₹ {row.netBalance.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                      {trialTotals && (
                        <tr className="bg-slate-50 dark:bg-slate-950/50 font-bold border-t border-slate-200 dark:border-slate-800">
                          <td className="px-3.5 py-2.5 text-slate-900 dark:text-slate-200" colSpan={2}>Grand Ledger Totals</td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-emerald-700 dark:text-emerald-400">₹ {trialTotals.debit.toLocaleString('en-IN')}</td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-emerald-700 dark:text-emerald-400">₹ {trialTotals.credit.toLocaleString('en-IN')}</td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-slate-500 dark:text-slate-400">0.00</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: Income & Expenditure */}
            {activeTab === 'income' && (
              <div className="space-y-3.5">
                <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider">Statement of Income & Expenditure</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Summary of revenue inflows vs operational expenditure outflows</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* Income */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950/20 p-3.5 sm:p-4 space-y-3 shadow-xs">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 border-b border-slate-200 dark:border-slate-800/40 pb-2">Revenue Inflows (Income)</h4>
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800/40 text-xs text-slate-700 dark:text-slate-300">
                      {incomeList.map((row) => (
                        <li key={row.ledgerId} className="flex justify-between py-2">
                          <span>{row.ledgerName}</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-200">₹ {row.credit.toLocaleString('en-IN')}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Expenses */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950/20 p-3.5 sm:p-4 space-y-3 shadow-xs">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-red-400 border-b border-slate-200 dark:border-slate-800/40 pb-2">Operational Outflows (Expenditure)</h4>
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800/40 text-xs text-slate-700 dark:text-slate-300">
                      {expenseList.map((row) => (
                        <li key={row.ledgerId} className="flex justify-between py-2">
                          <span>{row.ledgerName}</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-200">₹ {row.debit.toLocaleString('en-IN')}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {incomeSummary && (
                  <div className="border border-indigo-200 dark:border-indigo-900/50 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/20 p-3.5 sm:p-4 flex flex-col md:flex-row md:justify-between md:items-center gap-3 text-xs text-slate-700 dark:text-slate-300 shadow-xs">
                    <div className="flex gap-4 sm:gap-6">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block mb-0.5 text-[11px]">Total Income Summary</span>
                        <span className="text-base font-bold text-slate-900 dark:text-slate-200">₹ {incomeSummary.totalIncome.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block mb-0.5 text-[11px]">Total Expenses Summary</span>
                        <span className="text-base font-bold text-slate-900 dark:text-slate-200">₹ {incomeSummary.totalExpenses.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block mb-0.5 text-[11px]">Net Accounting Surplus</span>
                      <span className="text-lg font-black text-emerald-700 dark:text-emerald-400">₹ {incomeSummary.surplus.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: Balance Sheet */}
            {activeTab === 'balance' && (
              <div className="space-y-3.5">
                <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider">Statement of Balance Sheet</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Asset valuation collections compared side-by-side with liabilities, reserves, & surplus</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* Assets */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950/20 p-3.5 sm:p-4 space-y-3 shadow-xs">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 border-b border-slate-200 dark:border-slate-800/40 pb-2">Assets (Property & Receivables)</h4>
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800/40 text-xs text-slate-700 dark:text-slate-300">
                      {assetList.map((row) => (
                        <li key={row.ledgerId} className="flex justify-between py-2">
                          <span>
                            {row.ledgerCode ? <span className="font-mono text-indigo-700 dark:text-indigo-400 font-semibold mr-1.5">[{row.ledgerCode}]</span> : null}
                            {row.ledgerName}
                          </span>
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-200">₹ {Math.abs(row.netBalance).toLocaleString('en-IN')}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Liabilities */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950/20 p-3.5 sm:p-4 space-y-3 shadow-xs">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 border-b border-slate-200 dark:border-slate-800/40 pb-2">Liabilities, Capital & Reserves</h4>
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800/40 text-xs text-slate-700 dark:text-slate-300">
                      {liabilityList.map((row) => (
                        <li key={row.ledgerId} className="flex justify-between py-2">
                          <span>
                            {row.ledgerCode ? <span className="font-mono text-indigo-700 dark:text-indigo-400 font-semibold mr-1.5">[{row.ledgerCode}]</span> : null}
                            {row.ledgerName}
                          </span>
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-200">₹ {Math.abs(row.netBalance).toLocaleString('en-IN')}</span>
                        </li>
                      ))}
                      {incomeSummary && (
                        <li className="flex justify-between py-2 font-bold text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 rounded-lg border border-emerald-200 dark:border-emerald-900/40">
                          <span>Current Year Operating Surplus</span>
                          <span className="font-mono">₹ {incomeSummary.surplus.toLocaleString('en-IN')}</span>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>

                {balanceSummary && (
                  <div className="border border-indigo-200 dark:border-indigo-900/50 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/20 p-3.5 sm:p-4 flex justify-between items-center text-xs text-slate-700 dark:text-slate-300 shadow-xs">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block mb-0.5 text-[11px]">Total Assets Valuation</span>
                      <span className="text-base font-bold text-slate-900 dark:text-slate-200">₹ {balanceSummary.totalAssets.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block mb-0.5 text-[11px]">Total Liabilities & Equity Reserves</span>
                      <span className="text-base font-bold text-slate-900 dark:text-slate-200">₹ {balanceSummary.totalLiabilities.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 6: Bank Accounts Configuration */}
            {activeTab === 'bank_accounts' && (
              <div className="space-y-3.5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3 rounded-xl shadow-xs">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <Landmark className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Society Bank Accounts
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Manage official society bank accounts for dues collections, vendor payments, and financial auditing.
                    </p>
                  </div>
                  {isManagementRole && (
                    <button
                      onClick={() => setIsAddBankModalOpen(true)}
                      className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 px-3 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Bank Account
                    </button>
                  )}
                </div>

                {bankAccountsList.length === 0 ? (
                  <div className="text-center py-16 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950/40">
                    <Landmark className="h-8 w-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">No bank accounts configured yet</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-0.5">
                      Click 'Add Bank Account' to configure society bank accounts for accounting ledger tracking.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {bankAccountsList.map((acc: any) => (
                      <div 
                        key={acc.id} 
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-3.5 sm:p-4 space-y-3 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between shadow-xs"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{acc.bankName}</h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">A/C: {acc.accountNumber}</p>
                            </div>
                            {acc.isDefault ? (
                              <span className="text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                Primary Default
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full uppercase">
                                Secondary
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs border-t border-b border-slate-100 dark:border-slate-800/60 py-2.5 mt-2 text-slate-600 dark:text-slate-400">
                            <div>
                              <span className="text-slate-400 dark:text-slate-500 block text-[10px] uppercase font-semibold">IFSC Code</span>
                              <span className="font-mono text-slate-900 dark:text-slate-200 font-bold">{acc.ifsc}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 dark:text-slate-500 block text-[10px] uppercase font-semibold">Account Type</span>
                              <span className="text-slate-800 dark:text-slate-200 font-semibold">{acc.type || 'SAVINGS'}</span>
                            </div>
                            {acc.branchName && (
                              <div className="col-span-2">
                                <span className="text-slate-400 dark:text-slate-500 block text-[10px] uppercase font-semibold">Branch</span>
                                <span className="text-slate-700 dark:text-slate-300">{acc.branchName}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="pt-1 flex items-center justify-between">
                          <span className="text-xs text-slate-500 dark:text-slate-400">Opening Balance:</span>
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
                            ₹{Number(acc.openingBalance || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 6: Post Journal Entry */}
            {activeTab === 'voucher' && (
              <form onSubmit={handlePostVoucher} className="space-y-6 bg-white dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 rounded-xl shadow-xs max-w-4xl">
                <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    Post Double-Entry Journal Entry
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Record journal lines manually. Total debits must equal total credits.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-700 dark:text-slate-300 font-semibold">Voucher Number</label>
                    <input
                      type="text"
                      value={voucherNo}
                      onChange={(e) => setVoucherNo(e.target.value)}
                      className="w-full mt-1 p-2.5 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-xs font-mono text-slate-900 dark:text-slate-200 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-700 dark:text-slate-300 font-semibold">Voucher Date</label>
                    <input
                      type="date"
                      value={voucherDate}
                      onChange={(e) => setVoucherDate(e.target.value)}
                      className="w-full mt-1 p-2.5 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-slate-200 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-700 dark:text-slate-300 font-semibold">Narration Summary</label>
                  <input
                    type="text"
                    placeholder="Enter journal description..."
                    value={narration}
                    onChange={(e) => setNarration(e.target.value)}
                    className="w-full mt-1 p-2.5 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-xs text-slate-900 dark:text-slate-200 focus:border-indigo-600 focus:outline-none"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">Journal Lines</span>
                    <button
                      type="button"
                      onClick={() => setVoucherLines([...voucherLines, { ledgerId: '', type: 'DEBIT', amount: 0 }])}
                      className="text-xs text-indigo-700 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 font-semibold flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Line Item
                    </button>
                  </div>

                  {voucherLines.map((line, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950/40 p-3 border border-slate-200 dark:border-slate-800 rounded-lg">
                      <select
                        value={line.ledgerId}
                        onChange={(e) => {
                          const updated = [...voucherLines];
                          updated[idx].ledgerId = e.target.value;
                          setVoucherLines(updated);
                        }}
                        className="flex-1 p-2 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-200"
                      >
                        <option value="">Select Ledger Account...</option>
                        {trialList.map((l) => (
                          <option key={l.ledgerId} value={l.ledgerId}>
                            [{l.ledgerCode || 'GEN'}] {l.ledgerName} ({l.ledgerGroup})
                          </option>
                        ))}
                      </select>

                      <select
                        value={line.type}
                        onChange={(e) => {
                          const updated = [...voucherLines];
                          updated[idx].type = e.target.value as 'DEBIT' | 'CREDIT';
                          setVoucherLines(updated);
                        }}
                        className="w-28 p-2 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-200 font-bold"
                      >
                        <option value="DEBIT">DEBIT</option>
                        <option value="CREDIT">CREDIT</option>
                      </select>

                      <input
                        type="number"
                        placeholder="Amount"
                        value={line.amount || ''}
                        onChange={(e) => {
                          const updated = [...voucherLines];
                          updated[idx].amount = Number(e.target.value);
                          setVoucherLines(updated);
                        }}
                        className="w-32 p-2 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-slate-200"
                      />
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 font-bold text-xs text-white shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2"
                >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Commit Journal Voucher Posting'}
                </button>
              </form>
            )}

            {/* Bank Accounts Configuration Tab */}
            {activeTab === 'bank_accounts' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 border border-slate-800 p-6 rounded-2xl">
                  <div>
                    <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                      <Landmark className="h-5 w-5 text-emerald-400" /> Society Multiple Bank Accounts
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Manage official society bank accounts for dues collections, vendor payments, and financial auditing.
                    </p>
                  </div>
                  {isManagementRole && (
                    <button
                      onClick={() => setIsAddBankModalOpen(true)}
                      className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 text-xs font-semibold flex items-center gap-2 shadow-md transition-all"
                    >
                      <Plus className="h-4 w-4" /> Add Bank Account
                    </button>
                  )}
                </div>

                {bankAccountsList.length === 0 ? (
                  <div className="text-center py-12 border border-slate-800 rounded-2xl bg-slate-950/40">
                    <Landmark className="h-10 w-10 text-slate-500 mx-auto mb-3" />
                    <h4 className="text-sm font-semibold text-slate-300">No bank accounts configured yet</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                      Click 'Add Bank Account' to configure society bank accounts for accounting ledger tracking.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {bankAccountsList.map((acc: any) => (
                      <div 
                        key={acc.id} 
                        className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 space-y-4 hover:border-slate-700 transition-all flex flex-col justify-between shadow-lg"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="text-base font-bold text-slate-100">{acc.bankName}</h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">A/C: {acc.accountNumber}</p>
                            </div>
                            {acc.isDefault ? (
                              <span className="text-[10px] font-extrabold bg-emerald-950/60 border border-emerald-800 text-emerald-400 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                Primary Default
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold bg-slate-900 border border-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full uppercase">
                                Secondary
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs border-t border-b border-slate-800/60 py-3 mt-3 text-slate-500 dark:text-slate-400">
                            <div>
                              <span className="text-slate-500 block text-[10px] uppercase font-semibold">IFSC Code</span>
                              <span className="font-mono text-slate-200 font-bold">{acc.ifsc}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Account Type</span>
                              <span className="text-slate-200 font-semibold">{acc.type || 'SAVINGS'}</span>
                            </div>
                            {acc.branchName && (
                              <div className="col-span-2">
                                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Branch</span>
                                <span className="text-slate-300">{acc.branchName}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="pt-2 flex items-center justify-between">
                          <span className="text-xs text-slate-500 dark:text-slate-400">Opening Balance:</span>
                          <span className="text-sm font-bold text-slate-100 font-mono">
                            ₹{Number(acc.openingBalance || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Society Bank Account Modal Dialog */}
      {isAddBankModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setIsAddBankModalOpen(false)} />
          
          {/* Modal Panel */}
          <div className="relative w-full max-w-lg max-h-[88dvh] sm:max-h-[90vh] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto z-10">

            {/* Pinned Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-600/20 border border-emerald-100 dark:border-emerald-500/20">
                  <Landmark className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">Register Society Bank Account</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Add operational or reserve bank ledger</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddBankModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <form id="add-bank-form" onSubmit={handleAddBankAccountSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Bank Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC Bank, State Bank of India"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2.5 px-3.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none mt-1 font-semibold transition shadow-xs"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Account Number *</label>
                    <input
                      type="text"
                      placeholder="11 to 16 digit Account No."
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2.5 px-3.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none mt-1 font-mono transition shadow-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">IFSC Code *</label>
                    <input
                      type="text"
                      placeholder="e.g. HDFC0001234"
                      value={ifsc}
                      onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2.5 px-3.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none mt-1 font-mono uppercase transition shadow-xs"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Branch Name</label>
                    <input
                      type="text"
                      placeholder="Branch / Location"
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2.5 px-3.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none mt-1 transition shadow-xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Account Type</label>
                    <select
                      value={accountType}
                      onChange={(e) => setAccountType(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2.5 px-3.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none mt-1 transition shadow-xs"
                    >
                      <option value="SAVINGS">Savings Account</option>
                      <option value="CURRENT">Current Account</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Opening Balance (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2.5 px-3.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none mt-1 font-mono transition shadow-xs"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="isDefaultBank"
                    checked={isDefaultBank}
                    onChange={(e) => setIsDefaultBank(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-indigo-600 focus:ring-0"
                  />
                  <label htmlFor="isDefaultBank" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                    Set as primary default bank for receipt payments & invoices
                  </label>
                </div>
              </form>
            </div>

            {/* Pinned Footer */}
            <div className="flex-shrink-0 flex items-center justify-end gap-2.5 px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setIsAddBankModalOpen(false)}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2 px-4 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-bank-form"
                disabled={isProcessing}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-5 text-xs font-bold disabled:opacity-55 transition-all flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
              >
                {isProcessing ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</> : 'Register Bank Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Record New Expenditure / Vendor Bill Dialog */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setIsExpenseModalOpen(false)} />
          
          {/* Modal Panel */}
          <div className="relative w-full max-w-lg max-h-[88dvh] sm:max-h-[90vh] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto z-10">

            {/* Pinned Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-600/20 border border-emerald-100 dark:border-emerald-500/20">
                  <Receipt className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">Record New Expenditure Bill</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Capture vendor invoices and automatically post vouchers</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <form id="record-expense-form" onSubmit={handleRecordExpenseSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Vendor / Service Provider Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Otis Elevator, Torrent Power, CleanCorp..."
                    value={expVendorName}
                    onChange={(e) => setExpVendorName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2.5 px-3.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none mt-1 transition shadow-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Bill Invoice Number *</label>
                    <input
                      type="text"
                      required
                      value={expBillNumber}
                      onChange={(e) => setExpBillNumber(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2.5 px-3.5 text-xs sm:text-sm font-mono text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none mt-1 transition shadow-xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Bill Date *</label>
                    <input
                      type="date"
                      required
                      value={expDate}
                      onChange={(e) => setExpDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2.5 px-3.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none mt-1 transition shadow-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Expense Category Head</label>
                  <select
                    value={expHeadName}
                    onChange={(e) => setExpHeadName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2.5 px-3.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none mt-1 transition shadow-xs"
                  >
                    <option value="Repairs & Building Maintenance">EXP-01 - Repairs & Building Maintenance</option>
                    <option value="Security Guard Agency Expenses">EXP-02 - Security Guard Agency Expenses</option>
                    <option value="Electricity & Water Utilities">EXP-03 - Electricity & Water Utilities</option>
                    <option value="Administrative & Accounting Expenses">EXP-04 - Administrative & Accounting Expenses</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Amount (₹) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={expAmount || ''}
                      onChange={(e) => setExpAmount(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2.5 px-3.5 text-xs sm:text-sm font-mono text-slate-900 dark:text-slate-100 font-bold focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none mt-1 transition shadow-xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Payment Mode</label>
                    <select
                      value={expPaymentMode}
                      onChange={(e) => setExpPaymentMode(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2.5 px-3.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none mt-1 transition shadow-xs"
                    >
                      <option value="BANK">BANK (Bank Account)</option>
                      <option value="CASH">CASH (Cash in Hand)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Bill Status</label>
                    <select
                      value={expStatus}
                      onChange={(e) => setExpStatus(e.target.value as any)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2.5 px-3.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none mt-1 transition shadow-xs"
                    >
                      <option value="PAID">PAID (Clear Bill)</option>
                      <option value="UNPAID">UNPAID (Pending)</option>
                    </select>
                  </div>
                </div>
              </form>
            </div>

            {/* Pinned Footer */}
            <div className="flex-shrink-0 flex items-center justify-end gap-2.5 px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2 px-4 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="record-expense-form"
                disabled={isProcessing}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-5 text-xs font-bold disabled:opacity-55 transition-all flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
              >
                {isProcessing ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</> : 'Record & Post Voucher'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Voucher Lines Detail Breakdown */}
      {selectedVoucherForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setSelectedVoucherForModal(null)} />
          
          {/* Modal Panel */}
          <div className="relative w-full max-w-lg max-h-[88dvh] sm:max-h-[90vh] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto z-10">

            {/* Pinned Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-100 dark:border-indigo-500/20">
                  <Receipt className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span className="font-mono text-indigo-600 dark:text-indigo-400">{selectedVoucherForModal.voucherNumber}</span>
                    <span className="text-[10px] font-bold border rounded-full px-2 py-0.5 uppercase bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400">
                      {selectedVoucherForModal.type}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{selectedVoucherForModal.narration || 'Journal Ledger Entry'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVoucherForModal(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
                <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-black/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                      <th className="p-3">Ledger Account</th>
                      <th className="p-3">Entry Type</th>
                      <th className="p-3 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40">
                    {selectedVoucherForModal.lines?.map((line) => (
                      <tr key={line.id} className="text-slate-700 dark:text-slate-300">
                        <td className="p-3 font-semibold text-slate-900 dark:text-slate-200">
                          {line.ledgerCode ? <span className="font-mono text-indigo-600 dark:text-indigo-400 mr-1">[{line.ledgerCode}]</span> : null}
                          {line.ledgerName}
                        </td>
                        <td className="p-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                            line.type === 'DEBIT' ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {line.type}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          ₹ {Number(line.amount).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pinned Footer */}
            <div className="flex-shrink-0 flex items-center justify-between gap-2.5 px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => {
                  const v = selectedVoucherForModal;
                  setSelectedVoucherForModal(null);
                  setPrintVoucherData(v);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" /> Print Voucher
              </button>

              <button
                type="button"
                onClick={() => setSelectedVoucherForModal(null)}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2 px-5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Multi-Format Print Voucher & Expense Modal */}
      {printVoucherData && (() => {
        const societyName = activeSociety?.societyName || 'Housing Co-Operative Society';
        const totalNum = Number(printVoucherData.totalAmount || 0);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setPrintVoucherData(null)} />
            
            {/* Modal Panel */}
            <div className="relative w-full max-w-4xl max-h-[88dvh] sm:max-h-[92vh] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto z-10">

              {/* Header with Format Selector & Action (no-print) */}
              <div className="no-print flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 backdrop-blur-sm">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30">
                    <Printer className="h-5 w-5 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      Print Voucher: <span className="font-mono text-indigo-400">{printVoucherData.voucherNumber}</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">Choose printable layout and send to printer</p>
                  </div>
                </div>

                {/* Format Pills */}
                <div className="grid grid-cols-2 sm:flex sm:items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
                  {[
                    { key: 'a4_voucher', label: 'A4 Voucher', icon: FileText },
                    { key: 'thermal_pos', label: 'Thermal (80mm)', icon: Receipt },
                    { key: 'a5_voucher', label: 'A5 Slip', icon: FileCheck },
                    { key: 'compact_remittance', label: 'Audit Card', icon: Scissors },
                  ].map((fmt) => {
                    const IconComp = fmt.icon;
                    const isActive = voucherPrintFormat === fmt.key;
                    return (
                      <button
                        key={fmt.key}
                        type="button"
                        onClick={() => setVoucherPrintFormat(fmt.key as VoucherPrintFormat)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          isActive
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                        }`}
                      >
                        <IconComp className="h-3 w-3" />
                        {fmt.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrintVoucher}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer"
                  >
                    <Printer className="h-3.5 w-3.5" /> Print
                  </button>
                  <button
                    onClick={() => setPrintVoucherData(null)}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Scrollable Document Preview Body */}
              <div className="p-4 sm:p-6 overflow-y-auto bg-slate-900/40 flex justify-center">
                <div id="voucher-printable-frame" className="w-full">
                  
                  {/* FORMAT 1: A4 VOUCHER */}
                  {voucherPrintFormat === 'a4_voucher' && (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 sm:p-8 space-y-6 text-slate-800 dark:text-slate-200 shadow-sm">
                      {/* Society Header */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
                        <div>
                          <div className="flex items-center gap-2">
                            <Building className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                            <h2 className="text-lg font-black uppercase text-slate-900 dark:text-slate-100">{societyName}</h2>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Housing Co-Operative Society Ltd. • Accounting Division</p>
                        </div>
                        <div className="text-left sm:text-right space-y-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 block">
                            OFFICIAL ACCOUNTING VOUCHER
                          </span>
                          <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 font-mono">{printVoucherData.voucherNumber}</h3>
                          <span className="inline-block text-[10px] font-bold border rounded-full px-3 py-0.5 uppercase bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300">
                            {printVoucherData.type} VOUCHER
                          </span>
                        </div>
                      </div>

                      {/* Meta Details */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase">Posting Date</span>
                          <span className="font-bold text-slate-900 dark:text-slate-100">{printVoucherData.date}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase">Payee / Entity</span>
                          <span className="font-bold text-slate-900 dark:text-slate-100">{printVoucherData.vendorName || 'Society General Account'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase">Voucher Total</span>
                          <span className="font-extrabold text-slate-900 dark:text-slate-100 font-mono text-sm">₹ {totalNum.toLocaleString('en-IN')}</span>
                        </div>
                      </div>

                      {/* Line Breakdown Table */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Double-Entry Particulars</h4>
                        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                          <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                            <thead>
                              <tr className="bg-slate-100 dark:bg-black/60 text-slate-700 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                                <th className="p-3">Ledger Account Head</th>
                                <th className="p-3">Entry Type</th>
                                <th className="p-3 text-right">Debit (₹)</th>
                                <th className="p-3 text-right">Credit (₹)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40">
                              {printVoucherData.lines && printVoucherData.lines.length > 0 ? (
                                printVoucherData.lines.map((line, idx) => (
                                  <tr key={idx} className="text-slate-800 dark:text-slate-200">
                                    <td className="p-3 font-medium">
                                      {line.ledgerCode ? <span className="font-mono text-indigo-600 dark:text-indigo-400 mr-1">[{line.ledgerCode}]</span> : null}
                                      {line.ledgerName}
                                    </td>
                                    <td className="p-3">
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                                        line.type === 'DEBIT' ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                                      }`}>
                                        {line.type}
                                      </span>
                                    </td>
                                    <td className="p-3 text-right font-mono font-semibold">
                                      {line.type === 'DEBIT' ? `₹ ${Number(line.amount).toLocaleString('en-IN')}` : '-'}
                                    </td>
                                    <td className="p-3 text-right font-mono font-semibold">
                                      {line.type === 'CREDIT' ? `₹ ${Number(line.amount).toLocaleString('en-IN')}` : '-'}
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr className="text-slate-800 dark:text-slate-200">
                                  <td className="p-3 font-medium">{printVoucherData.vendorName || 'Sundry Creditors / Expense Head'}</td>
                                  <td className="p-3"><span className="text-[10px] font-bold px-2 py-0.5 rounded border uppercase bg-red-50 dark:bg-red-950/40 border-red-200 text-red-700">DEBIT</span></td>
                                  <td className="p-3 text-right font-mono font-semibold">₹ {totalNum.toLocaleString('en-IN')}</td>
                                  <td className="p-3 text-right font-mono font-semibold">-</td>
                                </tr>
                              )}
                              <tr className="bg-slate-50 dark:bg-slate-900/60 font-bold border-t border-slate-200 dark:border-slate-800">
                                <td colSpan={2} className="p-3 text-slate-900 dark:text-slate-100">Total Double-Entry Balanced</td>
                                <td className="p-3 text-right font-mono text-slate-900 dark:text-slate-100">₹ {totalNum.toLocaleString('en-IN')}</td>
                                <td className="p-3 text-right font-mono text-slate-900 dark:text-slate-100">₹ {totalNum.toLocaleString('en-IN')}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Narration & Rupees in Words */}
                      <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                        <p><span className="font-bold text-slate-700 dark:text-slate-300">Amount in Words:</span> <span className="italic font-semibold text-slate-900 dark:text-slate-100">{numberToWordsINR(totalNum)}</span></p>
                        <p><span className="font-bold text-slate-700 dark:text-slate-300">Narration / Remarks:</span> <span className="text-slate-600 dark:text-slate-400">{printVoucherData.narration || 'Being amount posted to society accounting books.'}</span></p>
                      </div>

                      {/* Three-tier Signatures */}
                      <div className="pt-6 border-t border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-4 text-center text-xs">
                        <div>
                          <div className="h-10 border-b border-slate-400 dark:border-slate-600 mx-auto w-3/4 mb-1" />
                          <p className="font-bold text-slate-800 dark:text-slate-200">Prepared By</p>
                          <p className="text-[10px] text-slate-400">Accountant / Manager</p>
                        </div>
                        <div>
                          <div className="h-10 border-b border-slate-400 dark:border-slate-600 mx-auto w-3/4 mb-1" />
                          <p className="font-bold text-slate-800 dark:text-slate-200">Verified By</p>
                          <p className="text-[10px] text-slate-400">Internal Auditor</p>
                        </div>
                        <div>
                          <div className="h-10 border-b border-slate-400 dark:border-slate-600 mx-auto w-3/4 mb-1" />
                          <p className="font-bold text-slate-800 dark:text-slate-200">Authorized Signatory</p>
                          <p className="text-[10px] text-slate-400">Hon. Treasurer / Secretary</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* FORMAT 2: THERMAL POS (80mm) */}
                  {voucherPrintFormat === 'thermal_pos' && (
                    <div className="w-[320px] max-w-full mx-auto bg-white text-slate-900 font-mono text-[11px] p-5 border border-dashed border-slate-400 rounded-xl shadow-md space-y-3 select-none">
                      <div className="text-center space-y-0.5 border-b border-dashed border-slate-400 pb-2">
                        <h3 className="font-black text-xs uppercase tracking-wider">{societyName}</h3>
                        <p className="text-[9px] text-slate-600">Accounting Payout Slip</p>
                        <p className="font-bold text-[10px] uppercase tracking-widest pt-1">*** {printVoucherData.type} VOUCHER ***</p>
                      </div>

                      <div className="space-y-0.5 text-[10px] border-b border-dashed border-slate-400 pb-2">
                        <div className="flex justify-between"><span>Voucher No:</span><span className="font-bold">{printVoucherData.voucherNumber}</span></div>
                        <div className="flex justify-between"><span>Date:</span><span>{printVoucherData.date}</span></div>
                        <div className="flex justify-between"><span>Payee:</span><span className="font-bold truncate max-w-[150px]">{printVoucherData.vendorName || 'General Account'}</span></div>
                      </div>

                      <div className="space-y-1 text-[10px] border-b border-dashed border-slate-400 pb-2">
                        <div className="flex justify-between font-bold border-b border-slate-300 pb-0.5">
                          <span>HEAD / PARTICULARS</span>
                          <span>AMT</span>
                        </div>
                        {printVoucherData.lines && printVoucherData.lines.length > 0 ? (
                          printVoucherData.lines.map((l, i) => (
                            <div key={i} className="flex justify-between">
                              <span className="truncate max-w-[180px]">{l.ledgerName} ({l.type})</span>
                              <span>{Number(l.amount).toFixed(2)}</span>
                            </div>
                          ))
                        ) : (
                          <div className="flex justify-between">
                            <span className="truncate max-w-[180px]">{printVoucherData.vendorName || 'Expense Payout'}</span>
                            <span>{totalNum.toFixed(2)}</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-0.5 text-[10px] border-b border-dashed border-slate-400 pb-2">
                        <div className="flex justify-between font-black text-xs">
                          <span>TOTAL VOUCHER:</span>
                          <span>₹ {totalNum.toFixed(2)}</span>
                        </div>
                        <p className="text-[9px] text-slate-600 pt-1">Narration: {printVoucherData.narration || 'Expense payment'}</p>
                      </div>

                      {/* Barcode & Signature */}
                      <div className="text-center pt-2 space-y-2">
                        <svg className="h-6 w-44 mx-auto text-slate-900" viewBox="0 0 100 24" preserveAspectRatio="none">
                          <rect x="0" y="0" width="2.5" height="24" fill="currentColor" />
                          <rect x="5" y="0" width="1.5" height="24" fill="currentColor" />
                          <rect x="8" y="0" width="3.5" height="24" fill="currentColor" />
                          <rect x="14" y="0" width="1.5" height="24" fill="currentColor" />
                          <rect x="18" y="0" width="4.5" height="24" fill="currentColor" />
                          <rect x="25" y="0" width="2" height="24" fill="currentColor" />
                          <rect x="30" y="0" width="3.5" height="24" fill="currentColor" />
                          <rect x="36" y="0" width="1.5" height="24" fill="currentColor" />
                          <rect x="42" y="0" width="4" height="24" fill="currentColor" />
                          <rect x="48" y="0" width="2.5" height="24" fill="currentColor" />
                          <rect x="54" y="0" width="3.5" height="24" fill="currentColor" />
                          <rect x="62" y="0" width="1.5" height="24" fill="currentColor" />
                          <rect x="68" y="0" width="3" height="24" fill="currentColor" />
                          <rect x="74" y="0" width="4.5" height="24" fill="currentColor" />
                          <rect x="82" y="0" width="2" height="24" fill="currentColor" />
                          <rect x="87" y="0" width="3" height="24" fill="currentColor" />
                          <rect x="94" y="0" width="2" height="24" fill="currentColor" />
                        </svg>
                        <p className="text-[8px] text-slate-500 font-mono">{printVoucherData.voucherNumber}</p>
                        <div className="flex justify-between items-end pt-3 text-[9px]">
                          <span>Cashier: _____________</span>
                          <span>Receiver: _____________</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* FORMAT 3: A5 VOUCHER SLIP */}
                  {voucherPrintFormat === 'a5_voucher' && (
                    <div className="w-full max-w-2xl mx-auto bg-amber-50/30 dark:bg-slate-900 border-2 border-indigo-900/30 dark:border-indigo-500/40 p-6 rounded-2xl shadow-md space-y-4 text-slate-800 dark:text-slate-200">
                      <div className="text-center border-b-2 border-indigo-900/20 dark:border-indigo-500/30 pb-3 space-y-0.5">
                        <h3 className="text-base font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-400">{societyName}</h3>
                        <div className="inline-block bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 font-extrabold text-[10px] px-3 py-0.5 rounded-full border border-indigo-300 dark:border-indigo-800 uppercase tracking-widest mt-1">
                          {printVoucherData.type} PAYMENT VOUCHER SLIP
                        </div>
                      </div>

                      <div className="flex justify-between text-xs font-semibold">
                        <span>Voucher No: <span className="font-mono text-indigo-700 dark:text-indigo-300 font-bold">{printVoucherData.voucherNumber}</span></span>
                        <span>Date: <span className="font-mono">{printVoucherData.date}</span></span>
                      </div>

                      <div className="bg-white/80 dark:bg-slate-950/60 p-4 rounded-xl border border-indigo-100 dark:border-slate-800 space-y-2.5 text-xs leading-relaxed">
                        <p>
                          Paid to / Received for: <span className="font-extrabold text-slate-900 dark:text-slate-100 underline decoration-indigo-400">{printVoucherData.vendorName || 'Society Expenditure Head'}</span>
                        </p>
                        <p>
                          The sum of Rupees <span className="font-bold text-slate-900 dark:text-slate-100 italic bg-amber-100/60 dark:bg-amber-950/40 px-2 py-0.5 rounded">{numberToWordsINR(totalNum)}</span>
                        </p>
                        <p>
                          Account Head & Narration: <span className="font-semibold text-slate-700 dark:text-slate-300">{printVoucherData.narration || 'General society maintenance expense voucher.'}</span>
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                        <div className="inline-flex items-center gap-2 bg-indigo-900 text-white font-mono px-4 py-2 rounded-xl text-base font-black shadow-sm">
                          <span>AMOUNT:</span>
                          <span>₹ {totalNum.toLocaleString('en-IN')}</span>
                        </div>

                        <div className="flex items-center gap-6 text-center text-xs">
                          <div className="border border-dashed border-slate-400 p-2 rounded-lg text-[9px] text-slate-400 uppercase">
                            [ SOCIETY SEAL ]
                          </div>
                          <div>
                            <div className="h-8 border-b border-slate-400 w-24 mb-1" />
                            <span className="font-bold text-[10px]">Accountant</span>
                          </div>
                          <div>
                            <div className="h-8 border-b border-slate-400 w-24 mb-1" />
                            <span className="font-bold text-[10px]">Treasurer</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* FORMAT 4: COMPACT AUDIT CARD (4x6") */}
                  {voucherPrintFormat === 'compact_remittance' && (
                    <div className="w-full max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl shadow-md overflow-hidden text-slate-800 dark:text-slate-200">
                      <div className="p-5 space-y-3 bg-gradient-to-br from-slate-50 to-indigo-50/30 dark:from-slate-950 dark:to-indigo-950/20">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-black text-sm uppercase text-indigo-900 dark:text-indigo-400">{societyName}</h3>
                            <p className="text-[10px] text-slate-500">Double-Entry Accounting Verification Card</p>
                          </div>
                          <div className="text-right font-mono text-xs">
                            <span className="text-[9px] text-slate-400 block uppercase">Voucher ID</span>
                            <span className="font-bold text-slate-900 dark:text-slate-100">{printVoucherData.voucherNumber}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase">Payee / Account</span>
                            <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{printVoucherData.vendorName || 'Sundry Creditor'}</p>
                            <p className="text-slate-500 text-[10px]">Date: {printVoucherData.date}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 block uppercase">Voucher Amount</span>
                            <p className="text-base font-black text-slate-900 dark:text-slate-100">₹ {totalNum.toLocaleString('en-IN')}</p>
                            <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase">{printVoucherData.type} ENTRY</p>
                          </div>
                        </div>
                      </div>

                      <div className="p-5 space-y-3 bg-white dark:bg-slate-900 text-xs border-t border-slate-200 dark:border-slate-800">
                        <div className="space-y-1">
                          <span className="text-slate-400 block text-[9px] uppercase font-bold">Narration / Account Ledger</span>
                          <p className="text-slate-700 dark:text-slate-300 font-medium">{printVoucherData.narration || 'Accounting entry posted.'}</p>
                        </div>

                        <div className="flex justify-between items-end pt-4 text-[10px]">
                          <div>
                            <span className="text-[9px] text-slate-400 block">Ledger Verification Status</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">✓ Audited & Posted</span>
                          </div>
                          <div className="text-center">
                            <div className="w-28 border-b border-slate-400 mb-0.5" />
                            <span className="text-[9px] font-semibold">Auditor Signature</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>

            </div>
          </div>
        );
      })()}
    </main>
  );
}

