'use client';

import React, { useState, useRef } from 'react';
import { X, Upload, Download, FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  entityName: string;
  sampleHeaders: string[];
  sampleData: any[];
  keyMapping: Record<string, string>;
  onUpload: (data: any[]) => Promise<void>;
}

export default function BulkUploadModal({
  isOpen,
  onClose,
  title,
  entityName,
  sampleHeaders,
  sampleData,
  keyMapping,
  onUpload,
}: BulkUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet(sampleData, { header: sampleHeaders, skipHeader: true });
    // Let's manually write the headers first row, or just rely on json_to_sheet logic.
    // Actually json_to_sheet uses the keys of the objects. We should map sampleData array of arrays if we use skipHeader: true.
    // A better way is an array of arrays for the exact headers.
    const aoa = [sampleHeaders, ...sampleData];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, 'Template');
    XLSX.writeFile(workbook, `${entityName}_bulk_upload_template.xlsx`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    setError(null);
    if (selected) {
      if (!selected.name.match(/\.(csv|xlsx|xls)$/i)) {
        setError('Please upload a valid CSV or Excel file.');
        setFile(null);
        return;
      }
      setFile(selected);
    }
  };

  const processFile = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (rawJson.length === 0) {
        throw new Error('The uploaded file is empty.');
      }

      // Map keys
      const mappedData = rawJson.map((row: any) => {
        const mappedRow: any = {};
        for (const [csvKey, jsonKey] of Object.entries(keyMapping)) {
          // Find case-insensitive matching key in row
          const matchedKey = Object.keys(row).find(k => k.trim().toLowerCase() === csvKey.toLowerCase());
          if (matchedKey) {
            mappedRow[jsonKey] = row[matchedKey] === '' ? undefined : row[matchedKey];
          }
        }
        return mappedRow;
      });

      await onUpload(mappedData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to process file.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[90vh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 sm:px-6 py-3.5 sm:py-4">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-700/50">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">Need a template?</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Download the sample file with correct headers.</p>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="flex items-center justify-center gap-2 rounded-lg bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700 border border-indigo-200 dark:border-slate-700 shadow-xs transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              Download Template
            </button>
          </div>

          <div
            className={`border-2 border-dashed rounded-xl p-5 sm:p-8 text-center transition-colors cursor-pointer ${
              file ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-500/10' : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 bg-slate-50/50 dark:bg-slate-950/30'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={handleFileChange}
            />
            <div className="flex flex-col items-center justify-center space-y-2.5">
              <div className={`p-3 rounded-full ${file ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                {file ? <FileSpreadsheet className="h-6 w-6" /> : <Upload className="h-6 w-6" />}
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 break-all px-2">
                  {file ? file.name : 'Click or tap to upload file'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {file ? `${(file.size / 1024).toFixed(1)} KB` : 'CSV or XLSX format supported'}
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-3 rounded-lg text-xs border border-rose-200 dark:border-rose-900/60 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 dark:border-slate-800 p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-end gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={processFile}
            disabled={!file || isUploading}
            className="flex items-center justify-center min-w-[110px] rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer active:scale-95"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Processing...
              </>
            ) : (
              'Upload File'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
