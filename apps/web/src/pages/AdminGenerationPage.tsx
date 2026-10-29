import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api-client';
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Download,
  KeyRound,
  RefreshCw,
  Plus,
  Play,
  Loader2,
  FileText,
  Check,
  X,
} from 'lucide-react';

export const AdminGenerationPage: React.FC = () => {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'blueprints' | 'requests' | 'papers'>('overview');

  const [loading, setLoading] = useState<boolean>(true);
  const [readinessLoading, setReadinessLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Bank Overview State
  const [bankOverview, setBankOverview] = useState<any | null>(null);
  const [readinessData, setReadinessData] = useState<any | null>(null);

  // Blueprints State
  const [blueprints, setBlueprints] = useState<any[]>([]);
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string>('');

  // Generation Requests & Approvals State
  const [requests, setRequests] = useState<any[]>([]);
  const [custodianGroups, setCustodianGroups] = useState<any[]>([]);
  const [papers, setPapers] = useState<any[]>([]);

  // Form states for new generation request
  const [formExamId, setFormExamId] = useState<string>('00000000-0000-0000-0000-000000000001');
  const [formBlueprintVersionId, setFormBlueprintVersionId] = useState<string>('');
  const [formCustodianGroupId, setFormCustodianGroupId] = useState<string>('');
  const [formSetsCount, setFormSetsCount] = useState<number>(2);
  const [formGnb, setFormGnb] = useState<string>('');
  const [formGna, setFormGna] = useState<string>('');
  const [formRnb, setFormRnb] = useState<string>('');
  const [formAnb, setFormAnb] = useState<string>('');
  const [formProfile, setFormProfile] = useState<string>('OFFLINE_QUESTION_PAPER');
  const [formRetention, setFormRetention] = useState<number>(720);

  // Approval step-up modal
  const [approveRequestId, setApproveRequestId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState<string>('123456');
  const [decisionReason, setDecisionReason] = useState<string>('');

  // Load Data
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Bank overview
      const overviewRes = await apiRequest<any>('/generation/overview');
      setBankOverview(overviewRes);

      // 2. Blueprints
      const bpRes = await apiRequest<any[]>('/blueprints');
      setBlueprints(bpRes || []);
      if (bpRes && bpRes.length > 0) {
        if (!selectedBlueprintId) {
          setSelectedBlueprintId(bpRes[0].id);
        }
        if (bpRes[0].examId) {
          setFormExamId(bpRes[0].examId);
        }
        if (!formBlueprintVersionId && bpRes[0].versions?.length > 0) {
          setFormBlueprintVersionId(bpRes[0].versions[0].id);
        }
      }

      // 3. Custodian Groups
      const cgRes = await apiRequest<any[]>('/custodians/groups');
      setCustodianGroups(cgRes || []);
      if (cgRes && cgRes.length > 0 && !formCustodianGroupId) {
        setFormCustodianGroupId(cgRes[0].id);
      }

      // 4. Requests & Papers
      const reqRes = await apiRequest<any[]>('/generation/requests');
      setRequests(reqRes || []);

      const papersRes = await apiRequest<any[]>('/generation/papers');
      setPapers(papersRes || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load paper generation dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Default windows in UTC/local ISO format
    const now = Date.now();
    const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 16);
    setFormGnb(toIso(now + 2 * 60 * 1000));
    setFormGna(toIso(now + 60 * 60 * 1000));
    setFormRnb(toIso(now + 120 * 60 * 1000));
    setFormAnb(toIso(now + 300 * 60 * 1000));
  }, []);

  // Fetch readiness whenever selected blueprint changes
  useEffect(() => {
    if (selectedBlueprintId) {
      setReadinessLoading(true);
      apiRequest<any>(`/blueprints/${selectedBlueprintId}/readiness`)
        .then((res) => setReadinessData(res))
        .catch(() => setReadinessData(null))
        .finally(() => setReadinessLoading(false));
    }
  }, [selectedBlueprintId]);

  // Submit Generation Request
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setActionLoading(true);
    try {
      await apiRequest('/generation/request', {
        method: 'POST',
        body: JSON.stringify({
          examId: formExamId,
          blueprintVersionId: formBlueprintVersionId,
          custodianGroupId: formCustodianGroupId,
          setsCount: formSetsCount,
          generateNotBefore: new Date(formGnb).toISOString(),
          generateNotAfter: new Date(formGna).toISOString(),
          releaseNotBefore: new Date(formRnb).toISOString(),
          answerKeyNotBefore: new Date(formAnb).toISOString(),
          exportProfile: formProfile,
          downloadRetentionMinutes: formRetention,
        }),
      });
      setSuccessMsg('Generation request proposed successfully. Awaiting second administrator approval.');
      await loadData();
      setActiveSubTab('requests');
    } catch (err: any) {
      setError(err.message || 'Failed to submit generation request');
    } finally {
      setActionLoading(false);
    }
  };

  // Second Admin Approval
  const handleApproveRequest = async (decision: 'APPROVE' | 'REJECT') => {
    if (!approveRequestId) return;
    setError(null);
    setSuccessMsg(null);
    setActionLoading(true);
    try {
      await apiRequest(`/generation/requests/${approveRequestId}/approval`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          mfaCode,
          reason: decisionReason,
        }),
      });
      setSuccessMsg(`Generation request ${decision === 'APPROVE' ? 'approved' : 'rejected'} successfully.`);
      setApproveRequestId(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || `Failed to ${decision.toLowerCase()} request`);
    } finally {
      setActionLoading(false);
    }
  };

  // Trigger Immediate Generation (if approved & inside window)
  const handleGenerateNow = async (reqId: string) => {
    setError(null);
    setSuccessMsg(null);
    setActionLoading(true);
    try {
      await apiRequest(`/generation/requests/${reqId}/generate`, {
        method: 'POST',
        body: JSON.stringify({ forceImmediate: true }),
      });
      setSuccessMsg('Paper generation executed and sealed cryptographically.');
      await loadData();
      setActiveSubTab('papers');
    } catch (err: any) {
      setError(err.message || 'Failed to execute paper generation');
    } finally {
      setActionLoading(false);
    }
  };

  // Download Token & File Download
  const handleDownloadPaper = async (paperId: string) => {
    setError(null);
    setActionLoading(true);
    try {
      const tokenRes = await apiRequest<{ token: string; paperId: string }>(
        `/release/papers/${paperId}/download-token`,
        { method: 'POST', body: JSON.stringify({ fileType: 'PAPER_CSV' }) },
      );
      const downloadRes = await apiRequest<{ fileName: string; content: string }>(
        `/release/papers/${paperId}/download?token=${tokenRes.token}`,
      );
      const blob = new Blob([downloadRes.content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', downloadRes.fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setSuccessMsg(`Downloaded ${downloadRes.fileName} successfully.`);
    } catch (err: any) {
      setError(err.message || 'Download failed or permission denied');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 w-full text-slate-900">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Paper Generation & Release Console
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 font-semibold">
              Admin Dual-Control
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Constrained-optimization CP-SAT generation, threshold key split, and time-gated release
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 transition border border-slate-300"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-red-600' : 'text-slate-600'}`} />
          <span>{loading ? 'Refreshing...' : 'Refresh Console'}</span>
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sub-tab Navigation (Restored to clean horizontal bar) */}
      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
            activeSubTab === 'overview'
              ? 'border-red-600 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          1. Bank Overview (Counts Only)
        </button>
        <button
          onClick={() => setActiveSubTab('blueprints')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
            activeSubTab === 'blueprints'
              ? 'border-red-600 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          2. Blueprints & Readiness
        </button>
        <button
          onClick={() => setActiveSubTab('requests')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
            activeSubTab === 'requests'
              ? 'border-red-600 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          3. Generation Requests & Approvals
        </button>
        <button
          onClick={() => setActiveSubTab('papers')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
            activeSubTab === 'papers'
              ? 'border-red-600 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          4. Paper Lifecycle & Delivery
        </button>
      </div>

      {/* Standard Uniform Loading State (matching AdminPage.tsx exactly) */}
      {loading && !bankOverview ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs space-y-3">
          <div className="inline-flex p-3 rounded-full bg-red-50 text-red-600 mb-1">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Loading Paper Generation Console...</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto font-mono">
            Fetching institutional question inventory, blueprint constraints, and release lifecycle
          </p>
        </div>
      ) : (
        <>
          {/* TAB 1: Bank Overview */}
          {activeSubTab === 'overview' && (
            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-900">Confidentiality Guarantee:</span> The administrator console displays aggregate
                  counts only. Question identifiers, stems, options, and candidate lists remain strictly obscured and sealed.
                </div>
              </div>

              {bankOverview && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] uppercase tracking-wider font-bold text-slate-600">
                        1. Eligible Question Bank
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                        Ready
                      </span>
                    </div>
                    <div className="text-3xl font-extrabold text-slate-900 mt-2">
                      {bankOverview.overall.eligibleCount}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Ready for automated selection</div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] uppercase tracking-wider font-bold text-slate-600">
                        2. Pending Reviewer Review
                      </div>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">
                        In Progress
                      </span>
                    </div>
                    <div className="text-3xl font-extrabold text-slate-900 mt-2">
                      {bankOverview.overall.pendingReviewerCount}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Under peer review</div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] uppercase tracking-wider font-bold text-slate-600">
                        3. Pending Moderator Review
                      </div>
                      {bankOverview.overall.pendingModeratorCount > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                          Action Needed
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-semibold">
                          Clean
                        </span>
                      )}
                    </div>
                    <div className="text-3xl font-extrabold text-slate-900 mt-2">
                      {bankOverview.overall.pendingModeratorCount}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Awaiting moderation approval</div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] uppercase tracking-wider font-bold text-slate-600">
                        4. Pending Examiner Action
                      </div>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">
                        Drafts
                      </span>
                    </div>
                    <div className="text-3xl font-extrabold text-slate-900 mt-2">
                      {bankOverview.overall.pendingExaminerCount}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Draft or changes requested</div>
                  </div>
                </div>
              )}

              {/* Breakdown per subject */}
              {bankOverview?.bySubject && (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="px-6 py-4 border-b border-slate-200 font-bold text-slate-900 flex items-center justify-between">
                    <span>Subject Inventory Breakdown (Numbers Only)</span>
                    <span className="text-xs font-normal text-slate-500">Live aggregate counts</span>
                  </div>
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3">Subject</th>
                        <th className="px-6 py-3 text-slate-900 font-bold">Eligible Bank</th>
                        <th className="px-6 py-3 text-slate-600">Under Review</th>
                        <th className="px-6 py-3 text-slate-600">Under Moderation</th>
                        <th className="px-6 py-3 text-slate-600">Examiner Drafts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {Object.entries(bankOverview.bySubject).map(([subId, counts]: [string, any]) => (
                        <tr key={subId} className="hover:bg-slate-50/70 transition">
                          <td className="px-6 py-4 font-semibold text-slate-900">{subId}</td>
                          <td className="px-6 py-4 font-extrabold text-slate-900">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {counts.eligibleCount}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-700">{counts.pendingReviewerCount}</td>
                          <td className="px-6 py-4 font-medium text-slate-700">{counts.pendingModeratorCount}</td>
                          <td className="px-6 py-4 font-medium text-slate-700">{counts.pendingExaminerCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Blueprints & Readiness */}
          {activeSubTab === 'blueprints' && (
            <div className="space-y-6">
              {blueprints.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs space-y-3">
                  <div className="inline-flex p-3 rounded-full bg-slate-100 text-slate-400 mb-1">
                    <Layers className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">No Exam Blueprints Available</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto font-mono">
                    No approved exam blueprints were found in the database. Once proposed and authorized by dual administrators, blueprints will appear here with automated pool readiness calculations.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <div className="flex items-center gap-3">
                      <label className="text-xs uppercase tracking-wider font-bold text-slate-700">Select Blueprint:</label>
                      <select
                        value={selectedBlueprintId}
                        onChange={(e) => setSelectedBlueprintId(e.target.value)}
                        className="rounded-xl border border-slate-300 px-3.5 py-2 text-sm bg-white font-medium text-slate-900 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
                      >
                        {blueprints.map((bp) => (
                          <option key={bp.id} value={bp.id}>
                            {bp.name} ({bp.versions?.length || 1} versions)
                          </option>
                        ))}
                      </select>
                    </div>

                    {readinessLoading && (
                      <div className="flex items-center gap-2 text-xs font-semibold text-red-600">
                        <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                        Calculating pool multiplier...
                      </div>
                    )}
                  </div>

                  {readinessLoading && !readinessData && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs space-y-3">
                      <div className="inline-flex p-3 rounded-full bg-red-50 text-red-600 mb-1">
                        <Loader2 className="w-6 h-6 animate-spin" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-900">Evaluating Blueprint Readiness...</h3>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto font-mono">
                        Evaluating question bank pool against blueprint section constraints and quotas
                      </p>
                    </div>
                  )}

                  {/* Readiness Report Card */}
                  {readinessData && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">{readinessData.blueprintName}</h3>
                          <div className="text-xs text-slate-500 font-mono mt-1">
                            Commitment Hash: {readinessData.versionHash?.slice(0, 24)}...
                          </div>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold border ${
                            readinessData.ready
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {readinessData.ready ? 'POOL READY (≥ 1.5x)' : 'POOL WARNING (< 1.5x)'}
                        </span>
                      </div>

                      {/* Sections Breakdown */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-3">Section</th>
                              <th className="px-4 py-3">Required Questions</th>
                              <th className="px-4 py-3">Eligible Pool</th>
                              <th className="px-4 py-3">Multiplier</th>
                              <th className="px-4 py-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {readinessData.sections?.map((sec: any) => (
                              <tr key={sec.code || sec.sectionCode} className="hover:bg-slate-50">
                                <td className="px-4 py-3 font-semibold text-slate-900">
                                  {sec.name || sec.sectionName} ({sec.code || sec.sectionCode})
                                </td>
                                <td className="px-4 py-3 font-medium text-slate-800">{sec.requiredCount}</td>
                                <td className="px-4 py-3 font-bold text-slate-900">{sec.availableCount}</td>
                                <td className="px-4 py-3 font-mono font-bold text-slate-900">{sec.multiplier}x</td>
                                <td className="px-4 py-3">
                                  {sec.multiplier >= 1.5 ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Pass
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                                      <AlertTriangle className="w-3.5 h-3.5" /> Multiplier Low
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 3: Generation Requests & Approvals */}
          {activeSubTab === 'requests' && (
            <div className="space-y-6">
              {/* New Generation Request Form */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
                <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-red-600" />
                  Propose New Paper Generation Request (Step 1 of 2)
                </h3>
                <form onSubmit={handleCreateRequest} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Blueprint Version</label>
                    <select
                      required
                      value={formBlueprintVersionId}
                      onChange={(e) => setFormBlueprintVersionId(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
                    >
                      <option value="">Select Blueprint Version</option>
                      {blueprints.flatMap((bp) =>
                        (bp.versions || []).map((v: any) => (
                          <option key={v.id} value={v.id}>
                            {bp.name} (v{v.versionNo}) - {v.isApproved ? 'Approved' : 'Pending'}
                          </option>
                        )),
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Custodian Group</label>
                    <select
                      required
                      value={formCustodianGroupId}
                      onChange={(e) => setFormCustodianGroupId(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
                    >
                      <option value="">Select Custodian Group</option>
                      {custodianGroups.map((cg) => (
                        <option key={cg.id} value={cg.id}>
                          {cg.name} (k={cg.k}, n={cg.n})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Sets Count (1 to 4)</label>
                    <input
                      type="number"
                      min="1"
                      max="4"
                      required
                      value={formSetsCount}
                      onChange={(e) => setFormSetsCount(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Export Profile</label>
                    <select
                      value={formProfile}
                      onChange={(e) => setFormProfile(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
                    >
                      <option value="OFFLINE_QUESTION_PAPER">Offline Pen & Paper (Question Paper)</option>
                      <option value="ONLINE_QUESTION_IMPORT">Online CBT (Question Import)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Generate Window Start</label>
                    <input
                      type="datetime-local"
                      required
                      value={formGnb}
                      onChange={(e) => setFormGnb(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Generate Window End</label>
                    <input
                      type="datetime-local"
                      required
                      value={formGna}
                      onChange={(e) => setFormGna(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Paper Release Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={formRnb}
                      onChange={(e) => setFormRnb(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Answer Key Release</label>
                    <input
                      type="datetime-local"
                      required
                      value={formAnb}
                      onChange={(e) => setFormAnb(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Retention Window (Minutes)</label>
                    <input
                      type="number"
                      min="60"
                      max="1440"
                      required
                      value={formRetention}
                      onChange={(e) => setFormRetention(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
                    />
                  </div>

                  <div className="md:col-span-2 pt-2">
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl text-sm transition shadow-xs flex items-center justify-center gap-2"
                    >
                      {actionLoading && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                      Propose Generation Request (Step 1 of 2)
                    </button>
                  </div>
                </form>
              </div>

              {/* Existing Requests List */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="px-6 py-4 border-b border-slate-200 font-bold text-slate-900 flex items-center justify-between">
                  <span>Active Generation Requests</span>
                  <span className="text-xs font-normal text-slate-500">{requests.length} total request(s)</span>
                </div>
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Request ID</th>
                      <th className="px-4 py-3">Proposer</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Sets</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {requests.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-500">
                          No active generation requests. Fill the form above to propose a new paper generation.
                        </td>
                      </tr>
                    ) : (
                      requests.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3 font-mono text-xs text-slate-900 font-medium">{r.id.slice(0, 12)}...</td>
                          <td className="px-4 py-3 text-xs text-slate-700">{r.proposer?.email || r.proposerId}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                r.status === 'APPROVED'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : r.status === 'REJECTED'
                                  ? 'bg-red-50 text-red-800 border-red-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900">{r.setsCount}</td>
                          <td className="px-4 py-3 flex items-center gap-2">
                            {r.status === 'REQUESTED' && r.proposerId !== user?.id && (
                              <button
                                onClick={() => setApproveRequestId(r.id)}
                                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl transition shadow-xs flex items-center gap-1"
                              >
                                <KeyRound className="w-3 h-3" /> Review & Approve
                              </button>
                            )}
                            {r.status === 'APPROVED' && (
                              <button
                                onClick={() => handleGenerateNow(r.id)}
                                disabled={actionLoading}
                                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition shadow-xs flex items-center gap-1.5"
                              >
                                {actionLoading ? (
                                  <Loader2 className="w-3 h-3 animate-spin text-white" />
                                ) : (
                                  <Play className="w-3 h-3" />
                                )}
                                Generate Now
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Second Admin Step-Up Approval Modal */}
              {approveRequestId && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                  <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <KeyRound className="w-5 h-5 text-red-600" />
                      Dual-Admin Generation Approval
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Dual-control policy requires a second distinct administrator to authorize paper generation.
                      Step-up MFA and Ed25519 digital signature will seal this approval.
                    </p>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Step-Up MFA TOTP Token
                      </label>
                      <input
                        type="text"
                        required
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value)}
                        placeholder="6-digit TOTP code"
                        className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-mono text-center tracking-widest text-slate-900 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Approval / Rejection Reason
                      </label>
                      <input
                        type="text"
                        value={decisionReason}
                        onChange={(e) => setDecisionReason(e.target.value)}
                        placeholder="Audit reason (mandatory on reject)"
                        className="w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => handleApproveRequest('APPROVE')}
                        disabled={actionLoading}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2.5 rounded-xl transition shadow-xs flex items-center justify-center gap-1.5"
                      >
                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Check className="w-4 h-4" />}
                        Authorize & Sign
                      </button>
                      <button
                        onClick={() => handleApproveRequest('REJECT')}
                        disabled={actionLoading}
                        className="px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold py-2.5 rounded-xl transition"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => setApproveRequestId(null)}
                        className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold py-2.5 rounded-xl transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Paper Lifecycle & Delivery */}
          {activeSubTab === 'papers' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="px-6 py-4 border-b border-slate-200 font-bold text-slate-900 flex items-center justify-between">
                  <span>Exam Papers Lifecycle & Delivery</span>
                  <span className="text-xs font-normal text-slate-500">{papers.length} paper(s)</span>
                </div>

                {papers.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <div className="inline-flex p-3 rounded-full bg-slate-100 text-slate-400 mb-1">
                      <FileText className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">No Exam Papers Generated Yet</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto font-mono">
                      Exam papers are generated through dual-admin proposed requests in Tab 3. Once authorized by the second administrator and triggered, encrypted papers, Shamir key shares, and delivery manifests will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {papers.map((p) => (
                      <div key={p.id} className="p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-base font-bold text-slate-900 font-mono">Paper {p.id.slice(0, 16)}</h4>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                  p.status === 'RELEASED'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : p.status === 'SEALED'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-slate-100 text-slate-800 border-slate-200'
                                }`}
                              >
                                {p.status}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 font-mono mt-1">
                              Paper Hash: {p.paperHash?.slice(0, 24)}...
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {p.status === 'RELEASED' && (
                              <button
                                onClick={() => handleDownloadPaper(p.id)}
                                disabled={actionLoading}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition"
                              >
                                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <Download className="w-4 h-4" />}
                                Download Released CSV
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Public Validation Summary */}
                        {p.validationSummary && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl text-xs border border-slate-200">
                            <div>
                              <span className="text-slate-500">Total Questions:</span>{' '}
                              <strong className="text-slate-900 font-bold">{p.validationSummary.totalQuestions}</strong>
                            </div>
                            <div>
                              <span className="text-slate-500">Total Marks:</span>{' '}
                              <strong className="text-slate-900 font-bold">{p.validationSummary.totalMarks}</strong>
                            </div>
                            <div>
                              <span className="text-slate-500">Mean Difficulty:</span>{' '}
                              <strong className="text-slate-900 font-bold">
                                {p.validationSummary.meanDifficulty} / 100
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-500">Duration Est.:</span>{' '}
                              <strong className="text-slate-900 font-bold">
                                {Math.round(p.validationSummary.totalTimeSeconds / 60)} mins
                              </strong>
                            </div>
                          </div>
                        )}

                        {/* Share Progress */}
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <KeyRound className="w-4 h-4 text-amber-600" />
                          <span>Threshold Share Status:</span>
                          <span className="font-semibold text-slate-900">
                            {p.status === 'RELEASED' || p.status === 'ANSWER_KEY_RELEASED'
                              ? 'Threshold achieved (Key reconstructed & zeroized)'
                              : 'Awaiting custodian shares at exam time gate'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
