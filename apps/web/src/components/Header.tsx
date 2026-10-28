import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, LogOut, FileText, PlusCircle, UploadCloud, BarChart3, Users, BookOpen, KeyRound, Layers } from 'lucide-react';

interface HeaderProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, onSelectTab }) => {
  const { user, logout } = useAuth();

  if (!user) return null;

  const role = user.role;

  const getNavButtonClass = (tabKey: string) => {
    const isActive = currentTab === tabKey;
    return `flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
      isActive
        ? 'bg-slate-900 text-white shadow-sm'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    }`;
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-xs">
      <div className="w-full px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo and Brand */}
        <div
          className="flex items-center space-x-3 cursor-pointer group"
          onClick={() => onSelectTab('dashboard')}
        >
          <img
            src="/logo.png"
            alt="ExamVault Logo"
            className="h-9 sm:h-10 w-auto object-contain transition-transform group-hover:scale-[1.03]"
          />
          <div className="hidden lg:flex items-center space-x-2 border-l border-slate-200 pl-3">
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-semibold tracking-wider">
              Cryptographic Core
            </span>
          </div>
        </div>

        {/* Navigation Tabs based on Role */}
        <nav className="hidden md:flex items-center space-x-1">
          {role === 'EXAMINER' && (
            <>
              <button
                onClick={() => onSelectTab('dashboard')}
                className={getNavButtonClass('dashboard')}
              >
                <FileText className="w-4 h-4" />
                <span>My Questions</span>
              </button>
              <button
                onClick={() => onSelectTab('editor')}
                className={getNavButtonClass('editor')}
              >
                <PlusCircle className="w-4 h-4" />
                <span>New Question</span>
              </button>
              <button
                onClick={() => onSelectTab('import')}
                className={getNavButtonClass('import')}
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
                className={getNavButtonClass('admin-users')}
              >
                <Users className="w-4 h-4" />
                <span>User Directory</span>
              </button>
              <button
                onClick={() => onSelectTab('admin-workflow')}
                className={getNavButtonClass('admin-workflow')}
              >
                <Layers className="w-4 h-4" />
                <span>Workflow & Support</span>
              </button>
              <button
                onClick={() => onSelectTab('admin-syllabus')}
                className={getNavButtonClass('admin-syllabus')}
              >
                <BookOpen className="w-4 h-4" />
                <span>Syllabus Structure</span>
              </button>
              <button
                onClick={() => onSelectTab('admin-policies')}
                className={getNavButtonClass('admin-policies')}
              >
                <Shield className="w-4 h-4" />
                <span>Policies & Corpus</span>
              </button>
              <button
                onClick={() => onSelectTab('audit')}
                className={getNavButtonClass('audit')}
              >
                <Shield className="w-4 h-4" />
                <span>Audit Chain</span>
              </button>
            </>
          )}

          {(role === 'REVIEWER' || role === 'MODERATOR') && (
            <button
              onClick={() => onSelectTab('review-queue')}
              className={getNavButtonClass('review-queue')}
            >
              <FileText className="w-4 h-4" />
              <span>Review Workspace</span>
            </button>
          )}

          {role === 'MODERATOR' && (
            <button
              onClick={() => onSelectTab('moderator-console')}
              className={getNavButtonClass('moderator-console')}
            >
              <Shield className="w-4 h-4" />
              <span>Moderator Console</span>
            </button>
          )}

          {role === 'AUDITOR' && (
            <button
              onClick={() => onSelectTab('audit')}
              className={getNavButtonClass('audit')}
            >
              <Shield className="w-4 h-4" />
              <span>Cryptographic Audit Chain</span>
            </button>
          )}

          <button
            onClick={() => onSelectTab('stats')}
            className={getNavButtonClass('stats')}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Bank Metrics</span>
          </button>
        </nav>

        {/* User Badge and Actions */}
        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-sm font-semibold text-slate-900 leading-tight">{user.name}</span>
            <div className="flex items-center justify-end space-x-1.5 mt-0.5">
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                  role === 'ADMIN'
                    ? 'bg-slate-100 text-slate-800 border border-slate-200'
                    : role === 'AUDITOR'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {role}
              </span>
              <span className="flex items-center text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-mono font-medium">
                <KeyRound className="w-2.5 h-2.5 mr-1" />
                MFA Verified
              </span>
            </div>
          </div>

          <button
            onClick={() => logout()}
            title="Sign out"
            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
