import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import type { Me, User } from '../api/types';
import { ConfirmButton } from '../components/ConfirmButton';
import { EmptyIcon } from '../icons';
import { SkeletonTable } from '../components/Skeleton';
import { useToast } from '../components/Toast';

export function Users({ token, me, onBack }: { token: string; me: Me; onBack: () => void }) {
  const { showToast } = useToast();
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<User[]>('/users', token)
      .then(setUsers)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load users'));
  }, [token]);

  async function handleSetActive(user: User, action: 'deactivate' | 'reactivate') {
    setActionError(null);
    setBusyId(user.id);
    try {
      const updated = await apiFetch<User>(`/users/${user.id}/${action}`, token, { method: 'PATCH' });
      setUsers((prev) => prev?.map((u) => (u.id === updated.id ? updated : u)) ?? prev);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Failed to ${action} user`);
    } finally {
      setBusyId(null);
    }
  }

  async function handleResetMfa(user: User) {
    setActionError(null);
    setBusyId(user.id);
    try {
      const updated = await apiFetch<User>(`/users/${user.id}/reset-mfa`, token, { method: 'PATCH' });
      setUsers((prev) => prev?.map((u) => (u.id === updated.id ? updated : u)) ?? prev);
      showToast(`MFA reset for ${user.name} — they'll get a new temporary password by email.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to reset MFA');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page page-wide">
      <button type="button" className="link-button back-link" onClick={onBack}>
        ← Back to dashboard
      </button>
      <div className="dashboard-header">
        <div>
          <h1>Manage users</h1>
          <p>
            Deactivate or reactivate clinicians and admins in your clinic. Resetting MFA also
            issues a new temporary password by email — there's no way to clear just the
            authenticator enrollment on its own.
          </p>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {actionError && <p className="error">{actionError}</p>}

      {!error && !users && <SkeletonTable rows={4} cols={5} />}

      {users && users.length === 0 && (
        <div className="card empty-state">
          <div className="empty-state-icon">
            <EmptyIcon />
          </div>
          <p>No users yet.</p>
        </div>
      )}

      {users && users.length > 0 && (
        <div className="card dashboard-card">
          <table className="encounter-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="table-primary-cell">{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>
                    <span className={`status-badge status-${u.deactivatedAt ? 'inactive' : 'active'}`}>
                      {u.deactivatedAt ? 'Inactive' : 'Active'}
                    </span>
                  </td>
                  <td className="table-actions-cell">
                    {u.id !== me.id && (
                      <>
                        <ConfirmButton
                          key={`${u.id}-${u.deactivatedAt ?? 'active'}`}
                          label={u.deactivatedAt ? 'Reactivate' : 'Deactivate'}
                          className={u.deactivatedAt ? 'btn btn-secondary btn-sm' : 'btn btn-danger btn-sm'}
                          busy={busyId === u.id}
                          onConfirm={() => handleSetActive(u, u.deactivatedAt ? 'reactivate' : 'deactivate')}
                        />
                        {!u.deactivatedAt && (
                          <ConfirmButton
                            label="Reset MFA"
                            confirmLabel="Reset MFA"
                            className="btn btn-secondary btn-sm"
                            busy={busyId === u.id}
                            onConfirm={() => handleResetMfa(u)}
                          />
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
