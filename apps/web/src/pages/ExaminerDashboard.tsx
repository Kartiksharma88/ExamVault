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
} from 'lucide-react';

interface QuestionItem {
  id: string;
  humanId: string;
  authorId: string;
  status: 'DRAFT' | 'SUBMITTED' | 'WITHDRAWN';
  currentVersion: number;
  metadata: {
    subjectId: string;
    topicId?: string;
    type: 'MCQ_SINGLE' | 'MCQ_MULTI' | 'INTEGER';
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
}

export const ExaminerDashboard: React.FC<ExaminerDashboardProps> = ({
  onEditQuestion,
  onCreateNew,
  onViewHistory,
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
    if (!confirm('Are you sure you want to submit this question? Once submitted, it cannot be modified directly (a new version will be created).')) {
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
    const qStr = searchQuery.toLowerCase();
    return (
      q.humanId.toLowerCase().includes(qStr) ||
      q.metadata.cognitiveLevel.toLowerCase().includes(qStr) ||
      q.metadata.type.toLowerCase().includes(qStr)
    );
  });

  const draftCount = questions.filter((q) => q.status === 'DRAFT').length;
  const submittedCount = questions.filter((q) => q.status === 'SUBMITTED').length;
  const withdrawnCount = questions.filter((q) => q.status === 'WITHDRAWN').length;

  return (
    <div className="space-y-6">
      {/* Top Welcome & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
            <span>Authoring Portal & Question Bank</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
              AES-256-GCM
            </span>
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Questions are end-to-end envelope-encrypted with dedicated keys per version and audited.
          </p>
        </div>

        <button
          onClick={onCreateNew}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-glow-sm transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Author New Question</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="glass-card rounded-xl p-4 border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-secondary uppercase">Total Authored</span>
            <FileText className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{questions.length}</div>
        </div>

        <div className="glass-card rounded-xl p-4 border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-400 uppercase">Drafts</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-2">{draftCount}</div>
        </div>

        <div className="glass-card rounded-xl p-4 border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-400 uppercase">Submitted</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">{submittedCount}</div>
        </div>

        <div className="glass-card rounded-xl p-4 border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase">Withdrawn</span>
            <RotateCcw className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-400 mt-2">{withdrawnCount}</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="glass-card rounded-xl p-4 border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID (e.g. EV-PHY-000001), type, or Bloom level..."
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-border rounded-lg text-sm text-white placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-text-muted" />
          <span className="text-xs text-text-secondary">Status:</span>
          {(['ALL', 'DRAFT', 'SUBMITTED', 'WITHDRAWN'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === st
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-900 text-text-secondary hover:text-white hover:bg-slate-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Question List */}
      {loading ? (
        <div className="text-center py-16">
          <div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-sm text-text-secondary">Retrieving encrypted question bank metadata...</p>
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center border border-dashed border-border/80">
          <Sparkles className="w-10 h-10 text-cyan-400 mx-auto mb-3 opacity-60" />
          <h3 className="text-base font-medium text-white">No questions found</h3>
          <p className="text-sm text-text-muted mt-1 max-w-sm mx-auto">
            {searchQuery
              ? 'Try modifying your search keywords or filter criteria.'
              : 'You have not authored any questions yet. Start authoring your first encrypted question.'}
          </p>
          <button
            onClick={onCreateNew}
            className="mt-5 inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
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
                onClick={() => onEditQuestion(q.id)}
                className="glass-card rounded-xl p-4 border border-border glass-card-hover cursor-pointer transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left meta info */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-cyan-300">{q.humanId}</span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        isDraft
                          ? 'bg-amber-950/60 text-amber-300 border border-amber-800/80'
                          : isSubmitted
                          ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/80'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {q.status}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-text-secondary border border-border">
                      {q.metadata.type}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-blue-950/40 text-blue-300 border border-blue-900/40">
                      v{q.currentVersion}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-purple-950/40 text-purple-300 border border-purple-900/40">
                      Bloom: {q.metadata.cognitiveLevel}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-950/40 text-indigo-300 border border-indigo-900/40">
                      {q.metadata.language}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                    <span>
                      Difficulty:{' '}
                      <strong className="text-text-secondary font-mono">
                        {q.metadata.difficulty.toFixed(2)}
                      </strong>
                    </span>
                    <span>
                      Marks:{' '}
                      <strong className="text-emerald-400 font-mono">+{q.metadata.marks}</strong> /{' '}
                      <strong className="text-rose-400 font-mono">-{q.metadata.negativeMarks}</strong>
                    </span>
                    <span>
                      Est. Time:{' '}
                      <strong className="text-text-secondary font-mono">
                        {Math.round(q.metadata.estimatedTimeSeconds / 60)} min
                      </strong>
                    </span>
                    <span>Created: {formatDate(q.createdAt)}</span>
                  </div>
                </div>

                {/* Right actions */}
                <div className="flex items-center space-x-2 pt-2 md:pt-0 border-t md:border-t-0 border-border/60">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewHistory(q.id);
                    }}
                    title="View Version History & Cryptographic Commitment"
                    className="p-2 rounded-lg text-text-secondary hover:text-cyan-400 hover:bg-slate-800 border border-border transition-colors text-xs flex items-center space-x-1"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Versions</span>
                  </button>

                  {isDraft && (
                    <button
                      type="button"
                      disabled={actionLoading === q.id}
                      onClick={(e) => handleSubmitQuestion(q.id, e)}
                      title="Submit Question (Makes version immutable)"
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-600/40 transition-colors flex items-center space-x-1"
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
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 border border-rose-800/60 transition-colors flex items-center space-x-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Withdraw</span>
                    </button>
                  )}

                  <div className="text-text-muted hover:text-white p-1">
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
