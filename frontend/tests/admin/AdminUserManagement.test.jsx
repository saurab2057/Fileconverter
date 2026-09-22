
import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import UserManagement from '@/features/adminpages/UserManagement';
import DeleteModal from '@/features/adminpages/UserManagement/DeleteModal';
import UserActions from '@/features/adminpages/UserManagement/UserActions';
import UserTable from '@/features/adminpages/UserManagement/UserTable';

import apiClient from '@/lib/api';

/* ─────────────────────────────────────────────────────────────
   Mocks
   ───────────────────────────────────────────────────────────── */

const mockSuccess = jest.fn();
const mockError = jest.fn();

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('@/context/ToastContext', () => ({
  useToast: () => ({
    addToast: jest.fn(),
    success: mockSuccess,
    error: mockError,
    info: jest.fn(),
    warning: jest.fn(),
    removeToast: jest.fn(),
  }),
}));

/* ─────────────────────────────────────────────────────────────
   Test data
   ───────────────────────────────────────────────────────────── */

const activeUser = {
  _id: 'user-001',
  name: 'John Doe',
  email: 'john@example.com',
  role: 'user',
  status: 'active',
  createdAt: '2026-01-15T00:00:00.000Z',
};

const adminUser = {
  _id: 'admin-001',
  name: 'Admin User',
  email: 'admin@example.com',
  role: 'admin',
  status: 'active',
  createdAt: '2025-12-10T00:00:00.000Z',
};

const bannedUser = {
  _id: 'banned-001',
  name: 'Banned User',
  email: 'banned@example.com',
  role: 'user',
  status: 'banned',
  createdAt: '2025-11-20T00:00:00.000Z',
};

const defaultUsers = [
  activeUser,
  adminUser,
  bannedUser,
];

/* ─────────────────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────────────────── */

/*
 * Creates a fresh QueryClient for every test.
 *
 * This prevents cached queries from one test affecting another
 * test and disables automatic retries so API failures resolve
 * immediately.
 */
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });

/*
 * Renders UserManagement with the QueryClientProvider required
 * by React Query.
 */
const renderUserManagement = (
  users = defaultUsers,
  pagination = {
    total: users.length,
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
  }
) => {
  apiClient.get.mockResolvedValue({
    data: {
      users,
      pagination,
    },
  });

  const queryClient = createTestQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <UserManagement />
    </QueryClientProvider>
  );
};

/*
 * Finds the table row belonging to a particular user.
 *
 * Email is used because it should uniquely identify the user.
 * This is important because several rows can contain buttons
 * with the same accessible name, such as "Ban" or "Delete".
 */
const getUserRow = (user) => {
  const email = screen.getByText(user.email);
  const row = email.closest('tr');

  if (!row) {
    throw new Error(`Could not find table row for ${user.email}`);
  }

  return row;
};

/*
 * Finds a user-specific action button inside that user's row.
 *
 * Examples:
 *   getUserAction(activeUser, 'Ban')
 *   getUserAction(activeUser, 'Delete')
 *   getUserAction(adminUser, 'Remove Admin')
 *   getUserAction(bannedUser, 'Unban')
 */
const getUserAction = (user, actionName) => {
  return within(getUserRow(user)).getByRole('button', {
    name: actionName,
  });
};

/*
 * Finds the Delete User modal after it has been opened.
 *
 * The modal contains the user's name multiple times, so queries
 * for modal content must be scoped to the modal itself.
 */
const getDeleteModal = () => {
  const heading = screen.getByRole('heading', {
    name: 'Delete User',
  });

  const modal = heading.closest('.fixed');

  if (!modal) {
    throw new Error('Delete modal was not found');
  }

  return modal;
};

beforeEach(() => {
  jest.clearAllMocks();

  apiClient.get.mockResolvedValue({
    data: {
      users: defaultUsers,
      pagination: {
        total: defaultUsers.length,
        totalPages: 1,
        hasPrev: false,
        hasNext: false,
      },
    },
  });
});

/* ═════════════════════════════════════════════════════════════
   DeleteModal
   ═════════════════════════════════════════════════════════════ */

