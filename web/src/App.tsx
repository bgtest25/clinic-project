import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import './App.css';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { useIdleTimer } from './auth/useIdleTimer';
import { apiFetch } from './api/client';
import { BrandMark, SearchIcon } from './icons';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeToggle } from './components/ThemeToggle';
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
import { IdleWarningModal } from './components/IdleWarningModal';
import { ToastProvider } from './components/Toast';

const IDLE_WARNING_MS = 13 * 60 * 1000;
const IDLE_LOGOUT_MS = 15 * 60 * 1000;

function RecordingRoute({ token, clinic }: { token: string; clinic: Clinic | null }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  if (!id) return <Navigate to="/" replace />;
  return <Recording token={token} encounterId={id} clinic={clinic} onBack={() => navigate('/')} />;
}

// Backend routes are the real enforcement (RolesGuard reads verified
// cognito:groups), but leaving these client-side routes unguarded meant any
// authenticated clinician who landed here (stale URL, bookmark, back button)
// saw a fully-rendered admin form before any request ever went out.
function AdminRoute({ me, children }: { me: Me; children: ReactNode }) {
  if (me.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PatientDetailRoute({ token, me }: { token: string; me: Me }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  if (!id) return <Navigate to="/patients" replace />;
  return <PatientDetail token={token} me={me} patientId={id} onBack={() => navigate('/patients')} />;
}

function TopbarSearch() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    navigate(`/patients?q=${encodeURIComponent(value)}`);
  }

  return (
    <form className="topbar-search" onSubmit={handleSubmit} role="search">
      <SearchIcon />
      <input
        type="search"
        placeholder="Search patients…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Search patients"
      />
    </form>
  );
}

function AuthenticatedApp({ token }: { token: string }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [me, setMe] = useState<Me | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [error, setError] = useState<string | null>(null);

  const idle = useIdleTimer({ warningMs: IDLE_WARNING_MS, logoutMs: IDLE_LOGOUT_MS, onTimeout: logout });

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
      {idle.warning && <IdleWarningModal secondsLeft={idle.secondsLeft} onStay={idle.reset} onSignOut={logout} />}
      <header className="topbar">
        <span className="brand">
          <BrandMark />
          Havenote
        </span>
        <TopbarSearch />
        <div className="topbar-user">
          <span>
            <strong>{me.name}</strong>
            {clinic && <span className="topbar-clinic"> · {clinic.name}</span>}
          </span>
          <ThemeToggle />
          <button className="btn btn-ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>
      {/* Keyed by pathname so navigating away from a crashed page (still
          possible via the topbar above, which sits outside this boundary)
          remounts cleanly instead of staying stuck on the fallback. */}
      <ErrorBoundary key={location.pathname}>
      <Routes>
        <Route
          path="/"
          element={
            <Dashboard
              token={token}
              me={me}
              onNew={() => navigate('/new')}
              onSelect={(id) => navigate(`/encounters/${id}`)}
              onInvite={() => navigate('/invite')}
              onMetrics={() => navigate('/metrics')}
              onUsers={() => navigate('/users')}
              onPatients={() => navigate('/patients')}
            />
          }
        />
        <Route
          path="/invite"
          element={
            <AdminRoute me={me}>
              <InviteClinician token={token} me={me} onBack={() => navigate('/')} />
            </AdminRoute>
          }
        />
        <Route
          path="/metrics"
          element={
            <AdminRoute me={me}>
              <Metrics token={token} me={me} onBack={() => navigate('/')} />
            </AdminRoute>
          }
        />
        <Route
          path="/users"
          element={
            <AdminRoute me={me}>
              <Users token={token} me={me} onBack={() => navigate('/')} />
            </AdminRoute>
          }
        />
        <Route
          path="/patients"
          element={
            <Patients token={token} onBack={() => navigate('/')} onSelect={(id) => navigate(`/patients/${id}`)} />
          }
        />
        <Route path="/patients/:id" element={<PatientDetailRoute token={token} me={me} />} />
        <Route
          path="/new"
          element={
            <NewEncounter
              token={token}
              me={me}
              onBack={() => navigate('/')}
              onCreated={(encounter) => navigate(`/encounters/${encounter.id}`)}
            />
          }
        />
        <Route path="/encounters/:id" element={<RecordingRoute token={token} clinic={clinic} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </ErrorBoundary>
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
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Shell />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
