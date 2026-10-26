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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
            <span>Tamper-Evident Audit Chain</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800">
              Ed25519 & SHA-256
            </span>
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Append-only cryptographic audit trail protected by database trigger rules. Every content access is logged.
          </p>
        </div>

        <button
          onClick={handleVerifyChain}
          disabled={verifying}
          className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 shadow-glow-sm transition-all disabled:opacity-50"
        >
          {verifying ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Verifying Hashes & Signatures...</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              <span>Verify Cryptographic Chain</span>
            </>
          )}
        </button>
      </div>

      {/* Verification Results Banner */}
      {verifyResult && (
        <div
          className={`p-5 rounded-2xl border backdrop-blur-md transition-all ${
            verifyResult.valid
              ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/80 text-rose-300'
          }`}
        >
          <div className="flex items-start space-x-3">
            {verifyResult.valid ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-6 h-6 text-rose-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <h3 className="font-bold text-base">
                {verifyResult.valid
                  ? 'Audit Chain Intact & Cryptographically Valid'
                  : 'Chain Integrity Breach Detected!'}
              </h3>
              <p className="text-xs opacity-90 leading-relaxed">
                {verifyResult.valid
                  ? `Successfully walked all ${verifyResult.totalEntries} entries from genesis. All SHA-256 forward hash links and Ed25519 signatures match expected values. Zero tampering detected.`
                  : `Verification failed at entry index ${verifyResult.firstBrokenEntry?.index} (ID: ${verifyResult.firstBrokenEntry?.id}). Expected hash: ${verifyResult.firstBrokenEntry?.expectedHash}, Actual: ${verifyResult.firstBrokenEntry?.actualHash}. Database row may have been altered.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="glass-card rounded-xl p-4 border border-border flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-text-muted" />
        <span className="text-xs text-text-secondary">Filters:</span>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-1.5 bg-slate-900 border border-border rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          className="px-3 py-1.5 bg-slate-900 border border-border rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            className="text-xs text-cyan-400 hover:underline ml-auto"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Audit Log Table */}
      {loading ? (
        <div className="py-16 text-center text-text-secondary text-sm">
          Loading signed audit events...
        </div>
      ) : events.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center border border-border text-text-muted text-sm">
          No audit events matching current filters.
        </div>
      ) : (
        <div className="glass-card rounded-2xl border border-border overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 border-b border-border text-text-secondary uppercase">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Entry Hash (SHA-256)</th>
                <th className="px-4 py-3">Signature</th>
                <th className="px-4 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {events.map((evt) => {
                const isExpanded = expandedId === evt.id;
                const isRead = evt.action.includes('READ');
                const isFailure = evt.action.includes('FAILURE') || evt.action.includes('DENIED');
                const isSuccess = evt.action.includes('SUCCESS') || evt.action.includes('CREATE') || evt.action.includes('SUBMIT');

                let badgeClass = 'bg-slate-800 text-slate-300';
                if (isFailure) badgeClass = 'bg-rose-950/70 text-rose-300 border border-rose-800';
                else if (isRead) badgeClass = 'bg-cyan-950/60 text-cyan-300 border border-cyan-800';
                else if (isSuccess) badgeClass = 'bg-emerald-950/60 text-emerald-300 border border-emerald-800';

                return (
                  <React.Fragment key={evt.id}>
                    <tr className="hover:bg-slate-900/40 font-mono transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-text-muted">{formatDate(evt.timestamp)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded font-semibold text-[10px] ${badgeClass}`}>
                          {evt.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-sans text-white">
                        {evt.actor?.name || evt.actor?.email || 'SYSTEM'}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        <span className="text-cyan-400">{evt.targetType}</span>
                        {evt.targetId && (
                          <span className="text-text-muted ml-1 truncate max-w-[100px] inline-block align-bottom">
                            ({evt.targetId.slice(0, 8)})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-1 text-text-secondary">
                          <Hash className="w-3 h-3 text-cyan-500" />
                          <span className="truncate max-w-[130px]" title={evt.entryHash}>
                            {evt.entryHash.slice(0, 12)}...
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-1.5 py-0.5 rounded bg-blue-950/40 text-blue-300 text-[10px] border border-blue-900/40">
                          Ed25519
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : evt.id)}
                          className="p-1 rounded text-text-muted hover:text-white"
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>

                    {/* Collapsible Metadata Drawer */}
                    {isExpanded && (
                      <tr className="bg-slate-950/70">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="space-y-3 font-mono text-xs">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="text-text-muted block text-[11px] mb-1">Previous Block Hash:</span>
                                <code className="p-2 bg-slate-900 rounded block text-slate-300 break-all text-[11px]">
                                  {evt.prevHash}
                                </code>
                              </div>
                              <div>
                                <span className="text-text-muted block text-[11px] mb-1">Entry Hash:</span>
                                <code className="p-2 bg-slate-900 rounded block text-cyan-300 break-all text-[11px]">
                                  {evt.entryHash}
                                </code>
                              </div>
                            </div>

                            <div>
                              <span className="text-text-muted block text-[11px] mb-1">Ed25519 Signature:</span>
                              <code className="p-2 bg-slate-900 rounded block text-blue-300 break-all text-[11px]">
                                {evt.signature}
                              </code>
                            </div>

                            {evt.metadata && (
                              <div>
                                <span className="text-text-muted block text-[11px] mb-1">Event Payload Metadata:</span>
                                <pre className="p-3 bg-slate-900 rounded text-slate-300 overflow-x-auto text-[11px]">
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
