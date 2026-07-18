import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api/client';
import type { EncounterDetail } from '../api/types';
import { MicIcon, StopIcon } from '../icons';
import { NoteReview } from './NoteReview';

type RecordingState = 'loading' | 'idle' | 'recording' | 'uploading' | 'processing' | 'review' | 'error';

export function Recording({
  token,
  encounterId,
  onBack,
}: {
  token: string;
  encounterId: string;
  onBack: () => void;
}) {
  const [consentGiven, setConsentGiven] = useState(false);
  const [state, setState] = useState<RecordingState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [encounterStatus, setEncounterStatus] = useState<string>('');
  const [transcript, setTranscript] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  function applyEncounterDetail(latest: EncounterDetail) {
    setEncounterStatus(latest.status);
    setConsentGiven(!!latest.consentCapturedAt);
    if (latest.status === 'IN_REVIEW' || latest.status === 'SIGNED') {
      setTranscript(latest.transcript?.rawText ?? null);
      setState('review');
    } else if (latest.status === 'FAILED') {
      setError(latest.processingError ?? 'Processing failed.');
      setState('error');
    } else if (latest.status === 'TRANSCRIBING' || latest.status === 'DRAFTING') {
      setState('processing');
    } else {
      setState('idle');
    }
  }

  // Loads the encounter's real current state on mount — matters when resuming
  // an in-progress or already-reviewed visit from the dashboard, not just the
  // freshly-created one this component originally assumed.
  useEffect(() => {
    apiFetch<EncounterDetail>(`/encounters/${encounterId}`, token)
      .then(applyEncounterDetail)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load this visit');
        setState('error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounterId, token]);

  useEffect(() => {
    if (state !== 'processing') return;

    const interval = setInterval(async () => {
      try {
        const latest = await apiFetch<EncounterDetail>(`/encounters/${encounterId}`, token);
        if (latest.status !== 'TRANSCRIBING' && latest.status !== 'DRAFTING') {
          applyEncounterDetail(latest);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to check processing status');
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [state, encounterId, token]);

  async function handleConsent() {
    setError(null);
    try {
      await apiFetch(`/encounters/${encounterId}/consent`, token, { method: 'PATCH' });
      setConsentGiven(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record consent');
    }
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        void handleUpload(new Blob(chunksRef.current, { type: 'audio/webm' }));
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setState('recording');
    } catch {
      setError('Could not access the microphone — check browser permissions.');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  async function handleUpload(blob: Blob) {
    setState('uploading');
    try {
      const { uploadUrl } = await apiFetch<{ uploadUrl: string; s3Key: string }>(
        `/encounters/${encounterId}/recording/start-upload`,
        token,
        { method: 'POST' },
      );

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'audio/webm' },
        body: blob,
      });
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

      await apiFetch(`/encounters/${encounterId}/recording/complete`, token, { method: 'POST' });
      setState('processing');
      setEncounterStatus('TRANSCRIBING');
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  if (state === 'loading') {
    return <div className="page">Loading…</div>;
  }

  if (state === 'review') {
    return (
      <div>
        <div className="page-back">
          <button className="link-button back-link" onClick={onBack}>
            ← Back to visits
          </button>
        </div>
        <NoteReview token={token} encounterId={encounterId} transcript={transcript} />
      </div>
    );
  }

  return (
    <div className="page">
      <button className="link-button back-link" onClick={onBack}>
        ← Back to visits
      </button>
      <div className="card">
        <div className="review-header">
          <h1>Visit recording</h1>
          <span className={`status-badge status-${encounterStatus.toLowerCase()}`}>
            {encounterStatus.replace('_', ' ')}
          </span>
        </div>

        {!consentGiven && (
          <div className="consent-step">
            <p>Confirm the patient has consented to this visit being recorded before starting.</p>
            <button className="btn btn-primary" onClick={handleConsent}>
              I confirm consent was given
            </button>
          </div>
        )}

        {consentGiven && state === 'idle' && (
          <div className="record-stage">
            <button className="record-button" onClick={startRecording} aria-label="Start recording">
              <MicIcon />
            </button>
            <p className="record-caption">Tap to start recording the visit</p>
          </div>
        )}

        {state === 'recording' && (
          <div className="record-stage">
            <button
              className="record-button is-recording"
              onClick={stopRecording}
              aria-label="Stop recording"
            >
              <StopIcon />
            </button>
            <p className="record-caption">Recording — tap to stop</p>
          </div>
        )}

        {state === 'uploading' && (
          <div className="processing-state">
            <span className="spinner" />
            Uploading…
          </div>
        )}

        {state === 'processing' && (
          <div className="processing-state">
            <span className="spinner" />
            Processing in the background — the draft note will be ready for review shortly.
          </div>
        )}

        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