describe('DeleteModal', () => {
  const modalUser = activeUser;

  const defaultProps = {
    user: modalUser,
    confirmInput: '',
    setConfirmInput: jest.fn(),
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
    isDeleting: false,
  };

  test('returns nothing when no user is provided', () => {
    const { container } = render(
      <DeleteModal
        {...defaultProps}
        user={null}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  test('renders the delete modal for a user', () => {
    render(<DeleteModal {...defaultProps} />);

    expect(
      screen.getByRole('heading', {
        name: 'Delete User',
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        'This action is permanent and cannot be undone.'
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(/all their data including file history/i)
    ).toBeInTheDocument();
  });

  test('displays the user name in the warning', () => {
    render(<DeleteModal {...defaultProps} />);

    const modal = getDeleteModal();

    expect(
      within(modal).getAllByText(modalUser.name)
    ).toHaveLength(2);
  });

  test('uses the user name as the input placeholder', () => {
    render(<DeleteModal {...defaultProps} />);

    expect(
      screen.getByPlaceholderText(modalUser.name)
    ).toBeInTheDocument();
  });

  test('delete button is disabled initially', () => {
    render(<DeleteModal {...defaultProps} />);

    expect(
      screen.getByRole('button', {
        name: 'Delete Permanently',
      })
    ).toBeDisabled();
  });

  test('delete button remains disabled when confirmation text is incorrect', () => {
    render(
      <DeleteModal
        {...defaultProps}
        confirmInput="Wrong Name"
      />
    );

    expect(
      screen.getByRole('button', {
        name: 'Delete Permanently',
      })
    ).toBeDisabled();
  });

  test('delete button becomes enabled when exact user name is entered', () => {
    render(
      <DeleteModal
        {...defaultProps}
        confirmInput={modalUser.name}
      />
    );

    expect(
      screen.getByRole('button', {
        name: 'Delete Permanently',
      })
    ).toBeEnabled();
  });

  test('calls setConfirmInput when confirmation input changes', () => {
    const setConfirmInput = jest.fn();

    render(
      <DeleteModal
        {...defaultProps}
        setConfirmInput={setConfirmInput}
      />
    );

    const input = screen.getByPlaceholderText(modalUser.name);

    fireEvent.change(input, {
      target: {
        value: modalUser.name,
      },
    });

    expect(setConfirmInput).toHaveBeenCalledWith(
      modalUser.name
    );
  });

  test('calls onCancel when Cancel is clicked', () => {
    const onCancel = jest.fn();

    render(
      <DeleteModal
        {...defaultProps}
        onCancel={onCancel}
      />
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Cancel',
      })
    );

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test('calls onConfirm when Delete Permanently is clicked', () => {
    const onConfirm = jest.fn();

    render(
      <DeleteModal
        {...defaultProps}
        confirmInput={modalUser.name}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Delete Permanently',
      })
    );

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test('shows Deleting while deletion is in progress', () => {
    render(
      <DeleteModal
        {...defaultProps}
        confirmInput={modalUser.name}
        isDeleting
      />
    );

    const button = screen.getByRole('button', {
      name: 'Deleting...',
    });

    expect(button).toBeDisabled();
  });

  test('delete button is disabled while deletion is in progress', () => {
    render(
      <DeleteModal
        {...defaultProps}
        confirmInput={modalUser.name}
        isDeleting
      />
    );

    expect(
      screen.getByRole('button', {
        name: 'Deleting...',
      })
    ).toBeDisabled();
  });
});

/* ═════════════════════════════════════════════════════════════
   UserActions
   ═════════════════════════════════════════════════════════════ */

describe('UserActions', () => {
  const renderActions = (
    user,
    {
      isUpdating = false,
      isDeleting = false,
      onMutate = jest.fn(),
      onDeleteClick = jest.fn(),
    } = {}
  ) => {
    return render(
      <UserActions
        user={user}
        isUpdating={isUpdating}
        isDeleting={isDeleting}
        onMutate={onMutate}
        onDeleteClick={onDeleteClick}
      />
    );
  };

  test('shows Ban and Make Admin for an active normal user', () => {
    renderActions(activeUser);

    expect(
      screen.getByRole('button', {
        name: 'Ban',
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', {
        name: 'Make Admin',
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', {
        name: 'Delete',
      })
    ).toBeInTheDocument();
  });

  test('shows Ban and Remove Admin for an active admin', () => {
    renderActions(adminUser);

    expect(
      screen.getByRole('button', {
        name: 'Ban',
      })
    ).toBeInTheDocument();

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

  test('shows Unban instead of Ban for a banned user', () => {
    renderActions(bannedUser);

    expect(
      screen.getByRole('button', {
        name: 'Unban',
      })
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: 'Ban',
      })
    ).not.toBeInTheDocument();
  });

  test('banned user does not show role change action', () => {
    renderActions(bannedUser);

    expect(
      screen.queryByRole('button', {
        name: 'Make Admin',
      })
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: 'Remove Admin',
      })
    ).not.toBeInTheDocument();
  });

  test('Ban calls onMutate with banned status', () => {
    const onMutate = jest.fn();

    renderActions(activeUser, { onMutate });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ban',
      })
    );

    expect(onMutate).toHaveBeenCalledWith({
      userId: activeUser._id,
      status: 'banned',
    });
  });

  test('Unban calls onMutate with active status', () => {
    const onMutate = jest.fn();

    renderActions(bannedUser, { onMutate });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Unban',
      })
    );

    expect(onMutate).toHaveBeenCalledWith({
      userId: bannedUser._id,
      status: 'active',
    });
  });

  test('Make Admin calls onMutate with admin role', () => {
    const onMutate = jest.fn();

    renderActions(activeUser, { onMutate });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Make Admin',
      })
    );

    expect(onMutate).toHaveBeenCalledWith({
      userId: activeUser._id,
      role: 'admin',
    });
  });

  test('Remove Admin calls onMutate with user role', () => {
    const onMutate = jest.fn();

    renderActions(adminUser, { onMutate });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Remove Admin',
      })
    );

    expect(onMutate).toHaveBeenCalledWith({
      userId: adminUser._id,
      role: 'user',
    });
  });

  test('Delete calls onDeleteClick with the correct user', () => {
    const onDeleteClick = jest.fn();

    renderActions(activeUser, { onDeleteClick });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Delete',
      })
    );

    expect(onDeleteClick).toHaveBeenCalledWith(activeUser);
  });

  test('all action buttons are disabled while updating', () => {
    renderActions(activeUser, {
      isUpdating: true,
    });

    expect(
      screen.getByRole('button', { name: 'Ban' })
    ).toBeDisabled();

    expect(
      screen.getByRole('button', { name: 'Make Admin' })
    ).toBeDisabled();

    expect(
      screen.getByRole('button', { name: 'Delete' })
    ).toBeDisabled();
  });

  test('all action buttons are disabled while deleting', () => {
    renderActions(activeUser, {
      isDeleting: true,
    });

    expect(
      screen.getByRole('button', { name: 'Ban' })
    ).toBeDisabled();

    expect(
      screen.getByRole('button', { name: 'Make Admin' })
    ).toBeDisabled();

    expect(
      screen.getByRole('button', { name: 'Delete' })
    ).toBeDisabled();
  });
});

