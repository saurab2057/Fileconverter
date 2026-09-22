
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import PasskeyLogin from '@/features/authpages/PasskeyLogin';
import { startAuthentication } from '@simplewebauthn/browser';
import apiClient from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/context/ToastContext';

// ─────────────────────────────────────────────────────────────
// Test Purpose
// ─────────────────────────────────────────────────────────────
// These tests verify the behavior implemented by PasskeyLogin:
//
// Email validation
// → passkey challenge request
// → browser passkey authentication
// → server verification
// → authentication state update
// → role-based navigation
//
// External authentication/API dependencies are mocked so the
// tests focus only on the component's own behavior.
// ─────────────────────────────────────────────────────────────

jest.mock('@simplewebauthn/browser', () => ({
  startAuthentication: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
}));

jest.mock('@/lib/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/context/ToastContext', () => ({
  useToast: jest.fn(),
}));

describe('PasskeyLogin', () => {
  const mockLogin = jest.fn();

  const mockToast = {
    success: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();

    useAuth.mockReturnValue({
      login: mockLogin,
    });

    useToast.mockReturnValue(mockToast);
  });

  const renderPage = () => {
    return render(
      <MemoryRouter initialEntries={['/passkey-login']}>
        <PasskeyLogin />
      </MemoryRouter>
    );
  };

  const renderPageWithRoutes = () => {
    return render(
      <MemoryRouter initialEntries={['/passkey-login']}>
        <Routes>
          <Route path="/passkey-login" element={<PasskeyLogin />} />
          <Route path="/" element={<div>Home Route</div>} />
          <Route path="/admin" element={<div>Admin Dashboard Route</div>} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('should render the passkey login form', () => {
    renderPage();

    expect(
      screen.getByRole('heading', {
        name: /sign in with passkey/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText('Enter your email')
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', {
        name: /continue with passkey/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /passkeys use your device's biometric sensor or pin/i
      )
    ).toBeInTheDocument();
  });

  it('should reject an invalid email and not start the passkey flow', async () => {
    const user = userEvent.setup();

    renderPage();

    await user.type(
      screen.getByPlaceholderText('Enter your email'),
      'invalid-email'
    );

    await user.click(
      screen.getByRole('button', {
        name: /continue with passkey/i,
      })
    );

    expect(apiClient.post).not.toHaveBeenCalled();
    expect(startAuthentication).not.toHaveBeenCalled();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('should require an email address', async () => {
    const user = userEvent.setup();

    renderPage();

    await user.click(
      screen.getByRole('button', {
        name: /continue with passkey/i,
      })
    );

    expect(
      await screen.findByText(/email is required/i)
    ).toBeInTheDocument();

    expect(apiClient.post).not.toHaveBeenCalled();
    expect(startAuthentication).not.toHaveBeenCalled();
  });

  it('should request the passkey challenge using the normalized email', async () => {
    const user = userEvent.setup();

    apiClient.post
      .mockResolvedValueOnce({
        data: {
          challenge: 'mock-challenge',
        },
      })
      .mockResolvedValueOnce({
        data: {
          accessToken: 'mock-access-token',
          user: {
            id: 'user-1',
            email: 'test@example.com',
            role: 'user',
          },
        },
      });

    startAuthentication.mockResolvedValueOnce({
      id: 'credential-id',
      response: {
        clientDataJSON: 'client-data',
      },
    });

    renderPage();

    await user.type(
      screen.getByPlaceholderText('Enter your email'),
      '  TEST@Example.COM  '
    );

    await user.click(
      screen.getByRole('button', {
        name: /continue with passkey/i,
      })
    );

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenNthCalledWith(
        1,
        '/api/passkeys/login/start',
        {
          email: 'test@example.com',
        }
      );
    });
  });

  it('should show the waiting-for-device state while passkey authentication is pending', async () => {
    const user = userEvent.setup();

    apiClient.post.mockResolvedValueOnce({
      data: {
        challenge: 'mock-challenge',
      },
    });

    let resolveAuthentication;

    startAuthentication.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAuthentication = resolve;
      })
    );

    renderPage();

    await user.type(
      screen.getByPlaceholderText('Enter your email'),
      'test@example.com'
    );

    await user.click(
      screen.getByRole('button', {
        name: /continue with passkey/i,
      })
    );

    expect(
      await screen.findByRole('button', {
        name: /waiting for device/i,
      })
    ).toBeDisabled();

    expect(
      screen.getByPlaceholderText('Enter your email')
    ).toBeDisabled();

    resolveAuthentication({
      id: 'credential-id',
      response: {
        clientDataJSON: 'client-data',
      },
    });

    await waitFor(() => {
      expect(startAuthentication).toHaveBeenCalled();
    });
  });

  it('should show the cancellation message when the passkey prompt is cancelled', async () => {
    const user = userEvent.setup();

    apiClient.post.mockResolvedValueOnce({
      data: {
        challenge: 'mock-challenge',
      },
    });

    const error = new Error('User cancelled');
    error.name = 'NotAllowedError';

    startAuthentication.mockRejectedValueOnce(error);

    renderPage();

    await user.type(
      screen.getByPlaceholderText('Enter your email'),
      'test@example.com'
    );

    await user.click(
      screen.getByRole('button', {
        name: /continue with passkey/i,
      })
    );

    expect(
      await screen.findByText(
        'Passkey prompt was cancelled. Please try again.'
      )
    ).toBeInTheDocument();

    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it('should show the unsupported-device message when passkey authentication fails', async () => {
    const user = userEvent.setup();

    apiClient.post.mockResolvedValueOnce({
      data: {
        challenge: 'mock-challenge',
      },
    });

    const error = new Error('WebAuthn unavailable');
    error.name = 'NotSupportedError';

    startAuthentication.mockRejectedValueOnce(error);

    renderPage();

    await user.type(
      screen.getByPlaceholderText('Enter your email'),
      'test@example.com'
    );

    await user.click(
      screen.getByRole('button', {
        name: /continue with passkey/i,
      })
    );

    expect(
      await screen.findByText(
        'Your device does not support passkeys or the prompt failed.'
      )
    ).toBeInTheDocument();

    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it('should show the backend message when no passkey is found', async () => {
    const user = userEvent.setup();

    apiClient.post.mockRejectedValueOnce({
      response: {
        status: 404,
        data: {
          message: 'No registered passkey found.',
        },
      },
    });

    renderPage();

    await user.type(
      screen.getByPlaceholderText('Enter your email'),
      'test@example.com'
    );

    await user.click(
      screen.getByRole('button', {
        name: /continue with passkey/i,
      })
    );

    expect(
      await screen.findByText('No registered passkey found.')
    ).toBeInTheDocument();

    const dashboardText = screen.getByText('Dashboard');

    const guidanceMessage = dashboardText.closest('p');

    expect(guidanceMessage).toHaveTextContent(
      'Log in with your password first, then go to your Dashboard to add a passkey.'
    );

    expect(startAuthentication).not.toHaveBeenCalled();
  });

  it('should show the default message when no passkey is found and the server provides no message', async () => {
    const user = userEvent.setup();

    apiClient.post.mockRejectedValueOnce({
      response: {
        status: 404,
        data: {},
      },
    });

    renderPage();

    await user.type(
      screen.getByPlaceholderText('Enter your email'),
      'test@example.com'
    );

    await user.click(
      screen.getByRole('button', {
        name: /continue with passkey/i,
      })
    );

    expect(
      await screen.findByText(
        'No passkey found for this account.'
      )
    ).toBeInTheDocument();
  });

  it('should show the inactive-account message when the server returns 403', async () => {
    const user = userEvent.setup();

    apiClient.post.mockRejectedValueOnce({
      response: {
        status: 403,
      },
    });

    renderPage();

    await user.type(
      screen.getByPlaceholderText('Enter your email'),
      'test@example.com'
    );

    await user.click(
      screen.getByRole('button', {
        name: /continue with passkey/i,
      })
    );

    expect(
      await screen.findByText(
        'This account is not active. Please contact support.'
      )
    ).toBeInTheDocument();
  });

  it('should show the backend error message for another API failure', async () => {
    const user = userEvent.setup();

    apiClient.post.mockRejectedValueOnce({
      response: {
        status: 500,
        data: {
          message: 'Passkey service is unavailable.',
        },
      },
    });

    renderPage();

    await user.type(
      screen.getByPlaceholderText('Enter your email'),
      'test@example.com'
    );

    await user.click(
      screen.getByRole('button', {
        name: /continue with passkey/i,
      })
    );

    expect(
      await screen.findByText(
        'Passkey service is unavailable.'
      )
    ).toBeInTheDocument();
  });

  it('should show the generic error when the API failure has no backend message', async () => {
    const user = userEvent.setup();

    apiClient.post.mockRejectedValueOnce(
      new Error('Network error')
    );

    renderPage();

    await user.type(
      screen.getByPlaceholderText('Enter your email'),
      'test@example.com'
    );

    await user.click(
      screen.getByRole('button', {
        name: /continue with passkey/i,
      })
    );

    expect(
      await screen.findByText(
        'Something went wrong. Please try again.'
      )
    ).toBeInTheDocument();
  });

  it('should complete passkey login successfully for a regular user', async () => {
    const user = userEvent.setup();

    const assertion = {
      id: 'credential-id',
      response: {
        clientDataJSON: 'client-data',
        authenticatorData: 'authenticator-data',
        signature: 'signature',
      },
    };

    apiClient.post
      .mockResolvedValueOnce({
        data: {
          challenge: 'mock-challenge',
        },
      })
      .mockResolvedValueOnce({
        data: {
          accessToken: 'mock-access-token',
          user: {
            id: 'user-1',
            email: 'test@example.com',
            role: 'user',
          },
        },
      });

    startAuthentication.mockResolvedValueOnce(assertion);

    renderPage();

    await user.type(
      screen.getByPlaceholderText('Enter your email'),
      'test@example.com'
    );

    await user.click(
      screen.getByRole('button', {
        name: /continue with passkey/i,
      })
    );

    await waitFor(() => {
      expect(startAuthentication).toHaveBeenCalledWith({
        optionsJSON: {
          challenge: 'mock-challenge',
        },
      });
    });

    expect(apiClient.post).toHaveBeenNthCalledWith(
      2,
      '/api/passkeys/login/finish',
      {
        response: assertion,
      }
    );

    expect(mockLogin).toHaveBeenCalledWith(
      'mock-access-token',
      {
        id: 'user-1',
        email: 'test@example.com',
        role: 'user',
      }
    );

    expect(mockToast.success).toHaveBeenCalledWith(
      'Login successful!'
    );

    expect(
      await screen.findByText('Verified! Logging you in...')
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', {
        name: /verified/i,
      })
    ).toBeDisabled();
  });

  it('should navigate a regular user to the home page after successful login', async () => {
    const user = userEvent.setup();

    apiClient.post
      .mockResolvedValueOnce({
        data: {
          challenge: 'mock-challenge',
        },
      })
      .mockResolvedValueOnce({
        data: {
          accessToken: 'mock-access-token',
          user: {
            id: 'user-1',
            email: 'test@example.com',
            role: 'user',
          },
        },
      });

    startAuthentication.mockResolvedValueOnce({
      id: 'credential-id',
      response: {
        clientDataJSON: 'client-data',
      },
    });

    renderPageWithRoutes();

    await user.type(
      screen.getByPlaceholderText('Enter your email'),
      'test@example.com'
    );

    await user.click(
      screen.getByRole('button', {
        name: /continue with passkey/i,
      })
    );

    expect(
      await screen.findByText('Verified! Logging you in...')
    ).toBeInTheDocument();

    expect(
      await screen.findByText('Home Route', {}, { timeout: 2000 })
    ).toBeInTheDocument();
  });

  it('should navigate an admin user to the admin dashboard after successful login', async () => {
    const user = userEvent.setup();

    apiClient.post
      .mockResolvedValueOnce({
        data: {
          challenge: 'mock-challenge',
        },
      })
      .mockResolvedValueOnce({
        data: {
          accessToken: 'admin-access-token',
          user: {
            id: 'admin-1',
            email: 'admin@example.com',
            role: 'admin',
          },
        },
      });

    startAuthentication.mockResolvedValueOnce({
      id: 'admin-credential',
      response: {
        clientDataJSON: 'client-data',
      },
    });

    renderPageWithRoutes();

    await user.type(
      screen.getByPlaceholderText('Enter your email'),
      'admin@example.com'
    );

    await user.click(
      screen.getByRole('button', {
        name: /continue with passkey/i,
      })
    );

    expect(
      await screen.findByText('Verified! Logging you in...')
    ).toBeInTheDocument();

    expect(
      await screen.findByText(
        'Admin Dashboard Route',
        {},
        { timeout: 2000 }
      )
    ).toBeInTheDocument();
  });
});

