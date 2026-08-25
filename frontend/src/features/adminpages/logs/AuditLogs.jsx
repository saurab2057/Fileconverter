import { useState } from 'react';
import { Search, Filter, Clock, User, Shield, RefreshCw } from 'lucide-react';
import apiClient from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { AUDIT_ACTIONS, getAuditActionBadge, getSourceBadge, Pagination } from './shared';

const fetchAuditLogs = async ({ page, limit, action, ipAddress }) => {
  const params = { page, limit };
  if (action) params.action = action;
  if (ipAddress) params.ipAddress = ipAddress;
  const { data } = await apiClient.get('/api/admin/audit-logs', { params });
  return { logs: data.logs || [], pagination: data.pagination || {} };
};

export default function AuditLogsView() {
  const [page, setPage] = useState(1);
  const limit = 50;
  const [actionFilter, setActionFilter] = useState('');
  const [ipFilter, setIpFilter] = useState('');

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['auditLogs', page, actionFilter, ipFilter],
    queryFn: () => fetchAuditLogs({ page, limit, action: actionFilter, ipAddress: ipFilter }),
    refetchInterval: 120000,
  });

  const logs = data?.logs || [];
  const pagination = data?.pagination || {};

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
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
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">All Actions</option>
            {AUDIT_ACTIONS.map(a => <option key={a} value={a}>{a.replaceAll('_', ' ')}</option>)}
          </select>
        </div>
        <button
          onClick={refetch}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {isLoading ? <div className="py-12 text-center text-gray-500">Loading audit logs...</div>
        : isError ? <div className="py-12 text-center text-red-500">Failed to load audit logs.</div>
          : (
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
                    <tr><td colSpan="6" className="text-center py-8 text-gray-500">No audit logs found.</td></tr>
                  ) : logs.map((log) => (
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
                            <div className="text-sm font-medium text-gray-900">{log.userId?.email || '—'}</div>
                            <div className="text-xs text-gray-500">{log.userId?.name || ''}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">{getSourceBadge(log.source)}</td>
                      <td className="py-3 px-4">{getAuditActionBadge(log.action)}</td>
                      <td className="py-3 px-4 text-xs text-gray-600">
                        {log.details && Object.keys(log.details).length > 0 ? (
                          <div className="space-y-0.5">
                            {log.details.newStatus && <div>Status: <span className="font-medium">{log.details.previousStatus}</span> → <span className="font-medium">{log.details.newStatus}</span></div>}
                            {log.details.newRole && <div>Role: <span className="font-medium">{log.details.previousRole}</span> → <span className="font-medium">{log.details.newRole}</span></div>}
                            {log.details.deletedUser && <div>Deleted: <span className="font-medium">{log.details.deletedUser}</span></div>}
                            {log.details.reason === 'auto_delete_banned_user' && <div>Auto-deleted after 30 day ban</div>}

                            {/* 🔥 NEW: Beautiful WAF display */}
                            {log.action === 'WAF_BLOCKED' && (
                              <>
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                    {log.details.attackType?.replaceAll('_', ' ') || 'WAF BLOCK'}
                                  </span>
                                </div>
                              </>
                            )}

                          </div>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-3 px-4 text-sm font-mono text-gray-600">{log.ipAddress}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      <Pagination page={page} pagination={pagination} limit={limit} onPageChange={setPage} />
    </div>
  );
}