/* ═════════════════════════════════════════════════════════════
   UserTable
   ═════════════════════════════════════════════════════════════ */

describe('UserTable', () => {
  const defaultTableProps = {
    users: defaultUsers,
    pagination: {
      total: defaultUsers.length,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    },
    currentPage: 1,
    itemsPerPage: 20,
    isUpdating: false,
    isDeleting: false,
    onMutate: jest.fn(),
    onDeleteClick: jest.fn(),
    onPageChange: jest.fn(),
  };

  test('renders all table headers', () => {
    render(<UserTable {...defaultTableProps} />);

    expect(
      screen.getByRole('columnheader', { name: 'User' })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('columnheader', { name: 'Role' })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('columnheader', { name: 'Status' })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('columnheader', { name: 'Join Date' })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('columnheader', { name: 'Actions' })
    ).toBeInTheDocument();
  });

  test('renders user names and emails', () => {
    render(<UserTable {...defaultTableProps} />);

    expect(
      screen.getByText(activeUser.name)
    ).toBeInTheDocument();

    expect(
      screen.getByText(activeUser.email)
    ).toBeInTheDocument();

    expect(
      screen.getByText(adminUser.name)
    ).toBeInTheDocument();

    expect(
      screen.getByText(adminUser.email)
    ).toBeInTheDocument();

    expect(
      screen.getByText(bannedUser.name)
    ).toBeInTheDocument();

    expect(
      screen.getByText(bannedUser.email)
    ).toBeInTheDocument();
  });

  test('renders Admin and User role badges', () => {
    render(<UserTable {...defaultTableProps} />);

    const adminRow = getUserRow(adminUser);
    const userRow = getUserRow(activeUser);

    expect(
      within(adminRow).getByText('Admin')
    ).toBeInTheDocument();

    expect(
      within(userRow).getByText('User')
    ).toBeInTheDocument();
  });

  test('renders Active and Banned status badges', () => {
    render(<UserTable {...defaultTableProps} />);

    const activeRow = getUserRow(activeUser);
    const bannedRow = getUserRow(bannedUser);

    expect(
      within(activeRow).getByText('Active')
    ).toBeInTheDocument();

    expect(
      within(bannedRow).getByText('Banned')
    ).toBeInTheDocument();
  });

  test('renders formatted join dates', () => {
    render(<UserTable {...defaultTableProps} />);

    expect(
      screen.getByText(
        new Date(activeUser.createdAt).toLocaleDateString()
      )
    ).toBeInTheDocument();
  });

  test('renders user-specific action buttons', () => {
    render(<UserTable {...defaultTableProps} />);

    expect(
      within(getUserRow(activeUser)).getByRole('button', {
        name: 'Ban',
      })
    ).toBeInTheDocument();

    expect(
      within(getUserRow(activeUser)).getByRole('button', {
        name: 'Make Admin',
      })
    ).toBeInTheDocument();

    expect(
      within(getUserRow(adminUser)).getByRole('button', {
        name: 'Remove Admin',
      })
    ).toBeInTheDocument();

    expect(
      within(getUserRow(bannedUser)).getByRole('button', {
        name: 'Unban',
      })
    ).toBeInTheDocument();
  });

  test('applies banned row styling', () => {
    render(<UserTable {...defaultTableProps} />);

    const row = getUserRow(bannedUser);

    expect(row).toHaveClass('bg-red-50');
    expect(row).toHaveClass('border-red-200');
  });

  test('uses normal row styling for active users', () => {
    render(<UserTable {...defaultTableProps} />);

    const row = getUserRow(activeUser);

    expect(row).toHaveClass('border-gray-100');
    expect(row).not.toHaveClass('bg-red-50');
  });

  test('shows empty-state message when there are no users', () => {
    render(
      <UserTable
        {...defaultTableProps}
        users={[]}
      />
    );

    expect(
      screen.getByText(
        'No users found matching your criteria.'
      )
    ).toBeInTheDocument();
  });

  test('does not render pagination when there is only one page', () => {
    render(<UserTable {...defaultTableProps} />);

    expect(
      screen.queryByRole('button', { name: 'Previous' })
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole('button', { name: 'Next' })
    ).not.toBeInTheDocument();
  });

  test('renders pagination when there are multiple pages', () => {
    render(
      <UserTable
        {...defaultTableProps}
        pagination={{
          total: 45,
          totalPages: 3,
          hasPrev: true,
          hasNext: true,
        }}
        currentPage={2}
      />
    );

    expect(
      screen.getByText('Showing 21 to 40 of 45 users')
    ).toBeInTheDocument();

    expect(
      screen.getByText('Page 2 of 3')
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', {
        name: 'Previous',
      })
    ).toBeEnabled();

    expect(
      screen.getByRole('button', {
        name: 'Next',
      })
    ).toBeEnabled();
  });

  test('disables Previous when there is no previous page', () => {
    render(
      <UserTable
        {...defaultTableProps}
        pagination={{
          total: 45,
          totalPages: 3,
          hasPrev: false,
          hasNext: true,
        }}
        currentPage={1}
      />
    );

    expect(
      screen.getByRole('button', {
        name: 'Previous',
      })
    ).toBeDisabled();
  });

  test('disables Next when there is no next page', () => {
    render(
      <UserTable
        {...defaultTableProps}
        pagination={{
          total: 45,
          totalPages: 3,
          hasPrev: true,
          hasNext: false,
        }}
        currentPage={3}
      />
    );

    expect(
      screen.getByRole('button', {
        name: 'Next',
      })
    ).toBeDisabled();
  });

  test('Previous sends a page decrement function', () => {
    const onPageChange = jest.fn();

    render(
      <UserTable
        {...defaultTableProps}
        onPageChange={onPageChange}
        pagination={{
          total: 45,
          totalPages: 3,
          hasPrev: true,
          hasNext: true,
        }}
        currentPage={2}
      />
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Previous',
      })
    );

    expect(onPageChange).toHaveBeenCalledTimes(1);

    const updater = onPageChange.mock.calls[0][0];

    expect(updater(2)).toBe(1);
  });

  test('Next sends a page increment function', () => {
    const onPageChange = jest.fn();

    render(
      <UserTable
        {...defaultTableProps}
        onPageChange={onPageChange}
        pagination={{
          total: 45,
          totalPages: 3,
          hasPrev: true,
          hasNext: true,
        }}
        currentPage={2}
      />
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Next',
      })
    );

    expect(onPageChange).toHaveBeenCalledTimes(1);

    const updater = onPageChange.mock.calls[0][0];

    expect(updater(2)).toBe(3);
  });
});

