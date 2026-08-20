'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../providers/auth-context';
import { apiClient } from '../../../../lib/api/client';
import {
  FileCode2,
  Star,
  Play,
  Plus,
  Edit3,
  Trash2,
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertCircle,
  Download,
  Search,
  RefreshCw,
  X,
  Database,
  Sparkles,
  Table,
  AlertTriangle,
  Code2,
  PlusCircle,
  Hash,
  Calendar,
  AlignLeft,
  List,
  ChevronRight,
  Info,
  BarChart3,
  DollarSign,
  Receipt,
  Package,
  Clock,
  Building,
  FileText,
  TrendingUp,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────
type ParamType = 'text' | 'date' | 'date_range' | 'in_list';

interface ReportParam {
  key: string;
  label: string;
  type: ParamType;
  placeholder?: string;
  required?: boolean;
}

interface CustomReport {
  id: string;
  name: string;
  description?: string;
  sqlQuery: string;
  parameters: ReportParam[];
  isFavorite: boolean;
  createdAt: string;
  createdBy?: string;
}

interface ExecutionResult {
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
  truncated: boolean;
}

type ViewMode = 'list' | 'create' | 'edit' | 'execute';

// ─────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────
const PARAM_TYPE_OPTIONS: { value: ParamType; label: string; icon: any; description: string }[] = [
  {
    value: 'text',
    label: 'Text / Number',
    icon: AlignLeft,
    description: 'Single text or numeric value (e.g. flat number, status)',
  },
  {
    value: 'date',
    label: 'Single Date',
    icon: Calendar,
    description: 'Specific date picker (YYYY-MM-DD)',
  },
  {
    value: 'date_range',
    label: 'Date Range (From / To)',
    icon: Calendar,
    description: 'Generates two parameters: key_from and key_to',
  },
  {
    value: 'in_list',
    label: 'List (IN Clause)',
    icon: List,
    description: 'Comma-separated values mapped to SQL ANY array',
  },
];

const SAMPLE_TEMPLATES: Array<{
  name: string;
  description: string;
  sqlQuery: string;
  parameters: ReportParam[];
}> = [
  {
    name: 'Unpaid Invoices & Member Dues Aging',
    description: 'Summarizes unpaid maintenance bills grouped by flat with contact details and aging buckets',
    sqlQuery: `SELECT 
    f.number AS flat_number,
    u.name AS owner_name,
    u.mobile AS contact_number,
    COUNT(b.id) AS unpaid_bills_count,
    SUM(CASE WHEN CURRENT_DATE - b.due_date <= 30 THEN b.amount ELSE 0 END) AS dues_0_30_days,
    SUM(CASE WHEN CURRENT_DATE - b.due_date BETWEEN 31 AND 60 THEN b.amount ELSE 0 END) AS dues_31_60_days,
    SUM(CASE WHEN CURRENT_DATE - b.due_date > 60 THEN b.amount ELSE 0 END) AS dues_over_60_days,
    SUM(b.amount) AS total_outstanding
FROM maintenance_bills b
JOIN flats f ON b.flat_id = f.id
LEFT JOIN flat_owners fo ON fo.flat_id = f.id AND fo.is_current = true AND fo.is_primary = true
LEFT JOIN owners o ON fo.owner_id = o.id
LEFT JOIN users u ON o.user_id = u.id
WHERE b.society_id = :society_id 
  AND b.status IN ('UNPAID', 'PARTIAL', 'OVERDUE')
  AND b.amount >= :min_due_amount
GROUP BY f.number, u.name, u.mobile
ORDER BY total_outstanding DESC;`,
    parameters: [
      {
        key: 'min_due_amount',
        label: 'Minimum Due Amount (₹)',
        type: 'text',
        placeholder: '0 (or minimum amount)',
        required: false,
      },
    ],
  },
  {
    name: 'Payment Collections by Date Range & Mode',
    description: 'Lists all cleared payment receipts filtered by date range and payment mode',
    sqlQuery: `SELECT 
    r.receipt_number,
    r.payment_date,
    f.number AS flat_number,
    f.wing AS wing_name,
    r.amount_paid,
    r.payment_mode,
    r.reference_number AS transaction_ref
FROM maintenance_receipts r
JOIN maintenance_bills b ON r.bill_id = b.id
JOIN flats f ON b.flat_id = f.id
WHERE b.society_id = :society_id
  AND r.payment_date BETWEEN :start_date AND :end_date
  AND (:payment_mode = '' OR r.payment_mode = :payment_mode)
ORDER BY r.payment_date DESC;`,
    parameters: [
      {
        key: 'start_date',
        label: 'From Date',
        type: 'date',
        placeholder: '2026-01-01',
        required: true,
      },
      {
        key: 'end_date',
        label: 'To Date',
        type: 'date',
        placeholder: '2026-12-31',
        required: true,
      },
      {
        key: 'payment_mode',
        label: 'Payment Mode',
        type: 'text',
        placeholder: 'UPI, NEFT, CHEQUE, CASH (or leave blank)',
        required: false,
      },
    ],
  },
  {
    name: 'Resident Directory & Flat Master',
    description: 'Complete member list filtered by Wing with contact and ownership status',
    sqlQuery: `SELECT 
    f.number AS flat_number,
    f.wing AS wing_name,
    f.floor AS floor_number,
    f.carpet_area_sqft,
    u.name AS resident_name,
    u.mobile AS mobile_number,
    u.email
FROM flats f
LEFT JOIN flat_owners fo ON fo.flat_id = f.id AND fo.is_current = true
LEFT JOIN owners o ON fo.owner_id = o.id
LEFT JOIN users u ON o.user_id = u.id
WHERE f.society_id = :society_id
  AND (:wing_filter = '' OR f.wing ILIKE '%' || :wing_filter || '%')
ORDER BY f.wing, f.number;`,
    parameters: [
      {
        key: 'wing_filter',
        label: 'Filter by Wing',
        type: 'text',
        placeholder: 'e.g. A or B (leave blank for all)',
        required: false,
      },
    ],
  },
  {
    name: 'Multi-Wing Member List (IN Clause List)',
    description: 'Filters flats and residents matching multiple wings using the IN clause list parameter',
    sqlQuery: `SELECT 
    f.wing AS wing_name,
    f.number AS flat_number,
    f.floor AS floor_number,
    f.carpet_area_sqft,
    u.name AS resident_name,
    u.mobile AS contact_number,
    u.email
FROM flats f
LEFT JOIN flat_owners fo ON fo.flat_id = f.id AND fo.is_current = true
LEFT JOIN owners o ON fo.owner_id = o.id
LEFT JOIN users u ON o.user_id = u.id
WHERE f.society_id = :society_id
  AND f.wing IN (:wing_list)
ORDER BY f.wing, f.floor, f.number;`,
    parameters: [
      {
        key: 'wing_list',
        label: 'Select Wings (Comma-Separated)',
        type: 'in_list',
        placeholder: 'e.g. A, B, C',
        required: true,
      },
    ],
  },
];

const DEFAULT_SQL_TEMPLATE = `-- Example Custom Query
SELECT 
    m.first_name || ' ' || m.last_name AS member_name,
    m.flat_number,
    m.contact_number,
    m.occupancy_status,
    m.created_at::date AS joined_date
FROM members m
WHERE m.is_active = true
ORDER BY m.flat_number ASC
LIMIT 100;`;

export default function CustomReportsPage() {
  const { society_slug } = useParams();
  const { activeSociety } = useAuth();
  const router = useRouter();

  const role = activeSociety?.role;
  const isSocietyAdmin = role === 'SUPER_ADMIN' || role === 'SOCIETY_ADMIN';

  // Navigation / View state
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedReport, setSelectedReport] = useState<CustomReport | null>(null);

  // List State
  const [reports, setReports] = useState<CustomReport[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // Form State (Create / Edit)
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formSql, setFormSql] = useState(DEFAULT_SQL_TEMPLATE);
  const [formParams, setFormParams] = useState<ReportParam[]>([]);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Execution State
  const [execParams, setExecParams] = useState<Record<string, string>>({});
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<ExecutionResult | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);

  // Notification State
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showAlert = (text: string, type: 'success' | 'error' = 'success') => {
    setAlertMessage({ type, text });
    setTimeout(() => setAlertMessage(null), 6000);
  };

  // ─────────────────────────────────────────────────────────────
  // Fetch Reports List
  // ─────────────────────────────────────────────────────────────
  const fetchReports = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const res = await apiClient.get('/custom-reports');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setReports(res.data.data);
      }
    } catch (err: any) {
      console.error('Failed to load custom reports:', err);
      showAlert(err.response?.data?.message || 'Failed to load custom reports', 'error');
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // ─────────────────────────────────────────────────────────────
  // Form Operations
  // ─────────────────────────────────────────────────────────────
  const handleOpenCreate = () => {
    setSelectedReport(null);
    setFormName('');
    setFormDesc('');
    setFormSql(DEFAULT_SQL_TEMPLATE);
    setFormParams([]);
    setFormError(null);
    setViewMode('create');
  };

  const handleOpenEdit = (report: CustomReport) => {
    setSelectedReport(report);
    setFormName(report.name);
    setFormDesc(report.description || '');
    setFormSql(report.sqlQuery);
    setFormParams(report.parameters || []);
    setFormError(null);
    setViewMode('edit');
  };

  const handleAddParam = () => {
    const newKey = `param_${formParams.length + 1}`;
    setFormParams([
      ...formParams,
      {
        key: newKey,
        label: `Parameter ${formParams.length + 1}`,
        type: 'text',
        placeholder: '',
        required: false,
      },
    ]);
  };

  const handleUpdateParam = (index: number, field: keyof ReportParam, value: any) => {
    const updated = [...formParams];
    updated[index] = { ...updated[index], [field]: value };
    setFormParams(updated);
  };

  const handleRemoveParam = (index: number) => {
    setFormParams(formParams.filter((_, i) => i !== index));
  };

  const handleSaveReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      const msg = 'Report name is required';
      setFormError(msg);
      showAlert(msg, 'error');
      return;
    }
    if (!formSql.trim()) {
      const msg = 'SQL Query is required';
      setFormError(msg);
      showAlert(msg, 'error');
      return;
    }

    // Validate that the query begins with SELECT or WITH
    const cleanedSql = formSql
      .replace(/--[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();

    if (!/^(SELECT|WITH)\b/i.test(cleanedSql)) {
      const msg = 'Only SELECT statements are allowed. The query must start with SELECT.';
      setFormError(msg);
      showAlert(msg, 'error');
      return;
    }

    setFormSubmitting(true);
    try {
      const payload = {
        name: formName.trim(),
        description: formDesc.trim() || undefined,
        sqlQuery: formSql.trim(),
        parameters: formParams,
      };

      if (viewMode === 'edit' && selectedReport) {
        await apiClient.patch(`/custom-reports/${selectedReport.id}`, payload);
        showAlert('Custom report updated successfully!');
      } else {
        await apiClient.post('/custom-reports', payload);
        showAlert('Custom report created successfully!');
      }

      setFormError(null);
      await fetchReports();
      setViewMode('list');
    } catch (err: any) {
      console.error('Failed to save report:', err);
      const serverMsg =
        err.response?.data?.message ||
        err.response?.data?.error?.message ||
        err.message ||
        'Failed to save report. Ensure SQL is a valid SELECT query.';
      setFormError(serverMsg);
      showAlert(serverMsg, 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteReport = async (report: CustomReport) => {
    if (!window.confirm(`Are you sure you want to delete "${report.name}"?`)) return;

    try {
      await apiClient.delete(`/custom-reports/${report.id}`);
      showAlert('Report deleted successfully');
      fetchReports();
    } catch (err: any) {
      showAlert(err.response?.data?.message || 'Failed to delete report', 'error');
    }
  };

  const handleToggleFavorite = async (reportId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await apiClient.post(`/custom-reports/${reportId}/favorite`);
      const favorited = res.data?.data?.favorited;
      setReports((prev) =>
        prev
          .map((r) => (r.id === reportId ? { ...r, isFavorite: favorited } : r))
          .sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0))
      );
    } catch (err: any) {
      showAlert(err.response?.data?.message || 'Failed to update favorite status', 'error');
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Execution Operations
  // ─────────────────────────────────────────────────────────────
  const handleOpenExecute = (report: CustomReport) => {
    setSelectedReport(report);
    // Initialize default parameter values
    const initialParams: Record<string, string> = {};
    (report.parameters || []).forEach((p) => {
      if (p.type === 'date_range') {
        initialParams[`${p.key}_from`] = '';
        initialParams[`${p.key}_to`] = '';
      } else {
        initialParams[p.key] = '';
      }
    });
    setExecParams(initialParams);
    setExecResult(null);
    setViewMode('execute');
  };

  const handleRunQuery = async () => {
    if (!selectedReport) return;
    setExecuting(true);
    try {
      const res = await apiClient.post(`/custom-reports/${selectedReport.id}/execute`, {
        params: execParams,
      });
      if (res.data?.success && res.data.data) {
        setExecResult(res.data.data);
      }
    } catch (err: any) {
      console.error('Execution error:', err);
      showAlert(err.response?.data?.message || 'Query execution failed. Please check parameters and SQL syntax.', 'error');
    } finally {
      setExecuting(false);
    }
  };

  const handleExportCsv = async () => {
    if (!selectedReport) return;
    setExportingCsv(true);
    try {
      const queryParams = new URLSearchParams(execParams).toString();
      const response = await apiClient.get(
        `/custom-reports/${selectedReport.id}/export?${queryParams}`,
        { responseType: 'blob' }
      );

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = selectedReport.name.replace(/[^a-z0-9_\-]/gi, '_').toLowerCase();
      link.setAttribute('download', `${safeName}_report.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showAlert('CSV exported successfully!');
    } catch (err: any) {
      console.error('Export CSV error:', err);
      showAlert(err.response?.data?.message || 'Failed to export CSV', 'error');
    } finally {
      setExportingCsv(false);
    }
  };

  // Filtered reports
  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFav = onlyFavorites ? r.isFavorite : true;
    return matchesSearch && matchesFav;
  });

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-start overflow-x-hidden w-full py-4 sm:py-5 px-3 sm:px-5 lg:px-6">
      {/* Background grid */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#171717_1px,transparent_1px),linear-gradient(to_bottom,#171717_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-40 dark:opacity-100" />

      <div className="w-full max-w-[1600px] mx-auto space-y-3.5 z-10">
        {/* Main Header */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Reports & Analytics Center</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Society financial intelligence, occupancy, complaints & asset insights</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {viewMode !== 'list' && (
              <button
                onClick={() => setViewMode('list')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-neutral-800 bg-white dark:bg-black text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-neutral-900 shadow-xs transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to All Reports
              </button>
            )}
            {isSocietyAdmin && viewMode === 'list' && (
              <button
                onClick={handleOpenCreate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-semibold text-xs shadow-xs transition-all active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" /> Create Custom Report
              </button>
            )}
            <button
              onClick={() => fetchReports()}
              disabled={isLoadingList}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-900 rounded-lg px-3 py-1.5 shadow-xs transition-all"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingList ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Fixed Floating Global Toast Alert (Positioned below top navbar) */}
        {alertMessage && (
          <div className="fixed top-20 right-6 z-[100] max-w-md w-[90vw] sm:w-auto shadow-2xl animate-in fade-in slide-in-from-top-3 duration-200">
            <div
              className={`rounded-2xl border p-4 text-xs flex items-center justify-between gap-3.5 backdrop-blur-xl shadow-xl ${
                alertMessage.type === 'success'
                  ? 'bg-emerald-950/95 border-emerald-500 text-emerald-100 shadow-emerald-950/50'
                  : 'bg-rose-950/95 border-rose-500 text-rose-100 shadow-rose-950/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {alertMessage.type === 'success' ? (
                  <CheckCircle className="h-5 w-5 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
                )}
                <span className="font-bold text-xs sm:text-sm leading-snug">{alertMessage.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setAlertMessage(null)}
                className="p-1 rounded-lg hover:bg-white/20 text-white/80 transition cursor-pointer shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {[
            { id: 'summary', label: 'Summary', icon: FileText, path: `/${society_slug}/reports?tab=summary` },
            { id: 'overview', label: 'Overview', icon: BarChart3, path: `/${society_slug}/reports?tab=overview` },
            { id: 'collection', label: 'Collections', icon: TrendingUp, path: `/${society_slug}/reports?tab=collection` },
            { id: 'maintenance', label: 'Invoices', icon: Receipt, path: `/${society_slug}/reports?tab=maintenance` },
            { id: 'defaulters', label: 'Defaulters', icon: AlertTriangle, path: `/${society_slug}/reports?tab=defaulters` },
            { id: 'complaints', label: 'Complaints', icon: AlertCircle, path: `/${society_slug}/reports?tab=complaints` },
            { id: 'assets', label: 'Assets', icon: Package, path: `/${society_slug}/reports?tab=assets` },
            { id: 'latefee', label: 'Late Fees', icon: Clock, path: `/${society_slug}/reports?tab=latefee` },
            { id: 'occupancy', label: 'Occupancy', icon: Building, path: `/${society_slug}/reports?tab=occupancy` },
            { id: 'custom-sql', label: 'Custom SQL', icon: Code2, path: `/${society_slug}/reports/custom` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id !== 'custom-sql') {
                  router.push(tab.path);
                }
              }}
              className={`flex items-center gap-1.5 whitespace-nowrap px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-all ${
                tab.id === 'custom-sql'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sub-view Breadcrumb (when inside editor/executor) */}
        {viewMode !== 'list' && (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg">
            <button
              onClick={() => setViewMode('list')}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 font-medium flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" /> Custom SQL Reports
            </button>
            <ChevronRight className="h-3 w-3 text-slate-400 dark:text-slate-600" />
            <span className="font-bold text-slate-900 dark:text-slate-100">
              {viewMode === 'create' ? 'Create New Report' : viewMode === 'edit' ? `Edit: ${formName || 'Report'}` : selectedReport?.name || 'Report Execution'}
            </span>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* VIEW 1: LIST OF REPORTS */}
        {/* ═════════════════════════════════════════════════════════════ */}
        {viewMode === 'list' && (
          <div className="space-y-3.5">
            {/* Header Banner */}
            <div className="relative overflow-hidden rounded-xl border border-indigo-200 dark:border-neutral-800 bg-gradient-to-br from-indigo-50/80 via-white to-slate-50 dark:from-neutral-950 dark:via-black dark:to-neutral-950 p-3.5 sm:p-4 backdrop-blur-xl shadow-xs">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-indigo-600/10 dark:bg-indigo-500/20 border border-indigo-500/20 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
                      <Code2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h1 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        Custom SQL Query Engine
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30">
                          Sandbox
                        </span>
                      </h1>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Design parametrized read-only SQL queries, save favorites, preview dataset results, and export CSVs
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchReports()}
                    disabled={isLoadingList}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 text-xs font-semibold shadow-xs transition"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isLoadingList ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
              </div>

              {/* Search & Filters */}
              <div className="mt-3 flex flex-col sm:flex-row gap-2.5 pt-2.5 border-t border-slate-200 dark:border-slate-800/80">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search custom reports by name or keywords..."
                    className="w-full bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 shadow-xs transition"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setOnlyFavorites(!onlyFavorites)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold shadow-xs transition ${
                    onlyFavorites
                      ? 'bg-amber-50 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-300'
                      : 'bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Star className={`h-3.5 w-3.5 ${onlyFavorites ? 'fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400' : ''}`} />
                  Favorites Only
                </button>
              </div>
            </div>

            {/* Reports Grid */}
            {isLoadingList ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500 dark:text-slate-400 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-500" />
                <p className="text-xs font-medium">Loading custom report catalog...</p>
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 text-center">
                <Database className="h-12 w-12 text-slate-400 dark:text-slate-600 mb-3" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-300 mb-1">No custom reports found</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-4">
                  {searchQuery || onlyFavorites
                    ? 'No reports matched your filters. Try clearing your search or favorite toggle.'
                    : 'Create your first custom SQL report to extract customized tabular data and analytics.'}
                </p>
                {isSocietyAdmin && (
                  <button
                    onClick={handleOpenCreate}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition"
                  >
                    <Plus className="h-4 w-4" /> Create First Report
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredReports.map((report) => (
                  <div
                    key={report.id}
                    className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950/60 p-5 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:shadow-lg dark:hover:shadow-indigo-950/10 shadow-xs transition-all duration-300 backdrop-blur-sm"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-600/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition">
                            <FileCode2 className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition">
                              {report.name}
                            </h3>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {new Date(report.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={(e) => handleToggleFavorite(report.id, e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 dark:text-slate-500 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-400/10 transition"
                          title={report.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <Star
                            className={`h-4 w-4 transition ${
                              report.isFavorite ? 'fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400 scale-110' : ''
                            }`}
                          />
                        </button>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                        {report.description || 'No description provided.'}
                      </p>

                      {/* Badges / Parameter count */}
                      <div className="flex items-center gap-2 flex-wrap mb-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-semibold text-slate-700 dark:text-slate-400">
                          <Hash className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                          {(report.parameters || []).length} Param{(report.parameters || []).length !== 1 ? 's' : ''}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-slate-900 border border-indigo-100 dark:border-slate-800 text-[10px] font-mono font-semibold text-indigo-700 dark:text-indigo-400/90">
                          SELECT ONLY
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80 mt-2">
                      <div className="flex items-center gap-1.5">
                        {isSocietyAdmin && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(report)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
                              title="Edit Report Query & Parameters"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteReport(report)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition"
                              title="Delete Report"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>

                      <button
                        onClick={() => handleOpenExecute(report)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600/10 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white text-indigo-700 dark:text-indigo-300 text-xs font-bold shadow-xs transition-all active:scale-95"
                      >
                        <Play className="h-3.5 w-3.5 fill-current" /> Run Report
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* VIEW 2: CREATE / EDIT REPORT FORM */}
        {/* ═════════════════════════════════════════════════════════════ */}
        {(viewMode === 'create' || viewMode === 'edit') && (
          <form onSubmit={handleSaveReport} className="space-y-6">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-6 backdrop-blur-xl shadow-sm dark:shadow-none space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    {viewMode === 'create' ? <PlusCircle className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /> : <Edit3 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
                    {viewMode === 'create' ? 'Create Custom SQL Report' : `Edit Report: ${selectedReport?.name}`}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Define SQL query template and configure interactive user parameters for reports.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Basic Meta Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Report Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Unpaid Invoices with Member Contact"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-950 transition shadow-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Description</label>
                  <input
                    type="text"
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="Brief explanation of the output and purpose of this report"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-950 transition shadow-xs"
                  />
                </div>
              </div>

              {/* SQL Query Editor Area */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    SQL Query (Read-Only SELECT) <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    Use <code className="bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 px-1 py-0.5 rounded font-bold">:parameter_name</code> syntax
                  </span>
                </div>

                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
                  {/* Code Editor Title Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                      <span className="text-slate-800 dark:text-slate-200 font-bold">query.sql</span>
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-full hidden sm:inline-block">
                        PostgreSQL Read-Only
                      </span>
                    </div>

                    {/* Quick Example Template Dropdown */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-600 dark:text-slate-400 font-sans font-semibold">Load Template:</span>
                      <select
                        onChange={(e) => {
                          const idx = Number(e.target.value);
                          if (!isNaN(idx) && SAMPLE_TEMPLATES[idx]) {
                            const tmpl = SAMPLE_TEMPLATES[idx];
                            if (!formName.trim()) setFormName(tmpl.name);
                            if (!formDesc.trim()) setFormDesc(tmpl.description);
                            setFormSql(tmpl.sqlQuery);
                            setFormParams(tmpl.parameters);
                            setFormError(null);
                          }
                          e.target.value = '';
                        }}
                        defaultValue=""
                        className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-800 dark:text-indigo-300 font-sans text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500 shadow-xs cursor-pointer"
                      >
                        <option value="" disabled className="text-slate-400">⚡ Choose a query template...</option>
                        {SAMPLE_TEMPLATES.map((tmpl, i) => (
                          <option key={i} value={i} className="text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800">
                            {tmpl.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <textarea
                    required
                    rows={12}
                    value={formSql}
                    onChange={(e) => setFormSql(e.target.value)}
                    placeholder="SELECT ... FROM members WHERE ..."
                    className="w-full bg-slate-950 font-mono text-xs sm:text-sm text-emerald-300 dark:text-emerald-300 placeholder-slate-500 p-4 leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-500 transition selection:bg-indigo-600/40"
                  />
                </div>

                {/* SQL Hint Box */}
                <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/30 bg-indigo-50/70 dark:bg-indigo-950/20 p-3.5 flex items-start gap-2.5 text-indigo-900 dark:text-indigo-300/90 text-xs">
                  <Info className="h-4 w-4 shrink-0 mt-0.5 text-indigo-600 dark:text-indigo-400" />
                  <div className="space-y-1.5 text-[11px] leading-relaxed">
                    <p className="font-bold text-indigo-900 dark:text-indigo-200">Security & Built-in System Context Parameters:</p>
                    <ul className="list-disc list-inside space-y-1 text-indigo-800/80 dark:text-indigo-300/80">
                      <li>Only <strong className="text-indigo-900 dark:text-indigo-200">SELECT</strong> queries are permitted. Mutation statements (INSERT/UPDATE/DELETE/DROP/ALTER) are blocked.</li>
                      <li><strong className="text-indigo-900 dark:text-indigo-200">Automatic Society Context:</strong> <code className="bg-indigo-100 dark:bg-indigo-900/40 px-1 py-0.5 rounded text-indigo-900 dark:text-indigo-200 font-mono">:society_id</code> is automatically provided by the server from your active society.</li>
                      <li><strong className="text-indigo-900 dark:text-indigo-200">Automatic Logged-in User ID:</strong> <code className="bg-indigo-100 dark:bg-indigo-900/40 px-1 py-0.5 rounded text-indigo-900 dark:text-indigo-200 font-mono">:user_id</code> (or <code className="bg-indigo-100 dark:bg-indigo-900/40 px-1 py-0.5 rounded text-indigo-900 dark:text-indigo-200 font-mono">:current_user_id</code>) is automatically bound to your authenticated user ID. No parameter configuration required.</li>
                      <li>Use custom named parameters like <code className="bg-indigo-100 dark:bg-indigo-900/40 px-1 py-0.5 rounded text-indigo-900 dark:text-indigo-200 font-mono">:status</code>, <code className="bg-indigo-100 dark:bg-indigo-900/40 px-1 py-0.5 rounded text-indigo-900 dark:text-indigo-200 font-mono">:from_date</code>, or <code className="bg-indigo-100 dark:bg-indigo-900/40 px-1 py-0.5 rounded text-indigo-900 dark:text-indigo-200 font-mono">:wing_list</code> for interactive filters configured below.</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Dynamic Parameters Builder */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-300">
                      Dynamic Query Parameters ({formParams.length})
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Configure interactive input widgets shown when executing this report
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddParam}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white text-xs font-bold shadow-xs transition"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Parameter
                  </button>
                </div>

                {formParams.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-6 text-center text-xs text-slate-500">
                    No dynamic parameters defined. The query will run without prompt inputs.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formParams.map((param, index) => (
                      <div
                        key={index}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 p-3.5 grid grid-cols-1 md:grid-cols-12 gap-3 items-center shadow-xs"
                      >
                        {/* Param Key */}
                        <div className="md:col-span-3 space-y-1">
                          <label className="text-[10px] font-mono text-slate-500 dark:text-slate-400">Parameter Key (:key)</label>
                          <input
                            type="text"
                            required
                            value={param.key}
                            onChange={(e) => handleUpdateParam(index, 'key', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                            placeholder="e.g. status"
                            className="w-full bg-white dark:bg-slate-950 font-mono border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-indigo-700 dark:text-indigo-300 focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        {/* Param Label */}
                        <div className="md:col-span-3 space-y-1">
                          <label className="text-[10px] text-slate-500 dark:text-slate-400">Display Label</label>
                          <input
                            type="text"
                            required
                            value={param.label}
                            onChange={(e) => handleUpdateParam(index, 'label', e.target.value)}
                            placeholder="e.g. Invoice Status"
                            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        {/* Param Type */}
                        <div className="md:col-span-3 space-y-1">
                          <label className="text-[10px] text-slate-500 dark:text-slate-400">Input Control Type</label>
                          <select
                            value={param.type}
                            onChange={(e) => handleUpdateParam(index, 'type', e.target.value as ParamType)}
                            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                          >
                            {PARAM_TYPE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Options & Remove */}
                        <div className="md:col-span-3 flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0">
                          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!param.required}
                              onChange={(e) => handleUpdateParam(index, 'required', e.target.checked)}
                              className="rounded border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 text-indigo-600 focus:ring-0"
                            />
                            Required
                          </label>
                          <button
                            type="button"
                            onClick={() => handleRemoveParam(index)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition"
                            title="Remove Parameter"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Inline Form Error Banner */}
              {formError && (
                <div className="rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 p-4 text-xs text-rose-900 dark:text-rose-200 space-y-2.5 shadow-sm animate-in fade-in">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm text-rose-950 dark:text-rose-100">Cannot Save Report</h4>
                      <p className="mt-0.5 text-xs text-rose-800 dark:text-rose-300 leading-relaxed">{formError}</p>
                    </div>
                  </div>
                  {formError.toLowerCase().includes('select') && (
                    <div className="pt-2 border-t border-rose-200 dark:border-rose-900/60 flex items-center gap-2">
                      <span className="text-[11px] text-rose-700 dark:text-rose-300 font-medium">Quick fix:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFormSql(`SELECT\n    ${formSql.trim()}`);
                          setFormError(null);
                        }}
                        className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer"
                      >
                        + Prepend "SELECT" to Query
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-semibold text-xs shadow-xs transition disabled:opacity-50 cursor-pointer active:scale-95"
                >
                  {formSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {viewMode === 'create' ? 'Save & Create Report' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* VIEW 3: EXECUTE REPORT VIEW */}
        {/* ═════════════════════════════════════════════════════════════ */}
        {viewMode === 'execute' && selectedReport && (
          <div className="space-y-3.5">
            {/* Header / Report Information */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-3.5 sm:p-4 backdrop-blur-xl shadow-xs space-y-3">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 pb-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-100 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
                      <Play className="h-4 w-4 fill-current" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{selectedReport.name}</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {selectedReport.description || 'Custom parametrized SQL report'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleFavorite(selectedReport.id, {} as any)}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 shadow-xs transition"
                    title={selectedReport.isFavorite ? 'Starred' : 'Add to Favorites'}
                  >
                    <Star
                      className={`h-4 w-4 ${selectedReport.isFavorite ? 'fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400' : ''}`}
                    />
                  </button>
                  {isSocietyAdmin && (
                    <button
                      onClick={() => handleOpenEdit(selectedReport)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-semibold shadow-xs transition"
                    >
                      <Edit3 className="h-3.5 w-3.5" /> Edit Query
                    </button>
                  )}
                </div>
              </div>

              {/* Dynamic Parameter Form */}
              {(selectedReport.parameters || []).length > 0 && (
                <div className="space-y-2 pt-1">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-400">
                    Query Parameters
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {selectedReport.parameters.map((param) => {
                      if (param.type === 'date_range') {
                        return (
                          <div key={param.key} className="space-y-1 sm:col-span-2">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                              {param.label}
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-[10px] text-slate-500 block mb-0.5">From Date</span>
                                <input
                                  type="date"
                                  value={execParams[`${param.key}_from`] || ''}
                                  onChange={(e) =>
                                    setExecParams({ ...execParams, [`${param.key}_from`]: e.target.value })
                                  }
                                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-950 shadow-xs"
                                />
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 block mb-0.5">To Date</span>
                                <input
                                  type="date"
                                  value={execParams[`${param.key}_to`] || ''}
                                  onChange={(e) =>
                                    setExecParams({ ...execParams, [`${param.key}_to`]: e.target.value })
                                  }
                                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-950 shadow-xs"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (param.type === 'date') {
                        return (
                          <div key={param.key} className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                              {param.label} {param.required && <span className="text-rose-500">*</span>}
                            </label>
                            <input
                              type="date"
                              value={execParams[param.key] || ''}
                              onChange={(e) =>
                                setExecParams({ ...execParams, [param.key]: e.target.value })
                              }
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-950 shadow-xs"
                            />
                          </div>
                        );
                      }

                      if (param.type === 'in_list') {
                        return (
                          <div key={param.key} className="space-y-1">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                              {param.label} {param.required && <span className="text-rose-500">*</span>}
                            </label>
                            <input
                              type="text"
                              value={execParams[param.key] || ''}
                              onChange={(e) =>
                                setExecParams({ ...execParams, [param.key]: e.target.value })
                              }
                              placeholder={param.placeholder || 'e.g. PAID, UNPAID, PARTIAL'}
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-950 shadow-xs"
                            />
                            <span className="text-[10px] text-slate-500 block">
                              Comma-separated values
                            </span>
                          </div>
                        );
                      }

                      // Default text
                      return (
                        <div key={param.key} className="space-y-1">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {param.label} {param.required && <span className="text-rose-500">*</span>}
                          </label>
                          <input
                            type="text"
                            value={execParams[param.key] || ''}
                            onChange={(e) =>
                              setExecParams({ ...execParams, [param.key]: e.target.value })
                            }
                            placeholder={param.placeholder || `Enter ${param.label.toLowerCase()}`}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-950 shadow-xs"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition cursor-pointer text-center"
                >
                  Back to Catalog
                </button>

                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    disabled={exportingCsv || executing}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
                  >
                    {exportingCsv ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    )}
                    Export CSV
                  </button>

                  <button
                    type="button"
                    onClick={handleRunQuery}
                    disabled={executing}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-bold text-xs shadow-xs transition disabled:opacity-50 cursor-pointer active:scale-95"
                  >
                    {executing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5 fill-current" />
                    )}
                    {executing ? 'Executing...' : 'Run Query'}
                  </button>
                </div>
              </div>
            </div>

            {/* Results Table Section */}
            {execResult && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/70 p-3.5 sm:p-4 backdrop-blur-xl shadow-xs space-y-3">
                {/* Result Meta Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-200 dark:border-slate-800/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Table className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-extrabold text-slate-900 dark:text-slate-200">Execution Results</span>
                    <span className="px-2 py-0.2 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-mono font-bold">
                      {execResult.rowCount} rows returned
                    </span>
                    {execResult.truncated && (
                      <span className="flex items-center gap-1 px-2 py-0.2 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 text-[10px] font-bold">
                        <AlertTriangle className="h-3 w-3" /> Capped at 2000 rows
                      </span>
                    )}
                  </div>

                  <button
                    onClick={handleExportCsv}
                    disabled={exportingCsv}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-bold"
                  >
                    <Download className="h-3.5 w-3.5" /> Download Full CSV
                  </button>
                </div>

                {/* Table Data */}
                {execResult.rows.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500 font-medium">
                    Query executed successfully. 0 records matched the filter criteria.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800/80 max-h-[600px] overflow-y-auto shadow-xs">
                    <table className="w-full text-left text-xs text-slate-800 dark:text-slate-300">
                      <thead className="bg-slate-100/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-400 font-bold sticky top-0 backdrop-blur z-10 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase">
                        <tr>
                          <th className="px-3.5 py-2 w-12 text-center text-slate-500 dark:text-slate-600 font-mono">
                            #
                          </th>
                          {execResult.columns.map((col) => (
                            <th key={col} className="px-3.5 py-2 whitespace-nowrap text-slate-800 dark:text-slate-300 font-mono font-bold">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-950/40">
                        {execResult.rows.map((row, rIdx) => (
                          <tr
                            key={rIdx}
                            className="hover:bg-indigo-50/60 dark:hover:bg-indigo-950/20 transition duration-150"
                          >
                            <td className="px-4 py-2 text-center text-[10px] text-slate-400 dark:text-slate-600 font-mono">
                              {rIdx + 1}
                            </td>
                            {execResult.columns.map((col) => (
                              <td key={col} className="px-4 py-2 whitespace-nowrap text-slate-800 dark:text-slate-300 font-mono text-[11px]">
                                {row[col] === null || row[col] === undefined
                                  ? <span className="text-slate-400 dark:text-slate-600 italic">null</span>
                                  : typeof row[col] === 'boolean'
                                  ? row[col] ? 'true' : 'false'
                                  : String(row[col])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
