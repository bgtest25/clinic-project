import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../api/client';
import type { DataRequest, Me, Patient } from '../api/types';
import { PatientDetail } from './PatientDetail';

vi.mock('../api/client', () => ({ apiFetch: vi.fn() }));

const admin: Me = { id: 'user-1', cognitoSub: 'sub-1', email: 'a@x.test', name: 'Alice', role: 'ADMIN', clinicId: 'clinic-a' };
const clinician: Me = { ...admin, role: 'CLINICIAN' };

const patient: Patient = { id: 'pat-1', clinicId: 'clinic-a', name: 'Jane Doe', dateOfBirth: '1990-01-15T00:00:00.000Z' };

const pendingRequest: DataRequest = {
  id: 'req-1',
  patientId: 'pat-1',
  requestType: 'deletion',
  reason: 'Patient moved clinics',
  status: 'pending',
  loggedById: 'user-2',
  resolvedAt: null,
  resolvedById: null,
  resolutionNote: null,
  createdAt: '2026-07-20T00:00:00.000Z',
};

function mockLoads(requests: DataRequest[] = [pendingRequest]) {
  vi.mocked(apiFetch).mockImplementation((path: string) => {
    if (path === '/patients/pat-1') return Promise.resolve(patient);
    if (path === '/patients/pat-1/data-requests') return Promise.resolve(requests);
    return Promise.reject(new Error(`unexpected path ${path}`));
  });
}

describe('PatientDetail', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it('loads the patient and pre-fills the edit form', async () => {
    mockLoads();
    render(<PatientDetail token="tok" me={admin} patientId="pat-1" onBack={vi.fn()} />);

    expect(await screen.findByLabelText('Full name')).toHaveValue('Jane Doe');
    expect(screen.getByLabelText('Date of birth')).toHaveValue('1990-01-15');
  });

  it('saves an edit and shows the Saved banner', async () => {
    mockLoads();
    render(<PatientDetail token="tok" me={admin} patientId="pat-1" onBack={vi.fn()} />);
    await screen.findByLabelText('Full name');

    vi.mocked(apiFetch).mockImplementationOnce(() =>
      Promise.resolve({ ...patient, name: 'Jane A. Doe' }),
    );
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Jane A. Doe' } });
    fireEvent.click(screen.getByText('Save changes'));

    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/patients/pat-1', 'tok', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Jane A. Doe', dateOfBirth: '1990-01-15' }),
    });
  });

  it('renders a status badge for each data request', async () => {
    mockLoads([
      pendingRequest,
      { ...pendingRequest, id: 'req-2', status: 'approved' },
      { ...pendingRequest, id: 'req-3', status: 'denied' },
    ]);
    render(<PatientDetail token="tok" me={admin} patientId="pat-1" onBack={vi.fn()} />);

    expect(await screen.findByText('pending')).toBeInTheDocument();
    expect(screen.getByText('approved')).toBeInTheDocument();
    expect(screen.getByText('denied')).toBeInTheDocument();
  });

  it('logs a new data request and prepends it to the list', async () => {
    mockLoads([]);
    render(<PatientDetail token="tok" me={clinician} patientId="pat-1" onBack={vi.fn()} />);
    await screen.findByText('No data requests logged.');

    const created: DataRequest = { ...pendingRequest, id: 'req-new', reason: 'New reason' };
    vi.mocked(apiFetch).mockImplementationOnce(() => Promise.resolve(created));

    fireEvent.change(screen.getByLabelText('Reason (optional)'), { target: { value: 'New reason' } });
    fireEvent.click(screen.getByText('Log request'));

    expect(await screen.findByText('New reason')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/patients/pat-1/data-requests', 'tok', {
      method: 'POST',
      body: JSON.stringify({ requestType: 'deletion', reason: 'New reason' }),
    });
  });

  it('shows Approve/Deny for a pending request only when the viewer is ADMIN', async () => {
    mockLoads();
    render(<PatientDetail token="tok" me={clinician} patientId="pat-1" onBack={vi.fn()} />);
    await screen.findByText('pending');
    expect(screen.queryByText('Approve')).not.toBeInTheDocument();
    expect(screen.queryByText('Deny')).not.toBeInTheDocument();
  });

  it('resolves a pending request as an admin, via the confirm flow', async () => {
    mockLoads();
    render(<PatientDetail token="tok" me={admin} patientId="pat-1" onBack={vi.fn()} />);
    await screen.findByText('pending');

    const resolved: DataRequest = { ...pendingRequest, status: 'denied', resolutionNote: 'Retention required' };
    vi.mocked(apiFetch).mockImplementationOnce(() => Promise.resolve(resolved));

    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Retention required' } });
    fireEvent.click(screen.getByText('Deny'));
    fireEvent.click(screen.getByText('Confirm'));

    expect(await screen.findByText('denied')).toBeInTheDocument();
    expect(screen.getByText('Retention required')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/patients/pat-1/data-requests/req-1', 'tok', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'denied', resolutionNote: 'Retention required' }),
    });
  });

  it('shows a dash for the resolution column on a still-pending request', async () => {
    mockLoads();
    render(<PatientDetail token="tok" me={admin} patientId="pat-1" onBack={vi.fn()} />);
    await screen.findByText('pending');

    const row = screen.getByText('pending').closest('tr')!;
    const cells = within(row).getAllByRole('cell');
    // Type, Reason, Status, Resolution, Logged — Resolution is the 4th cell.
    expect(cells[3]).toHaveTextContent('—');
  });
});
