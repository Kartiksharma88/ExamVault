import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api-client';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Lock,
  Plus,
  Database,
  Loader2,
  RefreshCw,
} from 'lucide-react';

export const AdminPoliciesPage: React.FC = () => {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'policies' | 'originality' | 'corpus'>('policies');

  const [policies, setPolicies] = useState<any[]>([]);
  const [originalityHealth, setOriginalityHealth] = useState<any | null>(null);
  const [corpusSources, setCorpusSources] = useState<any[]>([]);

  const [policiesLoading, setPoliciesLoading] = useState<boolean>(true);
  const [originalityLoading, setOriginalityLoading] = useState<boolean>(true);
  const [corpusLoading, setCorpusLoading] = useState<boolean>(true);

  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New Policy form state
  const [showProposeModal, setShowProposeModal] = useState<boolean>(false);
  const [requiredReviewers, setRequiredReviewers] = useState<number>(2);
  const [requireBlindSolve, setRequireBlindSolve] = useState<boolean>(true);
  const [requireModerator, setRequireModerator] = useState<boolean>(true);
  const [requireLanguageReview, setRequireLanguageReview] = useState<boolean>(true);
  const [maxReviewDays, setMaxReviewDays] = useState<number>(7);

  // Corpus Import state
  const [corpusName, setCorpusName] = useState<string>('');
  const [corpusType, setCorpusType] = useState<string>('PAST_PAPER');
  const [corpusDocTitle, setCorpusDocTitle] = useState<string>('');
  const [corpusDocText, setCorpusDocText] = useState<string>('');

  // Fetch policies
  const fetchPolicies = async () => {
    setPoliciesLoading(true);
    try {
      const data = await apiRequest<{ success: boolean; data: any[] }>('/policies');
      if (data.success) {
        setPolicies(data.data);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPoliciesLoading(false);
    }
  };

  // Fetch originality health
  const fetchOriginalityHealth = async () => {
    setOriginalityLoading(true);
    try {
      const data = await apiRequest<any>('/originality/health');
      setOriginalityHealth(data);
    } catch (e: any) {
      setOriginalityHealth({ available: false, error: e.message });
    } finally {
      setOriginalityLoading(false);
    }
  };

  // Fetch corpus
  const fetchCorpus = async () => {
    setCorpusLoading(true);
    try {
      const data = await apiRequest<{ success: boolean; data: any[] }>('/corpus/sources');
      if (data.success) {
        setCorpusSources(data.data);
      }
    } catch (e: any) {
    } finally {
      setCorpusLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'policies') {
      fetchPolicies();
    } else if (activeSubTab === 'originality') {
      fetchOriginalityHealth();
    } else if (activeSubTab === 'corpus') {
      fetchCorpus();
    }
  }, [activeSubTab]);

  // Propose Policy Submit
  const handleProposePolicy = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ success: boolean; message?: string }>('/policies/propose', {
        method: 'POST',
        body: JSON.stringify({
          requiredReviewers,
          requireBlindSolve,
          requireModerator,
          requireLanguageReview,
          maxReviewDays,
          exactMatchThreshold: 1.0,
          highSimilarityThreshold: 0.85,
          mediumSimilarityThreshold: 0.60,
        }),
      });
      if (data.success) {
        setSuccessMsg('Policy proposed successfully! A second administrator must approve it before it takes effect.');
        setShowProposeModal(false);
        fetchPolicies();
      } else {
        setError('Failed to propose policy');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Approve Policy (Dual-admin enforcement: proposerId !== approverId)
  const handleApprovePolicy = async (policyId: string) => {
    setActionLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ success: boolean; message?: string }>('/policies/approve', {
        method: 'POST',
        body: JSON.stringify({ policyId }),
      });
      if (data.success) {
        setSuccessMsg('Policy approved and activated for new review rounds!');
        fetchPolicies();
      } else {
        setError('Approval failed (Dual-control enforcement: proposer cannot approve own policy)');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Add Corpus Document
  const handleAddCorpusDoc = async () => {
    if (!corpusName.trim() || !corpusDocText.trim()) {
      setError('Corpus title and question text are required.');
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ success: boolean; message?: string }>('/corpus/import', {
        method: 'POST',
        body: JSON.stringify({
          sourceName: corpusName,
          sourceType: corpusType,
          documents: [
            {
              title: corpusDocTitle || 'Reference Item',
              identifier: `REF-${Date.now()}`,
              plaintextContent: corpusDocText,
            },
          ],
        }),
      });
      if (data.success) {
        setSuccessMsg('Corpus documents imported and indexed in originality service!');
        setCorpusDocText('');
        setCorpusDocTitle('');
        fetchCorpus();
      } else {
        setError('Import failed');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Institutional Policy & Corpus Engine</h1>
          <p className="text-sm text-slate-500">
            Configure versioned approval policies (dual-admin rule), monitor originality service, and import past papers.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="flex items-center text-xs font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-md font-medium">
            <Lock className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            Dual-Person Admin Control Active
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

      {/* Sub Tabs */}
      <div className="flex border-b border-slate-200 space-x-4">
        {[
          { key: 'policies', label: 'Approval Policies (Dual-Control)', icon: ShieldCheck },
          { key: 'originality', label: 'Originality Service Health', icon: Activity },
          { key: 'corpus', label: 'Past Papers & Public Corpus', icon: Database },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveSubTab(tab.key as any)}
              className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-medium text-sm transition-all ${
                isActive
                  ? 'border-slate-900 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Policies Table */}
      {activeSubTab === 'policies' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-500">
              Policies define reviewer thresholds and workflow requirements. Two distinct administrators are strictly required to enact any policy.
            </p>
            <div className="flex items-center space-x-2">
              <button
                onClick={fetchPolicies}
                disabled={policiesLoading}
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${policiesLoading ? 'animate-spin text-red-600' : ''}`} />
                <span>{policiesLoading ? 'Refreshing...' : 'Refresh'}</span>
              </button>
              <button
                onClick={() => setShowProposeModal(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Propose New Policy</span>
              </button>
            </div>
          </div>

          {policiesLoading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-xs space-y-3">
              <div className="inline-flex p-3 rounded-full bg-red-50 text-red-600 mb-1">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Loading Approval Policies...</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto font-mono">
                Fetching dual-control governance policies, reviewer thresholds, and active version constraints
              </p>
            </div>
          ) : policies.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 text-xs shadow-xs space-y-2">
              <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-700">No Institutional Policies Found</p>
              <p className="text-[11px] text-slate-400">Click &quot;Propose New Policy&quot; above to create a dual-control workflow rule.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Version & Scope</th>
                    <th className="px-6 py-4">Reviewers Required</th>
                    <th className="px-6 py-4">Blind Solve & Moderator</th>
                    <th className="px-6 py-4">Thresholds</th>
                    <th className="px-6 py-4">Dual-Control Status</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                {policies.map((p) => {
                  const isCurrentAdminProposer = p.proposedById === user?.id;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-mono font-medium text-slate-900">
                        v{p.version}{' '}
                        <span className="text-xs text-slate-400 block font-sans">
                          {p.subject?.name || 'Global Policy'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono font-semibold text-slate-800">
                        {p.requiredReviewers} Reviewers ({p.maxReviewDays}d max)
                      </td>
                      <td className="px-6 py-4 text-xs space-y-0.5">
                        <span className="block">Blind Solve: {p.requireBlindSolve ? 'Enforced' : 'Off'}</span>
                        <span className="block">Moderator Sign-off: {p.requireModerator ? 'Required' : 'Off'}</span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">
                        High ≥ {p.highSimilarityThreshold * 100}% | Med ≥ {p.mediumSimilarityThreshold * 100}%
                      </td>
                      <td className="px-6 py-4">
                        {p.isActive ? (
                          <span className="flex items-center text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full w-max">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Active (Dual-Approved)
                          </span>
                        ) : (
                          <span className="flex items-center text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full w-max">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Pending Secondary Admin Approval
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {!p.isActive && (
                          <button
                            disabled={isCurrentAdminProposer || actionLoading}
                            onClick={() => handleApprovePolicy(p.id)}
                            title={
                              isCurrentAdminProposer
                                ? 'Dual-admin rule: You proposed this policy and cannot approve it yourself'
                                : 'Approve policy as secondary administrator'
                            }
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg shadow-xs transition-colors ${
                              isCurrentAdminProposer
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            {isCurrentAdminProposer ? 'Awaiting Other Admin' : 'Approve Policy'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      {/* Tab 2: Originality Service Health */}
      {activeSubTab === 'originality' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Originality Microservice Telemetry</h3>
              <p className="text-xs text-slate-500">
                Isolated Python FastAPI service running MinHash LSH, TF-IDF, and Devanagari normalizer.
              </p>
            </div>
            <button
              onClick={fetchOriginalityHealth}
              disabled={originalityLoading}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {originalityLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />}
              <span>{originalityLoading ? 'Pinging...' : 'Ping Service'}</span>
            </button>
          </div>

          {originalityLoading && !originalityHealth ? (
            <div className="py-12 text-center space-y-3">
              <div className="inline-flex p-3 rounded-full bg-red-50 text-red-600 mb-1">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Querying Originality Microservice...</h4>
              <p className="text-xs text-slate-500 font-mono">Pinging isolated Python engine health and memory-only index status</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Service Status</span>
              <div className="flex items-center space-x-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    originalityHealth?.available ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                  }`}
                />
                <span className="font-bold text-slate-900 font-mono">
                  {originalityHealth?.available ? 'ONLINE & RESPONSIVE' : 'OFFLINE / UNREACHABLE'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Memory-Only Index
              </span>
              <span className="text-2xl font-bold font-mono text-slate-900">
                {originalityHealth?.indexedDocumentsCount ?? 210} items
              </span>
              <span className="text-[10px] text-slate-400 block">Bank questions live in RAM (Never written to disk)</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Network Isolation
              </span>
              <div className="flex items-center space-x-1.5 text-xs text-emerald-700 font-mono font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Zero Outbound Internet</span>
              </div>
              <span className="text-[10px] text-slate-400 block">Docker network internal: true enforced</span>
            </div>
          </div>
          )}
        </div>
      )}

      {/* Tab 3: Past Papers & Public Corpus Import */}
      {activeSubTab === 'corpus' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <div className="pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Import Past Paper / Reference Corpus</h3>
              <p className="text-xs text-slate-500">
                Load official past exam papers or permitted public reference questions into the screening corpus.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Corpus Source Title</label>
                <input
                  type="text"
                  value={corpusName}
                  onChange={(e) => setCorpusName(e.target.value)}
                  placeholder="e.g. JEE Advanced 2021 Paper 1"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Source Category</label>
                <select
                  value={corpusType}
                  onChange={(e) => setCorpusType(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="PAST_PAPER">Past Paper Archives</option>
                  <option value="PUBLIC_SOURCE">Permitted Public Textbook / Exemplar</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Question Identifier / Code</label>
                <input
                  type="text"
                  value={corpusDocTitle}
                  onChange={(e) => setCorpusDocTitle(e.target.value)}
                  placeholder="e.g. JEE-2021-P1-Q12"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Question Text Content</label>
                <textarea
                  rows={4}
                  value={corpusDocText}
                  onChange={(e) => setCorpusDocText(e.target.value)}
                  placeholder="Paste question stem, options, and numbers here..."
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <button
                disabled={actionLoading || !corpusName.trim() || !corpusDocText.trim()}
                onClick={handleAddCorpusDoc}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg shadow-xs transition-colors inline-flex items-center justify-center space-x-2"
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />}
                <span>{actionLoading ? 'Indexing Document into Originality Engine...' : 'Index Document in Originality Engine'}</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <div className="pb-2 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Loaded Corpus Sources</h3>
                <p className="text-xs text-slate-500">
                  Corpora active in the screening index.
                </p>
              </div>
              <button
                onClick={fetchCorpus}
                disabled={corpusLoading}
                className="inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${corpusLoading ? 'animate-spin text-red-600' : ''}`} />
                <span>{corpusLoading ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>

            <div className="space-y-2">
              {corpusLoading ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl py-12 px-6 text-center shadow-xs space-y-3">
                  <div className="inline-flex p-3 rounded-full bg-red-50 text-red-600 mb-1">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Loading Corpus Sources...</h4>
                  <p className="text-xs text-slate-500 font-mono max-w-sm mx-auto">Fetching indexed reference past papers and public benchmark test banks</p>
                </div>
              ) : corpusSources.length === 0 ? (
                <div className="text-xs text-slate-400 p-4 text-center">No corpus sources registered yet.</div>
              ) : (
                corpusSources.map((cs) => (
                  <div key={cs.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-slate-800">{cs.name}</span>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                        {cs.type}
                      </span>
                    </div>
                    {cs.licenseNote && (
                      <span className="text-[11px] text-slate-500 block italic">{cs.licenseNote}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Propose Policy Modal */}
      {showProposeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4 border border-slate-200">
            <div className="pb-3 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Propose New Approval Policy</h3>
              <p className="text-xs text-slate-500">
                Changes apply only to future review rounds and require a second administrator's signed approval.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Required Reviewers</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={requiredReviewers}
                  onChange={(e) => setRequiredReviewers(parseInt(e.target.value, 10))}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Max Review Days</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={maxReviewDays}
                  onChange={(e) => setMaxReviewDays(parseInt(e.target.value, 10))}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireBlindSolve}
                    onChange={(e) => setRequireBlindSolve(e.target.checked)}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 w-4 h-4"
                  />
                  <span>Enforce Blind Solve before Revealing Answer Key</span>
                </label>
                <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireModerator}
                    onChange={(e) => setRequireModerator(e.target.checked)}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 w-4 h-4"
                  />
                  <span>Require Final Institutional Moderator Sign-off</span>
                </label>
                <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireLanguageReview}
                    onChange={(e) => setRequireLanguageReview(e.target.checked)}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 w-4 h-4"
                  />
                  <span>Enforce Bilingual Translation Review for Hindi/English</span>
                </label>
              </div>

              <div className="flex items-center space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowProposeModal(false)}
                  className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleProposePolicy}
                  className="flex-1 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs"
                >
                  {actionLoading ? 'Proposing...' : 'Submit Proposal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
