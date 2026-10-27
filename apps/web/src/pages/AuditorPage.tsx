import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api-client';
import { formatDate } from '../lib/utils';
import {
  ShieldCheck,
  ShieldAlert,
  Filter,
  CheckCircle2,
  RefreshCw,
  Hash,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface AuditEventItem {
  id: string;
  timestamp: string;
  actorId?: string;
  actor?: { name: string; email: string };
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: any;
  entryHash: string;
  prevHash: string;
  signature: string;
}

interface VerifyResult {
  valid: boolean;
  totalEntries: number;
  verifiedEntries: number;
  firstBrokenEntry?: {
    id: string;
    index: number;
    expectedHash: string;
    actualHash: string;
  };
}

export const AuditorPage: React.FC = () => {
  const [events, setEvents] = useState<AuditEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Verification state
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '100' };
      if (actionFilter) params.action = actionFilter;
      if (targetTypeFilter) params.targetType = targetTypeFilter;

      const res = await apiRequest<{ success: boolean; data: { items: AuditEventItem[] } }>(
        '/audit',
        { params },
      );
      setEvents(res.data?.items || []);
    } catch (err) {
      console.error('Failed to load audit events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [actionFilter, targetTypeFilter]);

  const handleVerifyChain = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await apiRequest<{ success: boolean; data: VerifyResult }>('/audit/verify');
      setVerifyResult(res.data);
    } catch (err: any) {
      alert(err.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Tamper-Evident Audit Chain
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-mono font-medium">
              Ed25519 & SHA-256
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Append-only cryptographic audit trail protected by database trigger rules. Every access is signed.
          </p>
        </div>

        <button
          onClick={handleVerifyChain}
          disabled={verifying}
          className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-slate-900 hover:bg-black shadow-xs transition-all disabled:opacity-50"
        >
          {verifying ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Verifying Cryptographic Ledger...</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Verify Cryptographic Chain</span>
            </>
          )}
        </button>
      </div>

      {/* Verification Results Banner */}
      {verifyResult && (
        <div
          className={`p-5 rounded-2xl border shadow-xs transition-all ${
            verifyResult.valid
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-start space-x-3">
            {verifyResult.valid ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <h3 className="font-bold text-base">
                {verifyResult.valid
                  ? 'Audit Chain Intact & Cryptographically Valid'
                  : 'Chain Integrity Breach Detected!'}
              </h3>
              <p className="text-xs leading-relaxed opacity-90">
                {verifyResult.valid
                  ? `Successfully walked all ${verifyResult.totalEntries} entries from genesis block. All SHA-256 forward hash links and Ed25519 digital signatures match expected values. Zero tampering detected.`
                  : `Verification failed at entry index ${verifyResult.firstBrokenEntry?.index} (ID: ${verifyResult.firstBrokenEntry?.id}). Expected hash: ${verifyResult.firstBrokenEntry?.expectedHash}, Actual: ${verifyResult.firstBrokenEntry?.actualHash}. Database row may have been altered.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-slate-400" />
        <span className="text-xs text-slate-500 font-medium">Filters:</span>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-red-600 font-medium"
        >
          <option value="">All Actions</option>
          <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
          <option value="LOGIN_FAILURE">LOGIN_FAILURE</option>
          <option value="QUESTION_CREATE">QUESTION_CREATE</option>
          <option value="QUESTION_EDIT">QUESTION_EDIT</option>
          <option value="QUESTION_SUBMIT">QUESTION_SUBMIT</option>
          <option value="QUESTION_CONTENT_READ">QUESTION_CONTENT_READ</option>
          <option value="ACCESS_DENIED">ACCESS_DENIED</option>
          <option value="IMPORT_SUCCESS">IMPORT_SUCCESS</option>
        </select>

        <select
          value={targetTypeFilter}
          onChange={(e) => setTargetTypeFilter(e.target.value)}
          className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-red-600 font-medium"
        >
          <option value="">All Target Types</option>
          <option value="question">Question</option>
          <option value="user">User</option>
          <option value="syllabus">Syllabus</option>
          <option value="session">Session</option>
          <option value="import">Import</option>
        </select>

        {(actionFilter || targetTypeFilter) && (
          <button
            onClick={() => {
              setActionFilter('');
              setTargetTypeFilter('');
            }}
            className="text-xs text-red-600 hover:underline font-semibold ml-auto"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Audit Log Table */}
      {loading ? (
        <div className="py-16 text-center text-slate-500 text-sm bg-white rounded-2xl border border-slate-200">
          Loading signed cryptographic audit events...
        </div>
      ) : events.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 text-slate-500 text-sm shadow-xs">
          No audit events matching current filters.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
              <tr>
                <th className="px-4 py-3.5">Timestamp</th>
                <th className="px-4 py-3.5">Action</th>
                <th className="px-4 py-3.5">Actor</th>
                <th className="px-4 py-3.5">Target</th>
                <th className="px-4 py-3.5">Entry Hash (SHA-256)</th>
                <th className="px-4 py-3.5">Signature</th>
                <th className="px-4 py-3.5 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((evt) => {
                const isExpanded = expandedId === evt.id;
                const isRead = evt.action.includes('READ');
                const isFailure = evt.action.includes('FAILURE') || evt.action.includes('DENIED');
                const isSuccess = evt.action.includes('SUCCESS') || evt.action.includes('CREATE') || evt.action.includes('SUBMIT');

                let badgeClass = 'bg-slate-100 text-slate-700 border border-slate-200';
                if (isFailure) badgeClass = 'bg-red-50 text-red-800 border border-red-200';
                else if (isRead) badgeClass = 'bg-slate-100 text-slate-800 border border-slate-200';
                else if (isSuccess) badgeClass = 'bg-emerald-50 text-emerald-800 border border-emerald-200';

                return (
                  <React.Fragment key={evt.id}>
                    <tr className="hover:bg-slate-50/80 font-mono transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-500">{formatDate(evt.timestamp)}</td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${badgeClass}`}>
                          {evt.action}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-sans font-semibold text-slate-900">
                        {evt.actor?.name || evt.actor?.email || 'SYSTEM'}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        <span className="font-semibold text-slate-900">{evt.targetType}</span>
                        {evt.targetId && (
                          <span className="text-slate-400 ml-1 truncate max-w-[100px] inline-block align-bottom font-mono">
                            ({evt.targetId.slice(0, 8)})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center space-x-1 text-slate-700">
                          <Hash className="w-3 h-3 text-red-600" />
                          <span className="truncate max-w-[130px] font-mono text-[11px]" title={evt.entryHash}>
                            {evt.entryHash.slice(0, 12)}...
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] border border-slate-200 font-semibold">
                          Ed25519
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : evt.id)}
                          className="p-1 rounded text-slate-400 hover:text-slate-900"
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>

                    {/* Collapsible Metadata Drawer */}
                    {isExpanded && (
                      <tr className="bg-slate-50/90 border-t border-b border-slate-200">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="space-y-3 font-mono text-xs">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="text-slate-500 block text-[11px] mb-1 font-semibold">Previous Block Hash:</span>
                                <code className="p-2.5 bg-white border border-slate-200 rounded-lg block text-slate-700 break-all text-[11px]">
                                  {evt.prevHash}
                                </code>
                              </div>
                              <div>
                                <span className="text-slate-500 block text-[11px] mb-1 font-semibold">Entry Hash:</span>
                                <code className="p-2.5 bg-white border border-slate-200 rounded-lg block text-slate-900 font-bold break-all text-[11px]">
                                  {evt.entryHash}
                                </code>
                              </div>
                            </div>

                            <div>
                              <span className="text-slate-500 block text-[11px] mb-1 font-semibold">Ed25519 Signature:</span>
                              <code className="p-2.5 bg-white border border-slate-200 rounded-lg block text-slate-700 break-all text-[11px]">
                                {evt.signature}
                              </code>
                            </div>

                            {evt.metadata && (
                              <div>
                                <span className="text-slate-500 block text-[11px] mb-1 font-semibold">Event Payload Metadata:</span>
                                <pre className="p-3 bg-white border border-slate-200 rounded-lg text-slate-800 overflow-x-auto text-[11px]">
                                  {JSON.stringify(evt.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
