import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import AdminMainLayout from '@/features/adminpages/AdminMainLayout';
import { useAuth } from '@/lib/AuthContext';

jest.mock('@/lib/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/features/adminpages/Sidebar', () => ({
  __esModule: true,
  default: ({
    navItems,
    isSidebarOpen,
    setSidebarOpen,
    handleLogout,
  }) => (
    <div data-testid="admin-sidebar">
      <div data-testid="sidebar-state">
        {isSidebarOpen ? 'open' : 'closed'}
      </div>

      {navItems.map(item => (
        <div key={item.path}>{item.label}</div>
      ))}

      <button onClick={() => setSidebarOpen(false)}>
        Close Sidebar
      </button>

      <button onClick={handleLogout}>
        Sidebar Logout
      </button>
    </div>
  ),
}));

describe('AdminMainLayout', () => {
  const logoutMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    useAuth.mockReturnValue({
      logout: logoutMock,
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Basic layout rendering
  // ─────────────────────────────────────────────────────────────
  test('renders the admin layout and navigation items', () => {
    render(
      <MemoryRouter>
        <AdminMainLayout />
      </MemoryRouter>
    );

    expect(screen.getByTestId('admin-sidebar')).toBeInTheDocument();

    expect(
      screen.getByRole('link', { name: /dashboard/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', { name: /jobs/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', { name: /users/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', { name: /audit/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', { name: /settings/i })
    ).toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────
  // Navigation paths
  // ─────────────────────────────────────────────────────────────
  test('renders the correct admin navigation paths', () => {
    render(
      <MemoryRouter>
        <AdminMainLayout />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('link', { name: /dashboard/i })
    ).toHaveAttribute('href', '/admin/dashboard');

    expect(
      screen.getByRole('link', { name: /jobs/i })
    ).toHaveAttribute('href', '/admin/jobs');

    expect(
      screen.getByRole('link', { name: /users/i })
    ).toHaveAttribute('href', '/admin/users');

    expect(
      screen.getByRole('link', { name: /audit/i })
    ).toHaveAttribute('href', '/admin/audit-logs');

    expect(
      screen.getByRole('link', { name: /settings/i })
    ).toHaveAttribute('href', '/admin/config');
  });

  // ─────────────────────────────────────────────────────────────
  // Mobile sidebar
  // ─────────────────────────────────────────────────────────────
  test('opens the sidebar from the mobile menu button', () => {
    render(
      <MemoryRouter>
        <AdminMainLayout />
      </MemoryRouter>
    );

    expect(
      screen.getByTestId('sidebar-state')
    ).toHaveTextContent('closed');

    fireEvent.click(
      screen.getByRole('button', {
        name: /open sidebar/i,
      })
    );

    expect(
      screen.getByTestId('sidebar-state')
    ).toHaveTextContent('open');
  });

  // ─────────────────────────────────────────────────────────────
  // Mobile sidebar overlay
  // ─────────────────────────────────────────────────────────────
  test('closes the sidebar when the overlay is clicked', () => {
    render(
      <MemoryRouter>
        <AdminMainLayout />
      </MemoryRouter>
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /open sidebar/i,
      })
    );

    expect(
      screen.getByTestId('sidebar-state')
    ).toHaveTextContent('open');

    const overlay = document.querySelector(
      '.fixed.inset-0.bg-black'
    );

    expect(overlay).toBeInTheDocument();

    fireEvent.click(overlay);

    expect(
      screen.getByTestId('sidebar-state')
    ).toHaveTextContent('closed');
  });

  // ─────────────────────────────────────────────────────────────
  // Desktop logout
  // ─────────────────────────────────────────────────────────────
  test('calls logout when the desktop logout button is clicked', () => {
    render(
      <MemoryRouter>
        <AdminMainLayout />
      </MemoryRouter>
    );

    const logoutButton = screen.getByRole('button', {
      name: /^logout$/i,
    });

    fireEvent.click(logoutButton);

    expect(logoutMock).toHaveBeenCalledTimes(1);
  });

  // ─────────────────────────────────────────────────────────────
  // Sidebar logout
  // ─────────────────────────────────────────────────────────────
  test('passes the logout handler to Sidebar', () => {
    render(
      <MemoryRouter>
        <AdminMainLayout />
      </MemoryRouter>
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /sidebar logout/i,
      })
    );

    expect(logoutMock).toHaveBeenCalledTimes(1);
  });

  // ─────────────────────────────────────────────────────────────
  // Mobile heading
  // ─────────────────────────────────────────────────────────────
  test('renders the Admin heading', () => {
    render(
      <MemoryRouter>
        <AdminMainLayout />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', { name: 'Admin' })
    ).toBeInTheDocument();
  });
});