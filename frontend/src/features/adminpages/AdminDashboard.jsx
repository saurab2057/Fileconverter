import React from 'react';
import { Clock, CheckCircle, XCircle, Server, Users } from 'lucide-react';
import apiClient from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

// 🔒 FETCH DASHBOARD STATS
const fetchAdminStats = async () => {
  const { data } = await apiClient.get('/api/admin/stats');
  return data;
};

// 🔒 FETCH RECENT JOBS (ONLY 5 FOR DASHBOARD)
const fetchRecentJobsData = async () => {
  // Request ONLY 5 jobs (efficient)
  const response = await apiClient.get('/api/admin/jobs?page=1&limit=5');
  // CRITICAL FIX: Extract jobs array from paginated response
  const jobsArray = response.data.jobs || [];
  return jobsArray.map(job => ({
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
};

// Reusable Metrics Card Component
const MetricsCard = ({ title, value, icon: Icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200'
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">{value}</h2>
        <p className="text-sm text-gray-600">{title}</p>
      </div>
    </div>
  );
};

// Recent Jobs Component
const RecentJobs = ({ jobs }) => {
  const getStatusBadge = (status) => {
    const config = {
      completed: { class: 'bg-green-100 text-green-800', icon: 'text-green-500' },
      failed: { class: 'bg-red-100 text-red-800', icon: 'text-red-500' },
      processing: { class: 'bg-yellow-100 text-yellow-800', icon: 'text-yellow-500' },
      queued: { class: 'bg-gray-100 text-gray-800', icon: 'text-gray-500' }
    };
    const selected = config[status] || config.queued; // fallback to queued
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${selected.class}`}>
        <CheckCircle className={`w-4 h-4 ${selected.icon} mr-1.5`} />
        <span className="capitalize">{status}</span>
      </span>
    );
  };

  if (!jobs || jobs.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Jobs</h2>
        <p className="text-gray-500 text-center py-4">No recent jobs to display.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Jobs</h2>
      <div className="space-y-3">
        {jobs.slice(0, 5).map((job) => (
          <div key={job.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
            <div>
              <p className="text-sm font-medium text-gray-900">{job.fileName}</p>
              <p className="text-xs text-gray-500">{job.user}</p>
            </div>
            {getStatusBadge(job.status)}
          </div>
        ))}
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  // Fetch stats with auto-refresh
  const {
    data: stats,
    isLoading: isLoadingStats,
    isError: isErrorStats,
    error: statsError,
  } = useQuery({
    queryKey: ['adminStats'],
    queryFn: fetchAdminStats,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });

  // Fetch recent jobs with auto-refresh
  const {
    data: recentJobs,
    isLoading: isLoadingJobs,
    isError: isErrorJobs,
    error: jobsError,
  } = useQuery({
    queryKey: ['recentDashboardJobs'],
    queryFn: fetchRecentJobsData,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });

  const isLoading = isLoadingStats || isLoadingJobs;
  const isError = isErrorStats || isErrorJobs;
  const combinedError = statsError || jobsError;

  if (isLoading) return <div className="p-4 text-center">Loading dashboard...</div>;
  if (isError) return <div className="p-4 text-center text-red-500">Error: {combinedError?.message || 'Failed to load dashboard data.'}</div>;
  if (!stats || !recentJobs) return null;

  const metrics = [
    { title: 'Total Users', value: stats.totalUsers.value, icon: Users, color: 'blue' },
    { title: 'Successful Jobs (24h)', value: stats.successfulJobs.value, icon: CheckCircle, color: 'green' },
    { title: 'Failed Jobs (24h)', value: stats.failedJobs.value, icon: XCircle, color: 'red' },
    { title: 'Server Load', value: stats.serverLoad.value, icon: Server, color: 'amber' }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-1">Live overview of your FileTools service.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => (
          <MetricsCard key={index} {...metric} />
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <RecentJobs jobs={recentJobs} />
      </div>
    </div>
  );
};

export default AdminDashboard;