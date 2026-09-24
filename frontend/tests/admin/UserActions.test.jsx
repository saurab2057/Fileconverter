import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import UserActions from '@/features/adminpages/UserManagement/UserActions';

// ─────────────────────────────────────────────────────────────
// Mock the Trash icon.
//
// The actual icon rendering is not relevant to UserActions.
// ─────────────────────────────────────────────────────────────
jest.mock('lucide-react', () => ({
    Trash2: () => (
        <span data-testid="trash-icon" />
    ),
}));

const createUser = (overrides = {}) => ({
    _id: 'user-1',
    name: 'Saurab Khatiwoda',
    email: 'saurab@example.com',
    role: 'user',
    status: 'active',
    ...overrides,
});

const defaultProps = {
    user: createUser(),
    isUpdating: false,
    isDeleting: false,
    onMutate: jest.fn(),
    onDeleteClick: jest.fn(),
};

const renderUserActions = (props = {}) => {
    return render(
        <UserActions
            {...defaultProps}
            {...props}
        />
    );
};

describe('UserActions', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Active user', () => {
        test('renders Ban button for an active user', () => {
            renderUserActions({
                user: createUser({
                    status: 'active',
                }),
            });

            expect(
                screen.getByRole('button', {
                    name: 'Ban',
                })
            ).toBeInTheDocument();
        });

        test('renders Make Admin for a regular active user', () => {
            renderUserActions({
                user: createUser({
                    status: 'active',
                    role: 'user',
                }),
            });

            expect(
                screen.getByRole('button', {
                    name: 'Make Admin',
                })
            ).toBeInTheDocument();

            expect(
                screen.queryByRole('button', {
                    name: 'Remove Admin',
                })
            ).not.toBeInTheDocument();
        });

        test('calls onMutate with banned status when Ban is clicked', () => {
            const onMutate = jest.fn();

            renderUserActions({
                user: createUser({
                    _id: 'user-123',
                    status: 'active',
                }),
                onMutate,
            });

            fireEvent.click(
                screen.getByRole('button', {
                    name: 'Ban',
                })
            );

            expect(onMutate).toHaveBeenCalledTimes(1);
            expect(onMutate).toHaveBeenCalledWith({
                userId: 'user-123',
                status: 'banned',
            });
        });

        test('calls onMutate with admin role when Make Admin is clicked', () => {
            const onMutate = jest.fn();

            renderUserActions({
                user: createUser({
                    _id: 'user-123',
                    status: 'active',
                    role: 'user',
                }),
                onMutate,
            });

            fireEvent.click(
                screen.getByRole('button', {
                    name: 'Make Admin',
                })
            );

            expect(onMutate).toHaveBeenCalledTimes(1);
            expect(onMutate).toHaveBeenCalledWith({
                userId: 'user-123',
                role: 'admin',
            });
        });

        test('renders Remove Admin for an active admin user', () => {
            renderUserActions({
                user: createUser({
                    status: 'active',
                    role: 'admin',
                }),
            });

            expect(
                screen.getByRole('button', {
                    name: 'Remove Admin',
                })
            ).toBeInTheDocument();

            expect(
                screen.queryByRole('button', {
                    name: 'Make Admin',
                })
            ).not.toBeInTheDocument();
        });

        test('calls onMutate with user role when Remove Admin is clicked', () => {
            const onMutate = jest.fn();

            renderUserActions({
                user: createUser({
                    _id: 'admin-123',
                    status: 'active',
                    role: 'admin',
                }),
                onMutate,
            });

            fireEvent.click(
                screen.getByRole('button', {
                    name: 'Remove Admin',
                })
            );

            expect(onMutate).toHaveBeenCalledTimes(1);
            expect(onMutate).toHaveBeenCalledWith({
                userId: 'admin-123',
                role: 'user',
            });
        });
    });

    describe('Banned user', () => {
        test('renders Unban button for a banned user', () => {
            renderUserActions({
                user: createUser({
                    status: 'banned',
                }),
            });

            expect(
                screen.getByRole('button', {
                    name: 'Unban',
                })
            ).toBeInTheDocument();
        });

        test('does not render Ban for a banned user', () => {
            renderUserActions({
                user: createUser({
                    status: 'banned',
                }),
            });

            expect(
                screen.queryByRole('button', {
                    name: 'Ban',
                })
            ).not.toBeInTheDocument();
        });

        test('does not render Make Admin for a banned user', () => {
            renderUserActions({
                user: createUser({
                    status: 'banned',
                    role: 'user',
                }),
            });

            expect(
                screen.queryByRole('button', {
                    name: 'Make Admin',
                })
            ).not.toBeInTheDocument();
        });

        test('does not render Remove Admin for a banned user', () => {
            renderUserActions({
                user: createUser({
                    status: 'banned',
                    role: 'admin',
                }),
            });

            expect(
                screen.queryByRole('button', {
                    name: 'Remove Admin',
                })
            ).not.toBeInTheDocument();
        });

        test('calls onMutate with active status when Unban is clicked', () => {
            const onMutate = jest.fn();

            renderUserActions({
                user: createUser({
                    _id: 'banned-123',
                    status: 'banned',
                }),
                onMutate,
            });

            fireEvent.click(
                screen.getByRole('button', {
                    name: 'Unban',
                })
            );

            expect(onMutate).toHaveBeenCalledTimes(1);
            expect(onMutate).toHaveBeenCalledWith({
                userId: 'banned-123',
                status: 'active',
            });
        });
    });

    describe('Delete action', () => {
        test('renders Delete button', () => {
            renderUserActions();

            expect(
                screen.getByRole('button', {
                    name: /Delete/i,
                })
            ).toBeInTheDocument();

            expect(
                screen.getByTestId('trash-icon')
            ).toBeInTheDocument();
        });

        test('calls onDeleteClick with the user when Delete is clicked', () => {
            const onDeleteClick = jest.fn();
            const user = createUser({
                _id: 'delete-user-123',
            });

            renderUserActions({
                user,
                onDeleteClick,
            });

            fireEvent.click(
                screen.getByRole('button', {
                    name: /Delete/i,
                })
            );

            expect(
                onDeleteClick
            ).toHaveBeenCalledTimes(1);

            expect(
                onDeleteClick
            ).toHaveBeenCalledWith(user);
        });
    });

    describe('Disabled state', () => {
        test('disables all buttons while updating', () => {
            renderUserActions({
                isUpdating: true,
                isDeleting: false,
            });

            const buttons = screen.getAllByRole('button');

            expect(buttons).toHaveLength(3);

            buttons.forEach((button) => {
                expect(button).toBeDisabled();
            });
        });

        test('disables all buttons while deleting', () => {
            renderUserActions({
                isUpdating: false,
                isDeleting: true,
            });

            const buttons = screen.getAllByRole('button');

            expect(buttons).toHaveLength(3);

            buttons.forEach((button) => {
                expect(button).toBeDisabled();
            });
        });

        test('enables all buttons when not updating or deleting', () => {
            renderUserActions({
                isUpdating: false,
                isDeleting: false,
            });

            const buttons = screen.getAllByRole('button');

            buttons.forEach((button) => {
                expect(button).not.toBeDisabled();
            });
        });
    });

    describe('Event handling', () => {
        test('does not call onMutate when Delete is clicked', () => {
            const onMutate = jest.fn();
            const onDeleteClick = jest.fn();

            renderUserActions({
                onMutate,
                onDeleteClick,
            });

            fireEvent.click(
                screen.getByRole('button', {
                    name: /Delete/i,
                })
            );

            expect(onDeleteClick).toHaveBeenCalledTimes(1);
            expect(onMutate).not.toHaveBeenCalled();
        });

        test('does not call onDeleteClick when Ban is clicked', () => {
            const onMutate = jest.fn();
            const onDeleteClick = jest.fn();

            renderUserActions({
                onMutate,
                onDeleteClick,
            });

            fireEvent.click(
                screen.getByRole('button', {
                    name: 'Ban',
                })
            );

            expect(onMutate).toHaveBeenCalledTimes(1);
            expect(onDeleteClick).not.toHaveBeenCalled();
        });

        test('does not call onDeleteClick when Make Admin is clicked', () => {
            const onMutate = jest.fn();
            const onDeleteClick = jest.fn();

            renderUserActions({
                user: createUser({
                    role: 'user',
                    status: 'active',
                }),
                onMutate,
                onDeleteClick,
            });

            fireEvent.click(
                screen.getByRole('button', {
                    name: 'Make Admin',
                })
            );

            expect(onMutate).toHaveBeenCalledTimes(1);
            expect(onDeleteClick).not.toHaveBeenCalled();
        });

        test('does not call onDeleteClick when Unban is clicked', () => {
            const onMutate = jest.fn();
            const onDeleteClick = jest.fn();

            renderUserActions({
                user: createUser({
                    status: 'banned',
                }),
                onMutate,
                onDeleteClick,
            });

            fireEvent.click(
                screen.getByRole('button', {
                    name: 'Unban',
                })
            );

            expect(onMutate).toHaveBeenCalledTimes(1);
            expect(onDeleteClick).not.toHaveBeenCalled();
        });
    });
});
