import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { getCurrentAccessToken, logout as cognitoLogout } from './cognito';

interface AuthContextValue {
  token: string | null;
  loading: boolean;
  setToken: (token: string | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentAccessToken().then((existing) => {
      setToken(existing);
      setLoading(false);
    });
  }, []);

  function logout() {
    cognitoLogout();
    setToken(null);
  }

  return <AuthContext value={{ token, loading, setToken, logout }}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
