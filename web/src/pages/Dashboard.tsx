import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import type { EncounterListItem, Me } from '../api/types';
import { EmptyIcon } from '../icons';

export function Dashboard({
  token,
  me,
  onSelect,
  onNew,
  onInvite,
}: {
  token: string;
  me: Me;
  onSelect: (encounterId: string) => void;
  onNew: () => void;
  onInvite: () => void;
}) {
  const [encounters, setEncounters] = useState<EncounterListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<EncounterListItem[]>(`/encounters?clinicianId=${me.id}`, token)
      .then(setEncounters)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load your visits'));
  }, [me.id, token]);

  return (
    <div className="page page-wide">
      <div className="dashboard-header">
        <div>
          <h1>Your visits</h1>
          <p>Resume an in-progress visit or start a new one.</p>
        </div>
        <div className="dashboard-header-actions">
          {me.role === 'ADMIN' && (
            <button className="btn btn-secondary" onClick={onInvite}>
              Invite clinician
            </button>
          )}
          <button className="btn btn-primary" onClick={onNew}>
            + Start new visit
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {!error && !encounters && <p className="status-line">Loading…</p>}

      {encounters && encounters.length === 0 && (
        <div className="card empty-state">
          <div className="empty-state-icon">
            <EmptyIcon />
          </div>
          <p>No visits yet — start your first one above.</p>
        </div>
      )}

      {encounters && encounters.length > 0 && (
        <div className="card dashboard-card">
          <table className="encounter-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Visit date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {encounters.map((encounter) => (
                <tr key={encounter.id} className="encounter-row" onClick={() => onSelect(encounter.id)}>
                  <td className="patient-name">{encounter.patient.name}</td>
                  <td>{new Date(encounter.visitDate).toLocaleDateString()}</td>
                  <td>
                    <span className={`status-badge status-${encounter.status.toLowerCase()}`}>
                      {encounter.status.replace('_', ' ')}
                    </span>
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
