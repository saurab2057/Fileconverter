import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import ActivityLogsView from '@/features/adminpages/logs/ActivityLogs';
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

const renderActivityLogs = () => {
  const queryClient = createTestQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <ActivityLogsView />
    </QueryClientProvider>
  );
};

describe('ActivityLogsView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows loading state while logs are being fetched', () => {
    apiClient.get.mockReturnValue(new Promise(() => {}));

    renderActivityLogs();

    expect(
      screen.getByText('Loading activity logs...')
    ).toBeInTheDocument();
  });

  test('renders activity logs returned by the API', async () => {
    apiClient.get.mockResolvedValue({
      data: {
        logs: [
          {
            _id: 'activity-1',
            createdAt: '2026-01-01T10:00:00.000Z',
            action: 'USER_LOGIN',
            ipAddress: '127.0.0.1',
            userId: {
              email: 'user@example.com',
              name: 'Test User',
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

    renderActivityLogs();

    expect(
      await screen.findByText('user@example.com')
    ).toBeInTheDocument();

    expect(
      screen.getByText('Test User')
    ).toBeInTheDocument();

    // USER LOGIN appears once in the filter <option>
    // and once in the rendered activity-log badge.
    expect(
      screen.getAllByText('USER LOGIN')
    ).toHaveLength(2);

    expect(
      screen.getByText('127.0.0.1')
    ).toBeInTheDocument();

    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/admin/activity-logs',
      {
        params: {
          page: 1,
          limit: 50,
        },
      }
    );
  });

  test('shows empty state when no logs are returned', async () => {
    apiClient.get.mockResolvedValue({
      data: {
        logs: [],
        pagination: {},
      },
    });

    renderActivityLogs();

    expect(
      await screen.findByText('No activity logs found.')
    ).toBeInTheDocument();
  });

  test('shows error state when the API request fails', async () => {
    apiClient.get.mockRejectedValue(
      new Error('Network error')
    );

    renderActivityLogs();

    expect(
      await screen.findByText('Failed to load activity logs.')
    ).toBeInTheDocument();
  });

  test('filters logs by user ID', async () => {
    const user = userEvent.setup();

    apiClient.get.mockResolvedValue({
      data: {
        logs: [],
        pagination: {},
      },
    });

    renderActivityLogs();

    const input = screen.getByPlaceholderText(
      'Filter by user ID...'
    );

    await user.type(input, 'user-123');

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenLastCalledWith(
        '/api/admin/activity-logs',
        {
          params: {
            page: 1,
            limit: 50,
            userId: 'user-123',
          },
        }
      );
    });
  });

  test('filters logs by action', async () => {
    const user = userEvent.setup();

    apiClient.get.mockResolvedValue({
      data: {
        logs: [],
        pagination: {},
      },
    });

    renderActivityLogs();

    const select = screen.getByDisplayValue('All Actions');

    await user.selectOptions(
      select,
      'USER_LOGIN'
    );

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenLastCalledWith(
        '/api/admin/activity-logs',
        {
          params: {
            page: 1,
            limit: 50,
            action: 'USER_LOGIN',
          },
        }
      );
    });
  });
});