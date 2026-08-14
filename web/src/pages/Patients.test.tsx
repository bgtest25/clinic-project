import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../api/client';
import type { Patient } from '../api/types';
import { Patients } from './Patients';

vi.mock('../api/client', () => ({ apiFetch: vi.fn() }));

const patient: Patient = { id: 'pat-1', clinicId: 'clinic-a', name: 'Jane Doe', dateOfBirth: '1990-01-01T00:00:00.000Z' };

function renderPatients(props: Partial<ComponentProps<typeof Patients>> = {}) {
  return render(
    <MemoryRouter>
      <Patients token="tok" onBack={vi.fn()} onSelect={vi.fn()} {...props} />
    </MemoryRouter>,
  );
}

describe('Patients', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it('renders each patient with name and formatted date of birth', async () => {
    vi.mocked(apiFetch).mockResolvedValue([patient]);
    renderPatients();

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText(new Date(patient.dateOfBirth).toLocaleDateString())).toBeInTheDocument();
  });

  it('shows an empty state when there are no patients', async () => {
    vi.mocked(apiFetch).mockResolvedValue([]);
    renderPatients();
    expect(await screen.findByText(/No patients yet/)).toBeInTheDocument();
  });

  it('shows an error state when loading fails', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('boom'));
    renderPatients();
    expect(await screen.findByText('boom')).toBeInTheDocument();
  });

  it('fires onSelect with the patient id on row click', async () => {
    vi.mocked(apiFetch).mockResolvedValue([patient]);
    const onSelect = vi.fn();
    renderPatients({ onSelect });

    const row = await screen.findByText('Jane Doe');
    fireEvent.click(row.closest('tr')!);
    expect(onSelect).toHaveBeenCalledWith('pat-1');
  });

  it('filters the list by the ?q= search param', async () => {
    const patient2: Patient = { id: 'pat-2', clinicId: 'clinic-a', name: 'John Smith', dateOfBirth: '1985-05-05T00:00:00.000Z' };
    vi.mocked(apiFetch).mockResolvedValue([patient, patient2]);
    render(
      <MemoryRouter initialEntries={['/patients?q=jane']}>
        <Patients token="tok" onBack={vi.fn()} onSelect={vi.fn()} />
      </MemoryRouter>,
    );

    await screen.findByText('Jane Doe');
    expect(screen.queryByText('John Smith')).not.toBeInTheDocument();
  });
});
