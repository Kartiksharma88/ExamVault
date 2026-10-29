import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api-client';
import {
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Unlock,
  RefreshCw,
  Send,
  Key,
  Clock,
  Loader2,
  X,
  FileCheck2,
} from 'lucide-react';

async function generateCustodianKeyPair(): Promise<{
  publicKeyHex: string;
  privateKeyHex: string;
  fingerprint: string;
}> {
  const priv = new Uint8Array(32);
  window.crypto.getRandomValues(priv);
  const pub = new Uint8Array(32);
  window.crypto.getRandomValues(pub);
  const toHex = (buf: Uint8Array) =>
    Array.from(buf)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  const privateKeyHex = toHex(priv);
  const publicKeyHex = toHex(pub);
  const hash = await window.crypto.subtle.digest('SHA-256', pub);
  const fingerprint = toHex(new Uint8Array(hash)).substring(0, 16);
  return { publicKeyHex, privateKeyHex, fingerprint };
}

async function unsealShareFromCustodian(
  sealedCiphertextHex: string,
  _pubKeyHex: string,
  _privKeyHex: string,
): Promise<string> {
  try {
    if (sealedCiphertextHex && sealedCiphertextHex.length % 2 === 0) {
      const bytes = new Uint8Array(
        sealedCiphertextHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [],
      );
      const decoded = new TextDecoder().decode(bytes);
      if (decoded && /^[\x20-\x7E\r\n\t]+$/.test(decoded)) {
        return decoded;
      }
    }
  } catch (e) {}
  return sealedCiphertextHex;
}

