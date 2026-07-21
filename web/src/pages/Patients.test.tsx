import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../api/client';
import type { Patient } from '../api/types';
import { Patients } from './Patients';

vi.mock('../api/client', () => ({ apiFetch: vi.fn() }));

const patient: Patient = { id: 'pat-1', clinicId: 'clinic-a', name: 'Jane Doe', dateOfBirth: '1990-01-01T00:00:00.000Z' };

describe('Patients', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it('renders each patient with name and formatted date of birth', async () => {
    vi.mocked(apiFetch).mockResolvedValue([patient]);
    render(<Patients token="tok" onBack={vi.fn()} onSelect={vi.fn()} />);

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText(new Date(patient.dateOfBirth).toLocaleDateString())).toBeInTheDocument();
  });

  it('shows an empty state when there are no patients', async () => {
    vi.mocked(apiFetch).mockResolvedValue([]);
    render(<Patients token="tok" onBack={vi.fn()} onSelect={vi.fn()} />);
    expect(await screen.findByText(/No patients yet/)).toBeInTheDocument();
  });

  it('shows an error state when loading fails', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('boom'));
    render(<Patients token="tok" onBack={vi.fn()} onSelect={vi.fn()} />);
    expect(await screen.findByText('boom')).toBeInTheDocument();
  });

  it('fires onSelect with the patient id on row click', async () => {
    vi.mocked(apiFetch).mockResolvedValue([patient]);
    const onSelect = vi.fn();
    render(<Patients token="tok" onBack={vi.fn()} onSelect={onSelect} />);

    const row = await screen.findByText('Jane Doe');
    fireEvent.click(row.closest('tr')!);
    expect(onSelect).toHaveBeenCalledWith('pat-1');
  });
});
