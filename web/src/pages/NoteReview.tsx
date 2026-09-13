import { useEffect, useMemo, useRef, useState } from 'react';
import { apiDownload, apiFetch, apiOpenPdf } from '../api/client';
import type { Clinic, ClinicalNote, DiarizedSegment, Patient, PriorAuth, ReferralLetter } from '../api/types';
import { CheckIcon, PrintIcon, StarIcon, DocumentIcon, DownloadIcon } from '../icons';
import { CareGapAlerts } from '../components/CareGapAlerts';
import { ClinicalQA } from '../components/ClinicalQA';
import { CodePicker } from '../components/CodePicker';
import { CptCodeSuggestions } from '../components/CptCodeSuggestions';
import { EmLevelSuggestion } from '../components/EmLevelSuggestion';
import { OrderSuggestions } from '../components/OrderSuggestions';
import { PatientInstructions } from '../components/PatientInstructions';
import { TemplateMenu } from '../components/TemplateMenu';
import { VisitTemplateSelector } from '../components/VisitTemplateSelector';
import { Skeleton } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { getUserFriendlyError, getLoadError, getSaveError } from '../utils/errorMessages';
import type { TemplateField } from '../utils/templates';
import { LANGUAGES, type SupportedLanguage } from '../utils/translations';
import type { VisitTemplate } from '../utils/visitTemplates';

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
  const [avsLanguage, setAvsLanguage] = useState<SupportedLanguage>('en');
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
  const [showSignConfirm, setShowSignConfirm] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Ref to store save function for keyboard shortcut access
  const saveRef = useRef<(() => void) | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedFormRef = useRef<string | null>(null);

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
      .catch((err) => setError(getLoadError(err, 'the note')));
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
      setError(getSaveError(err, 'the note'));
    } finally {
      setBusy(false);
    }
  }

  async function handleSign() {
    if (!form) return;
    setShowSignConfirm(false);
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
      setError(getUserFriendlyError(err, 'Failed to sign the note. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  // Update ref for keyboard shortcut access
  saveRef.current = handleSave;

  // Keyboard shortcuts: Cmd+S = save, Cmd+Enter = sign
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!editing || busy) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveRef.current?.();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (note?.status !== 'SIGNED') {
          setShowSignConfirm(true);
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editing, busy, note?.status]);

  // Auto-save: debounce 2s after form changes, only when editing
  useEffect(() => {
    if (!editing || !form || busy || note?.status === 'SIGNED') return;

    const formJson = JSON.stringify(form);
    if (formJson === lastSavedFormRef.current) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      setAutoSaveStatus('saving');
      try {
        await apiFetch<ClinicalNote>(`/encounters/${encounterId}/note`, token, {
          method: 'PATCH',
          body: formJson,
        });
        lastSavedFormRef.current = formJson;
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
      } catch {
        setAutoSaveStatus('error');
      }
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [form, editing, busy, note?.status, encounterId, token]);

  // Initialize lastSavedFormRef when note loads
  useEffect(() => {
    if (form && !lastSavedFormRef.current) {
      lastSavedFormRef.current = JSON.stringify(form);
    }
  }, [form]);

  // Warn on unsaved changes when navigating away
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!editing || !form) return;
      const hasUnsavedChanges = JSON.stringify(form) !== lastSavedFormRef.current;
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [editing, form]);

  async function handleDownloadPdf() {
    setError(null);
    try {
      await apiDownload(`/encounters/${encounterId}/note/pdf`, token, `visit-note-${encounterId}.pdf`);
    } catch (err) {
      setError(getUserFriendlyError(err, 'Failed to download the PDF. Please try again.'));
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

  async function handleGenerateAvs(language: SupportedLanguage = 'en') {
    setAvsGenerating(true);
    setAvsError(null);
    try {
      const updated = await apiFetch<ClinicalNote>(`/encounters/${encounterId}/note/avs`, token, {
        method: 'POST',
        body: JSON.stringify({ language }),
      });
      setNote(updated);
      const langName = language === 'es' ? 'Spanish' : 'English';
      showToast(`Patient summary generated in ${langName}.`);
    } catch (err) {
      setAvsError(err instanceof Error ? err.message : 'Failed to generate patient summary');
    } finally {
      setAvsGenerating(false);
    }
  }

  async function handlePrintAvs() {
    if (!note?.afterVisitSummary) return;
    try {
      await apiOpenPdf(`/encounters/${encounterId}/note/avs/pdf`, token);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to open PDF for printing');
    }
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

  async function handlePrintPriorAuth(pa: PriorAuth) {
    try {
      await apiOpenPdf(`/encounters/${encounterId}/note/prior-auths/${pa.id}/pdf`, token);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to open PDF for printing');
    }
  }

  async function handlePrintReferral(letter: ReferralLetter) {
    try {
      await apiOpenPdf(`/encounters/${encounterId}/note/referrals/${letter.id}/pdf`, token);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to open PDF for printing');
    }
  }

  async function handleDownloadAvsPdf() {
    try {
      await apiDownload(`/encounters/${encounterId}/note/avs/pdf`, token, `visit-summary-${encounterId}.pdf`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to download PDF');
    }
  }

  async function handleDownloadReferralPdf(letter: ReferralLetter) {
    try {
      await apiDownload(
        `/encounters/${encounterId}/note/referrals/${letter.id}/pdf`,
        token,
        `referral-${letter.specialty.toLowerCase().replace(/\s+/g, '-')}.pdf`,
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to download PDF');
    }
  }

  async function handleDownloadPriorAuthPdf(pa: PriorAuth) {
    try {
      await apiDownload(
        `/encounters/${encounterId}/note/prior-auths/${pa.id}/pdf`,
        token,
        `prior-auth-${pa.procedureOrMed.toLowerCase().replace(/\s+/g, '-')}.pdf`,
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to download PDF');
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

  function applyVisitTemplate(template: VisitTemplate) {
    setForm({
      subjective: template.subjective,
      objective: template.objective,
      assessment: template.assessment,
      plan: template.plan,
      suggestedCodes: form?.suggestedCodes ?? '',
    });
    showToast(`Applied "${template.name}" template`);
  }

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
        {editing && autoSaveStatus !== 'idle' && (
          <span className={`auto-save-indicator ${autoSaveStatus === 'saving' ? 'is-saving' : ''} ${autoSaveStatus === 'saved' ? 'is-saved' : ''} ${autoSaveStatus === 'error' ? 'is-error' : ''}`}>
            {autoSaveStatus === 'saving' && 'Saving...'}
            {autoSaveStatus === 'saved' && 'Saved'}
            {autoSaveStatus === 'error' && 'Save failed'}
          </span>
        )}
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
              <div className="transcript-speaker-legend">
                <p className="transcript-speaker-legend-title">Who's speaking?</p>
                <p className="transcript-speaker-legend-subtitle">
                  Click to assign each voice in the recording.
                </p>
                <div className="transcript-speaker-legend-grid">
                  {speakerOrder.map(([rawKey, num]) => {
                    const current = speakerDisplayLabel(rawKey, num);
                    const saving = savingSpeaker === rawKey;
                    const isAssigned = !!speakerLabelsState[rawKey];
                    const suggestion = !speakerLabelsState[rawKey] ? suggestedSpeakerRoles?.[rawKey] : undefined;
                    return (
                      <div key={rawKey} className={`transcript-speaker-card ${isAssigned ? 'assigned' : ''}`}>
                        <div className="transcript-speaker-card-header">
                          <span className="transcript-speaker-card-label">
                            {isAssigned ? current : `Speaker ${num}`}
                          </span>
                          {isAssigned && <span className="transcript-speaker-card-check">✓</span>}
                        </div>
                        {suggestion && !isAssigned && (
                          <div className="transcript-speaker-suggestion">
                            <span>AI suggests: <strong>{suggestion}</strong></span>
                            <button
                              type="button"
                              className="btn btn-xs btn-primary"
                              disabled={saving}
                              onClick={() => assignSpeakerLabel(rawKey, suggestion)}
                            >
                              Accept
                            </button>
                          </div>
                        )}
                        <div className="transcript-speaker-chips">
                          <button
                            type="button"
                            className={`speaker-chip ${current === 'Clinician' ? 'selected' : ''}`}
                            disabled={saving}
                            onClick={() => assignSpeakerLabel(rawKey, 'Clinician')}
                          >
                            Clinician
                          </button>
                          {patient?.name && (
                            <button
                              type="button"
                              className={`speaker-chip ${current === patient.name ? 'selected' : ''}`}
                              disabled={saving}
                              onClick={() => assignSpeakerLabel(rawKey, patient.name!)}
                            >
                              {patient.name}
                            </button>
                          )}
                          <input
                            key={`${rawKey}-${current}`}
                            type="text"
                            className="speaker-chip-input"
                            placeholder="Other..."
                            defaultValue={current !== 'Clinician' && current !== patient?.name && isAssigned ? current : ''}
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
              </div>
              <div className="transcript-turns">
                {diarizedSegments!.map((segment, i) => {
                  const num = speakerOrder.find(([key]) => key === segment.speaker)?.[1] ?? 0;
                  const label = speakerDisplayLabel(segment.speaker, num);
                  const isAssigned = !!speakerLabelsState[segment.speaker];
                  return (
                    <div key={i} className={`transcript-turn ${isAssigned ? 'assigned' : ''}`}>
                      <span className={`transcript-speaker-label ${isAssigned ? 'assigned' : ''}`}>{label}</span>
                      <span className="transcript-turn-text">{segment.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="transcript-text">{transcript ?? 'No transcript available.'}</p>
          )}
        </div>

        <div className="card note-form">
          {!locked && patient && (
            <CareGapAlerts
              patient={patient}
              onAddress={(gapId) => {
                const gap = gapId.replace(/-/g, ' ');
                const current = form?.plan ?? '';
                setForm({
                  ...form!,
                  plan: current ? `${current}\n- Order ${gap}` : `- Order ${gap}`,
                });
              }}
            />
          )}
          {!locked && (
            <div className="note-form-toolbar">
              <VisitTemplateSelector onApply={applyVisitTemplate} disabled={locked} />
              <ClinicalQA
                token={token}
                encounterId={encounterId}
                noteContext={form ? {
                  subjective: form.subjective,
                  objective: form.objective,
                  assessment: form.assessment,
                  plan: form.plan,
                } : undefined}
              />
            </div>
          )}
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
              {!locked && (
                <span className="char-count">{form[field].length} characters</span>
              )}
            </label>
          ))}
          <div className="field">
            <span className="note-section-label">Suggested codes</span>
            <CodePicker
              value={form.suggestedCodes}
              disabled={locked}
              onChange={(codes) => setForm({ ...form, suggestedCodes: codes })}
            />
            {!locked && form.plan && (
              <CptCodeSuggestions
                plan={form.plan}
                onAddCode={(code, desc) => {
                  const current = form.suggestedCodes.trim();
                  const newCode = `${code} - ${desc}`;
                  setForm({
                    ...form,
                    suggestedCodes: current ? `${current}\n${newCode}` : newCode,
                  });
                }}
              />
            )}
          </div>

          {!locked && (
            <EmLevelSuggestion
              subjective={form.subjective}
              objective={form.objective}
              assessment={form.assessment}
              plan={form.plan}
              onSelectCode={(code) => {
                const current = form.suggestedCodes.trim();
                const newCodes = current ? `${current}, ${code}` : code;
                setForm({ ...form, suggestedCodes: newCodes });
              }}
            />
          )}

          {!locked && (form.assessment || form.plan) && (
            <OrderSuggestions
              assessment={form.assessment}
              plan={form.plan}
              onAddOrder={(order) => {
                const current = form.plan.trim();
                setForm({ ...form, plan: current ? `${current}\n${order}` : order });
              }}
            />
          )}

          {!locked && (form.assessment || form.plan) && (
            <PatientInstructions
              assessment={form.assessment}
              plan={form.plan}
              onCopy={(instructions) => {
                navigator.clipboard.writeText(instructions);
                showToast('Instructions copied to clipboard');
              }}
            />
          )}

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
                  <kbd className="kbd">⌘S</kbd>
                </button>
                <button className="btn btn-primary" onClick={() => setShowSignConfirm(true)} disabled={busy}>
                  {busy ? 'Signing…' : 'Sign note'}
                  <kbd className="kbd">⌘↵</kbd>
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

      {note.status === 'SIGNED' && (
        <div className="post-sign-grid">
          <div className="card avs-card">
            <h2>
              <DocumentIcon /> Patient Summary
            </h2>
            {note.afterVisitSummary ? (
              <>
                <div className="avs-content">{note.afterVisitSummary}</div>
                <div className="avs-actions">
                  <button className="btn btn-secondary" onClick={handleDownloadAvsPdf}>
                    <DownloadIcon /> Download PDF
                  </button>
                  <button className="btn btn-ghost" onClick={handlePrintAvs}>
                    <PrintIcon /> Print
                  </button>
                  <div className="avs-regenerate-group">
                    <select
                      className="avs-language-select"
                      value={avsLanguage}
                      onChange={(e) => setAvsLanguage(e.target.value as SupportedLanguage)}
                      disabled={avsGenerating}
                    >
                      {LANGUAGES.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.nativeName}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn btn-ghost"
                      onClick={() => handleGenerateAvs(avsLanguage)}
                      disabled={avsGenerating}
                    >
                      {avsGenerating ? 'Regenerating…' : 'Regenerate'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="avs-description">
                  Generate a plain-language summary of this visit for the patient to take home.
                </p>
                <div className="avs-generate-group">
                  <label className="avs-language-label">
                    Language:
                    <select
                      className="avs-language-select"
                      value={avsLanguage}
                      onChange={(e) => setAvsLanguage(e.target.value as SupportedLanguage)}
                      disabled={avsGenerating}
                    >
                      {LANGUAGES.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.nativeName}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {avsError && <p className="error">{avsError}</p>}
                <button
                  className="btn btn-primary"
                  onClick={() => handleGenerateAvs(avsLanguage)}
                  disabled={avsGenerating}
                >
                  {avsGenerating ? 'Generating…' : 'Generate Patient Summary'}
                </button>
              </>
            )}
          </div>

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
                        <button className="btn btn-secondary" onClick={() => handleDownloadReferralPdf(letter)}>
                          <DownloadIcon /> Download PDF
                        </button>
                        <button className="btn btn-ghost" onClick={() => handlePrintReferral(letter)}>
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
                        <button className="btn btn-secondary" onClick={() => handleDownloadPriorAuthPdf(pa)}>
                          <DownloadIcon /> Download PDF
                        </button>
                        <button className="btn btn-ghost" onClick={() => handlePrintPriorAuth(pa)}>
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

      {showSignConfirm && (
        <ConfirmModal
          title="Sign this note?"
          message="Once signed, this note becomes part of the patient's official medical record and cannot be edited. Make sure all information is accurate before signing."
          confirmLabel="Sign note"
          cancelLabel="Keep editing"
          onConfirm={handleSign}
          onCancel={() => setShowSignConfirm(false)}
        />
      )}
    </div>
  );
}
