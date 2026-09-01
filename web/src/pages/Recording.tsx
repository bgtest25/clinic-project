import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api/client';
import type { Clinic, DiarizedSegment, EncounterDetail, Patient } from '../api/types';
import { MicIcon, PauseIcon, ResumeIcon, StopIcon } from '../icons';
import { LevelMeter } from '../components/LevelMeter';
import { withRetry } from '../utils/retry';
import { NoteReview } from './NoteReview';

type RecordingState = 'loading' | 'idle' | 'recording' | 'uploading' | 'processing' | 'review' | 'error';

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function Recording({
  token,
  encounterId,
  clinic,
  onBack,
}: {
  token: string;
  encounterId: string;
  clinic: Clinic | null;
  onBack: () => void;
}) {
  const [consentGiven, setConsentGiven] = useState(false);
  const [state, setState] = useState<RecordingState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [encounterStatus, setEncounterStatus] = useState<string>('');
  const [transcript, setTranscript] = useState<string | null>(null);
  const [diarizedSegments, setDiarizedSegments] = useState<DiarizedSegment[] | null>(null);
  const [speakerLabels, setSpeakerLabels] = useState<Record<string, string> | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visitDate, setVisitDate] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  function applyEncounterDetail(latest: EncounterDetail) {
    setEncounterStatus(latest.status);
    setConsentGiven(!!latest.consentCapturedAt);
    setPatient(latest.patient);
    setVisitDate(latest.visitDate);
    if (latest.status === 'IN_REVIEW' || latest.status === 'SIGNED') {
      setTranscript(latest.transcript?.rawText ?? null);
      // Rows written before diarization was wired up hold `{}`, not an array —
      // only treat it as real segments if it's actually a non-empty array.
      const segments = latest.transcript?.diarizedSegments;
      setDiarizedSegments(Array.isArray(segments) && segments.length > 0 ? segments : null);
      setSpeakerLabels(latest.transcript?.speakerLabels ?? null);
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

  useEffect(() => {
    if (state !== 'recording' || isPaused) return;
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [state, isPaused]);

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
      streamRef.current = stream;
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
      setElapsedSeconds(0);
      setIsPaused(false);
      setState('recording');
    } catch {
      setError('Could not access the microphone. Check browser permissions.');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  function togglePause() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (isPaused) {
      recorder.resume();
      setIsPaused(false);
    } else {
      recorder.pause();
      setIsPaused(true);
    }
  }

  async function handleUpload(blob: Blob) {
    setState('uploading');
    setUploadStatus(null);
    try {
      const { uploadUrl } = await withRetry(
        () =>
          apiFetch<{ uploadUrl: string; s3Key: string }>(`/encounters/${encounterId}/recording/start-upload`, token, {
            method: 'POST',
          }),
        { onRetry: (attempt, total) => setUploadStatus(`Retrying upload request (${attempt}/${total})…`) },
      );

      await withRetry(
        async () => {
          const putRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'audio/webm' },
            body: blob,
          });
          if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);
        },
        { onRetry: (attempt, total) => setUploadStatus(`Retrying audio upload (${attempt}/${total})…`) },
      );

      await withRetry(
        () => apiFetch(`/encounters/${encounterId}/recording/complete`, token, { method: 'POST' }),
        { onRetry: (attempt, total) => setUploadStatus(`Retrying (${attempt}/${total})…`) },
      );

      setUploadStatus(null);
      setState('processing');
      setEncounterStatus('TRANSCRIBING');
    } catch (err) {
      setState('error');
      setUploadStatus(null);
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
        <NoteReview
          token={token}
          encounterId={encounterId}
          transcript={transcript}
          diarizedSegments={diarizedSegments}
          speakerLabels={speakerLabels}
          onSpeakerLabelsChange={setSpeakerLabels}
          patient={patient}
          visitDate={visitDate}
          clinic={clinic}
        />
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
          <h1>Visit recording{patient ? `: ${patient.name}` : ''}</h1>
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
            <span className="record-elapsed">{formatElapsed(elapsedSeconds)}</span>
            {streamRef.current && <LevelMeter stream={streamRef.current} active={!isPaused} />}
            <div className="record-controls">
              <button
                className="record-button is-recording"
                onClick={stopRecording}
                aria-label="Stop recording"
              >
                <StopIcon />
              </button>
              <button
                className="btn btn-secondary record-pause-button"
                onClick={togglePause}
                type="button"
                aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
              >
                {isPaused ? <ResumeIcon /> : <PauseIcon />}
                {isPaused ? 'Resume' : 'Pause'}
              </button>
            </div>
            <p className="record-caption">
              {isPaused ? 'Paused. Tap resume to continue.' : 'Recording. Tap stop when finished.'}
            </p>
          </div>
        )}

        {state === 'uploading' && (
          <div className="processing-state">
            <span className="spinner" />
            {uploadStatus ?? 'Uploading…'}
          </div>
        )}

        {state === 'processing' && (
          <div className="processing-state">
            <span className="spinner" />
            Processing in the background. The draft note will be ready for review shortly.
          </div>
        )}

        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
