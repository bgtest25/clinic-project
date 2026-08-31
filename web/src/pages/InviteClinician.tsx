import { useState, type FormEvent } from 'react';
import { apiFetch } from '../api/client';
import type { InviteUserPayload } from '../api/types';

export function InviteClinician({
  token,
  onBack,
}: {
  token: string;
  onBack: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'CLINICIAN' | 'ADMIN'>('CLINICIAN');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitedEmail, setInvitedEmail] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch<unknown>('/users', token, {
        method: 'POST',
        body: JSON.stringify({ email, name, role } satisfies InviteUserPayload),
      });
      setInvitedEmail(email);
      setName('');
      setEmail('');
      setRole('CLINICIAN');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite clinician');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <button type="button" className="link-button back-link" onClick={onBack}>
        ← Back to visits
      </button>
      <div className="card">
        <h1>Invite a clinician</h1>
        <p className="auth-subtitle">
          They'll get an email with a temporary password and set up their own login on first sign-in.
        </p>

        {invitedEmail && <p className="signed-banner">Invited {invitedEmail}. Check their inbox.</p>}

        <form onSubmit={handleSubmit} className="form-stack form-stack-spaced">
          <label className="field">
            Full name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="field">
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </label>
          <label className="field">
            Role
            <select value={role} onChange={(e) => setRole(e.target.value as 'CLINICIAN' | 'ADMIN')}>
              <option value="CLINICIAN">Clinician</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Inviting…' : 'Send invite'}
          </button>
        </form>
      </div>
    </div>
  );
}
