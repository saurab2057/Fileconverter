import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ForgotPasswordPage from '@/features/authpages/Forgetpassword';
import { authService } from '@/services/authService';
import { useToast } from '@/context/ToastContext';

// ─────────────────────────────────────────────────────────────
// Test Purpose
// ─────────────────────────────────────────────────────────────
// This test verifies the complete forgot-password flow:
//
// Form validation → reCAPTCHA → authService.forgotPassword()
// → success message / toast OR error toast.
//
// The backend and toast system are mocked so this test focuses
// only on the behavior of ForgotPasswordPage.
// ─────────────────────────────────────────────────────────────

jest.mock('@/services/authService', () => ({
  authService: {
    forgotPassword: jest.fn(),
  },
}));

jest.mock('@/context/ToastContext', () => ({
  useToast: jest.fn(),
}));

describe('ForgotPasswordPage', () => {
  const mockToast = {
    success: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    useToast.mockReturnValue(mockToast);

    window.grecaptcha = {
      execute: jest.fn(() => Promise.resolve('mock-recaptcha-token')),
    };
  });

  // ─────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────

  it('should render the forgot-password form', () => {
    render(<ForgotPasswordPage />);

    expect(
      screen.getByRole('heading', {
        name: /forgot your password/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText(/your registered email/i)
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', {
        name: /send reset link/i,
      })
    ).toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────
  // Form Validation
  // ─────────────────────────────────────────────────────────────

  it('should reject an invalid email and not submit the request', async () => {
    const user = userEvent.setup();

    render(<ForgotPasswordPage />);

    const emailInput = screen.getByPlaceholderText(/your registered email/i);

    await user.type(emailInput, 'invalid-email');

    await user.click(
      screen.getByRole('button', {
        name: /send reset link/i,
      })
    );

    // Invalid data must be rejected by the Zod resolver before
    // the submit handler, reCAPTCHA, or API request is executed.
    expect(authService.forgotPassword).not.toHaveBeenCalled();
    expect(window.grecaptcha.execute).not.toHaveBeenCalled();
  });

  it('should require an email address', async () => {
    const user = userEvent.setup();

    render(<ForgotPasswordPage />);

    await user.click(
      screen.getByRole('button', {
        name: /send reset link/i,
      })
    );

    expect(
      await screen.findByText(/email is required/i)
    ).toBeInTheDocument();

    expect(authService.forgotPassword).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────
  // Successful Submission
  // ─────────────────────────────────────────────────────────────

  it('should execute reCAPTCHA and send the forgot-password request', async () => {
    const user = userEvent.setup();

    authService.forgotPassword.mockResolvedValueOnce({
      message: 'Password reset link sent successfully.',
    });

    render(<ForgotPasswordPage />);

    await user.type(
      screen.getByPlaceholderText(/your registered email/i),
      'test@example.com'
    );

    await user.click(
      screen.getByRole('button', {
        name: /send reset link/i,
      })
    );

    await waitFor(() => {
      expect(window.grecaptcha.execute).toHaveBeenCalledWith(
        'mock-recaptcha-key',
        { action: 'forgot_password' }
      );
    });

    expect(authService.forgotPassword).toHaveBeenCalledWith(
      'test@example.com',
      'mock-recaptcha-token'
    );
  });

  it('should display the success message and success toast after submission', async () => {
    const user = userEvent.setup();

    authService.forgotPassword.mockResolvedValueOnce({
      message: 'Password reset link sent successfully.',
    });

    render(<ForgotPasswordPage />);

    await user.type(
      screen.getByPlaceholderText(/your registered email/i),
      'test@example.com'
    );

    await user.click(
      screen.getByRole('button', {
        name: /send reset link/i,
      })
    );

    expect(
      await screen.findByText(
        'Password reset link sent successfully.'
      )
    ).toBeInTheDocument();

    expect(mockToast.success).toHaveBeenCalledWith(
      'Reset link sent! Check your email.'
    );
  });

  // ─────────────────────────────────────────────────────────────
  // Error Handling
  // ─────────────────────────────────────────────────────────────

  it('should display the backend error message when the request fails', async () => {
    const user = userEvent.setup();

    authService.forgotPassword.mockRejectedValueOnce({
      response: {
        data: {
          message: 'Email address was not found.',
        },
      },
    });

    render(<ForgotPasswordPage />);

    await user.type(
      screen.getByPlaceholderText(/your registered email/i),
      'unknown@example.com'
    );

    await user.click(
      screen.getByRole('button', {
        name: /send reset link/i,
      })
    );

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        'Email address was not found.'
      );
    });

    expect(
      screen.queryByText(/password reset link sent successfully/i)
    ).not.toBeInTheDocument();
  });

  it('should display the generic error when the request fails without a backend message', async () => {
    const user = userEvent.setup();

    authService.forgotPassword.mockRejectedValueOnce(
      new Error('Network error')
    );

    render(<ForgotPasswordPage />);

    await user.type(
      screen.getByPlaceholderText(/your registered email/i),
      'test@example.com'
    );

    await user.click(
      screen.getByRole('button', {
        name: /send reset link/i,
      })
    );

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        'An unexpected error occurred.'
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Submitting State
  // ─────────────────────────────────────────────────────────────

  it('should show the submitting state while the request is pending', async () => {
    const user = userEvent.setup();

    let resolveRequest;

    authService.forgotPassword.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve;
      })
    );

    render(<ForgotPasswordPage />);

    await user.type(
      screen.getByPlaceholderText(/your registered email/i),
      'test@example.com'
    );

    const submitButton = screen.getByRole('button', {
      name: /send reset link/i,
    });

    await user.click(submitButton);

    expect(
      await screen.findByRole('button', {
        name: /sending/i,
      })
    ).toBeDisabled();

    resolveRequest({
      message: 'Password reset link sent successfully.',
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: /send reset link/i,
        })
      ).not.toBeDisabled();
    });
  });
});