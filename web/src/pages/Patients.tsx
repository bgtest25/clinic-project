import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch } from '../api/client';
import type { Patient } from '../api/types';
import { EmptyIcon } from '../icons';
import { rowActivation } from '../utils/a11y';
import { SkeletonTable } from '../components/Skeleton';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('q') ?? '';

  useEffect(() => {
    apiFetch<Patient[]>('/patients', token)
      .then(setPatients)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load patients'));
  }, [token]);

  const filtered = useMemo(() => {
    if (!patients) return [];
    const q = search.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => p.name.toLowerCase().includes(q));
  }, [patients, search]);

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

      {!error && !patients && <SkeletonTable rows={4} cols={2} />}

      {patients && patients.length === 0 && (
        <div className="card empty-state">
          <div className="empty-state-icon">
            <EmptyIcon />
          </div>
          <p>No patients yet. They're created automatically when you start a new visit.</p>
        </div>
      )}

      {patients && patients.length > 0 && (
        <>
          <div className="filter-bar">
            <input
              type="search"
              className="filter-search"
              placeholder="Search patients by name…"
              value={search}
              onChange={(e) => {
                const value = e.target.value;
                setSearchParams(value ? { q: value } : {});
              }}
              aria-label="Search patients by name"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="card empty-state">
              <p>No patients match "{search}".</p>
            </div>
          ) : (
            <div className="card dashboard-card">
              <table className="encounter-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Date of birth</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="encounter-row" {...rowActivation(() => onSelect(p.id))}>
                      <td className="table-primary-cell">{p.name}</td>
                      <td>{new Date(p.dateOfBirth).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
