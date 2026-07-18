import { useEffect, useState } from 'react';
import './App.css';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { apiFetch } from './api/client';
import type { Encounter, Me } from './api/types';
import { Login } from './pages/Login';
import { NewEncounter } from './pages/NewEncounter';
import { Recording } from './pages/Recording';

function AuthenticatedApp({ token }: { token: string }) {
  const { logout } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Me>('/users/me', token)
      .then(setMe)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load your account'));
  }, [token]);

  if (error) {
    return (
      <div className="panel">
        <p className="error">{error}</p>
        <button onClick={logout}>Sign out</button>
      </div>
    );
  }

  if (!me) return <div className="panel">Loading…</div>;

  return (
    <div>
      <header className="topbar">
        <span>{me.name}</span>
        <button onClick={logout}>Sign out</button>
      </header>
      {!encounter ? (
        <NewEncounter token={token} me={me} onCreated={setEncounter} />
      ) : (
        <Recording token={token} encounter={encounter} />
      )}
    </div>
  );
}

function Shell() {
  const { token, loading } = useAuth();
  if (loading) return <div className="panel">Loading…</div>;
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