/* ═════════════════════════════════════════════════════════════
   UserManagement
   ═════════════════════════════════════════════════════════════ */

describe('UserManagement', () => {
  test('shows loading state while users are loading', () => {
    apiClient.get.mockReturnValue(
      new Promise(() => { })
    );

    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <UserManagement />
      </QueryClientProvider>
    );

    expect(
      screen.getByText('Loading users...')
    ).toBeInTheDocument();
  });

  test('shows API error when loading users fails', async () => {
    apiClient.get.mockRejectedValueOnce(
      new Error('Unable to fetch users')
    );

    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <UserManagement />
      </QueryClientProvider>
    );

    expect(
      await screen.findByText(
        'Error: Unable to fetch users'
      )
    ).toBeInTheDocument();
  });

  test('renders User Management heading', async () => {
    renderUserManagement();

    expect(
      await screen.findByRole('heading', {
        name: 'User Management',
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        'Manage users, roles, and access controls'
      )
    ).toBeInTheDocument();
  });

  test('requests the first page with 20 users', async () => {
    renderUserManagement();

    await screen.findByRole('heading', {
      name: 'User Management',
    });

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/admin/users',
        {
          params: {
            page: 1,
            limit: 20,
          },
        }
      );
    });
  });

  test('renders all users returned by the API', async () => {
    renderUserManagement();

    expect(
      await screen.findByText(activeUser.email)
    ).toBeInTheDocument();

    expect(
      screen.getByText(adminUser.email)
    ).toBeInTheDocument();

    expect(
      screen.getByText(bannedUser.email)
    ).toBeInTheDocument();
  });

  test('renders search input and role filter', async () => {
    renderUserManagement();

    await screen.findByText(activeUser.email);

    expect(
      screen.getByPlaceholderText(
        'Search by email or name...'
      )
    ).toBeInTheDocument();

    expect(
      screen.getByRole('combobox')
    ).toBeInTheDocument();

    expect(
      screen.getByRole('option', {
        name: 'All Roles',
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('option', {
        name: 'Admin',
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('option', {
        name: 'User',
      })
    ).toBeInTheDocument();
  });

  test('All Roles filter shows all users', async () => {
    renderUserManagement();

    await screen.findByText(activeUser.email);

    fireEvent.change(
      screen.getByRole('combobox'),
      {
        target: {
          value: 'all',
        },
      }
    );

    expect(
      screen.getByText(activeUser.email)
    ).toBeInTheDocument();

    expect(
      screen.getByText(adminUser.email)
    ).toBeInTheDocument();

    expect(
      screen.getByText(bannedUser.email)
    ).toBeInTheDocument();
  });

  test('Admin filter shows only admin users', async () => {
    renderUserManagement();

    await screen.findByText(activeUser.email);

    fireEvent.change(
      screen.getByRole('combobox'),
      {
        target: {
          value: 'admin',
        },
      }
    );

    expect(
      screen.getByText(adminUser.email)
    ).toBeInTheDocument();

    expect(
      screen.queryByText(activeUser.email)
    ).not.toBeInTheDocument();

    expect(
      screen.queryByText(bannedUser.email)
    ).not.toBeInTheDocument();
  });

  test('User filter shows only normal users', async () => {
    renderUserManagement();

    await screen.findByText(activeUser.email);

    fireEvent.change(
      screen.getByRole('combobox'),
      {
        target: {
          value: 'user',
        },
      }
    );

    expect(
      screen.getByText(activeUser.email)
    ).toBeInTheDocument();

    expect(
      screen.getByText(bannedUser.email)
    ).toBeInTheDocument();

    expect(
      screen.queryByText(adminUser.email)
    ).not.toBeInTheDocument();
  });

  test('search sends the search term to the API', async () => {
    renderUserManagement();

    const searchInput =
      await screen.findByPlaceholderText(
        'Search by email or name...'
      );

    fireEvent.change(searchInput, {
      target: {
        value: 'john',
      },
    });

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/admin/users',
        {
          params: {
            page: 1,
            limit: 20,
            search: 'john',
          },
        }
      );
    });
  });

  test('Refresh calls the query refetch function', async () => {
    renderUserManagement();

    await screen.findByText(activeUser.email);

    const callsBeforeRefresh = apiClient.get.mock.calls.length;

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Refresh',
      })
    );

    await waitFor(() => {
      expect(apiClient.get.mock.calls.length).toBeGreaterThan(
        callsBeforeRefresh
      );
    });
  });

  test('clicking Ban updates the correct user', async () => {
    apiClient.put.mockResolvedValueOnce({
      data: {
        message: 'User banned successfully.',
      },
    });

    renderUserManagement();

    await screen.findByText(activeUser.email);

    /*
     * IMPORTANT:
     * There are multiple "Ban" buttons on the page.
     * We therefore scope the button to John Doe's row.
     */
    fireEvent.click(
      getUserAction(activeUser, 'Ban')
    );

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        `/api/admin/users/${activeUser._id}`,
        {
          status: 'banned',
        }
      );
    });

    await waitFor(() => {
      expect(mockSuccess).toHaveBeenCalledWith(
        'User banned successfully.'
      );
    });
  });

  test('clicking Make Admin updates the correct user', async () => {
    apiClient.put.mockResolvedValueOnce({
      data: {
        message: 'User promoted successfully.',
      },
    });

    renderUserManagement();

    await screen.findByText(activeUser.email);

    fireEvent.click(
      getUserAction(activeUser, 'Make Admin')
    );

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        `/api/admin/users/${activeUser._id}`,
        {
          role: 'admin',
        }
      );
    });

    await waitFor(() => {
      expect(mockSuccess).toHaveBeenCalledWith(
        'User promoted successfully.'
      );
    });
  });

  test('clicking Remove Admin updates the correct user', async () => {
    apiClient.put.mockResolvedValueOnce({
      data: {
        message: 'Admin role removed.',
      },
    });

    renderUserManagement();

    await screen.findByText(adminUser.email);

    fireEvent.click(
      getUserAction(adminUser, 'Remove Admin')
    );

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        `/api/admin/users/${adminUser._id}`,
        {
          role: 'user',
        }
      );
    });

    await waitFor(() => {
      expect(mockSuccess).toHaveBeenCalledWith(
        'Admin role removed.'
      );
    });
  });

  test('clicking Unban updates the correct user', async () => {
    apiClient.put.mockResolvedValueOnce({
      data: {
        message: 'User unbanned successfully.',
      },
    });

    renderUserManagement();

    await screen.findByText(bannedUser.email);

    fireEvent.click(
      getUserAction(bannedUser, 'Unban')
    );

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        `/api/admin/users/${bannedUser._id}`,
        {
          status: 'active',
        }
      );
    });

    await waitFor(() => {
      expect(mockSuccess).toHaveBeenCalledWith(
        'User unbanned successfully.'
      );
    });
  });

  test('shows API error toast when user update fails', async () => {
    apiClient.put.mockRejectedValueOnce({
      response: {
        data: {
          message: 'You cannot ban this user.',
        },
      },
    });

    renderUserManagement();

    await screen.findByText(activeUser.email);

    fireEvent.click(
      getUserAction(activeUser, 'Ban')
    );

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'You cannot ban this user.'
      );
    });
  });

  test('uses fallback error toast when update error has no message', async () => {
    apiClient.put.mockRejectedValueOnce({
      response: {
        data: {},
      },
    });

    renderUserManagement();

    await screen.findByText(activeUser.email);

    fireEvent.click(
      getUserAction(activeUser, 'Ban')
    );

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Something went wrong.'
      );
    });
  });

  test('opens delete modal for the correct user', async () => {
    renderUserManagement();

    await screen.findByText(activeUser.email);

    /*
     * There are multiple Delete buttons.
     * Scope Delete to John Doe's row.
     */
    fireEvent.click(
      getUserAction(activeUser, 'Delete')
    );

    const modal = getDeleteModal();

    expect(modal).toBeInTheDocument();

    expect(
      within(modal).getByRole('heading', {
        name: 'Delete User',
      })
    ).toBeInTheDocument();

    expect(
      within(modal).getAllByText(activeUser.name)
    ).toHaveLength(2);

    expect(
      within(modal).getByPlaceholderText(
        activeUser.name
      )
    ).toBeInTheDocument();
  });

  test('delete confirmation button is initially disabled', async () => {
    renderUserManagement();

    await screen.findByText(activeUser.email);

    fireEvent.click(
      getUserAction(activeUser, 'Delete')
    );

    const modal = getDeleteModal();

    expect(
      within(modal).getByRole('button', {
        name: 'Delete Permanently',
      })
    ).toBeDisabled();
  });

  test('delete confirmation becomes enabled with exact user name', async () => {
    renderUserManagement();

    await screen.findByText(activeUser.email);

    fireEvent.click(
      getUserAction(activeUser, 'Delete')
    );

    const modal = getDeleteModal();

    const input = within(modal).getByRole('textbox');

    fireEvent.change(input, {
      target: {
        value: activeUser.name,
      },
    });

    expect(
      within(modal).getByRole('button', {
        name: 'Delete Permanently',
      })
    ).toBeEnabled();
  });

  test('incorrect delete confirmation remains disabled', async () => {
    renderUserManagement();

    await screen.findByText(activeUser.email);

    fireEvent.click(
      getUserAction(activeUser, 'Delete')
    );

    const modal = getDeleteModal();

    fireEvent.change(
      within(modal).getByRole('textbox'),
      {
        target: {
          value: 'Wrong Name',
        },
      }
    );

    expect(
      within(modal).getByRole('button', {
        name: 'Delete Permanently',
      })
    ).toBeDisabled();
  });

  test('Cancel closes delete modal', async () => {
    renderUserManagement();

    await screen.findByText(activeUser.email);

    fireEvent.click(
      getUserAction(activeUser, 'Delete')
    );

    expect(
      screen.getByRole('heading', {
        name: 'Delete User',
      })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Cancel',
      })
    );

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', {
          name: 'Delete User',
        })
      ).not.toBeInTheDocument();
    });
  });

  test('confirming deletion calls DELETE API with the correct user ID', async () => {
    apiClient.delete.mockResolvedValueOnce({
      data: {
        message: 'User deleted successfully.',
      },
    });

    renderUserManagement();

    await screen.findByText(activeUser.email);

    fireEvent.click(
      getUserAction(activeUser, 'Delete')
    );

    const modal = getDeleteModal();

    fireEvent.change(
      within(modal).getByRole('textbox'),
      {
        target: {
          value: activeUser.name,
        },
      }
    );

    fireEvent.click(
      within(modal).getByRole('button', {
        name: 'Delete Permanently',
      })
    );

    await waitFor(() => {
      expect(apiClient.delete).toHaveBeenCalledWith(
        `/api/admin/users/${activeUser._id}`
      );
    });
  });

  test('successful deletion shows success toast', async () => {
    apiClient.delete.mockResolvedValueOnce({
      data: {
        message: 'User deleted successfully.',
      },
    });

    renderUserManagement();

    await screen.findByText(activeUser.email);

    fireEvent.click(
      getUserAction(activeUser, 'Delete')
    );

    const modal = getDeleteModal();

    fireEvent.change(
      within(modal).getByRole('textbox'),
      {
        target: {
          value: activeUser.name,
        },
      }
    );

    fireEvent.click(
      within(modal).getByRole('button', {
        name: 'Delete Permanently',
      })
    );

    await waitFor(() => {
      expect(mockSuccess).toHaveBeenCalledWith(
        'User deleted successfully.'
      );
    });
  });

  test('successful deletion closes the modal', async () => {
    apiClient.delete.mockResolvedValueOnce({
      data: {
        message: 'User deleted successfully.',
      },
    });

    renderUserManagement();

    await screen.findByText(activeUser.email);

    fireEvent.click(
      getUserAction(activeUser, 'Delete')
    );

    const modal = getDeleteModal();

    fireEvent.change(
      within(modal).getByRole('textbox'),
      {
        target: {
          value: activeUser.name,
        },
      }
    );

    fireEvent.click(
      within(modal).getByRole('button', {
        name: 'Delete Permanently',
      })
    );

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', {
          name: 'Delete User',
        })
      ).not.toBeInTheDocument();
    });
  });

  test('shows API error toast when deletion fails', async () => {
    apiClient.delete.mockRejectedValueOnce({
      response: {
        data: {
          message: 'Unable to delete this user.',
        },
      },
    });

    renderUserManagement();

    await screen.findByText(activeUser.email);

    fireEvent.click(
      getUserAction(activeUser, 'Delete')
    );

    const modal = getDeleteModal();

    fireEvent.change(
      within(modal).getByRole('textbox'),
      {
        target: {
          value: activeUser.name,
        },
      }
    );

    fireEvent.click(
      within(modal).getByRole('button', {
        name: 'Delete Permanently',
      })
    );

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Unable to delete this user.'
      );
    });
  });

  test('uses fallback error toast when deletion error has no message', async () => {
    apiClient.delete.mockRejectedValueOnce({
      response: {
        data: {},
      },
    });

    renderUserManagement();

    await screen.findByText(activeUser.email);

    fireEvent.click(
      getUserAction(activeUser, 'Delete')
    );

    const modal = getDeleteModal();

    fireEvent.change(
      within(modal).getByRole('textbox'),
      {
        target: {
          value: activeUser.name,
        },
      }
    );

    fireEvent.click(
      within(modal).getByRole('button', {
        name: 'Delete Permanently',
      })
    );

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Failed to delete user.'
      );
    });
  });

  test('empty API users array displays the empty table state', async () => {
    renderUserManagement([], {
      total: 0,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    });

    expect(
      await screen.findByText(
        'No users found matching your criteria.'
      )
    ).toBeInTheDocument();
  });

  test('handles missing users and pagination fields from API', async () => {
    apiClient.get.mockResolvedValueOnce({
      data: {},
    });

    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <UserManagement />
      </QueryClientProvider>
    );

    expect(
      await screen.findByText(
        'No users found matching your criteria.'
      )
    ).toBeInTheDocument();
  });

  test('renders pagination controls through UserTable', async () => {
    renderUserManagement(defaultUsers, {
      total: 45,
      totalPages: 3,
      hasPrev: true,
      hasNext: true,
    });

    await screen.findByText(activeUser.email);

    expect(
      screen.getByText('Page 1 of 3')
    ).toBeInTheDocument();

    expect(
      screen.getByText('Showing 1 to 20 of 45 users')
    ).toBeInTheDocument();
  });

  test('Next changes the current page', async () => {
    renderUserManagement(defaultUsers, {
      total: 45,
      totalPages: 3,
      hasPrev: false,
      hasNext: true,
    });

    await screen.findByText(activeUser.email);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Next',
      })
    );

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/admin/users',
        {
          params: {
            page: 2,
            limit: 20,
          },
        }
      );
    });
  });

  test('Previous changes the current page back', async () => {
    /*
     * The component starts on page 1, so we first click Next
     * and then verify that Previous requests page 1 again.
     */
    renderUserManagement(defaultUsers, {
      total: 45,
      totalPages: 3,
      hasPrev: false,
      hasNext: true,
    });

    await screen.findByText(activeUser.email);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Next',
      })
    );

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/admin/users',
        {
          params: {
            page: 2,
            limit: 20,
          },
        }
      );
    });

    /*
     * The second render keeps the same users because the mocked
     * API returns the same fixture for every page.
     */
    await waitFor(() => {
      expect(
        screen.getByText('Page 2 of 3')
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Previous',
      })
    );

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/admin/users',
        {
          params: {
            page: 1,
            limit: 20,
          },
        }
      );
    });
  });

  it('refresh button is disabled while updating', async () => {
    let resolveUpdate;

    apiClient.put.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        })
    );

    renderUserManagement();

    await waitFor(() => {
      expect(screen.getByText('User Management')).toBeInTheDocument();
    });

    const johnRow = screen.getByText('john@example.com').closest('tr');

    expect(johnRow).not.toBeNull();

    // Start the update and keep the API request pending.
    fireEvent.click(
      within(johnRow).getByRole('button', { name: 'Ban' })
    );

    // While the update is pending, Refresh must be disabled.
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Refresh' })
      ).toBeDisabled();
    });

    // Finish the pending API request.
    resolveUpdate({
      data: {
        message: 'User updated successfully!',
      },
    });

    // Refresh should become enabled again.
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Refresh' })
      ).not.toBeDisabled();
    });
  });

  test('banned user can be unbanned from UserManagement', async () => {
    apiClient.put.mockResolvedValueOnce({
      data: {
        message: 'User restored.',
      },
    });

    renderUserManagement();

    await screen.findByText(bannedUser.email);

    /*
     * There may be other action buttons with similar names.
     * Always target the banned user's row.
     */
    fireEvent.click(
      getUserAction(bannedUser, 'Unban')
    );

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        `/api/admin/users/${bannedUser._id}`,
        {
          status: 'active',
        }
      );
    });
  });
});
