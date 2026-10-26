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
import { VersionHistoryModal } from './components/VersionHistoryModal';
import { Shield, Lock } from 'lucide-react';

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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090d16] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 p-0.5 animate-pulse">
          <div className="w-full h-full bg-[#090d16] rounded-2xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-cyan-400" />
          </div>
        </div>
        <p className="text-sm text-text-secondary font-mono tracking-wide">Initializing secure session...</p>
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
      : currentTab;

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col">
      <Header currentTab={resolvedTab} onSelectTab={setCurrentTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

        {/* Admin Tabs */}
        {resolvedTab === 'admin-users' && <AdminPage initialSubTab="users" />}
        {resolvedTab === 'admin-syllabus' && <AdminPage initialSubTab="syllabus" />}

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

      {/* Footer */}
      <footer className="border-t border-border/80 bg-[#070b12] py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-text-muted gap-2">
          <div className="flex items-center space-x-2">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>End-to-End Envelope Encryption (AES-256-GCM + Ed25519)</span>
          </div>
          <div>
            <span>ExamVault Research Prototype • Step 1: Question Bank</span>
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
