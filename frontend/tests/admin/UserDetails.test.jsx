// frontend/tests/admin/UserDetails.test.jsx

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import UserDetails from '@/features/adminpages/UserManagement/UserDetails';
import apiClient from '@/lib/api';

jest.mock('@/lib/api', () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
    },
}));

const mockUser = {
    _id: 'user-123',
    name: 'Saurab Khatiwoda',
    email: 'saurab@example.com',
    role: 'user',
    status: 'active',
    authProvider: 'google',
    createdAt: '2026-01-15T10:30:00.000Z',
    updatedAt: '2026-02-20T12:00:00.000Z',
    profilePictureUrl: '',
};

const mockMetadata = {
    ipHash: 'abc123hash',
    timezone: 'Asia/Kathmandu',
    userAgent: 'Mozilla/5.0 Test Browser',
    device: {
        type: 'desktop',
        browser: 'Chrome',
        os: 'Windows',
    },
    location: {
        country: 'Nepal',
        region: 'Bagmati',
        city: 'Kathmandu',
    },
    network: {
        isp: 'WorldLink',
        organization: 'WorldLink Communications',
        asn: 'AS17501',
        connectionType: 'fiber',
        isProxy: false,
        isVpn: false,
        isTor: false,
        isHosting: false,
    },
};

const renderUserDetails = (
    id = 'user-123',
    initialEntry = `/admin/users/details/${id}`
) => {
    return render(
        <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
                <Route
                    path="/admin/users/details/:id"
                    element={<UserDetails />}
                />

                <Route
                    path="/admin/users"
                    element={<div data-testid="users-page">Users Page</div>}
                />

                <Route
                    path="*"
                    element={<div data-testid="fallback-page">Fallback</div>}
                />
            </Routes>
        </MemoryRouter>
    );
};

