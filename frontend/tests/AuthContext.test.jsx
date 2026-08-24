import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { authService } from '@/services/authService';

// Mock authService
jest.mock('@/services/authService', () => ({
  authService: {
    refreshToken: jest.fn().mockRejectedValue({
      response: { status: 401 },
    }),
    logout: jest.fn().mockResolvedValue({}),
  },
}));

// Test component
const TestComponent = () => {
  const {
    user,
    isAuthenticated,
    login,
    logout,
    authLoading,
  } = useAuth();

  return (
    <div>
      <div data-testid="loading">
        {authLoading ? 'Loading' : 'Loaded'}
      </div>

      <div data-testid="auth">
        {isAuthenticated ? 'Logged In' : 'Logged Out'}
      </div>

      {user && (
        <div data-testid="user-email">
          {user.email}
        </div>
      )}

      <button
        onClick={() =>
          login('fake-token', {
            email: 'test@test.com',
            name: 'Test User',
          })
        }
      >
        Login
      </button>

      <button onClick={() => logout()}>
        Logout
      </button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default state for each test:
    // No existing refresh session.
    authService.refreshToken.mockRejectedValue({
      response: { status: 401 },
    });
  });

  it('should throw error when used outside provider', () => {
    expect(() => render(<TestComponent />)).toThrow(
      'useAuth must be used within an AuthProvider'
    );
  });

  it('should render children when wrapped in provider', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>
    );

    // AuthProvider waits for refreshToken() before
    // rendering its children.
    await waitFor(() => {
      expect(screen.getByTestId('auth')).toHaveTextContent(
        'Logged Out'
      );
    });

    expect(screen.getByTestId('loading')).toHaveTextContent(
      'Loaded'
    );
  });

  it('should login user', async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>
    );

    // Wait for initial authentication check.
    await waitFor(() => {
      expect(screen.getByTestId('auth')).toHaveTextContent(
        'Logged Out'
      );
    });

    await user.click(screen.getByText('Login'));

    expect(screen.getByTestId('auth')).toHaveTextContent(
      'Logged In'
    );

    expect(screen.getByTestId('user-email')).toHaveTextContent(
      'test@test.com'
    );
  });

  it('should logout user', async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>
    );

    // Wait for initial authentication check.
    await waitFor(() => {
      expect(screen.getByTestId('auth')).toHaveTextContent(
        'Logged Out'
      );
    });

    await user.click(screen.getByText('Login'));

    expect(screen.getByTestId('auth')).toHaveTextContent(
      'Logged In'
    );

    await user.click(screen.getByText('Logout'));

    expect(screen.getByTestId('auth')).toHaveTextContent(
      'Logged Out'
    );

    expect(authService.logout).toHaveBeenCalled();
  });

  it('should refresh token on mount if authenticated', async () => {
    authService.refreshToken.mockResolvedValueOnce({
      accessToken: 'new-token',
      user: {
        email: 'existing@test.com',
        name: 'Existing User',
      },
    });

    render(
      <BrowserRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(authService.refreshToken).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth')).toHaveTextContent(
        'Logged In'
      );
    });

    expect(screen.getByTestId('user-email')).toHaveTextContent(
      'existing@test.com'
    );

    expect(screen.getByTestId('loading')).toHaveTextContent(
      'Loaded'
    );
  });
});