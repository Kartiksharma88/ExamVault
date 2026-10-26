import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api-client';
import { BarChart3, PieChart, Layers, ShieldCheck, Target, Activity } from 'lucide-react';

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

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const res = await apiRequest<{ success: boolean; data: BankStats }>('/stats');
        setStats(res.data);
      } catch (err) {
        console.error('Failed to load bank stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="py-20 text-center text-text-secondary text-sm">
        <div className="inline-block w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p>Aggregating non-leaking question bank statistics...</p>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
          <span>Question Bank Analytics & Distribution</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
            Zero-Content Leak
          </span>
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Aggregate metadata distributions computed over blinded encrypted records. No question content or answers are
          revealed.
        </p>
      </div>

      {/* Top Total Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-5 border border-border">
          <div className="flex items-center justify-between text-text-secondary text-xs uppercase font-semibold">
            <span>Total Encrypted Questions</span>
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-3 font-mono">{stats.totalQuestions}</div>
          <p className="text-[11px] text-text-muted mt-1">Stored with AES-256-GCM envelope encryption</p>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-border">
          <div className="flex items-center justify-between text-emerald-400 text-xs uppercase font-semibold">
            <span>Submitted & Locked</span>
            <Target className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 mt-3 font-mono">
            {stats.byStatus['SUBMITTED'] || 0}
          </div>
          <p className="text-[11px] text-text-muted mt-1">Immutable cryptographic commitments verified</p>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-border">
          <div className="flex items-center justify-between text-amber-400 text-xs uppercase font-semibold">
            <span>Active Drafts</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-amber-400 mt-3 font-mono">
            {stats.byStatus['DRAFT'] || 0}
          </div>
          <p className="text-[11px] text-text-muted mt-1">Under active authoring by examiners</p>
        </div>
      </div>

      {/* Subject Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-6 border border-border space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>Questions by Subject</span>
            </h3>
            <span className="text-xs text-text-muted">{stats.bySubject.length} Subjects</span>
          </div>

          <div className="space-y-3">
            {stats.bySubject.map((sub) => {
              const percent = stats.totalQuestions > 0 ? (sub.count / stats.totalQuestions) * 100 : 0;
              return (
                <div key={sub.subjectId} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-white">{sub.subjectName}</span>
                    <span className="text-cyan-400 font-mono">
                      {sub.count} ({percent.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Difficulty Distribution */}
        <div className="glass-card rounded-2xl p-6 border border-border space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <span>Difficulty Spread (0.0 to 1.0)</span>
            </h3>
            <span className="text-xs text-text-muted">Target Normal Curve</span>
          </div>

          <div className="space-y-3">
            {stats.byDifficultyBucket.map((bucket) => {
              const percent = stats.totalQuestions > 0 ? (bucket.count / stats.totalQuestions) * 100 : 0;
              return (
                <div key={bucket.bucket} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-white">{bucket.bucket}</span>
                    <span className="text-cyan-400 font-mono">
                      {bucket.count} ({percent.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500"
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
      <div className="glass-card rounded-2xl p-6 border border-border space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center space-x-2 border-b border-border pb-3">
          <PieChart className="w-4 h-4 text-purple-400" />
          <span>Question Types Breakdown</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Object.entries(stats.byType).map(([type, count]) => {
            const percent = stats.totalQuestions > 0 ? (count / stats.totalQuestions) * 100 : 0;
            return (
              <div key={type} className="p-4 rounded-xl bg-slate-900/60 border border-border">
                <span className="text-xs font-mono text-text-secondary uppercase">{type.replace('_', ' ')}</span>
                <div className="text-2xl font-bold text-white mt-1 font-mono">{count}</div>
                <div className="text-xs text-cyan-400 mt-1 font-mono">{percent.toFixed(1)}% of bank</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
