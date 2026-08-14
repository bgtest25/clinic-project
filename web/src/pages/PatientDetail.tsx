import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch } from '../api/client';
import type {
  CreateDataRequestPayload,
  DataRequest,
  Me,
  Patient,
  ResolveDataRequestPayload,
  UpdatePatientPayload,
} from '../api/types';
import { ConfirmButton } from '../components/ConfirmButton';
import { CheckIcon } from '../icons';

export function PatientDetail({
  token,
  me,
  patientId,
  onBack,
}: {
  token: string;
  me: Me;
  patientId: string;
  onBack: () => void;
}) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [patientError, setPatientError] = useState<string | null>(null);

  const [nameField, setNameField] = useState('');
  const [dobField, setDobField] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [requests, setRequests] = useState<DataRequest[] | null>(null);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [requestsActionError, setRequestsActionError] = useState<string | null>(null);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const [newType, setNewType] = useState<'deletion' | 'amendment'>('deletion');
  const [newReason, setNewReason] = useState('');
  const [creatingBusy, setCreatingBusy] = useState(false);
  const [creatingError, setCreatingError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Patient>(`/patients/${patientId}`, token)
      .then((p) => {
        setPatient(p);
        setNameField(p.name);
        setDobField(p.dateOfBirth.slice(0, 10));
      })
      .catch((err) => setPatientError(err instanceof Error ? err.message : 'Failed to load patient'));
  }, [patientId, token]);

  useEffect(() => {
    apiFetch<DataRequest[]>(`/patients/${patientId}/data-requests`, token)
      .then(setRequests)
      .catch((err) =>
        setRequestsError(err instanceof Error ? err.message : 'Failed to load data requests'),
      );
  }, [patientId, token]);

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    setEditBusy(true);
    setEditError(null);
    setSaved(false);
    try {
      const updated = await apiFetch<Patient>(`/patients/${patientId}`, token, {
        method: 'PATCH',
        body: JSON.stringify({
          name: nameField,
          dateOfBirth: dobField,
        } satisfies UpdatePatientPayload),
      });
      setPatient(updated);
      setSaved(true);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to save patient');
    } finally {
      setEditBusy(false);
    }
  }

  async function handleCreateRequest(e: FormEvent) {
    e.preventDefault();
    setCreatingBusy(true);
    setCreatingError(null);
    try {
      const created = await apiFetch<DataRequest>(`/patients/${patientId}/data-requests`, token, {
        method: 'POST',
        body: JSON.stringify({
          requestType: newType,
          reason: newReason || undefined,
        } satisfies CreateDataRequestPayload),
      });
      setRequests((prev) => (prev ? [created, ...prev] : [created]));
      setNewReason('');
      setNewType('deletion');
    } catch (err) {
      setCreatingError(err instanceof Error ? err.message : 'Failed to log data request');
    } finally {
      setCreatingBusy(false);
    }
  }

  async function handleResolve(request: DataRequest, status: 'approved' | 'denied') {
    setRequestsActionError(null);
    setBusyRequestId(request.id);
    try {
      const updated = await apiFetch<DataRequest>(
        `/patients/${patientId}/data-requests/${request.id}`,
        token,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status,
            resolutionNote: noteDraft[request.id]?.trim() || undefined,
          } satisfies ResolveDataRequestPayload),
        },
      );
      setRequests((prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? prev);
    } catch (err) {
      setRequestsActionError(err instanceof Error ? err.message : 'Failed to resolve data request');
    } finally {
      setBusyRequestId(null);
    }
  }

  return (
    <div className="page">
      <button type="button" className="link-button back-link" onClick={onBack}>
        ← Back to patients
      </button>

      {patientError && <p className="error">{patientError}</p>}
      {!patientError && !patient && <p className="status-line">Loading…</p>}

      {patient && (
        <div className="card">
          <h1>{patient.name}</h1>

          {saved && (
            <div className="signed-banner">
              <CheckIcon /> Saved
            </div>
          )}

          <form onSubmit={handleSaveEdit} className="form-stack form-stack-spaced">
            <label className="field">
              Full name
              <input value={nameField} onChange={(e) => setNameField(e.target.value)} required />
            </label>
            <label className="field">
              Date of birth
              <input
                type="date"
                value={dobField}
                onChange={(e) => setDobField(e.target.value)}
                required
              />
            </label>
            {editError && <p className="error">{editError}</p>}
            <button type="submit" className="btn btn-primary" disabled={editBusy}>
              {editBusy ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </div>
      )}

      {patient && (
        <div className="card data-requests-card">
          <h1>Data requests</h1>
          <p className="auth-subtitle">
            Deletion and amendment requests are logged for review. Nothing here deletes or changes
            clinical records automatically.
          </p>

          {requestsError && <p className="error">{requestsError}</p>}
          {requestsActionError && <p className="error">{requestsActionError}</p>}
          {!requestsError && !requests && <p className="status-line">Loading…</p>}

          {requests && requests.length === 0 && <p className="status-line">No data requests logged.</p>}

          {requests && requests.length > 0 && (
            <table className="encounter-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Resolution</th>
                  <th>Logged</th>
                  {me.role === 'ADMIN' && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td>{r.requestType}</td>
                    <td>{r.reason ?? '—'}</td>
                    <td>
                      <span className={`status-badge status-${r.status}`}>{r.status}</span>
                    </td>
                    <td>{r.status === 'pending' ? '—' : r.resolutionNote ?? '—'}</td>
                    <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                    {me.role === 'ADMIN' && (
                      <td>
                        {r.status === 'pending' && (
                          <div className="request-actions">
                            <label className="field request-note-field">
                              Note
                              <input
                                value={noteDraft[r.id] ?? ''}
                                onChange={(e) =>
                                  setNoteDraft((prev) => ({ ...prev, [r.id]: e.target.value }))
                                }
                              />
                            </label>
                            <ConfirmButton
                              key={`${r.id}-approve`}
                              label="Approve"
                              className="btn btn-secondary btn-sm"
                              busy={busyRequestId === r.id}
                              onConfirm={() => handleResolve(r, 'approved')}
                            />
                            <ConfirmButton
                              key={`${r.id}-deny`}
                              label="Deny"
                              className="btn btn-danger btn-sm"
                              busy={busyRequestId === r.id}
                              onConfirm={() => handleResolve(r, 'denied')}
                            />
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <form onSubmit={handleCreateRequest} className="form-stack form-stack-spaced">
            <label className="field">
              Request type
              <select value={newType} onChange={(e) => setNewType(e.target.value as 'deletion' | 'amendment')}>
                <option value="deletion">Deletion</option>
                <option value="amendment">Amendment</option>
              </select>
            </label>
            <label className="field">
              Reason (optional)
              <textarea value={newReason} onChange={(e) => setNewReason(e.target.value)} rows={2} />
            </label>
            {creatingError && <p className="error">{creatingError}</p>}
            <button type="submit" className="btn btn-secondary" disabled={creatingBusy}>
              {creatingBusy ? 'Logging…' : 'Log request'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
