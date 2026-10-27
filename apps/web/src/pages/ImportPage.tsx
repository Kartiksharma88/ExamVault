import React, { useState } from 'react';
import { apiRequest } from '../lib/api-client';
import {
  UploadCloud,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface ImportError {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  success: boolean;
  totalRows: number;
  importedCount: number;
  errors: ImportError[];
}

export const ImportPage: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [csvContent, setCsvContent] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch('/api/import/template', { credentials: 'include' });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'examvault-import-template.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert('Failed to download template');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      setResult(null);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvContent.trim()) {
      alert('Please upload or paste CSV content first.');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await apiRequest<{ success: boolean; data: ImportResult }>('/import', {
        method: 'POST',
        body: JSON.stringify({ csv: csvContent }),
      });
      setResult(res.data);
    } catch (err: any) {
      setResult({
        success: false,
        totalRows: 0,
        importedCount: 0,
        errors: [{ row: 0, field: 'general', message: err.message || 'Import failed' }],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 w-full pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Bulk Question Import
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-mono font-medium">
              Atomic Rollback
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Import batches of exam questions with row-level validation. If any row is invalid, the entire batch rolls back.
          </p>
        </div>

        <button
          onClick={handleDownloadTemplate}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-xs transition-all"
        >
          <Download className="w-4 h-4 text-red-600" />
          <span>Download CSV Template</span>
        </button>
      </div>

      {/* Upload Box */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <label className="border-2 border-dashed border-slate-300 hover:border-red-500 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-red-50/20">
          <UploadCloud className="w-10 h-10 text-red-600 mb-2 opacity-90" />
          <span className="text-sm font-bold text-slate-900">
            {fileName ? `Loaded: ${fileName}` : 'Click or drag a CSV file here to import'}
          </span>
          <span className="text-xs text-slate-500 mt-1">
            Supports UTF-8 encoded CSV with Devanagari Hindi Unicode and LaTeX formulas
          </span>
          <input type="file" accept=".csv,text/csv" onChange={handleFileChange} className="hidden" />
        </label>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Or Paste Raw CSV Content</label>
            {csvContent && (
              <button
                type="button"
                onClick={() => {
                  setCsvContent('');
                  setFileName(null);
                  setResult(null);
                }}
                className="text-xs text-red-600 hover:underline font-semibold"
              >
                Clear
              </button>
            )}
          </div>
          <textarea
            rows={8}
            value={csvContent}
            onChange={(e) => {
              setCsvContent(e.target.value);
              setResult(null);
            }}
            placeholder="type,stem,optionA,optionB,optionC,optionD,correctAnswer,solution,subjectCode,topicName,difficulty,cognitiveLevel,marks,negativeMarks,estimatedTimeSeconds,language"
            className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-mono leading-relaxed placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 resize-y"
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            disabled={loading || !csvContent.trim()}
            onClick={handleImport}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 shadow-xs transition-all disabled:opacity-50 flex items-center space-x-2"
          >
            {loading ? (
              <span>Validating & Encrypting...</span>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4" />
                <span>Validate & Import Batch</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results Section */}
      {result && (
        <div
          className={`rounded-2xl p-6 border shadow-xs ${
            result.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
          }`}
        >
          {result.success ? (
            <div className="space-y-4 text-center py-4">
              <div className="inline-flex p-3 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Batch Import Succeeded!</h3>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                Successfully encrypted and inserted <strong>{result.importedCount}</strong> questions across your
                subjects. Each question has received an individual cryptographic key and content commitment.
              </p>
              <button
                onClick={onSuccess}
                className="mt-2 inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
              >
                <span>View Questions in Bank</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center space-x-3 text-red-700">
                <AlertCircle className="w-6 h-6 flex-shrink-0 text-red-600" />
                <div>
                  <h3 className="font-bold text-base text-red-900">Import Failed — All Changes Rolled Back</h3>
                  <p className="text-xs text-red-700 mt-0.5">
                    Found {result.errors.length} validation issues in {result.totalRows} submitted rows. Correct the
                    errors below and re-submit.
                  </p>
                </div>
              </div>

              {/* Error Table */}
              <div className="rounded-xl border border-red-200 overflow-hidden bg-white">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-red-100/60 border-b border-red-200 text-red-900 uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-2.5 w-20">Row #</th>
                      <th className="px-4 py-2.5 w-40">Field</th>
                      <th className="px-4 py-2.5">Error Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100">
                    {result.errors.map((err, i) => (
                      <tr key={i} className="hover:bg-red-50/50">
                        <td className="px-4 py-2 text-red-700 font-bold">{err.row > 0 ? err.row : '—'}</td>
                        <td className="px-4 py-2 text-amber-800 font-semibold">{err.field}</td>
                        <td className="px-4 py-2 text-slate-800 font-sans">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
