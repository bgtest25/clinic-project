import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import type { Patient } from '../api/types';
import { EmptyIcon } from '../icons';

export function Patients({
  token,
  onBack,
  onSelect,
}: {
  token: string;
  onBack: () => void;
  onSelect: (patientId: string) => void;
}) {
  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Patient[]>('/patients', token)
      .then(setPatients)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load patients'));
  }, [token]);

  return (
    <div className="page page-wide">
      <button type="button" className="link-button back-link" onClick={onBack}>
        ← Back to dashboard
      </button>
      <div className="dashboard-header">
        <div>
          <h1>Patients</h1>
          <p>View patient records and manage data requests.</p>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {!error && !patients && <p className="status-line">Loading…</p>}

      {patients && patients.length === 0 && (
        <div className="card empty-state">
          <div className="empty-state-icon">
            <EmptyIcon />
          </div>
          <p>No patients yet — they're created automatically when you start a new visit.</p>
        </div>
      )}

      {patients && patients.length > 0 && (
        <div className="card dashboard-card">
          <table className="encounter-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Date of birth</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id} className="encounter-row" onClick={() => onSelect(p.id)}>
                  <td className="table-primary-cell">{p.name}</td>
                  <td>{new Date(p.dateOfBirth).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
