// src/features/adminpages/UserManagement/index.jsx
import { useState, useEffect } from 'react';
import { Search, Filter, RefreshCw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api';

import { useToast } from '@/context/ToastContext';
import DeleteModal from './DeleteModal';
import UserTable from './UserTable';

// ─── API functions ────────────────────────────────────────────
const fetchUsers = async ({ page, limit, search }) => {
  const params = { page, limit };
  if (search) params.search = search;
  const { data } = await apiClient.get('/api/admin/users', { params });
  return { users: data.users || [], pagination: data.pagination || {} };
};

const updateUserApi = async ({ userId, status, role }) => {
  const body = {};
  if (status) body.status = status;
  if (role) body.role = role;
  const { data } = await apiClient.put(`/api/admin/users/${userId}`, body);
  return data;
};

const deleteUserApi = async (userId) => {
  const { data } = await apiClient.delete(`/api/admin/users/${userId}`);
  return data;
};

// ─── Main Component ───────────────────────────────────────────
const UserManagement = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState('all');
  const [deleteModal, setDeleteModal] = useState({ open: false, user: null });
  const [confirmInput, setConfirmInput] = useState('');
  const itemsPerPage = 20;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, userTypeFilter]);

  const { data, isLoading, isError, error: fetchError, refetch, isFetching } = useQuery({
    queryKey: ['users', currentPage, itemsPerPage, searchTerm],
    queryFn: () => fetchUsers({ page: currentPage, limit: itemsPerPage, search: searchTerm }),
    keepPreviousData: true,
  });

  const users = data?.users || [];
  const pagination = data?.pagination || {};

  const filteredUsers = users.filter(user =>
    userTypeFilter === 'all' ? true : user.role === userTypeFilter
  );

  const { mutate: mutateUser, isLoading: isUpdating } = useMutation({
    mutationFn: updateUserApi,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(data.message || 'User updated successfully!');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Something went wrong.');
    },
  });

  const { mutate: deleteUser, isLoading: isDeleting } = useMutation({
    mutationFn: deleteUserApi,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeleteModal({ open: false, user: null });
      setConfirmInput('');
      toast.success(data.message);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to delete user.');
    },
  });

  const handleDeleteClick = (user) => {
    setConfirmInput('');
    setDeleteModal({ open: true, user });
  };

  const handleDeleteCancel = () => {
    setDeleteModal({ open: false, user: null });
    setConfirmInput('');
  };

  if (isLoading) return <div className="p-4 text-center text-gray-500">Loading users...</div>;
  if (isError) return <div className="p-4 text-center text-red-500">Error: {fetchError?.message || 'Failed to load users.'}</div>;

  return (
    <div className="space-y-6">
      {/* Delete Modal */}
      {deleteModal.open && (
        <DeleteModal
          user={deleteModal.user}
          confirmInput={confirmInput}
          setConfirmInput={setConfirmInput}
          onConfirm={() => deleteUser(deleteModal.user._id)}
          onCancel={handleDeleteCancel}
          isDeleting={isDeleting}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">Manage users, roles, and access controls</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching || isUpdating}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          <span>{isFetching ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by email or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={userTypeFilter}
              onChange={(e) => setUserTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
          </div>
        </div>

        {/* Table + Details Panel */}
        <div className="w-full">
          <UserTable
            users={filteredUsers}
            pagination={pagination}
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            isUpdating={isUpdating}
            isDeleting={isDeleting}
            onMutate={mutateUser}
            onDeleteClick={handleDeleteClick}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>
    </div>
  );
};

export default UserManagement;