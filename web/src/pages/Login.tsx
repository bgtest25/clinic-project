import { useState, type FormEvent } from 'react';
import type { CognitoUser } from 'amazon-cognito-identity-js';
import { confirmMfaSetup, login, submitMfaCode, submitNewPassword, type LoginResult } from '../auth/cognito';
import { useAuth } from '../auth/AuthContext';
import { BrandMark } from '../icons';
import { ThemeToggle } from '../components/ThemeToggle';

type Stage =
  | { step: 'credentials' }
  | { step: 'newPassword'; user: CognitoUser }
  | { step: 'mfa'; user: CognitoUser }
  | { step: 'mfaSetup'; user: CognitoUser; secretCode: string };

export function Login() {
  const { setToken } = useAuth();
  const [stage, setStage] = useState<Stage>({ step: 'credentials' });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function applyLoginResult(result: LoginResult) {
    if (result.type === 'success') setToken(result.accessToken);
    else if (result.type === 'newPasswordRequired') setStage({ step: 'newPassword', user: result.user });
    else if (result.type === 'mfaRequired') setStage({ step: 'mfa', user: result.user });
    else setStage({ step: 'mfaSetup', user: result.user, secretCode: result.secretCode });
  }

  async function handleCredentials(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      applyLoginResult(await login(username, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleNewPassword(e: FormEvent) {
    e.preventDefault();
    if (stage.step !== 'newPassword') return;
    setError(null);
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      applyLoginResult(await submitNewPassword(stage.user, newPassword));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set new password');
    } finally {
      setBusy(false);
    }
  }

  async function handleMfaCode(e: FormEvent) {
    e.preventDefault();
    if (stage.step !== 'mfa') return;
    setError(null);
    setBusy(true);
    try {
      setToken(await submitMfaCode(stage.user, code));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setBusy(false);
    }
  }

  async function handleMfaSetup(e: FormEvent) {
    e.preventDefault();
    if (stage.step !== 'mfaSetup') return;
    setError(null);
    setBusy(true);
    try {
      setToken(await confirmMfaSetup(stage.user, code));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setBusy(false);
    }
  }

  if (stage.step === 'newPassword') {
    return (
      <div className="auth-shell">
        <div className="auth-card card">
          <span className="brand">
            <BrandMark />
            Havenote
          </span>
          <h1>Set your password</h1>
          <p className="auth-subtitle">This is your first sign-in. Choose a permanent password.</p>
          <form onSubmit={handleNewPassword} className="form-stack">
            <label className="field">
              New password
              <input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
                autoFocus
              />
            </label>
            <label className="field">
              Confirm new password
              <input
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Saving…' : 'Set password'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (stage.step === 'mfa') {
    return (
      <div className="auth-shell">
        <div className="auth-card card">
          <span className="brand">
            <BrandMark />
            Havenote
          </span>
          <h1>Enter your authenticator code</h1>
          <form onSubmit={handleMfaCode} className="form-stack">
            <label className="field">
              6-digit code
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123 456"
                inputMode="numeric"
                autoFocus
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Verifying…' : 'Verify'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (stage.step === 'mfaSetup') {
    return (
      <div className="auth-shell">
        <div className="auth-card card">
          <span className="brand">
            <BrandMark />
            Havenote
          </span>
          <h1>Set up your authenticator app</h1>
          <p className="auth-subtitle">
            Add this secret to an authenticator app (Google Authenticator, Authy, 1Password), then enter the
            code it shows.
          </p>
          <code className="secret-code">{stage.secretCode}</code>
          <form onSubmit={handleMfaSetup} className="form-stack">
            <label className="field">
              6-digit code
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123 456"
                inputMode="numeric"
                autoFocus
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Confirming…' : 'Confirm'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <ThemeToggle className="auth-theme-toggle" />
      <div className="auth-card card">
        <span className="brand">
          <BrandMark />
          Havenote
        </span>
        <div>
          <h1>Sign in</h1>
          <p className="auth-subtitle">Clinical documentation, from visit to signed note.</p>
        </div>
        <form onSubmit={handleCredentials} className="form-stack">
          <label className="field">
            Email
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              type="email"
              autoComplete="username"
              autoFocus
            />
          </label>
          <label className="field">
            Password
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
