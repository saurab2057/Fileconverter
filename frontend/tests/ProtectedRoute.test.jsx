import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from '@/lib/ProtectedRoute';

// Mock LoadingAnimation so the test focuses on ProtectedRoute behavior.
jest.mock('@/components/ui/LoadingAnimation', () => ({
  __esModule: true,
  default: () => <div>Loading Authentication</div>,
}));

// Mock useAuth so every authentication state can be controlled directly.
jest.mock('@/lib/AuthContext', () => ({
  ...jest.requireActual('@/lib/AuthContext'),
  useAuth: jest.fn(),
}));

const { useAuth } = require('@/lib/AuthContext');

const TestComponent = () => <div>Protected Content</div>;
const LoginComponent = () => <div>Home Page</div>;
const AdminComponent = () => <div>Admin Dashboard</div>;
const OutletComponent = () => <div>Outlet Content</div>;

describe('ProtectedRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading animation while logging out', () => {
    useAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoggingOut: true,
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <TestComponent />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(
      screen.getByText('Loading Authentication')
    ).toBeInTheDocument();

    expect(
      screen.queryByText('Protected Content')
    ).not.toBeInTheDocument();
  });

  it('should redirect unauthenticated users to home', () => {
    useAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoggingOut: false,
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/" element={<LoginComponent />} />

          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <TestComponent />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Home Page')).toBeInTheDocument();

    expect(
      screen.queryByText('Protected Content')
    ).not.toBeInTheDocument();
  });

  it('should redirect authenticated admin users to /admin', () => {
    useAuth.mockReturnValue({
      user: {
        role: 'admin',
        email: 'admin@test.com',
      },
      isAuthenticated: true,
      isLoggingOut: false,
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/admin"
            element={<AdminComponent />}
          />

          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <TestComponent />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(
      screen.getByText('Admin Dashboard')
    ).toBeInTheDocument();

    expect(
      screen.queryByText('Protected Content')
    ).not.toBeInTheDocument();
  });

  it('should render children for authenticated regular users', () => {
    useAuth.mockReturnValue({
      user: {
        role: 'user',
        email: 'user@test.com',
      },
      isAuthenticated: true,
      isLoggingOut: false,
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <TestComponent />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(
      screen.getByText('Protected Content')
    ).toBeInTheDocument();
  });

  it('should render the Outlet when no children are provided', () => {
    useAuth.mockReturnValue({
      user: {
        role: 'user',
        email: 'user@test.com',
      },
      isAuthenticated: true,
      isLoggingOut: false,
    });

    render(
      <MemoryRouter initialEntries={['/protected/outlet']}>
        <Routes>
          <Route
            path="/protected"
            element={<ProtectedRoute />}
          >
            <Route
              path="outlet"
              element={<OutletComponent />}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(
      screen.getByText('Outlet Content')
    ).toBeInTheDocument();
  });
});