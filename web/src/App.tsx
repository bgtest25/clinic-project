import { useEffect, useState } from 'react';
import './App.css';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { apiFetch } from './api/client';
import { BrandMark } from './icons';
import type { Clinic, Me } from './api/types';
import { Dashboard } from './pages/Dashboard';
import { InviteClinician } from './pages/InviteClinician';
import { Login } from './pages/Login';
import { Metrics } from './pages/Metrics';
import { NewEncounter } from './pages/NewEncounter';
import { PatientDetail } from './pages/PatientDetail';
import { Patients } from './pages/Patients';
import { Recording } from './pages/Recording';
import { Users } from './pages/Users';

type View =
  | { mode: 'dashboard' }
  | { mode: 'new' }
  | { mode: 'encounter'; id: string }
  | { mode: 'invite' }
  | { mode: 'metrics' }
  | { mode: 'users' }
  | { mode: 'patients' }
  | { mode: 'patient'; id: string };

function AuthenticatedApp({ token }: { token: string }) {
  const { logout } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [view, setView] = useState<View>({ mode: 'dashboard' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Me>('/users/me', token)
      .then(setMe)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load your account'));
  }, [token]);

  useEffect(() => {
    // Decorative only — never block the app if this fails.
    apiFetch<Clinic[]>('/clinics', token)
      .then((clinics) => setClinic(clinics[0] ?? null))
      .catch(() => {});
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
            {clinic && <span className="topbar-clinic"> · {clinic.name}</span>}
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
          onMetrics={() => setView({ mode: 'metrics' })}
          onUsers={() => setView({ mode: 'users' })}
          onPatients={() => setView({ mode: 'patients' })}
        />
      )}
      {view.mode === 'invite' && (
        <InviteClinician token={token} me={me} onBack={() => setView({ mode: 'dashboard' })} />
      )}
      {view.mode === 'metrics' && (
        <Metrics token={token} me={me} onBack={() => setView({ mode: 'dashboard' })} />
      )}
      {view.mode === 'users' && (
        <Users token={token} me={me} onBack={() => setView({ mode: 'dashboard' })} />
      )}
      {view.mode === 'patients' && (
        <Patients
          token={token}
          onBack={() => setView({ mode: 'dashboard' })}
          onSelect={(id) => setView({ mode: 'patient', id })}
        />
      )}
      {view.mode === 'patient' && (
        <PatientDetail
          token={token}
          me={me}
          patientId={view.id}
          onBack={() => setView({ mode: 'patients' })}
        />
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
