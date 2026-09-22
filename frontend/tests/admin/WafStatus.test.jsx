import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import WafStatusView from '@/features/adminpages/logs/WafStatus';
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

const renderWafStatus = () => {
    const queryClient = createTestQueryClient();

    return render(
        <QueryClientProvider client={queryClient}>
            <WafStatusView />
        </QueryClientProvider>
    );
};

describe('WafStatusView', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('shows loading state while WAF logs are being fetched', () => {
        apiClient.get.mockReturnValue(new Promise(() => { }));

        renderWafStatus();

        expect(
            screen.getByText('Loading WAF blocks...')
        ).toBeInTheDocument();
    });

    test('renders WAF blocks returned by the API', async () => {
        apiClient.get.mockResolvedValue({
            data: {
                logs: [
                    {
                        _id: 'waf-1',
                        createdAt: '2026-01-01T10:00:00.000Z',
                        source: 'system',
                        details: {
                            attackType: 'SQL_INJECTION',
                        },
                        resource: '/api/users',
                        ipAddress: '192.168.1.100',
                    },
                    {
                        _id: 'waf-2',
                        createdAt: '2026-01-01T11:00:00.000Z',
                        source: 'user',
                        details: {
                            attackType: 'XSS_ATTEMPT',
                        },
                        resource: '/api/comments',
                        ipAddress: '10.0.0.50',
                    },
                ],
                pagination: {
                    total: 2,
                    totalPages: 1,
                    hasPrev: false,
                    hasNext: false,
                },
            },
        });

        renderWafStatus();

        expect(
            await screen.findByText('SQL INJECTION')
        ).toBeInTheDocument();

        expect(
            screen.getByText('XSS ATTEMPT')
        ).toBeInTheDocument();

        expect(screen.getByText('/api/users')).toBeInTheDocument();
        expect(screen.getByText('/api/comments')).toBeInTheDocument();

        expect(screen.getByText('192.168.1.100')).toBeInTheDocument();
        expect(screen.getByText('10.0.0.50')).toBeInTheDocument();

        expect(
            screen.getByText('2 requests blocked since inception')
        ).toBeInTheDocument();

        expect(apiClient.get).toHaveBeenCalledWith(
            '/api/admin/audit-logs',
            {
                params: {
                    page: 1,
                    limit: 50,
                    action: 'WAF_BLOCKED',
                },
            }
        );
    });
    
    test('shows empty state when no WAF blocks are returned', async () => {
        apiClient.get.mockResolvedValue({
            data: {
                logs: [],
                pagination: {
                    total: 0,
                    totalPages: 1,
                    hasPrev: false,
                    hasNext: false,
                },
            },
        });

        renderWafStatus();

        expect(
            await screen.findByText(
                'No WAF blocks recorded yet. System is monitoring all routes.'
            )
        ).toBeInTheDocument();

        expect(
            await screen.findByText('No WAF blocks found.')
        ).toBeInTheDocument();
    });


    test('shows error state when the API request fails', async () => {
        apiClient.get.mockRejectedValue(
            new Error('Failed to load WAF data')
        );

        renderWafStatus();

        expect(
            await screen.findByText('Failed to load WAF data.')
        ).toBeInTheDocument();
    });

    test('filters displayed WAF logs by IP address', async () => {
        const user = userEvent.setup();

        apiClient.get.mockResolvedValue({
            data: {
                logs: [
                    {
                        _id: 'waf-1',
                        createdAt: '2026-01-01T10:00:00.000Z',
                        source: 'system',
                        details: {
                            attackType: 'SQL_INJECTION',
                        },
                        resource: '/api/users',
                        ipAddress: '192.168.1.100',
                    },
                    {
                        _id: 'waf-2',
                        createdAt: '2026-01-01T11:00:00.000Z',
                        source: 'system',
                        details: {
                            attackType: 'XSS_ATTEMPT',
                        },
                        resource: '/api/comments',
                        ipAddress: '10.0.0.50',
                    },
                ],
                pagination: {
                    total: 2,
                    totalPages: 1,
                    hasPrev: false,
                    hasNext: false,
                },
            },
        });

        renderWafStatus();

        await screen.findByText('SQL INJECTION');

        const filterInput = screen.getByPlaceholderText(
            'Filter blocked logs by IP...'
        );

        await user.type(filterInput, '192.168.1.100');

        expect(
            screen.getByText('192.168.1.100')
        ).toBeInTheDocument();

        expect(
            screen.queryByText('10.0.0.50')
        ).not.toBeInTheDocument();

        expect(
            screen.getByText('SQL INJECTION')
        ).toBeInTheDocument();

        expect(
            screen.queryByText('XSS ATTEMPT')
        ).not.toBeInTheDocument();
    });

    test('shows no matching results when the IP filter matches nothing', async () => {
        const user = userEvent.setup();

        apiClient.get.mockResolvedValue({
            data: {
                logs: [
                    {
                        _id: 'waf-1',
                        createdAt: '2026-01-01T10:00:00.000Z',
                        source: 'system',
                        details: {
                            attackType: 'SQL_INJECTION',
                        },
                        resource: '/api/users',
                        ipAddress: '192.168.1.100',
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

        renderWafStatus();

        await screen.findByText('SQL INJECTION');

        const filterInput = screen.getByPlaceholderText(
            'Filter blocked logs by IP...'
        );

        await user.type(filterInput, '8.8.8.8');

        expect(
            screen.getByText('No WAF blocks found.')
        ).toBeInTheDocument();

        expect(
            screen.queryByText('192.168.1.100')
        ).not.toBeInTheDocument();
    });

    test('refresh button triggers a refetch', async () => {
        const user = userEvent.setup();

        apiClient.get.mockResolvedValue({
            data: {
                logs: [],
                pagination: {
                    total: 0,
                    totalPages: 1,
                    hasPrev: false,
                    hasNext: false,
                },
            },
        });

        renderWafStatus();

        await screen.findByText('No WAF blocks found.');

        expect(apiClient.get).toHaveBeenCalledTimes(1);

        await user.click(
            screen.getByRole('button', { name: /Refresh/ })
        );

        expect(apiClient.get).toHaveBeenCalledTimes(2);

        expect(apiClient.get).toHaveBeenLastCalledWith(
            '/api/admin/audit-logs',
            {
                params: {
                    page: 1,
                    limit: 50,
                    action: 'WAF_BLOCKED',
                },
            }
        );
    });
});