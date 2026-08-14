import { useEffect, useState } from 'react';
import { apiDownload, apiFetch } from '../api/client';
import type { Clinic, ClinicalNote, Patient } from '../api/types';
import { CheckIcon, PrintIcon, StarIcon } from '../icons';
import { CodePicker } from '../components/CodePicker';
import { TemplateMenu } from '../components/TemplateMenu';
import { Skeleton } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import type { TemplateField } from '../utils/templates';

type FormState = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  suggestedCodes: string;
};

const NOTE_FIELDS = ['subjective', 'objective', 'assessment', 'plan'] as const;
const MOCK_MARKER = '[MOCK NOTE';

const SECTION_TITLES: Record<(typeof NOTE_FIELDS)[number], string> = {
  subjective: 'Subjective',
  objective: 'Objective',
  assessment: 'Assessment',
  plan: 'Plan',
};

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
  patient = null,
  visitDate = null,
  clinic = null,
}: {
  token: string;
  encounterId: string;
  transcript: string | null;
  patient?: Patient | null;
  visitDate?: string | null;
  clinic?: Clinic | null;
}) {
  const { showToast } = useToast();
  const [note, setNote] = useState<ClinicalNote | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

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
      showToast('Draft saved.');
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
      showToast('Note signed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign the note');
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadPdf() {
    setError(null);
    try {
      await apiDownload(`/encounters/${encounterId}/note/pdf`, token, `visit-note-${encounterId}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download the PDF');
    }
  }

  async function handleSubmitFeedback() {
    if (!feedbackRating) return;
    setFeedbackBusy(true);
    setFeedbackError(null);
    try {
      const updated = await apiFetch<ClinicalNote>(`/encounters/${encounterId}/note/feedback`, token, {
        method: 'POST',
        body: JSON.stringify({ rating: feedbackRating, comment: feedbackComment || undefined }),
      });
      setNote(updated);
      showToast('Feedback submitted.');
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setFeedbackBusy(false);
    }
  }

  async function handleCopy() {
    if (!form) return;
    const text = [
      ...NOTE_FIELDS.map((field) => `${SECTION_TITLES[field]}:\n${form[field] || '—'}`),
      form.suggestedCodes ? `Suggested codes:\n${form.suggestedCodes}` : null,
    ]
      .filter(Boolean)
      .join('\n\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Failed to copy the note to your clipboard');
    }
  }

  function handlePrint() {
    window.print();
  }

  if (error && !note) {
    return (
      <div className="page">
        <p className="error">{error}</p>
      </div>
    );
  }

  if (!note || !form) {
    return (
      <div className="page page-wide">
        <div className="card" aria-label="Loading note" role="status">
          <Skeleton className="skeleton-line" style={{ width: '40%', height: '1.5rem', marginBottom: '1rem' }} />
          <Skeleton className="skeleton-line" style={{ height: '5rem', marginBottom: '0.75rem' }} />
          <Skeleton className="skeleton-line" style={{ height: '5rem', marginBottom: '0.75rem' }} />
          <Skeleton className="skeleton-line" style={{ height: '5rem' }} />
        </div>
      </div>
    );
  }

  const isMock = NOTE_FIELDS.some((field) => form[field].includes(MOCK_MARKER));
  const locked = note.status === 'SIGNED' && !editing;

  return (
    <div className="page page-wide">
      <div className="print-header">
        {clinic && <p className="print-clinic-name">{clinic.name}</p>}
        {patient && (
          <p>
            Patient: {patient.name} · DOB {new Date(patient.dateOfBirth).toLocaleDateString()}
          </p>
        )}
        {visitDate && <p>Visit date: {new Date(visitDate).toLocaleDateString()}</p>}
        <p>
          Status: {note.status}
          {note.signedAt ? ` · Signed ${new Date(note.signedAt).toLocaleString()}` : ''}
        </p>
      </div>

      {/* Print-only: textareas only print their visible scrolled area, so the printable
          note body is rendered as plain text here rather than reusing .note-form. */}
      <div className="print-note-body">
        {NOTE_FIELDS.map((field) => (
          <div className="print-note-section" key={field}>
            <h3>{SECTION_TITLES[field]}</h3>
            <p>{form[field] || '—'}</p>
          </div>
        ))}
        {form.suggestedCodes && (
          <div className="print-note-section">
            <h3>Suggested codes</h3>
            <p>{form.suggestedCodes}</p>
          </div>
        )}
      </div>

      <div className="review-header">
        <h1>
          Visit note
          <span className="status-badge">
            {note.status}
            {note.version > 1 ? ` · v${note.version}` : ''}
          </span>
        </h1>
      </div>

      {isMock && (
        <p className="notice">
          This is placeholder content — Bedrock model access is still pending, so the pipeline generated a
          mock note instead of a real AI draft.
        </p>
      )}

      {note.status === 'SIGNED' && (
        <div className="signed-banner">
          <CheckIcon />
          Signed {note.signedAt ? new Date(note.signedAt).toLocaleString() : ''}
        </div>
      )}

      {note.status === 'SIGNED' &&
        (note.satisfactionRating ? (
          <div className="card feedback-card feedback-submitted">
            <div className="star-row" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((n) => (
                <StarIcon key={n} filled={n <= note.satisfactionRating!} />
              ))}
            </div>
            <p className="status-line">Thanks for your feedback on this draft.</p>
          </div>
        ) : (
          <div className="card feedback-card">
            <h2>How was this draft?</h2>
            <div className="star-row">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className="star-button"
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}
                  onClick={() => setFeedbackRating(n)}
                >
                  <StarIcon filled={n <= feedbackRating} />
                </button>
              ))}
            </div>
            <label className="field">
              Comment (optional)
              <textarea
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                rows={2}
                placeholder="Anything that made this draft better or worse?"
              />
            </label>
            {feedbackError && <p className="error">{feedbackError}</p>}
            <button
              className="btn btn-secondary"
              onClick={handleSubmitFeedback}
              disabled={feedbackBusy || !feedbackRating}
            >
              {feedbackBusy ? 'Submitting…' : 'Submit feedback'}
            </button>
          </div>
        ))}

      <div className="review-columns">
        <div className="transcript-pane">
          <h2>Transcript</h2>
          <p className="transcript-text">{transcript ?? 'No transcript available.'}</p>
        </div>

        <div className="card note-form">
          {NOTE_FIELDS.map((field) => (
            <label key={field} className="field">
              <span className="note-section-label-row">
                <span className="note-section-label">{field}</span>
                {!locked && (
                  <TemplateMenu
                    field={field as TemplateField}
                    currentText={form[field]}
                    onInsert={(phrase) =>
                      setForm({
                        ...form,
                        [field]: form[field] ? `${form[field]}\n${phrase}` : phrase,
                      })
                    }
                  />
                )}
              </span>
              <textarea
                value={form[field]}
                disabled={locked}
                rows={4}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              />
            </label>
          ))}
          <div className="field">
            <span className="note-section-label">Suggested codes</span>
            <CodePicker
              value={form.suggestedCodes}
              disabled={locked}
              onChange={(codes) => setForm({ ...form, suggestedCodes: codes })}
            />
          </div>

          {error && <p className="error">{error}</p>}

          <div className="review-actions">
            {locked ? (
              <button className="btn btn-secondary" onClick={() => setEditing(true)}>
                Edit (creates an amendment)
              </button>
            ) : (
              <>
                <button className="btn btn-secondary" onClick={handleSave} disabled={busy}>
                  {busy ? 'Saving…' : 'Save draft'}
                </button>
                <button className="btn btn-primary" onClick={handleSign} disabled={busy}>
                  {busy ? 'Signing…' : 'Sign note'}
                </button>
              </>
            )}
            <button className="btn btn-ghost" onClick={handleCopy} type="button">
              {copied ? 'Copied!' : 'Copy note'}
            </button>
            <button className="btn btn-ghost" onClick={handleDownloadPdf} type="button">
              Download PDF
            </button>
            <button className="btn btn-ghost" onClick={handlePrint} type="button">
              <PrintIcon /> Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
