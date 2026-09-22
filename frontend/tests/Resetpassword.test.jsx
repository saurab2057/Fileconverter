
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import ResetPasswordPage from '@/features/authpages/Resetpassword';
import { authService } from '@/services/authService';
import { useToast } from '@/context/ToastContext';

// ─────────────────────────────────────────────────────────────
// Test Purpose
// ─────────────────────────────────────────────────────────────
// This test verifies the complete password-reset flow:
//
// Reset token → token validation → password submission
// → success/error handling → navigation.
//
// The authentication service and toast system are mocked so the test
// focuses only on the behavior of ResetPasswordPage.
// ─────────────────────────────────────────────────────────────

jest.mock('@/services/authService', () => ({
  authService: {
    validateResetToken: jest.fn(),
    resetPassword: jest.fn(),
  },
}));

jest.mock('@/context/ToastContext', () => ({
  useToast: jest.fn(),
}));

describe('ResetPasswordPage', () => {
  const mockToast = {
    success: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    useToast.mockReturnValue(mockToast);

    window.history.replaceState({}, '', '/reset-password');
  });

  // ─────────────────────────────────────────────────────────────
  // Helper
  // ─────────────────────────────────────────────────────────────
  // Renders the page with an optional reset token in the URL.
  // MemoryRouter gives the component a controlled router environment
  // without starting the application's full routing configuration.
  const renderPage = (search = '') => {
    return render(
      <MemoryRouter
        initialEntries={[`/reset-password${search}`]}
      >
        <ResetPasswordPage />
      </MemoryRouter>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // Initial State
  // ─────────────────────────────────────────────────────────────

  it('should show secure reset session message when no token is provided', () => {
    renderPage();

    expect(
      screen.getByText(/secure reset session required/i)
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', { name: /request new reset link/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', { name: /back to login/i })
    ).toBeInTheDocument();

    expect(authService.validateResetToken).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────
  // Token Validation
  // ─────────────────────────────────────────────────────────────

  it('should validate the reset token when a token is provided', async () => {
    authService.validateResetToken.mockResolvedValueOnce({
      valid: true,
    });

    renderPage('?token=test-reset-token');

    expect(
      screen.getByText(/verifying reset link/i)
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(authService.validateResetToken).toHaveBeenCalledWith(
        'test-reset-token'
      );
    });
  });

  it('should show the password form after successful token validation', async () => {
    authService.validateResetToken.mockResolvedValueOnce({
      valid: true,
    });

    renderPage('?token=test-reset-token');

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: /set new password/i,
        })
      ).toBeInTheDocument();
    });

    expect(
      screen.getByPlaceholderText('New password (min. 8 characters)')
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText('Confirm new password')
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', {
        name: /reset password/i,
      })
    ).toBeInTheDocument();
  });

  it('should show an error when the reset token is invalid', async () => {
    authService.validateResetToken.mockRejectedValueOnce({
      response: {
        data: {
          message: 'Reset link is invalid or expired.',
        },
      },
    });

    renderPage('?token=invalid-token');

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        'Reset link is invalid or expired.'
      );
    });

    expect(
      screen.queryByRole('heading', {
        name: /set new password/i,
      })
    ).not.toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────
  // Password Validation
  // ─────────────────────────────────────────────────────────────

  it('should not submit when the password is invalid', async () => {
    const user = userEvent.setup();

    authService.validateResetToken.mockResolvedValueOnce({
      valid: true,
    });

    renderPage('?token=test-reset-token');

    const passwordInput = await screen.findByPlaceholderText(
      'New password (min. 8 characters)'
    );

    const confirmPasswordInput =
      screen.getByPlaceholderText('Confirm new password');

    await user.type(passwordInput, 'weak');
    await user.type(confirmPasswordInput, 'weak');

    await user.click(
      screen.getByRole('button', {
        name: /reset password/i,
      })
    );

    expect(authService.resetPassword).not.toHaveBeenCalled();
  });

  it('should reject mismatched passwords', async () => {
    const user = userEvent.setup();

    authService.validateResetToken.mockResolvedValueOnce({
      valid: true,
    });

    renderPage('?token=test-reset-token');

    const passwordInput = await screen.findByPlaceholderText(
      'New password (min. 8 characters)'
    );

    const confirmPasswordInput =
      screen.getByPlaceholderText('Confirm new password');

    await user.type(passwordInput, 'Password123!');
    await user.type(confirmPasswordInput, 'Different123!');

    await user.click(
      screen.getByRole('button', {
        name: /reset password/i,
      })
    );

    expect(
      await screen.findByText(/passwords do not match/i)
    ).toBeInTheDocument();

    expect(authService.resetPassword).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────
  // Successful Password Reset
  // ─────────────────────────────────────────────────────────────

  it('should reset the password successfully', async () => {
    const user = userEvent.setup();

    authService.validateResetToken.mockResolvedValueOnce({
      valid: true,
    });

    authService.resetPassword.mockResolvedValueOnce({
      message: 'Password reset successfully.',
    });

    renderPage('?token=test-reset-token');

    const passwordInput = await screen.findByPlaceholderText(
      'New password (min. 8 characters)'
    );

    const confirmPasswordInput =
      screen.getByPlaceholderText('Confirm new password');

    await user.type(passwordInput, 'Password123!');
    await user.type(confirmPasswordInput, 'Password123!');

    await user.click(
      screen.getByRole('button', {
        name: /reset password/i,
      })
    );

    await waitFor(() => {
      expect(authService.resetPassword).toHaveBeenCalledWith(
        'Password123!'
      );
    });

    expect(mockToast.success).toHaveBeenCalledWith(
      'Password reset successfully.'
    );
  });

  // ─────────────────────────────────────────────────────────────
  // Reset Session Errors
  // ─────────────────────────────────────────────────────────────

  it('should handle an expired reset session', async () => {
    const user = userEvent.setup();

    authService.validateResetToken.mockResolvedValueOnce({
      valid: true,
    });

    authService.resetPassword.mockRejectedValueOnce({
      response: {
        status: 401,
      },
    });

    renderPage('?token=test-reset-token');

    const passwordInput = await screen.findByPlaceholderText(
      'New password (min. 8 characters)'
    );

    const confirmPasswordInput =
      screen.getByPlaceholderText('Confirm new password');

    await user.type(passwordInput, 'Password123!');
    await user.type(confirmPasswordInput, 'Password123!');

    await user.click(
      screen.getByRole('button', {
        name: /reset password/i,
      })
    );

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        'Reset session expired. Please request a new link.'
      );
    });
  });

  it('should display the backend error when password reset fails', async () => {
    const user = userEvent.setup();

    authService.validateResetToken.mockResolvedValueOnce({
      valid: true,
    });

    authService.resetPassword.mockRejectedValueOnce({
      response: {
        data: {
          message: 'Unable to reset password.',
        },
      },
    });

    renderPage('?token=test-reset-token');

    const passwordInput = await screen.findByPlaceholderText(
      'New password (min. 8 characters)'
    );

    const confirmPasswordInput =
      screen.getByPlaceholderText('Confirm new password');

    await user.type(passwordInput, 'Password123!');
    await user.type(confirmPasswordInput, 'Password123!');

    await user.click(
      screen.getByRole('button', {
        name: /reset password/i,
      })
    );

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        'Unable to reset password.'
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Submitting State
  // ─────────────────────────────────────────────────────────────

  it('should show the submitting state while resetting the password', async () => {
    const user = userEvent.setup();

    let resolveReset;

    authService.validateResetToken.mockResolvedValueOnce({
      valid: true,
    });

    authService.resetPassword.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveReset = resolve;
      })
    );

    renderPage('?token=test-reset-token');

    const passwordInput = await screen.findByPlaceholderText(
      'New password (min. 8 characters)'
    );

    const confirmPasswordInput =
      screen.getByPlaceholderText('Confirm new password');

    await user.type(passwordInput, 'Password123!');
    await user.type(confirmPasswordInput, 'Password123!');

    await user.click(
      screen.getByRole('button', {
        name: /reset password/i,
      })
    );

    expect(
      await screen.findByRole('button', {
        name: /resetting password/i,
      })
    ).toBeDisabled();

    resolveReset({
      message: 'Password reset successfully.',
    });

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith(
        'Password reset successfully.'
      );
    });
  });
});