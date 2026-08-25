import { ChevronLeft, ChevronRight } from 'lucide-react';

export const AUDIT_ACTIONS = [
  'USER_UPDATED', 'USER_BANNED', 'USER_DELETED',
  'CONFIG_UPDATED', 'JOB_DELETED', 'ADMIN_LOGIN', 'WAF_BLOCKED'
];

export const ACTIVITY_ACTIONS = [
  'USER_LOGIN', 'USER_CREATED', 'PASSWORD_RESET_REQUESTED',
  'PASSWORD_RESET_COMPLETED', 'SESSION_REVOKED'
];

export const getAuditActionBadge = (action) => {
  const colors = {
    'USER_UPDATED': 'bg-blue-100 text-blue-800',
    'USER_BANNED': 'bg-red-100 text-red-800',
    'USER_DELETED': 'bg-red-200 text-red-900',
    'CONFIG_UPDATED': 'bg-amber-100 text-amber-800',
    'ADMIN_LOGIN': 'bg-green-100 text-green-800',
    'JOB_DELETED': 'bg-orange-100 text-orange-800',
    'WAF_BLOCKED': 'bg-purple-100 text-purple-900',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[action] || 'bg-gray-100 text-gray-800'}`}>
      {action.replaceAll('_', ' ')}
    </span>
  );
};

export const getActivityActionBadge = (action) => {
  const colors = {
    'USER_LOGIN': 'bg-green-100 text-green-800',
    'USER_CREATED': 'bg-blue-100 text-blue-800',
    'PASSWORD_RESET_REQUESTED': 'bg-amber-100 text-amber-800',
    'PASSWORD_RESET_COMPLETED': 'bg-purple-100 text-purple-800',
    'SESSION_REVOKED': 'bg-gray-100 text-gray-800',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[action] || 'bg-gray-100 text-gray-800'}`}>
      {action.replaceAll('_', ' ')}
    </span>
  );
};

export const getSourceBadge = (source) => (
  <span className={`px-2 py-0.5 rounded text-xs font-medium ${source === 'system' ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 text-blue-800'}`}>
    {source.toUpperCase()}
  </span>
);

export const Pagination = ({ page, pagination, limit, onPageChange }) => {
  if (!pagination.totalPages || pagination.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
      <span>
        Showing {(page - 1) * limit + 1} to {Math.min(page * limit, pagination.total)} of {pagination.total}
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(p => Math.max(1, p - 1))}
          disabled={!pagination.hasPrev}
          className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
        >
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>
        <span className="px-3 py-1.5 bg-gray-100 rounded-lg">
          Page {page} of {pagination.totalPages}
        </span>
        <button
          onClick={() => onPageChange(p => Math.min(pagination.totalPages, p + 1))}
          disabled={!pagination.hasNext}
          className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};