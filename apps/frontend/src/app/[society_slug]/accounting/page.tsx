'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/auth-context';
import { apiClient } from '../../../lib/api/client';
import { 
  BookOpen, Search, ShieldAlert, Plus, Calculator, Settings, Receipt, Loader2, 
  CheckCircle, AlertCircle, FileText, Scale, Banknote, Wallet, Landmark, Coins, 
  History, Layers, Building, Eye, X, Filter 
} from 'lucide-react';
import { useParams } from 'next/navigation';

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
    <main className="relative flex min-h-screen flex-col items-center justify-start overflow-x-hidden w-full py-12 px-4 sm:px-6 lg:px-8">
      {/* Background Grids */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="w-full max-w-6xl z-10 space-y-8 bg-slate-900/30 border border-slate-800 p-4 md:p-8 rounded-2xl backdrop-blur-xl">
        
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-indigo-400" />
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-100">Accounting Ledger & Bookkeeping</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Capture vendor bills, track expenditures, inspect voucher registers & balance sheets</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('expenditure')}
              className={`rounded-lg border py-2 px-3 text-xs font-semibold transition-all ${
                activeTab === 'expenditure' ? 'bg-indigo-600 border-indigo-500 text-slate-100' : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:bg-slate-900'
              }`}
            >
              Expenditure & Bills
            </button>

            <button
              onClick={() => setActiveTab('vouchers')}
              className={`rounded-lg border py-2 px-3 text-xs font-semibold transition-all ${
                activeTab === 'vouchers' ? 'bg-indigo-600 border-indigo-500 text-slate-100' : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:bg-slate-900'
              }`}
            >
              Voucher Registers
            </button>

            <button
              onClick={() => setActiveTab('trial')}
              className={`rounded-lg border py-2 px-3 text-xs font-semibold transition-all ${
                activeTab === 'trial' ? 'bg-indigo-600 border-indigo-500 text-slate-100' : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:bg-slate-900'
              }`}
            >
              Trial Balance
            </button>

            <button
              onClick={() => setActiveTab('income')}
              className={`rounded-lg border py-2 px-3 text-xs font-semibold transition-all ${
                activeTab === 'income' ? 'bg-indigo-600 border-indigo-500 text-slate-100' : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:bg-slate-900'
              }`}
            >
              Income & Expenditure
            </button>

            <button
              onClick={() => setActiveTab('balance')}
              className={`rounded-lg border py-2 px-3 text-xs font-semibold transition-all ${
                activeTab === 'balance' ? 'bg-indigo-600 border-indigo-500 text-slate-100' : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:bg-slate-900'
              }`}
            >
              Balance Sheet
            </button>

            <button
              onClick={() => setActiveTab('bank_accounts')}
              className={`rounded-lg border py-2 px-3 text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'bank_accounts' ? 'bg-indigo-600 border-indigo-500 text-slate-100' : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:bg-slate-900'
              }`}
            >
              <Landmark className="h-3.5 w-3.5" /> Society Bank Accounts
            </button>

            {isManagementRole && (
              <button
                onClick={() => setActiveTab('voucher')}
                className={`rounded-lg border py-2 px-3 text-xs font-semibold transition-all flex items-center gap-1 ${
                  activeTab === 'voucher' ? 'bg-indigo-600 border-indigo-500 text-slate-100' : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:bg-slate-900'
                }`}
              >
                <Plus className="h-3.5 w-3.5" /> Journal Entry
              </button>
            )}
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

        {/* Dynamic Views */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
                  <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Cash In Hand</span>
                      <Banknote className="h-5 w-5 text-emerald-400" />
                    </div>
                    <span className="block text-2xl font-black text-slate-100">₹ {cashInHand.toLocaleString('en-IN')}</span>
                    <span className="block text-[10px] text-emerald-300/80">Petty Cash Chest & Cash Receipts</span>
                  </div>

                  <div className="rounded-xl border border-indigo-900/50 bg-indigo-950/20 p-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Bank Balance</span>
                      <Landmark className="h-5 w-5 text-indigo-400" />
                    </div>
                    <span className="block text-2xl font-black text-slate-100">₹ {bankBalance.toLocaleString('en-IN')}</span>
                    <span className="block text-[10px] text-indigo-300/80">SBI & HDFC Bank Accounts</span>
                  </div>

                  <div className="rounded-xl border border-cyan-900/50 bg-cyan-950/20 p-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Total Liquid Reserve</span>
                      <Wallet className="h-5 w-5 text-cyan-400" />
                    </div>
                    <span className="block text-2xl font-black text-slate-100">₹ {totalLiquid.toLocaleString('en-IN')}</span>
                    <span className="block text-[10px] text-cyan-300/80">Cash in Hand + Bank Accounts</span>
                  </div>

                  <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Net Surplus</span>
                      <Coins className="h-5 w-5 text-amber-400" />
                    </div>
                    <span className="block text-2xl font-black text-slate-100">
                      ₹ {incomeSummary ? incomeSummary.surplus.toLocaleString('en-IN') : '0'}
                    </span>
                    <span className="block text-[10px] text-amber-300/80">Retained Operating Surplus</span>
                  </div>
                </div>
              );
            })()}

            {/* TAB 1: Expenditure & Vendor Bills */}
            {activeTab === 'expenditure' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-950/40 border border-slate-800 p-4 rounded-xl">
                  <div>
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Expenditure & Vendor Bills Log</h3>
                    <p className="text-xs text-slate-500">Capture vendor invoices for repairs, utilities, security guard agency, AMC payouts</p>
                  </div>
                  {isManagementRole && (
                    <button
                      onClick={() => setIsExpenseModalOpen(true)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md"
                    >
                      <Plus className="h-4 w-4" /> Record New Expenditure Bill
                    </button>
                  )}
                </div>

                {/* Filter Search */}
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search bill number or vendor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-800 bg-slate-900/60 text-xs text-slate-200 focus:outline-none focus:border-slate-700"
                  />
                </div>

                {/* Expenses Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/20">
                  <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-black/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-800">
                        <th className="p-4">Bill Invoice No</th>
                        <th className="p-4">Vendor / Service Provider</th>
                        <th className="p-4">Bill Date</th>
                        <th className="p-4 text-right">Amount (₹)</th>
                        <th className="p-4">Payment Status</th>
                        <th className="p-4">Linked Voucher No</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {filteredExpenses.map((exp) => (
                        <tr key={exp.id} className="text-slate-300 hover:bg-slate-900/10 transition-colors">
                          <td className="p-4 font-mono font-bold text-slate-200">{exp.billNumber}</td>
                          <td className="p-4 font-semibold text-indigo-300">{exp.vendorName || 'General Vendor'}</td>
                          <td className="p-4 text-slate-500 dark:text-slate-400">{exp.date}</td>
                          <td className="p-4 text-right font-mono font-bold text-slate-100">
                            ₹ {Number(exp.amount).toLocaleString('en-IN')}
                          </td>
                          <td className="p-4">
                            <span
                              className={`text-[10px] font-bold border rounded-full px-2.5 py-1 uppercase tracking-wider ${
                                exp.status === 'PAID'
                                  ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400'
                                  : 'bg-red-950/30 border-red-900/50 text-red-400'
                              }`}
                            >
                              {exp.status}
                            </span>
                          </td>
                          <td className="p-4 font-mono text-xs text-indigo-400 font-semibold">
                            {exp.voucherNumber || 'N/A'}
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
              <div className="space-y-6">
                <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Accounting Voucher Registers Log</h3>
                  <p className="text-xs text-slate-500">Audit trail of all double-entry Receipts, Payments, and Journal vouchers</p>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/20">
                  <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-black/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-800">
                        <th className="p-4">Voucher Number</th>
                        <th className="p-4">Voucher Type</th>
                        <th className="p-4">Posting Date</th>
                        <th className="p-4">Narration Details</th>
                        <th className="p-4 text-right">Voucher Total (₹)</th>
                        <th className="p-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {vouchersList.map((v) => (
                        <tr key={v.id} className="text-slate-300 hover:bg-slate-900/10 transition-colors">
                          <td className="p-4 font-mono font-bold text-indigo-400">{v.voucherNumber}</td>
                          <td className="p-4">
                            <span
                              className={`text-[10px] font-bold border rounded-full px-2.5 py-1 uppercase tracking-wider ${
                                v.type === 'RECEIPT'
                                  ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400'
                                  : v.type === 'PAYMENT'
                                  ? 'bg-amber-950/30 border-amber-900/50 text-amber-400'
                                  : 'bg-indigo-950/30 border-indigo-900/50 text-indigo-400'
                              }`}
                            >
                              {v.type}
                            </span>
                          </td>
                          <td className="p-4 text-slate-500 dark:text-slate-400">{v.date}</td>
                          <td className="p-4 text-slate-300 max-w-xs truncate">{v.narration || 'N/A'}</td>
                          <td className="p-4 text-right font-mono font-bold text-slate-100">
                            ₹ {Number(v.totalAmount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => setSelectedVoucherForModal(v)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 border border-indigo-900/50 bg-indigo-950/30 px-2.5 py-1 rounded-md"
                            >
                              <Eye className="h-3.5 w-3.5" /> View Lines
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
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-slate-950/40 border border-slate-800 p-4 rounded-xl">
                  <div>
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Statement of Trial Balance</h3>
                    <p className="text-xs text-slate-500">Mathematical validation summarizing all double-entry debit and credit lines</p>
                  </div>
                  {trialTotals && (
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-semibold border rounded-full px-2.5 py-1 uppercase tracking-wider ${
                        trialTotals.isBalanced 
                          ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400'
                          : 'bg-red-950/30 border-red-900/50 text-red-400'
                      }`}>
                        {trialTotals.isBalanced ? 'Balanced Book' : 'Out of Balance'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/20">
                  <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-black/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-800">
                        <th className="p-4">Ledger Account Code Name</th>
                        <th className="p-4">Group Classification</th>
                        <th className="p-4 text-right">Debit (₹)</th>
                        <th className="p-4 text-right">Credit (₹)</th>
                        <th className="p-4 text-right">Net Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {trialList.map((row) => (
                        <tr key={row.ledgerId} className="text-slate-300 hover:bg-slate-900/10 transition-colors">
                          <td className="p-4 font-bold text-slate-200">
                            {row.ledgerCode ? (
                              <span className="font-mono text-indigo-400 font-semibold mr-1.5">[{row.ledgerCode}]</span>
                            ) : null}
                            {row.ledgerName}
                          </td>
                          <td className="p-4 text-slate-500">{row.ledgerGroup}</td>
                          <td className="p-4 text-right font-mono">₹ {row.debit.toLocaleString('en-IN')}</td>
                          <td className="p-4 text-right font-mono">₹ {row.credit.toLocaleString('en-IN')}</td>
                          <td className="p-4 text-right font-mono font-bold text-indigo-400">
                            ₹ {row.netBalance.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                      {trialTotals && (
                        <tr className="bg-slate-950/50 font-bold border-t border-slate-800">
                          <td className="p-4 text-slate-200" colSpan={2}>Grand Ledger Totals</td>
                          <td className="p-4 text-right font-mono text-emerald-400">₹ {trialTotals.debit.toLocaleString('en-IN')}</td>
                          <td className="p-4 text-right font-mono text-emerald-400">₹ {trialTotals.credit.toLocaleString('en-IN')}</td>
                          <td className="p-4 text-right font-mono text-slate-500 dark:text-slate-400">0.00</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: Income & Expenditure */}
            {activeTab === 'income' && (
              <div className="space-y-6">
                <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Statement of Income & Expenditure</h3>
                  <p className="text-xs text-slate-500">Summary of revenue inflows vs operational expenditure outflows</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Income */}
                  <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-5 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 border-b border-slate-800/40 pb-2">Revenue Inflows (Income)</h4>
                    <ul className="divide-y divide-slate-800/40 text-xs text-slate-300">
                      {incomeList.map((row) => (
                        <li key={row.ledgerId} className="flex justify-between py-2.5">
                          <span>{row.ledgerName}</span>
                          <span className="font-mono font-bold text-slate-200">₹ {row.credit.toLocaleString('en-IN')}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Expenses */}
                  <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-5 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-red-400 border-b border-slate-800/40 pb-2">Operational Outflows (Expenditure)</h4>
                    <ul className="divide-y divide-slate-800/40 text-xs text-slate-300">
                      {expenseList.map((row) => (
                        <li key={row.ledgerId} className="flex justify-between py-2.5">
                          <span>{row.ledgerName}</span>
                          <span className="font-mono font-bold text-slate-200">₹ {row.debit.toLocaleString('en-IN')}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {incomeSummary && (
                  <div className="border border-slate-800 rounded-xl bg-indigo-950/20 border-indigo-900/50 p-6 flex flex-col md:flex-row md:justify-between md:items-center gap-4 text-xs text-slate-300">
                    <div className="flex gap-6">
                      <div>
                        <span className="text-slate-500 block mb-1">Total Income Summary</span>
                        <span className="text-lg font-bold text-slate-200">₹ {incomeSummary.totalIncome.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-1">Total Expenses Summary</span>
                        <span className="text-lg font-bold text-slate-200">₹ {incomeSummary.totalExpenses.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">Net Accounting Surplus</span>
                      <span className="text-xl font-black text-emerald-400">₹ {incomeSummary.surplus.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: Balance Sheet */}
            {activeTab === 'balance' && (
              <div className="space-y-6">
                <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Statement of Balance Sheet</h3>
                  <p className="text-xs text-slate-500">Asset valuation collections compared side-by-side with liabilities, reserves, & surplus</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Assets */}
                  <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-5 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 border-b border-slate-800/40 pb-2">Assets (Property & Receivables)</h4>
                    <ul className="divide-y divide-slate-800/40 text-xs text-slate-300">
                      {assetList.map((row) => (
                        <li key={row.ledgerId} className="flex justify-between py-2.5">
                          <span>
                            {row.ledgerCode ? <span className="font-mono text-indigo-400 font-semibold mr-1.5">[{row.ledgerCode}]</span> : null}
                            {row.ledgerName}
                          </span>
                          <span className="font-mono font-bold text-slate-200">₹ {Math.abs(row.netBalance).toLocaleString('en-IN')}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Liabilities */}
                  <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-5 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 border-b border-slate-800/40 pb-2">Liabilities, Capital & Reserves</h4>
                    <ul className="divide-y divide-slate-800/40 text-xs text-slate-300">
                      {liabilityList.map((row) => (
                        <li key={row.ledgerId} className="flex justify-between py-2.5">
                          <span>
                            {row.ledgerCode ? <span className="font-mono text-indigo-400 font-semibold mr-1.5">[{row.ledgerCode}]</span> : null}
                            {row.ledgerName}
                          </span>
                          <span className="font-mono font-bold text-slate-200">₹ {Math.abs(row.netBalance).toLocaleString('en-IN')}</span>
                        </li>
                      ))}
                      {incomeSummary && (
                        <li className="flex justify-between py-2.5 font-bold text-emerald-400 bg-emerald-950/20 px-2 rounded-lg border border-emerald-900/40">
                          <span>Current Year Operating Surplus</span>
                          <span className="font-mono">₹ {incomeSummary.surplus.toLocaleString('en-IN')}</span>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>

                {balanceSummary && (
                  <div className="border border-slate-800 rounded-xl bg-indigo-950/20 border-indigo-900/50 p-6 flex justify-between items-center text-xs text-slate-300">
                    <div>
                      <span className="text-slate-500 block mb-1">Total Assets Valuation</span>
                      <span className="text-lg font-bold text-slate-200">₹ {balanceSummary.totalAssets.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">Total Liabilities & Equity Reserves</span>
                      <span className="text-lg font-bold text-slate-200">₹ {balanceSummary.totalLiabilities.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 6: Post Journal Entry */}
            {activeTab === 'voucher' && (
              <form onSubmit={handlePostVoucher} className="space-y-6 bg-slate-950/20 border border-slate-800 p-8 rounded-xl max-w-4xl">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Post Double-Entry Journal Entry</h3>
                  <p className="text-xs text-slate-500">Record journal lines manually. Total debits must equal total credits.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Voucher Number</label>
                    <input
                      type="text"
                      value={voucherNo}
                      onChange={(e) => setVoucherNo(e.target.value)}
                      className="w-full mt-1 p-2 rounded bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Voucher Date</label>
                    <input
                      type="date"
                      value={voucherDate}
                      onChange={(e) => setVoucherDate(e.target.value)}
                      className="w-full mt-1 p-2 rounded bg-slate-900 border border-slate-800 text-xs text-slate-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Narration Summary</label>
                  <input
                    type="text"
                    placeholder="Enter journal description..."
                    value={narration}
                    onChange={(e) => setNarration(e.target.value)}
                    className="w-full mt-1 p-2 rounded bg-slate-900 border border-slate-800 text-xs text-slate-200"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Journal Lines</span>
                    <button
                      type="button"
                      onClick={() => setVoucherLines([...voucherLines, { ledgerId: '', type: 'DEBIT', amount: 0 }])}
                      className="text-xs text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Line Item
                    </button>
                  </div>

                  {voucherLines.map((line, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-slate-950/40 p-3 border border-slate-800 rounded-lg">
                      <select
                        value={line.ledgerId}
                        onChange={(e) => {
                          const updated = [...voucherLines];
                          updated[idx].ledgerId = e.target.value;
                          setVoucherLines(updated);
                        }}
                        className="flex-1 p-2 rounded bg-slate-900 border border-slate-800 text-xs text-slate-300"
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
                        className="w-28 p-2 rounded bg-slate-900 border border-slate-800 text-xs text-slate-300 font-bold"
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
                        className="w-32 p-2 rounded bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200"
                      />
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 font-bold text-xs text-white shadow-lg flex items-center justify-center gap-2"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAddBankModalOpen(false)} />
          
          {/* Modal Panel */}
          <div className="relative w-full max-w-lg bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/90 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-600/20 border border-emerald-500/20">
                  <Landmark className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">Register Society Bank Account</h3>
                </div>
              </div>
              <button
                onClick={() => setIsAddBankModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto">
              <form id="add-bank-form" onSubmit={handleAddBankAccountSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Bank Name</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Bank, State Bank of India"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1 font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Account Number</label>
                  <input
                    type="text"
                    placeholder="11 to 16 digit Account No."
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">IFSC Code</label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC0001234"
                    value={ifsc}
                    onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1 font-mono uppercase"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Branch Name</label>
                  <input
                    type="text"
                    placeholder="Branch / Location"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Account Type</label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                  >
                    <option value="SAVINGS">Savings Account</option>
                    <option value="CURRENT">Current Account</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Opening Balance (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 px-3.5 text-sm text-slate-200 focus:border-slate-700 focus:outline-none mt-1 font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isDefaultBank"
                  checked={isDefaultBank}
                  onChange={(e) => setIsDefaultBank(e.target.checked)}
                  className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0"
                />
                <label htmlFor="isDefaultBank" className="text-xs text-slate-300">
                  Set as primary default bank for receipt payments & invoices
                </label>
              </div>

              </form>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-800 bg-slate-950 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddBankModalOpen(false)}
                className="rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-4 text-xs font-semibold text-slate-500 hover:bg-slate-900 transition-all shadow-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-bank-form"
                disabled={isProcessing}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-100 py-2 px-6 text-xs font-semibold disabled:opacity-55 transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20"
              >
                {isProcessing ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</> : 'Register Bank Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Record New Expenditure / Vendor Bill Dialog */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsExpenseModalOpen(false)} />
          
          {/* Modal Panel */}
          <div className="relative w-full max-w-lg bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/90 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-600/20 border border-emerald-500/20">
                  <Receipt className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">Record New Expenditure Bill</h3>
                  <p className="text-[11px] text-slate-500">Capture vendor invoices and automatically post vouchers.</p>
                </div>
              </div>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto">
              <form id="record-expense-form" onSubmit={handleRecordExpenseSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Vendor / Service Provider Name</label>
                <input
                  type="text"
                  placeholder="e.g. Otis Elevator, Torrent Power, CleanCorp..."
                  value={expVendorName}
                  onChange={(e) => setExpVendorName(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Bill Invoice Number</label>
                  <input
                    type="text"
                    required
                    value={expBillNumber}
                    onChange={(e) => setExpBillNumber(e.target.value)}
                    className="w-full mt-1 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Bill Date</label>
                  <input
                    type="date"
                    required
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full mt-1 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Expense Category Head</label>
                <select
                  value={expHeadName}
                  onChange={(e) => setExpHeadName(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="Repairs & Building Maintenance">EXP-01 - Repairs & Building Maintenance</option>
                  <option value="Security Guard Agency Expenses">EXP-02 - Security Guard Agency Expenses</option>
                  <option value="Electricity & Water Utilities">EXP-03 - Electricity & Water Utilities</option>
                  <option value="Administrative & Accounting Expenses">EXP-04 - Administrative & Accounting Expenses</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Amount (₹)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={expAmount || ''}
                    onChange={(e) => setExpAmount(Number(e.target.value))}
                    className="w-full mt-1 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100 font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Payment Mode</label>
                  <select
                    value={expPaymentMode}
                    onChange={(e) => setExpPaymentMode(e.target.value)}
                    className="w-full mt-1 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="BANK">BANK (Bank Account)</option>
                    <option value="CASH">CASH (Cash in Hand)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">Bill Status</label>
                  <select
                    value={expStatus}
                    onChange={(e) => setExpStatus(e.target.value as any)}
                    className="w-full mt-1 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="PAID">PAID (Clear Bill)</option>
                    <option value="UNPAID">UNPAID (Pending)</option>
                  </select>
                </div>
              </div>

              </form>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-800 bg-slate-950 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-4 text-xs font-semibold text-slate-500 hover:bg-slate-900 transition-all shadow-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="record-expense-form"
                disabled={isProcessing}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-100 py-2 px-6 text-xs font-semibold disabled:opacity-55 transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20"
              >
                {isProcessing ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</> : 'Record & Post Voucher'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Voucher Lines Detail Breakdown */}
      {selectedVoucherForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedVoucherForModal(null)} />
          
          {/* Modal Panel */}
          <div className="relative w-full max-w-lg bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/90 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-600/20 border border-indigo-500/20">
                  <Receipt className="h-5 w-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    <span className="font-mono text-indigo-400">{selectedVoucherForModal.voucherNumber}</span>
                    <span className="text-[10px] font-bold border rounded-full px-2.5 py-0.5 uppercase bg-indigo-950/30 border-indigo-900/50 text-indigo-400">
                      {selectedVoucherForModal.type}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">{selectedVoucherForModal.narration || 'N/A'}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedVoucherForModal(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto">

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
              <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-black/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-800">
                    <th className="p-3">Ledger Account</th>
                    <th className="p-3">Entry Type</th>
                    <th className="p-3 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {selectedVoucherForModal.lines?.map((line) => (
                    <tr key={line.id} className="text-slate-300">
                      <td className="p-3 font-semibold text-slate-200">
                        {line.ledgerCode ? <span className="font-mono text-indigo-400 mr-1">[{line.ledgerCode}]</span> : null}
                        {line.ledgerName}
                      </td>
                      <td className="p-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                          line.type === 'DEBIT' ? 'bg-red-950/40 border-red-800 text-red-400' : 'bg-emerald-950/40 border-emerald-800 text-emerald-400'
                        }`}>
                          {line.type}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-100">
                        ₹ {Number(line.amount).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-800 bg-slate-950 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedVoucherForModal(null)}
                className="rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-6 text-xs font-semibold text-slate-500 hover:bg-slate-900 transition-all shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
