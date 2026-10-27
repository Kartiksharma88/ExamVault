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
        const rawData = res.data as any;
        const list: VersionItem[] = Array.isArray(rawData)
          ? rawData
          : Array.isArray(rawData?.versions)
          ? rawData.versions
          : [];
        setVersions(list);
        if (list.length > 0) {
          loadVersionContent(list[0].versionNo);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <History className="w-5 h-5 text-red-600" />
            <h2 className="text-base font-bold text-slate-900">Immutable Version History & Commitments</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              Loading cryptographic commitments...
            </div>
          ) : (
            <>
              {/* Timeline list */}
              <div>
                <h3 className="text-xs uppercase font-bold text-slate-500 tracking-wider mb-3">
                  Version Timeline
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {(!Array.isArray(versions) || versions.length === 0) && (
                    <div className="col-span-full py-4 text-center text-xs text-slate-400">
                      No versions found for this question.
                    </div>
                  )}
                  {Array.isArray(versions) && versions.map((ver) => {
                    const isSelected = selectedVersion === ver.versionNo;
                    return (
                      <div
                        key={ver.id}
                        onClick={() => loadVersionContent(ver.versionNo)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-red-50/50 border-red-500 shadow-xs ring-1 ring-red-500/20'
                            : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono text-sm font-bold text-slate-900">Version {ver.versionNo}</span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              ver.status === 'SUBMITTED'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {ver.status}
                          </span>
                        </div>

                        <div className="space-y-1 text-xs">
                          <div className="flex items-center space-x-1 text-slate-500">
                            <ShieldCheck className="w-3.5 h-3.5 text-red-600" />
                            <span className="font-mono text-[10px] truncate max-w-[190px] text-slate-700" title={ver.contentCommitment}>
                              {ver.contentCommitment.slice(0, 16)}...
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">{formatDate(ver.createdAt)}</div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                          <span className="text-red-600 font-semibold flex items-center space-x-1">
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
                              className="text-slate-500 hover:text-slate-900 font-medium flex items-center space-x-1"
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
                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs uppercase font-bold text-slate-700 tracking-wider flex items-center space-x-1.5">
                      <GitCompare className="w-4 h-4 text-red-600" />
                      <span>
                        Diff: Version {compareVersion} vs Version {selectedVersion}
                      </span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setCompareVersion(null)}
                      className="text-xs text-red-600 hover:underline font-semibold"
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
                <div className="bg-slate-50/80 rounded-xl p-5 border border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <h3 className="text-sm font-bold text-slate-900">
                      Decrypted Content Preview — Version {selectedVersion}
                    </h3>
                    <div className="text-xs font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium">
                      AES-256-GCM Verified
                    </div>
                  </div>

                  {contentLoading ? (
                    <div className="py-6 text-center text-xs text-slate-500">Decrypting envelope...</div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <span className="text-xs uppercase font-bold text-slate-600 block mb-1">
                          Stem & Formula
                        </span>
                        <div className="p-3.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
                          <KaTeXPreview content={versionContent.content?.stem || ''} />
                        </div>
                      </div>

                      {versionContent.content?.options && (
                        <div>
                          <span className="text-xs uppercase font-bold text-slate-600 block mb-1">
                            Options
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {versionContent.content.options.map((opt: any) => (
                              <div
                                key={opt.label}
                                className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs flex items-center space-x-2"
                              >
                                <span className="w-5 h-5 rounded font-mono font-bold bg-slate-900 text-white flex items-center justify-center">
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
                          <span className="text-xs uppercase font-bold text-slate-600 block mb-1">
                            Decrypted Answer Key
                          </span>
                          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-mono text-emerald-900 font-medium">
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
