// frontend/tests/admin/DeleteModal.test.jsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DeleteModal from '@/features/adminpages/UserManagement/DeleteModal';

// Mock lucide icon so the test focuses on component behavior.
jest.mock('lucide-react', () => ({
    Trash2: (props) => <svg data-testid="trash-icon" {...props} />,
}));

const user = {
    _id: 'user-1',
    name: 'Saurab Khatiwoda',
    email: 'saurab@example.com',
};

const createProps = (overrides = {}) => ({
    user,
    confirmInput: '',
    setConfirmInput: jest.fn(),
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
    isDeleting: false,
    ...overrides,
});

describe('DeleteModal', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('renders nothing when user is null', () => {
        const { container } = render(
            <DeleteModal {...createProps({ user: null })} />
        );

        expect(container.firstChild).toBeNull();
    });

    test('renders delete modal with user information', () => {
        render(<DeleteModal {...createProps()} />);

        expect(screen.getByRole('heading', { name: 'Delete User' }))
            .toBeInTheDocument();

        expect(
            screen.getByText('This action is permanent and cannot be undone.')
        ).toBeInTheDocument();

        expect(
            screen.getByText(/You are about to permanently delete/i)
        ).toBeInTheDocument();

        expect(screen.getAllByText('Saurab Khatiwoda')).toHaveLength(2);

        expect(
            screen.getByText(/and all their data including file history/i)
        ).toBeInTheDocument();

        expect(
            screen.getByText(/Type.*to confirm/i)
        ).toBeInTheDocument();

        expect(screen.getByTestId('trash-icon')).toBeInTheDocument();
    });

    test('renders input with user name as placeholder', () => {
        render(<DeleteModal {...createProps()} />);

        const input = screen.getByRole('textbox');

        expect(input).toHaveAttribute('placeholder', 'Saurab Khatiwoda');
        expect(input).toHaveValue('');
    });

    test('passes typed confirmation value to setConfirmInput', () => {
        const setConfirmInput = jest.fn();

        render(
            <DeleteModal
                {...createProps({ setConfirmInput })}
            />
        );

        const input = screen.getByRole('textbox');

        fireEvent.change(input, {
            target: { value: 'Saurab Khatiwoda' },
        });

        expect(setConfirmInput).toHaveBeenCalledTimes(1);
        expect(setConfirmInput).toHaveBeenCalledWith('Saurab Khatiwoda');
    });

    test('Delete Permanently button is disabled when confirmation does not match', () => {
        render(
            <DeleteModal
                {...createProps({ confirmInput: 'Wrong Name' })}
            />
        );

        const deleteButton = screen.getByRole('button', {
            name: 'Delete Permanently',
        });

        expect(deleteButton).toBeDisabled();
    });

    test('Delete Permanently button is enabled when confirmation matches user name', () => {
        render(
            <DeleteModal
                {...createProps({ confirmInput: 'Saurab Khatiwoda' })}
            />
        );

        const deleteButton = screen.getByRole('button', {
            name: 'Delete Permanently',
        });

        expect(deleteButton).toBeEnabled();
    });

    test('Delete Permanently button is disabled while deleting', () => {
        render(
            <DeleteModal
                {...createProps({
                    confirmInput: 'Saurab Khatiwoda',
                    isDeleting: true,
                })}
            />
        );

        const deleteButton = screen.getByRole('button', {
            name: 'Deleting...',
        });

        expect(deleteButton).toBeDisabled();
    });

    test('shows Deleting... while deletion is in progress', () => {
        render(
            <DeleteModal
                {...createProps({ isDeleting: true })}
            />
        );

        expect(
            screen.getByRole('button', { name: 'Deleting...' })
        ).toBeInTheDocument();

        expect(
            screen.queryByRole('button', { name: 'Delete Permanently' })
        ).not.toBeInTheDocument();
    });

    test('calls onCancel when Cancel is clicked', () => {
        const onCancel = jest.fn();

        render(
            <DeleteModal
                {...createProps({ onCancel })}
            />
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Cancel' })
        );

        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    test('calls onConfirm when Delete Permanently is clicked', () => {
        const onConfirm = jest.fn();

        render(
            <DeleteModal
                {...createProps({
                    confirmInput: 'Saurab Khatiwoda',
                    onConfirm,
                })}
            />
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Delete Permanently' })
        );

        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    test('does not call onConfirm when confirmation text is incorrect', () => {
        const onConfirm = jest.fn();

        render(
            <DeleteModal
                {...createProps({
                    confirmInput: 'Wrong Name',
                    onConfirm,
                })}
            />
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Delete Permanently' })
        );

        expect(onConfirm).not.toHaveBeenCalled();
    });

    test('does not call onConfirm while deleting', () => {
        const onConfirm = jest.fn();

        render(
            <DeleteModal
                {...createProps({
                    confirmInput: 'Saurab Khatiwoda',
                    isDeleting: true,
                    onConfirm,
                })}
            />
        );

        const deleteButton = screen.getByRole('button', {
            name: 'Deleting...',
        });

        fireEvent.click(deleteButton);

        expect(onConfirm).not.toHaveBeenCalled();
    });

    test('uses the current confirmInput value', () => {
        render(
            <DeleteModal
                {...createProps({
                    confirmInput: 'Saurab Khatiwoda',
                })}
            />
        );

        expect(screen.getByRole('textbox')).toHaveValue(
            'Saurab Khatiwoda'
        );
    });

    test('requires exact user name for confirmation', () => {
        render(
            <DeleteModal
                {...createProps({
                    confirmInput: 'saurab khatiwoda',
                })}
            />
        );

        expect(
            screen.getByRole('button', {
                name: 'Delete Permanently',
            })
        ).toBeDisabled();
    });
});