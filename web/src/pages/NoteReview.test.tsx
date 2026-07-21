import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiDownload, apiFetch } from '../api/client';
import type { ClinicalNote } from '../api/types';
import { NoteReview } from './NoteReview';

vi.mock('../api/client', () => ({ apiFetch: vi.fn(), apiDownload: vi.fn() }));

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
    render(<NoteReview token="tok" encounterId="enc-1" transcript="raw transcript text" />);

    expect(await screen.findByDisplayValue('Cough for 3 days.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Viral URI.')).toBeInTheDocument();
    expect(screen.getByText('raw transcript text')).toBeInTheDocument();
  });

  it('shows an error state if the note fails to load', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('boom'));
    render(<NoteReview token="tok" encounterId="enc-1" transcript={null} />);
    expect(await screen.findByText('boom')).toBeInTheDocument();
  });

  it('shows the mock-note notice when a field contains the mock marker', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      ...draftNote,
      subjective: '[MOCK NOTE — Bedrock access pending] ...',
    });
    render(<NoteReview token="tok" encounterId="enc-1" transcript={null} />);
    expect(await screen.findByText(/placeholder content/)).toBeInTheDocument();
  });

  it('saves an edited draft', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(draftNote);
    render(<NoteReview token="tok" encounterId="enc-1" transcript={null} />);
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
    render(<NoteReview token="tok" encounterId="enc-1" transcript={null} />);
    await screen.findByDisplayValue('Cough for 3 days.');

    vi.mocked(apiFetch).mockResolvedValueOnce(draftNote); // the PATCH save-before-sign call
    vi.mocked(apiFetch).mockResolvedValueOnce(signedNote); // the POST sign call
    fireEvent.click(screen.getByText('Sign note'));

    await screen.findByText(/Signed/);
    expect(screen.getByDisplayValue('Cough for 3 days.')).toBeDisabled();
    expect(apiFetch).toHaveBeenLastCalledWith('/encounters/enc-1/note/sign', 'tok', { method: 'POST' });
  });

  it('unlocks into an amendment when Edit is clicked on a signed note', async () => {
    vi.mocked(apiFetch).mockResolvedValue(signedNote);
    render(<NoteReview token="tok" encounterId="enc-1" transcript={null} />);

    await screen.findByText('Edit (creates an amendment)');
    fireEvent.click(screen.getByText('Edit (creates an amendment)'));

    expect(screen.getByDisplayValue('Cough for 3 days.')).not.toBeDisabled();
  });

  it('submits satisfaction feedback for a signed note', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(signedNote);
    render(<NoteReview token="tok" encounterId="enc-1" transcript={null} />);
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
    render(<NoteReview token="tok" encounterId="enc-1" transcript={null} />);
    await screen.findByDisplayValue('Cough for 3 days.');

    fireEvent.click(screen.getByText('Download PDF'));

    expect(apiDownload).toHaveBeenCalledWith('/encounters/enc-1/note/pdf', 'tok', 'visit-note-enc-1.pdf');
  });

  it('copies the formatted note to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    vi.mocked(apiFetch).mockResolvedValue(draftNote);
    render(<NoteReview token="tok" encounterId="enc-1" transcript={null} />);
    await screen.findByDisplayValue('Cough for 3 days.');

    fireEvent.click(screen.getByText('Copy note'));

    await screen.findByText('Copied!');
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Subjective:\nCough for 3 days.'));
  });
});
