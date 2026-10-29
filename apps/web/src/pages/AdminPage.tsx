import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api-client';
import { formatDate } from '../lib/utils';
import { ModalPortal } from '../components/ModalPortal';
import {
  Users,
  BookOpen,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
  FolderTree,
  UserPlus,
  Loader2,
  RefreshCw,
  Search,
  Lock,
  Unlock,
  Layers,
  EyeOff,
  ShieldCheck,
  ShieldAlert,
  X,
  HelpCircle,
} from 'lucide-react';

interface UserItem {
  id: string;
  email: string;
  name: string;
  role: string;
  mfaEnabled: boolean;
  createdAt: string;
  userSubjectExpertise?: {
    subjectId: string;
    subject: {
      id: string;
      name: string;
      code: string;
    };
  }[];
}

interface ExamItem {
  id: string;
  name: string;
  description?: string;
  subjects: {
    id: string;
    name: string;
    code: string;
    topics: {
      id: string;
      name: string;
      subtopics: {
        id: string;
        name: string;
      }[];
    }[];
  }[];
}

interface AdminPageProps {
  initialSubTab?: 'users' | 'syllabus' | 'workflow';
  activeSubTab?: 'users' | 'syllabus' | 'workflow';
  onSubTabChange?: (tab: 'users' | 'syllabus' | 'workflow') => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({
  initialSubTab = 'users',
  activeSubTab,
  onSubTabChange,
}) => {
  const [internalTab, setInternalTab] = useState<'users' | 'syllabus' | 'workflow'>(activeSubTab || initialSubTab);
  const activeTab = activeSubTab || internalTab;

  const handleSelectTab = (tab: 'users' | 'syllabus' | 'workflow') => {
    setInternalTab(tab);
    onSubTabChange?.(tab);
  };

  // Users state
  const [users, setUsers] = useState<UserItem[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<{ id: string; name: string; code: string }[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'EXAMINER' | 'ADMIN' | 'REVIEWER' | 'AUDITOR'>('EXAMINER');
  const [newSubjectIds, setNewSubjectIds] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState('Password123!@#$');
  const [userMsg, setUserMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Subject assignment modal state
  const [editingSubjectUser, setEditingSubjectUser] = useState<UserItem | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  // Syllabus state
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [syllabusLoading, setSyllabusLoading] = useState(true);
  const [showAddExam, setShowAddExam] = useState(false);
  const [newExamName, setNewExamName] = useState('');
  const [newExamDesc, setNewExamDesc] = useState('');

  const [showAddSubject, setShowAddSubject] = useState<string | null>(null); // examId
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState('');

  const [showAddTopic, setShowAddTopic] = useState<string | null>(null); // subjectId
  const [newTopicName, setNewTopicName] = useState('');

  const [showAddSubtopic, setShowAddSubtopic] = useState<string | null>(null); // topicId
  const [newSubtopicName, setNewSubtopicName] = useState('');

  // Question workflow & auditor support state
  const [questions, setQuestions] = useState<any[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionSearch, setQuestionSearch] = useState('');
  const [auditorLookupInput, setAuditorLookupInput] = useState('');
  const [auditorLookupResult, setAuditorLookupResult] = useState<any | null>(null);

  // Fetch users & available subjects
  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await apiRequest<{ success: boolean; data: UserItem[] }>('/users');
      setUsers(res.data || []);
      const subRes = await apiRequest<{ success: boolean; data: any[] }>('/syllabus/subjects');
      setAvailableSubjects(subRes.data || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleOpenSubjectModal = (user: UserItem) => {
    setEditingSubjectUser(user);
    setSelectedSubjects(user.userSubjectExpertise?.map((e) => e.subjectId) || []);
  };

  const handleSaveSubjects = async () => {
    if (!editingSubjectUser) return;
    try {
      await apiRequest(`/users/${editingSubjectUser.id}/subjects`, {
        method: 'PATCH',
        body: JSON.stringify({ subjectIds: selectedSubjects }),
      });
      setUserMsg({
        type: 'success',
        text: `Subject specialization updated for ${editingSubjectUser.name}.`,
      });
      setEditingSubjectUser(null);
      fetchUsers();
    } catch (err: any) {
      setUserMsg({
        type: 'error',
        text: err.message || 'Failed to update subject specialization.',
      });
    }
  };

  // Fetch syllabus tree
  const fetchSyllabus = async () => {
    setSyllabusLoading(true);
    try {
      const res = await apiRequest<{ success: boolean; data: ExamItem[] }>('/syllabus/exams');
      setExams(res.data || []);
    } catch (err) {
      console.error('Failed to load syllabus:', err);
    } finally {
      setSyllabusLoading(false);
    }
  };

  // Fetch questions for workflow & auditor support
  const fetchQuestions = async () => {
    setQuestionsLoading(true);
    try {
      const res = await apiRequest<{ success: boolean; data: { items: any[] } }>('/questions?limit=100');
      setQuestions(res.data?.items || []);
    } catch (err) {
      console.error('Failed to load questions for admin:', err);
    } finally {
      setQuestionsLoading(false);
    }
  };

  const [workflowStatusFilter, setWorkflowStatusFilter] = useState<string>('ALL');
  const [assignModalQuestion, setAssignModalQuestion] = useState<any | null>(null);
  const [selectedReviewerId, setSelectedReviewerId] = useState<string>('');

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'syllabus') {
      fetchSyllabus();
    } else if (activeTab === 'workflow') {
      fetchQuestions();
      if (users.length === 0) fetchUsers();
    }
  }, [activeTab]);

  const handleAuditorLookup = () => {
    const clean = auditorLookupInput.trim().replace(/^#/, '').toLowerCase();
    if (!clean) {
      setAuditorLookupResult(null);
      return;
    }
    const match = questions.find(
      (q) => q.id.toLowerCase().includes(clean) || (q.humanId && q.humanId.toLowerCase().includes(clean)),
    );
    setAuditorLookupResult(match || 'NOT_FOUND');
  };

  const handleToggleLock = async (questionId: string, currentLocked: boolean) => {
    try {
      const targetLocked = !currentLocked;
      await apiRequest<{ success: boolean; data: any }>(`/questions/${questionId}/workflow-lock`, {
        method: 'PATCH',
        body: JSON.stringify({
          isLocked: targetLocked,
          reason: targetLocked ? 'Administrative governance suspension' : 'Administrative workflow release',
        }),
      });

      setUserMsg({
        type: 'success',
        text: `Question Ref #${questionId.slice(0, 8)} workflow is now ${targetLocked ? 'LOCKED / SUSPENDED' : 'UNLOCKED / ACTIVE'}.`,
      });

      setQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? { ...q, isLocked: targetLocked } : q))
      );

      setAuditorLookupResult((prev: any) =>
        prev && prev.id === questionId ? { ...prev, isLocked: targetLocked } : prev
      );
    } catch (err: any) {
      setUserMsg({
        type: 'error',
        text: err.message || 'Failed to update workflow lock status.',
      });
    }
  };

