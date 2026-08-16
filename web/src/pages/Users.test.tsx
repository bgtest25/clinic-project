import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../api/client';
import type { Me, User } from '../api/types';
import { ToastProvider } from '../components/Toast';
import { Users } from './Users';

vi.mock('../api/client', () => ({ apiFetch: vi.fn() }));

function renderUsers(props: ComponentProps<typeof Users>) {
  return render(
    <ToastProvider>
      <Users {...props} />
    </ToastProvider>,
  );
}

const me: Me = { id: 'user-1', cognitoSub: 'sub-1', email: 'me@x.test', name: 'Alice', role: 'ADMIN', clinicId: 'clinic-a' };

const activeUser: User = {
  id: 'user-2',
  cognitoSub: 'sub-2',
  email: 'bob@x.test',
  name: 'Bob',
  role: 'CLINICIAN',
  clinicId: 'clinic-a',
  deactivatedAt: null,
  deactivatedById: null,
};

const inactiveUser: User = {
  ...activeUser,
  id: 'user-3',
  name: 'Carol',
  email: 'carol@x.test',
  deactivatedAt: '2026-07-01T00:00:00.000Z',
  deactivatedById: 'user-1',
};

describe('Users', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it('renders each user with name, email, role, and status', async () => {
    vi.mocked(apiFetch).mockResolvedValue([activeUser, inactiveUser]);
    renderUsers({ token: 'tok', me, onBack: vi.fn() });

    expect(await screen.findByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('bob@x.test')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Carol')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it("shows no action buttons for the viewer's own row", async () => {
    vi.mocked(apiFetch).mockResolvedValue([{ ...activeUser, id: me.id, name: 'Alice' }]);
    renderUsers({ token: 'tok', me, onBack: vi.fn() });

    await screen.findByText('Alice');
    expect(screen.queryByText('Deactivate')).not.toBeInTheDocument();
    expect(screen.queryByText('Reactivate')).not.toBeInTheDocument();
    expect(screen.queryByText('Reset MFA')).not.toBeInTheDocument();
  });

  it('deactivates an active user through the confirm flow and flips the row', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([activeUser]);
    renderUsers({ token: 'tok', me, onBack: vi.fn() });
    await screen.findByText('Bob');

    fireEvent.click(screen.getByText('Deactivate'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.getByText('Deactivate')).toBeInTheDocument();

    vi.mocked(apiFetch).mockResolvedValueOnce({ ...activeUser, deactivatedAt: '2026-07-21T00:00:00.000Z' });
    fireEvent.click(screen.getByText('Deactivate'));
    fireEvent.click(screen.getByText('Confirm'));

    expect(await screen.findByText('Reactivate')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenLastCalledWith('/users/user-2/deactivate', 'tok', { method: 'PATCH' });
  });

  it('reactivates an inactive user through the confirm flow', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([inactiveUser]);
    renderUsers({ token: 'tok', me, onBack: vi.fn() });
    await screen.findByText('Carol');

    vi.mocked(apiFetch).mockResolvedValueOnce({ ...inactiveUser, deactivatedAt: null });
    fireEvent.click(screen.getByText('Reactivate'));
    fireEvent.click(screen.getByText('Confirm'));

    expect(await screen.findByText('Deactivate')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenLastCalledWith('/users/user-3/reactivate', 'tok', { method: 'PATCH' });
  });

  it('shows an action error without clearing the list on failure', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([activeUser]);
    renderUsers({ token: 'tok', me, onBack: vi.fn() });
    await screen.findByText('Bob');

    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Cannot deactivate your own account'));
    fireEvent.click(screen.getByText('Deactivate'));
    fireEvent.click(screen.getByText('Confirm'));

    expect(await screen.findByText('Cannot deactivate your own account')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('does not offer Reset MFA for a deactivated user', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([inactiveUser]);
    renderUsers({ token: 'tok', me, onBack: vi.fn() });

    await screen.findByText('Carol');
    expect(screen.queryByText('Reset MFA')).not.toBeInTheDocument();
  });

  it('resets MFA through the confirm flow and shows a toast explaining the new temp password', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([activeUser]);
    renderUsers({ token: 'tok', me, onBack: vi.fn() });
    await screen.findByText('Bob');

    vi.mocked(apiFetch).mockResolvedValueOnce({ ...activeUser, cognitoSub: 'new-sub' });
    fireEvent.click(screen.getByText('Reset MFA'));
    fireEvent.click(screen.getByText('Reset MFA', { selector: 'button.btn-danger' }));

    expect(apiFetch).toHaveBeenLastCalledWith('/users/user-2/reset-mfa', 'tok', { method: 'PATCH' });
    expect(
      await screen.findByText("MFA reset for Bob — they'll get a new temporary password by email."),
    ).toBeInTheDocument();
  });

  it('shows an action error if the reset MFA request fails', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([activeUser]);
    renderUsers({ token: 'tok', me, onBack: vi.fn() });
    await screen.findByText('Bob');

    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Cannot reset your own MFA — ask another admin'));
    fireEvent.click(screen.getByText('Reset MFA'));
    fireEvent.click(screen.getByText('Reset MFA', { selector: 'button.btn-danger' }));

    expect(await screen.findByText('Cannot reset your own MFA — ask another admin')).toBeInTheDocument();
  });
});
