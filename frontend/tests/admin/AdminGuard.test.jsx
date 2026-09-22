import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Routes, Route } from 'react-router-dom';

import AdminGuard from '@/lib/AdminGuard';
import { useAuth } from '@/lib/AuthContext';

// ─────────────────────────────────────────────────────────────
// Mock authentication context
//
// AdminGuard makes all authorization decisions through useAuth(),
// so the tests control authentication state through this mock.
// ─────────────────────────────────────────────────────────────
jest.mock('@/lib/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// ─────────────────────────────────────────────────────────────
// Mock LoadingAnimation
//
// The actual animation is unrelated to authorization behavior.
// A simple test element lets us verify that the logout state
// renders the loading screen instead of redirecting.
// ─────────────────────────────────────────────────────────────
jest.mock('@/components/ui/LoadingAnimation', () => ({
  __esModule: true,
  default: () => <div data-testid="loading-animation">Loading...</div>,
}));

const mockUseAuth = useAuth;

const renderGuard = (authState, { children = null } = {}) => {
  mockUseAuth.mockReturnValue(authState);

  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route
          path="/admin"
          element={
            <AdminGuard>
              {children}
            </AdminGuard>
          }
        />

        <Route
          path="/403"
          element={<div data-testid="forbidden-page">Forbidden</div>}
        />
      </Routes>
    </MemoryRouter>
  );
};

describe('AdminGuard', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ───────────────────────────────────────────────────────────
  // Authentication / authorization
  // ───────────────────────────────────────────────────────────

  test('redirects an unauthenticated user to /403', () => {
    renderGuard({
      user: null,
      isAuthenticated: false,
      isLoggingOut: false,
    });

    expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
  });

  test('redirects an authenticated non-admin user to /403', () => {
    renderGuard({
      user: {
        role: 'user',
      },
      isAuthenticated: true,
      isLoggingOut: false,
    });

    expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
  });

  test('allows an authenticated admin to access the route', () => {
    renderGuard({
      user: {
        role: 'admin',
      },
      isAuthenticated: true,
      isLoggingOut: false,
    }, {
      children: <div data-testid="admin-content">Admin Content</div>,
    });

    expect(screen.getByTestId('admin-content')).toBeInTheDocument();
    expect(screen.queryByTestId('forbidden-page')).not.toBeInTheDocument();
  });

  // ───────────────────────────────────────────────────────────
  // Children rendering
  // ───────────────────────────────────────────────────────────

  test('renders children when an authenticated admin provides children', () => {
    renderGuard({
      user: {
        role: 'admin',
      },
      isAuthenticated: true,
      isLoggingOut: false,
    }, {
      children: <div data-testid="child-content">Protected Content</div>,
    });

    expect(screen.getByTestId('child-content')).toHaveTextContent(
      'Protected Content'
    );
  });

  // ───────────────────────────────────────────────────────────
  // Outlet rendering
  //
  // When children are not provided, AdminGuard returns <Outlet />
  // so nested admin routes can render their content.
  // ───────────────────────────────────────────────────────────

  test('renders Outlet when an authenticated admin has no children', () => {
    mockUseAuth.mockReturnValue({
      user: {
        role: 'admin',
      },
      isAuthenticated: true,
      isLoggingOut: false,
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route element={<AdminGuard />}>
            <Route
              path="/admin"
              element={<div data-testid="outlet-content">Nested Admin Content</div>}
            />
          </Route>

          <Route
            path="/403"
            element={<div data-testid="forbidden-page">Forbidden</div>}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('outlet-content')).toHaveTextContent(
      'Nested Admin Content'
    );
    expect(screen.queryByTestId('forbidden-page')).not.toBeInTheDocument();
  });

  // ───────────────────────────────────────────────────────────
  // Logout state
  //
  // During logout the authentication state can temporarily become
  // invalid. AdminGuard intentionally skips authorization checks
  // during this period to prevent a redirect to /403.
  // ───────────────────────────────────────────────────────────

  test('renders LoadingAnimation while logging out', () => {
    renderGuard({
      user: null,
      isAuthenticated: false,
      isLoggingOut: true,
    });

    expect(screen.getByTestId('loading-animation')).toBeInTheDocument();
    expect(screen.queryByTestId('forbidden-page')).not.toBeInTheDocument();
  });
});
