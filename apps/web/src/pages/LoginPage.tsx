import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { KeyRound, Lock, Mail, ArrowRight, CheckCircle2, AlertCircle, Copy, Check } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, verifyMfa, mfaPending } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify institutional credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await verifyMfa(totpToken);
    } catch (err: any) {
      setError(err.message || 'Invalid MFA token. Please check your authenticator code.');
    } finally {
      setLoading(false);
    }
  };

  const copySecretToClipboard = () => {
    if (mfaPending?.secret) {
      navigator.clipboard.writeText(mfaPending.secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  const fillQuickCreds = (quickEmail: string, quickPass: string) => {
    setEmail(quickEmail);
    setPassword(quickPass);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 bg-[#f8fafc] relative overflow-hidden">
      {/* Subtle executive background accents */}
      <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-60 pointer-events-none" />
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-600 via-slate-900 to-red-600" />

      {/* Main card */}
      <div className="w-full max-w-md z-10 py-6">
        <div className="text-center mb-5">
          <img
            src="/logo.png"
            alt="ExamVault Logo"
            className="h-16 sm:h-20 w-auto mx-auto object-contain mb-2.5 transition-transform hover:scale-[1.02]"
          />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 leading-tight">
            Institutional Examiner Portal
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Tamper-Evident Examination Question Bank & Cryptographic Security
          </p>
        </div>

        <div className="bg-white rounded-2xl p-7 sm:p-8 border border-slate-200 shadow-xl shadow-slate-200/50">
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start space-x-3 text-red-800 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!mfaPending ? (
            /* Standard Login Form */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Institutional Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="examiner@examvault.local"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 text-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Master Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 text-sm transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm text-white bg-red-600 hover:bg-red-700 active:scale-[0.99] transition-all shadow-sm hover:shadow-md disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <span>{loading ? 'Authenticating...' : 'Sign In to Vault'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            /* MFA Verification / First-time Setup */
            <form onSubmit={handleMfaSubmit} className="space-y-5">
              <div className="text-center">
                <div className="inline-flex p-2.5 rounded-full bg-red-50 text-red-600 border border-red-200 mb-2">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  {mfaPending.mustSetup ? 'Mandatory MFA Enrollment' : 'Two-Factor Authentication'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {mfaPending.mustSetup
                    ? 'Scan the QR code with Google Authenticator or 1Password to enroll'
                    : 'Enter the 6-digit one-time code from your authenticator app'}
                </p>
              </div>

              {mfaPending.mustSetup && mfaPending.qrCodeUrl && (
                <div className="flex flex-col items-center p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-xs">
                    <img
                      src={mfaPending.qrCodeUrl}
                      alt="TOTP QR Code"
                      className="w-40 h-40 object-contain"
                    />
                  </div>

                  {mfaPending.secret && (
                    <div className="w-full text-center">
                      <p className="text-[11px] text-slate-500 mb-1">Manual Setup Key:</p>
                      <div className="flex items-center justify-center space-x-2 bg-white px-2 py-1.5 rounded-lg border border-slate-200">
                        <code className="text-xs font-mono text-slate-900 font-semibold break-all">{mfaPending.secret}</code>
                        <button
                          type="button"
                          onClick={copySecretToClipboard}
                          className="text-slate-400 hover:text-slate-800 p-1"
                          title="Copy key"
                        >
                          {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 text-center">
                  6-Digit Verification Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  value={totpToken}
                  onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full py-3 text-center tracking-[0.5em] text-xl font-mono bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 transition-all font-bold"
                />
              </div>

              <button
                type="submit"
                disabled={loading || totpToken.length !== 6}
                className="w-full py-3 px-4 rounded-xl font-semibold text-sm text-white bg-slate-900 hover:bg-black transition-all shadow-sm disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <span>{loading ? 'Verifying...' : 'Verify & Continue'}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </button>
            </form>
          )}

          {/* Quick preset buttons for dev testing */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-[11px] font-mono uppercase text-slate-400 text-center mb-2 tracking-wide">
              Quick Test Credentials
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => fillQuickCreds('admin@examvault.local', 'Admin@ExamVault2024!')}
                className="px-2 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-[11px] text-slate-700 hover:text-slate-900 border border-slate-200 text-center transition-colors font-medium"
                title="admin@examvault.local / Admin@ExamVault2024!"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => fillQuickCreds('examiner1@examvault.local', 'Examiner@2024!pass')}
                className="px-2 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-[11px] text-slate-700 hover:text-slate-900 border border-slate-200 text-center transition-colors font-medium"
                title="examiner1@examvault.local / Examiner@2024!pass"
              >
                Examiner
              </button>
              <button
                type="button"
                onClick={() => fillQuickCreds('auditor@examvault.local', 'Examiner@2024!pass')}
                className="px-2 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-[11px] text-slate-700 hover:text-slate-900 border border-slate-200 text-center transition-colors font-medium"
                title="auditor@examvault.local / Examiner@2024!pass"
              >
                Auditor
              </button>
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-2.5 font-mono">
              Role credentials automatically populated on click
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
