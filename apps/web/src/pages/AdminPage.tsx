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

export const AdminPage: React.FC<{ initialSubTab?: 'users' | 'syllabus' }> = ({
  initialSubTab = 'users',
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'syllabus'>(initialSubTab);

  // Users state
  const [users, setUsers] = useState<UserItem[]>([]);
  const [, setUsersLoading] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'EXAMINER' | 'ADMIN' | 'REVIEWER' | 'AUDITOR'>('EXAMINER');
  const [newPassword, setNewPassword] = useState('Password123!@#$');
  const [userMsg, setUserMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Syllabus state
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [, setSyllabusLoading] = useState(true);
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
    fetchUsers();
    fetchSyllabus();
  }, []);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
            <span>Administration & Governance</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800">
              Admin Role
            </span>
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage institutional users, roles, and syllabus trees. (Admin has zero access to question ciphertexts).
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-slate-900 p-1 rounded-xl border border-border">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'users' ? 'bg-blue-600 text-white' : 'text-text-secondary hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Users & Access</span>
          </button>
          <button
            onClick={() => setActiveTab('syllabus')}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'syllabus' ? 'bg-blue-600 text-white' : 'text-text-secondary hover:text-white'
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
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/40 border-rose-800 text-rose-300'
          }`}
        >
          {userMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span>{userMsg.text}</span>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">System Users & Roles</h2>
            <button
              onClick={() => setShowCreateUser(true)}
              className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-glow-sm transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>Enroll New User</span>
            </button>
          </div>

          {/* Create User Modal */}
          {showCreateUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="glass-card rounded-2xl w-full max-w-md p-6 border border-border shadow-2xl">
                <h3 className="text-base font-semibold text-white mb-4">Enroll New User</h3>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Prof. Jane Doe"
                      className="w-full px-3 py-2 bg-slate-900 border border-border rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="jane.doe@examvault.local"
                      className="w-full px-3 py-2 bg-slate-900 border border-border rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Role *</label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-900 border border-border rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="EXAMINER">EXAMINER (Author questions)</option>
                      <option value="ADMIN">ADMIN (Manage syllabus & users)</option>
                      <option value="AUDITOR">AUDITOR (Read audit chain)</option>
                      <option value="REVIEWER">REVIEWER (Review questions)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      Temporary Password (Min 12 chars) *
                    </label>
                    <input
                      type="text"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-border rounded-xl text-sm text-cyan-300 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <p className="text-[11px] text-text-muted mt-1">
                      Must contain uppercase, lowercase, digit, and special symbol.
                    </p>
                  </div>

                  <div className="flex justify-end space-x-2 pt-3 border-t border-border">
                    <button
                      type="button"
                      onClick={() => setShowCreateUser(false)}
                      className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 text-text-secondary hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white"
                    >
                      Create User
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* User List Table */}
          <div className="glass-card rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 border-b border-border text-text-secondary uppercase">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">MFA Status</th>
                  <th className="px-5 py-3">Enrolled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-900/40">
                    <td className="px-5 py-3 font-medium text-white">{u.name}</td>
                    <td className="px-5 py-3 font-mono text-text-secondary">{u.email}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                          u.role === 'ADMIN'
                            ? 'bg-purple-950 text-purple-300 border border-purple-800'
                            : u.role === 'AUDITOR'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {u.mfaEnabled ? (
                        <span className="text-emerald-400 font-mono flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="text-amber-400 font-mono">Enrolling at first login</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-text-muted">{formatDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Syllabus Tab */}
      {activeTab === 'syllabus' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Syllabus Taxonomy Tree</h2>
            <button
              onClick={() => setShowAddExam(true)}
              className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-glow-sm transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Exam</span>
            </button>
          </div>

          {/* Add Exam Form */}
          {showAddExam && (
            <form onSubmit={handleCreateExam} className="glass-card rounded-xl p-4 border border-blue-500/40 space-y-3">
              <h3 className="text-xs font-semibold text-white uppercase">New Examination Program</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Exam Name (e.g., JEE Advanced 2026)"
                  value={newExamName}
                  onChange={(e) => setNewExamName(e.target.value)}
                  className="px-3 py-2 bg-slate-900 border border-border rounded-lg text-xs text-white"
                />
                <input
                  type="text"
                  placeholder="Description (Optional)"
                  value={newExamDesc}
                  onChange={(e) => setNewExamDesc(e.target.value)}
                  className="px-3 py-2 bg-slate-900 border border-border rounded-lg text-xs text-white"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddExam(false)}
                  className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 text-text-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="px-3 py-1.5 rounded-lg text-xs bg-blue-600 text-white">
                  Save Exam
                </button>
              </div>
            </form>
          )}

          {/* Exam Hierarchy */}
          <div className="space-y-4">
            {exams.map((exam) => (
              <div key={exam.id} className="glass-card rounded-2xl p-5 border border-border space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center space-x-2">
                    <FolderTree className="w-5 h-5 text-cyan-400" />
                    <div>
                      <h3 className="font-bold text-white text-base">{exam.name}</h3>
                      {exam.description && <p className="text-xs text-text-muted">{exam.description}</p>}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAddSubject(exam.id)}
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-border"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Add Subject</span>
                  </button>
                </div>

                {/* Add Subject Modal */}
                {showAddSubject === exam.id && (
                  <form
                    onSubmit={(e) => handleCreateSubject(exam.id, e)}
                    className="p-3 bg-slate-900/90 rounded-xl border border-border space-y-2"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Subject Name (e.g. Physics)"
                        value={newSubjectName}
                        onChange={(e) => setNewSubjectName(e.target.value)}
                        className="px-3 py-1.5 bg-slate-950 border border-border rounded-lg text-xs text-white"
                      />
                      <input
                        type="text"
                        required
                        placeholder="Subject Code (e.g. PHY)"
                        value={newSubjectCode}
                        onChange={(e) => setNewSubjectCode(e.target.value)}
                        className="px-3 py-1.5 bg-slate-950 border border-border rounded-lg text-xs text-white uppercase font-mono"
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => setShowAddSubject(null)}
                        className="px-2.5 py-1 text-xs text-text-muted"
                      >
                        Cancel
                      </button>
                      <button type="submit" className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg">
                        Create Subject
                      </button>
                    </div>
                  </form>
                )}

                {/* Subjects Grid */}
                <div className="space-y-3">
                  {exam.subjects.map((sub) => (
                    <div key={sub.id} className="p-4 rounded-xl bg-slate-900/60 border border-border space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                            {sub.code}
                          </span>
                          <span className="font-semibold text-white text-sm">{sub.name}</span>
                        </div>
                        <button
                          onClick={() => setShowAddTopic(sub.id)}
                          className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
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
                            className="flex-1 px-3 py-1.5 bg-slate-950 border border-border rounded-lg text-xs text-white"
                          />
                          <button
                            type="button"
                            onClick={() => setShowAddTopic(null)}
                            className="px-2 py-1 text-xs text-text-muted"
                          >
                            Cancel
                          </button>
                          <button type="submit" className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg">
                            Add
                          </button>
                        </form>
                      )}

                      {/* Topics List */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                        {sub.topics.map((t) => (
                          <div key={t.id} className="p-2.5 rounded-lg bg-slate-950/80 border border-border/80">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-cyan-300">{t.name}</span>
                              <button
                                onClick={() => setShowAddSubtopic(t.id)}
                                className="text-[11px] text-text-muted hover:text-white"
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
                                  className="flex-1 px-2 py-1 bg-slate-900 border border-border rounded text-[11px] text-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowAddSubtopic(null)}
                                  className="text-[10px] text-text-muted"
                                >
                                  Cancel
                                </button>
                                <button type="submit" className="px-2 py-1 text-[10px] bg-blue-600 text-white rounded">
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
                                    className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-text-muted border border-border"
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
        </div>
      )}
    </div>
  );
};
