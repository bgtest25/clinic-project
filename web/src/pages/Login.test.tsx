import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import * as cognito from '../auth/cognito';
import { apiFetch } from '../api/client';
import { Login } from './Login';

vi.mock('../auth/cognito', () => ({
  login: vi.fn(),
  submitNewPassword: vi.fn(),
  submitMfaCode: vi.fn(),
  confirmMfaSetup: vi.fn(),
  forgotPassword: vi.fn(),
  confirmForgotPassword: vi.fn(),
  getCurrentAccessToken: vi.fn().mockResolvedValue(null),
  logout: vi.fn(),
}));

vi.mock('../api/client', () => ({ apiFetch: vi.fn() }));

function renderLogin() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('Login', () => {
  beforeEach(() => {
    vi.mocked(cognito.login).mockReset();
    vi.mocked(cognito.forgotPassword).mockReset();
    vi.mocked(cognito.confirmForgotPassword).mockReset();
    vi.mocked(apiFetch).mockReset();
  });

  it('shows Forgot password? link on the credentials screen', () => {
    renderLogin();
    expect(screen.getByText('Forgot password?')).toBeInTheDocument();
  });

  it('navigates to forgot password screen and back', () => {
    renderLogin();
    fireEvent.click(screen.getByText('Forgot password?'));
    expect(screen.getByText('Reset your password')).toBeInTheDocument();
    expect(screen.getByText('Send reset code')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Back to sign in'));
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('sends reset code and navigates to confirmation screen', async () => {
    vi.mocked(cognito.forgotPassword).mockResolvedValue(undefined);
    renderLogin();

    fireEvent.click(screen.getByText('Forgot password?'));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByText('Send reset code'));

    await waitFor(() => {
      expect(cognito.forgotPassword).toHaveBeenCalledWith('test@example.com');
    });
    expect(screen.getByText('Enter verification code')).toBeInTheDocument();
    expect(screen.getByText(/We sent a code to test@example.com/)).toBeInTheDocument();
  });

  it('shows error if forgot password request fails', async () => {
    vi.mocked(cognito.forgotPassword).mockRejectedValue(new Error('User not found'));
    renderLogin();

    fireEvent.click(screen.getByText('Forgot password?'));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bad@example.com' } });
    fireEvent.click(screen.getByText('Send reset code'));

    expect(await screen.findByText('User not found')).toBeInTheDocument();
  });

  it('completes password reset and shows success message', async () => {
    vi.mocked(cognito.forgotPassword).mockResolvedValue(undefined);
    vi.mocked(cognito.confirmForgotPassword).mockResolvedValue(undefined);
    renderLogin();

    fireEvent.click(screen.getByText('Forgot password?'));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByText('Send reset code'));

    await screen.findByText('Enter verification code');

    fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '123456' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'NewPass123!' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'NewPass123!' } });
    fireEvent.click(screen.getByText('Reset password'));

    await waitFor(() => {
      expect(cognito.confirmForgotPassword).toHaveBeenCalledWith('test@example.com', '123456', 'NewPass123!');
    });
    expect(screen.getByText('Password reset successfully. Sign in with your new password.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('shows error if password confirmation does not match', async () => {
    vi.mocked(cognito.forgotPassword).mockResolvedValue(undefined);
    renderLogin();

    fireEvent.click(screen.getByText('Forgot password?'));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByText('Send reset code'));

    await screen.findByText('Enter verification code');

    fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '123456' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'NewPass123!' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'Different123!' } });
    fireEvent.click(screen.getByText('Reset password'));

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(cognito.confirmForgotPassword).not.toHaveBeenCalled();
  });

  it('shows error if confirm forgot password fails', async () => {
    vi.mocked(cognito.forgotPassword).mockResolvedValue(undefined);
    vi.mocked(cognito.confirmForgotPassword).mockRejectedValue(new Error('Invalid verification code'));
    renderLogin();

    fireEvent.click(screen.getByText('Forgot password?'));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByText('Send reset code'));

    await screen.findByText('Enter verification code');

    fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '000000' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'NewPass123!' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'NewPass123!' } });
    fireEvent.click(screen.getByText('Reset password'));

    expect(await screen.findByText('Invalid verification code')).toBeInTheDocument();
  });

  it('calls complete-initial-setup after successful login', async () => {
    vi.mocked(cognito.login).mockResolvedValue({ type: 'success', accessToken: 'tok-123' });
    vi.mocked(apiFetch).mockResolvedValue({});
    renderLogin();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/users/me/complete-initial-setup', 'tok-123', { method: 'PATCH' });
    });
  });
});