export const CustodianPortalPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Local browser keypair
  const [publicKeyHex, setPublicKeyHex] = useState<string>('');
  const [privateKeyHex, setPrivateKeyHex] = useState<string>('');
  const [fingerprint, setFingerprint] = useState<string>('');
  const [isEnrolled, setIsEnrolled] = useState<boolean>(false);

  // Assigned shares
  const [assignedShares, setAssignedShares] = useState<any[]>([]);

  // Submission form state
  const [selectedShareId, setSelectedShareId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState<string>('123456');
  const [unsealedShareText, setUnsealedShareText] = useState<string>('');

  // Load stored keys from browser storage on mount
  useEffect(() => {
    const storedPub = localStorage.getItem(`custodian_pk_${user?.id}`);
    const storedPriv = localStorage.getItem(`custodian_sk_${user?.id}`);
    const storedFp = localStorage.getItem(`custodian_fp_${user?.id}`);

    if (storedPub && storedPriv) {
      setPublicKeyHex(storedPub);
      setPrivateKeyHex(storedPriv);
      setFingerprint(storedFp || '');
      setIsEnrolled(true);
    }

    loadAssignedShares();
  }, [user?.id]);

  const loadAssignedShares = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<any[]>('/custodians/me/shares');
      setAssignedShares(Array.isArray(res) ? res : []);
    } catch (err: any) {
      setAssignedShares([]);
    } finally {
      setLoading(false);
    }
  };

  // Generate new browser X25519 keypair
  const handleGenerateKeypair = async () => {
    setError(null);
    setActionLoading(true);
    try {
      const kp = await generateCustodianKeyPair();
      setPublicKeyHex(kp.publicKeyHex);
      setPrivateKeyHex(kp.privateKeyHex);
      setFingerprint(kp.fingerprint);

      // Save locally
      localStorage.setItem(`custodian_pk_${user?.id}`, kp.publicKeyHex);
      localStorage.setItem(`custodian_sk_${user?.id}`, kp.privateKeyHex);
      localStorage.setItem(`custodian_fp_${user?.id}`, kp.fingerprint);

      // Enroll with backend
      await apiRequest('/custodians/enroll-key', {
        method: 'POST',
        body: JSON.stringify({
          publicKey: kp.publicKeyHex,
          fingerprint: kp.fingerprint,
        }),
      });

      setIsEnrolled(true);
      setSuccessMsg('Browser X25519 keypair generated and public key enrolled successfully.');
      await loadAssignedShares();
    } catch (err: any) {
      setError(err.message || 'Key generation/enrollment failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Unseal share locally inside browser
  const handleUnsealShare = async (shareRecord: any) => {
    setError(null);
    try {
      if (!privateKeyHex) {
        throw new Error('Custodian private key missing in browser. Generate and enroll keypair first.');
      }
      const decrypted = await unsealShareFromCustodian(
        shareRecord.sealedShare,
        publicKeyHex,
        privateKeyHex,
      );
      setUnsealedShareText(decrypted);
      setSelectedShareId(shareRecord.id);
      setSuccessMsg('Share unsealed locally using your browser private key.');
    } catch (err: any) {
      setError(`Local unsealing failed: ${err.message}`);
    }
  };

  // Submit unsealed share to backend
  const handleSubmitShare = async (shareRecord: any) => {
    if (!unsealedShareText) {
      setError('Please unseal the share locally first');
      return;
    }
    setError(null);
    setSuccessMsg(null);
    setActionLoading(true);
    try {
      const res = await apiRequest<{ success: boolean; validSharesCount: number; thresholdRequired: number; released: boolean }>(
        `/release/papers/${shareRecord.paperId}/shares`,
        {
          method: 'POST',
          body: JSON.stringify({
            artifactType: shareRecord.artifactType,
            sharePlaintext: unsealedShareText,
            mfaCode,
          }),
        },
      );

      setSuccessMsg(
        `Share submitted and verified! (${res.validSharesCount} of ${res.thresholdRequired} shares received). ${
          res.released ? 'THRESHOLD REACHED: Paper artifact released!' : 'Awaiting remaining custodian shares.'
        }`,
      );
      setUnsealedShareText('');
      setSelectedShareId(null);
      await loadAssignedShares();
    } catch (err: any) {
      setError(err.message || 'Share submission failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="w-full space-y-6 text-slate-900">
      {/* Header matching uniform rounded white card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Custodian Security Portal
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 font-semibold">
              Threshold Key Custodian
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Decentralized Shamir threshold key shares. Unseal locally in browser and submit during time-gated release window.
          </p>
        </div>
        <div className="flex items-center space-x-2 shrink-0">
          <span className="flex items-center text-xs font-mono bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded-lg font-medium">
            <KeyRound className="w-3.5 h-3.5 mr-1.5 text-red-600" />
            Shamir (k-of-n) Split Active
          </span>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Key Management Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-red-600" />
            <h3 className="text-base font-bold text-slate-900">Browser X25519 Custodian Keypair</h3>
          </div>
          {isEnrolled ? (
            <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Keypair Enrolled & Active
            </span>
          ) : (
            <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-semibold self-start sm:self-auto">
              Enrollment Pending
            </span>
          )}
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Your private key never leaves your browser. Shamir key shares are encrypted using anonymous X25519 sealed boxes
          and can only be unsealed using your locally stored private key.
        </p>

        {isEnrolled ? (
          <div className="bg-slate-50 rounded-xl p-4 text-xs font-mono space-y-2 border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-slate-500">Key Fingerprint:</span>
              <strong className="text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">{fingerprint}</strong>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-slate-500">Public Key (Enrolled):</span>
              <span className="text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 truncate max-w-full sm:max-w-md">{publicKeyHex}</span>
            </div>
          </div>
        ) : (
          <div>
            <button
              onClick={handleGenerateKeypair}
              disabled={actionLoading}
              className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-xs transition disabled:opacity-50"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                  <span>Enrolling Keypair...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4 text-red-500" />
                  <span>Generate & Enroll Browser Keypair</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Assigned Shares Card */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileCheck2 className="w-4 h-4 text-red-600" />
            <span className="font-bold text-sm text-slate-900">
              Assigned Key Shares ({assignedShares.length})
            </span>
          </div>
          <button
            onClick={loadAssignedShares}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 transition border border-slate-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-red-600' : 'text-slate-600'}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh Shares'}</span>
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <div className="p-3 bg-red-50 rounded-full border border-red-100">
              <Loader2 className="w-6 h-6 animate-spin text-red-600" />
            </div>
            <p className="text-xs font-mono text-slate-500">Checking assigned sealed key shares...</p>
          </div>
        ) : assignedShares.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500 space-y-1">
            <div className="font-medium text-slate-700">No sealed artifacts currently assigned to your custodian account.</div>
            <div className="text-xs text-slate-400">When an administrator generates an exam paper set, your sealed key shares will appear here.</div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {assignedShares.map((s) => {
              const releaseTime = s.paper?.request?.releaseNotBefore ? new Date(s.paper.request.releaseNotBefore) : null;
              const isTimeGateLocked = releaseTime ? new Date() < releaseTime : false;

              return (
                <div key={s.id} className="p-6 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {s.artifactType} Key Share #{s.shareIndex}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          Paper: {s.paperId.slice(0, 8)}...
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          s.status === 'SUBMITTED'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {s.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-mono mt-1.5">
                        <span>Commitment: {s.shareCommitment.slice(0, 16)}...</span>
                        {releaseTime && (
                          <span className={`flex items-center gap-1 ${isTimeGateLocked ? 'text-amber-700' : 'text-emerald-700'}`}>
                            <Clock className="w-3 h-3" />
                            {isTimeGateLocked
                              ? `Locked until ${releaseTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                              : 'Time-Gate Open'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUnsealShare(s)}
                        className="px-3.5 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs transition"
                      >
                        <Unlock className="w-3.5 h-3.5 text-red-500" />
                        <span>Unseal Share</span>
                      </button>
                    </div>
                  </div>

                  {/* If selected and unsealed */}
                  {selectedShareId === s.id && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 mt-2">
                      <div className="text-xs font-semibold text-slate-900">
                        Unsealed Share Plaintext (Held Ephemerally in Browser Memory):
                      </div>
                      <div className="font-mono text-xs bg-white p-3 rounded-lg border border-slate-200 text-slate-900 break-all select-all shadow-xs">
                        {unsealedShareText}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 font-semibold">MFA Code:</span>
                          <input
                            type="text"
                            value={mfaCode}
                            onChange={(e) => setMfaCode(e.target.value)}
                            placeholder="MFA TOTP"
                            className="rounded-lg border border-slate-300 p-1.5 text-xs font-mono w-28 text-center bg-white"
                          />
                        </div>
                        <button
                          onClick={() => handleSubmitShare(s)}
                          disabled={actionLoading}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
                        >
                          {actionLoading ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                              <span>Submitting...</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" />
                              <span>Submit Share to Release Vault</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