describe('UserDetails', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('shows loading skeleton while fetching user details', () => {
        apiClient.get.mockReturnValue(new Promise(() => {}));

        const { container } = renderUserDetails();

        // The component renders only skeleton elements while loading.
        expect(
            container.querySelectorAll('.animate-pulse').length
        ).toBeGreaterThan(0);

        // Actual user data must not be rendered yet.
        expect(
            screen.queryByRole('heading', {
                level: 2,
                name: 'Saurab Khatiwoda',
            })
        ).not.toBeInTheDocument();
    });

    test('fetches user details using the route id', async () => {
        apiClient.get.mockResolvedValue({
            data: {
                user: mockUser,
                metadata: mockMetadata,
            },
        });

        renderUserDetails('user-456');

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledWith(
                '/api/admin/users/details/user-456'
            );
        });
    });

    test('renders user details after successful API response', async () => {
        apiClient.get.mockResolvedValue({
            data: {
                user: mockUser,
                metadata: mockMetadata,
            },
        });

        renderUserDetails();

        expect(
            await screen.findByRole('heading', {
                level: 2,
                name: 'Saurab Khatiwoda',
            })
        ).toBeInTheDocument();

        // Email intentionally appears in both the header and Account card.
        expect(
            screen.getAllByText('saurab@example.com')
        ).toHaveLength(2);

        expect(screen.getByText('User')).toBeInTheDocument();
        expect(screen.getByText('Active')).toBeInTheDocument();
        expect(screen.getByText('google')).toBeInTheDocument();
    });

    test('renders account information', async () => {
        apiClient.get.mockResolvedValue({
            data: {
                user: mockUser,
                metadata: mockMetadata,
            },
        });

        renderUserDetails();

        await screen.findByRole('heading', {
            level: 2,
            name: 'Saurab Khatiwoda',
        });

        expect(screen.getByText('Account')).toBeInTheDocument();
        expect(screen.getByText('Name:')).toBeInTheDocument();
        expect(screen.getByText('Email:')).toBeInTheDocument();
        expect(screen.getByText('Role:')).toBeInTheDocument();
        expect(screen.getByText('Status:')).toBeInTheDocument();
    });

    test('renders location information from metadata', async () => {
        apiClient.get.mockResolvedValue({
            data: {
                user: mockUser,
                metadata: mockMetadata,
            },
        });

        renderUserDetails();

        await screen.findByRole('heading', {
            level: 2,
            name: 'Saurab Khatiwoda',
        });

        expect(screen.getByText('Location')).toBeInTheDocument();

        // Nepal appears in Location and Network sections.
        expect(screen.getAllByText('Nepal')).toHaveLength(2);

        expect(screen.getByText('Bagmati')).toBeInTheDocument();

        // Kathmandu also appears in metadata-derived content only once.
        expect(screen.getAllByText('Kathmandu').length).toBeGreaterThanOrEqual(1);
    });

    test('renders device information from metadata', async () => {
        apiClient.get.mockResolvedValue({
            data: {
                user: mockUser,
                metadata: mockMetadata,
            },
        });

        renderUserDetails();

        await screen.findByRole('heading', {
            level: 2,
            name: 'Saurab Khatiwoda',
        });

        expect(screen.getByText('Device')).toBeInTheDocument();
        expect(screen.getByText('desktop')).toBeInTheDocument();
        expect(screen.getByText('Chrome')).toBeInTheDocument();
        expect(screen.getByText('Windows')).toBeInTheDocument();
    });

    test('renders network information from metadata', async () => {
        apiClient.get.mockResolvedValue({
            data: {
                user: mockUser,
                metadata: mockMetadata,
            },
        });

        renderUserDetails();

        await screen.findByRole('heading', {
            level: 2,
            name: 'Saurab Khatiwoda',
        });

        expect(screen.getByText('Network')).toBeInTheDocument();
        expect(screen.getByText('abc123hash')).toBeInTheDocument();
        expect(screen.getByText('WorldLink')).toBeInTheDocument();
        expect(
            screen.getByText('WorldLink Communications')
        ).toBeInTheDocument();
        expect(screen.getByText('AS17501')).toBeInTheDocument();
        expect(screen.getByText('fiber')).toBeInTheDocument();
    });

    test('renders network security flags correctly', async () => {
        apiClient.get.mockResolvedValue({
            data: {
                user: mockUser,
                metadata: mockMetadata,
            },
        });

        renderUserDetails();

        await screen.findByRole('heading', {
            level: 2,
            name: 'Saurab Khatiwoda',
        });

        const noValues = screen.getAllByText('No');

        expect(noValues.length).toBeGreaterThanOrEqual(4);
    });

    test('renders user agent', async () => {
        apiClient.get.mockResolvedValue({
            data: {
                user: mockUser,
                metadata: mockMetadata,
            },
        });

        renderUserDetails();

        await screen.findByRole('heading', {
            level: 2,
            name: 'Saurab Khatiwoda',
        });

        expect(screen.getByText('User Agent')).toBeInTheDocument();
        expect(
            screen.getByText('Mozilla/5.0 Test Browser')
        ).toBeInTheDocument();
    });

    test('renders Standard user account footer for normal users', async () => {
        apiClient.get.mockResolvedValue({
            data: {
                user: mockUser,
                metadata: mockMetadata,
            },
        });

        renderUserDetails();

        await screen.findByRole('heading', {
            level: 2,
            name: 'Saurab Khatiwoda',
        });

        expect(
            screen.getByText('Standard user account')
        ).toBeInTheDocument();
    });

    test('renders Administrator account footer for admin users', async () => {
        apiClient.get.mockResolvedValue({
            data: {
                user: {
                    ...mockUser,
                    role: 'admin',
                },
                metadata: mockMetadata,
            },
        });

        renderUserDetails();

        await screen.findByRole('heading', {
            level: 2,
            name: 'Saurab Khatiwoda',
        });

        expect(
            screen.getByText('Administrator account')
        ).toBeInTheDocument();
    });

    test('renders banned account notice for banned users', async () => {
        apiClient.get.mockResolvedValue({
            data: {
                user: {
                    ...mockUser,
                    status: 'banned',
                    bannedAt: '2026-03-01T10:00:00.000Z',
                },
                metadata: mockMetadata,
            },
        });

        renderUserDetails();

        await screen.findByRole('heading', {
            level: 2,
            name: 'Saurab Khatiwoda',
        });

        expect(
            screen.getByText('Account is banned')
        ).toBeInTheDocument();

        expect(
            screen.getByText(/Banned on/i)
        ).toBeInTheDocument();

        expect(screen.getByText('Banned')).toBeInTheDocument();
    });

    test('renders profile picture when profilePictureUrl exists', async () => {
        apiClient.get.mockResolvedValue({
            data: {
                user: {
                    ...mockUser,
                    profilePictureUrl: 'https://example.com/profile.jpg',
                },
                metadata: mockMetadata,
            },
        });

        renderUserDetails();

        await screen.findByRole('heading', {
            level: 2,
            name: 'Saurab Khatiwoda',
        });

        const image = screen.getByRole('img', {
            name: 'Saurab Khatiwoda',
        });

        expect(image).toHaveAttribute(
            'src',
            'https://example.com/profile.jpg'
        );

        expect(image).toHaveAttribute(
            'alt',
            'Saurab Khatiwoda'
        );
    });

    test('renders fallback user icon when profile picture is missing', async () => {
        apiClient.get.mockResolvedValue({
            data: {
                user: {
                    ...mockUser,
                    profilePictureUrl: '',
                },
                metadata: mockMetadata,
            },
        });

        renderUserDetails();

        await screen.findByRole('heading', {
            level: 2,
            name: 'Saurab Khatiwoda',
        });

        expect(
            screen.queryByRole('img', {
                name: 'Saurab Khatiwoda',
            })
        ).not.toBeInTheDocument();
    });

    test('renders em dash for missing metadata values', async () => {
        apiClient.get.mockResolvedValue({
            data: {
                user: {
                    ...mockUser,
                    name: '',
                },
                metadata: {
                    device: {},
                    location: {},
                    network: {},
                },
            },
        });

        renderUserDetails();

        await waitFor(() => {
            expect(screen.getByText('User Details')).toBeInTheDocument();
        });

        expect(
            screen.getAllByText('—').length
        ).toBeGreaterThan(0);
    });

    test('handles invalid dates by displaying em dash', async () => {
        apiClient.get.mockResolvedValue({
            data: {
                user: {
                    ...mockUser,
                    createdAt: 'not-a-valid-date',
                    updatedAt: 'also-invalid',
                },
                metadata: mockMetadata,
            },
        });

        renderUserDetails();

        await screen.findByRole('heading', {
            level: 2,
            name: 'Saurab Khatiwoda',
        });

        expect(
            screen.getAllByText('—').length
        ).toBeGreaterThanOrEqual(2);
    });

    test('handles API error using server error message', async () => {
        apiClient.get.mockRejectedValue({
            response: {
                data: {
                    message: 'User does not exist.',
                },
            },
        });

        renderUserDetails();

        expect(
            await screen.findByText('User does not exist.')
        ).toBeInTheDocument();

        expect(
            screen.getByText('Something went wrong')
        ).toBeInTheDocument();
    });

    test('uses fallback error message when API provides no message', async () => {
        apiClient.get.mockRejectedValue(new Error('Network error'));

        renderUserDetails();

        expect(
            await screen.findByText('Failed to load user details.')
        ).toBeInTheDocument();

        expect(
            screen.getByText('Something went wrong')
        ).toBeInTheDocument();
    });

    test('renders User not found when API returns no user', async () => {
        apiClient.get.mockResolvedValue({
            data: {
                user: null,
                metadata: null,
            },
        });

        renderUserDetails();

        expect(
            await screen.findByText('User not found.')
        ).toBeInTheDocument();
    });

    test('does not fetch when route id is missing', () => {
        render(
            <MemoryRouter initialEntries={['/admin/users/details']}>
                <Routes>
                    <Route
                        path="/admin/users/details"
                        element={<UserDetails />}
                    />
                </Routes>
            </MemoryRouter>
        );

        expect(apiClient.get).not.toHaveBeenCalled();
    });

    test('navigates back when Back to users button is clicked', async () => {
        apiClient.get.mockResolvedValue({
            data: {
                user: mockUser,
                metadata: mockMetadata,
            },
        });

        render(
            <MemoryRouter
                initialEntries={[
                    '/admin/users',
                    '/admin/users/details/user-123',
                ]}
                initialIndex={1}
            >
                <Routes>
                    <Route
                        path="/admin/users"
                        element={
                            <div data-testid="users-page">
                                Users Page
                            </div>
                        }
                    />

                    <Route
                        path="/admin/users/details/:id"
                        element={<UserDetails />}
                    />
                </Routes>
            </MemoryRouter>
        );

        await screen.findByRole('heading', {
            level: 2,
            name: 'Saurab Khatiwoda',
        });

        fireEvent.click(
            screen.getByTitle('Back to users')
        );

        await waitFor(() => {
            expect(
                screen.getByTestId('users-page')
            ).toBeInTheDocument();
        });
    });

    test('uses mobile device icon logic for mobile devices', async () => {
        apiClient.get.mockResolvedValue({
            data: {
                user: mockUser,
                metadata: {
                    ...mockMetadata,
                    device: {
                        type: 'mobile phone',
                        browser: 'Chrome',
                        os: 'Android',
                    },
                },
            },
        });

        renderUserDetails();

        await screen.findByRole('heading', {
            level: 2,
            name: 'Saurab Khatiwoda',
        });

        expect(
            screen.getByText('mobile phone')
        ).toBeInTheDocument();

        expect(
            screen.getByText('Android')
        ).toBeInTheDocument();
    });

    test('uses tablet device icon logic for tablet devices', async () => {
        apiClient.get.mockResolvedValue({
            data: {
                user: mockUser,
                metadata: {
                    ...mockMetadata,
                    device: {
                        type: 'tablet',
                        browser: 'Chrome',
                        os: 'Android',
                    },
                },
            },
        });

        renderUserDetails();

        await screen.findByRole('heading', {
            level: 2,
            name: 'Saurab Khatiwoda',
        });

        expect(
            screen.getByText('tablet')
        ).toBeInTheDocument();
    });

    test('handles missing metadata object safely', async () => {
        apiClient.get.mockResolvedValue({
            data: {
                user: mockUser,
                metadata: null,
            },
        });

        renderUserDetails();

        await screen.findByRole('heading', {
            level: 2,
            name: 'Saurab Khatiwoda',
        });

        expect(
            screen.getByText('User Details')
        ).toBeInTheDocument();

        expect(
            screen.getByText('Account')
        ).toBeInTheDocument();

        expect(
            screen.getByText('Network')
        ).toBeInTheDocument();
    });
});