import React, { useState, useEffect } from 'react';
import { KaTeXPreview } from '../components/KaTeXPreview';
import { apiRequest } from '../lib/api-client';
import {
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertTriangle,
  KeyRound,
  Lock,
  ArrowRight,
  Sliders,
  Loader2,
  RefreshCw,
} from 'lucide-react';

interface Assignment {
  id: string;
  questionVersionId: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  dueDate: string;
  humanId?: string;
  versionNo?: number;
  subjectName?: string;
  subjectCode?: string;
  topicName?: string;
  difficulty?: number;
  type?: string;
  language?: string;
  questionVersion?: any;
  isLocked?: boolean;
  lockReason?: string;
}

interface WorkspaceData {
  assignmentId: string;
  questionVersionId: string;
  humanId: string;
  versionNo: number;
  subject: { name: string; code: string };
  topic?: { name: string };
  difficulty: number;
  type: string;
  language: string;
  isLocked?: boolean;
  lockReason?: string;
  phase: 'SOLVE' | 'EVALUATE' | 'COMPLETED' | 'SUBMITTED' | string;
  stem: string;
  options: { label: string; text: string }[];
  answerKey?: any; // Only present in EVALUATE or COMPLETED
  solution?: string; // Only present in EVALUATE or COMPLETED
  existingReview?: {
    blindAnswer: any;
    timeTakenSeconds?: number;
    difficultyRating?: number;
    blindAnswerMatchesKey?: boolean;
    disagreementFlag?: boolean;
    checklist?: any;
    comments?: string;
    decision?: string;
  };
}

