import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import AdminRoutes from '@/routes/AdminRoutes';

// ─────────────────────────────────────────────────────────────
// Mock the admin layout.
//
// AdminMainLayout is tested separately. Here we only need its
// Outlet so the selected child route can render.
// ─────────────────────────────────────────────────────────────
jest.mock('@/features/adminpages/AdminMainLayout', () => {
  const { Outlet } = require('react-router-dom');

  return {
    __esModule: true,
    default: () => (
      <div data-testid="admin-layout">
        <Outlet />
      </div>
    ),
  };
});

// ─────────────────────────────────────────────────────────────
// Mock each lazy-loaded admin page.
//
// The purpose of this test is to verify that each AdminRoutes
// path loads the correct page component.
// ─────────────────────────────────────────────────────────────
jest.mock('@/features/adminpages/AdminDashboard', () => ({
  __esModule: true,
  default: () => (
    <div data-testid="admin-dashboard">
      Dashboard
    </div>
  ),
}));

jest.mock('@/features/adminpages/JobMonitor', () => ({
  __esModule: true,
  default: () => (
    <div data-testid="admin-jobs">
      Jobs
    </div>
  ),
}));

jest.mock('@/features/adminpages/UserManagement', () => ({
  __esModule: true,
  default: () => (
    <div data-testid="admin-users">
      Users
    </div>
  ),
}));

jest.mock('@/features/adminpages/logs', () => ({
  __esModule: true,
  default: () => (
    <div data-testid="admin-audit-logs">
      Audit Logs
    </div>
  ),
}));

jest.mock('@/features/adminpages/SystemConfig', () => ({
  __esModule: true,
  default: () => (
    <div data-testid="admin-config">
      Config
    </div>
  ),
}));

// ─────────────────────────────────────────────────────────────
// Render the route component.
//
// Only non-redirect routes are used here. This intentionally
// avoids the Navigate elements while we verify the actual
// admin route mappings.
// ─────────────────────────────────────────────────────────────
const renderAdminRoute = (path) => {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AdminRoutes />
    </MemoryRouter>
  );
};

describe('AdminRoutes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders AdminDashboard for /dashboard', async () => {
    renderAdminRoute('/dashboard');

    expect(
      await screen.findByTestId('admin-dashboard')
    ).toBeInTheDocument();
  });

  test('renders JobMonitor for /jobs', async () => {
    renderAdminRoute('/jobs');

    expect(
      await screen.findByTestId('admin-jobs')
    ).toBeInTheDocument();
  });

  test('renders UserManagement for /users', async () => {
    renderAdminRoute('/users');

    expect(
      await screen.findByTestId('admin-users')
    ).toBeInTheDocument();
  });

  test('renders LogsManager for /audit-logs', async () => {
    renderAdminRoute('/audit-logs');

    expect(
      await screen.findByTestId('admin-audit-logs')
    ).toBeInTheDocument();
  });

  test('renders SystemConfig for /config', async () => {
    renderAdminRoute('/config');

    expect(
      await screen.findByTestId('admin-config')
    ).toBeInTheDocument();
  });

  test('renders the AdminMainLayout around an admin page', async () => {
    renderAdminRoute('/dashboard');

    expect(
      await screen.findByTestId('admin-layout')
    ).toBeInTheDocument();

    expect(
      await screen.findByTestId('admin-dashboard')
    ).toBeInTheDocument();
  });
});