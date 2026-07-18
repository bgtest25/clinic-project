import { useRef, useState } from 'react';
import { apiFetch } from '../api/client';
import type { Encounter } from '../api/types';

type RecordingState = 'idle' | 'recording' | 'uploading' | 'processing' | 'error';

export function Recording({ token, encounter }: { token: string; encounter: Encounter }) {
  const [consentGiven, setConsentGiven] = useState(!!encounter.consentCapturedAt);
  const [state, setState] = useState<RecordingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [encounterStatus, setEncounterStatus] = useState(encounter.status);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function handleConsent() {
    setError(null);
    try {
      await apiFetch(`/encounters/${encounter.id}/consent`, token, { method: 'PATCH' });
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
        `/encounters/${encounter.id}/recording/start-upload`,
        token,
        { method: 'POST' },
      );

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'audio/webm' },
        body: blob,
      });
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

      await apiFetch(`/encounters/${encounter.id}/recording/complete`, token, { method: 'POST' });
      setState('processing');
      setEncounterStatus('TRANSCRIBING');
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  return (
    <div className="panel">
      <h1>Visit recording</h1>
      <p className="status-line">Status: {encounterStatus}</p>

      {!consentGiven && (
        <div>
          <p>Confirm the patient has consented to this visit being recorded before starting.</p>
          <button onClick={handleConsent}>I confirm consent was given</button>
        </div>
      )}

      {consentGiven && state === 'idle' && <button onClick={startRecording}>Start recording</button>}

      {state === 'recording' && (
        <button onClick={stopRecording} className="recording">
          Stop recording
        </button>
      )}

      {state === 'uploading' && <p>Uploading…</p>}
      {state === 'processing' && (
        <p>Processing in the background — the draft note will be ready for review shortly.</p>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
