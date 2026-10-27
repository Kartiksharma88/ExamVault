import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { LoginPage } from './pages/LoginPage';
import { ExaminerDashboard } from './pages/ExaminerDashboard';
import { QuestionEditorPage } from './pages/QuestionEditorPage';
import { AdminPage } from './pages/AdminPage';
import { AuditorPage } from './pages/AuditorPage';
import { ImportPage } from './pages/ImportPage';
import { StatsPage } from './pages/StatsPage';
import { ReviewerWorkspace } from './pages/ReviewerWorkspace';
import { ModeratorConsole } from './pages/ModeratorConsole';
import { AdminPoliciesPage } from './pages/AdminPoliciesPage';
import { VersionHistoryModal } from './components/VersionHistoryModal';
import { AuthorFeedbackModal } from './components/AuthorFeedbackModal';
import { Lock } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const MainLayout: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [historyQuestionId, setHistoryQuestionId] = useState<string | null>(null);
  const [feedbackQuestionId, setFeedbackQuestionId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center space-y-4">
        <div className="animate-pulse">
          <img src="/logo.png" alt="ExamVault Logo" className="h-16 w-auto object-contain" />
        </div>
        <p className="text-sm text-slate-500 font-mono tracking-wide">Initializing secure cryptographic session...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  // Adjust default tab based on user role
  const resolvedTab =
    user.role === 'ADMIN' && currentTab === 'dashboard'
      ? 'admin-users'
      : user.role === 'AUDITOR' && currentTab === 'dashboard'
      ? 'audit'
      : user.role === 'REVIEWER' && currentTab === 'dashboard'
      ? 'review-queue'
      : user.role === 'MODERATOR' && currentTab === 'dashboard'
      ? 'moderator-console'
      : currentTab;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col selection:bg-red-600 selection:text-white">
      <Header currentTab={resolvedTab} onSelectTab={setCurrentTab} />

      <main className="flex-1 w-full px-4 sm:px-6 py-6">
        {/* Examiner Tabs */}
        {resolvedTab === 'dashboard' && (
          <ExaminerDashboard
            onEditQuestion={(id) => {
              setEditingQuestionId(id);
              setCurrentTab('editor');
            }}
            onCreateNew={() => {
              setEditingQuestionId(null);
              setCurrentTab('editor');
            }}
            onViewHistory={(id) => setHistoryQuestionId(id)}
            onViewFeedback={(id) => setFeedbackQuestionId(id)}
          />
        )}

        {resolvedTab === 'editor' && (
          <QuestionEditorPage
            questionId={editingQuestionId}
            onBack={() => {
              setEditingQuestionId(null);
              setCurrentTab('dashboard');
            }}
            onSaved={() => {
              setEditingQuestionId(null);
              setCurrentTab('dashboard');
            }}
          />
        )}

        {resolvedTab === 'import' && (
          <ImportPage onSuccess={() => setCurrentTab('dashboard')} />
        )}

        {/* Reviewer Workspace */}
        {resolvedTab === 'review-queue' && <ReviewerWorkspace />}

        {/* Moderator Console */}
        {resolvedTab === 'moderator-console' && <ModeratorConsole />}

        {/* Admin Tabs */}
        {resolvedTab === 'admin-users' && <AdminPage initialSubTab="users" />}
        {resolvedTab === 'admin-syllabus' && <AdminPage initialSubTab="syllabus" />}
        {resolvedTab === 'admin-policies' && <AdminPoliciesPage />}

        {/* Auditor Tab */}
        {resolvedTab === 'audit' && <AuditorPage />}

        {/* Global Statistics Tab */}
        {resolvedTab === 'stats' && <StatsPage />}
      </main>

      {/* Version History Modal */}
      {historyQuestionId && (
        <VersionHistoryModal
          questionId={historyQuestionId}
          onClose={() => setHistoryQuestionId(null)}
        />
      )}

      {/* Author Feedback Modal */}
      {feedbackQuestionId && (
        <AuthorFeedbackModal
          questionId={feedbackQuestionId}
          onClose={() => setFeedbackQuestionId(null)}
          onCreateNewVersion={(id) => {
            setFeedbackQuestionId(null);
            setEditingQuestionId(id);
            setCurrentTab('editor');
          }}
        />
      )}

      {/* Institutional Enterprise Footer */}
      <footer className="border-t border-slate-200 bg-white py-5 mt-auto">
        <div className="w-full px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
          <div className="flex items-center space-x-2">
            <span className="flex items-center text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-mono font-medium">
              <Lock className="w-3 h-3 mr-1" />
              AES-256-GCM + Ed25519
            </span>
            <span>Zero-Knowledge Envelope Encryption & Tamper-Evident Ledger</span>
          </div>
          <div className="flex items-center space-x-2">
            <img src="/logo.png" alt="ExamVault" className="h-4 w-auto object-contain" />
            <span>• Cryptographic Question Bank Core</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MainLayout />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
