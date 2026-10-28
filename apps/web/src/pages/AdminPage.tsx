import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api-client';
import { formatDate } from '../lib/utils';
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
} from 'lucide-react';

interface UserItem {
  id: string;
  email: string;
  name: string;
  role: string;
  mfaEnabled: boolean;
  createdAt: string;
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
  initialSubTab?: 'users' | 'syllabus';
  activeSubTab?: 'users' | 'syllabus';
  onSubTabChange?: (tab: 'users' | 'syllabus') => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({
  initialSubTab = 'users',
  activeSubTab,
  onSubTabChange,
}) => {
  const [internalTab, setInternalTab] = useState<'users' | 'syllabus'>(activeSubTab || initialSubTab);
  const activeTab = activeSubTab || internalTab;

  const handleSelectTab = (tab: 'users' | 'syllabus') => {
    setInternalTab(tab);
    onSubTabChange?.(tab);
  };

  // Users state
  const [users, setUsers] = useState<UserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'EXAMINER' | 'ADMIN' | 'REVIEWER' | 'AUDITOR'>('EXAMINER');
  const [newPassword, setNewPassword] = useState('Password123!@#$');
  const [userMsg, setUserMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  // Fetch users
  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await apiRequest<{ success: boolean; data: UserItem[] }>('/users');
      setUsers(res.data || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setUsersLoading(false);
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

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else {
      fetchSyllabus();
    }
  }, [activeTab]);

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
        }),
      });

      setUserMsg({ type: 'success', text: `User ${newEmail} created successfully.` });
      setNewEmail('');
      setNewName('');
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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
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
                    <th className="px-5 py-3.5">MFA Status</th>
                    <th className="px-5 py-3.5">Enrolled</th>
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
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {u.role}
                      </span>
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
    </div>
  );
};
