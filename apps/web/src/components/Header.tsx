import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, LogOut, FileText, PlusCircle, UploadCloud, BarChart3, Users, BookOpen, KeyRound } from 'lucide-react';

interface HeaderProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, onSelectTab }) => {
  const { user, logout } = useAuth();

  if (!user) return null;

  const role = user.role;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-[#090d16]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo and Brand */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onSelectTab('dashboard')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-glow-sm">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg tracking-tight text-white">ExamVault</span>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                Encrypted
              </span>
            </div>
            <p className="text-xs text-text-muted">Research Prototype • Step 1</p>
          </div>
        </div>

        {/* Navigation Tabs based on Role */}
        <nav className="hidden md:flex items-center space-x-1">
          {role === 'EXAMINER' && (
            <>
              <button
                onClick={() => onSelectTab('dashboard')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentTab === 'dashboard'
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'text-text-secondary hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>My Questions</span>
              </button>
              <button
                onClick={() => onSelectTab('editor')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentTab === 'editor'
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'text-text-secondary hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>New Question</span>
              </button>
              <button
                onClick={() => onSelectTab('import')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentTab === 'import'
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'text-text-secondary hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <UploadCloud className="w-4 h-4" />
                <span>CSV Import</span>
              </button>
            </>
          )}

          {role === 'ADMIN' && (
            <>
              <button
                onClick={() => onSelectTab('admin-users')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentTab === 'admin-users'
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'text-text-secondary hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Users</span>
              </button>
              <button
                onClick={() => onSelectTab('admin-syllabus')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentTab === 'admin-syllabus'
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'text-text-secondary hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Syllabus</span>
              </button>
              <button
                onClick={() => onSelectTab('audit')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentTab === 'audit'
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'text-text-secondary hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Audit Chain</span>
              </button>
            </>
          )}

          {role === 'AUDITOR' && (
            <button
              onClick={() => onSelectTab('audit')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentTab === 'audit'
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                  : 'text-text-secondary hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Audit Chain</span>
            </button>
          )}

          <button
            onClick={() => onSelectTab('stats')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentTab === 'stats'
                ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                : 'text-text-secondary hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Bank Statistics</span>
          </button>
        </nav>

        {/* User Badge and Actions */}
        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-sm font-semibold text-white leading-tight">{user.name}</span>
            <div className="flex items-center justify-end space-x-1.5 mt-0.5">
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                  role === 'ADMIN'
                    ? 'bg-purple-950 text-purple-300 border border-purple-800'
                    : role === 'AUDITOR'
                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                }`}
              >
                {role}
              </span>
              <span className="flex items-center text-[10px] text-cyan-400 font-mono">
                <KeyRound className="w-2.5 h-2.5 mr-0.5" />
                MFA
              </span>
            </div>
          </div>

          <button
            onClick={() => logout()}
            title="Sign out"
            className="p-2 rounded-lg text-text-secondary hover:text-rose-400 hover:bg-rose-950/20 border border-transparent hover:border-rose-900/40 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
