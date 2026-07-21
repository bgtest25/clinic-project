import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../api/client';
import type { EncounterListItem, Me } from '../api/types';
import { Dashboard } from './Dashboard';

vi.mock('../api/client', () => ({ apiFetch: vi.fn() }));

const admin: Me = { id: 'user-1', cognitoSub: 'sub-1', email: 'a@x.test', name: 'Alice', role: 'ADMIN', clinicId: 'clinic-a' };
const clinician: Me = { ...admin, role: 'CLINICIAN' };

const encounter: EncounterListItem = {
  id: 'enc-1',
  patientId: 'pat-1',
  clinicianId: 'user-1',
  visitDate: '2026-07-01T00:00:00.000Z',
  status: 'IN_REVIEW',
  consentCapturedAt: null,
  consentCapturedBy: null,
  processingError: null,
  patient: { id: 'pat-1', clinicId: 'clinic-a', name: 'Jane Doe', dateOfBirth: '1990-01-01' },
};

function renderDashboard(me: Me) {
  return render(
    <Dashboard
      token="tok"
      me={me}
      onSelect={vi.fn()}
      onNew={vi.fn()}
      onInvite={vi.fn()}
      onMetrics={vi.fn()}
      onUsers={vi.fn()}
      onPatients={vi.fn()}
    />,
  );
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it('shows a loading state before the encounters resolve', () => {
    vi.mocked(apiFetch).mockReturnValue(new Promise(() => {}));
    renderDashboard(clinician);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows an empty state when there are no encounters', async () => {
    vi.mocked(apiFetch).mockResolvedValue([]);
    renderDashboard(clinician);
    expect(await screen.findByText(/No visits yet/)).toBeInTheDocument();
  });

  it('shows an error state when loading fails', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('boom'));
    renderDashboard(clinician);
    expect(await screen.findByText('boom')).toBeInTheDocument();
  });

  it('renders the encounter list and fires onSelect on row click', async () => {
    vi.mocked(apiFetch).mockResolvedValue([encounter]);
    const onSelect = vi.fn();
    render(
      <Dashboard
        token="tok"
        me={clinician}
        onSelect={onSelect}
        onNew={vi.fn()}
        onInvite={vi.fn()}
        onMetrics={vi.fn()}
        onUsers={vi.fn()}
        onPatients={vi.fn()}
      />,
    );

    const row = await screen.findByText('Jane Doe');
    fireEvent.click(row.closest('tr')!);
    expect(onSelect).toHaveBeenCalledWith('enc-1');
  });

  it('hides admin-only actions for a CLINICIAN', async () => {
    vi.mocked(apiFetch).mockResolvedValue([]);
    renderDashboard(clinician);
    await screen.findByText(/No visits yet/);
    expect(screen.queryByText('View metrics')).not.toBeInTheDocument();
    expect(screen.queryByText('Invite clinician')).not.toBeInTheDocument();
    expect(screen.queryByText('Manage users')).not.toBeInTheDocument();
    expect(screen.getByText('Patients')).toBeInTheDocument();
  });

  it('shows admin-only actions for an ADMIN', async () => {
    vi.mocked(apiFetch).mockResolvedValue([]);
    renderDashboard(admin);
    await screen.findByText(/No visits yet/);
    expect(screen.getByText('View metrics')).toBeInTheDocument();
    expect(screen.getByText('Invite clinician')).toBeInTheDocument();
    expect(screen.getByText('Manage users')).toBeInTheDocument();
    expect(screen.getByText('Patients')).toBeInTheDocument();
  });
});
