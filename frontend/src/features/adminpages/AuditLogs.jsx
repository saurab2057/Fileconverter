import { useState } from 'react';
import { Search, Filter, Clock, User, Shield, RefreshCw, Settings, Activity } from 'lucide-react';
import apiClient from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

// ─── API ──────────────────────────────────────────────────────
const fetchAuditLogs = async ({ page, limit, action, ipAddress }) => {
  const params = { page, limit };
  if (action) params.action = action;
  if (ipAddress) params.ipAddress = ipAddress;
  const { data } = await apiClient.get('/api/admin/audit-logs', { params });
  return { logs: data.logs || [], pagination: data.pagination || {} };
};

const fetchActivityLogs = async ({ page, limit, action, userId }) => {
  const params = { page, limit };
  if (action) params.action = action;
  if (userId) params.userId = userId;
  const { data } = await apiClient.get('/api/admin/activity-logs', { params });
  return { logs: data.logs || [], pagination: data.pagination || {} };
};

// ─── Constants ────────────────────────────────────────────────
const AUDIT_ACTIONS = [
  'USER_UPDATED',
  'USER_BANNED',
  'USER_DELETED',
  'CONFIG_UPDATED',
  'JOB_DELETED',
  'ADMIN_LOGIN',
];

const ACTIVITY_ACTIONS = [
  'USER_LOGIN',
  'USER_CREATED',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_RESET_COMPLETED',
  'SESSION_REVOKED',
];

