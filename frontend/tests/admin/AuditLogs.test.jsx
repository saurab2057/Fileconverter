import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import AuditLogsView from '@/features/adminpages/logs/AuditLogs';
import apiClient from '@/lib/api';

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const renderAuditLogs = () => {
  const queryClient = createTestQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <AuditLogsView />
    </QueryClientProvider>
  );
};

describe('AuditLogsView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows loading state while audit logs are being fetched', () => {
    apiClient.get.mockReturnValue(new Promise(() => {}));

    renderAuditLogs();

    expect(
      screen.getByText('Loading audit logs...')
    ).toBeInTheDocument();
  });

  test('renders audit logs returned by the API', async () => {
    apiClient.get.mockResolvedValue({
      data: {
        logs: [
          {
            _id: 'audit-1',
            createdAt: '2026-01-01T10:00:00.000Z',
            source: 'admin',
            action: 'USER_BANNED',
            ipAddress: '192.168.1.1',
            userId: {
              email: 'admin@example.com',
              name: 'Admin User',
            },
            details: {
              previousStatus: 'active',
              newStatus: 'banned',
            },
          },
        ],
        pagination: {
          total: 1,
          totalPages: 1,
          hasPrev: false,
          hasNext: false,
        },
      },
    });

    renderAuditLogs();

    expect(
      await screen.findByText('admin@example.com')
    ).toBeInTheDocument();

    expect(
      screen.getByText('Admin User')
    ).toBeInTheDocument();

    expect(
      screen.getAllByText('USER BANNED')
    ).toHaveLength(2);

    expect(
      screen.getByText('ADMIN')
    ).toBeInTheDocument();

    expect(
      screen.getByText('active')
    ).toBeInTheDocument();

    expect(
      screen.getByText('banned')
    ).toBeInTheDocument();

    expect(
      screen.getByText('192.168.1.1')
    ).toBeInTheDocument();

    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/admin/audit-logs',
      {
        params: {
          page: 1,
          limit: 50,
        },
      }
    );
  });

  test('shows empty state when no audit logs are returned', async () => {
    apiClient.get.mockResolvedValue({
      data: {
        logs: [],
        pagination: {},
      },
    });

    renderAuditLogs();

    expect(
      await screen.findByText('No audit logs found.')
    ).toBeInTheDocument();
  });

  test('shows error state when the API request fails', async () => {
    apiClient.get.mockRejectedValue(
      new Error('Network error')
    );

    renderAuditLogs();

    expect(
      await screen.findByText('Failed to load audit logs.')
    ).toBeInTheDocument();
  });

  test('filters audit logs by IP address', async () => {
    const user = userEvent.setup();

    apiClient.get.mockResolvedValue({
      data: {
        logs: [],
        pagination: {},
      },
    });

    renderAuditLogs();

    const input = screen.getByPlaceholderText(
      'Filter by IP address...'
    );

    await user.type(input, '10.0.0.1');

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenLastCalledWith(
        '/api/admin/audit-logs',
        {
          params: {
            page: 1,
            limit: 50,
            ipAddress: '10.0.0.1',
          },
        }
      );
    });
  });

  test('filters audit logs by action', async () => {
    const user = userEvent.setup();

    apiClient.get.mockResolvedValue({
      data: {
        logs: [],
        pagination: {},
      },
    });

    renderAuditLogs();

    const select = screen.getByDisplayValue(
      'All Actions'
    );

    await user.selectOptions(
      select,
      'USER_DELETED'
    );

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenLastCalledWith(
        '/api/admin/audit-logs',
        {
          params: {
            page: 1,
            limit: 50,
            action: 'USER_DELETED',
          },
        }
      );
    });
  });

  test('renders WAF attack details for WAF_BLOCKED logs', async () => {
    apiClient.get.mockResolvedValue({
      data: {
        logs: [
          {
            _id: 'waf-1',
            createdAt: '2026-01-01T10:00:00.000Z',
            source: 'system',
            action: 'WAF_BLOCKED',
            ipAddress: '1.2.3.4',
            userId: null,
            details: {
              attackType: 'SQL_INJECTION',
            },
          },
        ],
        pagination: {},
      },
    });

    renderAuditLogs();

    expect(
      await screen.findByText('SQL INJECTION')
    ).toBeInTheDocument();

    // WAF BLOCKED appears once in the filter <option>
    // and once in the rendered audit-log badge.
    expect(
      screen.getAllByText('WAF BLOCKED')
    ).toHaveLength(2);
  });
});