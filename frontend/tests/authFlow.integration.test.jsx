// frontend/tests/authFlow.integration.test.jsx
// ─────────────────────────────────────────────────────────────
// Integration Test Purpose
// ─────────────────────────────────────────────────────────────
// This test verifies that the authentication components work together
// correctly rather than testing each component in isolation.
//
// Main flow covered:
// LoginForm → authService → AuthContext → Router
//
// It also verifies that ProtectedRoute prevents unauthenticated users
// from accessing protected pages and redirects them to the home page.
// ─────────────────────────────────────────────────────────────


// Mock the authentication service so no real backend/API request is made.
// The test controls successful and failed login responses.
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
  },
}));

jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api'),

  // AuthProvider initializes by calling refreshWithLock().
  // Rejecting with 401 represents a normal unauthenticated session.
  refreshWithLock: jest.fn().mockRejectedValue({
    response: { status: 401 },
  }),

  session: {
    accessToken: null,

    setToken: jest.fn(function (token) {
      this.accessToken = token;
    }),

    clearToken: jest.fn(function () {
      this.accessToken = null;
    }),

    getToken: jest.fn(function () {
      return this.accessToken;
    }),
  },
}));

jest.mock('@/hooks/useGoogleAuth', () => ({
  useGoogleAuth: () => ({
    handleGoogleClick: jest.fn(),
    isLoading: false,
  }),
}));

jest.mock('@/components/ui/LoadingAnimation', () => ({
  __esModule: true,
  default: ({ text }) => (
    <div>{text || 'Loading'}</div>
  ),
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

  it('should login user successfully and navigate to home', async () => {
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

    expect(authService.login).toHaveBeenCalledTimes(1);

    expect(authService.login).toHaveBeenCalledWith({
      email: 'test@test.com',
      password: 'Password123!',
      recaptchaToken: 'mock-recaptcha-token',
    });

    /*
     * Login.jsx intentionally waits 2 seconds before navigating
     * so the "Hang Tight" loading state can be displayed.
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
  });

  it('should show error message when login fails', async () => {
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

  it('should show loading state while redirecting after successful login', async () => {
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
          path="/login"
          element={<LoginForm />}
        />
        <Route
          path="/"
          element={<HomeComponent />}
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
      'Password123!'
    );

    await user.click(
      screen.getByRole('button', {
        name: /^login$/i,
      })
    );

    await waitFor(() => {
      expect(
        screen.getByText('Hang Tight')
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole('button', {
      name: /^login$/i,
      })
    ).toBeDisabled();
  });
});