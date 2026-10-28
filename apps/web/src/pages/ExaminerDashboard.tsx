import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api-client';
import { formatDate } from '../lib/utils';
import {
  PlusCircle,
  Search,
  Filter,
  FileText,
  Clock,
  History,
  CheckCircle,
  RotateCcw,
  Sparkles,
  ChevronRight,
  Send,
  MessageSquare,
  Loader2,
  RefreshCw,
  Lock,
} from 'lucide-react';

interface QuestionItem {
  id: string;
  humanId: string;
  authorId: string;
  status: 'DRAFT' | 'SUBMITTED' | 'WITHDRAWN';
  isLocked?: boolean;
  lockReason?: string;
  currentVersion: number;
  type?: string;
  difficulty?: number;
  cognitiveLevel?: string;
  marks?: number;
  negativeMarks?: number;
  estimatedTime?: number;
  language?: string;
  metadata?: {
    subjectId: string;
    topicId?: string;
    type: string;
    difficulty: number;
    cognitiveLevel: string;
    marks: number;
    negativeMarks: number;
    estimatedTimeSeconds: number;
    language: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface ExaminerDashboardProps {
  onEditQuestion: (questionId: string) => void;
  onCreateNew: () => void;
  onViewHistory: (questionId: string) => void;
  onViewFeedback?: (questionId: string) => void;
}

export const ExaminerDashboard: React.FC<ExaminerDashboardProps> = ({
  onEditQuestion,
  onCreateNew,
  onViewHistory,
  onViewFeedback,
}) => {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '100' };
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      const res = await apiRequest<{ success: boolean; data: { items: QuestionItem[] } }>(
        '/questions',
        { params },
      );
      setQuestions(res.data?.items || []);
    } catch (err) {
      console.error('Failed to load questions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [statusFilter]);

  const handleSubmitQuestion = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to submit this question? Once submitted, it becomes immutable and ready for review.')) {
      return;
    }
    setActionLoading(id);
    try {
      await apiRequest(`/questions/${id}/submit`, { method: 'PATCH' });
      await fetchQuestions();
    } catch (err: any) {
      alert(err.message || 'Submission failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleWithdrawQuestion = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to withdraw this submitted question?')) {
      return;
    }
    setActionLoading(id);
    try {
      await apiRequest(`/questions/${id}/withdraw`, { method: 'PATCH' });
      await fetchQuestions();
    } catch (err: any) {
      alert(err.message || 'Withdrawal failed');
    } finally {
      setActionLoading(null);
    }
  };

