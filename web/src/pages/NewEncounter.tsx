import { useState, type FormEvent } from 'react';
import { apiFetch } from '../api/client';
import type { Encounter, Me, Patient } from '../api/types';

export function NewEncounter({
  token,
  me,
  onCreated,
  onBack,
}: {
  token: string;
  me: Me;
  onCreated: (encounter: Encounter) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const patient = await apiFetch<Patient>('/patients', token, {
        method: 'POST',
        body: JSON.stringify({ clinicId: me.clinicId, name, dateOfBirth: dob }),
      });
      const encounter = await apiFetch<Encounter>('/encounters', token, {
        method: 'POST',
        body: JSON.stringify({ patientId: patient.id, clinicianId: me.id }),
      });
      onCreated(encounter);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start visit');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="panel">
      <button type="button" className="link-button back-link" onClick={onBack}>
        ← Back to visits
      </button>
      <h1>Start a new visit</h1>
      <label>
        Patient name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        Date of birth
        <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={busy}>
        {busy ? 'Starting…' : 'Start visit'}
      </button>
    </form>
  );
}