export const ReviewerWorkspace: React.FC = () => {
  const [queue, setQueue] = useState<Assignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [signedModal, setSignedModal] = useState<{
    open: boolean;
    decision: string;
    humanId: string;
  } | null>(null);

  // Phase 1 (SOLVE) state
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [timeTakenMinutes, setTimeTakenMinutes] = useState<number>(3);
  const [estimatedDifficulty, setEstimatedDifficulty] = useState<number>(0.5);

  // Phase 2 (EVALUATE) state
  const [checklist, setChecklist] = useState({
    contentAccuracy: true,
    singleDefensibleAnswer: true,
    clarityAndWording: true,
    distractorPlausibility: true,
    syllabusTopicAlignment: true,
    difficultyAppropriate: true,
    languageEquivalence: true,
    biasAndSensitivity: true,
    formattingMathRendering: true,
  });
  const [comments, setComments] = useState<string>('');
  const [decision, setDecision] = useState<'APPROVE' | 'REQUEST_CHANGES' | 'REJECT'>('APPROVE');
  const [showMfaModal, setShowMfaModal] = useState<boolean>(false);
  const [totpCode, setTotpCode] = useState<string>('');

  const handleBackToDashboard = () => {
    setSignedModal(null);
    setSelectedAssignmentId(null);
    setWorkspace(null);
    setSuccessMsg(null);
    setError(null);
    fetchQueue();
  };

  // Fetch Review Queue
  const fetchQueue = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{ success: boolean; data: Assignment[] }>('/review/queue');
      if (data.success) {
        setQueue(data.data);
      } else {
        setError('Failed to fetch review assignments');
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching assignments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  // Fetch Assignment Workspace
  const openWorkspace = async (assignmentId: string) => {
    setSelectedAssignmentId(assignmentId);
    setActionLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ success: boolean; data: WorkspaceData }>(`/review/assignments/${assignmentId}`);
      if (data.success) {
        setWorkspace(data.data);
        if (data.data.existingReview) {
          if (data.data.existingReview.difficultyRating) {
            setEstimatedDifficulty(data.data.existingReview.difficultyRating);
          }
          if (data.data.existingReview.timeTakenSeconds) {
            setTimeTakenMinutes(Math.round(data.data.existingReview.timeTakenSeconds / 60) || 1);
          }
          if (data.data.existingReview.decision) {
            setDecision(data.data.existingReview.decision as any);
          }
          if (data.data.existingReview.checklist) {
            setChecklist(data.data.existingReview.checklist);
          }
        }
      } else {
        setError('Failed to load question workspace');
      }
    } catch (err: any) {
      setError(err.message || 'Network error loading workspace');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Blind Answer (Phase 1)
  const handleSubmitBlindAnswer = async () => {
    if (!selectedOption) {
      setError('Please select an answer before continuing.');
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ success: boolean; data: any; message?: string }>(
        `/review/assignments/${selectedAssignmentId}/blind-answer`,
        {
          method: 'POST',
          body: JSON.stringify({
            blindAnswer: selectedOption,
            timeTakenSeconds: Math.max(1, Math.round(timeTakenMinutes * 60)),
            difficultyRating: parseFloat(Number(estimatedDifficulty).toFixed(2)),
          }),
        }
      );
      if (data.success) {
        setSuccessMsg('Blind solve recorded successfully! Answer key and checklist unlocked.');
        // Refresh workspace to unlock evaluate phase
        await openWorkspace(selectedAssignmentId!);
      } else {
        setError('Failed to submit blind answer');
      }
    } catch (err: any) {
      setError(err.message || 'Error submitting blind answer');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Final Review (Phase 2 with Step-up MFA)
  const handleSubmitFinalReview = async () => {
    if (!comments.trim()) {
      setError('Please provide qualitative review comments before finalizing.');
      return;
    }
    const finalTotp = totpCode.trim() || '123456';
    if (!/^\d{6}$/.test(finalTotp)) {
      setError('Please enter a valid 6-digit TOTP authentication code.');
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ success: boolean; data: any; message?: string }>(
        `/review/assignments/${selectedAssignmentId}/evaluate`,
        {
          method: 'POST',
          body: JSON.stringify({
            decision,
            checklist,
            comments,
            totpToken: finalTotp,
          }),
        }
      );
      if (data.success) {
        setShowMfaModal(false);
        const signedDecision = data.data?.decision || decision;
        setSuccessMsg(`Review completed and cryptographically signed (${signedDecision})!`);
        setSignedModal({
          open: true,
          decision: signedDecision,
          humanId: workspace?.humanId || '',
        });
        fetchQueue();
      } else {
        setError('Failed to submit review');
      }
    } catch (err: any) {
      setError(err.message || 'Error submitting review');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-xs space-y-3 my-8">
        <div className="inline-flex p-3 rounded-full bg-red-50 text-red-600 mb-1">
          <Loader2 className="w-7 h-7 animate-spin" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Loading Blind Review Queue...</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto font-mono">
          Fetching assigned double-blind peer review items and verifying blind cryptographic commitments
        </p>
      </div>
    );
  }

  // If no assignment selected, show Review Queue
  if (!selectedAssignmentId || !workspace) {
    return (
      <div className="w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Independent Blind Review Queue</h1>
            <p className="text-sm text-slate-500">
              Double-blind peer review assignments. Author identity is strictly concealed.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchQueue}
              disabled={loading}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-red-600' : ''}`} />
              <span>{loading ? 'Refreshing...' : 'Refresh Queue'}</span>
            </button>
            <span className="flex items-center text-xs font-mono bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1.5 rounded-md font-medium">
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
              Cryptographic Commitment Bound
            </span>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}


        {queue.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3 shadow-xs">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h3 className="text-base font-semibold text-slate-900">Queue is Clear</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              You currently have no active review assignments pending for your subject tags.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Question ID</th>
                    <th className="px-6 py-4">Subject & Topic</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Due Date</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {queue.map((item) => {
                    const qId = item.humanId || item.questionVersion?.question?.humanId || `EV-${item.id.slice(0, 8)}`;
                    const vNo = item.versionNo || item.questionVersion?.versionNo || 1;
                    const subj = item.subjectName || item.questionVersion?.question?.subject?.name || 'General';
                    const top = item.topicName || item.questionVersion?.question?.topic?.name;
                    const qType = item.type || item.questionVersion?.question?.type || 'MCQ_SINGLE';

                    const isOpening = actionLoading && selectedAssignmentId === item.id;

                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors ${
                          isOpening ? 'bg-slate-100/90 ring-1 ring-slate-300' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-6 py-4 font-mono font-medium text-slate-900">
                          <span className="font-bold text-slate-900">{qId}</span>
                          <span className="text-xs text-slate-400 block font-normal">v{vNo}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-slate-800">{subj}</span>
                          {top ? (
                            <span className="text-slate-400 text-xs block">{top}</span>
                          ) : (
                            <span className="text-slate-400 text-xs block italic">Core Curriculum</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs px-2 py-0.5 font-mono bg-slate-100 text-slate-700 rounded-md border border-slate-200">
                            {qType}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                              item.status === 'COMPLETED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : item.status === 'IN_PROGRESS'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {item.status}
                          </span>
                          {item.isLocked && (
                            <span className="ml-1.5 text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              LOCKED
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs font-mono text-slate-500">
                          {new Date(item.dueDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => openWorkspace(item.id)}
                            disabled={actionLoading}
                            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg shadow-xs transition-all ${
                              isOpening
                                ? 'bg-slate-800 text-white cursor-wait ring-2 ring-red-500/50'
                                : actionLoading
                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60'
                                : 'bg-slate-900 hover:bg-slate-800 text-white hover:scale-[1.02] active:scale-[0.98]'
                            }`}
                          >
                            {isOpening ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                                <span>{item.status === 'COMPLETED' ? 'Opening Review...' : 'Opening Workspace...'}</span>
                              </>
                            ) : (
                              <>
                                <span>{item.status === 'COMPLETED' ? 'View Review' : 'Enter Workspace'}</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Two-Step Review Workspace
  const isCompleted =
    workspace.phase === 'COMPLETED' ||
    workspace.phase === 'SUBMITTED' ||
    (workspace as any).status === 'COMPLETED';
  const isSolvePhase = workspace.phase === 'SOLVE' && !isCompleted;
  const isEvaluatePhase = workspace.phase === 'EVALUATE' || isCompleted;

  return (
    <div className="w-full space-y-6">
      {/* Top Banner & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <button
            onClick={handleBackToDashboard}
            className="text-xs text-slate-500 hover:text-slate-900 font-medium mb-1 inline-flex items-center space-x-1"
          >
            <span>← Back to Review Queue</span>
          </button>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-mono">{workspace.humanId}</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
              v{workspace.versionNo}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-red-50 text-red-700 border border-red-200">
              {workspace.subject?.name || (workspace as any).metadata?.subject?.name || 'General'}
            </span>
            {workspace.isLocked && (
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center space-x-1">
                <Lock className="w-3 h-3" />
                <span>WORKFLOW SUSPENDED</span>
              </span>
            )}
          </div>
        </div>

        {/* Phase Indicator Pills */}
        <div className="flex items-center space-x-2">
          <div
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium border ${
              isSolvePhase
                ? 'bg-blue-50 text-blue-700 border-blue-200 ring-2 ring-blue-500/20'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center font-bold text-[11px] shadow-xs">
              1
            </span>
            <span>Blind Solve Phase</span>
            {!isSolvePhase && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
          </div>

          <ArrowRight className="w-4 h-4 text-slate-300" />

          <div
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium border ${
              isCompleted
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-1 ring-emerald-500/30'
                : isEvaluatePhase
                ? 'bg-blue-50 text-blue-700 border-blue-200 ring-2 ring-blue-500/20'
                : 'bg-slate-50 text-slate-400 border-slate-200'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center font-bold text-[11px] shadow-xs">
              2
            </span>
            <span>Checklist & Approval</span>
            {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
          </div>
        </div>
      </div>

      {/* Anonymity Security Notice */}
      <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Lock className="w-3.5 h-3.5 text-slate-500" />
          <span>Double-blind protocol active: Author identity has been sanitized. Question key withheld during Step 1.</span>
        </div>
        <span className="font-mono text-[10px] text-slate-400">Policy: IEEE/JAC-Blind-2025</span>
      </div>

      {workspace.isLocked && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center space-x-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <span className="font-bold block text-sm">Workflow Suspended by Administration</span>
            <p className="mt-0.5">
              This question workflow is currently locked/suspended ({workspace.lockReason || 'Administrative dispute investigation'}). Submissions and evaluations are frozen until released by an administrator.
            </p>
          </div>
        </div>
      )}

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

      {/* Main Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Question Presentation (Always Visible) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Question Stem</span>
              <span className="text-xs font-mono text-slate-400">Language: {workspace.language || (workspace as any).metadata?.language || 'EN'}</span>
            </div>
            <div className="text-slate-900 leading-relaxed text-base">
              <KaTeXPreview content={workspace.stem || (workspace as any).content?.stem || ''} />
            </div>

            {/* Multiple Choice Options */}
            <div className="space-y-2.5 pt-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">Options</span>
              {(workspace.options || (workspace as any).content?.options || []).map((opt: any) => {
                const isSelected = selectedOption === opt.label;
                return (
                  <div
                    key={opt.label}
                    onClick={() => isSolvePhase && setSelectedOption(opt.label)}
                    className={`flex items-start space-x-3 p-3.5 rounded-lg border transition-all ${
                      isSolvePhase ? 'cursor-pointer hover:border-slate-400' : ''
                    } ${
                      isSelected
                        ? 'bg-blue-50/50 border-blue-500 ring-1 ring-blue-500'
                        : 'bg-slate-50/50 border-slate-200'
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300 text-slate-700'
                      }`}
                    >
                      {opt.label}
                    </span>
                    <div className="text-sm text-slate-800 flex-1 pt-0.5">
                      <KaTeXPreview content={opt.text} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Answer Key & Solution Revealed Card (Phase 2 Only) */}
          {(isEvaluatePhase || isCompleted) && workspace.answerKey && (
            <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                    Author Answer Key & Solution (Unlocked)
                  </span>
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                  Key: {workspace.answerKey.correct}
                </span>
              </div>

              {/* Disagreement Warning if mismatch occurred */}
              {workspace.existingReview?.disagreementFlag && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Blind Solve Disagreement:</span> You answered{' '}
                    <span className="font-mono font-bold">
                      {workspace.existingReview.blindAnswer?.correct || 'Different'}
                    </span>
                    , while the author's key specifies{' '}
                    <span className="font-mono font-bold">{workspace.answerKey.correct}</span>. A disagreement flag has
                    been recorded for moderator attention.
                  </div>
                </div>
              )}

              {workspace.solution && (
                <div className="space-y-1 text-sm text-slate-700">
                  <span className="text-xs font-semibold text-slate-500 block">Author's Verified Solution:</span>
                  <div className="p-3 bg-white rounded-lg border border-emerald-100 leading-relaxed">
                    <KaTeXPreview content={workspace.solution} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Interaction Workflows */}
        <div className="lg:col-span-5 space-y-6">
          {/* STEP 1: SOLVE PHASE FORM */}
          {isSolvePhase && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
              <div className="pb-3 border-b border-slate-100">
                <h3 className="text-base font-semibold text-slate-900">Step 1: Blind Solution</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Solve the question independently. Your answer will be compared to the author's answer key upon submission.
                </p>
              </div>

              {/* Time taken */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>Time Taken to Solve</span>
                  <span className="font-mono text-slate-500">{timeTakenMinutes} minutes</span>
                </label>
                <div className="flex items-center space-x-3">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <input
                    type="range"
                    min="1"
                    max="15"
                    step="1"
                    value={timeTakenMinutes}
                    onChange={(e) => setTimeTakenMinutes(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
                  />
                </div>
              </div>

              {/* Difficulty Slider */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>Reviewer Estimated Difficulty (IRT Scale)</span>
                  <span className="font-mono text-slate-500">{estimatedDifficulty.toFixed(2)}</span>
                </label>
                <div className="flex items-center space-x-3">
                  <Sliders className="w-4 h-4 text-slate-400" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={estimatedDifficulty}
                    onChange={(e) => setEstimatedDifficulty(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900"
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>Easy (0.0)</span>
                  <span>Moderate (0.5)</span>
                  <span>Challenging (1.0)</span>
                </div>
              </div>

              <button
                disabled={!selectedOption || actionLoading || Boolean(workspace.isLocked)}
                onClick={handleSubmitBlindAnswer}
                className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors"
              >
                {actionLoading ? (
                  <span>Recording Solution...</span>
                ) : (
                  <>
                    <span>Submit Solution & Unlock Evaluation</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* STEP 2: EVALUATE & APPROVAL FORM */}
          {(isEvaluatePhase || isCompleted) && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
              <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Step 2: Quality Checklist</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Evaluate pedagogical soundness against the 9-point rubric.
                  </p>
                </div>
                {isCompleted && (
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold">
                    Completed
                  </span>
                )}
              </div>

              {/* 9 Checklist Items */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {[
                  { key: 'contentAccuracy', label: '1. Content accuracy and scientific correctness' },
                  { key: 'singleDefensibleAnswer', label: '2. Exactly one defensible correct answer' },
                  { key: 'clarityAndWording', label: '3. Clarity and unambiguous wording' },
                  { key: 'distractorPlausibility', label: '4. Plausibility of distractors' },
                  { key: 'syllabusTopicAlignment', label: '5. Syllabus and topic alignment' },
                  { key: 'difficultyAppropriate', label: '6. Difficulty appropriateness' },
                  { key: 'languageEquivalence', label: '7. Translation & language equivalence' },
                  { key: 'biasAndSensitivity', label: '8. Bias, sensitivity, and fairness' },
                  { key: 'formattingMathRendering', label: '9. Mathematical formatting & LaTeX rendering' },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center space-x-2.5 p-2 rounded hover:bg-slate-50 cursor-pointer text-xs text-slate-700"
                  >
                    <input
                      type="checkbox"
                      disabled={isCompleted}
                      checked={(checklist as any)[item.key]}
                      onChange={(e) =>
                        setChecklist({ ...checklist, [item.key]: e.target.checked })
                      }
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 w-4 h-4"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>

              {/* Review Comments */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>Qualitative Comments for Author</span>
                  <span className="text-[10px] text-slate-400 font-mono">Envelope Encrypted</span>
                </label>
                <textarea
                  disabled={isCompleted}
                  rows={3}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Provide constructive feedback on wording, steps, or distractors..."
                  className="w-full text-xs p-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {/* Decision Radio Group */}
              {!isCompleted ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">Recommendation</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setDecision('APPROVE')}
                      className={`py-2 text-xs font-bold rounded-lg border text-center transition-all ${
                        decision === 'APPROVE'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      APPROVE
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecision('REQUEST_CHANGES')}
                      className={`py-2 text-xs font-bold rounded-lg border text-center transition-all ${
                        decision === 'REQUEST_CHANGES'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      REQUEST CHANGES
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecision('REJECT')}
                      className={`py-2 text-xs font-bold rounded-lg border text-center transition-all ${
                        decision === 'REJECT'
                          ? 'bg-red-600 text-white border-red-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      REJECT
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">Signed Recommendation</label>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600">Recorded Decision:</span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        (workspace.existingReview?.decision || decision) === 'APPROVE'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : (workspace.existingReview?.decision || decision) === 'REQUEST_CHANGES'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-red-100 text-red-800 border border-red-300'
                      }`}
                    >
                      {workspace.existingReview?.decision || decision}
                    </span>
                  </div>
                </div>
              )}

              {/* Submit Final Decision button OR Completed card */}
              {isCompleted ? (
                <div className="space-y-3 pt-2">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 space-y-1.5">
                    <div className="flex items-center space-x-2 font-bold text-sm">
                      <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span>Review Finalized & Cryptographically Signed</span>
                    </div>
                    <p className="text-xs text-emerald-700 leading-relaxed">
                      This evaluation has been signed using your Ed25519 cryptographic key and committed to the tamper-evident audit trail.
                    </p>
                  </div>
                  <button
                    onClick={handleBackToDashboard}
                    className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center justify-center space-x-2"
                  >
                    <span>Back to Review Queue</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  disabled={actionLoading || !comments.trim() || Boolean(workspace.isLocked)}
                  onClick={() => setShowMfaModal(true)}
                  className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Sign & Submit Decision</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Step-Up MFA Dialog */}
      {showMfaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 border border-slate-200">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-red-50 text-red-600 rounded-lg">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Step-Up Authentication Required</h3>
                <p className="text-xs text-slate-500">
                  A fresh TOTP code is required to sign this decision with your Ed25519 key.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1 font-mono text-slate-600">
              <div className="flex justify-between">
                <span>Action:</span>
                <span className="font-bold text-slate-900">{decision}</span>
              </div>
              <div className="flex justify-between">
                <span>Question Commitment:</span>
                <span className="truncate max-w-[200px] text-slate-500">{workspace.humanId}</span>
              </div>
              <div className="flex justify-between">
                <span>Key Algorithm:</span>
                <span>Ed25519 (Canonical RFC-8032)</span>
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
              <span className="text-[11px] text-slate-400 block text-center">
                (For prototype testing, leave blank or enter any 6 digits)
              </span>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowMfaModal(false)}
                className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleSubmitFinalReview}
                className="flex-1 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors flex items-center justify-center space-x-1.5"
              >
                {actionLoading ? <span>Signing...</span> : <span>Confirm & Sign</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Signed Success Centered Modal */}
      {signedModal?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-8 shadow-2xl border border-slate-200 text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center ring-8 ring-emerald-50">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl shadow-xs">
              <h2 className="text-lg font-bold text-emerald-900 leading-snug">
                Review completed and cryptographically signed ({signedModal.decision})!
              </h2>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2 text-left font-mono">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">Question Commitment:</span>
                <span className="font-bold text-slate-900">{signedModal.humanId}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">Decision Recorded:</span>
                <span className="font-bold text-emerald-700">{signedModal.decision}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Signature Algorithm:</span>
                <span className="text-slate-700 font-semibold">Ed25519 (Canonical RFC-8032)</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              The cryptographic approval signature has been anchored to the tamper-evident audit ledger.
            </p>

            <button
              onClick={handleBackToDashboard}
              className="w-full py-3 px-6 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl shadow-md transition-all flex items-center justify-center space-x-2"
            >
              <span>Back to Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
