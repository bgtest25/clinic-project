import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiDownload, apiFetch } from '../api/client';
import type { ClinicalNote } from '../api/types';
import { ToastProvider } from '../components/Toast';
import { NoteReview } from './NoteReview';

vi.mock('../api/client', () => ({ apiFetch: vi.fn(), apiDownload: vi.fn() }));

function renderNoteReview(props: ComponentProps<typeof NoteReview>) {
  return render(
    <ToastProvider>
      <NoteReview {...props} />
    </ToastProvider>,
  );
}

const draftNote: ClinicalNote = {
  id: 'note-1',
  encounterId: 'enc-1',
  version: 1,
  subjective: 'Cough for 3 days.',
  objective: '',
  assessment: 'Viral URI.',
  plan: 'Rest and fluids.',
  suggestedCodes: 'J06.9',
  status: 'DRAFT',
  signedById: null,
  signedAt: null,
  satisfactionRating: null,
  feedbackComment: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

const signedNote: ClinicalNote = {
  ...draftNote,
  status: 'SIGNED',
  signedById: 'user-1',
  signedAt: '2026-07-01T01:00:00.000Z',
};

describe('NoteReview', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(apiDownload).mockReset();
  });

  it('loads the note and pre-fills the editable form', async () => {
    vi.mocked(apiFetch).mockResolvedValue(draftNote);
    renderNoteReview({ token: 'tok', encounterId: 'enc-1', transcript: 'raw transcript text' });

    expect(await screen.findByDisplayValue('Cough for 3 days.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Viral URI.')).toBeInTheDocument();
    expect(screen.getByText('raw transcript text')).toBeInTheDocument();
  });

  it('defaults to speaker view when diarized segments exist, and can toggle to raw text', async () => {
    vi.mocked(apiFetch).mockResolvedValue(draftNote);
    renderNoteReview({
      token: 'tok',
      encounterId: 'enc-1',
      transcript: 'raw transcript text',
      diarizedSegments: [
        { speaker: 'spk_0', text: 'How can I help you today?', startTime: '0', endTime: '1' },
        { speaker: 'spk_1', text: 'My throat hurts.', startTime: '1', endTime: '2' },
      ],
    });

    await screen.findByDisplayValue('Cough for 3 days.');
    expect(screen.getByText('How can I help you today?')).toBeInTheDocument();
    expect(screen.getByText('My throat hurts.')).toBeInTheDocument();
    // "Speaker 1"/"Speaker 2" each appear twice now — once in the
    // assignment legend, once as the actual turn label.
    expect(screen.getAllByText('Speaker 1')).toHaveLength(2);
    expect(screen.getAllByText('Speaker 2')).toHaveLength(2);
    expect(screen.queryByText('raw transcript text')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Raw text' }));
    expect(screen.getByText('raw transcript text')).toBeInTheDocument();
    expect(screen.queryByText('My throat hurts.')).not.toBeInTheDocument();
  });

  it('lets the clinician assign "Clinician" to a speaker and saves it immediately', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(draftNote);
    renderNoteReview({
      token: 'tok',
      encounterId: 'enc-1',
      transcript: 'raw transcript text',
      diarizedSegments: [
        { speaker: 'spk_0', text: 'How can I help you today?', startTime: '0', endTime: '1' },
        { speaker: 'spk_1', text: 'My throat hurts.', startTime: '1', endTime: '2' },
      ],
    });
    await screen.findByDisplayValue('Cough for 3 days.');
    vi.mocked(apiFetch).mockResolvedValueOnce({});

    fireEvent.click(screen.getAllByRole('button', { name: 'Clinician' })[0]);

    expect(apiFetch).toHaveBeenCalledWith('/encounters/enc-1/transcript/speaker-labels', 'tok', {
      method: 'PATCH',
      body: JSON.stringify({ labels: [{ speaker: 'spk_0', label: 'Clinician' }] }),
    });
    // The turn label updates immediately, everywhere that speaker appears.
    expect(await screen.findAllByText('Clinician')).toHaveLength(2);
    expect(screen.queryByText('Speaker 1')).not.toBeInTheDocument();
  });

  it("offers a quick-assign button for the patient's real name when a patient is given", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(draftNote);
    renderNoteReview({
      token: 'tok',
      encounterId: 'enc-1',
      transcript: 'raw transcript text',
      diarizedSegments: [
        { speaker: 'spk_0', text: 'How can I help you today?', startTime: '0', endTime: '1' },
        { speaker: 'spk_1', text: 'My throat hurts.', startTime: '1', endTime: '2' },
      ],
      patient: { id: 'pat-1', clinicId: 'clinic-a', name: 'Jane Doe', dateOfBirth: '1990-01-01' },
    });
    await screen.findByDisplayValue('Cough for 3 days.');
    vi.mocked(apiFetch).mockResolvedValueOnce({});

    fireEvent.click(screen.getAllByRole('button', { name: 'Jane Doe' })[1]);

    expect(apiFetch).toHaveBeenCalledWith('/encounters/enc-1/transcript/speaker-labels', 'tok', {
      method: 'PATCH',
      body: JSON.stringify({ labels: [{ speaker: 'spk_1', label: 'Jane Doe' }] }),
    });
    expect(await screen.findAllByText('Jane Doe')).toHaveLength(2);
  });

  it('saves a custom label typed into the "Other" field on Enter', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(draftNote);
    renderNoteReview({
      token: 'tok',
      encounterId: 'enc-1',
      transcript: 'raw transcript text',
      diarizedSegments: [{ speaker: 'spk_0', text: 'Relaying for the patient.', startTime: '0', endTime: '1' }],
    });
    await screen.findByDisplayValue('Cough for 3 days.');
    vi.mocked(apiFetch).mockResolvedValueOnce({});

    const input = screen.getByPlaceholderText('Other (e.g. Interpreter)');
    fireEvent.change(input, { target: { value: 'Interpreter' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(apiFetch).toHaveBeenCalledWith('/encounters/enc-1/transcript/speaker-labels', 'tok', {
      method: 'PATCH',
      body: JSON.stringify({ labels: [{ speaker: 'spk_0', label: 'Interpreter' }] }),
    });
    expect(await screen.findAllByText('Interpreter')).toHaveLength(2);
  });

  it('shows an error toast and leaves the label unchanged if saving fails', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(draftNote);
    renderNoteReview({
      token: 'tok',
      encounterId: 'enc-1',
      transcript: 'raw transcript text',
      diarizedSegments: [{ speaker: 'spk_0', text: 'How can I help you today?', startTime: '0', endTime: '1' }],
    });
    await screen.findByDisplayValue('Cough for 3 days.');
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Network error'));

    fireEvent.click(screen.getAllByRole('button', { name: 'Clinician' })[0]);

    expect(await screen.findByText('Network error')).toBeInTheDocument();
    expect(screen.getAllByText('Speaker 1')).toHaveLength(2);
  });

  it('shows only raw text with no toggle when there are no diarized segments', async () => {
    vi.mocked(apiFetch).mockResolvedValue(draftNote);
    renderNoteReview({ token: 'tok', encounterId: 'enc-1', transcript: 'raw transcript text' });

    await screen.findByDisplayValue('Cough for 3 days.');
    expect(screen.getByText('raw transcript text')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Speaker view' })).not.toBeInTheDocument();
  });

  it('shows an error state if the note fails to load', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('boom'));
    renderNoteReview({ token: 'tok', encounterId: 'enc-1', transcript: null });
    expect(await screen.findByText('boom')).toBeInTheDocument();
  });

  it('shows the mock-note notice when a field contains the mock marker', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      ...draftNote,
      subjective: '[MOCK NOTE — Bedrock access pending] ...',
    });
    renderNoteReview({ token: 'tok', encounterId: 'enc-1', transcript: null });
    expect(await screen.findByText(/placeholder content/)).toBeInTheDocument();
  });

  it('saves an edited draft', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(draftNote);
    renderNoteReview({ token: 'tok', encounterId: 'enc-1', transcript: null });
    await screen.findByDisplayValue('Cough for 3 days.');

    const updated = { ...draftNote, subjective: 'Cough for 4 days.' };
    vi.mocked(apiFetch).mockResolvedValueOnce(updated);

    fireEvent.change(screen.getByDisplayValue('Cough for 3 days.'), {
      target: { value: 'Cough for 4 days.' },
    });
    fireEvent.click(screen.getByText('Save draft'));

    await screen.findByDisplayValue('Cough for 4 days.');
    expect(apiFetch).toHaveBeenLastCalledWith('/encounters/enc-1/note', 'tok', {
      method: 'PATCH',
      body: JSON.stringify({
        subjective: 'Cough for 4 days.',
        objective: '',
        assessment: 'Viral URI.',
        plan: 'Rest and fluids.',
        suggestedCodes: 'J06.9',
      }),
    });
  });

  it('signs the note, showing the signed banner and locking the fields', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(draftNote);
    renderNoteReview({ token: 'tok', encounterId: 'enc-1', transcript: null });
    await screen.findByDisplayValue('Cough for 3 days.');

    vi.mocked(apiFetch).mockResolvedValueOnce(draftNote); // the PATCH save-before-sign call
    vi.mocked(apiFetch).mockResolvedValueOnce(signedNote); // the POST sign call
    fireEvent.click(screen.getByText('Sign note'));

    await screen.findByText(/Signed/, { selector: '.signed-banner' });
    expect(screen.getByDisplayValue('Cough for 3 days.')).toBeDisabled();
    expect(apiFetch).toHaveBeenLastCalledWith('/encounters/enc-1/note/sign', 'tok', { method: 'POST' });
  });

  it('unlocks into an amendment when Edit is clicked on a signed note', async () => {
    vi.mocked(apiFetch).mockResolvedValue(signedNote);
    renderNoteReview({ token: 'tok', encounterId: 'enc-1', transcript: null });

    await screen.findByText('Edit (creates an amendment)');
    fireEvent.click(screen.getByText('Edit (creates an amendment)'));

    expect(screen.getByDisplayValue('Cough for 3 days.')).not.toBeDisabled();
  });

  it('submits satisfaction feedback for a signed note', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(signedNote);
    renderNoteReview({ token: 'tok', encounterId: 'enc-1', transcript: null });
    await screen.findByText('How was this draft?');

    fireEvent.click(screen.getByLabelText('4 stars'));

    const feedbackNote = { ...signedNote, satisfactionRating: 4 };
    vi.mocked(apiFetch).mockResolvedValueOnce(feedbackNote);
    fireEvent.click(screen.getByText('Submit feedback'));

    await screen.findByText('Thanks for your feedback on this draft.');
    expect(apiFetch).toHaveBeenLastCalledWith('/encounters/enc-1/note/feedback', 'tok', {
      method: 'POST',
      body: JSON.stringify({ rating: 4, comment: undefined }),
    });
  });

  it('downloads the PDF via apiDownload with the right filename', async () => {
    vi.mocked(apiFetch).mockResolvedValue(draftNote);
    vi.mocked(apiDownload).mockResolvedValue(undefined);
    renderNoteReview({ token: 'tok', encounterId: 'enc-1', transcript: null });
    await screen.findByDisplayValue('Cough for 3 days.');

    fireEvent.click(screen.getByText('Download PDF'));

    expect(apiDownload).toHaveBeenCalledWith('/encounters/enc-1/note/pdf', 'tok', 'visit-note-enc-1.pdf');
  });

  it('copies the formatted note to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    vi.mocked(apiFetch).mockResolvedValue(draftNote);
    renderNoteReview({ token: 'tok', encounterId: 'enc-1', transcript: null });
    await screen.findByDisplayValue('Cough for 3 days.');

    fireEvent.click(screen.getByText('Copy note'));

    await screen.findByText('Copied!');
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Subjective:\nCough for 3 days.'));
  });

  it('adds an ICD-10 code chip via the code picker', async () => {
    vi.mocked(apiFetch).mockResolvedValue(draftNote);
    renderNoteReview({ token: 'tok', encounterId: 'enc-1', transcript: null });
    await screen.findByDisplayValue('Cough for 3 days.');

    const codeInput = screen.getByPlaceholderText('Search a code or description…');
    fireEvent.change(codeInput, { target: { value: 'sinusitis' } });
    fireEvent.click(await screen.findByText('Acute sinusitis, unspecified'));

    expect(screen.getByText('J06.9')).toBeInTheDocument();
    expect(screen.getByText('J01.90')).toBeInTheDocument();
  });

  it('inserts a saved phrase from the template menu', async () => {
    vi.mocked(apiFetch).mockResolvedValue(draftNote);
    renderNoteReview({ token: 'tok', encounterId: 'enc-1', transcript: null });
    await screen.findByDisplayValue('Cough for 3 days.');

    const [planToggle] = screen.getAllByText('Insert phrase ▾').slice(-1);
    fireEvent.click(planToggle);
    fireEvent.click(screen.getByText(/Follow up in 2 weeks/));

    expect(screen.getByDisplayValue(/Rest and fluids\.\s*Follow up in 2 weeks/)).toBeInTheDocument();
  });
});
