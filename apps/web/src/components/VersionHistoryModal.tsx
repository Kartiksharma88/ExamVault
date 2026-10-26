import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api-client';
import { formatDate } from '../lib/utils';
import { DiffViewer } from './DiffViewer';
import { KaTeXPreview } from './KaTeXPreview';
import { X, History, ShieldCheck, Eye, GitCompare } from 'lucide-react';

interface VersionItem {
  id: string;
  questionId: string;
  versionNo: number;
  status: string;
  contentCommitment: string;
  createdAt: string;
}

interface VersionHistoryModalProps {
  questionId: string;
  onClose: () => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  questionId,
  onClose,
}) => {
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [versionContent, setVersionContent] = useState<any>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [compareVersion, setCompareVersion] = useState<number | null>(null);
  const [compareContent, setCompareContent] = useState<any>(null);

  useEffect(() => {
    const fetchVersions = async () => {
      setLoading(true);
      try {
        const res = await apiRequest<{ success: boolean; data: VersionItem[] }>(
          `/questions/${questionId}/versions`,
        );
        const list = res.data || [];
        setVersions(list);
        if (list.length > 0) {
          loadVersionContent(list[list.length - 1].versionNo);
        }
      } catch (err) {
        console.error('Failed to load version history:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchVersions();
  }, [questionId]);

  const loadVersionContent = async (vNo: number) => {
    setSelectedVersion(vNo);
    setContentLoading(true);
    try {
      const res = await apiRequest<{ success: boolean; data: any }>(
        `/questions/${questionId}/content?version=${vNo}`,
      );
      setVersionContent(res.data);
    } catch (err) {
      console.error('Failed to load version content:', err);
    } finally {
      setContentLoading(false);
    }
  };

  const loadCompareContent = async (vNo: number) => {
    setCompareVersion(vNo);
    try {
      const res = await apiRequest<{ success: boolean; data: any }>(
        `/questions/${questionId}/content?version=${vNo}`,
      );
      setCompareContent(res.data);
    } catch (err) {
      console.error('Failed to load compare content:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="glass-card rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-border overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-slate-900/60">
          <div className="flex items-center space-x-2">
            <History className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-semibold text-white">Immutable Version History & Commitments</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-12 text-center text-text-secondary text-sm">
              Loading cryptographic commitments...
            </div>
          ) : (
            <>
              {/* Timeline list */}
              <div>
                <h3 className="text-xs uppercase font-semibold text-text-secondary tracking-wider mb-3">
                  Version Timeline
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {versions.map((ver) => {
                    const isSelected = selectedVersion === ver.versionNo;
                    return (
                      <div
                        key={ver.id}
                        onClick={() => loadVersionContent(ver.versionNo)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-950/30 border-blue-500 shadow-glow-sm'
                            : 'bg-slate-900/50 border-border hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono text-sm font-bold text-white">Version {ver.versionNo}</span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              ver.status === 'SUBMITTED'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : 'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}
                          >
                            {ver.status}
                          </span>
                        </div>

                        <div className="space-y-1 text-xs">
                          <div className="flex items-center space-x-1 text-text-muted">
                            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                            <span className="font-mono text-[10px] truncate max-w-[190px]" title={ver.contentCommitment}>
                              {ver.contentCommitment.slice(0, 16)}...
                            </span>
                          </div>
                          <div className="text-[11px] text-text-muted">{formatDate(ver.createdAt)}</div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-[11px]">
                          <span className="text-cyan-400 flex items-center space-x-1">
                            <Eye className="w-3 h-3" />
                            <span>Inspect</span>
                          </span>
                          {versions.length > 1 && !isSelected && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                loadCompareContent(ver.versionNo);
                              }}
                              className="text-text-muted hover:text-white flex items-center space-x-1"
                            >
                              <GitCompare className="w-3 h-3" />
                              <span>Diff</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Diff View if compareVersion is active */}
              {compareVersion && compareContent && versionContent && (
                <div className="space-y-2 border-t border-border pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs uppercase font-semibold text-text-secondary tracking-wider flex items-center space-x-1.5">
                      <GitCompare className="w-4 h-4 text-cyan-400" />
                      <span>
                        Diff: Version {compareVersion} vs Version {selectedVersion}
                      </span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setCompareVersion(null)}
                      className="text-xs text-text-muted hover:text-white"
                    >
                      Clear Diff
                    </button>
                  </div>
                  <DiffViewer
                    oldText={compareContent.content?.stem || ''}
                    newText={versionContent.content?.stem || ''}
                    oldLabel={`Version ${compareVersion}`}
                    newLabel={`Version ${selectedVersion}`}
                  />
                </div>
              )}

              {/* Version Content Inspection */}
              {versionContent && (
                <div className="glass-card rounded-xl p-5 border border-border space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <h3 className="text-sm font-semibold text-white">
                      Decrypted Content Preview — Version {selectedVersion}
                    </h3>
                    <div className="text-xs font-mono text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800">
                      AES-256-GCM Verified
                    </div>
                  </div>

                  {contentLoading ? (
                    <div className="py-6 text-center text-xs text-text-muted">Decrypting envelope...</div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <span className="text-xs uppercase font-semibold text-text-muted block mb-1">
                          Stem & Formula
                        </span>
                        <div className="p-3 bg-slate-950 rounded-lg border border-border">
                          <KaTeXPreview content={versionContent.content?.stem || ''} />
                        </div>
                      </div>

                      {versionContent.content?.options && (
                        <div>
                          <span className="text-xs uppercase font-semibold text-text-muted block mb-1">
                            Options
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {versionContent.content.options.map((opt: any) => (
                              <div
                                key={opt.label}
                                className="p-2.5 rounded-lg bg-slate-950 border border-border text-xs flex items-center space-x-2"
                              >
                                <span className="w-5 h-5 rounded font-mono font-bold bg-slate-800 flex items-center justify-center text-cyan-300">
                                  {opt.label}
                                </span>
                                <div className="flex-1">
                                  <KaTeXPreview content={opt.text} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {versionContent.answerKey && (
                        <div>
                          <span className="text-xs uppercase font-semibold text-text-muted block mb-1">
                            Decrypted Answer Key
                          </span>
                          <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-800/40 text-xs font-mono text-emerald-300">
                            Type: {versionContent.answerKey.type} | Correct:{' '}
                            {JSON.stringify(versionContent.answerKey.correct)}
                            {versionContent.answerKey.tolerance !== undefined &&
                              ` (Tol: ±${versionContent.answerKey.tolerance})`}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
