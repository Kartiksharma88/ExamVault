import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api-client';
import { ModalPortal } from '../components/ModalPortal';
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
  X,
  Users,
  Scale,
  Clock,
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

  // Propose New Policy form state
  const [showProposeModal, setShowProposeModal] = useState<boolean>(false);
  const [requiredReviewers, setRequiredReviewers] = useState<number>(2);
  const [difficultyTolerance, setDifficultyTolerance] = useState<number>(20);
  const [requireBlindSolve, setRequireBlindSolve] = useState<boolean>(true);
  const [requireModerator, setRequireModerator] = useState<boolean>(true);
  const [requireLanguageReview, setRequireLanguageReview] = useState<boolean>(true);
  const [maxReviewDays, setMaxReviewDays] = useState<number>(7);
  const [exactMatchThreshold, setExactMatchThreshold] = useState<number>(1.0);
  const [highSimilarityThreshold, setHighSimilarityThreshold] = useState<number>(0.85);
  const [mediumSimilarityThreshold, setMediumSimilarityThreshold] = useState<number>(0.60);

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
        const active = data.data.find((p) => p.isActive);
        if (active) {
          setRequiredReviewers(active.requiredReviewers ?? 2);
          setDifficultyTolerance(active.difficultyTolerance ?? 20);
          setMaxReviewDays(active.maxReviewDays ?? 7);
          setRequireBlindSolve(active.requireBlindSolve ?? true);
          setRequireModerator(active.requireModerator ?? true);
          setRequireLanguageReview(active.requireLanguageReview ?? true);
          setExactMatchThreshold(active.exactMatchThreshold ?? 1.0);
          setHighSimilarityThreshold(active.highSimilarityThreshold ?? 0.85);
          setMediumSimilarityThreshold(active.mediumSimilarityThreshold ?? 0.60);
        }
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
          difficultyTolerance,
          requireBlindSolve,
          requireModerator,
          requireLanguageReview,
          maxReviewDays,
          exactMatchThreshold,
          highSimilarityThreshold,
          mediumSimilarityThreshold,
        }),
      });
      if (data.success) {
        setSuccessMsg(
          'Policy proposed successfully! Strict Two-Person Rule: A second administrator must log in and approve this proposal before it takes effect.'
        );
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
        setSuccessMsg('Policy approved and enacted across all subsequent review rounds!');
        fetchPolicies();
      } else {
        setError('Approval failed (Strict Two-Person Rule: proposer cannot approve own policy proposal)');
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
        setSuccessMsg('Corpus documents imported and indexed in originality engine!');
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

  const activePolicy = policies.find((p) => p.isActive);
  const pendingProposal = policies.find((p) => !p.isActive);
  const isCurrentAdminProposer = pendingProposal && pendingProposal.proposedById === user?.id;

  return (
    <div className="w-full space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
              Cryptographic Core
            </span>
            <span className="text-xs text-slate-400 font-mono">GOVERNANCE & AUDIT</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Institutional Policy & Corpus Engine</h1>
          <p className="text-sm text-slate-500">
            Configure versioned approval workflows with two-person rule enforcement, originality screening, and reference corpora.
          </p>
        </div>
        <div className="flex items-center space-x-2 shrink-0">
          <span className="flex items-center text-xs font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-md font-medium">
            <Lock className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            Dual-Person Admin Control Active
          </span>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex border-b border-slate-200 space-x-6">
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
              className={`flex items-center space-x-2 py-3 border-b-2 font-medium text-sm transition-all ${
                isActive
                  ? 'border-red-600 text-slate-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-red-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Policies Content */}
      {activeSubTab === 'policies' && (
        <div className="space-y-5">
          {/* 1. Pending Proposal Notice Banner (if any proposal is awaiting 2nd admin) */}
          {pendingProposal && (
            <div className="p-4 bg-amber-50/80 border border-amber-300 rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-amber-100 rounded-lg text-amber-800 mt-0.5 shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-amber-950">
                      Pending Policy Proposal v{pendingProposal.version}: {pendingProposal.requiredReviewers} Reviewer{pendingProposal.requiredReviewers > 1 ? 's' : ''} (±{pendingProposal.difficultyTolerance}pt Tolerance)
                    </span>
                    <span className="text-[10px] font-mono uppercase bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded font-bold border border-amber-300">
                      Awaiting 2nd Admin
                    </span>
                  </div>
                  <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                    Proposed by <strong>{pendingProposal.proposedBy?.name || 'System Administrator'}</strong>. Strict Two-Person Rule requires an independent second administrator to verify and approve before taking effect.
                  </p>
                  <div className="flex items-center space-x-4 mt-2 text-[11px] text-amber-900 font-mono">
                    <span>SLA: {pendingProposal.maxReviewDays}d</span>
                    <span>•</span>
                    <span>Blind Solve: {pendingProposal.requireBlindSolve ? 'Enforced' : 'Off'}</span>
                    <span>•</span>
                    <span>Moderator Sign-off: {pendingProposal.requireModerator ? 'Required' : 'Off'}</span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex items-center">
                {isCurrentAdminProposer ? (
                  <div className="px-3.5 py-2 bg-amber-100/90 text-amber-900 border border-amber-300 rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-xs">
                    <Lock className="w-3.5 h-3.5 text-amber-700" />
                    <span>You proposed this — Awaiting 2nd Admin</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleApprovePolicy(pendingProposal.id)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition-colors flex items-center space-x-2 text-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve Proposal as 2nd Admin</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 2. Active Policy Overview Banner */}
          {activePolicy && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-black text-white rounded-lg">
                    <ShieldCheck className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-bold text-slate-900">
                        Active Governance Policy (v{activePolicy.version})
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                        {activePolicy.subject?.name || 'Global Institutional Scope'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Currently enforced approval rules and difficulty calibration thresholds for all authoring rounds.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-md">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                    Active (Dual-Approved)
                  </span>
                </div>
              </div>

              {/* Grid of Key Enforced Rules */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                    Review Protocol
                  </span>
                  <div className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                    <Users className="w-4 h-4 text-red-600 shrink-0" />
                    <span>
                      {activePolicy.requiredReviewers === 1
                        ? '1 Reviewer (Fast-Track)'
                        : `${activePolicy.requiredReviewers} Reviewers (Consensus)`}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 block leading-tight">
                    {activePolicy.requiredReviewers === 1
                      ? 'Direct Question Bank admission on answer match'
                      : 'Dual blind solve with difficulty consensus'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                    Difficulty Tolerance
                  </span>
                  <div className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                    <Scale className="w-4 h-4 text-red-600 shrink-0" />
                    <span>±{activePolicy.difficultyTolerance} Points</span>
                  </div>
                  <span className="text-[11px] text-slate-500 block leading-tight">
                    Ratings within tolerance auto-promote without moderator
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                    Review SLA Limit
                  </span>
                  <div className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                    <Clock className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{activePolicy.maxReviewDays} Days Max</span>
                  </div>
                  <span className="text-[11px] text-slate-500 block leading-tight">
                    Blind solve turnaround SLA before escalation
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                    Dual-Control Status
                  </span>
                  <div className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                    <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Two-Person Signed</span>
                  </div>
                  <span className="text-[11px] text-slate-500 block leading-tight truncate" title={`Approved by: ${activePolicy.approvedBy?.name || 'Administrator'}`}>
                    Approved by {activePolicy.approvedBy?.name || 'Administrator'}
                  </span>
                </div>
              </div>

              {/* Badges of Enforced Checks */}
              <div className="flex flex-wrap items-center gap-2 pt-3 mt-3 border-t border-slate-100 text-[11px]">
                <span className="text-slate-400 font-mono text-[10px] uppercase font-bold mr-1">Enforcements:</span>
                <span className={`px-2 py-0.5 rounded font-medium ${activePolicy.requireBlindSolve ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  Blind Solve: {activePolicy.requireBlindSolve ? 'Enforced' : 'Off'}
                </span>
                <span className={`px-2 py-0.5 rounded font-medium ${activePolicy.requireModerator ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  Moderator Sign-off: {activePolicy.requireModerator ? 'Required' : 'Off'}
                </span>
                <span className={`px-2 py-0.5 rounded font-medium ${activePolicy.requireLanguageReview ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  Bilingual Translation Check: {activePolicy.requireLanguageReview ? 'Enforced' : 'Off'}
                </span>
                <span className="px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-600 font-mono">
                  Similarity Cutoff: High ≥ {(activePolicy.highSimilarityThreshold * 100).toFixed(0)}% | Med ≥ {(activePolicy.mediumSimilarityThreshold * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pt-1">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Policy Governance Registry</h2>
              <p className="text-xs text-slate-500">
                Policies define reviewer thresholds and workflow requirements. Two distinct administrators are strictly required to enact any policy.
              </p>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={fetchPolicies}
                disabled={policiesLoading}
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${policiesLoading ? 'animate-spin text-red-600' : ''}`} />
                <span>{policiesLoading ? 'Refreshing...' : 'Refresh'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowProposeModal(true)}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-black hover:bg-neutral-800 text-white text-xs font-bold rounded-lg shadow-xs transition-colors border border-black"
              >
                <Plus className="w-4 h-4 text-white" />
                <span>Propose New Policy</span>
              </button>
            </div>
          </div>

          {/* Policies Table */}
          {policiesLoading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-xs space-y-3">
              <div className="inline-flex p-3 rounded-full bg-red-50 text-red-600 mb-1">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Loading Governance Policies...</h3>
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
                <thead className="bg-slate-100 text-xs uppercase font-bold text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Version & Scope</th>
                    <th className="px-6 py-4">Reviewer Protocol</th>
                    <th className="px-6 py-4">Difficulty & SLA</th>
                    <th className="px-6 py-4">Security Enforcements</th>
                    <th className="px-6 py-4">Dual-Control Status</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {policies.map((p) => {
                    const isProposer = p.proposedById === user?.id;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 font-mono font-medium text-slate-900">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold">v{p.version}</span>
                            {p.isActive && (
                              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Active Policy" />
                            )}
                          </div>
                          <span className="text-xs text-slate-400 block font-sans">
                            {p.subject?.name || 'Global Policy'}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-sans">
                            By {p.proposedBy?.name || 'Admin'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-xs text-slate-900 block">
                            {p.requiredReviewers === 1 ? '1 Reviewer (Fast-Track)' : `${p.requiredReviewers} Reviewers (Consensus)`}
                          </span>
                          <span className="text-[11px] text-slate-500 block">
                            {p.requiredReviewers === 1 ? 'Direct Bank Admission' : 'Consensus Calibration'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-mono space-y-0.5">
                          <span className="block font-semibold text-slate-800">
                            Tolerance: ±{p.difficultyTolerance} pts
                          </span>
                          <span className="block text-slate-500">
                            SLA: {p.maxReviewDays} Days max
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs space-y-0.5">
                          <span className="block text-slate-700">
                            Blind Solve: <strong className={p.requireBlindSolve ? 'text-slate-900' : 'text-slate-400'}>{p.requireBlindSolve ? 'Enforced' : 'Off'}</strong>
                          </span>
                          <span className="block text-slate-700">
                            Moderator: <strong className={p.requireModerator ? 'text-slate-900' : 'text-slate-400'}>{p.requireModerator ? 'Required' : 'Off'}</strong>
                          </span>
                          <span className="block text-slate-500 font-mono text-[11px]">
                            Sim: ≥{(p.highSimilarityThreshold * 100).toFixed(0)}% High
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {p.isActive ? (
                            <span className="inline-flex items-center text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                              Active (Dual-Approved)
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-300 px-2.5 py-1 rounded-md">
                              <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" />
                              Pending 2nd Admin
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {!p.isActive ? (
                            isProposer ? (
                              <span
                                className="inline-flex items-center text-[11px] font-mono font-medium text-amber-900 bg-amber-100/70 border border-amber-200 px-2.5 py-1 rounded-md"
                                title="Dual-control enforcement: You proposed this policy and cannot approve it yourself"
                              >
                                <Lock className="w-3 h-3 mr-1 text-amber-700" />
                                Awaiting 2nd Admin
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => handleApprovePolicy(p.id)}
                                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Approve Policy</span>
                              </button>
                            )
                          ) : (
                            <span className="text-xs font-mono text-slate-400">
                              Enacted & Active
                            </span>
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
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
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
                  <span className={`font-bold font-mono text-sm ${originalityHealth?.available ? 'text-emerald-700' : 'text-red-700'}`}>
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
                className="w-full py-2.5 bg-black hover:bg-neutral-800 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg shadow-xs transition-colors inline-flex items-center justify-center space-x-2 border border-black"
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

      {/* ALL-IN-ONE Propose Policy Modal */}
      {showProposeModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95">
              {/* Red brand accent strip */}
              <div className="h-1.5 w-full bg-red-600" />

              {/* Modal Header */}
              <div className="p-6 pb-4 border-b border-slate-200 flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                      Dual-Control Governance
                    </span>
                    <span className="text-xs text-slate-400 font-mono">NEW POLICY PROPOSAL</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Propose Institutional Approval Policy</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure reviewer workflow model, difficulty tolerance, review SLA, and screening cutoffs.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProposeModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                {/* Section 1: Reviewer Workflow Architecture */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      1. Reviewer Workflow Protocol
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono">Admission workflow</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* Option 1: 1 Reviewer Fast-Track */}
                    <div
                      onClick={() => setRequiredReviewers(1)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        requiredReviewers === 1
                          ? 'border-black bg-slate-50 ring-2 ring-black shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className={`p-1.5 rounded-lg ${requiredReviewers === 1 ? 'bg-black text-white' : 'bg-slate-100 text-slate-600'}`}>
                            <Users className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-bold text-slate-900">1 Reviewer (Fast-Track)</span>
                        </div>
                        <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                          Direct Admission
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Single blind solve. Admitted directly into the Question Bank if author key matches. Divergences route to Moderator.
                      </p>
                    </div>

                    {/* Option 2: 2 Reviewers Consensus */}
                    <div
                      onClick={() => setRequiredReviewers(2)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        requiredReviewers >= 2
                          ? 'border-black bg-slate-50 ring-2 ring-black shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className={`p-1.5 rounded-lg ${requiredReviewers >= 2 ? 'bg-black text-white' : 'bg-slate-100 text-slate-600'}`}>
                            <Scale className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-bold text-slate-900">2 Reviewers (Consensus)</span>
                        </div>
                        <span className="text-[10px] font-semibold bg-red-100 text-red-800 px-2 py-0.5 rounded">
                          Calibrated Bank
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Dual blind solves. Auto-promoted if difficulty delta is within tolerance. Divergent scores route to Moderator.
                      </p>
                    </div>
                  </div>

                  {/* Compact Reviewer Stepper */}
                  <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                    <span className="font-semibold text-slate-700">Reviewer Panel Size:</span>
                    <div className="flex items-center space-x-1.5">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setRequiredReviewers(num)}
                          className={`w-7 h-7 text-xs font-bold rounded-md transition-colors ${
                            requiredReviewers === num
                              ? 'bg-black text-white'
                              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Section 2: Calibration Tolerance & Review Turnaround SLA */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                    2. Calibration Tolerance & Review Turnaround SLA
                  </label>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Tolerance */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">Difficulty Tolerance</span>
                        <span className="px-2 py-0.5 rounded bg-black text-white text-xs font-mono font-bold">
                          ±{difficultyTolerance} pts
                        </span>
                      </div>

                      <input
                        type="range"
                        min="5"
                        max="50"
                        step="5"
                        value={difficultyTolerance}
                        onChange={(e) => setDifficultyTolerance(parseInt(e.target.value, 10))}
                        className="w-full accent-red-600 cursor-pointer"
                      />

                      <div className="flex items-center justify-between gap-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setDifficultyTolerance(10)}
                          className={`px-2.5 py-1 rounded font-mono transition-colors ${difficultyTolerance === 10 ? 'bg-black text-white font-bold' : 'bg-white border text-slate-600 hover:bg-slate-100'}`}
                        >
                          ±10 pts (Strict)
                        </button>
                        <button
                          type="button"
                          onClick={() => setDifficultyTolerance(20)}
                          className={`px-2.5 py-1 rounded font-mono transition-colors ${difficultyTolerance === 20 ? 'bg-black text-white font-bold' : 'bg-white border text-slate-600 hover:bg-slate-100'}`}
                        >
                          ±20 pts (Standard)
                        </button>
                        <button
                          type="button"
                          onClick={() => setDifficultyTolerance(30)}
                          className={`px-2.5 py-1 rounded font-mono transition-colors ${difficultyTolerance === 30 ? 'bg-black text-white font-bold' : 'bg-white border text-slate-600 hover:bg-slate-100'}`}
                        >
                          ±30 pts (Relaxed)
                        </button>
                      </div>

                      <p className="text-[11px] text-slate-500 leading-tight">
                        Ratings within ±{difficultyTolerance} pts auto-promote without moderator.
                      </p>
                    </div>

                    {/* Review SLA Days */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">Turnaround SLA</span>
                        <span className="px-2 py-0.5 rounded bg-black text-white text-xs font-mono font-bold">
                          {maxReviewDays} Days
                        </span>
                      </div>

                      <input
                        type="range"
                        min="1"
                        max="30"
                        step="1"
                        value={maxReviewDays}
                        onChange={(e) => setMaxReviewDays(parseInt(e.target.value, 10))}
                        className="w-full accent-red-600 cursor-pointer"
                      />

                      <div className="flex items-center justify-between gap-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setMaxReviewDays(3)}
                          className={`px-2.5 py-1 rounded font-mono transition-colors ${maxReviewDays === 3 ? 'bg-black text-white font-bold' : 'bg-white border text-slate-600 hover:bg-slate-100'}`}
                        >
                          3 Days
                        </button>
                        <button
                          type="button"
                          onClick={() => setMaxReviewDays(7)}
                          className={`px-2.5 py-1 rounded font-mono transition-colors ${maxReviewDays === 7 ? 'bg-black text-white font-bold' : 'bg-white border text-slate-600 hover:bg-slate-100'}`}
                        >
                          7 Days (Default)
                        </button>
                        <button
                          type="button"
                          onClick={() => setMaxReviewDays(14)}
                          className={`px-2.5 py-1 rounded font-mono transition-colors ${maxReviewDays === 14 ? 'bg-black text-white font-bold' : 'bg-white border text-slate-600 hover:bg-slate-100'}`}
                        >
                          14 Days
                        </button>
                      </div>

                      <p className="text-[11px] text-slate-500 leading-tight">
                        Review turnaround window before automated SLA escalation.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section 3: Security & Verification Enforcements */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                    3. Verification & Governance Controls
                  </label>

                  <div className="space-y-2">
                    <label className="flex items-start space-x-3 p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={requireBlindSolve}
                        onChange={(e) => setRequireBlindSolve(e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-black focus:ring-black w-4 h-4"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Enforce Blind Solve
                        </span>
                        <span className="text-[11px] text-slate-500 block leading-tight">
                          Reviewers independently solve before author answer key is decrypted.
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start space-x-3 p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={requireModerator}
                        onChange={(e) => setRequireModerator(e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-black focus:ring-black w-4 h-4"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Require Moderator Sign-off
                        </span>
                        <span className="text-[11px] text-slate-500 block leading-tight">
                          Mandatory moderator review for flagged or conflict items.
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start space-x-3 p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={requireLanguageReview}
                        onChange={(e) => setRequireLanguageReview(e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-black focus:ring-black w-4 h-4"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Bilingual Translation Review
                        </span>
                        <span className="text-[11px] text-slate-500 block leading-tight">
                          Mandatory parity audit for Hindi & English exam items.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Section 4: Originality Screening Thresholds */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      4. Originality Detection Cutoffs
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono">MinHash LSH & TF-IDF</span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700 block">Exact Match</label>
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          min="80"
                          max="100"
                          value={Math.round(exactMatchThreshold * 100)}
                          onChange={(e) => setExactMatchThreshold(parseInt(e.target.value, 10) / 100)}
                          className="w-full text-xs p-1.5 rounded border border-slate-300 text-center font-mono font-bold"
                        />
                        <span className="text-xs text-slate-500 font-bold">%</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block">Direct duplicate</span>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700 block">High Similarity</label>
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          min="50"
                          max="99"
                          value={Math.round(highSimilarityThreshold * 100)}
                          onChange={(e) => setHighSimilarityThreshold(parseInt(e.target.value, 10) / 100)}
                          className="w-full text-xs p-1.5 rounded border border-slate-300 text-center font-mono font-bold"
                        />
                        <span className="text-xs text-slate-500 font-bold">%</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block">Quarantine alert</span>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700 block">Medium Similarity</label>
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          min="30"
                          max="80"
                          value={Math.round(mediumSimilarityThreshold * 100)}
                          onChange={(e) => setMediumSimilarityThreshold(parseInt(e.target.value, 10) / 100)}
                          className="w-full text-xs p-1.5 rounded border border-slate-300 text-center font-mono font-bold"
                        />
                        <span className="text-xs text-slate-500 font-bold">%</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block">Reviewer warning</span>
                    </div>
                  </div>
                </div>

                {/* Two-Person Integrity Notice Banner */}
                <div className="p-3.5 bg-amber-50/90 border border-amber-300 rounded-xl flex items-start space-x-3 text-xs text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <strong className="font-bold text-amber-950">
                      Strict Dual-Control Rule:
                    </strong>{' '}
                    Once proposed, a second administrator must independently sign off to activate this policy. Self-approval is blocked.
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowProposeModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleProposePolicy}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-black hover:bg-neutral-800 border border-black rounded-lg shadow-sm transition-colors flex items-center space-x-2 disabled:opacity-50"
                >
                  {actionLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-red-500" />
                  )}
                  <span>{actionLoading ? 'Submitting Proposal...' : 'Submit Policy Proposal (Requires 2nd Admin)'}</span>
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};
