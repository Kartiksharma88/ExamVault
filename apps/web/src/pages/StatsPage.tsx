import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api-client';
import { BarChart3, PieChart, Layers, ShieldCheck, Target, Activity, Loader2, RefreshCw } from 'lucide-react';

interface BankStats {
  totalQuestions: number;
  byStatus: Record<string, number>;
  bySubject: { subjectId: string; subjectName: string; count: number }[];
  byType: Record<string, number>;
  byDifficultyBucket: { bucket: string; count: number }[];
}

export const StatsPage: React.FC = () => {
  const [stats, setStats] = useState<BankStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ success: boolean; data: BankStats }>('/stats/bank');
      setStats(res.data);
    } catch (err) {
      console.error('Failed to load bank stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-xs space-y-3 my-8">
        <div className="inline-flex p-3 rounded-full bg-red-50 text-red-600 mb-1">
          <Loader2 className="w-7 h-7 animate-spin" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Computing Question Bank Analytics...</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto font-mono">
          Aggregating zero-leak metadata distributions across encrypted question partitions
        </p>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Question Bank Analytics & Distribution
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-mono font-medium">
              Zero-Content Leak
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Aggregate metadata distributions computed over blinded encrypted records. No question content or answers are revealed.
          </p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all disabled:opacity-50 self-start sm:self-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-red-600' : ''}`} />
          <span>{loading ? 'Refreshing...' : 'Refresh Metrics'}</span>
        </button>
      </div>

      {/* Top Total Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-600 text-xs uppercase font-bold tracking-wider">
            <span>Total Encrypted Questions</span>
            <ShieldCheck className="w-4 h-4 text-slate-900" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-3 font-mono">{stats.totalQuestions}</div>
          <p className="text-[11px] text-slate-500 mt-1">Stored with AES-256-GCM envelope encryption</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 text-xs uppercase font-bold tracking-wider">
            <span>Submitted & Locked</span>
            <Target className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-600 mt-3 font-mono">
            {stats.byStatus['SUBMITTED'] || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Immutable cryptographic commitments verified</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 text-xs uppercase font-bold tracking-wider">
            <span>Active Drafts</span>
            <Activity className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-3xl font-extrabold text-amber-600 mt-3 font-mono">
            {stats.byStatus['DRAFT'] || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Under active authoring by examiners</p>
        </div>
      </div>

      {/* Subject Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Layers className="w-4 h-4 text-red-600" />
              <span>Questions by Subject</span>
            </h3>
            <span className="text-xs text-slate-500 font-medium">{stats.bySubject.length} Subjects</span>
          </div>

          <div className="space-y-3">
            {stats.bySubject.map((sub) => {
              const percent = stats.totalQuestions > 0 ? (sub.count / stats.totalQuestions) * 100 : 0;
              return (
                <div key={sub.subjectId} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-800">{sub.subjectName}</span>
                    <span className="text-slate-900 font-mono">
                      {sub.count} ({percent.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-red-600"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Difficulty Distribution */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-slate-900" />
              <span>Difficulty Spread (0.0 to 1.0)</span>
            </h3>
            <span className="text-xs text-slate-500 font-medium">Standard Normal Distribution</span>
          </div>

          <div className="space-y-3">
            {stats.byDifficultyBucket.map((bucket) => {
              const percent = stats.totalQuestions > 0 ? (bucket.count / stats.totalQuestions) * 100 : 0;
              return (
                <div key={bucket.bucket} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-800">{bucket.bucket}</span>
                    <span className="text-slate-900 font-mono">
                      {bucket.count} ({percent.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-slate-900"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Question Type Breakdown */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2 border-b border-slate-100 pb-3">
          <PieChart className="w-4 h-4 text-red-600" />
          <span>Question Types Breakdown</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Object.entries(stats.byType).map(([type, count]) => {
            const percent = stats.totalQuestions > 0 ? (count / stats.totalQuestions) * 100 : 0;
            return (
              <div key={type} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-mono font-bold text-slate-600 uppercase tracking-wider">{type.replace('_', ' ')}</span>
                <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">{count}</div>
                <div className="text-xs text-red-600 mt-1 font-mono font-semibold">{percent.toFixed(1)}% of total vault</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
