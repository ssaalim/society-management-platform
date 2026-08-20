'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../lib/api/client';
import { Brain, FileText, TrendingUp, AlertTriangle, Send, Loader2, FileCheck, CheckCircle, AlertCircle, Bot, Upload , X } from 'lucide-react';
import { useParams } from 'next/navigation';

export default function AIAssistantPage() {
  const { society_slug } = useParams();

  const [activeTab, setActiveTab] = useState<'chat' | 'notices' | 'predictive' | 'ocr'>('chat');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Chatbot state
  const [chatInput, setChatInput] = useState<string>('');
  const [chatLog, setChatLog] = useState<Array<{ sender: 'user' | 'ai'; text: string }>>([
    { sender: 'ai', text: 'Hello! I am your multi-tenant society AI assistant. Ask me questions regarding regulations, outstanding dues, or circular notices.' }
  ]);

  // Notice generator state
  const [noticeTitle, setNoticeTitle] = useState<string>('');
  const [noticeDetails, setNoticeDetails] = useState<string>('');
  const [generatedDraft, setGeneratedDraft] = useState<string>('');

  // Predictive state
  const [predictions, setPredictions] = useState<{ historicalAvg: number; predictedNextMonth: number; confidenceScore: number } | null>(null);
  const [anomalies, setAnomalies] = useState<Array<{ voucherId: string; number: string; amount: string; reason: string }>>([]);

  // OCR state
  const [ocrResult, setOcrResult] = useState<any>(null);

  const fetchPredictiveData = async () => {
    try {
      const predRes = await apiClient.get('/ai/predict-maintenance');
      if (predRes.data?.success) {
        setPredictions(predRes.data.data);
      }

      const anomRes = await apiClient.get('/ai/detect-anomalies');
      if (anomRes.data?.success) {
        setAnomalies(anomRes.data.data.anomalies);
      }
    } catch (err) {
      // Mock Fallbacks
      setPredictions({
        historicalAvg: 145000.00,
        predictedNextMonth: 152250.00,
        confidenceScore: 0.89,
      });
      setAnomalies([
        {
          voucherId: 'v-100',
          number: 'JRN-2026-004',
          amount: '85000.00',
          reason: 'Voucher amount exceeds threshold limit of ₹45,000 (Standard Deviation boundary).',
        }
      ]);
    }
  };

  useEffect(() => {
    if (activeTab === 'predictive') {
      fetchPredictiveData();
    }
  }, [activeTab]);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setChatLog((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setChatInput('');
    setIsLoading(true);

    try {
      const res = await apiClient.post('/ai/chat', { message: userMsg });
      if (res.data?.success) {
        setChatLog((prev) => [...prev, { sender: 'ai', text: res.data.data.reply }]);
      }
    } catch (err) {
      setChatLog((prev) => [...prev, { sender: 'ai', text: 'I mapped society info parameters. (Mock response prompt).' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNoticeDraftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeTitle || !noticeDetails) return;

    setIsLoading(true);
    setGeneratedDraft('');

    try {
      const res = await apiClient.post('/ai/generate-notice', {
        title: noticeTitle,
        details: noticeDetails,
      });
      if (res.data?.success) {
        setGeneratedDraft(res.data.data.draft);
      }
    } catch (err) {
      setGeneratedDraft(`
# NOTICE: ${noticeTitle.toUpperCase()}
Dear Residents,
Please note the details regarding ${noticeDetails}.
- Management Committee
      `.trim());
    } finally {
      setIsLoading(false);
    }
  };

  const handleSimulateOCR = async () => {
    setIsLoading(true);
    setOcrResult(null);

    try {
      const res = await apiClient.post('/ai/ocr-invoice', { fileBase64: 'mock_base64_invoice' });
      if (res.data?.success) {
        setOcrResult(res.data.data);
      }
    } catch (err) {
      setOcrResult({
        vendorName: 'Water Shield Waterproofing Ltd',
        gstin: '27AABCM8281K1Z3',
        invoiceNumber: 'INV-2026-902',
        date: '2026-07-26',
        totalAmount: 45000.00,
        lineItems: [
          { description: 'Entrance Joint Grouting Work', qty: 1, rate: 25000.00, total: 25000.00 },
          { description: 'Acrylic Coating Sealant Liquid', qty: 6, rate: 2189.26, total: 13135.60 }
        ]
      });
    } finally {
      setIsLoading(false);
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
            <Bot className="h-6 w-6 text-indigo-500 dark:text-indigo-400" />
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">AI Assistant & Analytics</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Summarize meeting transcripts, forecast collections, detect voucher anomalies, and parse invoice OCR metadata</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {['chat', 'notices', 'predictive', 'ocr'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`rounded-lg border py-1.5 px-2.5 text-xs font-semibold uppercase tracking-wider transition-all ${
                  activeTab === tab ? 'bg-indigo-600 border-indigo-500 text-white shadow-xs' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'chat' && (
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950/20 p-4 flex flex-col h-[500px] shadow-xs">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800/40 pb-3 mb-3">
              <Bot className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase">Resident RAG Chatbot</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 text-xs">
              {chatLog.map((log, idx) => (
                <div
                  key={idx}
                  className={`flex ${log.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-md rounded-xl p-3 leading-relaxed border ${
                    log.sender === 'user'
                      ? 'bg-indigo-600 border-indigo-500 text-slate-100'
                      : 'bg-slate-900 border-slate-800 text-slate-300'
                  }`}>
                    {log.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> Thinking...
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleChatSubmit} className="mt-4 flex gap-2 border-t border-slate-800/40 pt-4">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask assistant something (e.g. outstanding maintenance info)..."
                className="flex-1 rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-3 text-xs text-slate-200 focus:border-slate-700 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-slate-100 p-2"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}

        {activeTab === 'notices' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-6 space-y-4 text-xs">
              <h3 className="text-sm font-bold text-slate-200">Notice Circular Generator</h3>
              <p className="text-slate-500">Provide guidelines and outline points, AI will draft a circular notice structure.</p>

              <form onSubmit={handleNoticeDraftSubmit} className="space-y-4">
                <div>
                  <label className="text-slate-500 dark:text-slate-400 font-medium">Notice Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Elevator Maintenance Closure"
                    value={noticeTitle}
                    onChange={(e) => setNoticeTitle(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-3 text-xs text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-500 dark:text-slate-400 font-medium">Outline Details</label>
                  <textarea
                    rows={4}
                    placeholder="Waterproofing contractor repairs inside Lift A, closure scheduled on Monday between 10AM and 4PM..."
                    value={noticeDetails}
                    onChange={(e) => setNoticeDetails(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 px-3 text-xs text-slate-200 focus:border-slate-700 focus:outline-none mt-1"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-slate-100 py-2 px-4 font-semibold disabled:opacity-55"
                >
                  Generate Notice Draft
                </button>
              </form>
            </div>

            <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-6 space-y-4 text-xs flex flex-col justify-between">
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                  <FileText className="h-4.5 w-4.5 text-indigo-400" /> Circular notice preview draft
                </h3>
                {isLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
                  </div>
                ) : generatedDraft ? (
                  <pre className="p-4 rounded-lg bg-slate-950/40 border border-slate-800 text-slate-300 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                    {generatedDraft}
                  </pre>
                ) : (
                  <p className="text-slate-500 italic py-6">Notice draft will appear here after clicking submit.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'predictive' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-xs">
            {/* Forecast details */}
            <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                <TrendingUp className="h-4.5 w-4.5 text-emerald-400" /> Maintenance Collection Forecast
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
                <div className="border border-slate-800/60 p-4 rounded-lg bg-slate-950/40">
                  <span className="text-slate-500 block mb-1">Previous Month Average:</span>
                  <span className="text-lg font-mono font-bold text-slate-300">
                    ₹ {predictions?.historicalAvg.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="border border-slate-800/60 p-4 rounded-lg bg-slate-950/40">
                  <span className="text-slate-500 block mb-1">Next Month Forecast:</span>
                  <span className="text-lg font-mono font-bold text-emerald-400">
                    ₹ {predictions?.predictedNextMonth.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="bg-slate-950/30 border border-slate-850 p-4 rounded-lg text-slate-500 dark:text-slate-400 leading-relaxed">
                Confidence score: <strong className="text-indigo-400">{(predictions?.confidenceScore || 0) * 100}%</strong>. Calculations determined by analyzing previous years ledger transaction rates.
              </div>
            </div>

            {/* Anomaly detection */}
            <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                <AlertTriangle className="h-4.5 w-4.5 text-red-400" /> Expense Vouchers Anomalies detection
              </h3>

              <div className="space-y-3">
                {anomalies.map((anom, idx) => (
                  <div key={idx} className="border border-red-950/40 bg-red-950/10 p-3 rounded-lg text-red-400 space-y-1">
                    <span className="font-bold">Voucher: {anom.number} (Amount: ₹{Number(anom.amount).toLocaleString('en-IN')})</span>
                    <p className="text-[11px] leading-relaxed">{anom.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ocr' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-xs">
            <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-6 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-200">OCR Invoice Extractor</h3>
                <p className="text-slate-500">Scan vendor invoice receipts. AI parses subtotal, SGST, CGST, and vendor records details.</p>
              </div>

              <button
                onClick={handleSimulateOCR}
                disabled={isLoading}
                className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-slate-100 py-3.5 px-4 font-semibold flex items-center justify-center gap-1.5 self-stretch disabled:opacity-55"
              >
                {isLoading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Upload className="h-4.5 w-4.5" />} Simulate Invoice Scanning
              </button>
            </div>

            <div className="border border-slate-800 rounded-xl bg-slate-950/20 p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                <FileCheck className="h-4.5 w-4.5 text-indigo-400" /> Extracted invoice meta details
              </h3>

              {ocrResult ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-slate-500 block">Vendor Name:</span>
                      <strong className="text-slate-200">{ocrResult.vendorName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">GSTIN Number:</span>
                      <strong className="text-slate-200">{ocrResult.gstin}</strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t border-slate-800/60 pt-3">
                    <div>
                      <span className="text-slate-500 block">Subtotal:</span>
                      <strong className="text-slate-200">₹{ocrResult.subtotal.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Tax CGST/SGST:</span>
                      <strong className="text-slate-200">₹{(ocrResult.cgst + ocrResult.sgst).toFixed(2)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Total Amount:</span>
                      <strong className="text-indigo-400 font-bold">₹{ocrResult.totalAmount.toFixed(2)}</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 italic py-6">Extracted lines will appear here after uploading.</p>
              )}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