  const handleAssignReviewer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalQuestion || !selectedReviewerId) return;
    try {
      const reviewer = users.find((u) => u.id === selectedReviewerId);
      await apiRequest<{ success: boolean; data: any }>('/review/assignments', {
        method: 'POST',
        body: JSON.stringify({
          questionId: assignModalQuestion.id,
          reviewerId: selectedReviewerId,
        }),
      });

      setUserMsg({
        type: 'success',
        text: `Reviewer ${reviewer?.name || 'Assigned User'} successfully assigned to Question Ref #${assignModalQuestion.id.slice(0, 8)} (${assignModalQuestion.humanId || 'Q'}). Now visible in Reviewer Portal!`,
      });
      setAssignModalQuestion(null);
      setSelectedReviewerId('');
      fetchQuestions();
    } catch (err: any) {
      setUserMsg({
        type: 'error',
        text: err.message || 'Failed to assign reviewer to question.',
      });
    }
  };

  useEffect(() => {
    if (activeSubTab) {
      setInternalTab(activeSubTab);
    } else if (initialSubTab) {
      setInternalTab(initialSubTab);
    }
  }, [activeSubTab, initialSubTab]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserMsg(null);
    try {
      await apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify({
          email: newEmail,
          name: newName,
          role: newRole,
          password: newPassword,
          subjectIds: (newRole === 'EXAMINER' || newRole === 'REVIEWER') ? newSubjectIds : [],
        }),
      });

      setUserMsg({ type: 'success', text: `User ${newEmail} created successfully.` });
      setNewEmail('');
      setNewName('');
      setNewSubjectIds([]);
      setShowCreateUser(false);
      fetchUsers();
    } catch (err: any) {
      setUserMsg({ type: 'error', text: err.message || 'Failed to create user' });
    }
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/syllabus/exams', {
        method: 'POST',
        body: JSON.stringify({ name: newExamName, description: newExamDesc }),
      });
      setShowAddExam(false);
      setNewExamName('');
      setNewExamDesc('');
      fetchSyllabus();
    } catch (err: any) {
      alert(err.message || 'Failed to create exam');
    }
  };

  const handleCreateSubject = async (examId: string, e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/syllabus/subjects', {
        method: 'POST',
        body: JSON.stringify({
          examId,
          name: newSubjectName,
          code: newSubjectCode.toUpperCase(),
        }),
      });
      setShowAddSubject(null);
      setNewSubjectName('');
      setNewSubjectCode('');
      fetchSyllabus();
    } catch (err: any) {
      alert(err.message || 'Failed to create subject');
    }
  };

  const handleCreateTopic = async (subjectId: string, e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/syllabus/topics', {
        method: 'POST',
        body: JSON.stringify({ subjectId, name: newTopicName }),
      });
      setShowAddTopic(null);
      setNewTopicName('');
      fetchSyllabus();
    } catch (err: any) {
      alert(err.message || 'Failed to create topic');
    }
  };

  const handleCreateSubtopic = async (topicId: string, e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/syllabus/subtopics', {
        method: 'POST',
        body: JSON.stringify({ topicId, name: newSubtopicName }),
      });
      setShowAddSubtopic(null);
      setNewSubtopicName('');
      fetchSyllabus();
    } catch (err: any) {
      alert(err.message || 'Failed to create subtopic');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Administration & Governance
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 font-semibold">
              Admin Access
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Manage institutional users, roles, and syllabus trees. (Admin has zero access to question ciphertexts).
          </p>
        </div>

        <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => handleSelectTab('users')}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'users' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Users & Access</span>
          </button>
          <button
            onClick={() => handleSelectTab('syllabus')}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'syllabus' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Syllabus Taxonomy</span>
          </button>
          <button
            onClick={() => handleSelectTab('workflow')}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'workflow' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Question Bank & Workflow</span>
          </button>
        </div>
      </div>

      {userMsg && (
        <div
          className={`p-4 rounded-xl border flex items-center space-x-3 text-sm ${
            userMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {userMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
          )}
          <span>{userMsg.text}</span>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Institutional Users & Access Directory</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={fetchUsers}
                disabled={usersLoading}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${usersLoading ? 'animate-spin text-red-600' : ''}`} />
                <span>{usersLoading ? 'Refreshing...' : 'Refresh'}</span>
              </button>
              <button
                onClick={() => setShowCreateUser(true)}
                className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-xs transition-all"
              >
                <UserPlus className="w-4 h-4" />
                <span>Enroll New User</span>
              </button>
            </div>
          </div>

          {/* Create User Modal */}
          {showCreateUser && (
            <ModalPortal>
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm">
                <div className="bg-white rounded-2xl w-full max-w-md p-6 border border-slate-200 shadow-2xl">
                <h3 className="text-base font-bold text-slate-900 mb-4">Enroll New User</h3>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Prof. Jane Doe"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="jane.doe@examvault.local"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Role *</label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600"
                    >
                      <option value="EXAMINER">EXAMINER (Author questions)</option>
                      <option value="ADMIN">ADMIN (Manage syllabus & users)</option>
                      <option value="AUDITOR">AUDITOR (Read audit chain)</option>
                      <option value="REVIEWER">REVIEWER (Review questions)</option>
                    </select>
                  </div>

                  {(newRole === 'EXAMINER' || newRole === 'REVIEWER') && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Subject Specialization ({newRole === 'EXAMINER' ? 'Examiner can author this subject only' : 'Reviewer will only receive this subject'})
                      </label>
                      <div className="space-y-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                        {availableSubjects.map((s) => (
                          <label key={s.id} className="flex items-center space-x-2 text-xs text-slate-800 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newSubjectIds.includes(s.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewSubjectIds([...newSubjectIds, s.id]);
                                } else {
                                  setNewSubjectIds(newSubjectIds.filter((id) => id !== s.id));
                                }
                              }}
                              className="rounded text-red-600 focus:ring-red-500"
                            />
                            <span>{s.name} ({s.code})</span>
                          </label>
                        ))}
                        {availableSubjects.length === 0 && (
                          <span className="text-[11px] text-slate-400 italic">No syllabus subjects configured yet.</span>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Temporary Password (Min 12 chars) *
                    </label>
                    <input
                      type="text"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 font-mono font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Must contain uppercase, lowercase, digit, and special symbol.
                    </p>
                  </div>

                  <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowCreateUser(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-xs"
                    >
                      Create User
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </ModalPortal>
          )}

          {/* Edit User Subject Specialization Modal */}
          {editingSubjectUser && (
            <ModalPortal>
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm">
                <div className="bg-white rounded-2xl w-full max-w-md p-6 border border-slate-200 shadow-2xl space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Assign Subject Specialization
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Managing subject category for <strong>{editingSubjectUser.name}</strong> ({editingSubjectUser.role}).
                    {editingSubjectUser.role === 'EXAMINER' && ' Questions authored will be strictly bound to this subject.'}
                    {editingSubjectUser.role === 'REVIEWER' && ' Questions assigned for review will strictly match this subject.'}
                  </p>
                </div>

                <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-60 overflow-y-auto">
                  {availableSubjects.map((s) => {
                    const isChecked = selectedSubjects.includes(s.id);
                    return (
                      <label
                        key={s.id}
                        className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-red-50/50 border-red-300 text-red-900 font-semibold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSubjects([...selectedSubjects, s.id]);
                              } else {
                                setSelectedSubjects(selectedSubjects.filter((id) => id !== s.id));
                              }
                            }}
                            className="rounded text-red-600 focus:ring-red-500"
                          />
                          <span>{s.name}</span>
                        </div>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">
                          {s.code}
                        </span>
                      </label>
                    );
                  })}
                  {availableSubjects.length === 0 && (
                    <div className="text-xs text-slate-400 italic text-center py-2">
                      No subjects configured in the syllabus taxonomy yet.
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingSubjectUser(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSubjects}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-xs"
                  >
                    Save Specialization
                  </button>
                </div>
              </div>
            </div>
          </ModalPortal>
          )}

          {/* User List Table */}
          {usersLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs space-y-3">
              <div className="inline-flex p-3 rounded-full bg-red-50 text-red-600 mb-1">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Loading User Directory...</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto font-mono">
                Fetching institutional accounts, cryptographic key statuses, and role privileges
              </p>
            </div>
          ) : users.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-xs shadow-xs">
              No institutional users found.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Name</th>
                    <th className="px-5 py-3.5">Email</th>
                    <th className="px-5 py-3.5">Role</th>
                    <th className="px-5 py-3.5">Subject Category</th>
                    <th className="px-5 py-3.5">MFA Status</th>
                    <th className="px-5 py-3.5">Enrolled</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-slate-900">{u.name}</td>
                    <td className="px-5 py-3.5 font-mono text-slate-600">{u.email}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                          u.role === 'ADMIN'
                            ? 'bg-slate-100 text-slate-800 border border-slate-200'
                            : u.role === 'AUDITOR'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : u.role === 'MODERATOR'
                            ? 'bg-purple-50 text-purple-800 border border-purple-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {u.role === 'EXAMINER' || u.role === 'REVIEWER' ? (
                        <div className="flex flex-wrap items-center gap-1">
                          {u.userSubjectExpertise && u.userSubjectExpertise.length > 0 ? (
                            u.userSubjectExpertise.map((e) => (
                              <span
                                key={e.subjectId}
                                className="px-2 py-0.5 rounded-md font-mono text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-200"
                              >
                                {e.subject.code} — {e.subject.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">None assigned</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {u.mfaEnabled ? (
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-mono text-[11px] font-medium inline-flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-mono text-[11px] font-medium">
                          Enrolling at first login
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">{formatDate(u.createdAt)}</td>
                    <td className="px-5 py-3.5 text-right">
                      {(u.role === 'EXAMINER' || u.role === 'REVIEWER') && (
                        <button
                          type="button"
                          onClick={() => handleOpenSubjectModal(u)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:text-red-700 bg-slate-100 hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-lg transition-colors"
                        >
                          Assign Subjects
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Syllabus Tab */}
      {activeTab === 'syllabus' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Syllabus Taxonomy Tree</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={fetchSyllabus}
                disabled={syllabusLoading}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syllabusLoading ? 'animate-spin text-red-600' : ''}`} />
                <span>{syllabusLoading ? 'Refreshing...' : 'Refresh'}</span>
              </button>
              <button
                onClick={() => setShowAddExam(true)}
                className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-xs transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Add Exam</span>
              </button>
            </div>
          </div>

          {/* Add Exam Form */}
          {showAddExam && (
            <form onSubmit={handleCreateExam} className="bg-white rounded-xl p-4 border border-red-300 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">New Examination Program</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Exam Name (e.g., JEE Advanced 2026)"
                  value={newExamName}
                  onChange={(e) => setNewExamName(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-600"
                />
                <input
                  type="text"
                  placeholder="Description (Optional)"
                  value={newExamDesc}
                  onChange={(e) => setNewExamDesc(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-600"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddExam(false)}
                  className="px-3 py-1.5 rounded-lg text-xs bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button type="submit" className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white">
                  Save Exam
                </button>
              </div>
            </form>
          )}

          {/* Exam Hierarchy */}
          {syllabusLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs space-y-3">
              <div className="inline-flex p-3 rounded-full bg-red-50 text-red-600 mb-1">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Fetching Syllabus Taxonomy Tree...</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto font-mono">
                Loading hierarchical exam definitions, subjects, topics, and curriculum taxonomy
              </p>
            </div>
          ) : exams.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs space-y-3">
              <FolderTree className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">No Syllabus Trees Configured</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Get started by clicking &quot;Add Exam&quot; to configure your institution&apos;s curriculum taxonomy.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {exams.map((exam) => (
                <div key={exam.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2.5">
                    <FolderTree className="w-5 h-5 text-red-600" />
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{exam.name}</h3>
                      {exam.description && <p className="text-xs text-slate-500">{exam.description}</p>}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAddSubject(exam.id)}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-red-600" />
                    <span>Add Subject</span>
                  </button>
                </div>

                {/* Add Subject Modal */}
                {showAddSubject === exam.id && (
                  <form
                    onSubmit={(e) => handleCreateSubject(exam.id, e)}
                    className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        required
                        placeholder="Subject Name (e.g. Physics)"
                        value={newSubjectName}
                        onChange={(e) => setNewSubjectName(e.target.value)}
                        className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-red-600"
                      />
                      <input
                        type="text"
                        required
                        placeholder="Subject Code (e.g. PHY)"
                        value={newSubjectCode}
                        onChange={(e) => setNewSubjectCode(e.target.value)}
                        className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 uppercase font-mono focus:outline-none focus:ring-1 focus:ring-red-600"
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => setShowAddSubject(null)}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                      >
                        Cancel
                      </button>
                      <button type="submit" className="px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg">
                        Create Subject
                      </button>
                    </div>
                  </form>
                )}

                {/* Subjects Grid */}
                <div className="space-y-3">
                  {exam.subjects.map((sub) => (
                    <div key={sub.id} className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                            {sub.code}
                          </span>
                          <span className="font-bold text-slate-900 text-sm">{sub.name}</span>
                        </div>
                        <button
                          onClick={() => setShowAddTopic(sub.id)}
                          className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center space-x-1"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Add Topic</span>
                        </button>
                      </div>

                      {/* Add Topic form */}
                      {showAddTopic === sub.id && (
                        <form
                          onSubmit={(e) => handleCreateTopic(sub.id, e)}
                          className="flex items-center space-x-2 pt-1"
                        >
                          <input
                            type="text"
                            required
                            placeholder="Topic Name (e.g. Thermodynamics)"
                            value={newTopicName}
                            onChange={(e) => setNewTopicName(e.target.value)}
                            className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-red-600"
                          />
                          <button
                            type="button"
                            onClick={() => setShowAddTopic(null)}
                            className="px-2.5 py-1 text-xs text-slate-500"
                          >
                            Cancel
                          </button>
                          <button type="submit" className="px-3 py-1 text-xs font-semibold bg-red-600 text-white rounded-lg">
                            Add
                          </button>
                        </form>
                      )}

                      {/* Topics List */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                        {sub.topics.map((t) => (
                          <div key={t.id} className="p-3 rounded-lg bg-white border border-slate-200 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900">{t.name}</span>
                              <button
                                onClick={() => setShowAddSubtopic(t.id)}
                                className="text-[11px] text-red-600 hover:text-red-700 font-medium"
                              >
                                + Subtopic
                              </button>
                            </div>

                            {/* Add Subtopic Form */}
                            {showAddSubtopic === t.id && (
                              <form
                                onSubmit={(e) => handleCreateSubtopic(t.id, e)}
                                className="flex items-center space-x-2 mt-2"
                              >
                                <input
                                  type="text"
                                  required
                                  placeholder="Subtopic Name (e.g. Carnot Cycle)"
                                  value={newSubtopicName}
                                  onChange={(e) => setNewSubtopicName(e.target.value)}
                                  className="flex-1 px-2.5 py-1 bg-slate-50 border border-slate-300 rounded text-[11px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-red-600"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowAddSubtopic(null)}
                                  className="text-[10px] text-slate-500"
                                >
                                  Cancel
                                </button>
                                <button type="submit" className="px-2 py-1 text-[10px] font-semibold bg-red-600 text-white rounded">
                                  Add
                                </button>
                              </form>
                            )}

                            {/* Subtopics tags */}
                            {t.subtopics.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {t.subtopics.map((st) => (
                                  <span
                                    key={st.id}
                                    className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200"
                                  >
                                    {st.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {/* Question Bank & Workflow Governance Tab */}
      {activeTab === 'workflow' && (
        <div className="space-y-6">
          {/* Security Boundaries & Role Policy Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
            <div className="flex items-center space-x-3 mb-5 pb-4 border-b border-slate-100">
              <div className="p-2.5 rounded-xl bg-red-50 text-red-700 border border-red-200 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">
                    Administrative Governance & Cryptographic Separation of Duties
                  </h2>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-bold">
                    Protocol Invariant
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Administrative role controls workflow lifecycle and syllabus metadata while strictly constrained by zero-knowledge protocol invariants.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 hover:border-slate-300 transition-colors">
                <div className="flex items-center space-x-2 text-red-700 font-bold mb-1.5">
                  <EyeOff className="w-4 h-4 text-red-600" />
                  <span>Zero Content Exposure</span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  The admin <strong className="text-slate-900 font-semibold">cannot read</strong> question text, options, or answer keys. All stems and solutions are envelope-encrypted with AES-256-GCM. Attempting decryption returns HTTP 403.
                </p>
              </div>

              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 hover:border-slate-300 transition-colors">
                <div className="flex items-center space-x-2 text-slate-900 font-bold mb-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Immutable Append-Only Ledger</span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  The admin <strong className="text-slate-900 font-semibold">cannot edit or delete</strong> audit ledger rows. PostgreSQL triggers and Hyperledger Fabric block anchoring enforce append-only immutability.
                </p>
              </div>

              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 hover:border-slate-300 transition-colors">
                <div className="flex items-center space-x-2 text-slate-900 font-bold mb-1.5">
                  <Lock className="w-4 h-4 text-slate-700" />
                  <span>Multi-Party Consensus</span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  The admin <strong className="text-slate-900 font-semibold">cannot approve changes alone</strong>. Questions require double-blind independent review and cryptographic moderator signature verification.
                </p>
              </div>
            </div>
          </div>

          {/* Issue Tracer & Auditor Support Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div>
                <div className="flex items-center space-x-2">
                  <Search className="w-4 h-4 text-slate-700" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Auditor Support & Lifecycle Issue Tracer
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Answer the auditor's query <span className="font-semibold text-slate-700">"What is this ID?"</span> or trace users involved when an alert fires — without decrypting or exposing question content.
                </p>
              </div>

              <button
                onClick={fetchQuestions}
                disabled={questionsLoading}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-all self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${questionsLoading ? 'animate-spin text-red-600' : ''}`} />
                <span>Refresh Bank</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Enter Question Reference ID (#367a7254 or UUID) or Human ID (Q-102)..."
                  value={auditorLookupInput}
                  onChange={(e) => setAuditorLookupInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAuditorLookup()}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 font-mono"
                />
              </div>
              <button
                onClick={handleAuditorLookup}
                className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center justify-center space-x-1.5"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Trace & Support Auditor</span>
              </button>
            </div>

            {/* Quick selector pill buttons */}
            {questions.length > 0 && !auditorLookupResult && (
              <div className="flex items-center flex-wrap gap-1.5 text-xs text-slate-500">
                <span className="text-[11px] font-medium text-slate-400">Quick trace examples:</span>
                {questions.slice(0, 4).map((q) => (
                  <button
                    key={q.id}
                    onClick={() => {
                      setAuditorLookupInput(`#${q.id.slice(0, 8)}`);
                      const clean = q.id.slice(0, 8).toLowerCase();
                      const match = questions.find((item) => item.id.toLowerCase().includes(clean));
                      setAuditorLookupResult(match || 'NOT_FOUND');
                    }}
                    className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors"
                  >
                    #{q.id.slice(0, 8)} ({q.humanId || 'Q'})
                  </button>
                ))}
              </div>
            )}

            {/* Auditor Support Dossier Response */}
            {auditorLookupResult && auditorLookupResult !== 'NOT_FOUND' && (
              <div className="mt-4 p-4 rounded-xl bg-slate-50/80 border border-slate-200 animate-in fade-in duration-200">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-900 text-white font-mono">
                      Ref #{auditorLookupResult.id.slice(0, 8)}
                    </span>
                    <span className="text-xs font-semibold text-slate-800">
                      Human ID: {auditorLookupResult.humanId || 'Unassigned'}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        auditorLookupResult.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : auditorLookupResult.status === 'IN_REVIEW'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : auditorLookupResult.status === 'SUBMITTED'
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : 'bg-slate-100 text-slate-800 border border-slate-300'
                      }`}
                    >
                      {auditorLookupResult.status}
                    </span>
                    {auditorLookupResult.isLocked && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300">
                        Workflow Locked
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setAuditorLookupResult(null)}
                    className="text-slate-400 hover:text-slate-600 text-xs"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Author / Submitter</span>
                    <span className="font-semibold text-slate-800">{auditorLookupResult.authorName || 'Examiner'}</span>
                    <span className="block text-[10px] font-mono text-slate-400 truncate">
                      ID: {auditorLookupResult.authorId?.slice(0, 12)}...
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Subject & Syllabus</span>
                    <span className="font-semibold text-slate-800">
                      {auditorLookupResult.subjectCode || 'EXAM'} - {auditorLookupResult.subjectName || 'General'}
                    </span>
                    <span className="block text-[10px] text-slate-500 truncate">
                      Topic: {auditorLookupResult.topicName || 'Core Topic'}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Version & Timestamp</span>
                    <span className="font-semibold text-slate-800">Version {auditorLookupResult.currentVersion}</span>
                    <span className="block text-[10px] text-slate-500">
                      Updated: {formatDate(auditorLookupResult.updatedAt || auditorLookupResult.createdAt)}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Content Isolation</span>
                    <span className="flex items-center space-x-1 text-emerald-700 font-semibold">
                      <Lock className="w-3 h-3" />
                      <span>AES-256 Sealed</span>
                    </span>
                    <span className="block text-[10px] text-slate-400">Zero Content Leakage</span>
                  </div>
                </div>

                {/* Ready-to-use Auditor Support Memo */}
                <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs">
                  <span className="text-[10px] uppercase font-bold tracking-wide text-slate-400 block mb-1">
                    Auditor Support Verification Memo (Safe to copy & provide):
                  </span>
                  <p className="font-mono text-slate-700 text-[11px] leading-relaxed bg-slate-50 p-2 rounded border border-slate-200">
                    "Question Reference ID <strong className="text-slate-900">#{auditorLookupResult.id.slice(0, 8)}</strong> (UUID: {auditorLookupResult.id}) corresponds to institutional question label <strong className="text-slate-900">{auditorLookupResult.humanId || 'N/A'}</strong>, authored by {auditorLookupResult.authorName} under subject {auditorLookupResult.subjectCode}. Current state is {auditorLookupResult.status} (v{auditorLookupResult.currentVersion}). Workflow is {auditorLookupResult.isLocked ? 'SUSPENDED/LOCKED' : 'ACTIVE'}. Ciphertext is cryptographically envelope-sealed."
                  </p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px]">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleToggleLock(auditorLookupResult.id, Boolean(auditorLookupResult.isLocked))}
                        className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center space-x-1 transition-colors ${
                          auditorLookupResult.isLocked
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-rose-600 text-white hover:bg-rose-700'
                        }`}
                      >
                        {auditorLookupResult.isLocked ? (
                          <>
                            <Unlock className="w-3.5 h-3.5" />
                            <span>Unlock Workflow</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5" />
                            <span>Lock / Suspend Workflow</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setAssignModalQuestion(auditorLookupResult);
                        }}
                        className="px-2.5 py-1 rounded text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors flex items-center space-x-1"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Manage / Assign Reviewer</span>
                      </button>
                    </div>
                    <span className="text-slate-400">
                      Full UUID: <code className="font-mono text-[10px] text-slate-600">{auditorLookupResult.id}</code>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {auditorLookupResult === 'NOT_FOUND' && (
              <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>
                    No question found matching ID: <code className="font-mono font-bold">{auditorLookupInput}</code>. Ensure the reference snippet or full UUID is correct.
                  </span>
                </div>
                <button
                  onClick={() => setAuditorLookupResult(null)}
                  className="text-amber-600 hover:text-amber-800 font-semibold"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>

          {/* Question Bank Directory & Governance Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Question Bank Lifecycle & Governance Directory
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Manage workflow states, assign independent reviewers, and lock questions involved in complaints or audit flags.
                </p>
              </div>

              {/* Status filter buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                {['ALL', 'DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setWorkflowStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      workflowStatusFilter === st
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Search */}
            <div className="px-6 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
              <div className="relative w-full max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by Ref ID, Human ID, or Author..."
                  value={questionSearch}
                  onChange={(e) => setQuestionSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                />
              </div>
              <span className="text-xs text-slate-500">
                Total Loaded: <strong className="text-slate-800">{questions.length}</strong> questions
              </span>
            </div>

            {/* Table */}
            {questionsLoading ? (
              <div className="p-12 flex flex-col items-center justify-center space-y-3">
                <div className="inline-flex p-3 rounded-full bg-red-50 text-red-600 mb-1">
                  <Loader2 className="w-7 h-7 animate-spin" />
                </div>
                <p className="text-xs text-slate-500 font-mono">Loading question repository metadata...</p>
              </div>
            ) : questions.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                No questions found in repository.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Ref ID / Human ID</th>
                      <th className="py-3 px-4">Author</th>
                      <th className="py-3 px-4">Subject & Topic</th>
                      <th className="py-3 px-4">Version</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Workflow Lock</th>
                      <th className="py-3 px-4 text-right">Governance Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {questions
                      .filter((q) => {
                        if (workflowStatusFilter !== 'ALL' && q.status !== workflowStatusFilter) {
                          return false;
                        }
                        if (!questionSearch.trim()) return true;
                        const s = questionSearch.toLowerCase().replace(/^#/, '');
                        return (
                          q.id.toLowerCase().includes(s) ||
                          (q.humanId && q.humanId.toLowerCase().includes(s)) ||
                          (q.authorName && q.authorName.toLowerCase().includes(s)) ||
                          (q.subjectCode && q.subjectCode.toLowerCase().includes(s))
                        );
                      })
                      .map((q) => {
                        const isLocked = Boolean(q.isLocked);
                        return (
                          <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-mono">
                              <div className="flex items-center space-x-2">
                                <span
                                  onClick={() => {
                                    setAuditorLookupInput(`#${q.id.slice(0, 8)}`);
                                    setAuditorLookupResult(q);
                                  }}
                                  className="cursor-pointer text-slate-800 hover:text-black bg-slate-100 hover:bg-slate-200 border border-slate-200 px-1.5 py-0.5 rounded font-bold text-[11px]"
                                  title={`Full UUID: ${q.id} — Click to trace & support auditor`}
                                >
                                  #{q.id.slice(0, 8)}
                                </span>
                                <span className="font-semibold text-slate-800 font-sans">
                                  {q.humanId || 'Q-N/A'}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-700">
                              {q.authorName || 'Examiner'}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              <div className="font-medium text-slate-800">
                                {q.subjectCode || 'EXAM'} - {q.subjectName || 'General'}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {q.topicName || 'Topic General'}
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-600">
                              v{q.currentVersion}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                  q.status === 'APPROVED'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : q.status === 'IN_REVIEW'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                    : q.status === 'SUBMITTED'
                                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                    : 'bg-slate-100 text-slate-800 border border-slate-300'
                                }`}
                              >
                                {q.status}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {isLocked ? (
                                <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                                  <Lock className="w-2.5 h-2.5" />
                                  <span>SUSPENDED</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <Unlock className="w-2.5 h-2.5" />
                                  <span>ACTIVE</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end space-x-1.5">
                                <button
                                  onClick={() => {
                                    setAuditorLookupInput(`#${q.id.slice(0, 8)}`);
                                    setAuditorLookupResult(q);
                                  }}
                                  className="px-2 py-1 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors"
                                  title="Trace users and formulate answer for auditor"
                                >
                                  Trace / Support
                                </button>
                                <button
                                  onClick={() => setAssignModalQuestion(q)}
                                  className="px-2 py-1 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors"
                                  title="Assign reviewer to question"
                                >
                                  Assign Reviewer
                                </button>
                                <button
                                  onClick={() => handleToggleLock(q.id, Boolean(q.isLocked))}
                                  className={`p-1 rounded text-xs transition-colors ${
                                    isLocked
                                      ? 'text-emerald-700 hover:bg-emerald-50'
                                      : 'text-rose-600 hover:bg-rose-50'
                                  }`}
                                  title={isLocked ? 'Unlock workflow' : 'Lock / Suspend workflow'}
                                >
                                  {isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Assign Reviewer Modal */}
          {assignModalQuestion && (
            <ModalPortal>
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4 animate-in zoom-in-95 duration-150">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Assign Reviewer to Question
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Manage workflow assignment for Ref #{assignModalQuestion.id.slice(0, 8)} ({assignModalQuestion.humanId || 'Q'})
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setAssignModalQuestion(null);
                      setSelectedReviewerId('');
                    }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subject:</span>
                    <span className="font-semibold text-slate-800">{assignModalQuestion.subjectCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Author:</span>
                    <span className="font-semibold text-slate-800">{assignModalQuestion.authorName || 'Examiner'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status:</span>
                    <span className="font-semibold text-slate-800">{assignModalQuestion.status}</span>
                  </div>
                  {assignModalQuestion.isLocked && (
                    <div className="flex justify-between text-rose-600 font-bold">
                      <span>Workflow:</span>
                      <span>SUSPENDED / LOCKED</span>
                    </div>
                  )}
                </div>

                {assignModalQuestion.isLocked ? (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-800 leading-relaxed font-semibold">
                    ⚠️ Cannot assign reviewers: This question is currently LOCKED / SUSPENDED. Unlock the workflow first before assigning reviewers.
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 leading-relaxed">
                    <strong>Blind-Solve Protocol:</strong> Once assigned, this question appears immediately in the reviewer's portal. The reviewer cannot see the answer key until completing Phase 1.
                  </div>
                )}

                <form onSubmit={handleAssignReviewer} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Select Qualified Reviewer
                    </label>
                    <select
                      value={selectedReviewerId}
                      onChange={(e) => setSelectedReviewerId(e.target.value)}
                      required
                      disabled={Boolean(assignModalQuestion.isLocked)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white disabled:bg-slate-100 disabled:opacity-60"
                    >
                      <option value="">-- Choose Reviewer from Directory --</option>
                      {users
                        .filter((u) => u.role === 'REVIEWER' || u.role === 'MODERATOR')
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.email}) — [{u.role}]
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAssignModalQuestion(null);
                        setSelectedReviewerId('');
                      }}
                      className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!selectedReviewerId || Boolean(assignModalQuestion.isLocked)}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-all"
                    >
                      Confirm Assignment
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </ModalPortal>
          )}
        </div>
      )}
    </div>
  );
};
