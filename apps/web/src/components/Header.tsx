import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  LogOut,
  FileText,
  PlusCircle,
  UploadCloud,
  BarChart3,
  Users,
  BookOpen,
  KeyRound,
  Layers,
  ChevronDown,
  Workflow,
  Lock,
} from 'lucide-react';

interface HeaderProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, onSelectTab }) => {
  const { user, logout } = useAuth();
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const adminMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(event.target as Node)) {
        setAdminMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const role = user.role;

  const getNavButtonClass = (tabKey: string) => {
    const isActive = currentTab === tabKey;
    return `flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
      isActive
        ? 'bg-slate-900 text-white shadow-xs'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    }`;
  };

  const isAdminTabActive = ['admin-users', 'admin-syllabus', 'admin-workflow'].includes(currentTab);

  const handleBrandClick = () => {
    if (role === 'ADMIN') onSelectTab('admin-generation');
    else if (role === 'CUSTODIAN') onSelectTab('custodian-portal');
    else if (role === 'AUDITOR') onSelectTab('audit');
    else if (role === 'REVIEWER') onSelectTab('review-queue');
    else if (role === 'MODERATOR') onSelectTab('moderator-console');
    else onSelectTab('dashboard');
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-xs">
      <div className="w-full px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo and Brand */}
        <div
          className="flex items-center space-x-3 cursor-pointer group shrink-0"
          onClick={handleBrandClick}
        >
          <img
            src="/logo.png"
            alt="ExamVault Logo"
            className="h-8 sm:h-9 w-auto object-contain transition-transform group-hover:scale-[1.02]"
          />
          <div className="hidden xl:flex items-center space-x-2 border-l border-slate-200 pl-3">
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-semibold tracking-wider">
              Cryptographic Core
            </span>
          </div>
        </div>

        {/* Navigation Tabs based on Role */}
        <nav className="hidden md:flex items-center space-x-1 lg:space-x-1.5 overflow-visible py-1">
          {role === 'EXAMINER' && (
            <>
              <button
                onClick={() => onSelectTab('dashboard')}
                className={getNavButtonClass('dashboard')}
              >
                <FileText className="w-3.5 h-3.5 text-red-500" />
                <span>My Questions</span>
              </button>
              <button
                onClick={() => onSelectTab('editor')}
                className={getNavButtonClass('editor')}
              >
                <PlusCircle className="w-3.5 h-3.5 text-red-500" />
                <span>New Question</span>
              </button>
              <button
                onClick={() => onSelectTab('import')}
                className={getNavButtonClass('import')}
              >
                <UploadCloud className="w-3.5 h-3.5 text-red-500" />
                <span>CSV Import</span>
              </button>
            </>
          )}

          {role === 'ADMIN' && (
            <>
              <button
                onClick={() => onSelectTab('admin-generation')}
                className={getNavButtonClass('admin-generation')}
              >
                <Layers className="w-3.5 h-3.5 text-red-500" />
                <span>Paper Generation</span>
              </button>

              {/* Administration Dropdown Menu */}
              <div
                className="relative"
                ref={adminMenuRef}
                onMouseEnter={() => setAdminMenuOpen(true)}
                onMouseLeave={() => setAdminMenuOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectTab('admin-users');
                    setAdminMenuOpen((prev) => !prev);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                    isAdminTabActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-red-500" />
                  <span>Administration</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${adminMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {adminMenuOpen && (
                  <div className="absolute left-0 mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 px-1 z-50 animate-in fade-in-50 zoom-in-95 duration-100">
                    <button
                      onClick={() => {
                        onSelectTab('admin-users');
                        setAdminMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                        currentTab === 'admin-users'
                          ? 'bg-red-50 text-red-700'
                          : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5 text-red-600" />
                      <span>User Directory & Access</span>
                    </button>
                    <button
                      onClick={() => {
                        onSelectTab('admin-workflow');
                        setAdminMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                        currentTab === 'admin-workflow'
                          ? 'bg-red-50 text-red-700'
                          : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Workflow className="w-3.5 h-3.5 text-red-600" />
                      <span>Workflow & Support</span>
                    </button>
                    <button
                      onClick={() => {
                        onSelectTab('admin-syllabus');
                        setAdminMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                        currentTab === 'admin-syllabus'
                          ? 'bg-red-50 text-red-700'
                          : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5 text-red-600" />
                      <span>Syllabus Structure</span>
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={() => onSelectTab('admin-policies')}
                className={getNavButtonClass('admin-policies')}
              >
                <Shield className="w-3.5 h-3.5 text-red-500" />
                <span>Policies & Corpus</span>
              </button>

              <button
                onClick={() => onSelectTab('audit')}
                className={getNavButtonClass('audit')}
              >
                <Lock className="w-3.5 h-3.5 text-red-500" />
                <span>Audit Chain</span>
              </button>
            </>
          )}

          {role === 'REVIEWER' && (
            <button
              onClick={() => onSelectTab('review-queue')}
              className={getNavButtonClass('review-queue')}
            >
              <FileText className="w-3.5 h-3.5 text-red-500" />
              <span>Review Workspace</span>
            </button>
          )}

          {role === 'MODERATOR' && (
            <button
              onClick={() => onSelectTab('moderator-console')}
              className={getNavButtonClass('moderator-console')}
            >
              <Shield className="w-3.5 h-3.5 text-red-500" />
              <span>Moderator Console</span>
            </button>
          )}

          {role === 'CUSTODIAN' && (
            <button
              onClick={() => onSelectTab('custodian-portal')}
              className={getNavButtonClass('custodian-portal')}
            >
              <KeyRound className="w-3.5 h-3.5 text-red-500" />
              <span>Custodian Vault</span>
            </button>
          )}

          {role === 'AUDITOR' && (
            <button
              onClick={() => onSelectTab('audit')}
              className={getNavButtonClass('audit')}
            >
              <Shield className="w-3.5 h-3.5 text-red-500" />
              <span>Audit Chain</span>
            </button>
          )}

          <button
            onClick={() => onSelectTab('stats')}
            className={getNavButtonClass('stats')}
          >
            <BarChart3 className="w-3.5 h-3.5 text-red-500" />
            <span>Bank Metrics</span>
          </button>
        </nav>

        {/* User Badge and Actions */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-bold text-slate-900 leading-tight">{user.name}</span>
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
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
