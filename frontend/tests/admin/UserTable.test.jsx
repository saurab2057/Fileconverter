
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
    MemoryRouter,
    Routes,
    Route,
    useLocation,
} from 'react-router-dom';

import UserTable from '@/features/adminpages/UserManagement/UserTable';

// ─────────────────────────────────────────────────────────────
// Mock UserActions.
//
// UserActions is tested separately. This test only verifies that
// UserTable renders it for each user.
// ─────────────────────────────────────────────────────────────
jest.mock(
    '@/features/adminpages/UserManagement/UserActions',
    () => ({
        __esModule: true,
        default: ({ user }) => (
            <div data-testid={`user-actions-${user._id}`}>
                User Actions
            </div>
        ),
    })
);

// ─────────────────────────────────────────────────────────────
// Mock lucide-react icons.
//
// The actual icon rendering is not relevant to UserTable tests.
// ─────────────────────────────────────────────────────────────
jest.mock('lucide-react', () => ({
    Crown: () => <span data-testid="crown-icon" />,
    Users: () => <span data-testid="users-icon" />,
    CheckCircle: () => <span data-testid="check-circle-icon" />,
    Ban: () => <span data-testid="ban-icon" />,
}));

const createUser = (overrides = {}) => ({
    _id: 'user-1',
    name: 'Saurab Khatiwoda',
    email: 'saurab@example.com',
    role: 'user',
    status: 'active',
    createdAt: '2026-01-15T00:00:00.000Z',
    ...overrides,
});

const defaultProps = {
    users: [createUser()],
    pagination: {
        total: 1,
        totalPages: 1,
        hasPrev: false,
        hasNext: false,
    },
    currentPage: 1,
    itemsPerPage: 10,
    isUpdating: false,
    isDeleting: false,
    onMutate: jest.fn(),
    onDeleteClick: jest.fn(),
    onPageChange: jest.fn(),
};

const renderUserTable = (props = {}) => {
    return render(
        <MemoryRouter>
            <UserTable
                {...defaultProps}
                {...props}
            />
        </MemoryRouter>
    );
};

