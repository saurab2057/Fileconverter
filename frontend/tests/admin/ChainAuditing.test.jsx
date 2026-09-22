import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import ChainAuditingView from '@/features/adminpages/logs/ChainAuditing';
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

const renderChainAuditing = () => {
  const queryClient = createTestQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <ChainAuditingView />
    </QueryClientProvider>
  );
};

describe('ChainAuditingView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows chain integrity status while loading', () => {
    apiClient.get.mockReturnValue(new Promise(() => {}));

    renderChainAuditing();

    expect(
      screen.getByText(/Hash-chain integrity:/)
    ).toBeInTheDocument();
  });

  test('shows Intact when the chain is valid', async () => {
    apiClient.get.mockResolvedValue({
      data: {
        status: 'valid',
        logCount: 250,
        latestLogId: 'log-250',
        checkedAt: '2026-01-01T10:00:00.000Z',
      },
    });

    renderChainAuditing();

    expect(
      await screen.findByText('Intact')
    ).toBeInTheDocument();

    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/admin/audit-logs/chain-status'
    );
  });

  test('shows BROKEN when chain integrity is broken', async () => {
    apiClient.get.mockResolvedValue({
      data: {
        status: 'broken',
        logCount: 100,
        latestLogId: 'log-100',
        message: 'Hash mismatch detected.',
      },
    });

    renderChainAuditing();

    expect(
      await screen.findByText('BROKEN')
    ).toBeInTheDocument();
  });

  test('shows No logs when the chain is empty', async () => {
    apiClient.get.mockResolvedValue({
      data: {
        status: 'empty',
        logCount: 0,
      },
    });

    renderChainAuditing();

    expect(
      await screen.findByText('No logs')
    ).toBeInTheDocument();
  });

  test('expands the panel and displays chain details', async () => {
    const user = userEvent.setup();

    apiClient.get.mockResolvedValue({
      data: {
        status: 'valid',
        logCount: 250,
        latestLogId: 'log-250',
        checkedAt: '2026-01-01T10:00:00.000Z',
      },
    });

    renderChainAuditing();

    await screen.findByText('Intact');

    await user.click(
      screen.getByRole('button', {
        name: /Hash-chain integrity:/,
      })
    );

    expect(
      screen.getByText('Latest log ID')
    ).toBeInTheDocument();

    expect(
      screen.getByText('log-250')
    ).toBeInTheDocument();

    expect(
      screen.getByText('Logs verified')
    ).toBeInTheDocument();

    expect(
      screen.getByText('250')
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', {
        name: /Run full verification/,
      })
    ).toBeInTheDocument();
  });

  test('runs full chain verification successfully', async () => {
    const user = userEvent.setup();

    apiClient.get
      .mockResolvedValueOnce({
        data: {
          status: 'valid',
          logCount: 250,
        },
      })
      .mockResolvedValueOnce({
        data: {
          valid: true,
          message: 'Chain is valid.',
          logCount: 250,
          verifiedAt: '2026-01-01T10:00:00.000Z',
        },
      });

    renderChainAuditing();

    await screen.findByText('Intact');

    await user.click(
      screen.getByRole('button', {
        name: /Hash-chain integrity:/,
      })
    );

    await user.click(
      screen.getByRole('button', {
        name: /Run full verification/,
      })
    );

    expect(
      await screen.findByText(
        'Chain verified — no tampering detected'
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText('Chain is valid.')
    ).toBeInTheDocument();

    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/admin/audit-logs/verify-chain',
      {
        params: {
          limit: 1000,
        },
      }
    );
  });

  test('shows verification failure when verification request fails', async () => {
    const user = userEvent.setup();

    apiClient.get
      .mockResolvedValueOnce({
        data: {
          status: 'valid',
          logCount: 100,
        },
      })
      .mockRejectedValueOnce(
        new Error('Verification failed')
      );

    renderChainAuditing();

    await screen.findByText('Intact');

    await user.click(
      screen.getByRole('button', {
        name: /Hash-chain integrity:/,
      })
    );

    await user.click(
      screen.getByRole('button', {
        name: /Run full verification/,
      })
    );

    expect(
      await screen.findByText('Chain integrity failure')
    ).toBeInTheDocument();

    expect(
      screen.getByText('Verification request failed.')
    ).toBeInTheDocument();
  });

  test('collapses the expanded panel', async () => {
    const user = userEvent.setup();

    apiClient.get.mockResolvedValue({
      data: {
        status: 'valid',
        logCount: 50,
        latestLogId: 'log-50',
      },
    });

    renderChainAuditing();

    await screen.findByText('Intact');

    const toggleButton = screen.getByRole('button', {
      name: /Hash-chain integrity:/,
    });

    await user.click(toggleButton);

    expect(
      screen.getByText('Latest log ID')
    ).toBeInTheDocument();

    await user.click(toggleButton);

    expect(
      screen.queryByText('Latest log ID')
    ).not.toBeInTheDocument();
  });
});
