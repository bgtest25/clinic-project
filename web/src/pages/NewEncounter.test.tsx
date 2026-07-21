import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../api/client';
import type { Encounter, Me, Patient } from '../api/types';
import { NewEncounter } from './NewEncounter';

vi.mock('../api/client', () => ({ apiFetch: vi.fn() }));

const me: Me = { id: 'user-1', cognitoSub: 'sub-1', email: 'a@x.test', name: 'Alice', role: 'CLINICIAN', clinicId: 'clinic-a' };

const patient: Patient = { id: 'pat-1', clinicId: 'clinic-a', name: 'Jane Doe', dateOfBirth: '1990-01-01' };
const encounter: Encounter = {
  id: 'enc-1',
  patientId: 'pat-1',
  clinicianId: 'user-1',
  visitDate: '2026-07-01T00:00:00.000Z',
  status: 'RECORDING',
  consentCapturedAt: null,
  consentCapturedBy: null,
  processingError: null,
};

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText('Patient name'), { target: { value: 'Jane Doe' } });
  fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '1990-01-01' } });
  fireEvent.click(screen.getByText('Start visit'));
}

describe('NewEncounter', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it('creates the patient, then the encounter, and calls onCreated with it', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(patient).mockResolvedValueOnce(encounter);
    const onCreated = vi.fn();
    render(<NewEncounter token="tok" me={me} onCreated={onCreated} onBack={vi.fn()} />);

    fillAndSubmit();

    expect(await screen.findByText('Start visit')).not.toBeDisabled();
    expect(apiFetch).toHaveBeenNthCalledWith(1, '/patients', 'tok', {
      method: 'POST',
      body: JSON.stringify({ name: 'Jane Doe', dateOfBirth: '1990-01-01' }),
    });
    expect(apiFetch).toHaveBeenNthCalledWith(2, '/encounters', 'tok', {
      method: 'POST',
      body: JSON.stringify({ patientId: 'pat-1', clinicianId: 'user-1' }),
    });
    expect(onCreated).toHaveBeenCalledWith(encounter);
  });

  it('shows an error and never calls onCreated if creating the patient fails', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Invalid date of birth'));
    const onCreated = vi.fn();
    render(<NewEncounter token="tok" me={me} onCreated={onCreated} onBack={vi.fn()} />);

    fillAndSubmit();

    expect(await screen.findByText('Invalid date of birth')).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it('shows an error and never calls onCreated if creating the encounter fails', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(patient).mockRejectedValueOnce(new Error('boom'));
    const onCreated = vi.fn();
    render(<NewEncounter token="tok" me={me} onCreated={onCreated} onBack={vi.fn()} />);

    fillAndSubmit();

    expect(await screen.findByText('boom')).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('disables the submit button and swaps its label while busy', async () => {
    let resolveFirst: (v: Patient) => void = () => {};
    vi.mocked(apiFetch).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
    );
    render(<NewEncounter token="tok" me={me} onCreated={vi.fn()} onBack={vi.fn()} />);

    fillAndSubmit();

    const button = await screen.findByText('Starting…');
    expect(button).toBeDisabled();
    resolveFirst(patient);
  });
});
