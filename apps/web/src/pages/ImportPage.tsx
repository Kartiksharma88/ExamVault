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
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
            <span>Bulk Question Import</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
              All-Or-Nothing
            </span>
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Import batches of exam questions with row-level validation. If any row is invalid, the entire batch rolls back.
          </p>
        </div>

        <button
          onClick={handleDownloadTemplate}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-border shadow-sm transition-all"
        >
          <Download className="w-4 h-4" />
          <span>Download CSV Template</span>
        </button>
      </div>

      {/* Upload Box */}
      <div className="glass-card rounded-2xl p-6 border border-border space-y-4">
        <label className="border-2 border-dashed border-border hover:border-cyan-500 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-900/40">
          <UploadCloud className="w-10 h-10 text-cyan-400 mb-2 opacity-80" />
          <span className="text-sm font-medium text-white">
            {fileName ? `Loaded: ${fileName}` : 'Click or drag a CSV file here to import'}
          </span>
          <span className="text-xs text-text-muted mt-1">
            Supports UTF-8 encoded CSV with Devanagari Unicode and LaTeX formulas
          </span>
          <input type="file" accept=".csv,text/csv" onChange={handleFileChange} className="hidden" />
        </label>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-text-secondary">Or Paste Raw CSV Content</label>
            {csvContent && (
              <button
                type="button"
                onClick={() => {
                  setCsvContent('');
                  setFileName(null);
                  setResult(null);
                }}
                className="text-xs text-text-muted hover:text-rose-400"
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
            className="w-full p-3.5 bg-slate-950 border border-border rounded-xl text-xs text-cyan-300 font-mono leading-relaxed placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            disabled={loading || !csvContent.trim()}
            onClick={handleImport}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-glow-sm transition-all disabled:opacity-50 flex items-center space-x-2"
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
          className={`glass-card rounded-2xl p-6 border ${
            result.success ? 'border-emerald-500/50' : 'border-rose-500/50'
          }`}
        >
          {result.success ? (
            <div className="space-y-4 text-center py-4">
              <div className="inline-flex p-3 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">Batch Import Succeeded!</h3>
              <p className="text-sm text-text-secondary max-w-md mx-auto">
                Successfully encrypted and inserted <strong>{result.importedCount}</strong> questions across your
                subjects. Each question has received an individual data key and content commitment.
              </p>
              <button
                onClick={onSuccess}
                className="mt-2 inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              >
                <span>View Questions in Bank</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center space-x-3 text-rose-400">
                <AlertCircle className="w-6 h-6 flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-base text-white">Import Failed — All Changes Rolled Back</h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Found {result.errors.length} validation issues in {result.totalRows} submitted rows. Correct the
                    errors below and re-submit.
                  </p>
                </div>
              </div>

              {/* Error Table */}
              <div className="rounded-xl border border-border overflow-hidden bg-slate-950/80">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-900 border-b border-border text-text-secondary uppercase">
                    <tr>
                      <th className="px-4 py-2.5 w-20">Row #</th>
                      <th className="px-4 py-2.5 w-40">Field</th>
                      <th className="px-4 py-2.5">Error Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {result.errors.map((err, i) => (
                      <tr key={i} className="hover:bg-slate-900/40">
                        <td className="px-4 py-2 text-rose-400 font-bold">{err.row > 0 ? err.row : '—'}</td>
                        <td className="px-4 py-2 text-amber-300">{err.field}</td>
                        <td className="px-4 py-2 text-slate-300 font-sans">{err.message}</td>
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
