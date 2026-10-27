import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api-client';
import {
  X,
  CheckCircle2,
  AlertCircle,
  FileEdit,
  GitBranch,
  Sliders,
  Lock,
} from 'lucide-react';

interface AuthorFeedbackModalProps {
  questionId: string;
  onClose: () => void;
  onCreateNewVersion?: (questionId: string) => void;
}

export const AuthorFeedbackModal: React.FC<AuthorFeedbackModalProps> = ({
  questionId,
  onClose,
  onCreateNewVersion,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New version form state
  const [isCreatingVersion, setIsCreatingVersion] = useState<boolean>(false);
  const [changeJustification, setChangeJustification] = useState<string>('');
  const [submittingVersion, setSubmittingVersion] = useState<boolean>(false);
  const [versionSuccessMsg, setVersionSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchFeedback = async () => {
      setLoading(true);
      try {
        const resData = await apiRequest<{ success: boolean; data: any }>(`/questions/${questionId}/feedback`);
        if (resData.success) {
          setData(resData.data);
        } else {
          setError('Failed to load feedback');
        }
      } catch (err: any) {
        setError(err.message || 'Network error fetching feedback');
      } finally {
        setLoading(false);
      }
    };
    fetchFeedback();
  }, [questionId]);

  const handleCreateNewVersionSubmit = async () => {
    if (!changeJustification.trim() || changeJustification.length < 10) {
      setError('A written change justification of at least 10 characters is required.');
      return;
    }
    setSubmittingVersion(true);
    setError(null);
    try {
      const resData = await apiRequest<{ success: boolean; data: any }>('/questions/new-version', {
        method: 'POST',
        body: JSON.stringify({
          parentVersionId: data.versionId,
          changeJustification,
        }),
      });
      if (resData.success) {
        setVersionSuccessMsg(`New version created (v${resData.data.versionNo}) in DRAFT!`);
        setIsCreatingVersion(false);
        if (onCreateNewVersion) {
          setTimeout(() => {
            onCreateNewVersion(questionId);
          }, 1000);
        }
      } else {
        setError('Failed to create revision');
      }
    } catch (err: any) {
      setError(err.message || 'Error creating new version');
    } finally {
      setSubmittingVersion(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl space-y-4 border border-slate-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Review Feedback & Decision History</h3>
            <span className="font-mono text-xs text-slate-500">
              {data?.humanId || questionId} (v{data?.versionNo || 1})
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Anonymity Banner */}
        <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Lock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Double-blind protocol active: Reviewer identities are anonymized as Reviewer A, B, etc.</span>
          </div>
          <span className="font-mono text-[10px] text-blue-600 font-semibold">IEEE/JAC-Standard</span>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {versionSuccessMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{versionSuccessMsg}</span>
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center text-slate-400 font-mono text-xs">
            Loading anonymized review records...
          </div>
        ) : (
          <div className="space-y-4">
            {/* Feedback items list */}
            {data?.feedback?.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                No peer reviews or moderator comments have been recorded for this version yet.
              </div>
            ) : (
              <div className="space-y-3">
                {data?.feedback?.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs px-2.5 py-0.5 rounded-full bg-slate-900 text-white">
                          {item.reviewerAlias}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(item.submittedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-bold ${
                          item.decision === 'APPROVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.decision === 'REQUEST_CHANGES'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {item.decision}
                      </span>
                    </div>

                    {/* Difficulty and Checklist */}
                    {item.difficultyRating !== undefined && (
                      <div className="flex items-center space-x-2 text-xs text-slate-600 font-mono">
                        <Sliders className="w-3.5 h-3.5 text-slate-400" />
                        <span>Peer-Estimated Difficulty: {item.difficultyRating.toFixed(2)} / 1.0</span>
                      </div>
                    )}

                    {/* Qualitative Comments */}
                    {item.comments ? (
                      <div className="text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                        {item.comments}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic">No textual comment provided.</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Create New Version Section */}
            {!isCreatingVersion ? (
              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingVersion(true)}
                  className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs flex items-center space-x-1.5"
                >
                  <FileEdit className="w-3.5 h-3.5 mr-1" />
                  <span>Create Revision (New Version)</span>
                </button>
              </div>
            ) : (
              <div className="p-4 bg-slate-100/70 border border-slate-200 rounded-xl space-y-3 pt-3">
                <div className="flex items-center space-x-2 text-slate-900">
                  <GitBranch className="w-4 h-4 text-red-600" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Author Revision: Create v{data?.versionNo + 1}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Per Step 2 immutability rules, approved/submitted questions cannot be edited in place. Creating a revision preserves version history and re-initiates independent screening and review.
                </p>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Mandatory Change Justification (Minimum 10 characters)
                  </label>
                  <textarea
                    rows={3}
                    value={changeJustification}
                    onChange={(e) => setChangeJustification(e.target.value)}
                    placeholder="Specify the revisions made (e.g., clarified distractor wording, corrected typographical unit, aligned with reviewer feedback)..."
                    className="w-full text-xs p-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCreatingVersion(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={submittingVersion || changeJustification.length < 10}
                    onClick={handleCreateNewVersionSubmit}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 rounded-lg shadow-xs flex items-center space-x-1"
                  >
                    {submittingVersion ? <span>Creating...</span> : <span>Create & Edit Revision</span>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
