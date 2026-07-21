import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../api/client';
import type { Me } from '../api/types';
import { InviteClinician } from './InviteClinician';

vi.mock('../api/client', () => ({ apiFetch: vi.fn() }));

const me: Me = {
  id: 'user-1',
  cognitoSub: 'sub-1',
  email: 'admin@x.test',
  name: 'Alice',
  role: 'ADMIN',
  clinicId: 'clinic-a',
};

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Bob Smith' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bob@x.test' } });
  fireEvent.click(screen.getByText('Send invite'));
}

describe('InviteClinician', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it('submits the exact expected payload', async () => {
    vi.mocked(apiFetch).mockResolvedValue(undefined);
    render(<InviteClinician token="tok" me={me} onBack={vi.fn()} />);

    fillAndSubmit();

    await screen.findByText(/Invited bob@x.test/);
    expect(apiFetch).toHaveBeenCalledWith('/users', 'tok', {
      method: 'POST',
      body: JSON.stringify({ email: 'bob@x.test', name: 'Bob Smith', role: 'CLINICIAN', clinicId: 'clinic-a' }),
    });
  });

  it('clears the form and shows a confirmation banner on success', async () => {
    vi.mocked(apiFetch).mockResolvedValue(undefined);
    render(<InviteClinician token="tok" me={me} onBack={vi.fn()} />);

    fillAndSubmit();

    await screen.findByText(/Invited bob@x.test/);
    expect(screen.getByLabelText('Full name')).toHaveValue('');
    expect(screen.getByLabelText('Email')).toHaveValue('');
  });

  it('shows an error and does not clear the form on failure', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('Email already in use'));
    render(<InviteClinician token="tok" me={me} onBack={vi.fn()} />);

    fillAndSubmit();

    await screen.findByText('Email already in use');
    expect(screen.getByLabelText('Full name')).toHaveValue('Bob Smith');
    expect(screen.getByLabelText('Email')).toHaveValue('bob@x.test');
  });

  it('disables the submit button and swaps its label while busy', async () => {
    let resolveFetch: () => void = () => {};
    vi.mocked(apiFetch).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = () => resolve(undefined);
      }),
    );
    render(<InviteClinician token="tok" me={me} onBack={vi.fn()} />);

    fillAndSubmit();

    const button = await screen.findByText('Inviting…');
    expect(button).toBeDisabled();
    resolveFetch();
  });
});
