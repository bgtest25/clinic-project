import { useEffect, useState } from 'react';
import './App.css';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { apiFetch } from './api/client';
import { BrandMark } from './icons';
import type { Me } from './api/types';
import { Dashboard } from './pages/Dashboard';
import { InviteClinician } from './pages/InviteClinician';
import { Login } from './pages/Login';
import { NewEncounter } from './pages/NewEncounter';
import { Recording } from './pages/Recording';

type View = { mode: 'dashboard' } | { mode: 'new' } | { mode: 'encounter'; id: string } | { mode: 'invite' };

function AuthenticatedApp({ token }: { token: string }) {
  const { logout } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [view, setView] = useState<View>({ mode: 'dashboard' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Me>('/users/me', token)
      .then(setMe)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load your account'));
  }, [token]);

  if (error) {
    return (
      <div className="page">
        <p className="error">{error}</p>
        <button className="btn btn-secondary" onClick={logout}>
          Sign out
        </button>
      </div>
    );
  }

  if (!me) return <div className="page">Loading…</div>;

  return (
    <div>
      <header className="topbar">
        <span className="brand">
          <BrandMark />
          Havenote
        </span>
        <div className="topbar-user">
          <span>
            <strong>{me.name}</strong>
          </span>
          <button className="btn btn-ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>
      {view.mode === 'dashboard' && (
        <Dashboard
          token={token}
          me={me}
          onNew={() => setView({ mode: 'new' })}
          onSelect={(id) => setView({ mode: 'encounter', id })}
          onInvite={() => setView({ mode: 'invite' })}
        />
      )}
      {view.mode === 'invite' && (
        <InviteClinician token={token} me={me} onBack={() => setView({ mode: 'dashboard' })} />
      )}
      {view.mode === 'new' && (
        <NewEncounter
          token={token}
          me={me}
          onBack={() => setView({ mode: 'dashboard' })}
          onCreated={(encounter) => setView({ mode: 'encounter', id: encounter.id })}
        />
      )}
      {view.mode === 'encounter' && (
        <Recording token={token} encounterId={view.id} onBack={() => setView({ mode: 'dashboard' })} />
      )}
    </div>
  );
}

function Shell() {
  const { token, loading } = useAuth();
  if (loading) return <div className="auth-shell">Loading…</div>;
  if (!token) return <Login />;
  return <AuthenticatedApp token={token} />;
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
