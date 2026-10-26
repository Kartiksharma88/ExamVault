import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, KeyRound, Lock, Mail, ArrowRight, CheckCircle2, AlertCircle, Copy, Check } from 'lucide-react';

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
      setError(err.message || 'Login failed');
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
    <div className="min-h-screen flex flex-col justify-center items-center px-4 bg-[#090d16] relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-600/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-md z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-0.5 shadow-glow-md mb-4">
            <div className="w-full h-full bg-[#090d16] rounded-2xl flex items-center justify-center">
              <Shield className="w-8 h-8 text-cyan-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">ExamVault Portal</h1>
          <p className="text-sm text-text-secondary mt-1">
            Tamper-Evident Examination Question Bank & Security Architecture
          </p>
        </div>

        <div className="glass-card rounded-2xl p-7 border border-border/80 shadow-2xl backdrop-blur-xl">
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start space-x-3 text-rose-300 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!mfaPending ? (
            /* Standard Login Form */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                  Institutional Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="examiner@examvault.local"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-border rounded-xl text-white placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-border rounded-xl text-white placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 active:scale-[0.99] transition-all shadow-glow-sm disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            /* MFA Verification / First-time Setup */
            <form onSubmit={handleMfaSubmit} className="space-y-5">
              <div className="text-center">
                <div className="inline-flex p-2.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 mb-2">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-white">
                  {mfaPending.mustSetup ? 'Mandatory MFA Enrollment' : 'Two-Factor Authentication'}
                </h3>
                <p className="text-xs text-text-muted mt-1">
                  {mfaPending.mustSetup
                    ? 'Scan the QR code with Google Authenticator or 1Password to enroll'
                    : 'Enter the 6-digit one-time code from your authenticator app'}
                </p>
              </div>

              {mfaPending.mustSetup && mfaPending.qrCodeUrl && (
                <div className="flex flex-col items-center p-4 bg-slate-900/80 rounded-xl border border-border space-y-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <img
                      src={mfaPending.qrCodeUrl}
                      alt="TOTP QR Code"
                      className="w-40 h-40 object-contain"
                    />
                  </div>

                  {mfaPending.secret && (
                    <div className="w-full text-center">
                      <p className="text-[11px] text-text-muted mb-1">Manual Setup Key:</p>
                      <div className="flex items-center justify-center space-x-2 bg-slate-950 px-2 py-1.5 rounded-lg border border-border">
                        <code className="text-xs font-mono text-cyan-400 break-all">{mfaPending.secret}</code>
                        <button
                          type="button"
                          onClick={copySecretToClipboard}
                          className="text-text-muted hover:text-white p-1"
                          title="Copy key"
                        >
                          {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5 text-center">
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
                  className="w-full py-3 text-center tracking-[0.5em] text-xl font-mono bg-slate-900/90 border border-border rounded-xl text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading || totpToken.length !== 6}
                className="w-full py-3 px-4 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 transition-all shadow-glow-sm disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <span>{loading ? 'Verifying...' : 'Verify & Continue'}</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Quick preset buttons for dev testing */}
          <div className="mt-6 pt-5 border-t border-border/80">
            <p className="text-[11px] font-mono uppercase text-text-muted text-center mb-2">
              Synthetic Test Accounts (Click to Fill)
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => fillQuickCreds('admin@examvault.local', 'Admin@ExamVault2024!')}
                className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] text-text-secondary hover:text-white border border-border text-center transition-colors font-mono"
                title="admin@examvault.local / Admin@ExamVault2024!"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => fillQuickCreds('examiner1@examvault.local', 'Examiner@2024!pass')}
                className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] text-text-secondary hover:text-white border border-border text-center transition-colors font-mono"
                title="examiner1@examvault.local / Examiner@2024!pass"
              >
                Examiner
              </button>
              <button
                type="button"
                onClick={() => fillQuickCreds('auditor@examvault.local', 'Examiner@2024!pass')}
                className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] text-text-secondary hover:text-white border border-border text-center transition-colors font-mono"
                title="auditor@examvault.local / Examiner@2024!pass"
              >
                Auditor
              </button>
            </div>
            <p className="text-[10px] text-text-muted text-center mt-2 font-mono">
              Pass: <span className="text-cyan-400">Examiner@2024!pass</span> (Users) / <span className="text-cyan-400">Admin@ExamVault2024!</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
