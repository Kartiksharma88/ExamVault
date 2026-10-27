import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest, setCsrfToken } from '../lib/api-client';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'EXAMINER' | 'REVIEWER' | 'AUDITOR' | 'MODERATOR';
  mfaEnabled: boolean;
  createdAt: string;
}

interface MfaState {
  mustSetup: boolean;
  qrCodeUrl?: string;
  secret?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  mfaPending: MfaState | null;
  login: (email: string, password: string) => Promise<{ requireMfa?: boolean; mustSetupMfa?: boolean }>;
  setupMfa: () => Promise<void>;
  verifyMfa: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaPending, setMfaPending] = useState<MfaState | null>(null);

  const refreshProfile = async () => {
    try {
      const res = await apiRequest<{ success: boolean; data: User }>('/auth/me');
      if (res.data) {
        setUser(res.data);
        setMfaPending(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiRequest<{
      success: boolean;
      data: {
        csrfToken: string;
        requireMfa: boolean;
        mustSetupMfa: boolean;
      };
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (res.data?.csrfToken) {
      setCsrfToken(res.data.csrfToken);
    }

    if (res.data?.requireMfa) {
      if (res.data.mustSetupMfa) {
        // First-time login: fetch MFA setup info
        try {
          const setupRes = await apiRequest<{
            success: boolean;
            data: { qrCodeUrl: string; secret: string; otpauthUrl: string };
          }>('/auth/mfa/setup', { method: 'POST' });

          setMfaPending({
            mustSetup: true,
            qrCodeUrl: setupRes.data.qrCodeUrl,
            secret: setupRes.data.secret,
          });
        } catch {
          setMfaPending({ mustSetup: true });
        }
      } else {
        // Regular TOTP prompt
        setMfaPending({ mustSetup: false });
      }
      return res.data;
    }

    await refreshProfile();
    return res.data;
  };

  const setupMfa = async () => {
    const res = await apiRequest<{
      success: boolean;
      data: { qrCodeUrl: string; secret: string; otpauthUrl: string };
    }>('/auth/mfa/setup', { method: 'POST' });

    setMfaPending({
      mustSetup: true,
      qrCodeUrl: res.data.qrCodeUrl,
      secret: res.data.secret,
    });
  };

  const verifyMfa = async (token: string) => {
    await apiRequest('/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });

    setMfaPending(null);
    await refreshProfile();
  };

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      setCsrfToken(null);
      setUser(null);
      setMfaPending(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        mfaPending,
        login,
        setupMfa,
        verifyMfa,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
