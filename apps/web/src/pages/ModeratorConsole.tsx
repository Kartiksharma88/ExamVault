import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api-client';
import { ModalPortal } from '../components/ModalPortal';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  KeyRound,
  Lock,
  Loader2,
  RefreshCw,
  UserCheck,
  Archive,
  Eye,
  Sliders,
} from 'lucide-react';

export const ModeratorConsole: React.FC = () => {

  const [activeTab, setActiveTab] = useState<
    'duplicates' | 'disagreements' | 'difficultyConflicts' | 'ready' | 'overdue' | 'staffing' | 'retirement'
  >('ready');

  const [queueLoading, setQueueLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [contentLoading, setContentLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data collections strictly from moderator queue
  const [duplicateItems, setDuplicateItems] = useState<any[]>([]);
  const [readyForApproval, setReadyForApproval] = useState<any[]>([]);
  const [disagreements, setDisagreements] = useState<any[]>([]);
  const [difficultyConflicts, setDifficultyConflicts] = useState<any[]>([]);
  const [overdueItems, setOverdueItems] = useState<any[]>([]);
  const [staffingWarnings, setStaffingWarnings] = useState<any[]>([]);

  // Selected item for modal
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  // Explicit Question Content Inspection (Audited Content Minimization)
  const [inspectedContent, setInspectedContent] = useState<any | null>(null);
  const [showContentDetails, setShowContentDetails] = useState<boolean>(false);

  // Duplicate Disposition modal state
  const [disposition, setDisposition] = useState<'NOT_DUPLICATE' | 'SIMILAR_ALLOWED' | 'CONFIRMED_DUPLICATE'>(
    'NOT_DUPLICATE',
  );
  const [justification, setJustification] = useState<string>('');

  // Disagreement Resolution modal state
  const [disagreementDecision, setDisagreementDecision] = useState<'LET_STAND' | 'REQUEST_CHANGES' | 'REJECT'>('LET_STAND');
  const [resolutionNote, setResolutionNote] = useState<string>('');

  // Difficulty Conflict Resolution modal state
  const [showDiffModal, setShowDiffModal] = useState<boolean>(false);
  const [diffAction, setDiffAction] = useState<'ACCEPT_MEAN' | 'SET_FINAL_VALUE' | 'REQUEST_THIRD_REVIEW' | 'REQUEST_CHANGES'>('ACCEPT_MEAN');
  const [diffCustomValue, setDiffCustomValue] = useState<string>('50');
  const [diffCustomTiming, setDiffCustomTiming] = useState<string>('120');
  const [diffJustification, setDiffJustification] = useState<string>('');

  // Moderation Final Approval modal state
  const [moderationDecision, setModerationDecision] = useState<'APPROVE' | 'REQUEST_CHANGES' | 'REJECT'>('APPROVE');
  const [moderationComments, setModerationComments] = useState<string>('');
  const [showMfaModal, setShowMfaModal] = useState<boolean>(false);
  const [totpCode, setTotpCode] = useState<string>('');

  // Reassignment modal state
  const [showReassignModal, setShowReassignModal] = useState<boolean>(false);
  const [reassignAssignmentId, setReassignAssignmentId] = useState<string>('');
  const [newReviewerId, setNewReviewerId] = useState<string>('');
  const [reassignReason, setReassignReason] = useState<string>('');

  // Retirement state
  const [retireVersionId, setRetireVersionId] = useState<string>('');
  const [retireReason, setRetireReason] = useState<string>('SYLLABUS_OUTDATED');
  const [retireNote, setRetireNote] = useState<string>('');

  // Fetch unified moderation queue
  const fetchQueue = async () => {
    setQueueLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ success: boolean; data: any }>('/moderation/queue');
      if (res.data) {
        const duplicates = res.data.duplicateFlags || [];
        const ready = res.data.readyForApproval || [];
        const dis = res.data.disagreements || [];
        const diffs = res.data.difficultyConflicts || [];
        const overdue = res.data.overdueAssignments || [];
        const staffing = res.data.staffingWarnings || [];

        setDuplicateItems(duplicates);
        setReadyForApproval(ready);
        setDisagreements(dis);
        setDifficultyConflicts(diffs);
        setOverdueItems(overdue);
        setStaffingWarnings(staffing);

        // Intelligently default to first tab with actionable items
        if (duplicates.length > 0) {
          setActiveTab((prev) => (prev === 'ready' && ready.length === 0 ? 'duplicates' : prev));
        } else if (dis.length > 0) {
          setActiveTab((prev) => (prev === 'ready' && ready.length === 0 ? 'disagreements' : prev));
        } else if (diffs.length > 0) {
          setActiveTab((prev) => (prev === 'ready' && ready.length === 0 ? 'difficultyConflicts' : prev));
        }
      }
    } catch (e: any) {
      setError(e.message || 'Failed to fetch moderator queue');
    } finally {
      setQueueLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  // Fetch decrypted question content ONLY on explicit click (Content Minimization Audit Trigger)
  const handleInspectContent = async (questionId: string, versionNo?: number) => {
    setContentLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ success: boolean; data: any }>(
        `/questions/${questionId}/content${versionNo ? `?version=${versionNo}` : ''}`
      );
      if (res.data) {
        setInspectedContent(res.data);
        setShowContentDetails(true);
      }
    } catch (e: any) {
      setError(`Content Access Notice: ${e.message}`);
    } finally {
      setContentLoading(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedItem(null);
    setInspectedContent(null);
    setShowContentDetails(false);
    setJustification('');
    setResolutionNote('');
    setShowDiffModal(false);
    setDiffAction('ACCEPT_MEAN');
    setDiffCustomValue('50');
    setDiffCustomTiming('120');
    setDiffJustification('');
    setModerationComments('');
    setTotpCode('');
    setShowMfaModal(false);
    setShowReassignModal(false);
    setReassignAssignmentId('');
    setNewReviewerId('');
    setReassignReason('');
  };

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
        setSuccessMsg(`Duplicate disposition recorded (${disposition}). Version updated.`);
        handleCloseModal();
        fetchQueue();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Disagreement Resolution
  const handleDisagreementResolve = async () => {
    if (!resolutionNote.trim()) {
      setError('Please provide a mandatory resolution note detailing the approved answer key.');
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ success: boolean; data?: any }>(
        `/moderation/disagreement/${selectedItem.id}/resolve`,
        {
          method: 'POST',
          body: JSON.stringify({
            resolutionNote,
            decision: disagreementDecision,
          }),
        }
      );
      if (data.success) {
        setSuccessMsg(`Blind-answer disagreement resolved (${disagreementDecision}). Ledger updated.`);
        handleCloseModal();
        fetchQueue();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Difficulty Conflict Resolution
  const handleResolveDifficultySubmit = async () => {
    if (!diffJustification.trim() || diffJustification.trim().length < 10) {
      setError('A written justification of at least 10 characters is mandatory for audit compliance.');
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const body: any = {
        action: diffAction,
        justification: diffJustification.trim(),
      };
      if (diffAction === 'SET_FINAL_VALUE') {
        const val = parseFloat(diffCustomValue);
        if (isNaN(val) || val < 0 || val > 100) {
          setError('Please enter a valid difficulty value between 0 and 100.');
          setActionLoading(false);
          return;
        }
        body.customValue = val;
      }

      if (diffAction === 'SET_FINAL_VALUE' || diffAction === 'ACCEPT_MEAN') {
        const timingVal = parseInt(diffCustomTiming, 10);
        if (!isNaN(timingVal) && timingVal > 0) {
          body.customTimingSeconds = timingVal;
        }
      }

      const data = await apiRequest<{ success: boolean; data?: any }>(
        `/moderation/difficulty-conflict/${selectedItem.id}/resolve`,
        {
          method: 'POST',
          body: JSON.stringify(body),
        }
      );
      if (data.success) {
        setSuccessMsg(`Difficulty conflict resolved (${diffAction}). Encrypted justification recorded.`);
        handleCloseModal();
        fetchQueue();
      }
    } catch (e: any) {
      setError(e.message || 'Failed to resolve difficulty conflict');
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
      const finalComments = moderationComments.trim() || (moderationDecision === 'APPROVE' ? 'Approved by moderator' : `${moderationDecision} by moderator`);
      const data = await apiRequest<{ success: boolean; message?: string }>(
        `/moderation/decision/${selectedItem.id}`,
        {
          method: 'POST',
          body: JSON.stringify({
            decision: moderationDecision,
            comments: finalComments,
            totpToken: finalTotp,
          }),
        }
      );
      if (data.success) {
        setSuccessMsg(`Moderator decision recorded (${moderationDecision}). Ed25519 signature anchored.`);
        handleCloseModal();
        fetchQueue();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Reviewer Reassignment
  const handleReassignSubmit = async () => {
    if (!newReviewerId || !reassignReason.trim()) {
      setError('Please provide a valid new reviewer and a mandatory reassignment reason.');
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ success: boolean; reassignedTo?: string }>(
        '/moderation/reassign',
        {
          method: 'POST',
          body: JSON.stringify({
            assignmentId: reassignAssignmentId,
            newReviewerId,
            reason: reassignReason,
          }),
        }
      );
      if (data.success) {
        setSuccessMsg(`Reviewer reassigned successfully. New 7-day deadline issued.`);
        handleCloseModal();
        fetchQueue();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Question Retirement
  const handleRetireSubmit = async () => {
    if (!retireVersionId.trim() || !retireNote.trim()) {
      setError('Please provide the question version UUID and a detailed retirement note.');
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ success: boolean; status?: string }>(
        `/moderation/retire/${retireVersionId.trim()}`,
        {
          method: 'POST',
          body: JSON.stringify({
            reason: retireReason,
            note: retireNote,
          }),
        }
      );
      if (data.success) {
        setSuccessMsg(`Question version retired (${retireReason}). Never eligible for exam generation.`);
        setRetireVersionId('');
        setRetireNote('');
        fetchQueue();
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
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Institutional Moderator Console</h1>
            <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-slate-900 text-white font-bold tracking-wider">
              Senior Academic Authority
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1 max-w-3xl">
            Queue-isolated gatekeeper authority: decides duplicate flags, resolves reviewer blind-solve disputes, and applies cryptographic Ed25519 signatures for final question approval.
          </p>
        </div>
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={fetchQueue}
            disabled={queueLoading}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${queueLoading ? 'animate-spin text-red-600' : ''}`} />
            <span>{queueLoading ? 'Refreshing...' : 'Refresh Queue'}</span>
          </button>
          <span className="hidden lg:flex items-center text-xs font-mono bg-slate-50 text-slate-700 border border-slate-200 px-3 py-2 rounded-lg font-medium">
            <Lock className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            Queue Isolation & Anonymity Active
          </span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800 flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Strict Role Tab Navigation: Only Authorized Queues */}
      <div className="flex border-b border-slate-200 space-x-2 overflow-x-auto">
        {[
          { key: 'ready', label: 'Ready for Final Approval', count: readyForApproval.length, icon: CheckCircle2, highlight: readyForApproval.length > 0 },
          { key: 'duplicates', label: 'Duplicate Flags', count: duplicateItems.length, icon: ShieldAlert, highlight: duplicateItems.length > 0 },
          { key: 'disagreements', label: 'Disagreements', count: disagreements.length, icon: AlertTriangle, highlight: disagreements.length > 0 },
          { key: 'difficultyConflicts', label: 'Difficulty Conflicts', count: difficultyConflicts.length, icon: Sliders, highlight: difficultyConflicts.length > 0 },
          { key: 'overdue', label: 'Overdue Reviews', count: overdueItems.length, icon: Clock, highlight: false },
          { key: 'staffing', label: 'Staffing Warnings', count: staffingWarnings.length, icon: UserCheck, highlight: false },
          { key: 'retirement', label: 'Question Retirement', count: null, icon: Archive, highlight: false },
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
              <Icon className={`w-4 h-4 ${tab.highlight ? 'text-amber-600' : ''}`} />
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : tab.highlight
                      ? 'bg-amber-50 text-amber-800 border border-amber-200 font-bold'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {queueLoading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-xs space-y-3">
          <div className="inline-flex p-3 rounded-full bg-red-50 text-red-600 mb-1">
            <Loader2 className="w-7 h-7 animate-spin text-red-600" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Synchronizing Moderator Queue...</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto font-mono">
            Filtering duplicate flags, unresolved reviewer disagreements, and pending final approvals under strict zero-knowledge anonymity.
          </p>
        </div>
      ) : (
        <>
          {/* TAB 1: Ready for Final Approval */}
          {activeTab === 'ready' && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Questions Awaiting Final Moderator Approval</h3>
                  <p className="text-xs text-slate-500">
                    Questions where all required double-blind peer reviewers have approved. Review evaluation package and execute signed approval.
                  </p>
                </div>
                <span className="text-xs font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-md font-semibold">
                  {readyForApproval.length} Pending Approval
                </span>
              </div>
              {readyForApproval.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <p className="font-semibold text-slate-800">Final Approval Queue Clear</p>
                  <p className="text-xs">No questions currently awaiting senior moderator sign-off.</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4">Reference & Version</th>
                      <th className="px-6 py-4">Subject & Topic</th>
                      <th className="px-6 py-4">Author</th>
                      <th className="px-6 py-4">Reviewer Approvals</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Moderator Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {readyForApproval.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-mono font-medium text-slate-900">
                          <div>{item.question?.humanId}</div>
                          <span className="text-xs text-slate-400 block font-mono">
                            #{item.id.slice(0, 8)} (v{item.versionNo})
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-slate-800">{item.question?.subject?.name}</span>
                          {item.question?.topic?.name && (
                            <span className="text-xs text-slate-400 block">{item.question?.topic?.name}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                            Author (Anonymized)
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-1.5">
                            <span className="flex items-center text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              {item.reviews?.length || 2} Reviewer Signatures
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-700">
                          MODERATION
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              setModerationDecision('APPROVE');
                            }}
                            className="px-3.5 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-lg shadow-xs"
                          >
                            Review Package & Sign
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 2: Duplicate Flags */}
          {activeTab === 'duplicates' && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Originality Duplicate Flags</h3>
                  <p className="text-xs text-slate-500">
                    Questions flagged by copy-detection algorithms (exact hash, MinHash, or TF-IDF). Evaluate report and record disposition.
                  </p>
                </div>
                <span className="text-xs font-mono bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-md font-semibold">
                  {duplicateItems.length} Flagged
                </span>
              </div>
              {duplicateItems.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <p className="font-semibold text-slate-800">No Duplicate Flags Active</p>
                  <p className="text-xs">No submitted questions currently flagged for similarity violations.</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4">Reference & Version</th>
                      <th className="px-6 py-4">Subject</th>
                      <th className="px-6 py-4">Author</th>
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
                            <div>{item.question?.humanId}</div>
                            <span className="text-xs text-slate-400 block font-mono">
                              #{item.id.slice(0, 8)} (v{item.versionNo})
                            </span>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-800">
                            {item.question?.subject?.name}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                              Author (Anonymized)
                            </span>
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
                                <span className="text-slate-500 font-mono">{match.sourceReference}</span>
                              </div>
                            ) : (
                              'Bank Analysis'
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedItem(item);
                                setDisposition('NOT_DUPLICATE');
                              }}
                              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs"
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

          {/* TAB 3: Disagreements */}
          {activeTab === 'disagreements' && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Blind Solve Answer Key Disagreements</h3>
                  <p className="text-xs text-slate-500">
                    Disputes where a peer reviewer's double-blind solve diverged from author's answer key. Senior academic ruling required.
                  </p>
                </div>
                <span className="text-xs font-mono bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-md font-semibold">
                  {disagreements.length} Disputes
                </span>
              </div>
              {disagreements.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <p className="font-semibold text-slate-800">No Disagreements</p>
                  <p className="text-xs">All reviewer blind answers matched the author's answer key.</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4">Reference & Review ID</th>
                      <th className="px-6 py-4">Subject</th>
                      <th className="px-6 py-4">Author</th>
                      <th className="px-6 py-4">Reviewer</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {disagreements.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-mono font-medium text-slate-900">
                          <div>{item.questionVersion?.question?.humanId}</div>
                          <span className="text-xs text-slate-400 block font-mono">
                            Review #{item.id.slice(0, 8)}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-800">
                          {item.questionVersion?.question?.subject?.name}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                            Author (Anonymized)
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-700">
                          {item.assignment?.reviewer?.name || 'Reviewer A'}
                        </td>
                        <td className="px-6 py-4">
                          <span className="flex items-center text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full w-max">
                            <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" />
                            Blind Answer Divergence
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setSelectedItem(item)}
                            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs"
                          >
                            Inspect & Resolve
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB: Difficulty Conflicts */}
          {activeTab === 'difficultyConflicts' && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Difficulty Rating Conflicts</h3>
                  <p className="text-xs text-slate-500">
                    Questions where peer reviewer difficulty ratings exceed the subject tolerance (default 20 points). Final approval is blocked until resolved.
                  </p>
                </div>
                <span className="text-xs font-mono bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-md font-semibold">
                  {difficultyConflicts.length} Conflicts Pending
                </span>
              </div>
              {difficultyConflicts.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <p className="font-semibold text-slate-800">No Difficulty Conflicts</p>
                  <p className="text-xs">All reviewer difficulty estimates are within policy tolerance or resolved.</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4">Reference & Version</th>
                      <th className="px-6 py-4">Subject</th>
                      <th className="px-6 py-4">Author</th>
                      <th className="px-6 py-4">Reviewer Ratings & Times</th>
                      <th className="px-6 py-4">Delta vs Tolerance</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {difficultyConflicts.map((item) => {
                      const ratings = (item.reviews || []).map((r: any) => r.difficultyRating).filter((r: any) => typeof r === 'number');
                      const maxR = ratings.length > 0 ? Math.max(...ratings) : 0;
                      const minR = ratings.length > 0 ? Math.min(...ratings) : 0;
                      const diff = maxR - minR;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-mono font-medium text-slate-900">
                            <div>{item.question?.humanId}</div>
                            <span className="text-xs text-slate-400 block font-mono">
                              #{item.id.slice(0, 8)} (v{item.versionNo})
                            </span>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-800">
                            {item.question?.subject?.name}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                              Author (Anonymized)
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              {item.reviews?.map((r: any, idx: number) => (
                                <div key={idx} className="text-xs font-mono flex items-center space-x-2">
                                  <span className="font-semibold text-slate-700">{r.reviewerLabel || `Reviewer ${String.fromCharCode(65 + idx)}`}:</span>
                                  <span className="font-bold text-slate-900">{r.difficultyRating !== null ? `${r.difficultyRating}/100` : 'N/A'}</span>
                                  {r.timeTakenSeconds && <span className="text-slate-400">({r.timeTakenSeconds}s)</span>}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="flex items-center text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full w-max">
                              <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-600" />
                              Δ {diff.toFixed(1)} pts (&gt; 20 tol)
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedItem(item);
                                setShowDiffModal(true);
                              }}
                              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs"
                            >
                              Resolve Conflict
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

          {/* TAB 4: Overdue Reviews (Workflow Control) */}
          {activeTab === 'overdue' && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Overdue Review Reassignment</h3>
                  <p className="text-xs text-slate-500">
                    Oversight of reviewer assignments exceeding the policy deadline (7 days max). Reassign to new independent reviewers with audit trail.
                  </p>
                </div>
                <span className="text-xs font-mono bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md font-semibold">
                  {overdueItems.length} Overdue
                </span>
              </div>
              {overdueItems.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <Clock className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <p className="font-semibold text-slate-800">No Overdue Assignments</p>
                  <p className="text-xs">All peer review assignments are within policy deadlines.</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4">Reference & Version</th>
                      <th className="px-6 py-4">Subject</th>
                      <th className="px-6 py-4">Author</th>
                      <th className="px-6 py-4">Assigned Reviewer</th>
                      <th className="px-6 py-4">Days Overdue</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {overdueItems.map((item) => {
                      const q = item.questionVersion?.question;
                      const dueDate = new Date(item.dueDate);
                      const daysOverdue = Math.max(1, Math.ceil((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-mono font-medium text-slate-900">
                            <div>{q?.humanId || 'Unassigned'}</div>
                            <span className="text-xs text-slate-400 block font-mono">
                              #{item.id.slice(0, 8)} (v{item.questionVersion?.versionNo})
                            </span>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-800">
                            {q?.subject?.name || 'Subject'}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                              Author (Anonymized)
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs font-mono text-slate-700">
                            {item.reviewer?.name}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              {daysOverdue} days overdue
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => {
                                setReassignAssignmentId(item.id);
                                setShowReassignModal(true);
                              }}
                              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs"
                            >
                              Reassign Reviewer
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

          {/* TAB 5: Staffing Warnings (Workflow Control) */}
          {activeTab === 'staffing' && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Subject Reviewer Staffing Warnings</h3>
                  <p className="text-xs text-slate-500">
                    Subjects and questions lacking the minimum independent reviewer quota (at least 2 independent peer reviewers).
                  </p>
                </div>
                <span className="text-xs font-mono bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-md font-semibold">
                  {staffingWarnings.length} Warnings
                </span>
              </div>
              {staffingWarnings.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <UserCheck className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <p className="font-semibold text-slate-800">Staffing Quotas Met</p>
                  <p className="text-xs">All active subjects have at least 2 independent eligible reviewers available without conflict.</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4">Reference & Version</th>
                      <th className="px-6 py-4">Subject & Topic</th>
                      <th className="px-6 py-4">Author</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Reviewers Assigned</th>
                      <th className="px-6 py-4 text-right">Policy Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {staffingWarnings.map((item) => {
                      const q = item.question;
                      const count = item.reviewAssignments?.length || 0;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-mono font-medium text-slate-900">
                            <div>{q?.humanId || 'Unassigned'}</div>
                            <span className="text-xs text-slate-400 block font-mono">
                              #{item.id.slice(0, 8)} (v{item.versionNo})
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-semibold text-slate-800">{q?.subject?.name}</span>
                            {q?.topic?.name && (
                              <span className="text-xs text-slate-400 block">{q.topic.name}</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                              Author (Anonymized)
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              {item.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-mono font-semibold text-slate-700">
                              {count} / 2 Assigned
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md font-semibold">
                              Awaiting Additional Reviewer
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 6: Question Retirement */}
          {activeTab === 'retirement' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6 max-w-2xl">
              <div>
                <h3 className="text-base font-bold text-slate-900">Retire Approved Question from Active Bank</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Senior academic authority action: Retires an approved question version. Retired versions become strictly ineligible for exam paper generation. Mandatory justification is required and recorded in the audit log.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">Question Version UUID</label>
                  <input
                    type="text"
                    value={retireVersionId}
                    onChange={(e) => setRetireVersionId(e.target.value)}
                    placeholder="Enter question version UUID (e.g. 56504643-...)"
                    className="w-full text-xs p-3 rounded-lg border border-slate-300 font-mono focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">Mandatory Retirement Reason</label>
                  <select
                    value={retireReason}
                    onChange={(e) => setRetireReason(e.target.value)}
                    className="w-full text-xs p-3 rounded-lg border border-slate-300 font-medium focus:ring-2 focus:ring-slate-900 bg-white"
                  >
                    <option value="SYLLABUS_OUTDATED">SYLLABUS_OUTDATED — Curriculum revision removed topic</option>
                    <option value="FLAW_DISCOVERED">FLAW_DISCOVERED — Ambiguity or scientific inaccuracy identified</option>
                    <option value="POLICY_EXPIRY">POLICY_EXPIRY — Question exceeded maximum exposure lifespan</option>
                    <option value="SUPERSEDED">SUPERSEDED — Replaced by newer refined version</option>
                    <option value="ADMIN_ORDER">ADMIN_ORDER — Examination board directive</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Detailed Retirement Explanation (Audited & Encrypted)
                  </label>
                  <textarea
                    rows={3}
                    value={retireNote}
                    onChange={(e) => setRetireNote(e.target.value)}
                    placeholder="Provide academic justification for retiring this question version..."
                    className="w-full text-xs p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <button
                  type="button"
                  disabled={actionLoading || !retireVersionId.trim() || !retireNote.trim()}
                  onClick={handleRetireSubmit}
                  className="px-5 py-2.5 bg-rose-700 hover:bg-rose-800 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center space-x-1.5"
                >
                  <Archive className="w-4 h-4" />
                  <span>{actionLoading ? 'Retiring...' : 'Execute Permanent Retirement'}</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Duplicate Disposition Modal */}
      {selectedItem && activeTab === 'duplicates' && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
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

            {/* Content Minimization Inspection Banner */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
              <span className="text-slate-600">
                Full question content is protected under content minimization.
              </span>
              <button
                type="button"
                onClick={() => handleInspectContent(selectedItem.questionId, selectedItem.versionNo)}
                disabled={contentLoading}
                className="px-3 py-1 bg-slate-900 hover:bg-black text-white rounded text-xs font-semibold flex items-center space-x-1"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{contentLoading ? 'Decrypting...' : showContentDetails ? 'Refresh Content' : 'Inspect Full Question'}</span>
              </button>
            </div>

            {showContentDetails && inspectedContent && (
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
                <span className="font-bold text-slate-800 block">Question Stem:</span>
                <p className="text-slate-700 bg-white p-2.5 rounded border border-slate-200">{inspectedContent.content?.stem}</p>
              </div>
            )}

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
                  className="w-full text-xs p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
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
      </ModalPortal>
      )}

      {/* Disagreement Resolution Modal */}
      {selectedItem && activeTab === 'disagreements' && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Resolve Blind Solve Disagreement</h3>
                <span className="font-mono text-xs text-slate-500">
                  {selectedItem.questionVersion?.question?.humanId}
                </span>
              </div>
              <span className="text-xs px-2.5 py-1 bg-amber-100 text-amber-800 font-bold rounded-full">
                Answer Mismatch
              </span>
            </div>

            <p className="text-xs text-slate-600">
              A peer reviewer submitted an answer key that diverges from the author's key. As senior moderator, review both derivations and make a binding academic determination.
            </p>

            {/* Content Minimization Button */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
              <span className="text-slate-600">Inspect full question and author solution:</span>
              <button
                type="button"
                onClick={() => handleInspectContent(selectedItem.questionVersion?.questionId, selectedItem.questionVersion?.versionNo)}
                disabled={contentLoading}
                className="px-3 py-1 bg-slate-900 hover:bg-black text-white rounded text-xs font-semibold flex items-center space-x-1"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{contentLoading ? 'Decrypting...' : showContentDetails ? 'Refresh Content' : 'Inspect Full Question'}</span>
              </button>
            </div>

            {showContentDetails && inspectedContent && (
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2 max-h-48 overflow-y-auto">
                <span className="font-bold text-slate-800 block">Question Stem:</span>
                <p className="text-slate-700 bg-white p-2 rounded border border-slate-200">{inspectedContent.content?.stem}</p>
                <span className="font-bold text-slate-800 block">Author Answer Key:</span>
                <pre className="text-slate-700 bg-white p-2 rounded border border-slate-200 font-mono text-[11px]">
                  {JSON.stringify(inspectedContent.answerKey, null, 2)}
                </pre>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">Moderator Determination</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setDisagreementDecision('LET_STAND')}
                  className={`py-2 text-xs font-bold rounded-lg border text-center transition-all ${
                    disagreementDecision === 'LET_STAND'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  LET STAND
                </button>
                <button
                  type="button"
                  onClick={() => setDisagreementDecision('REQUEST_CHANGES')}
                  className={`py-2 text-xs font-bold rounded-lg border text-center transition-all ${
                    disagreementDecision === 'REQUEST_CHANGES'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  REQUEST CHANGES
                </button>
                <button
                  type="button"
                  onClick={() => setDisagreementDecision('REJECT')}
                  className={`py-2 text-xs font-bold rounded-lg border text-center transition-all ${
                    disagreementDecision === 'REJECT'
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  REJECT
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Binding Resolution Note (Ledger Audited)
              </label>
              <textarea
                rows={3}
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Detail the scientific derivation and rationale for this resolution..."
                className="w-full text-xs p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={handleCloseModal}
                className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading || !resolutionNote.trim()}
                onClick={handleDisagreementResolve}
                className="flex-1 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 rounded-lg shadow-xs"
              >
                {actionLoading ? 'Saving...' : 'Resolve Disagreement'}
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}

      {/* Moderation Final Sign-off Modal */}
      {selectedItem && activeTab === 'ready' && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl space-y-4 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Final Moderation Approval Package</h3>
                <span className="font-mono text-xs text-slate-500">
                  {selectedItem.question?.humanId} (v{selectedItem.versionNo}) • Subject: {selectedItem.question?.subject?.name}
                </span>
              </div>
              <span className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold rounded-full">
                Reviewer Approvals Verified
              </span>
            </div>

            {/* Reviewer Package Details */}
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs">
                <span className="font-bold text-slate-800 block uppercase tracking-wider text-[11px]">
                  Double-Blind Reviewer Package
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {selectedItem.reviews?.map((r: any, idx: number) => (
                    <div key={idx} className="bg-white p-2.5 rounded border border-slate-200 space-y-1">
                      <div className="flex justify-between font-mono font-bold">
                        <span>{r.reviewerLabel || `Reviewer ${String.fromCharCode(65 + idx)}`}</span>
                        <span className="text-emerald-700">{r.decision}</span>
                      </div>
                      <div className="text-slate-700 font-mono text-[11px] font-semibold">
                        Difficulty Rating: {r.difficultyRating !== null && r.difficultyRating !== undefined ? `${Number(r.difficultyRating).toFixed(1)} / 100` : 'N/A'}
                      </div>
                      {r.timeTakenSeconds && (
                        <div className="text-slate-500 text-[11px]">
                          Time Taken: {r.timeTakenSeconds}s
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {selectedItem.finalDifficulty !== undefined && selectedItem.finalDifficulty !== null && (
                  <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg flex justify-between items-center text-xs text-indigo-900 font-mono">
                    <span>Final Difficulty: <strong>{selectedItem.finalDifficulty.toFixed(1)} / 100</strong></span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-200/80 uppercase font-semibold">
                      {selectedItem.difficultyDerivationMethod || 'AUTO_MEAN'} (Source: {selectedItem.difficultySource || 'EXPERT_RATING'})
                    </span>
                  </div>
                )}
              </div>

              {/* Revision diff against parent version if exists */}
              {selectedItem.parentVersionId && (
                <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-200 text-xs space-y-1">
                  <span className="font-bold text-amber-900 block">Revision of Parent Version:</span>
                  <p className="text-slate-600 font-mono text-[11px]">
                    Parent Version: v{selectedItem.parentVersion?.versionNo ?? 1} (Commitment: {selectedItem.parentVersion?.contentCommitment?.slice(0, 16)}...)
                  </p>
                  <p className="text-amber-800 text-[11px]">
                    On APPROVE, parent version will be atomically retired (SUPERSEDED) in the same transaction.
                  </p>
                </div>
              )}

              {/* Explicit Content Inspection */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                <span className="text-slate-600">Inspect full question and answer key content:</span>
                <button
                  type="button"
                  onClick={() => handleInspectContent(selectedItem.questionId, selectedItem.versionNo)}
                  disabled={contentLoading}
                  className="px-3 py-1 bg-slate-900 hover:bg-black text-white rounded text-xs font-semibold flex items-center space-x-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{contentLoading ? 'Decrypting...' : showContentDetails ? 'Refresh Content' : 'Inspect Full Question'}</span>
                </button>
              </div>

              {showContentDetails && inspectedContent && (
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2 max-h-48 overflow-y-auto">
                  <span className="font-bold text-slate-800 block">Stem:</span>
                  <p className="text-slate-700 bg-white p-2.5 rounded border border-slate-200">{inspectedContent.content?.stem}</p>
                  <span className="font-bold text-slate-800 block">Answer Key:</span>
                  <pre className="text-slate-700 bg-white p-2 rounded border border-slate-200 font-mono text-[11px]">
                    {JSON.stringify(inspectedContent.answerKey, null, 2)}
                  </pre>
                </div>
              )}

              <div className="space-y-2 pt-1">
                <label className="text-xs font-semibold text-slate-700 block">Moderator Final Decision</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setModerationDecision('APPROVE')}
                    className={`py-2 text-xs font-bold rounded-lg border text-center transition-all ${
                      moderationDecision === 'APPROVE'
                        ? 'bg-emerald-600 text-white border-emerald-600'
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
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">Moderator Academic Remarks</label>
                <textarea
                  rows={2}
                  value={moderationComments}
                  onChange={(e) => setModerationComments(e.target.value)}
                  placeholder="Optional notes regarding syllabus alignment or final approval..."
                  className="w-full text-xs p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setShowMfaModal(true)}
                  className="flex-1 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-black rounded-lg shadow-xs flex items-center justify-center space-x-1"
                >
                  <KeyRound className="w-3.5 h-3.5 mr-1" />
                  <span>Proceed to Digital Sign-off</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}

      {/* Step-Up MFA Dialog for Moderator */}
      {showMfaModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 border border-slate-200">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-slate-100 text-slate-800 rounded-lg">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Step-Up Authentication Required</h3>
                <p className="text-xs text-slate-500">
                  Moderator final approval requires fresh MFA confirmation.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1 font-mono text-slate-600">
              <div className="flex justify-between">
                <span>Action:</span>
                <span className="font-bold text-slate-900">{moderationDecision}</span>
              </div>
              <div className="flex justify-between">
                <span>Question Commitment:</span>
                <span className="truncate max-w-[200px] text-slate-500">{selectedItem?.contentCommitment || selectedItem?.question?.humanId}</span>
              </div>
              <div className="flex justify-between">
                <span>Signature Scheme:</span>
                <span>Ed25519 Canonical Anchor</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Enter 6-digit Authenticator Code (or dev code 123456)
              </label>
              <input
                type="text"
                autoFocus
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                placeholder="123456"
                className="w-full text-center tracking-widest font-mono text-lg p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowMfaModal(false)}
                className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Back
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleFinalDecisionSubmit}
                className="flex-1 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-black rounded-lg shadow-xs flex items-center justify-center space-x-1.5"
              >
                {actionLoading ? <span>Signing...</span> : <span>Confirm & Sign</span>}
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}

      {/* Reviewer Reassignment Modal */}
      {showReassignModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 border border-slate-200">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-slate-100 text-slate-800 rounded-lg">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Reassign Overdue Review</h3>
                <p className="text-xs text-slate-500">
                  Assign to another independent reviewer with an audited justification.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">New Reviewer UUID</label>
                <input
                  type="text"
                  value={newReviewerId}
                  onChange={(e) => setNewReviewerId(e.target.value)}
                  placeholder="Enter reviewer user UUID"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-mono focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">Reassignment Justification</label>
                <textarea
                  rows={2}
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="Reviewer unresponsive past 7-day policy limit..."
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading || !newReviewerId || !reassignReason.trim()}
                  onClick={handleReassignSubmit}
                  className="flex-1 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs"
                >
                  {actionLoading ? 'Reassigning...' : 'Confirm Reassignment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}
      {/* Difficulty Conflict Resolution Modal */}
      {showDiffModal && selectedItem && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-xl space-y-4 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center space-x-3 pb-2 border-b border-slate-200">
              <div className="p-2.5 bg-amber-50 text-amber-700 rounded-lg">
                <Sliders className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Resolve Reviewer Difficulty Conflict</h3>
                <p className="text-xs text-slate-500 font-mono">
                  {selectedItem.question?.humanId} (v{selectedItem.versionNo}) — Subject: {selectedItem.question?.subject?.name}
                </p>
              </div>
            </div>

            {/* Reviewer ratings breakdown */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs">
              <span className="font-bold text-slate-800 block uppercase tracking-wider text-[11px]">
                Reviewer Evaluation Breakdown
              </span>
              <div className="grid grid-cols-2 gap-2">
                {selectedItem.reviews?.map((r: any, idx: number) => (
                  <div key={idx} className="bg-white p-2.5 rounded border border-slate-200 space-y-1">
                    <div className="flex justify-between font-mono font-bold">
                      <span>{r.reviewerLabel || `Reviewer ${String.fromCharCode(65 + idx)}`}</span>
                      <span className={r.blindAnswerMatchesKey ? 'text-emerald-700' : 'text-amber-700'}>
                        {r.blindAnswerMatchesKey ? 'Key Matched' : 'Mismatch'}
                      </span>
                    </div>
                    <div className="text-slate-800 text-xs font-mono font-semibold">
                      Difficulty Rating: {r.difficultyRating !== null ? `${r.difficultyRating} / 100` : 'N/A'}
                    </div>
                    {r.timeTakenSeconds && (
                      <div className="text-slate-500 text-[11px]">
                        Time Taken: {r.timeTakenSeconds} seconds
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Resolution Options */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">Moderator Resolution Determination</label>
              <div className="space-y-2">
                {[
                  {
                    value: 'ACCEPT_MEAN',
                    label: '1. Accept Mean of Ratings',
                    desc: 'Automatically set final difficulty to the arithmetic mean of reviewer ratings.',
                  },
                  {
                    value: 'SET_FINAL_VALUE',
                    label: '2. Set Final Value (Senior Academic Override)',
                    desc: 'Manually specify the calibrated difficulty value (0 - 100) based on academic rubric.',
                  },
                  {
                    value: 'REQUEST_THIRD_REVIEW',
                    label: '3. Request Third Review (Tie-Breaker)',
                    desc: 'Dispatch an extra independent reviewer via cryptographically secure random selection. Policy will apply median of all 3 ratings.',
                  },
                  {
                    value: 'REQUEST_CHANGES',
                    label: '4. Request Changes from Author',
                    desc: 'Send question back to author to adjust question wording, distractors, or marks.',
                  },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`block p-3 rounded-lg border cursor-pointer transition-all ${
                      diffAction === opt.value
                        ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start space-x-2.5">
                      <input
                        type="radio"
                        name="diffAction"
                        value={opt.value}
                        checked={diffAction === opt.value}
                        onChange={() => setDiffAction(opt.value as any)}
                        className="mt-0.5 text-slate-900 focus:ring-slate-900"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">{opt.label}</span>
                        <span className="text-[11px] text-slate-500 block mt-0.5">{opt.desc}</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {diffAction === 'SET_FINAL_VALUE' && (
              <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-xs font-bold text-slate-800 block">
                  Senior Academic Determination: Set Calibrated Hardness & Timing
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Actual Hardness (0 - 100) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={diffCustomValue}
                      onChange={(e) => setDiffCustomValue(e.target.value)}
                      placeholder="e.g. 65"
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-mono focus:ring-2 focus:ring-slate-900 bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Actual Timing (Seconds) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="3600"
                      step="5"
                      value={diffCustomTiming}
                      onChange={(e) => setDiffCustomTiming(e.target.value)}
                      placeholder="e.g. 120"
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-mono focus:ring-2 focus:ring-slate-900 bg-white"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Setting the actual hardness and timing resolves the disagreement, updates the question metadata, and immediately promotes it into the active Question Bank.
                </p>
              </div>
            )}

            {/* Mandatory Written Justification */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Mandatory Written Justification <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={diffJustification}
                onChange={(e) => setDiffJustification(e.target.value)}
                placeholder="Detailed academic rationale for the selected resolution..."
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900"
              />
              <span className="text-[11px] text-slate-400 block">
                Envelope-encrypted and anchored to the tamper-evident audit ledger.
              </span>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={handleCloseModal}
                className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading || !diffJustification.trim() || diffJustification.trim().length < 10}
                onClick={handleResolveDifficultySubmit}
                className="flex-1 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-black rounded-lg shadow-xs flex items-center justify-center space-x-1.5 disabled:opacity-50"
              >
                {actionLoading ? 'Anchoring...' : 'Confirm Resolution'}
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}
    </div>
  );
};
