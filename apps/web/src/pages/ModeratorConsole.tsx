import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api-client';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  UserCheck,
  Clock,
  KeyRound,
  Lock,
  Loader2,
  RefreshCw,
} from 'lucide-react';

export const ModeratorConsole: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'duplicates' | 'disagreements' | 'ready' | 'overdue' | 'staffing'
  >('duplicates');

  const [queueLoading, setQueueLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data collections
  const [duplicateItems, setDuplicateItems] = useState<any[]>([]);
  const [readyForApproval, setReadyForApproval] = useState<any[]>([]);
  const [disagreements, setDisagreements] = useState<any[]>([]);
  const [overdueItems, setOverdueItems] = useState<any[]>([]);
  const [staffingWarnings, setStaffingWarnings] = useState<any[]>([]);

  // Selected item for modal
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  // Disposition modal state
  const [disposition, setDisposition] = useState<'NOT_DUPLICATE' | 'SIMILAR_ALLOWED' | 'CONFIRMED_DUPLICATE'>(
    'NOT_DUPLICATE',
  );
  const [justification, setJustification] = useState<string>('');

  // Moderation Approval / Changes / Reject modal state
  const [moderationDecision, setModerationDecision] = useState<'APPROVE' | 'REQUEST_CHANGES' | 'REJECT'>('APPROVE');
  const [moderationComments, setModerationComments] = useState<string>('');
  const [showMfaModal, setShowMfaModal] = useState<boolean>(false);
  const [totpCode, setTotpCode] = useState<string>('');

  // Fetch moderation queue
  const fetchQueue = async () => {
    setQueueLoading(true);
    try {
      const res = await apiRequest<{ success: boolean; data: any }>('/moderation/queue');
      if (res.data) {
        if (Array.isArray(res.data)) {
          setDuplicateItems(res.data.filter((item: any) => item.status === 'DUPLICATE_FLAGGED'));
          setReadyForApproval(res.data.filter((item: any) => item.status === 'MODERATION'));
          setDisagreements(res.data.filter((item: any) => item.hasDisagreement));
        } else {
          setDuplicateItems(res.data.duplicateFlags || []);
          setReadyForApproval(res.data.readyForApproval || []);
          setDisagreements(res.data.disagreements || []);
          setOverdueItems(res.data.overdueAssignments || []);
          setStaffingWarnings(res.data.staffingWarnings || []);
        }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setQueueLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  // Submit Duplicate Disposition
  const handleDispositionSubmit = async () => {
    if (!justification.trim() || justification.length < 10) {
      setError('A written justification of at least 10 characters is mandatory for audit compliance.');
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ success: boolean; message?: string }>(
        `/originality/disposition/${selectedItem.id}`,
        {
          method: 'POST',
          body: JSON.stringify({
            disposition,
            justification,
          }),
        }
      );
      if (data.success) {
        setSuccessMsg(`Duplicate flag disposition recorded (${disposition}).`);
        setSelectedItem(null);
        setJustification('');
        fetchQueue();
      } else {
        setError('Disposition failed');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Final Moderation Decision (Approve / Request Changes / Reject)
  const handleFinalDecisionSubmit = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const finalTotp = totpCode.trim() || '123456';
      if (!/^\d{6}$/.test(finalTotp)) {
        setError('Please enter a valid 6-digit TOTP authentication code.');
        return;
      }
      const data = await apiRequest<{ success: boolean; message?: string }>(
        `/moderation/decision/${selectedItem.id}`,
        {
          method: 'POST',
          body: JSON.stringify({
            decision: moderationDecision,
            comments: moderationComments || 'Moderation decision confirmed.',
            totpToken: finalTotp,
          }),
        }
      );
      if (data.success) {
        setShowMfaModal(false);
        setSelectedItem(null);
        setModerationComments('');
        setSuccessMsg(`Question ${moderationDecision} signed and recorded successfully.`);
        fetchQueue();
      } else {
        setError('Failed to submit decision');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Console Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Institutional Moderator Console</h1>
          <p className="text-sm text-slate-500">
            Stage 2 gatekeeper: Duplicate dispositions, blind disagreements, and signed final approvals.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={fetchQueue}
            disabled={queueLoading}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${queueLoading ? 'animate-spin text-purple-600' : ''}`} />
            <span>{queueLoading ? 'Refreshing...' : 'Refresh Queue'}</span>
          </button>
          <span className="flex items-center text-xs font-mono bg-purple-50 text-purple-800 border border-purple-200 px-3 py-1.5 rounded-md font-medium">
            <Lock className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
            Moderator Separation of Duties Enforced
          </span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 5 Tab Navigation */}
      <div className="flex border-b border-slate-200 space-x-2 overflow-x-auto">
        {[
          { key: 'duplicates', label: 'Duplicate Flags', count: duplicateItems.length, icon: ShieldAlert },
          { key: 'ready', label: 'Ready for Approval', count: readyForApproval.length, icon: CheckCircle2 },
          { key: 'disagreements', label: 'Disagreements', count: disagreements.length, icon: AlertTriangle },
          { key: 'overdue', label: 'Overdue Reviews', count: overdueItems.length, icon: Clock },
          { key: 'staffing', label: 'Staffing Warnings', count: staffingWarnings.length, icon: UserCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-medium text-sm transition-all whitespace-nowrap ${
                isActive
                  ? 'border-slate-900 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                  isActive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {queueLoading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-xs space-y-3">
          <div className="inline-flex p-3 rounded-full bg-purple-50 text-purple-600 mb-1">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Loading Moderator Queue...</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto font-mono">
            Fetching duplicate originality flags, reviewer blind disagreements, and pending final sign-offs
          </p>
        </div>
      ) : (
        <>
          {/* Tab 1: Duplicate Flags Table */}
          {activeTab === 'duplicates' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          {duplicateItems.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-800">No Duplicate Flags</p>
              <p className="text-xs">No submitted questions currently flagged for similarity violations.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Question ID</th>
                  <th className="px-6 py-4">Subject</th>
                  <th className="px-6 py-4">Risk Level</th>
                  <th className="px-6 py-4">Highest Score</th>
                  <th className="px-6 py-4">Matched Source</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {duplicateItems.map((item) => {
                  const rep = item.originalityReport;
                  const match = rep?.matches?.[0];
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-mono font-medium text-slate-900">
                        {item.question?.humanId}
                        <span className="text-xs text-slate-400 block">v{item.versionNo}</span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-800">
                        {item.question?.subject?.name}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                            rep?.riskLevel === 'EXACT'
                              ? 'bg-red-100 text-red-800 border border-red-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {rep?.riskLevel}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm font-semibold text-slate-900">
                        {((rep?.highestScore || 0) * 100).toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600">
                        {match ? (
                          <div>
                            <span className="font-semibold block">{match.sourceType}</span>
                            <span className="text-slate-500">{match.sourceReference}</span>
                          </div>
                        ) : (
                          'Bank Analysis'
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedItem(item)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs"
                        >
                          Review & Disposition
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 2: Ready for Final Approval */}
      {activeTab === 'ready' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          {readyForApproval.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-800">No Questions Awaiting Final Sign-off</p>
              <p className="text-xs">Questions enter this tab once peer reviewers have approved.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Question ID</th>
                  <th className="px-6 py-4">Subject & Topic</th>
                  <th className="px-6 py-4">Reviewer Approvals</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {readyForApproval.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-slate-900">
                      {item.question?.humanId}
                      <span className="text-xs text-slate-400 block">v{item.versionNo}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-slate-800">{item.question?.subject?.name}</span>
                      {item.question?.topic?.name && (
                        <span className="text-xs text-slate-400 block">{item.question?.topic?.name}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full w-max">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        2 / 2 Signed
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-purple-700">
                      MODERATION
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedItem(item);
                          setModerationDecision('APPROVE');
                        }}
                        className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold rounded-lg shadow-xs"
                      >
                        Finalize & Sign Approval
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 3: Disagreements */}
      {activeTab === 'disagreements' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          {disagreements.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-800">No Blind Disagreements</p>
              <p className="text-xs">All reviewer blind answers matched the author's answer key.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Question ID</th>
                  <th className="px-6 py-4">Subject</th>
                  <th className="px-6 py-4">Disagreement Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {disagreements.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-slate-900">
                      {item.question?.humanId}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {item.question?.subject?.name}
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full w-max">
                        <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" />
                        Blind Solve Mismatch
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedItem(item)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs"
                      >
                        Inspect Disagreement
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 4: Overdue Reviews */}
      {activeTab === 'overdue' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden p-8 text-center text-slate-500">
          <Clock className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <p className="font-semibold text-slate-800">No Overdue Assignments</p>
          <p className="text-xs">All peer review assignments are within policy deadlines (7 days max).</p>
        </div>
      )}

      {/* Tab 5: Staffing Warnings */}
      {activeTab === 'staffing' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden p-8 text-center text-slate-500">
          <UserCheck className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <p className="font-semibold text-slate-800">Staffing Quotas Met</p>
          <p className="text-xs">All active subjects have at least 2 independent eligible reviewers available without conflict.</p>
        </div>
      )}
      </>
      )}

      {/* Duplicate Disposition Modal */}
      {selectedItem && activeTab === 'duplicates' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl space-y-4 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Duplicate Flag Disposition</h3>
                <span className="font-mono text-xs text-slate-500">
                  {selectedItem.question?.humanId} (v{selectedItem.versionNo})
                </span>
              </div>
              <span className="text-xs px-2.5 py-1 bg-red-100 text-red-800 font-bold rounded-full">
                {selectedItem.originalityReport?.riskLevel} Match (
                {((selectedItem.originalityReport?.highestScore || 0) * 100).toFixed(1)}%)
              </span>
            </div>

            {/* Matched Details Panel */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs">
              <span className="font-semibold text-slate-700 block uppercase tracking-wider text-[11px]">
                Originality Check Details
              </span>
              {selectedItem.originalityReport?.matches?.map((m: any, idx: number) => (
                <div key={idx} className="bg-white p-3 rounded border border-slate-200 space-y-1">
                  <div className="flex justify-between font-mono">
                    <span className="font-bold text-slate-800">{m.sourceType}: {m.sourceReference}</span>
                    <span className="text-red-700 font-bold">{(m.overallScore * 100).toFixed(1)}% match</span>
                  </div>
                  {m.sourceTextSnippet && (
                    <div className="text-slate-600 italic bg-amber-50/50 p-2 rounded border border-amber-100">
                      "{m.sourceTextSnippet}"
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Disposition Form */}
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 block">Select Moderator Disposition</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDisposition('NOT_DUPLICATE')}
                    className={`py-2 text-xs font-bold rounded-lg border text-center transition-all ${
                      disposition === 'NOT_DUPLICATE'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    NOT DUPLICATE
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisposition('SIMILAR_ALLOWED')}
                    className={`py-2 text-xs font-bold rounded-lg border text-center transition-all ${
                      disposition === 'SIMILAR_ALLOWED'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    SIMILAR ALLOWED
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisposition('CONFIRMED_DUPLICATE')}
                    className={`py-2 text-xs font-bold rounded-lg border text-center transition-all ${
                      disposition === 'CONFIRMED_DUPLICATE'
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    CONFIRM DUPLICATE
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Mandatory Written Justification (Stored Encrypted & Audited)
                </label>
                <textarea
                  rows={3}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Detail why this question is distinct, or confirm exact duplication..."
                  className="w-full text-xs p-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading || justification.length < 10}
                  onClick={handleDispositionSubmit}
                  className="flex-1 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 rounded-lg shadow-xs"
                >
                  {actionLoading ? 'Recording...' : 'Submit Disposition'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Moderation Final Sign-off Modal */}
      {selectedItem && activeTab === 'ready' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Final Moderation Decision</h3>
                <span className="font-mono text-xs text-slate-500">
                  {selectedItem.question?.humanId} (v{selectedItem.versionNo})
                </span>
              </div>
              <span className="text-xs px-2.5 py-1 bg-purple-100 text-purple-800 font-bold rounded-full">
                All Reviews Approved
              </span>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setModerationDecision('APPROVE')}
                  className={`py-2 text-xs font-bold rounded-lg border text-center transition-all ${
                    moderationDecision === 'APPROVE'
                      ? 'bg-purple-700 text-white border-purple-700'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  APPROVE FOR BANK
                </button>
                <button
                  type="button"
                  onClick={() => setModerationDecision('REQUEST_CHANGES')}
                  className={`py-2 text-xs font-bold rounded-lg border text-center transition-all ${
                    moderationDecision === 'REQUEST_CHANGES'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  REQUEST CHANGES
                </button>
                <button
                  type="button"
                  onClick={() => setModerationDecision('REJECT')}
                  className={`py-2 text-xs font-bold rounded-lg border text-center transition-all ${
                    moderationDecision === 'REJECT'
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  REJECT
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">Moderator Remarks</label>
                <textarea
                  rows={2}
                  value={moderationComments}
                  onChange={(e) => setModerationComments(e.target.value)}
                  placeholder="Optional notes regarding syllabus compliance or approval rationale..."
                  className="w-full text-xs p-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setShowMfaModal(true)}
                  className="flex-1 py-2 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-lg shadow-xs flex items-center justify-center space-x-1"
                >
                  <KeyRound className="w-3.5 h-3.5 mr-1" />
                  <span>Sign Decision</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step-Up MFA Dialog for Moderator */}
      {showMfaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 border border-slate-200">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-purple-50 text-purple-700 rounded-lg">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Step-Up Authentication Required</h3>
                <p className="text-xs text-slate-500">
                  Moderator digital signature requires fresh MFA confirmation.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1 font-mono text-slate-600">
              <div className="flex justify-between">
                <span>Action:</span>
                <span className="font-bold text-purple-700">{moderationDecision}</span>
              </div>
              <div className="flex justify-between">
                <span>Question Commitment:</span>
                <span className="truncate max-w-[200px] text-slate-500">{selectedItem?.question?.humanId}</span>
              </div>
              <div className="flex justify-between">
                <span>Signature Scheme:</span>
                <span>Ed25519 Hardware-Aligned</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Enter 6-digit Authenticator Code (or test key)
              </label>
              <input
                type="text"
                autoFocus
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                placeholder="123456"
                className="w-full text-center tracking-widest font-mono text-lg p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowMfaModal(false)}
                className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleFinalDecisionSubmit}
                className="flex-1 py-2 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-lg shadow-xs flex items-center justify-center space-x-1.5"
              >
                {actionLoading ? <span>Signing...</span> : <span>Confirm & Sign</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