// ─── Badges ───────────────────────────────────────────────────
const getAuditActionBadge = (action) => {
  const colors = {
    'USER_UPDATED': 'bg-blue-100 text-blue-800',
    'USER_BANNED': 'bg-red-100 text-red-800',
    'USER_DELETED': 'bg-red-200 text-red-900',
    'CONFIG_UPDATED': 'bg-amber-100 text-amber-800',
    'ADMIN_LOGIN': 'bg-green-100 text-green-800',
    'JOB_DELETED': 'bg-orange-100 text-orange-800',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[action] || 'bg-gray-100 text-gray-800'}`}>
      {action.replaceAll('_', ' ')}
    </span>
  );
};

const getActivityActionBadge = (action) => {
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

const getSourceBadge = (source) => {
  if (source === 'system') {
    return (
      <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
        SYSTEM
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
      ADMIN
    </span>
  );
};

// ─── Pagination ───────────────────────────────────────────────
const Pagination = ({ page, pagination, limit, onPageChange }) => {
  if (!pagination.totalPages || pagination.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-6 border-t pt-4">
      <div className="text-sm text-gray-600">
        Showing {(page - 1) * limit + 1} to {Math.min(page * limit, pagination.total)} of {pagination.total} entries
      </div>
      <div className="flex space-x-2">
        <button
          onClick={() => onPageChange(p => Math.max(1, p - 1))}
          disabled={!pagination.hasPrev}
          className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 text-sm"
        >Previous</button>
        <span className="px-4 py-2 text-gray-700 text-sm">
          Page {page} of {pagination.totalPages}
        </span>
        <button
          onClick={() => onPageChange(p => Math.min(pagination.totalPages, p + 1))}
          disabled={!pagination.hasNext}
          className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 text-sm"
        >Next</button>
      </div>
    </div>
  );
};

// ─── Audit Logs Tab ───────────────────────────────────────────
const AuditLogsTab = () => {
  const [page, setPage] = useState(1);
  const limit = 50;
  const [actionFilter, setActionFilter] = useState('');
  const [ipFilter, setIpFilter] = useState('');

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['auditLogs', page, actionFilter, ipFilter],
    queryFn: () => fetchAuditLogs({ page, limit, action: actionFilter, ipAddress: ipFilter }),
    refetchInterval: 120000,
    refetchIntervalInBackground: false,
  });

  const logs = data?.logs || [];
  const pagination = data?.pagination || {};

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Filter by IP address..."
            value={ipFilter}
            onChange={(e) => { setIpFilter(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">All Actions</option>
            {AUDIT_ACTIONS.map(a => (
              <option key={a} value={a}>{a.replaceAll('_', ' ')}</option>
            ))}
          </select>
        </div>
        <button
          onClick={refetch}
          disabled={isFetching}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          <span>{isFetching ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="py-12 text-center text-gray-500">Loading audit logs...</div>
      ) : isError ? (
        <div className="py-12 text-center text-red-500">Failed to load audit logs.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Timestamp</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">By</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Source</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Action</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Details</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-500">No audit logs found.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-700">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {log.userId?.email || '—'}
                          </div>
                          <div className="text-xs text-gray-500">{log.userId?.name || ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">{getSourceBadge(log.source)}</td>
                    <td className="py-3 px-4">{getAuditActionBadge(log.action)}</td>
                    <td className="py-3 px-4 text-xs text-gray-600">
                      {log.details && Object.keys(log.details).length > 0 ? (
                        <div className="space-y-0.5">
                          {log.details.newStatus && (
                            <div>Status: <span className="font-medium">{log.details.previousStatus}</span> → <span className="font-medium">{log.details.newStatus}</span></div>
                          )}
                          {log.details.newRole && (
                            <div>Role: <span className="font-medium">{log.details.previousRole}</span> → <span className="font-medium">{log.details.newRole}</span></div>
                          )}
                          {log.details.deletedUser && (
                            <div>Deleted: <span className="font-medium">{log.details.deletedUser}</span></div>
                          )}
                          {log.details.reason === 'auto_delete_banned_user' && (
                            <div>Auto-deleted after 30 day ban</div>
                          )}
                        </div>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="py-3 px-4 text-sm font-mono text-gray-600">{log.ipAddress}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} pagination={pagination} limit={limit} onPageChange={setPage} />
    </div>
  );
};

// ─── Activity Logs Tab ────────────────────────────────────────
const ActivityLogsTab = () => {
  const [page, setPage] = useState(1);
  const limit = 50;
  const [actionFilter, setActionFilter] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['activityLogs', page, actionFilter, userIdFilter],
    queryFn: () => fetchActivityLogs({ page, limit, action: actionFilter, userId: userIdFilter }),
    refetchInterval: 120000,
    refetchIntervalInBackground: false,
  });

  const logs = data?.logs || [];
  const pagination = data?.pagination || {};

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Filter by user ID..."
            value={userIdFilter}
            onChange={(e) => { setUserIdFilter(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">All Actions</option>
            {ACTIVITY_ACTIONS.map(a => (
              <option key={a} value={a}>{a.replaceAll('_', ' ')}</option>
            ))}
          </select>
        </div>
        <button
          onClick={refetch}
          disabled={isFetching}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          <span>{isFetching ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="py-12 text-center text-gray-500">Loading activity logs...</div>
      ) : isError ? (
        <div className="py-12 text-center text-red-500">Failed to load activity logs.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Timestamp</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">User</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Action</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-gray-500">No activity logs found.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-700">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-3.5 h-3.5 text-gray-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {log.userId?.email || '—'}
                          </div>
                          <div className="text-xs text-gray-500">{log.userId?.name || ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">{getActivityActionBadge(log.action)}</td>
                    <td className="py-3 px-4 text-sm font-mono text-gray-600">{log.ipAddress}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} pagination={pagination} limit={limit} onPageChange={setPage} />
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────
const AuditLogs = () => {
  const [activeTab, setActiveTab] = useState('audit');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Logs</h1>
        <p className="text-gray-600 mt-1">Security trail of admin actions and user activity</p>
      </div>

      {/* Tabs + Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Tab Bar */}
        <div className="flex border-b border-gray-200 px-6">
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === 'audit'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            <Shield className="w-4 h-4" />
            Audit Logs
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === 'activity'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            <Activity className="w-4 h-4" />
            Activity Logs
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'audit' && <AuditLogsTab />}
          {activeTab === 'activity' && <ActivityLogsTab />}
        </div>
      </div>

      {/* Compliance Badge — only on audit tab */}
      {activeTab === 'audit' && (
        <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-lg">
          <div className="flex items-start">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Immutable Audit Trail</h3>
              <p className="mt-1 text-sm text-blue-700">
                These logs are immutable and cannot be modified or deleted per compliance requirements.
                All admin actions are permanently recorded with IP address, source, and timestamp.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;