import { useState } from 'react';
import { Shield, AlertTriangle, Clock, Search, RefreshCw } from 'lucide-react';
import apiClient from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { getSourceBadge, Pagination } from './shared';

const fetchWafLogs = async ({ page, limit }) => {
  const { data } = await apiClient.get('/api/admin/audit-logs', {
    params: { page, limit, action: 'WAF_BLOCKED' }
  });
  return { logs: data.logs || [], pagination: data.pagination || {} };
};

export default function WafStatusView() {
  const [page, setPage] = useState(1);
  const limit = 50;
  const [ipFilter, setIpFilter] = useState('');

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['wafLogs', page, ipFilter],
    queryFn: () => fetchWafLogs({ page, limit }),
    refetchInterval: 120000,
  });

  const logs = data?.logs || [];
  const pagination = data?.pagination || {};

  const filteredLogs = ipFilter
    ? logs.filter(l => l.ipAddress?.includes(ipFilter))
    : logs;

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="flex items-center gap-3 p-4 bg-purple-50 border border-purple-200 rounded-xl">
        <Shield className="w-6 h-6 text-purple-600 flex-shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-purple-900">Web Application Firewall Status</h3>
          <p className="text-xs text-purple-700 mt-0.5">
            {pagination.total > 0 ? `${pagination.total} requests blocked since inception` : 'No WAF blocks recorded yet. System is monitoring all routes.'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Filter blocked logs by IP..."
            value={ipFilter}
            onChange={(e) => setIpFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          />
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

      {/* Table */}
      {isLoading ? <div className="py-12 text-center text-gray-500">Loading WAF blocks...</div>
      : isError ? <div className="py-12 text-center text-red-500">Failed to load WAF data.</div>
      : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Timestamp</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Source</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Attack Type</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">Target</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-8 text-gray-500">No WAF blocks found.</td></tr>
              ) : filteredLogs.map((log) => (
                <tr key={log._id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm text-gray-700">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </td>
                  <td className="py-3 px-4">{getSourceBadge(log.source)}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                      {log.details?.attackType?.replaceAll('_', ' ') || 'UNKNOWN'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-600 font-mono truncate max-w-[150px]">
                    {log.resource || '—'}
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