  // Filtered by search
  const filteredQuestions = questions.filter((q) => {
    if (!searchQuery) return true;
    const qStr = searchQuery.toLowerCase().trim().replace(/^#/, '');
    const type = q.metadata?.type || q.type || '';
    const cog = q.metadata?.cognitiveLevel || q.cognitiveLevel || '';
    return (
      q.id.toLowerCase().includes(qStr) ||
      q.humanId.toLowerCase().includes(qStr) ||
      cog.toLowerCase().includes(qStr) ||
      type.toLowerCase().includes(qStr)
    );
  });

  const draftCount = questions.filter((q) => q.status === 'DRAFT').length;
  const submittedCount = questions.filter((q) => q.status === 'SUBMITTED').length;
  const withdrawnCount = questions.filter((q) => q.status === 'WITHDRAWN').length;

  return (
    <div className="space-y-6">
      {/* Top Welcome & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Authoring Portal & Question Bank
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-mono font-medium">
              AES-256-GCM
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Questions are end-to-end envelope-encrypted with dedicated keys per version and audited.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchQuestions}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-red-600' : ''}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <button
            onClick={onCreateNew}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white bg-red-600 hover:bg-red-700 shadow-sm hover:shadow transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Author New Question</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Authored</span>
            <FileText className="w-4 h-4 text-slate-700" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{questions.length}</div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Drafts</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-2">{draftCount}</div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Submitted / Ready</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">{submittedCount}</div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Withdrawn</span>
            <RotateCcw className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-500 mt-2">{withdrawnCount}</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID (e.g. EV-PHY-000001), type, or Bloom level..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-500 font-medium">Status:</span>
          {(['ALL', 'DRAFT', 'SUBMITTED', 'WITHDRAWN'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Question List */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-xs space-y-3">
          <div className="inline-flex p-3 rounded-full bg-red-50 text-red-600 mb-1">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Loading Question Bank...</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto font-mono">
            Retrieving encrypted question bank metadata and blind cryptographic commitments
          </p>
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-300 shadow-xs">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No questions found</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? 'Try modifying your search keywords or filter criteria.'
              : 'You have not authored any questions yet. Start authoring your first encrypted question.'}
          </p>
          <button
            onClick={onCreateNew}
            className="mt-5 inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create First Question</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredQuestions.map((q) => {
            const isDraft = q.status === 'DRAFT';
            const isSubmitted = q.status === 'SUBMITTED';

            return (
              <div
                key={q.id}
                onClick={() => {
                  if (q.isLocked) {
                    alert(`Question ${q.humanId} workflow is currently LOCKED / SUSPENDED by administration (${q.lockReason || 'Administrative freeze'}). Editing is temporarily disabled.`);
                    return;
                  }
                  onEditQuestion(q.id);
                }}
                className={`rounded-xl p-4 border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group ${
                  q.isLocked
                    ? 'border-rose-200 bg-rose-50/25 cursor-not-allowed'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-md cursor-pointer'
                }`}
              >
                {/* Left meta info */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-slate-900 group-hover:text-red-600 transition-colors">
                      {q.humanId}
                    </span>
                    <span
                      title={`Opaque Question Reference ID: ${q.id} (Zero-knowledge ledger tracking)`}
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200"
                    >
                      Ref #{q.id.slice(0, 8)}
                    </span>
                    {q.isLocked ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 flex items-center space-x-1">
                        <Lock className="w-2.5 h-2.5" />
                        <span>WORKFLOW SUSPENDED</span>
                      </span>
                    ) : (
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          isDraft
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : isSubmitted
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {q.status}
                      </span>
                    )}
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-50 text-slate-700 border border-slate-200">
                      {q.metadata?.type || q.type}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                      v{q.currentVersion}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-50 text-slate-700 border border-slate-200">
                      Bloom: {q.metadata?.cognitiveLevel || q.cognitiveLevel}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-50 text-slate-700 border border-slate-200">
                      {q.metadata?.language || q.language}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>
                      Difficulty:{' '}
                      <strong className="text-slate-800 font-mono">
                        {(q.metadata?.difficulty ?? q.difficulty ?? 0.5).toFixed(2)}
                      </strong>
                    </span>
                    <span>
                      Marks:{' '}
                      <strong className="text-emerald-700 font-mono">+{(q.metadata?.marks ?? q.marks ?? 1)}</strong> /{' '}
                      <strong className="text-red-600 font-mono">-{(q.metadata?.negativeMarks ?? q.negativeMarks ?? 0)}</strong>
                    </span>
                    <span>
                      Est. Time:{' '}
                      <strong className="text-slate-800 font-mono">
                        {Math.round((q.metadata?.estimatedTimeSeconds ?? q.estimatedTime ?? 120) / 60)} min
                      </strong>
                    </span>
                    <span>Created: {formatDate(q.createdAt)}</span>
                  </div>
                </div>

                {/* Right actions */}
                <div className="flex items-center space-x-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewHistory(q.id);
                    }}
                    title="View Version History & Cryptographic Commitment"
                    className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 transition-colors text-xs flex items-center space-x-1"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Versions</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewFeedback?.(q.id);
                    }}
                    title="View Peer Review Feedback"
                    className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 transition-colors text-xs flex items-center space-x-1"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                    <span className="hidden sm:inline">Feedback</span>
                  </button>

                  {isDraft && (
                    <button
                      type="button"
                      disabled={actionLoading === q.id}
                      onClick={(e) => handleSubmitQuestion(q.id, e)}
                      title="Submit Question (Makes version immutable)"
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors flex items-center space-x-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit</span>
                    </button>
                  )}

                  {isSubmitted && (
                    <button
                      type="button"
                      disabled={actionLoading === q.id}
                      onClick={(e) => handleWithdrawQuestion(q.id, e)}
                      title="Withdraw Question"
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-red-50 text-red-700 border border-red-200 transition-colors flex items-center space-x-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Withdraw</span>
                    </button>
                  )}

                  <div className="text-slate-400 group-hover:text-slate-700 p-1">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
