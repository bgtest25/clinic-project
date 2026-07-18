import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import type { ClinicalNote } from '../api/types';

type FormState = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  suggestedCodes: string;
};

const NOTE_FIELDS = ['subjective', 'objective', 'assessment', 'plan'] as const;
const MOCK_MARKER = '[MOCK NOTE';

function toForm(note: ClinicalNote): FormState {
  return {
    subjective: note.subjective ?? '',
    objective: note.objective ?? '',
    assessment: note.assessment ?? '',
    plan: note.plan ?? '',
    suggestedCodes: note.suggestedCodes ?? '',
  };
}

export function NoteReview({
  token,
  encounterId,
  transcript,
}: {
  token: string;
  encounterId: string;
  transcript: string | null;
}) {
  const [note, setNote] = useState<ClinicalNote | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ClinicalNote>(`/encounters/${encounterId}/note`, token)
      .then((n) => {
        setNote(n);
        setForm(toForm(n));
        setEditing(n.status !== 'SIGNED');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load the note'));
  }, [encounterId, token]);

  async function handleSave() {
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await apiFetch<ClinicalNote>(`/encounters/${encounterId}/note`, token, {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      setNote(updated);
      setForm(toForm(updated));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the note');
    } finally {
      setBusy(false);
    }
  }

  async function handleSign() {
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/encounters/${encounterId}/note`, token, {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      const signed = await apiFetch<ClinicalNote>(`/encounters/${encounterId}/note/sign`, token, {
        method: 'POST',
      });
      setNote(signed);
      setForm(toForm(signed));
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign the note');
    } finally {
      setBusy(false);
    }
  }

  if (error && !note) {
    return (
      <div className="panel">
        <p className="error">{error}</p>
      </div>
    );
  }

  if (!note || !form) {
    return <div className="panel">Loading note…</div>;
  }

  const isMock = NOTE_FIELDS.some((field) => form[field].includes(MOCK_MARKER));
  const locked = note.status === 'SIGNED' && !editing;

  return (
    <div className="review-panel">
      <h1>
        Visit note — {note.status}
        {note.version > 1 ? ` (v${note.version})` : ''}
      </h1>

      {isMock && (
        <p className="notice">
          This is placeholder content — Bedrock model access is still pending, so the pipeline generated a
          mock note instead of a real AI draft.
        </p>
      )}

      {note.status === 'SIGNED' && (
        <p className="status-line">
          Signed {note.signedAt ? new Date(note.signedAt).toLocaleString() : ''}
        </p>
      )}

      <div className="review-columns">
        <div className="transcript-pane">
          <h2>Transcript</h2>
          <p className="transcript-text">{transcript ?? 'No transcript available.'}</p>
        </div>

        <div className="note-form">
          {NOTE_FIELDS.map((field) => (
            <label key={field}>
              {field[0].toUpperCase() + field.slice(1)}
              <textarea
                value={form[field]}
                disabled={locked}
                rows={4}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              />
            </label>
          ))}
          <label>
            Suggested codes
            <input
              value={form.suggestedCodes}
              disabled={locked}
              onChange={(e) => setForm({ ...form, suggestedCodes: e.target.value })}
            />
          </label>

          {error && <p className="error">{error}</p>}

          <div className="review-actions">
            {locked ? (
              <button onClick={() => setEditing(true)}>Edit (creates an amendment)</button>
            ) : (
              <>
                <button onClick={handleSave} disabled={busy}>
                  {busy ? 'Saving…' : 'Save draft'}
                </button>
                <button onClick={handleSign} disabled={busy}>
                  {busy ? 'Signing…' : 'Sign note'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
