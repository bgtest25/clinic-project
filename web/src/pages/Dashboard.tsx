import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import type { EncounterListItem, Me } from '../api/types';

export function Dashboard({
  token,
  me,
  onSelect,
  onNew,
}: {
  token: string;
  me: Me;
  onSelect: (encounterId: string) => void;
  onNew: () => void;
}) {
  const [encounters, setEncounters] = useState<EncounterListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<EncounterListItem[]>(`/encounters?clinicianId=${me.id}`, token)
      .then(setEncounters)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load your visits'));
  }, [me.id, token]);

  return (
    <div className="dashboard-panel">
      <div className="dashboard-header">
        <h1>Your visits</h1>
        <button onClick={onNew}>Start new visit</button>
      </div>

      {error && <p className="error">{error}</p>}
      {!error && !encounters && <p>Loading…</p>}
      {encounters && encounters.length === 0 && <p>No visits yet — start your first one above.</p>}

      {encounters && encounters.length > 0 && (
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
                <td>{encounter.patient.name}</td>
                <td>{new Date(encounter.visitDate).toLocaleDateString()}</td>
                <td>
                  <span className={`status-badge status-${encounter.status.toLowerCase()}`}>
                    {encounter.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
