import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MemoryRouter,
  Routes,
  Route,
} from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';

import { AuthProvider } from '@/lib/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import LoginForm from '@/features/authpages/Login';
import ProtectedRoute from '@/lib/ProtectedRoute';
import { authService } from '@/services/authService';

jest.mock('@/services/authService', () => ({
  authService: {
    login: jest.fn(),
    refreshToken: jest.fn().mockRejectedValue({
      response: { status: 401 },
    }),
  },
}));

const ProtectedComponent = () => (
  <div>Protected Content</div>
);

const HomeComponent = () => (
  <div>Home Page</div>
);

describe('Authentication Flow (Integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    authService.refreshToken.mockRejectedValue({
      response: { status: 401 },
    });

    // ToastProvider uses crypto.randomUUID().
    if (!globalThis.crypto) {
      Object.defineProperty(globalThis, 'crypto', {
        value: {},
        configurable: true,
      });
    }

    if (!globalThis.crypto.randomUUID) {
      globalThis.crypto.randomUUID = jest.fn(
        () =>
          `test-toast-${Math.random()
            .toString(36)
            .substring(2)}`
      );
    }
  });

  const renderWithProviders = (ui, initialEntries) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <GoogleOAuthProvider clientId="mock-google-client-id">
          <AuthProvider>
            <ToastProvider>
              {ui}
            </ToastProvider>
          </AuthProvider>
        </GoogleOAuthProvider>
      </MemoryRouter>
    );
  };

  it('should redirect unauthenticated user to home', async () => {
    renderWithProviders(
      <Routes>
        <Route
          path="/"
          element={<HomeComponent />}
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <ProtectedComponent />
            </ProtectedRoute>
          }
        />
      </Routes>,
      ['/dashboard']
    );

    await waitFor(() => {
      expect(
        screen.getByText('Home Page')
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByText('Protected Content')
    ).not.toBeInTheDocument();
  });

  it('should login user successfully', async () => {
    const user = userEvent.setup();

    authService.login.mockResolvedValueOnce({
      accessToken: 'fake-token',
      user: {
        email: 'test@test.com',
        name: 'Test User',
        role: 'user',
      },
    });

    renderWithProviders(
      <Routes>
        <Route
          path="/"
          element={<HomeComponent />}
        />

        <Route
          path="/login"
          element={<LoginForm />}
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <ProtectedComponent />
            </ProtectedRoute>
          }
        />
      </Routes>,
      ['/login']
    );

    await waitFor(() => {
      expect(
        screen.getByText('Login to Your Account')
      ).toBeInTheDocument();
    });

    const emailInput = screen.getByPlaceholderText(
      /enter your email/i
    );

    const passwordInput = screen.getByPlaceholderText(
      /enter your password/i
    );

    await user.type(
      emailInput,
      'test@test.com'
    );

    await user.type(
      passwordInput,
      'Password123!'
    );

    await user.click(
      screen.getByRole('button', {
        name: /^login$/i,
      })
    );

    /*
     * Login.jsx navigates to "/" after a successful
     * normal-user login.
     */
    await waitFor(
      () => {
        expect(
          screen.getByText('Home Page')
        ).toBeInTheDocument();
      },
      {
        timeout: 4000,
      }
    );

    expect(authService.login).toHaveBeenCalledTimes(1);

    expect(authService.login).toHaveBeenCalledWith({
      email: 'test@test.com',
      password: 'Password123!',
      recaptchaToken: 'mock-recaptcha-token',
    });
  });

  it('should show error message on login failure', async () => {
    const user = userEvent.setup();

    authService.login.mockRejectedValueOnce({
      response: {
        data: {
          message: 'Invalid credentials',
        },
      },
    });

    renderWithProviders(
      <Routes>
        <Route
          path="/login"
          element={<LoginForm />}
        />
      </Routes>,
      ['/login']
    );

    await waitFor(() => {
      expect(
        screen.getByText('Login to Your Account')
      ).toBeInTheDocument();
    });

    await user.type(
      screen.getByPlaceholderText(/enter your email/i),
      'test@test.com'
    );

    await user.type(
      screen.getByPlaceholderText(/enter your password/i),
      'WrongPassword'
    );

    await user.click(
      screen.getByRole('button', {
        name: /^login$/i,
      })
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Invalid credentials/i)
      ).toBeInTheDocument();
    });

    expect(authService.login).toHaveBeenCalledTimes(1);

    expect(authService.login).toHaveBeenCalledWith({
      email: 'test@test.com',
      password: 'WrongPassword',
      recaptchaToken: 'mock-recaptcha-token',
    });
  });
});