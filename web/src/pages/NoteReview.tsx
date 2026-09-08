import { useEffect, useMemo, useState } from 'react';
import { apiDownload, apiFetch } from '../api/client';
import type { Clinic, ClinicalNote, DiarizedSegment, Patient, PriorAuth, ReferralLetter } from '../api/types';
import { CheckIcon, PrintIcon, StarIcon, DocumentIcon } from '../icons';
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
  diarizedSegments = null,
  speakerLabels = null,
  onSpeakerLabelsChange,
  suggestedSpeakerRoles = null,
  patient = null,
  visitDate = null,
  clinic = null,
}: {
  token: string;
  encounterId: string;
  transcript: string | null;
  diarizedSegments?: DiarizedSegment[] | null;
  speakerLabels?: Record<string, string> | null;
  onSpeakerLabelsChange?: (labels: Record<string, string>) => void;
  suggestedSpeakerRoles?: Record<string, string> | null;
  patient?: Patient | null;
  visitDate?: string | null;
  clinic?: Clinic | null;
}) {
  const { showToast } = useToast();
  const hasSpeakerView = !!diarizedSegments && diarizedSegments.length > 0;
  // Automated diarization on real recordings has been noisy (the same
  // speaker can jump labels mid-conversation) — default to it when
  // available since it's usually still more scannable than one unbroken
  // paragraph, but always leave the raw block one click away for a
  // clinician who wants to double-check against the unsegmented original.
  const [transcriptView, setTranscriptView] = useState<'speaker' | 'raw'>(hasSpeakerView ? 'speaker' : 'raw');
  // Speaker labels are never inferred automatically (see the notice in the
  // speaker view below) — this is the clinician's own assignment, made
  // after the fact having actually been in the room. Initialized from
  // whatever's already been saved for this encounter; each assignment below
  // is saved immediately, not batched behind a form submit.
  const [speakerLabelsState, setSpeakerLabelsState] = useState<Record<string, string>>(speakerLabels ?? {});
  const [savingSpeaker, setSavingSpeaker] = useState<string | null>(null);
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
  const [avsGenerating, setAvsGenerating] = useState(false);
  const [avsError, setAvsError] = useState<string | null>(null);
  const [referralLetters, setReferralLetters] = useState<ReferralLetter[]>([]);
  const [referralSpecialty, setReferralSpecialty] = useState('');
  const [referralReason, setReferralReason] = useState('');
  const [referralGenerating, setReferralGenerating] = useState(false);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [expandedReferral, setExpandedReferral] = useState<string | null>(null);
  const [priorAuths, setPriorAuths] = useState<PriorAuth[]>([]);
  const [priorAuthProcedure, setPriorAuthProcedure] = useState('');
  const [priorAuthDiagnosis, setPriorAuthDiagnosis] = useState('');
  const [priorAuthInsurer, setPriorAuthInsurer] = useState('');
  const [priorAuthGenerating, setPriorAuthGenerating] = useState(false);
  const [priorAuthError, setPriorAuthError] = useState<string | null>(null);
  const [expandedPriorAuth, setExpandedPriorAuth] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ClinicalNote>(`/encounters/${encounterId}/note`, token)
      .then((n) => {
        setNote(n);
        setForm(toForm(n));
        setEditing(n.status !== 'SIGNED');
        if (n.status === 'SIGNED') {
          apiFetch<ReferralLetter[]>(`/encounters/${encounterId}/note/referrals`, token)
            .then(setReferralLetters)
            .catch(() => {});
          apiFetch<PriorAuth[]>(`/encounters/${encounterId}/note/prior-auths`, token)
            .then(setPriorAuths)
            .catch(() => {});
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load the note'));
  }, [encounterId, token]);

  // Raw diarization speaker keys ("spk_0"), in first-appearance order —
  // shared by the legend and the per-turn labels below so both agree on
  // which one is "Speaker 1" vs "Speaker 2".
  const speakerOrder = useMemo(() => {
    if (!diarizedSegments) return [] as Array<[string, number]>;
    const order = new Map<string, number>();
    for (const segment of diarizedSegments) {
      if (!order.has(segment.speaker)) order.set(segment.speaker, order.size + 1);
    }
    return [...order.entries()];
  }, [diarizedSegments]);

  function speakerDisplayLabel(rawKey: string, displayNumber: number): string {
    return speakerLabelsState[rawKey] ?? `Speaker ${displayNumber}`;
  }

  async function assignSpeakerLabel(rawKey: string, label: string) {
    setSavingSpeaker(rawKey);
    try {
      await apiFetch(`/encounters/${encounterId}/transcript/speaker-labels`, token, {
        method: 'PATCH',
        body: JSON.stringify({ labels: [{ speaker: rawKey, label }] }),
      });
      const next = { ...speakerLabelsState, [rawKey]: label };
      setSpeakerLabelsState(next);
      onSpeakerLabelsChange?.(next);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save the speaker label', 'error');
    } finally {
      setSavingSpeaker(null);
    }
  }

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

  async function handleGenerateAvs() {
    setAvsGenerating(true);
    setAvsError(null);
    try {
      const updated = await apiFetch<ClinicalNote>(`/encounters/${encounterId}/note/avs`, token, {
        method: 'POST',
      });
      setNote(updated);
      showToast('Patient summary generated.');
    } catch (err) {
      setAvsError(err instanceof Error ? err.message : 'Failed to generate patient summary');
    } finally {
      setAvsGenerating(false);
    }
  }

  function handlePrintAvs() {
    if (!note?.afterVisitSummary) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Patient Visit Summary</title>
          <style>
            body { font-family: system-ui, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; line-height: 1.6; }
            h1 { font-size: 1.4rem; margin-bottom: 0.5rem; }
            .meta { color: #666; margin-bottom: 1.5rem; font-size: 0.9rem; }
            .content { white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <h1>Visit Summary</h1>
          <div class="meta">${patient?.name || 'Patient'} &middot; ${visitDate ? new Date(visitDate).toLocaleDateString() : ''}</div>
          <div class="content">${note.afterVisitSummary}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }

  async function handleGenerateReferral() {
    if (!referralSpecialty.trim() || !referralReason.trim()) return;
    setReferralGenerating(true);
    setReferralError(null);
    try {
      const letter = await apiFetch<ReferralLetter>(`/encounters/${encounterId}/note/referrals`, token, {
        method: 'POST',
        body: JSON.stringify({ specialty: referralSpecialty.trim(), reason: referralReason.trim() }),
      });
      setReferralLetters((prev) => [letter, ...prev]);
      setReferralSpecialty('');
      setReferralReason('');
      setExpandedReferral(letter.id);
      showToast('Referral letter generated.');
    } catch (err) {
      setReferralError(err instanceof Error ? err.message : 'Failed to generate referral letter');
    } finally {
      setReferralGenerating(false);
    }
  }

  async function handleGeneratePriorAuth() {
    if (!priorAuthProcedure.trim()) return;
    setPriorAuthGenerating(true);
    setPriorAuthError(null);
    try {
      const priorAuth = await apiFetch<PriorAuth>(`/encounters/${encounterId}/note/prior-auths`, token, {
        method: 'POST',
        body: JSON.stringify({
          procedureOrMed: priorAuthProcedure.trim(),
          diagnosisCode: priorAuthDiagnosis.trim() || undefined,
          insurerName: priorAuthInsurer.trim() || undefined,
        }),
      });
      setPriorAuths((prev) => [priorAuth, ...prev]);
      setPriorAuthProcedure('');
      setPriorAuthDiagnosis('');
      setPriorAuthInsurer('');
      setExpandedPriorAuth(priorAuth.id);
      showToast('Prior authorization generated.');
    } catch (err) {
      setPriorAuthError(err instanceof Error ? err.message : 'Failed to generate prior authorization');
    } finally {
      setPriorAuthGenerating(false);
    }
  }

  function handlePrintPriorAuth(pa: PriorAuth) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Prior Authorization - ${pa.procedureOrMed}</title>
          <style>
            body { font-family: system-ui, sans-serif; max-width: 700px; margin: 40px auto; padding: 20px; line-height: 1.6; }
            h1 { font-size: 1.4rem; margin-bottom: 0.5rem; }
            .meta { color: #666; margin-bottom: 1.5rem; font-size: 0.9rem; }
            .content { white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <h1>Prior Authorization Request</h1>
          <div class="meta">
            ${patient?.name || 'Patient'} &middot; ${visitDate ? new Date(visitDate).toLocaleDateString() : ''}
            ${pa.diagnosisCode ? ` &middot; ${pa.diagnosisCode}` : ''}
            ${pa.insurerName ? ` &middot; ${pa.insurerName}` : ''}
          </div>
          <div class="content">${pa.clinicalRationale}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }

  function handlePrintReferral(letter: ReferralLetter) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Referral Letter - ${letter.specialty}</title>
          <style>
            body { font-family: system-ui, sans-serif; max-width: 700px; margin: 40px auto; padding: 20px; line-height: 1.6; }
            h1 { font-size: 1.4rem; margin-bottom: 0.5rem; }
            .meta { color: #666; margin-bottom: 1.5rem; font-size: 0.9rem; }
            .content { white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <h1>Referral to ${letter.specialty}</h1>
          <div class="meta">${patient?.name || 'Patient'} &middot; ${visitDate ? new Date(visitDate).toLocaleDateString() : ''}</div>
          <div class="content">${letter.letterContent}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
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
          This is placeholder content. Bedrock model access is still pending, so the pipeline generated a
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

      {note.status === 'SIGNED' && (
        <div className="card avs-card">
          <h2>
            <DocumentIcon /> Patient Summary
          </h2>
          {note.afterVisitSummary ? (
            <>
              <div className="avs-content">{note.afterVisitSummary}</div>
              <div className="avs-actions">
                <button className="btn btn-secondary" onClick={handlePrintAvs}>
                  <PrintIcon /> Print for patient
                </button>
                <button className="btn btn-ghost" onClick={handleGenerateAvs} disabled={avsGenerating}>
                  {avsGenerating ? 'Regenerating…' : 'Regenerate'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="avs-description">
                Generate a plain-language summary of this visit for the patient to take home.
              </p>
              {avsError && <p className="error">{avsError}</p>}
              <button className="btn btn-primary" onClick={handleGenerateAvs} disabled={avsGenerating}>
                {avsGenerating ? 'Generating…' : 'Generate Patient Summary'}
              </button>
            </>
          )}
        </div>
      )}

      {note.status === 'SIGNED' && (
        <div className="card referral-card">
          <h2>
            <DocumentIcon /> Referral Letters
          </h2>
          <div className="referral-form">
            <label className="field">
              Specialty
              <select
                value={referralSpecialty}
                onChange={(e) => setReferralSpecialty(e.target.value)}
                disabled={referralGenerating}
              >
                <option value="">Select specialty...</option>
                <option value="Cardiology">Cardiology</option>
                <option value="Dermatology">Dermatology</option>
                <option value="Endocrinology">Endocrinology</option>
                <option value="Gastroenterology">Gastroenterology</option>
                <option value="Hematology">Hematology</option>
                <option value="Nephrology">Nephrology</option>
                <option value="Neurology">Neurology</option>
                <option value="Oncology">Oncology</option>
                <option value="Ophthalmology">Ophthalmology</option>
                <option value="Orthopedics">Orthopedics</option>
                <option value="Otolaryngology (ENT)">Otolaryngology (ENT)</option>
                <option value="Psychiatry">Psychiatry</option>
                <option value="Pulmonology">Pulmonology</option>
                <option value="Rheumatology">Rheumatology</option>
                <option value="Urology">Urology</option>
              </select>
            </label>
            <label className="field">
              Reason for referral
              <textarea
                value={referralReason}
                onChange={(e) => setReferralReason(e.target.value)}
                rows={2}
                placeholder="e.g., Elevated BP despite lifestyle modifications, requesting evaluation for secondary causes"
                disabled={referralGenerating}
              />
            </label>
            {referralError && <p className="error">{referralError}</p>}
            <button
              className="btn btn-primary"
              onClick={handleGenerateReferral}
              disabled={referralGenerating || !referralSpecialty.trim() || !referralReason.trim()}
            >
              {referralGenerating ? 'Generating…' : 'Generate Referral Letter'}
            </button>
          </div>
          {referralLetters.length > 0 && (
            <div className="referral-list">
              <h3>Generated Letters</h3>
              {referralLetters.map((letter) => (
                <div key={letter.id} className="referral-item">
                  <button
                    type="button"
                    className="referral-item-header"
                    onClick={() => setExpandedReferral(expandedReferral === letter.id ? null : letter.id)}
                  >
                    <span className="referral-item-specialty">{letter.specialty}</span>
                    <span className="referral-item-date">
                      {new Date(letter.createdAt).toLocaleDateString()}
                    </span>
                  </button>
                  {expandedReferral === letter.id && (
                    <div className="referral-item-content">
                      <div className="referral-item-reason">
                        <strong>Reason:</strong> {letter.reason}
                      </div>
                      <div className="referral-item-letter">{letter.letterContent}</div>
                      <div className="referral-item-actions">
                        <button className="btn btn-secondary" onClick={() => handlePrintReferral(letter)}>
                          <PrintIcon /> Print
                        </button>
                        <button
                          className="btn btn-ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(letter.letterContent);
                            showToast('Letter copied to clipboard.');
                          }}
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {note.status === 'SIGNED' && (
        <div className="card prior-auth-card">
          <h2>
            <DocumentIcon /> Prior Authorizations
          </h2>
          <div className="prior-auth-form">
            <label className="field">
              Procedure / Medication
              <input
                type="text"
                value={priorAuthProcedure}
                onChange={(e) => setPriorAuthProcedure(e.target.value)}
                placeholder="e.g., MRI Brain, Humira 40mg"
                disabled={priorAuthGenerating}
                maxLength={200}
              />
            </label>
            <label className="field">
              Diagnosis Code (optional)
              <input
                type="text"
                value={priorAuthDiagnosis}
                onChange={(e) => setPriorAuthDiagnosis(e.target.value)}
                placeholder="e.g., G43.909"
                disabled={priorAuthGenerating}
                maxLength={20}
              />
            </label>
            <label className="field">
              Insurance (optional)
              <input
                type="text"
                value={priorAuthInsurer}
                onChange={(e) => setPriorAuthInsurer(e.target.value)}
                placeholder="e.g., Blue Cross Blue Shield"
                disabled={priorAuthGenerating}
                maxLength={100}
              />
            </label>
            {priorAuthError && <p className="error">{priorAuthError}</p>}
            <button
              className="btn btn-primary"
              onClick={handleGeneratePriorAuth}
              disabled={priorAuthGenerating || !priorAuthProcedure.trim()}
            >
              {priorAuthGenerating ? 'Generating…' : 'Generate Prior Authorization'}
            </button>
          </div>
          {priorAuths.length > 0 && (
            <div className="prior-auth-list">
              <h3>Generated Authorizations</h3>
              {priorAuths.map((pa) => (
                <div key={pa.id} className="prior-auth-item">
                  <button
                    type="button"
                    className="prior-auth-item-header"
                    onClick={() => setExpandedPriorAuth(expandedPriorAuth === pa.id ? null : pa.id)}
                  >
                    <span className="prior-auth-item-procedure">{pa.procedureOrMed}</span>
                    <span className="prior-auth-item-date">
                      {new Date(pa.createdAt).toLocaleDateString()}
                    </span>
                  </button>
                  {expandedPriorAuth === pa.id && (
                    <div className="prior-auth-item-content">
                      {pa.diagnosisCode && (
                        <div className="prior-auth-item-meta">
                          <strong>Diagnosis:</strong> {pa.diagnosisCode}
                        </div>
                      )}
                      {pa.insurerName && (
                        <div className="prior-auth-item-meta">
                          <strong>Insurance:</strong> {pa.insurerName}
                        </div>
                      )}
                      <div className="prior-auth-item-rationale">{pa.clinicalRationale}</div>
                      <div className="prior-auth-item-actions">
                        <button className="btn btn-secondary" onClick={() => handlePrintPriorAuth(pa)}>
                          <PrintIcon /> Print
                        </button>
                        <button
                          className="btn btn-ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(pa.clinicalRationale);
                            showToast('Prior auth copied to clipboard.');
                          }}
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="review-columns">
        <div className="transcript-pane">
          <div className="transcript-pane-header">
            <h2>Transcript</h2>
            {hasSpeakerView && (
              <div className="transcript-view-toggle" role="group" aria-label="Transcript view">
                <button
                  type="button"
                  className={`btn btn-sm ${transcriptView === 'speaker' ? 'btn-secondary' : 'btn-ghost'}`}
                  aria-pressed={transcriptView === 'speaker'}
                  onClick={() => setTranscriptView('speaker')}
                >
                  Speaker view
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${transcriptView === 'raw' ? 'btn-secondary' : 'btn-ghost'}`}
                  aria-pressed={transcriptView === 'raw'}
                  onClick={() => setTranscriptView('raw')}
                >
                  Raw text
                </button>
              </div>
            )}
          </div>
          {hasSpeakerView && transcriptView === 'speaker' ? (
            <div className="transcript-speaker-view">
              {/* Diarization is best-effort, not verified per-turn, and the
                  same speaker can jump labels mid-conversation on real
                  recordings — labels default to generic ("Speaker 1/2")
                  rather than guessing Clinician/Patient automatically, since
                  a wrong role label here would be taken as fact rather than
                  the estimate it is. Claude may propose a role below (from
                  the same call that drafted this note) when it's confident,
                  but that's only ever a suggestion — it never overwrites the
                  generic label until you click Confirm. You were in the
                  room, though — assign who's who below and it's saved with
                  this visit. */}
              <div className="transcript-speaker-legend">
                {speakerOrder.map(([rawKey, num]) => {
                  const current = speakerDisplayLabel(rawKey, num);
                  const saving = savingSpeaker === rawKey;
                  const isPreset = current === 'Clinician' || (!!patient?.name && current === patient.name);
                  const suggestion = !speakerLabelsState[rawKey] ? suggestedSpeakerRoles?.[rawKey] : undefined;
                  return (
                    <div key={rawKey} className="transcript-speaker-legend-row">
                      <span className="transcript-speaker-legend-current">{current}</span>
                      {suggestion && (
                        <div className="transcript-speaker-legend-suggestion">
                          <span className="transcript-speaker-legend-suggestion-text">
                            Claude suggests: {suggestion}
                          </span>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            disabled={saving}
                            onClick={() => assignSpeakerLabel(rawKey, suggestion)}
                          >
                            Confirm
                          </button>
                        </div>
                      )}
                      <div className="transcript-speaker-legend-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          disabled={saving || current === 'Clinician'}
                          onClick={() => assignSpeakerLabel(rawKey, 'Clinician')}
                        >
                          Clinician
                        </button>
                        {patient?.name && (
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            disabled={saving || current === patient.name}
                            onClick={() => assignSpeakerLabel(rawKey, patient.name!)}
                          >
                            {patient.name}
                          </button>
                        )}
                        <input
                          key={`${rawKey}-${current}`}
                          type="text"
                          className="transcript-speaker-legend-custom"
                          placeholder="Other (e.g. Interpreter)"
                          defaultValue={isPreset ? '' : speakerLabelsState[rawKey] ?? ''}
                          disabled={saving}
                          maxLength={100}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter') return;
                            const value = e.currentTarget.value.trim();
                            if (value) assignSpeakerLabel(rawKey, value);
                          }}
                          onBlur={(e) => {
                            const value = e.currentTarget.value.trim();
                            if (value && value !== speakerLabelsState[rawKey]) assignSpeakerLabel(rawKey, value);
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {diarizedSegments!.map((segment, i) => {
                const num = speakerOrder.find(([key]) => key === segment.speaker)?.[1] ?? 0;
                return (
                  <p key={i} className="transcript-turn">
                    <span className="transcript-speaker-label">{speakerDisplayLabel(segment.speaker, num)}</span>
                    {segment.text}
                  </p>
                );
              })}
            </div>
          ) : (
            <p className="transcript-text">{transcript ?? 'No transcript available.'}</p>
          )}
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
