import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react';
import { getCurrentAccessToken, logout as cognitoLogout } from './cognito';
import { clearIdleActivity } from './useIdleTimer';

interface AuthContextValue {
  token: string | null;
  loading: boolean;
  setToken: (token: string | null) => void;
  logout: () => void;
  refreshToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshToken = useCallback(async () => {
    const fresh = await getCurrentAccessToken();
    setToken(fresh);
    return fresh;
  }, []);

  useEffect(() => {
    refreshToken().then(() => setLoading(false));
  }, [refreshToken]);

  // Keep the token fresh: Cognito access tokens expire after 1 hour, so refresh
  // every 50 minutes to avoid 401 errors during active sessions.
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      refreshToken();
    }, 50 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token, refreshToken]);

  function logout() {
    cognitoLogout();
    clearIdleActivity();
    setToken(null);
  }

  return <AuthContext value={{ token, loading, setToken, logout, refreshToken }}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
