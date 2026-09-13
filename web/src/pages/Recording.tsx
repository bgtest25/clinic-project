import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { Clinic, DiarizedSegment, EncounterDetail, Patient } from '../api/types';
import { MicIcon, PauseIcon, ResumeIcon, StopIcon, TrashIcon } from '../icons';
import { LevelMeter } from '../components/LevelMeter';
import { withRetry } from '../utils/retry';
import { AudioStreamer } from '../utils/audioStreamer';
import { getUserFriendlyError, getRecordingError, getUploadError, getLoadError } from '../utils/errorMessages';
import { ProcessingProgress } from '../components/ProcessingProgress';
import { PreVisitSummary } from '../components/PreVisitSummary';
import { ConfirmModal } from '../components/ConfirmModal';
import { NoteReview } from './NoteReview';
import { addRecentPatient } from '../utils/recentPatients';

type RecordingState = 'loading' | 'idle' | 'recording' | 'uploading' | 'processing' | 'review' | 'error';

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function Recording({
  token: initialToken,
  encounterId,
  clinic,
  onBack,
}: {
  token: string;
  encounterId: string;
  clinic: Clinic | null;
  onBack: () => void;
}) {
  const { token: currentToken, refreshToken } = useAuth();
  // Use the freshest token available, falling back to the prop for initial render
  const token = currentToken ?? initialToken;

  // Get a guaranteed-fresh token for critical operations (upload, polling)
  async function getFreshToken(): Promise<string> {
    const fresh = await refreshToken();
    return fresh ?? token;
  }
  const [consentGiven, setConsentGiven] = useState(false);
  const [state, setState] = useState<RecordingState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [encounterStatus, setEncounterStatus] = useState<string>('');
  const [transcript, setTranscript] = useState<string | null>(null);
  const [diarizedSegments, setDiarizedSegments] = useState<DiarizedSegment[] | null>(null);
  const [speakerLabels, setSpeakerLabels] = useState<Record<string, string> | null>(null);
  const [suggestedSpeakerRoles, setSuggestedSpeakerRoles] = useState<Record<string, string> | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visitDate, setVisitDate] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const [useStreaming] = useState(true);
  const [streamingStatus, setStreamingStatus] = useState<string | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [livePartial, setLivePartial] = useState<string>('');
  const liveTranscriptRef = useRef<HTMLDivElement>(null);

  function discardRecording() {
    // Stop any active recording
    if (audioStreamerRef.current) {
      audioStreamerRef.current.disconnect();
      audioStreamerRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    chunksRef.current = [];
    setElapsedSeconds(0);
    setIsPaused(false);
    setState('idle');
    setShowDiscardConfirm(false);
    setError(null);
  }

  function applyEncounterDetail(latest: EncounterDetail) {
    setEncounterStatus(latest.status);
    setConsentGiven(!!latest.consentCapturedAt);
    setPatient(latest.patient);
    setVisitDate(latest.visitDate);
    if (latest.patient) {
      addRecentPatient(latest.patient);
    }
    if (latest.status === 'IN_REVIEW' || latest.status === 'SIGNED') {
      setTranscript(latest.transcript?.rawText ?? null);
      // Rows written before diarization was wired up hold `{}`, not an array —
      // only treat it as real segments if it's actually a non-empty array.
      const segments = latest.transcript?.diarizedSegments;
      setDiarizedSegments(Array.isArray(segments) && segments.length > 0 ? segments : null);
      setSpeakerLabels(latest.transcript?.speakerLabels ?? null);
      setSuggestedSpeakerRoles(latest.transcript?.suggestedSpeakerRoles ?? null);
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
  // Note: intentionally excludes `token` from deps — we only want this to run on
  // mount, not every time the token is refreshed (which would reset state to idle
  // if the encounter status hasn't been updated yet by the Lambda).
  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (initialFetchDone.current) return;
    initialFetchDone.current = true;
    apiFetch<EncounterDetail>(`/encounters/${encounterId}`, token)
      .then(applyEncounterDetail)
      .catch((err) => {
        setError(getLoadError(err, 'this visit'));
        setState('error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounterId]);

  const pollFailuresRef = useRef(0);
  useEffect(() => {
    if (state !== 'processing') return;

    const interval = setInterval(async () => {
      try {
        // Use fresh token for polling - processing can take several minutes
        const freshToken = await getFreshToken();
        const latest = await apiFetch<EncounterDetail>(`/encounters/${encounterId}`, freshToken);
        pollFailuresRef.current = 0; // Reset failure counter on success
        if (latest.status !== 'TRANSCRIBING' && latest.status !== 'DRAFTING') {
          applyEncounterDetail(latest);
        }
      } catch (err) {
        // Allow some transient failures before showing error
        pollFailuresRef.current++;
        if (pollFailuresRef.current >= 3) {
          setError(getUserFriendlyError(err, 'Failed to check processing status. Please refresh the page.'));
        }
      }
    }, 4000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, encounterId]);

  useEffect(() => {
    if (state !== 'recording' || isPaused) return;
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [state, isPaused]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioStreamerRef.current) {
        audioStreamerRef.current.disconnect();
      }
    };
  }, []);

  async function handleConsent() {
    setError(null);
    try {
      await apiFetch(`/encounters/${encounterId}/consent`, token, { method: 'PATCH' });
      setConsentGiven(true);
    } catch (err) {
      setError(getUserFriendlyError(err, 'Failed to record consent. Please try again.'));
    }
  }

  async function startRecording() {
    setError(null);
    setStreamingStatus(null);

    if (useStreaming) {
      // Real-time streaming mode
      try {
        setStreamingStatus('Connecting...');
        const freshToken = await getFreshToken();
        const streamer = new AudioStreamer();
        audioStreamerRef.current = streamer;

        await streamer.connect(freshToken);

        streamer.onLiveTranscript((update) => {
          if (update.isFinal) {
            setLiveTranscript((prev) => (prev ? prev + ' ' + update.partial : update.partial));
            setLivePartial('');
          } else {
            setLivePartial(update.partial);
          }
          if (liveTranscriptRef.current) {
            liveTranscriptRef.current.scrollTop = liveTranscriptRef.current.scrollHeight;
          }
        });

        setStreamingStatus('Starting stream...');
        await streamer.startStreaming(encounterId, freshToken);

        const stream = await streamer.captureAudio();
        streamRef.current = stream;

        setStreamingStatus(null);
        setElapsedSeconds(0);
        setIsPaused(false);
        setLiveTranscript('');
        setLivePartial('');
        setState('recording');
      } catch (err) {
        console.error('Streaming failed, falling back to batch mode:', err);
        setStreamingStatus(null);
        audioStreamerRef.current?.disconnect();
        audioStreamerRef.current = null;
        // Fall back to batch mode
        await startBatchRecording();
      }
    } else {
      await startBatchRecording();
    }
  }

  async function startBatchRecording() {
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

  async function stopRecording() {
    if (audioStreamerRef.current) {
      // Streaming mode - stop and get transcript
      setState('uploading');
      setUploadStatus('Finalizing transcript...');
      try {
        const result = await audioStreamerRef.current.stopStreaming();
        audioStreamerRef.current.disconnect();
        audioStreamerRef.current = null;
        streamRef.current = null;

        // Send the streamed transcript to the server
        setUploadStatus('Starting AI processing...');
        const freshToken = await getFreshToken();
        await apiFetch(`/encounters/${encounterId}/transcription/complete-stream`, freshToken, {
          method: 'POST',
          body: JSON.stringify({
            transcript: result.transcript,
            segments: result.segments,
          }),
        });

        setUploadStatus(null);
        setState('processing');
        setEncounterStatus('DRAFTING');
      } catch (err) {
        setError(getRecordingError(err));
        setState('error');
        setUploadStatus(null);
      }
    } else {
      // Batch mode - stop MediaRecorder which triggers upload
      mediaRecorderRef.current?.stop();
    }
  }

  function togglePause() {
    // Pause not supported in streaming mode
    if (audioStreamerRef.current) return;

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
      // Refresh token before upload - critical to prevent 401 after long recordings
      const freshToken = await getFreshToken();

      const { uploadUrl } = await withRetry(
        () =>
          apiFetch<{ uploadUrl: string; s3Key: string }>(`/encounters/${encounterId}/recording/start-upload`, freshToken, {
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
        () => apiFetch(`/encounters/${encounterId}/recording/complete`, freshToken, { method: 'POST' }),
        { onRetry: (attempt, total) => setUploadStatus(`Retrying (${attempt}/${total})…`) },
      );

      setUploadStatus(null);
      setState('processing');
      setEncounterStatus('TRANSCRIBING');
    } catch (err) {
      setState('error');
      setUploadStatus(null);
      setError(getUploadError(err));
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
          suggestedSpeakerRoles={suggestedSpeakerRoles}
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
        {/* Pre-visit summary - shows patient context before recording */}
        {patient && state === 'idle' && !consentGiven && (
          <PreVisitSummary
            patient={patient}
            visitReason={undefined}
          />
        )}

        {/* Patient identity banner - prominent for safety */}
        {patient && (
          <div className="patient-identity-banner">
            <span className="patient-identity-name">{patient.name}</span>
            <span className="patient-identity-dob">
              DOB: {new Date(patient.dateOfBirth).toLocaleDateString()}
            </span>
          </div>
        )}

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

        {streamingStatus && (
          <div className="processing-state">
            <span className="spinner" />
            {streamingStatus}
          </div>
        )}

        {state === 'recording' && (
          <div className="record-stage">
            <span className="record-elapsed is-recording">{formatElapsed(elapsedSeconds)}</span>
            {streamRef.current && <LevelMeter stream={streamRef.current} active={!isPaused} />}
            {audioStreamerRef.current && (
              <>
                <p className="streaming-indicator">Transcribing in real-time</p>
                <div className="live-transcript-box" ref={liveTranscriptRef}>
                  <div className="live-transcript-content">
                    {liveTranscript || <span className="live-transcript-placeholder">Listening...</span>}
                    {livePartial && <span className="live-transcript-partial">{livePartial}</span>}
                  </div>
                </div>
              </>
            )}
            <div className="record-controls">
              <button
                className="record-button is-recording"
                onClick={stopRecording}
                aria-label="Stop recording"
              >
                <StopIcon />
              </button>
              {!audioStreamerRef.current && (
                <button
                  className="btn btn-secondary record-pause-button"
                  onClick={togglePause}
                  type="button"
                  aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
                >
                  {isPaused ? <ResumeIcon /> : <PauseIcon />}
                  {isPaused ? 'Resume' : 'Pause'}
                </button>
              )}
              <button
                className="btn btn-ghost btn-sm discard-button"
                onClick={() => setShowDiscardConfirm(true)}
                type="button"
                aria-label="Discard recording"
              >
                <TrashIcon /> Discard
              </button>
            </div>
            <p className="record-caption">
              {isPaused ? 'Paused. Tap resume to continue.' : 'Recording. Tap stop when finished.'}
            </p>
          </div>
        )}

        {state === 'uploading' && (
          <div className="card">
            <h3 style={{ marginBottom: '0.5rem' }}>Processing your recording</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              {uploadStatus ?? 'Please wait while we process your recording...'}
            </p>
            <ProcessingProgress currentStep="uploading" />
          </div>
        )}

        {state === 'processing' && (
          <div className="card">
            <h3 style={{ marginBottom: '0.5rem' }}>Processing your recording</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              The draft note will be ready for review shortly.
            </p>
            <ProcessingProgress currentStep={encounterStatus === 'TRANSCRIBING' ? 'transcribing' : 'drafting'} />
          </div>
        )}

        {error && <p className="error">{error}</p>}
      </div>

      {showDiscardConfirm && (
        <ConfirmModal
          title="Discard this recording?"
          message="This will stop the recording and discard all audio captured so far. This cannot be undone."
          confirmLabel="Discard"
          cancelLabel="Keep recording"
          confirmVariant="danger"
          onConfirm={discardRecording}
          onCancel={() => setShowDiscardConfirm(false)}
        />
      )}
    </div>
  );
}
