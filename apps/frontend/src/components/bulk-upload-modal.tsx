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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
            <div>
              <h3 className="text-sm font-medium text-slate-200">Need a template?</h3>
              <p className="text-xs text-slate-400 mt-1">Download the sample file with correct headers.</p>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700"
            >
              <Download className="h-4 w-4" />
              Template
            </button>
          </div>

          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
              file ? 'border-brand-500 bg-brand-500/5' : 'border-slate-700 hover:border-slate-500 bg-slate-950/30'
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
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className={`p-3 rounded-full ${file ? 'bg-brand-500/20 text-brand-400' : 'bg-slate-800 text-slate-400'}`}>
                {file ? <FileSpreadsheet className="h-6 w-6" /> : <Upload className="h-6 w-6" />}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200">
                  {file ? file.name : 'Click or drag file to upload'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {file ? `${(file.size / 1024).toFixed(1)} KB` : 'CSV or XLSX formats supported'}
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-red-400 bg-red-400/10 p-3 rounded-lg text-sm border border-red-400/20">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 p-4 bg-slate-900/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={processFile}
            disabled={!file || isUploading}
            className="flex items-center justify-center min-w-[120px] rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
