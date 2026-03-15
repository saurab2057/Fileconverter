import React, { useState, useEffect } from 'react';
import {
  Search, Filter, Clock, CheckCircle, XCircle, Download, RefreshCw
} from 'lucide-react';
import apiClient from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

// 🔒 FETCH JOBS WITH PAGINATION + RETURN FULL RESPONSE (jobs + pagination metadata)
const fetchAndFormatJobs = async (page, limit) => {
  const response = await apiClient.get('/api/admin/jobs', { params: { page, limit } });
  // CRITICAL FIX: Extract jobs array from paginated response
  const jobsArray = response.data.jobs || [];
  const formattedJobs = jobsArray.map(job => ({
    ...job,
    id: job._id,
    user: job.userId?.email || 'Unknown',
    tool: `Converted to ${job.format}` || 'Unknown Tool',
    fileName: job.filename,
    fileSize: `${(job.sizeInBytes / 1024 / 1024).toFixed(2)} MB`,
    status: job.status || 'completed',
    timestamp: new Date(job.processedAt || job.createdAt).toLocaleString(),
    processingTime: job.processingTimeMs ? `${job.processingTimeMs}ms` : null,
    error: job.error || null
  }));
  // Return BOTH jobs AND pagination metadata for UI controls
  return {
    jobs: formattedJobs,
    pagination: response.data.pagination
  };
};

const JobMonitor = () => {
  // 🔒 PAGINATION STATE (critical for navigation)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20; // Matches backend default
  
  // 🔒 FILTER STATE (unchanged)
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toolFilter, setToolFilter] = useState('all');

  // 🔒 RESET TO PAGE 1 WHEN FILTERS CHANGE (critical UX)
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, toolFilter]);

  // 🔒 FETCH JOBS WITH PAGINATION PARAMETERS
  const {
    data,
    isLoading,
    isError,
    error: fetchError,
    refetch,
    isFetching
  } = useQuery({
    queryKey: ['jobMonitorJobs', currentPage, itemsPerPage], // Include page in key
    queryFn: () => fetchAndFormatJobs(currentPage, itemsPerPage),
    refetchInterval: 60000,
    refetchIntervalInBackground: false
  });

  // 🔒 EXTRACT JOBS + PAGINATION FROM RESPONSE
  const jobs = data?.jobs || [];
  const pagination = data?.pagination || {};

  // 🔒 FILTER JOBS CLIENT-SIDE (applied to CURRENT PAGE only)
  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    const matchesTool = toolFilter === 'all' || job.tool === toolFilter;
    return matchesSearch && matchesStatus && matchesTool;
  });

  // 🔒 STATUS BADGE (unchanged)
  const getStatusBadge = (status) => {
    const badgeConfig = {
      completed: { icon: CheckCircle, color: 'text-green-700', bg: 'bg-green-100', label: 'Completed' },
      processing: { icon: Clock, color: 'text-yellow-700', bg: 'bg-yellow-100', label: 'Processing' },
      failed: { icon: XCircle, color: 'text-red-700', bg: 'bg-red-100', label: 'Failed' },
      queued: { icon: Clock, color: 'text-gray-700', bg: 'bg-gray-100', label: 'Queued' }
    };
    const config = badgeConfig[status] || badgeConfig.completed;
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  // 🔒 CONDITIONAL RENDERING
  if (isLoading) return <div className="p-4 text-center">Loading jobs...</div>;
  if (isError) return <div className="p-4 text-center text-red-500">Error: {fetchError?.message || 'Failed to load jobs.'}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Job Monitor</h1>
          <p className="text-gray-600 mt-1">Track all file processing jobs and their status</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            <span>{isFetching ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Download className="w-4 h-4" />
            <span>Export Logs</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by user, filename, or job ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
              <option value="queued">Queued</option>
            </select>

            <select
              value={toolFilter}
              onChange={(e) => setToolFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Tools</option>
              <option value="Converted to PDF">PDF</option>
              <option value="Converted to DOCX">DOCX</option>
              <option value="Resized Image">Image Resize</option>
              <option value="Compressed File">Compression</option>
              <option value="Extracted Text">Text Extraction</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Job ID</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">User</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Tool</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">File</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-500">
                    No jobs found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => (
                  <tr key={job.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4 font-mono text-sm text-gray-600">{job.id}</td>
                    <td className="py-4 px-4 text-sm text-gray-900">{job.user}</td>
                    <td className="py-4 px-4 text-sm text-gray-900">{job.tool}</td>
                    <td className="py-4 px-4">
                      <div>
                        <div className="text-sm text-gray-900">{job.fileName}</div>
                        <div className="text-xs text-gray-500">{job.fileSize}</div>
                      </div>
                    </td>
                    <td className="py-4 px-4">{getStatusBadge(job.status)}</td>
                    <td className="py-4 px-4">
                      <div>
                        <div className="text-sm text-gray-900">{job.timestamp}</div>
                        {job.processingTime && (
                          <div className="text-xs text-gray-500">{job.processingTime}</div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 🔒 PAGINATION CONTROLS (NEW) */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, pagination.total)} of {pagination.total} jobs
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={!pagination.hasPrev}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-gray-700">
                Page {currentPage} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={!pagination.hasNext}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JobMonitor;