describe('UserTable', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Table rendering', () => {
        test('renders the table headers', () => {
            renderUserTable();

            // Scope the assertions to the table header so the
            // "User" role badge does not cause a duplicate match.
            const headers = screen.getAllByRole('columnheader');

            expect(headers).toHaveLength(5);

            expect(headers[0]).toHaveTextContent('User');
            expect(headers[1]).toHaveTextContent('Role');
            expect(headers[2]).toHaveTextContent('Status');
            expect(headers[3]).toHaveTextContent('Join Date');
            expect(headers[4]).toHaveTextContent('Actions');
        });

        test('renders user name and email', () => {
            renderUserTable();

            expect(
                screen.getByText('Saurab Khatiwoda')
            ).toBeInTheDocument();

            expect(
                screen.getByText('saurab@example.com')
            ).toBeInTheDocument();
        });

        test('renders UserActions for each user', () => {
            const users = [
                createUser({ _id: 'user-1' }),
                createUser({
                    _id: 'user-2',
                    name: 'Another User',
                    email: 'another@example.com',
                }),
            ];

            renderUserTable({ users });

            expect(
                screen.getByTestId('user-actions-user-1')
            ).toBeInTheDocument();

            expect(
                screen.getByTestId('user-actions-user-2')
            ).toBeInTheDocument();
        });

        test('renders the formatted join date', () => {
            renderUserTable();

            const expectedDate = new Date(
                '2026-01-15T00:00:00.000Z'
            ).toLocaleDateString();

            expect(
                screen.getByText(expectedDate)
            ).toBeInTheDocument();
        });
    });

    describe('Role badge', () => {
        test('renders User badge for a regular user', () => {
            renderUserTable({
                users: [
                    createUser({
                        role: 'user',
                    }),
                ],
            });

            // There are two "User" texts:
            // 1. The table header
            // 2. The role badge
            // Verify the badge through its icon and parent element.
            const icon = screen.getByTestId('users-icon');
            const badge = icon.parentElement;

            expect(badge).toHaveTextContent('User');
            expect(icon).toBeInTheDocument();
        });

        test('renders Admin badge for an admin', () => {
            renderUserTable({
                users: [
                    createUser({
                        role: 'admin',
                    }),
                ],
            });

            expect(
                screen.getByText('Admin')
            ).toBeInTheDocument();

            expect(
                screen.getByTestId('crown-icon')
            ).toBeInTheDocument();
        });

        test('falls back to User badge for an unknown role', () => {
            renderUserTable({
                users: [
                    createUser({
                        role: 'unknown-role',
                    }),
                ],
            });

            const icon = screen.getByTestId('users-icon');
            const badge = icon.parentElement;

            expect(badge).toHaveTextContent('User');
            expect(icon).toBeInTheDocument();
        });
    });

    describe('Status badge', () => {
        test('renders Active badge for an active user', () => {
            renderUserTable({
                users: [
                    createUser({
                        status: 'active',
                    }),
                ],
            });

            expect(
                screen.getByText('Active')
            ).toBeInTheDocument();

            expect(
                screen.getByTestId('check-circle-icon')
            ).toBeInTheDocument();
        });

        test('renders Banned badge for a banned user', () => {
            renderUserTable({
                users: [
                    createUser({
                        status: 'banned',
                    }),
                ],
            });

            expect(
                screen.getByText('Banned')
            ).toBeInTheDocument();

            expect(
                screen.getByTestId('ban-icon')
            ).toBeInTheDocument();
        });

        test('falls back to Active badge for an unknown status', () => {
            renderUserTable({
                users: [
                    createUser({
                        status: 'unknown-status',
                    }),
                ],
            });

            expect(
                screen.getByText('Active')
            ).toBeInTheDocument();

            expect(
                screen.getByTestId('check-circle-icon')
            ).toBeInTheDocument();
        });
    });

    describe('Banned user styling', () => {
        test('applies banned row styling to a banned user', () => {
            renderUserTable({
                users: [
                    createUser({
                        status: 'banned',
                    }),
                ],
            });

            const nameCell = screen.getByText(
                'Saurab Khatiwoda'
            );

            const row = nameCell.closest('tr');

            expect(row).toHaveClass('bg-red-50');
            expect(row).toHaveClass('border-red-200');
            expect(row).toHaveClass('hover:bg-red-100');
        });

        test('applies normal row styling to an active user', () => {
            renderUserTable({
                users: [
                    createUser({
                        status: 'active',
                    }),
                ],
            });

            const nameCell = screen.getByText(
                'Saurab Khatiwoda'
            );

            const row = nameCell.closest('tr');

            expect(row).toHaveClass('border-gray-100');
            expect(row).toHaveClass('hover:bg-gray-50');
            expect(row).not.toHaveClass('bg-red-50');
        });
    });

    describe('Empty state', () => {
        test('renders the empty state when there are no users', () => {
            renderUserTable({
                users: [],
            });

            expect(
                screen.getByText(
                    'No users found matching your criteria.'
                )
            ).toBeInTheDocument();
        });

        test('does not render UserActions when there are no users', () => {
            renderUserTable({
                users: [],
            });

            expect(
                screen.queryByText('User Actions')
            ).not.toBeInTheDocument();
        });
    });

    describe('Navigation', () => {
        test('navigates to the user details page when the user cell is clicked', () => {
            const LocationDisplay = () => {
                const location = useLocation();

                return (
                    <div data-testid="current-location">
                        {location.pathname}
                    </div>
                );
            };

            render(
                <MemoryRouter initialEntries={['/admin/users']}>
                    <Routes>
                        <Route
                            path="/admin/users"
                            element={
                                <>
                                    <UserTable {...defaultProps} />
                                    <LocationDisplay />
                                </>
                            }
                        />

                        <Route
                            path="/admin/users/details/:id"
                            element={
                                <LocationDisplay />
                            }
                        />
                    </Routes>
                </MemoryRouter>
            );

            fireEvent.click(
                screen.getByText('Saurab Khatiwoda')
            );

            expect(
                screen.getByTestId('current-location')
            ).toHaveTextContent(
                '/admin/users/details/user-1'
            );
        });
    });

    describe('Pagination', () => {
        test('does not render pagination when there is only one page', () => {
            renderUserTable({
                pagination: {
                    total: 5,
                    totalPages: 1,
                    hasPrev: false,
                    hasNext: false,
                },
            });

            expect(
                screen.queryByText('Previous')
            ).not.toBeInTheDocument();

            expect(
                screen.queryByText('Next')
            ).not.toBeInTheDocument();
        });

        test('renders pagination when there are multiple pages', () => {
            renderUserTable({
                pagination: {
                    total: 25,
                    totalPages: 3,
                    hasPrev: true,
                    hasNext: true,
                },
                currentPage: 2,
                itemsPerPage: 10,
            });

            expect(
                screen.getByText('Previous')
            ).toBeInTheDocument();

            expect(
                screen.getByText('Next')
            ).toBeInTheDocument();

            expect(
                screen.getByText('Page 2 of 3')
            ).toBeInTheDocument();

            expect(
                screen.getByText(
                    'Showing 11 to 20 of 25 users'
                )
            ).toBeInTheDocument();
        });

        test('disables Previous button when there is no previous page', () => {
            renderUserTable({
                pagination: {
                    total: 25,
                    totalPages: 3,
                    hasPrev: false,
                    hasNext: true,
                },
                currentPage: 1,
                itemsPerPage: 10,
            });

            expect(
                screen.getByText('Previous')
            ).toBeDisabled();
        });

        test('disables Next button when there is no next page', () => {
            renderUserTable({
                pagination: {
                    total: 25,
                    totalPages: 3,
                    hasPrev: true,
                    hasNext: false,
                },
                currentPage: 3,
                itemsPerPage: 10,
            });

            expect(
                screen.getByText('Next')
            ).toBeDisabled();
        });

        test('calls onPageChange when Next is clicked', () => {
            const onPageChange = jest.fn();

            renderUserTable({
                pagination: {
                    total: 25,
                    totalPages: 3,
                    hasPrev: true,
                    hasNext: true,
                },
                currentPage: 1,
                itemsPerPage: 10,
                onPageChange,
            });

            fireEvent.click(
                screen.getByText('Next')
            );

            expect(onPageChange).toHaveBeenCalledTimes(1);
            expect(onPageChange).toHaveBeenCalledWith(
                expect.any(Function)
            );
        });

        test('calls onPageChange when Previous is clicked', () => {
            const onPageChange = jest.fn();

            renderUserTable({
                pagination: {
                    total: 25,
                    totalPages: 3,
                    hasPrev: true,
                    hasNext: true,
                },
                currentPage: 2,
                itemsPerPage: 10,
                onPageChange,
            });

            fireEvent.click(
                screen.getByText('Previous')
            );

            expect(onPageChange).toHaveBeenCalledTimes(1);
            expect(onPageChange).toHaveBeenCalledWith(
                expect.any(Function)
            );
        });

        test('calculates the correct first item on the current page', () => {
            renderUserTable({
                pagination: {
                    total: 35,
                    totalPages: 4,
                    hasPrev: true,
                    hasNext: true,
                },
                currentPage: 3,
                itemsPerPage: 10,
            });

            expect(
                screen.getByText(
                    'Showing 21 to 30 of 35 users'
                )
            ).toBeInTheDocument();
        });

        test('calculates the correct last item on the final page', () => {
            renderUserTable({
                pagination: {
                    total: 35,
                    totalPages: 4,
                    hasPrev: true,
                    hasNext: false,
                },
                currentPage: 4,
                itemsPerPage: 10,
            });

            expect(
                screen.getByText(
                    'Showing 31 to 35 of 35 users'
                )
            ).toBeInTheDocument();
        });
    });
});