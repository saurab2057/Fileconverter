import { Crown, Users, CheckCircle, Ban } from 'lucide-react';
import UserActions from './UserActions';

const getUserTypeBadge = (type = 'user') => {
    const config = {
        admin: { icon: Crown, color: 'text-amber-700', bg: 'bg-amber-100', label: 'Admin' },
        user:  { icon: Users, color: 'text-gray-700',  bg: 'bg-gray-100',  label: 'User'  }
    };
    const s = config[type] || config.user;
    const Icon = s.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.color}`}>
            <Icon className="w-3 h-3" />{s.label}
        </span>
    );
};

const getStatusBadge = (status = 'active') => {
    const config = {
        active: { icon: CheckCircle, color: 'text-green-700', bg: 'bg-green-100', label: 'Active' },
        banned: { icon: Ban,         color: 'text-red-700',   bg: 'bg-red-100',   label: 'Banned' },
    };
    const s = config[status] || config.active;
    const Icon = s.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.color}`}>
            <Icon className="w-3 h-3" />{s.label}
        </span>
    );
};

const getRowClass = (user) => {
    const base = 'border-b transition-colors ';
    if (user.status === 'banned') return base + 'bg-red-50 border-red-200 hover:bg-red-100';
    return base + 'border-gray-100 hover:bg-gray-50';
};

const UserTable = ({
    users, pagination, currentPage, itemsPerPage,
    isUpdating, isDeleting,
    onMutate, onDeleteClick,
    onPageChange
}) => {
    return (
        <div className="w-full">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-gray-200">
                            <th className="text-left py-3 px-4 font-semibold text-gray-900">User</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-900">Role</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-900">Join Date</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-900">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="text-center py-8 text-gray-500">
                                    No users found matching your criteria.
                                </td>
                            </tr>
                        ) : (
                            users.map((user) => (
                                <tr key={user._id} className={getRowClass(user)}>
                                    <td className="py-4 px-4">
                                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                                        <div className="text-xs text-gray-500">{user.email}</div>
                                    </td>
                                    <td className="py-4 px-4">{getUserTypeBadge(user.role)}</td>
                                    <td className="py-4 px-4">{getStatusBadge(user.status)}</td>
                                    <td className="py-4 px-4 text-sm text-gray-700">
                                        {new Date(user.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="py-4 px-4">
                                        <UserActions
                                            user={user}
                                            isUpdating={isUpdating}
                                            isDeleting={isDeleting}
                                            onMutate={onMutate}
                                            onDeleteClick={onDeleteClick}
                                        />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-600">
                        Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                        {Math.min(currentPage * itemsPerPage, pagination.total)} of {pagination.total} users
                    </div>
                    <div className="flex space-x-2">
                        <button
                            onClick={() => onPageChange(p => Math.max(1, p - 1))}
                            disabled={!pagination.hasPrev}
                            className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 text-sm"
                        >Previous</button>
                        <span className="px-4 py-2 text-gray-700 text-sm">
                            Page {currentPage} of {pagination.totalPages}
                        </span>
                        <button
                            onClick={() => onPageChange(p => Math.min(pagination.totalPages, p + 1))}
                            disabled={!pagination.hasNext}
                            className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 text-sm"
                        >Next</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserTable;